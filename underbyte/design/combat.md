# UNDERBYTE — Roster & Combat Design

Status: canonical. Implementers copy every number here verbatim into `UB.Characters` /
`UB.Combat`. If a number is missing, it is a bug in this doc — add it here first, then code it.
All content below is original. No names, designs, terms or numbers are taken from any
existing game.

---

## 0. Conventions (read before the tables)

* **Timing.** Fixed 60 Hz logic. All durations are in frames (f) unless marked `s`.
  Frame 1 is the first frame a move exists. A move with Startup S, Active A, Recovery R:
  startup = f1..fS, active = f(S+1)..f(S+A), recovery = f(S+A+1)..f(S+A+R).
* **Units.** Pixels (px), px/s, px/s². Tile = 30 px. Logical canvas 960x540.
* **Body box.** Each fighter has one axis-aligned collision box `w x h` that never changes
  (not even in Overclock). The **body center** `(0,0)` is the box center. The box bottom is
  the feet line.
* **Local coordinates.** `+x` = facing direction, `+y` = down (canvas convention). When the
  fighter faces left, negate every `x`/`cx` (draw with `ctx.scale(-1,1)`).
* **Attack hitbox** = `(cx, cy, w, h)`: center offset from body center (`cx` along facing,
  `cy` down), then width and height. AABB test against enemy body boxes on every active
  frame. Each move *instance* keeps a hit-list so an enemy is hit at most once per instance,
  except where a move says "multi-tick".
* **Knockback** `(kx, ky)` in px/s: `kx` along the attacker's facing (negative = pull toward
  attacker), `ky` positive = down (so −220 launches up). Applied to the victim as
  `v = (kx * facing, ky) * victim.kbResist` (normal enemies 1.0, heavy enemies 0.5,
  bosses 0.0 = never moved but still flash/hitstop).
* **Hitstop.** "World" hitstop freezes the entire simulation (players, enemies, projectiles,
  moving platforms) except particles, camera shake and UI. "Local" hitstop freezes only the
  victim (used by projectiles and summons so the shooter keeps moving). Overlapping hitstops
  do not stack: `timer = max(timer, new)`. Input buffer timers do not tick during hitstop.
* **Damage** is an integer. Enemy HP 2–40, bosses 120–300. Overclock damage = `floor(d*1.5)`.
* **Hearts.** Player HP is whole hearts. Base 4–6 per fighter, +1 per hidden core (3 cores).

Suggested inputs (final binding lives in the controls/UI doc; these are the actions):
`Jump`, `Light`, `Heavy`, `Special`, `Dash`, `Overclock`, plus the d-pad/stick. Airborne:
`Light` = Air Attack; `Light`+`Down` or `Heavy` = Down-Strike.

---

## 1. Roster at a glance

| Fighter | Concept | Affinity | Feel | HP | Run | Body |
|---|---|---|---|---|---|---|
| **Tessik** | The Courier Lantern | Signal | balanced | 5 | 235 | 22x48 |
| **Brackmaw** | The Walking Vault | Ore | heavy-slow-strong | 6 | 180 | 34x54 |
| **Vellix** | The Prefetch Streak | Flux | fast-fragile | 4 | 300 | 18x40 |
| **Orrubel** | The Ring Warden | Cipher | zoner | 5 | 215 | 24x44 |
| **Korvask** | The Clamp Balancer | Pressure | grappler-ish bruiser | 6 | 200 | 30x56 |

Affinity is cosmetic only (hit-spark color, SFX timbre). No damage-type multipliers exist.

Specials (each mechanically distinct):
Tessik = ground wave · Brackmaw = area burst (air: dive-slam) · Vellix = dash-strike ·
Orrubel = deploy/sentry · Korvask = counter/parry.

---

## 2. Fighter sheets

### 2.1 TESSIK — The Courier Lantern (balanced)

**Concept.** A lean, long-limbed messenger with a faceted lantern for a head, trailing a cloak
of loose cable strands.
**Affinity.** Signal (amber-white sparks; SFX = clean sine chirps).
**Personality.** A courier process that once carried messages between the kingdom's layers
and still narrates its route under its breath. Patient and dryly cheerful, it is convinced
every corrupted thing is just a message that lost its address.

**Visual design** (body box 22x48 → x −11..11, y −24..24; facing right; ~38 path commands):
* Palette: base `#2F7A86`, shade `#163E47`, accent `#F0B64A`, glow `#DFFBFF`.
* Silhouette: a thin upright figure with a wide hexagonal head and a flared, strand cloak.
* Head: pointy-top hexagon ("prism lantern") 18 wide x 20 tall centered (0,−16), fill base,
  stroke shade; inner diamond core 6x8 at (0,−16) in glow (alpha pulses, see idle).
* Neck: 2 px line (0,−6)→(0,−4), shade.
* Torso: trapezoid shoulders 12 wide at y −4 to hips 8 wide at y 8, fill base, stroke shade.
* Cloak: 5 strands (quadraticCurveTo) from shoulder points x ∈ {−6,−3,0,3,6} at y −4 down to
  y 20, control point pushed 4 px opposite the facing; 2 px bead (accent) at each tip.
* Arms: 2 px lines from (±6,−4) to elbows (±9,6); forearms are elongated triangles 14 long x
  4 wide (accent) — the "blades".
* Legs: 2 px lines from (0,8) to feet (±4,24); feet = 6x3 wedges pointing forward (shade).
* Distinctive: hexagonal head, blade forearms, strand cloak that reacts to velocity.

**Poses.**
* Idle: upright; strands sway ±2 px on a 1.2 s sine; core alpha 0.8→1.0 on 1.5 s; 1 px bob.
* Run: torso leans 10° forward; 8 f stride cycle; strands stream back at 25°; arms pump ±6 px.
* Jump: knees tuck to y 10, arms up 30°, strands hang straight, head tilts 5° back.
* Fall: arms out horizontal, legs apart (±7), strands fly up 30°.
* Light: a forearm blade sweeps a 120° arc in front; draw an arc trail (accent, alpha 0.6,
  radius 26) spanning the hitbox for the active frames.
* Heavy: both blades raised over the head (f1–12), then slammed down; cloak flares to ±14 px;
  3 short amber spark lines at the impact point.
* Special: crouch 4 px, one palm to the floor; a glow ellipse 40x8 pulses at the feet; the
  Pulse Line is a 26x26 glowing wedge sliding along the floor leaving a dotted trail.
* Hurt: bends back 20°, strands fly forward, core flickers alpha 0.2/1.0 every 2 f, red tint.
* Overclock form: scale 1.25; palette base `#19B5C8`, shade `#0B4A55`, accent `#FFE08A`,
  glow `#FFFFFF`; extra feature: a second, larger hexagon outline orbits the head
  (1 rev / 2 s) and the cloak becomes 7 glowing strands.

**Stats.**

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | 235 | 2300 | 2600 | 0.80 | 640 | 1800 | 900 | 1.00 | 150 px / 12 f (750 px/s) | 22x48 | 90 |

Derived: jump height 113.8 px (3.8 tiles), apex in 21 f, double-jump apex 196 px,
single-jump horizontal reach 167 px.

**Moveset** (frame data @60 Hz; hitbox `(cx,cy,w,h)`; KB `(kx,ky)`; "Lunge" = vx set on f1,
decays with friction; cancel columns are the first frame the listed action may start).

| Move | S | A | R | Total | Hitbox | Dmg | KB | Hitstop | Lunge | Hit-cancel→next | Whiff-cancel→next | Jump-cancel (hit) | Energy | Meter |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 Edge Sweep | 4 | 3 | 8 | 15 | (30,−2,44,30) | 3 | (180,−60) | 3 world | 40 | f8 | f12 | f8 | +4 | +2 |
| L2 Cross Cut | 4 | 3 | 9 | 16 | (32,−4,48,34) | 3 | (200,−80) | 3 world | 40 | f8 | f13 | f8 | +4 | +2 |
| L3 Lantern Thrust | 6 | 4 | 14 | 24 | (38,−2,56,30) | 5 | (380,−120) | 4 world | 90 | f11 (jump/dash/special) · f17 (L1 re-chain) | none | f11 | +6 | +4 |
| Heavy Prism Hammer | 12 | 5 | 18 | 35 | (34,0,56,52) | 9 | (460,−220) | 5 world | 0 | none | none | no | +10 | +6 |
| Special Pulse Line | 10 | proj | 16 | 26 | proj 26x26 | 6 | (260,−200) | 4 local | 0 | none | none | no | −30 | +5/enemy |
| Air Skyline Arc | 5 | 4 | 10 | 19 | (26,−6,44,40) | 3 | (160,−40) | 3 world | — | — | — | — | +4 | +2 |
| Down-Strike Lantern Drop | 4 | until land | 6 landing | — | (4,26,24,30) | 4 | (60,120) | 3 world | — | — | — | — | +5 | +3 |

Visuals: L1/L2 = alternating forearm-blade sweeps (left then right blade); L3 = both blades
thrust forward together, lantern core flares; Heavy = two-blade overhead slam; Air = a
rising 160° arc above and ahead; Down-Strike = feet-first with blades pointed down.

**Special — Pulse Line (ground wave).** Grounded only (an airborne press is buffered for
6 f and fires on landing). On f11 spawn a projectile at body-local (16,+18) (on the floor):
box 26x26, speed 420 px/s along facing, snaps its bottom to the floor each frame, dies at a
wall, at a drop > 30 px, after 390 px, or after 56 f. Hits each enemy once: 6 dmg, KB
(260,−200), 4 f local hitstop. Cost 30 energy. Only one Pulse Line may exist; a second press
while one is alive is ignored.

**Ultimate — Sightline (while Overclocked, replaces Special).** Grounded only (buffered like
the special). S12, beam active 24 f, R16 (52 total). Beam hitbox: from the body front edge to
480 px forward (clipped at the first solid wall), height 28, `cy` −4. Multi-tick: hits every
enemy inside the beam on f13, f19, f25, f31 for 5 dmg per tick (20 total), KB (120,−40),
2 f local hitstop per tick. Cost 40 energy. Visual: 6 px white-cyan line with a 2 px amber
core, jittering edge dots, 0.3 alpha full-screen flash on f13, screen shake 6 px / 10 f.

---

### 2.2 BRACKMAW — The Walking Vault (heavy-slow-strong)

**Concept.** A squat armored lock-brute that knuckle-walks on two pillar-like forearms, with
a vault dial embossed on its belly.
**Affinity.** Ore (ember-orange chips; SFX = low square thumps).
**Personality.** A retired archival lock that decided the safest vault is the one that walks
toward the problem. It speaks rarely, in short declaratives, and considers being knocked
over a personal failing.

**Visual design** (body box 34x54 → x −17..17, y −27..27; ~34 path commands):
* Palette: base `#5A5F6B`, shade `#2C2F38`, accent `#B4532B`, glow `#FF9A3C`.
* Silhouette: a boulder with two pillar arms and no neck.
* Torso: rounded rect 32x34 from y −20 to 14 (radius 8), fill base, stroke shade.
* Vault dial: circle r7 at (2,2) in accent with 4 tick lines (2 px) at 0/90/180/270°.
* Head slab: trapezoid base 28 wide (y −20) to top 18 wide (y −30), fill base; 4 rivet dots
  (r1, shade) along y −21 at x −10,−4,2,8.
* Eyes: two 3x3 glow squares at (4,−25) and (10,−25) — forward-set like headlights.
* Arms: two rounded rects 12x24 ("mitts") hanging from (±14,−14) to y 24, so the fists rest
  on the ground; 3 short knuckle lines (accent) across each mitt at y 16..20.
* Legs: two rounded rects 10x13 under the torso from y 14 to 27 at x ±6.
* Distinctive: the belly dial, headlight eyes, ground-resting mitts.

**Poses.**
* Idle: fists planted; torso rises/sinks 1 px on a 2 s cycle; eyes blink (height 0 for 4 f
  every 3 s).
* Run: knuckle-walk; 12 f cycle where the mitts swing forward and plant while the legs
  shuffle; torso bobs 3 px; a dust puff every 6 f.
* Jump: mitts raised to shoulder height, legs dangle, 5° back tilt.
* Fall: mitts reach straight up, legs spread, 8° forward tilt.
* Light: one mitt translates 20 px forward and 6 px up over the active frames, with a short
  grey smear behind it.
* Heavy: both mitts overhead (slab tilts up) then slam down in front; two parallel impact arcs
  on the ground and 5 rust chips.
* Special (ground): crouch 6 px then both mitts strike the ground beneath; an ember ring
  expands r 0→75 px over the active frames. Special (air): head-down dive, mitts forward.
* Hurt: rocks back 15° on its heels, mitts fly up, eyes flare, dial spins one revolution.
* Overclock form: scale 1.25; palette base `#6B3A2A`, shade `#2A1410`, accent `#FF7A2A`,
  glow `#FFF2B0`; extra feature: 6 jagged ember cracks glow across the torso and the vault
  dial becomes a furnace window (glow fill); eyes grow to 5x5.

**Stats.**

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | 180 | 1200 | 1500 | 0.55 | 620 | 2000 | 1050 | 0.60 | 120 px / 14 f (514 px/s) | 34x54 | 110 |

Derived: jump height 96.1 px (3.2 tiles), apex in 19 f, double-jump apex 165.5 px,
single-jump horizontal reach 112 px. (These are the roster minimums — see §4.11.)

**Moveset.**

| Move | S | A | R | Total | Hitbox | Dmg | KB | Hitstop | Lunge | Hit-cancel→next | Whiff-cancel→next | Jump-cancel (hit) | Energy | Meter |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 Mitt Jab | 6 | 3 | 10 | 19 | (34,2,46,36) | 4 | (220,−60) | 4 world | 30 | f10 | f15 | f10 | +4 | +2 |
| L2 Backfist | 6 | 3 | 11 | 20 | (36,−2,50,40) | 4 | (240,−80) | 4 world | 30 | f10 | f16 | f10 | +4 | +2 |
| L3 Vault Slam | 9 | 5 | 18 | 32 | (40,6,60,46) | 8 | (480,−160) | 5 world | 60 | f15 (jump/dash/special) · f21 (L1 re-chain) | none | f15 | +6 | +4 |
| Heavy Anvil Drop | 16 | 6 | 24 | 46 | (38,4,64,60) | 14 | (560,−300) | 6 world | 0 | none | none | no | +10 | +6 |
| Special Vault Stomp (ground) | 14 | 4 | 22 | 40 | (0,12,150,56) | 12 | (420 away,−320) | 7 world | 0 | none | none | no | −40 | +5/enemy |
| Special Vault Stomp (air) | 6 | dive, then 4 | 22 | var | dive (0,0,38,58) 6 dmg; burst as ground | 12 | as ground | 7 world | — | — | — | — | −40 | +5/enemy |
| Air Haymaker | 8 | 4 | 12 | 24 | (32,0,48,44) | 5 | (260,−60) | 4 world | — | — | — | — | +4 | +2 |
| Down-Strike Mitt Plunge | 6 | until land | 10 landing | — | (4,30,34,30) | 7 | (80,160) | 4 world | — | — | — | — | +5 | +3 |

Heavy armor: during Anvil Drop f6–f22 Brackmaw still takes damage but is not interrupted and
receives no knockback (hurt i-frames still start). Visuals: L1 = jab, L2 = back-hand swing of
the other mitt, L3 = both mitts slam forward and down together; Air = a wide hooking swing;
Down-Strike = both mitts pointed down, body stiff.

**Special — Vault Stomp (area burst).** Ground: hitbox is centered on the body (both sides)
at the feet: `(0,12,150,56)`. KB is "away": `kx = 420 * sign(enemy.x − player.x)` (0 → use
facing). Air: f1–6 startup, then dive at `vy = +1400` (horizontal input gives ±60 px/s drift)
with a body-sized hitbox `(0,0,38,58)` dealing 6 (once per enemy) until landing; on landing
the ground burst plays (A4 R22). Cost 40 energy (charged on press). Screen shake 5 px / 8 f.

**Ultimate — Quake Vault.** Ground: S18 A6 R28 (52). Hitbox `(0,10,300,70)`, 26 dmg, KB
(560 away,−420), 10 f world hitstop, screen shake 10 px / 16 f, 3 ember rings expanding to
r150. Air: dive as the special (dive hitbox 8 dmg), then the Quake burst on landing. Cost 40.

---

### 2.3 VELLIX — The Prefetch Streak (fast-fragile)

**Concept.** A whip-tailed digitigrade sprinter shaped like an arrowhead, built for being
somewhere else.
**Affinity.** Flux (magenta streaks; SFX = fast saw zips).
**Personality.** A cache-prefetch routine that lives three steps ahead of everyone and is
bored by the present. Reckless and bright, it treats every fight as a timing puzzle it has
already solved.

**Visual design** (body box 18x40 → x −9..9, y −20..20; ~30 path commands):
* Palette: base `#4C2A6E`, shade `#241236`, accent `#F7F4EA`, glow `#FF3FA4`.
* Silhouette: a forward-leaning arrowhead with a long whip tail.
* Head: wedge triangle pointing forward, 16 long x 8 tall, apex at (10,−14), fill base.
* Eye: one almond 5x3 (glow) at (4,−14).
* Crest: thin triangle from the head top (0,−18) sweeping back to (−14,−22), accent.
* Torso: capsule 8 wide from y −10 to 6, rotated 15° forward, fill base, 3 accent stripes
  (1 px) across it.
* Arms: short 2 px lines from (2,−6) to (8,0); hands = two 3 px claw ticks.
* Legs (digitigrade): hip (0,6) → knee (6,12) → foot (−2,20); feet = two 3 px toe ticks.
* Tail: quadraticCurveTo from (−3,6) through control (−22,14) to (−24,−4); 2 px shade line
  with a 5x5 diamond blade tip in accent.
* Distinctive: single large glow eye, crest fin, blade-tipped whip tail, afterimages at speed.

**Poses.**
* Idle: crouched (torso 20°), tail tip swishes ±6 px on 1.6 s, eye glow pulses.
* Run: body at 35°, 6 f stride, tail streams straight back, crest flattened; when
  |vx| > 240 draw 2 afterimage ghosts (alpha 0.25 at −8 px, 0.12 at −16 px).
* Jump: body vertical, legs tucked, tail curls into a C below.
* Fall: 20° head-down tilt, limbs trailing, tail stretched up.
* Light: claw snaps forward; a 1 px glow slash line across the hitbox diagonal.
* Heavy: backflip-kick; tail blade sweeps a 200° arc (stroke r26, accent).
* Special: body stretched (scaleX 3, scaleY 0.5) for the dash frames with 3 trailing ghosts;
  a glow line marks the path and fades over 10 f.
* Hurt: curls into a ball (torso circle r9), tail wraps, eye becomes a slit.
* Overclock form: scale 1.25; palette base `#7A2CB8`, shade `#2A0B45`, accent `#FFFFFF`,
  glow `#FF5CC8`; extra feature: the crest splits into 3 blades twice as long, permanent
  3-ghost afterimage at any speed, and the eye becomes a double almond.

**Stats.**

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 300 | 3600 | 3200 | 1.00 | 660 | 1750 | 850 | 1.30 | 180 px / 10 f (1080 px/s) | 18x40 | 70 |

Derived: jump height 124.5 px (4.15 tiles), apex in 23 f, double-jump apex 214 px,
single-jump horizontal reach 226 px.

**Moveset.**

| Move | S | A | R | Total | Hitbox | Dmg | KB | Hitstop | Lunge | Hit-cancel→next | Whiff-cancel→next | Jump-cancel (hit) | Energy | Meter |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 Flick | 3 | 2 | 6 | 11 | (26,0,36,24) | 2 | (140,−40) | 3 world | 60 | f6 | f9 | f6 | +4 | +2 |
| L2 Tail Snap | 3 | 3 | 6 | 12 | (30,−2,44,28) | 3 | (160,−60) | 3 world | 60 | f7 | f10 | f7 | +4 | +2 |
| L3 Crest Rake | 5 | 3 | 10 | 18 | (34,−4,48,30) | 3 | (300,−140) | 3 world | 110 | f9 (jump/dash/special) · f15 (L1 re-chain) | none | f9 | +6 | +4 |
| Heavy Tailwhip Vault | 9 | 5 | 14 | 28 | (30,−4,52,44) | 6 | (380,−240) | 4 world | 0 | none | none | f15 | +10 | +6 |
| Special Blink Strike | 4 | 8 | 8 | 20 | (6,0,34,40) moves with body | 7 | (220,−120) | 4 local | dash 200 px | none | none | no | −25 | +5/enemy |
| Air Scissor Spin | 4 | 5 | 8 | 17 | (0,0,52,46) both sides | 2 | (150,−60) | 3 world | — | — | — | — | +4 | +2 |
| Down-Strike Needle Drop | 3 | until land | 5 landing | — | (2,24,20,28) | 3 | (60,120) | 3 world | — | — | — | — | +5 | +3 |

Visuals: L1 = forehand claw flick, L2 = tail snaps forward past the head, L3 = crest-first
headbutt rake with a double slash line; Air = full-body 360° spin (hits behind as well);
Down-Strike = tail blade pointed down, body a straight needle.

**Special — Blink Strike (dash-strike).** Ground or air. f1–4 windup (crouch). f5–12: move
200 px along facing at 25 px/f with gravity suspended (`vy = 0`), stopping early at a solid
wall; the hitbox `(6,0,34,40)` travels with the body; enemies are passed through (no
enemy-collision push-out) and each is hit once for 7, KB (220,−120), 4 f local hitstop (Vellix
never freezes). i-frames on f5–12 only (contact damage and enemy attacks ignored; hazards still
hurt). f13–20 recovery (air: gravity resumes). Cost 25 energy. Does not consume the air dash.

**Ultimate — Afterimage Storm.** Ground or air; gravity suspended for the whole sequence.
S6, then 4 consecutive blinks of 8 f each (180 px, 22.5 px/f): each blink auto-aims at the
nearest enemy within 260 px and travels toward and through it (so the next blink reverses to
cross back); with no target, blinks go straight along facing. Each blink has hitbox
`(0,0,44,46)` and its own hit-list: 6 dmg per pass, KB (200,−160), 3 f local hitstop. i-frames
f1–38. R10. Total 48 f. Cost 40.

---

### 2.4 ORRUBEL — The Ring Warden (zoner)

**Concept.** A hooded bell made of stacked rings on two peg legs, fighting at the length of
two antenna-whips and the sentries it plants.
**Affinity.** Cipher (acid-green glyph flecks; SFX = filtered triangle pings).
**Personality.** A watchdog process that trusts nothing it hasn't measured twice and prefers
to fight from behind a wall of its own instruments. Soft-spoken and precise, it apologizes to
enemies for the inconvenience as it pins them.

**Visual design** (body box 24x44 → x −12..12, y −22..22; ~36 path commands):
* Palette: base `#5E6B55`, shade `#30392D`, accent `#C8D6B0`, glow `#9CFF57`.
* Silhouette: a bell/cone with two long antennae and stubby peg legs.
* Hood: dome arc 22 wide from y −22 to −14, fill base, stroke shade.
* Visor: glow rect 16x4 at (0,−17); a 2x2 shade pupil inside it that sits at +4 (facing).
* Rings: 5 stacked horizontal rounded rects, each 6 tall, widths 14,17,20,23,26 centered at
  y −10,−4,2,8,14; fill base, with a 2 px shade stroke along each ring's bottom edge.
  Rings 2 and 4 have a 2 px gap at x=0 revealing a glow "spine" line.
* Legs: two 3 px lines from (±6,14) to (±6,22); feet = r2 circles (shade).
* Antennae: two 2 px curves from (±10,−18) through control (−18,−30) to (−22,−30) and
  (−20,−27); r1.5 accent bead at each tip.
* Distinctive: one wide visor, stacked rings (the top ring is the heavy's thrown ring).

**Poses.**
* Idle: ring highlights drift ±1 px in alternating directions on 2 s; the pupil scans left/
  right every 3 s; antennae droop.
* Run: bell tilts 12° forward; 4 f peg scurry; rings wobble out of phase ±1 px; antennae
  stream behind.
* Jump: rings compress (centers 4 px apart); antennae point straight up.
* Fall: rings stretch (centers 8 px apart); antennae flare out sideways.
* Light: one antenna whips forward as a 3-segment polyline reaching the hitbox far edge with
  a 4 px flash at the tip.
* Heavy: the top ring detaches and spins away as a rotating ellipse (accent stroke); the bell
  is drawn with 4 rings until it returns and slots back in.
* Special: visor flashes white 2 f; both antennae point at the placement spot; the sentry
  materializes with an expanding circle (r 0→14 over 6 f).
* Hurt: rings scatter ±3 px (deterministic per frame index), visor dark for 4 f.
* Overclock form: scale 1.25; palette base `#86976E`, shade `#3A4A2E`, accent `#E6F2C8`,
  glow `#CBFF66`; extra feature: 7 rings, a triple-slot visor (three 2 px bars), 4 antennae.

**Stats.**

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | 215 | 1900 | 2200 | 0.75 | 630 | 1800 | 900 | 1.10 | 150 px / 12 f (750 px/s) | 24x44 | 90 |

Derived: jump height 110.3 px (3.7 tiles), apex in 21 f, double-jump apex 190 px,
single-jump horizontal reach 150 px.

**Moveset.**

| Move | S | A | R | Total | Hitbox | Dmg | KB | Hitstop | Lunge | Hit-cancel→next | Whiff-cancel→next | Jump-cancel (hit) | Energy | Meter |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 Whip Flick | 5 | 3 | 9 | 17 | (44,−6,64,18) | 2 | (120,−30) | 3 world | 0 | f9 | f13 | f9 | +4 | +2 |
| L2 Whip Cross | 5 | 3 | 9 | 17 | (46,0,68,22) | 3 | (140,−40) | 3 world | 0 | f9 | f13 | f9 | +4 | +2 |
| L3 Double Lash | 7 | 4 | 13 | 24 | (50,−4,76,26) | 4 | (320,−120) | 4 world | 0 | f12 (jump/dash/special) · f18 (L1 re-chain) | none | f12 | +6 | +4 |
| Heavy Ring Toss | 10 | proj | 14 | 24 | ring 20x20 | 7 out / 4 back | (260,−120) | 4 local | 0 | none | none | no | +5 per leg hit | +1 per hit |
| Special Sentry Pin | 8 | — | 12 | 20 | sentry at (40,−8) | bolt 2 | (80,−20) | 2 local | 0 | none | none | no | −35 | +1 per bolt |
| Air Whip Circle | 5 | 4 | 10 | 19 | (28,−4,60,36) | 2 | (140,−40) | 3 world | — | — | — | — | +4 | +2 |
| Down-Strike Peg Drop | 5 | until land | 7 landing | — | (2,26,22,28) | 3 | (60,120) | 3 world | — | — | — | — | +5 | +3 |

Visuals: L1 = one antenna lash, L2 = the other antenna lash crossing the first, L3 = both
antennae lash together with a double flash; Air = both antennae circle around the body
front; Down-Strike = peg legs pointed down, rings compressed.

**Heavy — Ring Toss (returning projectile).** On f11 the top ring launches from (14,−10):
box 20x20, speed 560 px/s along facing for 220 px (or until a wall), then flies straight back
toward Orrubel's current body center at 560 px/s (re-aimed every frame) and despawns on
contact with the body box (or after 50 f total). Each leg has its own hit-list: outbound 7
dmg, return 4 dmg, KB (260,−120), 4 f local hitstop. Orrubel can act after f24 while the ring
is out, but Heavy is unavailable until the ring returns.

**Special — Sentry Pin (deploy/turret).** Ground or air. On f9 place a sentry at body-local
(40,−8) (clamped inside solid geometry: pull back toward the body until free). The sentry
hovers in place (no gravity, no collision, invulnerable), 18x18 visual (ring with a glow dot
and 3 ticks), lives 300 f. Every 30 f (first shot on its f30) it fires a bolt at the nearest
enemy within 260 px (center-to-center; no shot if none): bolt box 10x10, speed 480 px/s,
lifetime 45 f, dies on a wall or on its first enemy hit, 2 dmg, KB (80,−20), 2 f local hitstop.
Max 1 sentry; a new cast despawns the old one. Cost 35 energy.

**Ultimate — Sentry Triad.** S8 R12. Places 3 sentries at body-local (40,−8), (−40,−8) and
(0,−60), each living 300 f, cadence 30 f, bolts 2 dmg, lock range 300 px. Replaces any
existing sentry. Potential 60 dmg over 5 s. Cost 40.

---

### 2.5 KORVASK — The Clamp Balancer (grappler-ish bruiser)

**Concept.** A barrel-bodied bruiser with chain-link arms ending in clamp claws that drag
things in and hold them still.
**Affinity.** Pressure (brass-yellow sparks; SFX = detuned square bursts).
**Personality.** A load-balancer that misremembers its old job as "holding things until
they stop struggling." Gruff and loyal, it believes any problem can be solved by getting
closer to it.

**Visual design** (body box 30x56 → x −15..15, y −28..28; ~40 path commands):
* Palette: base `#7A2E2E`, shade `#3E1414`, accent `#D9C27A`, glow `#FFE066`.
* Silhouette: a barrel with a low dome and two hanging chain arms.
* Torso: rounded rect 26x30 from y −16 to 14 (radius 6), fill base; 3 horizontal accent
  bands (2 px) at y −10, 0, 10; a 1 px shade vertical seam at x=0.
* Head: half-ellipse dome 20 wide x 10 tall sitting on the torso (y −26..−16), fill base.
* Eyes: three 4x2 glow slits at y −21, x = −4, 2, 8.
* Shoulders: two rounded rects 10x8 at (±16,−14), fill shade.
* Arms: 4 chain ovals (5x4, stroke accent) per arm from the shoulder down to y 10, ending in
  a clamp: two opposing arcs (r6, accent, 3 px) forming an open C / reversed C.
* Legs: two rounded rects 10x14 from y 14 to 28 at x ±7; feet = 12x4 plates (shade).
* Distinctive: three-slit eyes, banded barrel, chain arms with clamp jaws.

**Poses.**
* Idle: chains sway ±2 px on 1.4 s; slits brighten in sequence left→right every 2 s.
* Run: 10 f stomp stride; chains swing opposite to the legs; barrel tilts 6° forward; a dust
  puff at each stride.
* Jump: chains hang straight, legs together, dome tilts up.
* Fall: chains fly upward, legs spread, clamps open wide.
* Light: one arm's chain straightens into a 36 px line and the clamp snaps shut at the far
  end (the two arcs close into a circle) with a 3 px spark.
* Heavy: both clamps overhead, the barrel squashes (scaleY 0.85) and slams forward/down 8 px;
  a brass shock arc at the impact.
* Special: feet planted wide; both clamps crossed in front as an X of two 20 px accent lines
  with a faint glow ellipse 40x60 (alpha 0.3); on a catch the ellipse flashes white 3 f and the
  clamps uncross into the slam.
* Hurt: barrel rocks back 20°, chains fly forward, slits flicker.
* Overclock form: scale 1.25; palette base `#B8362E`, shade `#4A0F0F`, accent `#FFD766`,
  glow `#FFF7C2`; extra feature: a 5th chain link per arm, a brass crest ridge on the dome,
  and the three bands glow.

**Stats.**

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | 200 | 1500 | 1800 | 0.60 | 610 | 1900 | 960 | 0.75 | 135 px / 13 f (623 px/s) | 30x56 | 100 |

Derived: jump height 97.9 px (3.3 tiles), apex in 19 f, double-jump apex 168.6 px,
single-jump horizontal reach 128 px.

**Moveset.**

| Move | S | A | R | Total | Hitbox | Dmg | KB | Hitstop | Lunge | Hit-cancel→next | Whiff-cancel→next | Jump-cancel (hit) | Energy | Meter |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 Clamp Jab | 5 | 3 | 9 | 17 | (32,2,44,34) | 3 | (120,−40) | 3 world | 30 | f9 | f13 | f9 | +4 | +2 |
| L2 Clamp Hook | 5 | 3 | 10 | 18 | (34,−2,46,38) | 4 | (130,−50) | 4 world | 30 | f9 | f14 | f9 | +4 | +2 |
| L3 Chain Haul | 8 | 4 | 16 | 28 | (40,0,56,44) | 6 | (−200,−240) pull | 5 world | 0 | f13 (jump/dash/special) · f19 (L1 re-chain) | none | f13 | +6 | +4 |
| Heavy Drum Slam | 14 | 5 | 20 | 39 | (36,6,58,56) | 11 | (520,−280) | 6 world | 40 | none | none | no | +10 | +6 |
| Special Bulwark Catch | 2 | stance f3–18 | 18 (whiff) | 36 whiff | counter-slam (34,0,70,56) A4 | 16 | (540,−320) | 6 world | 0 | none | none | no | −20 (+20 refund on catch) | +15 on catch |
| Air Anchor Swing | 7 | 4 | 12 | 23 | (30,4,48,44) | 4 | (220,−40) | 4 world | — | — | — | — | +4 | +2 |
| Down-Strike Piston Plunge | 5 | until land | 9 landing | — | (4,30,30,30) | 6 | (80,160) | 4 world | — | — | — | — | +5 | +3 |

Visuals: L1 = straight clamp jab, L2 = rising hook with the other clamp, L3 = both chains
fire out, clamp the target and yank it inward (the pull); Heavy = double-clamp overhead slam;
Air = one clamp swung in a low scoop; Down-Strike = both clamps pointed down like pistons.

**Special — Bulwark Catch (counter/parry).** Ground or air (gravity continues in air).
f1–2 raise; stance f3–18. If, during the stance, Korvask's body box is touched by an enemy
body (contact), an enemy or boss melee hitbox, or an enemy/boss projectile (projectile is
destroyed): the hit is negated (no damage, no knockback, no i-frames consumed), 6 f world
hitstop, the stance ends and Counter-Slam begins: S6 A4 R14 (24 f) with hitbox (34,0,70,56),
16 dmg, KB (540,−320), 6 f world hitstop. On catch: refund 20 energy, +15 meter. Attacks
flagged `unblockable` by the boss doc and hazards (spikes, acid, static) are NOT caught and
hurt normally. If nothing is caught, f19–36 is recovery (punishable). Cost 20 energy on press.

**Ultimate — Clamp Press.** Ground or air (gravity suspended during the lunge). S8; lunge
f9–18 (110 px, 11 px/f) with grab box (18,0,40,50). First enemy/boss touched: 8 f world
hitstop, then Press phase f19–32: a non-boss victim is locked to body-local (22,0) while
Korvask hops 24 px up and comes down; on f33–36 slam hitbox (16,10,90,60): the held victim
takes 32, every other enemy in the box takes 10 with KB (380,−400); R14. Bosses are not moved
and take 32 on the slam. Whiff: R18 after the lunge (36 total). Cost 40.

---

## 3. Shared physics & movement rules

| Rule | Value |
|---|---|
| Logic rate | 60 Hz, fixed; `dt = 1/60` |
| Input buffer | 6 f for Jump, Light, Heavy, Special, Dash, Overclock; the action fires on the first legal frame; buffer timers pause during hitstop |
| Coyote time | 6 f after walking/falling off a ledge (not after a jump) |
| Jump | on press: `vy = −jumpVel`; on release while `vy < 0`: `vy *= 0.45` (applied once per jump) |
| Double jump (ability 1) | `vy = −0.85 * jumpVel`; same release cut; one per airtime; refreshed by landing, wall cling, pogo, wall jump |
| Gravity | per fighter; integrate `vy += g*dt`, clamp to `maxFall` |
| Ground accel / friction | per fighter; air accel = `groundAccel * airControl`; air friction (no input) = `friction * 0.15` |
| Turnaround | instant; facing locks for the duration of any attack, dash, hurt |
| Dash (ability 2) | `dist / frames` per fighter; `vy = 0` during; ground or air; one air dash per airtime (refreshed by landing, wall cling, pogo); cooldown 18 f after it ends; stops at walls; **no i-frames** (contact damage applies); attacks may start on the frame after it ends |
| Wall cling (ability 3) | airborne, `vy > 0`, pressing toward a solid wall overlapping the body side → cling; `vy = min(vy, wallSlide)` per fighter; releasing the direction drops off; wall-coyote 5 f after leaving the wall |
| Wall jump | `vx = (runSpeed + 40) * away`, `vy = −0.95 * jumpVel`; horizontal input ignored for 8 f; refreshes double jump and air dash; does not consume the double jump |
| Landing | from `vy ≥ 600`: 2 f landing squash (no control loss); air-attack landing lag 4 f; down-strike landing lag per fighter |
| Squash/stretch (visual only) | jump: (0.85, 1.15) for 6 f; land: (1.2, 0.8) for 6 f; hurt: (1.15, 0.85) for 4 f |

Wall-jump numbers per fighter: Tessik (275, −608), Brackmaw (220, −589), Vellix (340, −627),
Orrubel (255, −599), Korvask (240, −580).

---

## 4. Shared combat rules

### 4.1 Hurt, i-frames, death
* Player contact damage from a normal enemy = **1 heart**. Boss attacks = 1 or 2 hearts as
  flagged per attack in the boss doc. Enemy projectiles = 1 heart.
* **Hurt state:** 16 f with no input (attacks, dashes and stances are cancelled; a placed
  sentry persists). Knockback on hurt: `(240 * away, −300) * weight`, where `away` points from
  the damage source center to the player center (0 → opposite facing).
* **i-frames:** 60 f from the hit frame, flashing 4 f on / 4 f off. Contact damage, enemy
  hitboxes and projectiles are ignored during i-frames. Hazards are NOT ignored (see 4.2).
* Hurt world hitstop: 6 f. Screen shake 5 px / 10 f. Red tint flash 6 f.
* Being hurt during Overclock: knockback x0.5; i-frames unchanged; Overclock keeps ticking.
* HP 0 → death: 60 f death animation (fighter collapses, palette desaturates, 12 particles),
  then Game Over → respawn at the last restore node with full HP, energy 50, meter 0.

### 4.2 Hazards
* **Spikes / acid:** 1 heart, ignore i-frames, 30 f freeze (fighter flashes, world keeps
  running), then respawn at the room's entry point with 30 f of i-frames. Pogo on spikes is
  allowed and deals no damage.
* **Static pools:** 1 heart + knockback `(0, −420) * weight` (no respawn), normal i-frames.
* **Crush** (moving/crumbling geometry): treated as spikes.

### 4.3 Hitstop & feel
| Event | World hitstop | Screen shake | Particles |
|---|---|---|---|
| Light hit | per table (3–4) | none | 4 sparks in affinity color |
| L3 / heavy hit | per table (4–6) | 3 px / 6 f | 8 sparks + 1 ring |
| Special hit | per table | 4 px / 8 f | 10 sparks |
| Ultimate hit | per table | 8 px / 14 f | 16 sparks + 2 rings |
| Player hurt | 6 | 5 px / 10 f | 6 red chips |
| Enemy killed | +2 extra | 2 px / 4 f | 12 chips + bits |
| Overclock activate | 8 | 6 px / 12 f | 24 sparks + 1 ring r120 |

Enemies flash white 4 f on hit. Non-boss enemies enter hitstun for `10 + hitstop` frames
(no movement/AI), bosses never (they flash only). Overclock adds +1 f to every player hitstop.

### 4.4 Light chain
* Grounded only. Pressing Light while airborne is an Air Attack or Down-Strike (with Down).
* L1 → L2 → L3 → (re-chain to L1). "Hit-cancel" frames apply only if the move connected with
  at least one enemy (or destructible); "whiff-cancel" frames apply otherwise. L3 has no
  whiff-cancel: it must finish.
* From the hit-cancel frame a light may also be cancelled into **Jump**, **Dash** (if owned)
  or **Special**. Heavies cancel into nothing (exception: Vellix's heavy jump-cancel on hit).
* Chain timeout: the chain index resets to L1 if the next light is not started within 20 f
  after the current move ends, or on jump/dash/hurt/special/landing.
* Grounded attacks: on f1 `vx *= 0.5`, then the Lunge value (if any) is added along facing;
  friction applies; movement input is ignored until the move ends or is cancelled.

### 4.5 Heavy
* Grounded only (airborne press = Down-Strike). No cancels. Highest meter/energy gain.

### 4.6 Air attack
* Any time airborne except during dash/hurt/cling; momentum preserved; gravity continues.
* Landing during startup cancels the move (no hit, no lag). Landing during active/recovery
  ends the move with 4 f landing lag. No cooldown beyond recovery.

### 4.7 Down-strike (pogo)
* Light+Down or Heavy while airborne. During active frames: `vy = max(vy, 500)` (dives at
  least 500 px/s; `maxFall` still clamps). Horizontal control = air control.
* On hitting an enemy, boss, spike or breakable: **`vy = −580`** (shared for every fighter),
  the move ends immediately (0 recovery), double jump and air dash are refreshed, world
  hitstop per table. A new Down-Strike may be started on the next frame.
* Landing without a hit: landing lag per fighter (R column).

### 4.8 Specials & ultimates
* A press with insufficient energy does nothing except a "deny" SFX and a 10 f lockout.
* Energy is charged on the press (f1). Ultimates cost 40 for every fighter.
* Specials can be hurt-interrupted (except where i-frames are listed). Projectiles and
  sentries already spawned persist through hurt.
* Only one Pulse Line, one Ring, one Sentry set, one Blink/Storm may exist at a time.

### 4.9 Energy
| Item | Value |
|---|---|
| Max | 100 |
| Start (new game / respawn / load) | 50 (restore nodes set it to 100) |
| Passive regen | 3 per second (0.05 per frame), always |
| Gain on hit | L1/L2 +4, L3 +6, Heavy +10, Air +4, Down-Strike +5, projectile/sentry hits 0 (Ring Toss +5 per leg hit), Korvask catch refund +20 |
| Spark pickup | +25 energy (and +10 meter) |
| Special cost | Tessik 30 · Brackmaw 40 · Vellix 25 · Orrubel 35 · Korvask 20 |
| Ultimate cost | 40 (all) |
| Overclock regen | doubled (6 per second) |

### 4.10 Enemy interaction summary (for the enemy/boss docs)
* Enemy `kbResist`: 1.0 normal, 0.5 heavy, 0 boss. Hitstun `10 + hitstop` f (non-boss).
* Enemy drops (proposed; the world doc owns final tables): 1–3 bits (+1 meter each), 25%
  spark; bosses drop 3 sparks and 20 bits.
* Boss attack flags consumed here: `damage` (1|2), `unblockable` (ignores Korvask's catch),
  `projectile` (caught = destroyed).

### 4.11 Level-design guarantees (worst case = Brackmaw unless noted)
* Single jump clears **96 px** (design single-jump ledges ≤ 3 tiles = 90 px).
* Double jump clears **165 px** (ledges ≤ 5 tiles = 150 px).
* Single-jump horizontal gap **112 px** (gaps ≤ 3 tiles); double-jump gap **167 px**
  (≤ 5 tiles); dash adds ≥ 120 px (≤ 3 more tiles).
* Largest body is 34x56 (Brackmaw width, Korvask height): corridors ≥ 2 tiles tall and wide.
  There is no crouch.
* Wall-jump shafts ≥ 2 tiles wide. Vellix is the ceiling: 340 px/s wall-jump exit.
* Longest melee reach from the body edge: Orrubel L3 = 76 px beyond the body (2.5 tiles);
  shortest: Vellix L1 = 35 px (1.2 tiles). Turrets/traps that must be melee-safe for a zoner
  should sit ≥ 3 tiles from the fighter's standing spot.

---

## 5. Overclock

| Item | Value |
|---|---|
| Meter max | 100; persists across rooms; reset to 0 on death and on load |
| Gain per landed hit | L1/L2 +2 · L3 +4 · Heavy +6 · Special +5 per enemy hit · Air +2 · Down-Strike +3 · projectile/sentry bolt/ring +1 · Korvask catch +15 |
| Gain per pickup | bit +1 · spark +10 · hidden core +25 |
| During Overclock | no meter gain; meter drains linearly 100→0 over the duration (it is the timer) |
| Activate | `Overclock` with meter = 100, while idle/run/jump/fall/cling only |
| Transform | 20 f: f1–8 world hitstop + white flash alpha 0.6→0 + ring r0→120; f9–20 scale 1.0→1.25 and palette crossfade; invulnerable f1–20; enemies within 60 px pushed `(300 away, −200)` with 0 dmg |
| Duration | **12 s = 720 f** after the transform |
| Damage | `floor(d * 1.5)`: 2→3, 3→4, 4→6, 5→7, 6→9, 7→10, 8→12, 9→13, 11→16, 12→18, 14→21, 16→24, 26→39, 32→48 |
| Speed | run x1.15 (Tessik 270, Brackmaw 207, Vellix 345, Orrubel 247, Korvask 230); dash distance x1.15 (same frames: 173, 138, 207, 173, 155); jump unchanged |
| Reach | attack hitbox `w,h` x1.2 and `cx` x1.1 (body box unchanged) |
| Defense | knockback received x0.5 |
| Hitstop | +1 f on every player-dealt hit |
| Energy | regen 6/s; Special button = Ultimate (cost 40) |
| End | 10 f revert (scale 1.25→1.0, palette back); meter 0; no i-frames |

Form visuals per fighter are in each sheet (palette shift, scale 1.25, extra feature).
Ultimates per fighter: Tessik Sightline (beam), Brackmaw Quake Vault (mega burst), Vellix
Afterimage Storm (multi-blink), Orrubel Sentry Triad (3 sentries), Korvask Clamp Press
(grab-slam).

---

## 6. Balance tables

**Time to kill a 10 HP enemy with the light chain alone** (all hits connect, no hitstop
counted; frame = absolute frame on which the killing hit's first active frame occurs):

| Fighter | Chain dmg | Hits needed | Kill frame | Time | Sustained chain DPS |
|---|---|---|---|---|---|
| Tessik | 3+3+5 = 11 | 3 (L1 L2 L3) | f21 | 0.35 s | 22.0 /s (11 per 30 f cycle) |
| Brackmaw | 4+4+8 = 16 | 3 | f28 | 0.47 s | 25.3 /s (16 per 38 f) |
| Vellix | 2+3+3 = 8 | 4 (…L3, L1) | f29 | 0.48 s | 19.2 /s (8 per 25 f) |
| Orrubel | 2+3+4 = 9 | 4 (…L3, L1) | f39 | 0.65 s · 0.45 s with a sentry out | 16.4 /s (+4.0 /s per sentry) |
| Korvask | 3+4+6 = 13 | 3 | f25 | 0.42 s | 22.9 /s (13 per 34 f) |

Worked timing (Tessik): L1 active f5–7 → L2 starts f8, active f12–14 → L3 starts f15, active
f21–24 → re-chain L1 at f31. Other rows follow the same rule using each fighter's S/A and
hit-cancel frames.

**One-shot reference:** Heavy one-shots a 10 HP enemy for Brackmaw (14) and Korvask (11);
Tessik's heavy (9) + L1 (3) kills in 39 f; Vellix and Orrubel never one-shot a 10 HP enemy.

**Feel summary.**

| Fighter | Feel | Strengths | Weaknesses |
|---|---|---|---|
| Tessik | balanced | shortest TTK, floor-hugging projectile, easy jump-cancels | nothing exceptional; mid reach |
| Brackmaw | heavy-slow-strong | highest DPS and burst, armor on heavy, area control, 6 HP, barely moved by hits | 180 run, 0.55 air control, long startups (6/6/9/16), smallest jumps |
| Vellix | fast-fragile | 300 run, 1.0 air control, 4-frame lights, i-frame blink, 360° air spin | 4 HP, weight 1.3 (flung far), lowest chain damage |
| Orrubel | zoner | 2.5-tile whips, returning ring, autonomous sentry, safe spacing | lowest up-close DPS, 0 lunge, slow L3 |
| Korvask | grappler-ish bruiser | 6 HP, pull-in L3 keeps targets in range, counter turns boss attacks into 16 dmg + refund | 200 run, 0.60 air control, counter whiff is 36 f, low knockback lets enemies stay dangerous |

---

## 7. Data shape for implementers

```
UB.Characters.DATA = {
  tessik: {
    id:'tessik', name:'Tessik', title:'The Courier Lantern', affinity:'signal',
    hp:5, run:235, accel:2300, friction:2600, airControl:0.80,
    jumpVel:640, gravity:1800, maxFall:900, weight:1.00, wallSlide:90,
    dash:{dist:150, frames:12}, box:{w:22, h:48},
    palette:{base:'#2F7A86', shade:'#163E47', accent:'#F0B64A', glow:'#DFFBFF'},
    ocPalette:{base:'#19B5C8', shade:'#0B4A55', accent:'#FFE08A', glow:'#FFFFFF'},
    moves:{
      light1:{s:4,a:3,r:8, box:[30,-2,44,30], dmg:3, kb:[180,-60], hitstop:3, lunge:40,
              hitCancel:8, whiffCancel:12, jumpCancel:8, energy:4, meter:2},
      light2:{...}, light3:{..., rechain:17}, heavy:{...}, special:{cost:30, ...},
      air:{...}, down:{...}, ultimate:{cost:40, ...}
    }
  },
  brackmaw:{...}, vellix:{...}, orrubel:{...}, korvask:{...}
};
UB.Combat.RULES = { buffer:6, coyote:6, jumpCut:0.45, doubleJump:0.85, wallJumpVx:40,
  wallJumpVy:0.95, wallCoyote:5, wallLock:8, dashCooldown:18, pogoVy:-580, pogoDive:500,
  hurtFrames:16, iFrames:60, hurtKb:[240,-300], hurtHitstop:6, spikeFreeze:30,
  energyMax:100, energyStart:50, energyRegen:3, meterMax:100, ocFrames:720,
  ocTransform:20, ocRevert:10, ocDamage:1.5, ocSpeed:1.15, ocReach:1.2, ocKbTaken:0.5 };
```

Every value in this shape is defined in the tables above; fill the remaining fighters from
their sheets verbatim.
