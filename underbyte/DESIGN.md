# UNDERBYTE — Canonical Design Document

**Status: canonical and complete.** This is the single source of truth for every implementer. It merges and supersedes `design/combat.md`, `design/world.md` and `design/presentation.md`; where those three disagreed, the ruling here wins and is recorded in §16. Every number in this document is pinned: implementers copy values verbatim into the `UB.*` modules named in each section. If a number you need is missing, it is a bug in this document — add it here first, then code it.

All content is original. No name, character, design, level, text or sound references any existing franchise; every proper noun is an invented word.

---

## 1. Overview & premise

### 1.1 What the game is

An original browser game for the `practice-games` repo: a **2D Metroidvania platformer** whose playable characters are five original **"digital monster" brawlers** with fighting-game movesets. Pure vanilla JS + Canvas 2D + Web Audio, no dependencies, no asset files, runs from `file://` and GitHub Pages (see `BRIEF.md`, which this document obeys in full).

### 1.2 Premise

A buried **server-kingdom** whose data rotted into monsters. You are a **Spirit** — a sentient program — fighting down through its five layers to purge the corrupted **Root Process**, a seated crowned mass named **Kernauth** that sits in a well of light at the bottom of the kingdom and has never once let go of anything it made.

The five layers, top to bottom: **Driftcache** (dead cache memory, blue dust, toppled racks) → **Loomworks** (rust-orange cable looms, chain hoists, static channels) → **Brinevault** (flooded cooling vaults, pale acid, dripping pipes) → **Nullspire** (an inverted spire of black glass in a violet void, crawling with white static) → **Rootwell** (crimson dark, gold filament, cable-roots converging on the throne).

Three **zone bosses** each guard a movement ability, acquired in a fixed order:

| Order | Boss | Arena | Ability granted | Ability id |
|---|---|---|---|---|
| 1 | **Tallock**, Warden of the Stack | `dc_sentinel` (Driftcache) | **Echo Jump** (double jump) | `echoJump` |
| 2 | **Weftyr**, The Shuttle That Would Not Stop | `lw_weftyr` (Loomworks) | **Burst Line** (dash) | `burstLine` |
| 3 | **Corrosant**, Keeper of the Brine | `bv_corrosant` (Brinevault) | **Grip Protocol** (wall cling + wall jump) | `gripProtocol` |
| 4 | **Kernauth**, The Root Process (2 phases) | `rw_throne` (Rootwell) | — (victory) | — |

Three hidden **cores** (+1 max HP each) sit in secret alcoves that need later abilities, forcing backtracking. Currency is **bits**, dropped by enemies and placed in rooms; a vendor, **Scrivvet**, sells three one-time upgrades. **Restore nodes** (save + full heal + enemy respawn) exist in every zone. The run ends on a victory screen with stats.

### 1.3 The roster

| Fighter | Epithet | Affinity | Feel |
|---|---|---|---|
| **Tessik** | The Courier Lantern | Signal (amber-white) | balanced |
| **Brackmaw** | The Walking Vault | Ore (ember-orange) | heavy, slow, strong |
| **Vellix** | The Prefetch Streak | Flux (magenta) | fast, fragile |
| **Orrubel** | The Ring Warden | Cipher (acid-green) | zoner |
| **Korvask** | The Clamp Balancer | Pressure (brass-yellow) | grappler-ish bruiser |

Every fighter shares the kit: run, variable-height jump, a 3-hit light chain, a heavy, a unique special (costs energy), an air attack, a down-strike (pogo), and the three acquired abilities. The **Overclock** meter fills from landed hits and pickups; when full, the Overclock key transforms the fighter for 12 s into a larger, palette-shifted form with more damage, more speed and an ultimate in place of the special.

### 1.4 Scope checklist (everything ships)

* Screens: Title (New Game / Continue / Settings) → Character Select (5 fighters, stats, moveset preview) → Game. Pause (resume, map, settings, quit). Map screen. Game over. Victory with run stats.
* World: 5 zones, **23 rooms** (§6), interconnected with three loops (§10), three ability gates in the fixed order Echo Jump → Burst Line → Grip Protocol, a two-phase final boss, 6 restore nodes, 2 vendor spots (same vendor), 3 hidden cores, spikes, acid/static pools, crumbling platforms, moving platforms in Loomworks and Nullspire.
* Enemies: 10 types with 11 zone variants (§7). Bosses: 4 (§8).
* Fighters: 5 (§4). Overclock + ultimates (§3.7, §4).
* Save: `localStorage`, one slot (§14). Audio: synthesized music per zone + boss + title, full SFX set (§13). Feel: hitstop, shake, particles, squash/stretch, flashes (§11).
* Debug/test API on `window.UB.debug` (§16.9) used by Playwright playthroughs.

### 1.5 Module map (`UB.*`, plain `<script>` tags in this order)

`UB.Palette` · `UB.Fonts` · `UB.Rand` · `UB.Color` · `UB.Pool` · `UB.Input` · `UB.Audio` · `UB.Draw` · `UB.Anim` · `UB.FX` · `UB.Camera` · `UB.Backgrounds` · `UB.Tiles` · `UB.Rooms` (room data, §6) · `UB.Zones` (§5) · `UB.Characters` (§4 data) · `UB.Combat` (§3 rules) · `UB.Player` · `UB.Enemies` (§7) · `UB.Bosses` (§8) · `UB.Pickups` (§9) · `UB.Vendor` · `UB.HUD` · `UB.Screens` · `UB.Text` (§15) · `UB.Save` (§14) · `UB.Engine` · `UB.Debug` · `UB.Main`. Strict mode everywhere; the only global is `UB`.

---

## 2. Controls (`UB.Input`)

### 2.1 Actions

`left, right, up, down, jump, light, heavy, special, dash, overclock, confirm, back,
pause, map`. Every frame `UB.Input.state[action]` is `{down, pressed, released, buffer}`.
`pressed` is true for exactly one logic frame. Menus read `pressed` with key-repeat
(initial 18 f, then every 8 f while held) for `up/down/left/right`.

### 2.2 Keyboard default map (both columns always active)

| Action | Keys |
|---|---|
| left | `ArrowLeft`, `KeyA` |
| right | `ArrowRight`, `KeyD` |
| up | `ArrowUp`, `KeyW` |
| down | `ArrowDown`, `KeyS` |
| jump | `Space`, `KeyW`, `ArrowUp` |
| light | `KeyZ`, `KeyJ` |
| heavy | `KeyX`, `KeyK` |
| special | `KeyC`, `KeyL` |
| dash | `ShiftLeft`, `ShiftRight`, `Semicolon` |
| overclock | `KeyV`, `KeyI` |
| confirm | `Enter`, `Space`, `KeyZ`, `KeyJ` |
| back | `Escape`, `KeyX`, `KeyK`, `Backspace` |
| pause | `Escape`, `KeyP` |
| map | `KeyM`, `Tab` |

Rules: listen on `window` with `e.code`; `preventDefault()` for every mapped code so the
page never scrolls (`Space`, arrows, `Tab`). Down-strike = `down` held + `light`, or `heavy`
while airborne (§3.6). Interact at a node/vendor = `up` pressed while overlapping (within 1 tile of the object centre). **Drop through a one-way platform** = `down` held + `jump` pressed while standing on `-` or a mover (consumes the jump press, §3.0).
`KeyW`/`ArrowUp` double as jump: pressing `up` at a node triggers the interaction **and
not** a jump (interaction has priority and consumes the press). A `blur` event releases
every key.

### 2.3 Gamepad (standard mapping, polled every logic frame via `navigator.getGamepads()`)

| Action | Button / axis |
|---|---|
| left/right/up/down | d-pad 14/15/12/13 **or** left stick axes 0/1 with deadzone 0.35 (hysteresis: release at 0.25) |
| jump | A (0) |
| light | X (2) |
| heavy | Y (3) |
| special | B (1) |
| dash | RB (5); LB (4) also dash |
| overclock | LT (6, value > 0.5); RT (7) also overclock |
| confirm | A (0); back = B (1) |
| pause | Start (9) |
| map | Back/Select (8) |

The first pad that reports any button press becomes the active pad; the HUD switches its
glyphs to gamepad names (`A`, `X`, `LT` …) until a keyboard key is pressed. Both devices
work simultaneously. Rumble is not used.

### 2.4 Touch (optional, auto-shown only when a `touchstart` happens)

Semi-transparent (`PAPER` α 0.18, ink α 0.4) circles 56 px radius (touch is a nice-to-have; keyboard and gamepad are required):
left cluster d-pad ◀ at (70, 450), ▶ at (190, 450), ▼ at (130, 500 — half size, down only);
right cluster `JUMP` (890, 470), `LIGHT` (800, 430), `HEAVY` (870, 380), `SPECIAL` (780,
350), `DASH` (930, 400, r 36), `OC` (700, 480, r 36); top-right `≡` pause (930, 40, r 22)
and `MAP` (880, 40, r 22). Multi-touch: each touch id maps to the nearest button within 70
px on start; a drag within the d-pad switches direction. Buttons draw their label in
`bold 14px UI`. Logic is identical to key presses.

### 2.5 Input buffer & menus

* Every action in `{jump, light, heavy, special, dash, overclock}` sets `buffer = 6` on
  press; the gameplay code consumes the first legal frame and clears it; buffer timers do
  do not tick during hitstop (§3.1). `pressed` for the remaining actions is 1 frame.
* Jump release (`released`) is forwarded to the jump cut even if the press was buffered.
* Menus: `up/down` move (wrap), `left/right` adjust, `confirm` activates, `back` closes
  one level. `menuMove`/`menuConfirm`/`menuBack` SFX on each. Mouse/touch on menus: hover
  highlights, click activates (nice-to-have; keyboard/gamepad are required).
* The game pauses automatically on `visibilitychange` → hidden, and on gamepad disconnect
  if the pad was active.

---

## 3. Shared combat rules (`UB.Combat`)

### 3.0 Conventions

* **Timing.** Fixed 60 Hz logic, `dt = 1/60`, accumulator-driven; render every animation frame with interpolation `alpha` (§11.0). All durations are in frames (f) unless marked `s`. Frame 1 is the first frame a move exists. A move with Startup S, Active A, Recovery R: startup = f1..fS, active = f(S+1)..f(S+A), recovery = f(S+A+1)..f(S+A+R).
* **Units.** Pixels (px). **Fighters** use px/s and px/s² (integrated with `dt`). **Enemies, bosses, projectiles and moving platforms** use px/frame and px/frame² (integrated once per logic frame). Both are exact at 60 Hz; `1 px/frame = 60 px/s`. Tile = 30 px. Logical canvas 960×540 = 32×18 tiles.
* **Body box.** Each fighter has one axis-aligned collision box `w × h` that never changes (not even in Overclock). The **body centre** `(0,0)` is the box centre; the box bottom is the **feet line**. The drawn rig may overdraw the box by a few px.
* **Local coordinates.** `+x` = facing direction, `+y` = down. When facing left, negate every `x`/`cx` (draw with `ctx.scale(-1,1)`).
* **Attack hitbox** = `(cx, cy, w, h)`: centre offset from the body centre (`cx` along facing, `cy` down), then width and height. AABB test against enemy body boxes on every active frame. Each move *instance* keeps a hit-list so an enemy is hit at most once per instance, except where a move says "multi-tick".
* **Knockback** `(kx, ky)` in px/s: `kx` along the attacker's facing (negative = pull toward the attacker), `ky` positive = down (so −220 launches up). Applied to the victim as `v = (kx * facing, ky) * victim.kbResist` (see §7.0 for every enemy's `kbResist`; bosses 0 = never moved but still flash/hitstop).
* **Hitstop.** "World" hitstop freezes the entire simulation (players, enemies, projectiles, moving platforms) except particles, camera shake and UI. "Local" hitstop freezes only the victim (used by projectiles and summons so the shooter keeps moving). Overlapping hitstops do not stack: `timer = max(timer, new)`. Input buffer timers do not tick during hitstop.
* **Damage** is an integer. Enemy HP 3–27, bosses 120–240 (phase 2: 240). Overclock damage = `floor(d * 1.5)`.
* **Hearts.** Player HP is whole hearts. Base 4–6 per fighter, +1 per hidden core (3 cores), max 9.
* **Collision resolution order:** move X, resolve X against solids; then move Y, resolve Y. A body overlapping a solid after the Y move with its previous-frame feet at or above the tile top is snapped onto the tile (grounded). **Ledge forgiveness ("step-up"):** if the X move is blocked by a solid whose top is at most **6 px** above the feet and the body's column above that top is free, the body is lifted onto the tile instead of being stopped. **Ceiling:** a Y move blocked from below sets `vy = 0` (never negative); the jump-cut flag is consumed.
* **One-way platforms (`-`)** are solid only for a body whose feet were at or above the tile's top edge on the previous frame and whose `vy ≥ 0`. **Down + Jump** while standing on one drops through (ignore `-` collision for 10 f; the jump input is consumed, not a jump). Moving platforms behave as `-` and carry the player (player x/y += platform delta while standing on it).

### 3.1 Movement physics (per fighter values in §4; shared rules here)

| Rule | Value |
|---|---|
| Input buffer | 6 f for Jump, Light, Heavy, Special, Dash, Overclock; the action fires on the first legal frame; buffer timers pause during hitstop |
| Coyote time | 6 f after walking/falling off a ledge (not after a jump) |
| Jump | on press: `vy = −jumpVel`; on release while `vy < 0`: `vy *= 0.45` (applied once per jump) |
| **Echo Jump** (double jump, ability 1) | `vy = −djMult * jumpVel` (`djMult` per fighter: Tessik 0.85, Brackmaw 1.00, Vellix 0.90, Orrubel 0.85, Korvask 1.00); same release cut; one per airtime; refreshed by landing, wall cling, pogo, wall jump; also usable after a chute auto-launch |
| Gravity | per fighter; integrate `vy += g*dt`, clamp to `maxFall` |
| Ground accel / friction | per fighter; air accel = `groundAccel * airControl`; air friction (no input) = `friction * 0.15` |
| Turnaround | instant; facing locks for the duration of any attack, dash, hurt |
| **Burst Line** (dash, ability 2) | distance **180 px** for every fighter except **Vellix 210 px**; frames per fighter (§4.1); constant speed `dist / frames`; `vy = 0` during; ground or air; one air dash per airtime (refreshed by landing, wall cling, pogo, wall jump, chute launch); cooldown 18 f after it ends; stops at walls; **no i-frames** (contact damage applies); attacks may start on the frame after it ends. On the last dash frame `vx = runSpeed * facing` if the direction is held, else `vx = 0`. A dash started on the ground that runs off a ledge keeps `vy = 0` until the dash ends |
| **Grip Protocol** (wall cling, ability 3) | airborne, `vy > 0`, pressing toward a solid (`#`) wall overlapping the body side → cling; `vy = min(vy, wallSlide)` per fighter; releasing the direction drops off; wall-coyote 5 f after leaving the wall; the player may turn back and re-cling the same wall, so any sheer `#` wall of any height is climbable. `-`, `c`, movers and hazards are never clingable |
| Wall jump | `vx = (runSpeed + 40) * away`, `vy = −0.95 * jumpVel`; horizontal input ignored for 8 f; refreshes Echo Jump and air dash; does not consume the Echo Jump |
| Landing | from `vy ≥ 600`: 2 f landing squash (no control loss); air-attack landing lag 4 f; down-strike landing lag per fighter |
| Chute auto-launch (arrival through a **bottom** exit) | player placed at the arrival spawn tile with `vy = −1.2 * jumpVel`, Echo Jump and air dash available, horizontal input honoured immediately, 20 f of i-frames |
| Squash/stretch (visual only) | jump: (0.85, 1.15) for 6 f; land: (1.2, 0.8) for 6 f; hurt: (1.15, 0.85) for 4 f |

Wall-jump numbers per fighter `(vx, vy)`: Tessik (275, −608), Brackmaw (220, −589), Vellix (340, −584), Orrubel (255, −599), Korvask (240, −580).

### 3.2 Hurt, i-frames, death

* Player contact damage from a normal enemy = **1 heart**. Boss attacks = 1 or 2 hearts as flagged per attack in §8. Enemy projectiles = 1 heart.
* **Hurt state:** 16 f with no input (attacks, dashes and stances are cancelled; a placed sentry, ring or Pulse Line persists). Knockback on hurt: `(240 * away, −300) * weight`, where `away` points from the damage source centre to the player centre (0 → opposite facing).
* **i-frames:** 60 f from the hit frame, flashing 4 f on / 4 f off. Contact damage, enemy hitboxes and projectiles are ignored during i-frames. Hazards are NOT ignored (§3.3).
* Hurt world hitstop: 6 f. Screen shake 5 px / 10 f. Red tint flash 6 f. Music bus dips to 0.6 for 0.9 s.
* Being hurt during Overclock: knockback ×0.5; i-frames unchanged; Overclock keeps ticking.
* HP 0 → death: 60 f death animation (fighter collapses, palette desaturates, 12 chips), then Game Over → respawn at the last restore node with full HP, energy 50, meter 0. Bits, abilities, cores, defeated bosses, opened seals, vendor purchases and discovered map are kept in memory (and were already saved at the node, except bits/discoveries gained since, which survive in memory and are written at the next node). All non-boss enemies respawn; room-entry history is cleared. Deaths stat +1 on death.

### 3.3 Hazards

| Hazard | Effect |
|---|---|
| Floor spikes `^`, ceiling spikes `v`, pools `~` (acid in Brinevault, static elsewhere), crush by moving/crumbling geometry | **1 heart, ignores i-frames.** 6 f world hitstop, white flash; the fighter freezes in place flashing for **30 f** (the world keeps running, enemies cannot hurt the frozen fighter), then a 10 f fade and the player is placed at the **hazard respawn point** with **45 f** of i-frames, energy and meter unchanged. If HP reaches 0 it is a death instead (§3.2). |
| Hazard respawn point | the **arrival spawn tile of the exit the player most recently entered this room through**, placed exactly as that arrival was (a bottom-exit entry respawns with its chute auto-launch, so the respawn never drops straight back out of the room); in the room where the run started or the last restore node was used, that start/node tile; Corrosant's Flood uses the nearest row-16 grate instead (§8.3). Body contact is not applied on a pogo tick / active down-strike frame, nor while a special holds its victim against the body (Brackmaw's dive, Korvask's press). |
| Pogo on floor spikes | allowed, no damage (§3.6). Ceiling spikes are not pogo-able. |
| Acid puddles (Acid-valve globs, Corrosant's Acid Spit) and Weftyr's stuck needles | **1 heart**, normal knockback `(0, −300) * weight`, normal 60 i-frames, **no respawn-teleport** (i-frames protect against them). |
| Static spark (Static-shot scuttlebit) | treated as enemy contact (1 heart, i-frames apply). |

Hit boxes: `^` = tile inset 4 px each side, top 6 px below the tile top (the drawn tips); `v` = same, hanging from the tile top, 6 px shorter at the bottom; `~` = the full tile. Enemies, projectiles and moving platforms ignore all hazards.

### 3.4 Hitstop & feel table

| Event | World hitstop | Screen shake | Particles |
|---|---|---|---|
| Light hit | per table (3–4) | none | 4 sparks in affinity colour |
| L3 / heavy hit | per table (4–6) | 3 px / 6 f | 8 sparks + 1 ring |
| Special hit | per table | 4 px / 8 f | 10 sparks |
| Ultimate hit | per table | 8 px / 14 f (Tessik beam 6/10, Brackmaw quake 10/16) | 16 sparks + 2 rings |
| Player hurt | 6 | 5 px / 10 f | 6 red chips |
| Enemy killed | the killing move's hitstop **+2** | 2 px / 4 f | 12 chips + bit coins (§9) |
| Overclock activate | 8 | 6 px / 12 f | 24 sparks + 1 ring r120 |

Enemies flash white 4 f on hit. Non-boss enemies enter hitstun for `10 + hitstop` frames (no movement/AI) unless their `kbResist` is 0 (then flash only, §7.0); bosses never (they flash only). Overclock adds +1 f to every player-dealt hitstop.

### 3.5 Light chain, heavy, air attack

* **Light chain.** Grounded only. Pressing Light while airborne is an Air Attack or Down-Strike (with Down). L1 → L2 → L3 → (re-chain to L1). "Hit-cancel" frames apply only if the move connected with at least one enemy, boss, destructible projectile or breakable; "whiff-cancel" frames apply otherwise. L3 has no whiff-cancel: it must finish. From the hit-cancel frame a light may also be cancelled into **Jump**, **Dash** (if owned) or **Special**. Heavies cancel into nothing (exception: Vellix's heavy jump-cancel on hit). Chain timeout: the chain index resets to L1 if the next light is not started within 20 f after the current move ends, or on jump/dash/hurt/special/landing. Grounded attacks: on f1 `vx *= 0.5`, then the Lunge value (if any) is added along facing; friction applies; movement input is ignored until the move ends or is cancelled.
* **Heavy.** Grounded only (airborne press = Down-Strike). No cancels. Highest meter/energy gain.
* **Air attack.** Any time airborne except during dash/hurt/cling; momentum preserved; gravity continues. Landing during startup cancels the move (no hit, no lag). Landing during active/recovery ends the move with 4 f landing lag. No cooldown beyond recovery.

### 3.6 Down-strike (pogo)

* Light+Down or Heavy while airborne. During active frames: `vy = max(vy, 500)` (dives at least 500 px/s; `maxFall` still clamps). Horizontal control = air control.
* On hitting an enemy, boss, floor spike, destructible projectile or breakable: **`vy = −580`** (every fighter), the move ends immediately (0 recovery), Echo Jump and air dash are refreshed, world hitstop per table, shake 2 px / 3 f, `pogo` particles + SFX. A new Down-Strike may start on the next frame.
* Landing without a hit: landing lag per fighter (R column).

### 3.7 Specials & ultimates

* A press with insufficient energy does nothing except the `deny` SFX, the energy-bar deny flash, and a 10 f lockout.
* Energy is charged on the press (f1). Ultimates cost 40 for every fighter.
* Specials can be hurt-interrupted (except where i-frames are listed). Projectiles and sentries already spawned persist through hurt.
* Only one Pulse Line, one Ring, one Sentry set, one Blink/Storm may exist at a time.
* **No special or ultimate may ever substitute for an ability gate.** Specifically: Vellix's Blink Strike is floor-bound and stops at ledge edges; Afterimage Storm suspends gravity only while locked on a target and untargeted blinks are 90 px with gravity on; Korvask's Clamp Press lunge is 110 px; Brackmaw's air Vault Stomp is a straight-down dive (±60 px/s drift). See §4 for the exact texts.

### 3.8 Energy

| Item | Value |
|---|---|
| Max | 100 (125 with the vendor's **Spare Cell**) |
| Start (new game / respawn / load) | 50 (restore nodes set it to max) |
| Passive regen | 3 per second (0.05 per frame), always |
| Gain on hit | L1/L2 +4, L3 +6, Heavy +10, Air +4, Down-Strike +5, projectile/sentry hits 0 (Ring Toss +5 per leg hit), Korvask catch refund +20 |
| Spark pickup | +25 energy (and +10 meter) |
| Special cost | Tessik 30 · Brackmaw 40 · Vellix 25 · Orrubel 35 · Korvask 20 |
| Ultimate cost | 40 (all) |
| Overclock regen | doubled (6 per second) |

### 3.9 Overclock

| Item | Value |
|---|---|
| Meter max | 100; persists across rooms; reset to 0 on death and on load |
| Gain per landed hit | L1/L2 +2 · L3 +4 · Heavy +6 · Special +5 per enemy hit · Air +2 · Down-Strike +3 · projectile/sentry bolt/ring +1 · Korvask catch +15 · popping an enemy projectile +2 · a hit **blocked** by a Platewalker shield grants 25 % of the normal gain (rounded down). With the vendor's **Hot Clock** every gain in this row and the shard pickup is ×1.5 (rounded up). |
| Gain per pickup | bit coin +1 (any size) · spark +10 · shard +15 · hidden core +25 |
| During Overclock | no meter gain; meter drains linearly 100→0 over the duration (it is the timer) |
| Activate | `Overclock` with meter = 100, while idle/run/jump/fall/cling only (not during attacks, dash, hurt, hazard freeze, transitions or boss intro) |
| Transform | 20 f: f1–8 world hitstop + white flash alpha 0.6→0 + ring r0→120; f9–20 scale 1.0→1.25 and palette crossfade; invulnerable f1–20; enemies within 60 px pushed `(300 away, −200)` with 0 dmg (a 0-damage hit is never rounded up by a boss's ×1.5 / ×0.5 multiplier) |
| Duration | **12 s = 720 f** after the transform |
| Damage | `floor(d * 1.5)`: 2→3, 3→4, 4→6, 5→7, 6→9, 7→10, 8→12, 9→13, 11→16, 12→18, 14→21, 16→24, 26→39, 32→48 |
| Speed | run ×1.15 (Tessik 270, Brackmaw 207, Vellix 345, Orrubel 247, Korvask 230); dash distance ×1.15 (same frames: Tessik 207, Brackmaw 207, Vellix 242, Orrubel 207, Korvask 207); jump unchanged |
| Reach | attack hitbox `w,h` ×1.2 and `cx` ×1.1 (body box unchanged) |
| Defence | knockback received ×0.5 |
| Hitstop | +1 f on every player-dealt hit |
| Energy | regen 6/s; Special button = Ultimate (cost 40) |
| End | 10 f revert (scale 1.25→1.0, palette back); meter 0; no i-frames; `overclockEnd` SFX. Last 3 s: meter bar blinks 6 f on / 6 f off with `overclockWarn` |

Form visuals per fighter are in each sheet (palette shift, scale 1.25, extra feature). Ultimates: Tessik **Sightline** (beam), Brackmaw **Quake Vault** (mega burst), Vellix **Afterimage Storm** (multi-blink), Orrubel **Sentry Triad** (3 sentries), Korvask **Clamp Press** (grab-slam).

### 3.10 Level-design guarantees (what the world is built on)

Worst cases are Brackmaw (height/speed) and Korvask (body height). Pinned, with the physics in §4.1:

| Capability | Pinned guarantee | Must fail |
|---|---|---|
| Single jump height | every fighter clears a **3-tile** ledge (90 px): minimum apex 96.1 px (Brackmaw) | a **4-tile** ledge (120 px): maximum apex 113.8 px (Tessik) + 6 px step-up < 120 |
| Single running jump, flat gap | every fighter clears a **3-tile** gap; Brackmaw's flat reach is 112 px | — (5-tile pits on the critical path always have a grate or sunken-spike alternative, §10) |
| Echo Jump height | every fighter clears a **6-tile** ledge (180 px): minimum 190 px (Orrubel); Brackmaw 192, Vellix 196, Korvask 196, Tessik 196 | a **7-tile** ledge (210 px): maximum 196 px |
| Burst Line | a **6-tile floor gap inside a 2-tile-tall corridor** (180 px) is crossed by a ground or hop dash of 180 px (Vellix 210) plus the step-up tolerance | the same gap without the dash: in a 60 px corridor the tallest hop is 20 px (Vellix) and the airtime carries at most 129 px for Vellix, 45 px for Brackmaw; 164/148 px are needed |
| Grip Protocol | climbs a sheer `#` shaft of any height | a 10-tile shaft without it: Echo Jump maximum 196 px < 300 px |
| Chute auto-launch | `1.2 × jumpVel` lifts the feet 138 px (Brackmaw) above a 3-tall chute mouth: comfortable |
| Corridors | largest body 34×56 → every corridor is ≥ 2 tiles tall and wide; there is no crouch |
| Wall-jump shafts | ≥ 2 tiles wide (Vellix's 340 px/s exit is the ceiling) |
| Melee reach | longest from the body edge: Orrubel L3 = 76 px beyond the body (2.5 tiles); shortest: Vellix L1 = 35 px. Turrets that must be melee-safe for a zoner sit ≥ 3 tiles from the fighter's standing spot |

### 3.11 Balance tables

**Time to kill a 10 HP enemy with the light chain alone** (all hits connect, no hitstop counted; frame = absolute frame on which the killing hit's first active frame occurs):

| Fighter | Chain dmg | Hits needed | Kill frame | Time | Sustained chain DPS |
|---|---|---|---|---|---|
| Tessik | 3+3+5 = 11 | 3 (L1 L2 L3) | f21 | 0.35 s | 22.0 /s (11 per 30 f cycle) |
| Brackmaw | 4+4+8 = 16 | 3 | f28 | 0.47 s | 25.3 /s (16 per 38 f) |
| Vellix | 2+3+3 = 8 | 4 (…L3, L1) | f29 | 0.48 s | 19.2 /s (8 per 25 f) |
| Orrubel | 2+3+4 = 9 | 4 (…L3, L1) | f39 | 0.65 s · 0.45 s with a sentry out | 16.4 /s (+4.0 /s per sentry) |
| Korvask | 3+4+6 = 13 | 3 | f25 | 0.42 s | 22.9 /s (13 per 34 f) |

Worked timing (Tessik): L1 active f5–7 → L2 starts f8, active f12–14 → L3 starts f15, active f21–24 → re-chain L1 at f31. Other rows follow the same rule using each fighter's S/A and hit-cancel frames.

**One-shot reference:** Heavy one-shots a 10 HP enemy for Brackmaw (14) and Korvask (11); Tessik's heavy (9) + L1 (3) kills in 39 f; Vellix and Orrubel never one-shot a 10 HP enemy.

**Feel summary.**

| Fighter | Feel | Strengths | Weaknesses |
|---|---|---|---|
| Tessik | balanced | shortest TTK, floor-hugging projectile, easy jump-cancels | nothing exceptional; mid reach |
| Brackmaw | heavy-slow-strong | highest DPS and burst, armour on heavy, area control, 6 HP, barely moved by hits, full-power second jump | 180 run, 0.55 air control, long startups (6/6/9/16), smallest first jump |
| Vellix | fast-fragile | 300 run, 1.0 air control, 3-frame lights, i-frame floor blink, 360° air spin, longest dash | 4 HP, weight 1.3 (flung far), lowest chain damage |
| Orrubel | zoner | 2.5-tile whips, returning ring, autonomous sentry, safe spacing | lowest up-close DPS, 0 lunge, slow L3 |
| Korvask | grappler-ish bruiser | 6 HP, pull-in L3 keeps targets in range, counter turns boss attacks into 16 dmg + refund, full-power second jump | 200 run, 0.60 air control, counter whiff is 36 f, low knockback lets enemies stay dangerous |

### 3.12 `UB.Combat.RULES` (data shape)

```
UB.Combat.RULES = { buffer:6, coyote:6, jumpCut:0.45, wallJumpVx:40, wallJumpVy:0.95,
  wallCoyote:5, wallLock:8, dashCooldown:18, dashSpeedHold:true, stepUp:6, chuteLaunch:1.2,
  chuteIFrames:20, dropThroughFrames:10, pogoVy:-580, pogoDive:500,
  hurtFrames:16, iFrames:60, hurtKb:[240,-300], hurtHitstop:6, hurtShake:[5,10],
  hazardFreeze:30, hazardIFrames:45, hazardHitstop:6, deathFrames:60,
  energyMax:100, energyStart:50, energyRegen:3, meterMax:100, ocFrames:720,
  ocTransform:20, ocRevert:10, ocDamage:1.5, ocSpeed:1.15, ocReach:1.2, ocReachCx:1.1,
  ocKbTaken:0.5, ocHitstopBonus:1, ultimateCost:40, chainTimeout:20, airLandLag:4,
  landSquashVy:600, enemyFlash:4, enemyHitstunBase:10, killHitstopBonus:2 };
// djMult, dash frames/distance, wall-slide etc. are per fighter in UB.Characters.DATA (§4.8).
```

---

## 4. Fighters (`UB.Characters`)

### 4.0 Roster at a glance

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
Orrubel = deploy/sentry · Korvask = counter/parry. (Vellix's dash-strike is **floor-bound**: it never substitutes for the Burst Line gate, §3.7.)

---

### 4.1 Pinned movement stats (all five)

| Fighter | HP | Run px/s | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | 2nd jump (djMult) | Dash (Burst Line) | Wall slide | Body box |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tessik | 5 | 235 | 2300 | 2600 | 0.80 | 640 | 1800 | 900 | 1.00 | 0.85 | 180 px / 12 f (900 px/s) | 90 | 22×48 |
| Brackmaw | 6 | 180 | 1200 | 1500 | 0.55 | 620 | 2000 | 1050 | 0.60 | **1.00** | 180 px / 15 f (720 px/s) | 110 | 34×54 |
| Vellix | 4 | 300 | 3600 | 3200 | 1.00 | **615** | 1750 | 850 | 1.30 | 0.90 | **210 px** / 10 f (1260 px/s) | 70 | 18×40 |
| Orrubel | 5 | 215 | 1900 | 2200 | 0.75 | 630 | 1800 | 900 | 1.10 | 0.85 | 180 px / 12 f (900 px/s) | 90 | 24×44 |
| Korvask | 6 | 200 | 1500 | 1800 | 0.60 | 610 | 1900 | 960 | 0.75 | **1.00** | 180 px / 14 f (771 px/s) | 100 | 30×56 |

Derived (feet rise): single-jump apex Tessik 113.8 px (21 f) · Brackmaw 96.1 (19 f) · Vellix 108.1 (21 f) · Orrubel 110.3 (21 f) · Korvask 97.9 (19 f). Echo-Jump apex (jump + second jump from the apex): Tessik 196 · Brackmaw 192 · Vellix 196 · Orrubel 190 · Korvask 196. Flat single-jump horizontal reach at full run: Tessik 167 · Brackmaw 112 · Vellix 211 · Orrubel 150 · Korvask 128. The per-fighter sheets below repeat these values; the table above is canonical if any sheet line is read differently.

### 4.2 Fighter sheets

#### 4.2.1 TESSIK — The Courier Lantern (balanced)

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

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | 2nd jump | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | 235 | 2300 | 2600 | 0.80 | 640 | 1800 | 900 | 1.00 | 0.85 | 180 px / 12 f (900 px/s) | 22x48 | 90 |

Derived: jump height 113.8 px (3.8 tiles), apex in 21 f, Echo-Jump apex 196 px,
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

#### 4.2.2 BRACKMAW — The Walking Vault (heavy-slow-strong)

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

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | 2nd jump | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | 180 | 1200 | 1500 | 0.55 | 620 | 2000 | 1050 | 0.60 | 1.00 | 180 px / 15 f (720 px/s) | 34x54 | 110 |

Derived: jump height 96.1 px (3.2 tiles), apex in 19 f, Echo-Jump apex 192 px (full-power
second jump), single-jump horizontal reach 112 px. (The single jump and reach are the roster
minimums — see §3.10.)

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

#### 4.2.3 VELLIX — The Prefetch Streak (fast-fragile)

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

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | 2nd jump | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | 300 | 3600 | 3200 | 1.00 | 615 | 1750 | 850 | 1.30 | 0.90 | 210 px / 10 f (1260 px/s) | 18x40 | 70 |

Derived: jump height 108.1 px (3.6 tiles), apex in 21 f, Echo-Jump apex 196 px (second jump
0.90), single-jump horizontal reach 211 px.

**Moveset.**

| Move | S | A | R | Total | Hitbox | Dmg | KB | Hitstop | Lunge | Hit-cancel→next | Whiff-cancel→next | Jump-cancel (hit) | Energy | Meter |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 Flick | 3 | 2 | 6 | 11 | (26,0,36,24) | 2 | (140,−40) | 3 world | 60 | f6 | f9 | f6 | +4 | +2 |
| L2 Tail Snap | 3 | 3 | 6 | 12 | (30,−2,44,28) | 3 | (160,−60) | 3 world | 60 | f7 | f10 | f7 | +4 | +2 |
| L3 Crest Rake | 5 | 3 | 10 | 18 | (34,−4,48,30) | 3 | (300,−140) | 3 world | 110 | f9 (jump/dash/special) · f15 (L1 re-chain) | none | f9 | +6 | +4 |
| Heavy Tailwhip Vault | 9 | 5 | 14 | 28 | (30,−4,52,44) | 6 | (380,−240) | 4 world | 0 | none | none | f15 | +10 | +6 |
| Special Blink Strike | 4 | 8 | 8 | 20 | (6,0,34,40) moves with body | 7 | (220,−120) | 4 local | floor slide ≤ 200 px | none | none | no | −25 | +5/enemy |
| Air Scissor Spin | 4 | 5 | 8 | 17 | (0,0,52,46) both sides | 2 | (150,−60) | 3 world | — | — | — | — | +4 | +2 |
| Down-Strike Needle Drop | 3 | until land | 5 landing | — | (2,24,20,28) | 3 | (60,120) | 3 world | — | — | — | — | +5 | +3 |

Visuals: L1 = forehand claw flick, L2 = tail snaps forward past the head, L3 = crest-first
headbutt rake with a double slash line; Air = full-body 360° spin (hits behind as well);
Down-Strike = tail blade pointed down, body a straight needle.

**Special — Blink Strike (floor dash-strike).** **Grounded only** (an airborne press is buffered
for 6 f and fires on landing, like Tessik's Pulse Line). f1–4 windup (crouch). f5–12: slide
along the floor 200 px along facing at 25 px/f with gravity suspended (`vy = 0`) and the feet
snapped to the floor; the slide **stops early at a solid wall and at a drop** (on each frame,
if the next position would leave less than half the body width over footing — `#`, `-`, `c` or
a mover — the body stops with its front edge flush with the ledge edge and the remaining
travel is forfeited). The hitbox `(6,0,34,40)` travels with the body; enemies are passed
through (no enemy-collision push-out) and each is hit once for 7, KB (220,−120), 4 f local
hitstop (Vellix never freezes). i-frames on f5–12 only (contact damage and enemy attacks
ignored; hazards still hurt). f13–20 recovery. Cost 25 energy. Does not consume the air
dash. Because it never leaves footing it can never cross a gap (§3.7).

**Ultimate — Afterimage Storm.** Ground or air. S6, then 4 consecutive blinks of 8 f each:
each blink auto-aims at the nearest enemy or boss within 260 px and travels toward and
30 px through it (max 180 px, 22.5 px/f) with **gravity suspended while a target is locked**
(so the next blink reverses to cross back); with **no target in range a blink is 90 px along
facing with gravity ON** (`vy` keeps integrating; the blink adds only horizontal motion), so an
untargeted Storm never carries Vellix across a gap. Each blink has hitbox `(0,0,44,46)` and
its own hit-list: 6 dmg per pass, KB (200,−160), 3 f local hitstop. i-frames f1–38. R10.
Total 48 f. Cost 40.

---

#### 4.2.4 ORRUBEL — The Ring Warden (zoner)

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

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | 2nd jump | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | 215 | 1900 | 2200 | 0.75 | 630 | 1800 | 900 | 1.10 | 0.85 | 180 px / 12 f (900 px/s) | 24x44 | 90 |

Derived: jump height 110.3 px (3.7 tiles), apex in 21 f, Echo-Jump apex 190 px,
single-jump horizontal reach 150 px.

**Moveset.**

| Move | S | A | R | Total | Hitbox | Dmg | KB | Hitstop | Lunge | Hit-cancel→next | Whiff-cancel→next | Jump-cancel (hit) | Energy | Meter |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 Whip Flick | 5 | 3 | 9 | 17 | (44,−2,64,22) | 2 | (120,−30) | 3 world | 0 | f9 | f13 | f9 | +4 | +2 |
| L2 Whip Cross | 5 | 3 | 9 | 17 | (46,0,68,22) | 3 | (140,−40) | 3 world | 0 | f9 | f13 | f9 | +4 | +2 |
| L3 Double Lash | 7 | 4 | 13 | 24 | (50,−4,76,26) | 4 | (320,−120) | 4 world | 0 | f12 (jump/dash/special) · f18 (L1 re-chain) | none | f12 | +6 | +4 |
| Heavy Ring Toss | 10 | proj | 14 | 24 | ring 20x20 | 7 out / 4 back | (260,−120) | 4 local | 0 | none | none | no | +5 per leg hit | +1 per hit |
| Special Sentry Pin | 8 | — | 12 | 20 | sentry at (40,−8) | bolt 2 | (80,−20) | 2 local | 0 | none | none | no | −35 | +1 per bolt |
| Air Whip Circle | 5 | 4 | 10 | 19 | (28,−4,60,36) | 2 | (140,−40) | 3 world | — | — | — | — | +4 | +2 |
| Down-Strike Peg Drop | 5 | until land | 7 landing | — | (2,26,22,28) | 3 | (60,120) | 3 world | — | — | — | — | +5 | +3 |

Visuals: L1 = one antenna lash, L2 = the other antenna lash crossing the first, L3 = both
antennae lash together with a double flash; Air = both antennae circle around the body
front; Down-Strike = peg legs pointed down, rings compressed.

**Heavy — Ring Toss (returning projectile).** On f11 the top ring launches from (14,−2):
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

#### 4.2.5 KORVASK — The Clamp Balancer (grappler-ish bruiser)

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

| HP | Run | Ground accel | Friction | Air ctrl | Jump vel | Gravity | Max fall | Weight | 2nd jump | Dash | Body | Wall slide |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | 200 | 1500 | 1800 | 0.60 | 610 | 1900 | 960 | 0.75 | 1.00 | 180 px / 14 f (771 px/s) | 30x56 | 100 |

Derived: jump height 97.9 px (3.3 tiles), apex in 19 f, Echo-Jump apex 196 px (full-power
second jump), single-jump horizontal reach 128 px.

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
flagged `unblockable` in §8.5 and hazards (spikes, acid, static) are NOT caught and
hurt normally. If nothing is caught, f19–36 is recovery (punishable). Cost 20 energy on press.

**Ultimate — Clamp Press.** Ground or air (gravity suspended during the lunge). S8; lunge
f9–18 (110 px, 11 px/f) with grab box (18,0,40,50). First enemy/boss touched: 8 f world
hitstop, then Press phase f19–32: a non-boss victim is locked to body-local (22,0) while
Korvask hops 24 px up and comes down; on f33–36 slam hitbox (16,10,90,60): the held victim
takes 32, every other enemy in the box takes 10 with KB (380,−400); R14. Bosses are not moved
and take 32 on the slam. Whiff: R18 after the lunge (36 total). Cost 40. The 110 px lunge is shorter than any gap gate
(§3.7).

---

### 4.3 Bios (shown on the character select, §12.2; also in `UB.Text`)

* **Tessik — The Courier Lantern.** Tessik once carried messages between the kingdom's
  layers and still mutters route names under its breath. It believes every corrupted thing
  is only a message that lost its address, and that a sharp enough blade can re-deliver it.
  Balanced in every stat; the right first choice.
* **Brackmaw — The Walking Vault.** A retired archival lock that decided the safest vault
  is the one that walks toward the problem. It speaks in short declaratives and considers
  being knocked over a personal failing. Slow, armoured, and the hardest hitter here.
* **Vellix — The Prefetch Streak.** A cache routine that lives three steps ahead of everyone
  and is bored by the present. Reckless and bright, it treats every fight as a timing puzzle
  it has already solved. Fastest in the roster, and the most fragile.
* **Orrubel — The Ring Warden.** A watchdog process that trusts nothing it has not measured
  twice and prefers to fight from behind a wall of its own instruments. Soft-spoken and
  precise, it apologises to enemies as it pins them. Long reach, a returning ring, and
  sentries.
* **Korvask — The Clamp Balancer.** A load-balancer that misremembers its old job as
  "holding things until they stop struggling." Gruff and loyal, it believes any problem
  can be solved by getting closer to it. A bruiser whose counter turns enemy attacks
  into pain.

### 4.4 `UB.Characters.DATA` shape

Every value is defined in the tables above; fill all five fighters from their sheets verbatim (move tables → `moves`, palettes, Overclock palettes, the special/ultimate parameters as named fields).

```
UB.Characters.DATA = {
  tessik: {
    id:'tessik', name:'Tessik', title:'The Courier Lantern', affinity:'signal',
    hp:5, run:235, accel:2300, friction:2600, airControl:0.80,
    jumpVel:640, gravity:1800, maxFall:900, weight:1.00, wallSlide:90, djMult:0.85,
    dash:{dist:180, frames:12}, box:{w:22, h:48}, runCycle:8,
    palette:{base:'#2F7A86', shade:'#163E47', accent:'#F0B64A', glow:'#DFFBFF'},
    ocPalette:{base:'#19B5C8', shade:'#0B4A55', accent:'#FFE08A', glow:'#FFFFFF'},
    moves:{
      light1:{s:4,a:3,r:8, box:[30,-2,44,30], dmg:3, kb:[180,-60], hitstop:3, lunge:40,
              hitCancel:8, whiffCancel:12, jumpCancel:8, energy:4, meter:2},
      light2:{...}, light3:{..., rechain:17}, heavy:{...}, special:{cost:30, ...},
      air:{...}, down:{...}, ultimate:{cost:40, ...}
    }
  },
  brackmaw:{... djMult:1.00, dash:{dist:180, frames:15}, runCycle:12 ...},
  vellix:  {... jumpVel:615, djMult:0.90, dash:{dist:210, frames:10}, runCycle:6 ...},
  orrubel: {... djMult:0.85, dash:{dist:180, frames:12}, runCycle:4 ...},
  korvask: {... djMult:1.00, dash:{dist:180, frames:14}, runCycle:10 ...}
};
// UB.Combat.RULES is pinned in §3.12.
```

---

## 5. World (`UB.Zones`)

### 5.1 Zone table

Zone ids are the lowercase names; `index` seeds procedural art/audio. Palettes use the 11 keys the renderer needs (§11.1.3): `bg0` far void · `bg1` far layer · `bg2` mid layer · `tileFill` · `tileShade` (hatching) · `tileEdge` (rim light) · `fog` · `glow` (powered details, enemy eyes, restore nodes) · `hazard` (pool body) · `accent` (props). Every colour is a constant in `UB.Palette.ZONES[id]`.

| index | id | Display name | Theme | bg0 | bg1 | bg2 | tileFill | tileShade | tileEdge | fog | glow | hazard | accent |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `driftcache` | **DRIFTCACHE** | dead cache memory: blue dust, toppled racks, sagging shelves; dim and quiet; the tutorial zone | `#0b1220` | `#15213a` | `#1e2f4e` | `#2a3a5c` | `#1b2740` | `#6c86b8` | `rgba(60,80,140,0.18)` | `#8fd3ff` | `#8fd3ff` | `#8fb6e8` |
| 2 | `loomworks` | **LOOMWORKS** | cable looms: rust-orange machinery, chain hoists, belts, spools taller than the player, static in the floor channels; the moving-platform zone | `#1a0f08` | `#2e1a0e` | `#3f2512` | `#5a3519` | `#3a2210` | `#b8733a` | `rgba(200,120,60,0.14)` | `#ffb24a` | `#ffd27a` | `#b8733a` |
| 3 | `brinevault` | **BRINEVAULT** | flooded cooling vaults: pale green coolant gone to acid, dripping pipes, rock pillars in a lake, crystal growths; the hazard-pool zone | `#06140f` | `#0d2a20` | `#143a2c` | `#1d4d3a` | `#123326` | `#4fae84` | `rgba(60,160,110,0.16)` | `#a8ffcf` | `#5ee89a` | `#4fae84` |
| 4 | `nullspire` | **NULLSPIRE** | an inverted spire of black glass hanging in a violet void, every edge crawling with white static; vertical shafts, sheer walls, long drops; the wall-jump zone | `#0a0612` | `#170d26` | `#211238` | `#2b1848` | `#1c0f30` | `#7a4fb8` | `rgba(140,90,200,0.16)` | `#e8e0ff` | `#e8e0ff` | `#7a4fb8` |
| 5 | `rootwell` | **ROOTWELL** | the deepest layer: crimson dark, gold filament, cable-roots thick as pillars converging on a well of light; short, dense, final | `#140406` | `#2a080c` | `#3a0c12` | `#4d1018` | `#330a10` | `#b32a2a` | `rgba(200,40,60,0.14)` | `#ffcf5a` | `#ff6a3a` | `#b32a2a` |

Boss rooms use their zone palette with `fog` alpha doubled and `bg0` darkened 20 %.

### 5.2 Hazards, song and ambient layer per zone

| Zone | Hazards present | Song (§13.7) | Ambient SFX layer (§13.10) | Pools are |
|---|---|---|---|---|
| Driftcache | floor spikes, ceiling spikes, crumbling platforms (no pools) | "Idle Loop" 72 BPM | dust tick every 3–6 s, 55 Hz hum | — |
| Loomworks | static pools, ceiling spikes, floor spikes, moving platforms, crumbling platforms | "Pressure Line" 104 BPM | chain-rattle bursts synced to movers, rising saw sweep every 8 s | static |
| Brinevault | acid pools, ceiling spikes, crumbling platforms, one-way grates over acid | "Facets" 96 BPM | water drips every 0.4–2 s, low bubbling | acid |
| Nullspire | static pools, floor spikes, ceiling spikes, crumbling platforms, one moving lift | "Unanswered" 84 BPM | 880/884 Hz beating drone, static crackle every 1–4 s, descending bass note every 12 s | static |
| Rootwell | none environmental (boss attacks only); the gauntlet is enemies | "Null Pointer" 60 BPM | heartbeat thumps every 1.2 s, rising choir drone toward `rw_throne` | — |

### 5.3 Lore title cards (shown once, on first entry to the zone; §12.18)

* **DRIFTCACHE** — *Everything the kingdom ever remembered and chose not to keep came here to settle. The racks have fallen into one another like old friends. Something still walks the aisles, counting what was lost.*
* **LOOMWORKS** — *Here the kingdom wove its own nerves, cable by cable, and never stopped. The looms still run with nothing left to carry. Stand on a belt and it will take you somewhere; whether you wanted to go is not the belt's concern.*
* **BRINEVAULT** — *The kingdom ran hot and bled coolant into these vaults to keep its heart from cooking. The coolant stayed; the heart did not. What sleeps in the brine now has learned to climb.*
* **NULLSPIRE** — *Addresses that point at nothing all point here. The spire grew downward out of the void, one unanswered call at a time. Climb it and you will be the first thing to arrive.*
* **ROOTWELL** — *Every process in the kingdom was a child of the one that sits here, and it has never once let go of a child. It will not let go of you either. Make it.*

The short toast blurbs (§12.5, shown on every zone change) are in §15.4.

### 5.4 Zone prop catalogue (`B` tiles)

A `B` tile is non-solid air with a prop drawn anchored to it (never footing). A vertical run of adjacent `B` tiles is one tall prop; a lone `B` is one small prop. Props are drawn into the static tile layer (§11.1.8) in `accent` with ink outlines, with one `glow` detail each:

| Zone | Tall prop (column of B) | Small prop (lone B) |
|---|---|---|
| Driftcache | toppled server rack: a rounded rect 24 wide × (rows×30 − 6) tall, leaning 6°, with 4 horizontal slot lines per 30 px and one `glow` status dot | cable stump: a 14×16 rounded rect with 3 frayed cable strands (2 px, 10 px long) |
| Loomworks | thread spool: two discs (ellipses 26×8) joined by a cylinder 20 wide with 5 diagonal thread lines; a dangling chain (6 ovals 5×4) hangs from the top disc | chain stub: 3 ovals + a hook arc |
| Brinevault | pipe elbow: a rounded rect 16 wide running the column with a 90° elbow at the top and a drip bead (`glow`, r 2) that falls 20 px every 90 f | pipe stub with a single drip |
| Nullspire | antenna spire: a thin isosceles triangle 14 wide at the base rising the column height with a `glow` tip dot (r 3) and two 8 px cross-bars | a short spire 20 px tall |
| Rootwell | cable-root: a thick wavy vertical stroke (`lineWidth 10`, 3 sine bends) with 3 knot circles (r 6) and a `glow` vein line down its centre | a root knot (circle r 8 with 2 short root strokes) |

In `rw_throne` the `BBBB` blocks at rows 8–9 (x30–33) draw the hanging crown canopy and the blocks at rows 17–20 (x30–33) draw the throne; the throne props burst into particles at the phase-2 transition (§8.4) and are not redrawn.

### 5.5 Tile legend (authoritative for §6)

| Char | Name | Collision / behaviour |
|---|---|---|
| `#` | solid | Solid on all four sides. Wall-clingable once Grip Protocol is owned. |
| `-` | one-way platform | Solid only from above (§3.0). Down + Jump drops through. Enemies treat it as solid from above. |
| `c` | crumbling platform | Behaves like `#` until a player stands on it; then **shakes 20 f** (±2 px jitter), then **vanishes** (no collision, falling-fragment particles) for **180 f**, then returns with a 6 f fade-in (the return waits, 6 f at a time, while an enemy or the boss occupies the tile — a plank never closes onto one; a player in the gap is the §3.3 crush hazard). Each `c` tile has its own timer, but all `c` tiles touched on the same frame start together. Clingable while present. |
| `^` | floor spike | Hazard (§3.3). Pogo-able. |
| `v` | ceiling spike | Hazard (§3.3). Not pogo-able. |
| `~` | hazard pool | Hazard (§3.3): acid in Brinevault, static elsewhere. Enemies, projectiles and moving platforms ignore pools. |
| `.` | empty | Air. |
| `B` | decor hint | Non-solid air; the renderer draws the zone prop here (§5.4). Never footing. |

* The outermost ring of every room is `#` except where an exit opening punches through it. Room bounds are solid for anything that is not an exit.
* **Exits** (§6): a rectangle of opening tiles on one room edge. Trigger: left/right — the body centre x leaves the room (x < 0 or x > w·30) while the body vertically overlaps the opening rows; top — the body top < −8 px while horizontally overlapping the opening columns; bottom — the body top > h·30 while horizontally overlapping the opening columns. **Arrival:** each exit lists an arrival spawn tile (x,y): the body's bottom-centre is placed at pixel (x·30+15, (y+1)·30), i.e. the player stands on tile (x, y+1). Horizontal velocity is preserved on left/right arrivals; a **top** arrival sets `vy = +120 px/s` (falling); a **bottom** arrival is the chute auto-launch of §3.1. Every top exit has footing at row ≤ 4 inside its opening columns (a launch pad), so a single jump carries the body top past −8 px.
* **Room transition** presentation is §11.3.2 (freeze 6 f, slide 18 f, settle 4 f). Enemies in the room being left are discarded; the new room spawns its full roster. Entering a room marks it `visited` and its exit targets `discovered`.
* **Moving platforms** (§6 per room): `id · width×1 · from (x,y) → to (x,y) · speed px/frame · end-wait frames`. (x,y) is the platform's top-left tile at each end; the platform is `width` tiles wide and 1 tile tall, solid from above only, and carries the player. It ping-pongs at constant speed, waiting `end-wait` frames at each end. All movers in a room start at their `from` end on room entry with a phase offset of `index × 45` frames (index = order listed). Drawn by the entity layer as a §11.1.4 platform bar with a chain/belt detail in `accent`.
* **Restore node** (one or two per zone; §6 lists the tile): standing within 1 tile and pressing Up: 30 f pulse animation (`heal` particles, `restore` SFX), full heal, energy to max, meter unchanged, respawn all non-boss enemies in every room, save (§14), and set the death respawn point. The `RESTORED` banner (§12.7) shows. Dormant nodes glow dimly (§11.1.4).
* Enemy respawn: all non-boss enemies respawn when a room is entered. Bosses never respawn once defeated. Hidden cores, bits placed in rooms and the vendor's stock are one-time (saved).

---

## 6. Rooms (`UB.Rooms`)

23 rooms, zone by zone along the critical path. Each room lists its exits (with the ability a player is expected to own to reach that exit from the room's other exits — informational: the engine never blocks traversal, geometry does), enemies (tile (x,y) = the tile the enemy's feet occupy; it stands on (x,y+1); flyers are centred on the tile; droplatches hang under the tile above), hazards (counted from the map), moving platforms, restore node, vendor, hidden core, placed bits, boss data and map-grid position (§12.12), then the full tilemap: `w` characters per row, exactly, legend in §5.5. "spawn (x,y)" is the arrival spawn tile per §5.5. The tilemaps are the data; implementers embed them as arrays of strings in `UB.Rooms.DATA[id].map` and must not retype them (copy the blocks).

Tilemap fixes relative to `design/world.md` are listed in §10.6; everything else is verbatim.

### 6.1 `dc_wake` — Wake Cell

* **Zone:** Driftcache (`driftcache`) · **Size:** 32×18 tiles (960×540 px) · **Map grid:** gx 0, gy 0, 1×1 screens
* **On entering:** A low, dusty chamber. You lie on a raised dais of dead cache slabs; a restore node hums beside you. One patroller scrapes along the floor to the right; a single one-way shelf hangs over it with three bits.
* **New-game start tile:** (3, 12) (feet on top of tile (3,13)).
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `R` · right · rows 12–14 (x=31) · → `dc_fall.L` · **none** · spawn (29, 14)
* **Enemies** (type · tile x,y · behaviour note):
  * `scuttlebit` · (20,14) · patrol x 16–26 — tutorial patroller
* **Hazards:** none.
* **Restore node:** tile (5, 12) (stands on (5,13)). Node id `node_dc_wake`.
* **Bits placed (one-time, saved per tile):** (19,10) small (1), (20,10) small (1), (21,10) small (1)
* **Tilemap** (32 cols × 18 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
#.........###.......##.....#####
#.........###.......##.....#####
#...................##.....#####
#..........................#####
#..........................#####
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#.................-----........#
#.............B.................
########......B........B.....B..
##########....B........B.....B..
################################
################################
################################
```

### 6.2 `dc_fall` — The Long Drop

* **Zone:** Driftcache (`driftcache`) · **Size:** 32×54 tiles (960×1620 px) · **Map grid:** gx 1, gy 0, 1×3 screens
* **On entering:** A tall shaft of stacked, sagging cache racks. Ledges alternate left and right down into dark. High on the right a sealed pocket glows faintly above a smooth shaft (core 3, wall-jump only).
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 2–4 (x=0) · → `dc_wake.R` · **none** · spawn (2, 4)
  * `R` · right · rows 47–49 (x=31) · → `dc_cross.L` · **none** · spawn (29, 49)
* **Enemies** (type · tile x,y · behaviour note):
  * `scuttlebit` · (5,19) · patrol x 2–9
  * `driftmoth` · (16,18) · stationary / own logic
  * `driftmoth` · (14,30) · stationary / own logic
  * `hopnode` · (22,49) · patrol x 19–28
  * `scuttlebit` · (26,42) · patrol x 23–29
* **Hazards:** 9 floor-spike tiles, 5 ceiling-spike tiles, 6 crumble tiles.
* **Hidden core:** tile (24, 4). Core id `core_dc_fall`.
* **Bits placed (one-time, saved per tile):** (14,7) small (1), (15,7) small (1), (13,23) medium (5), (2,35) small (1), (3,35) small (1), (28,3) large (20)
* **Tilemap** (32 cols × 54 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
#.....................##########
......................#.......##
......................#.......##
......................#.......##
###########...........#####...##
###########...........#####...##
###########...........#####...##
#............----.....#####...##
#.....................#####...##
#.....................#####...##
#.....................#####...##
#.............................##
#.............................##
#..................#############
#..................#############
#..................###.........#
#..................###.........#
#....B.............###.........#
#....B.............###.........#
###########....................#
###########....................#
#..............................#
#..............................#
#...........----...............#
#............................B.#
#.......................^^^^.B.#
#.................##############
#.................##############
#..............................#
#..............................#
#.......ccc....................#
#..............................#
#..............................#
#.......B.....ccc..............#
#.......B......................#
#############..................#
#############..................#
#.vvvvv........................#
#..............................#
#...............----...........#
#..........................B...#
#..........................B...#
#.....................##########
#.....................##########
#..............................#
#.........----.................#
#...............................
#...............................
#...........^^^^^...............
################################
################################
################################
################################
```

### 6.3 `dc_cross` — Crossrack Hall

* **Zone:** Driftcache (`driftcache`) · **Size:** 64×18 tiles (1920×540 px) · **Map grid:** gx 2, gy 2, 2×1 screens
* **On entering:** A wide hall of toppled server racks. Two spike pits break the floor; a mound of slabs rises mid-room. Up-left, a shelf 6 tiles high leads to an opening you cannot reach yet. Far right, a hanging slab with a turret guards two one-way shelves climbing to a hole in the ceiling.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 12–14 (x=0) · → `dc_fall.R` · **none** · spawn (2, 14)
  * `L2` · left · rows 6–8 (x=0) · → `lw_shaft.R2` · **ECHO JUMP** · spawn (2, 8)
  * `R` · right · rows 12–14 (x=63) · → `dc_shrine.L` · **none** · spawn (61, 14)
  * `T` · top · cols 56–58 (y=0) · → `dc_loft.B` · **ECHO JUMP** · spawn (57, 1)
* **Enemies** (type · tile x,y · behaviour note):
  * `scuttlebit` · (8,14) · patrol x 2–12
  * `scuttlebit` · (29,12) · patrol x 26–34
  * `hopnode` · (47,14) · patrol x 44–52
  * `spitvalve` · (57,8) · stationary / own logic — faces left, fires down-left arc
  * `driftmoth` · (37,6) · stationary / own logic
* **Hazards:** 9 floor-spike tiles.
* **Bits placed (one-time, saved per tile):** (23,10) small (1), (24,10) small (1), (31,7) medium (5), (32,7) small (1), (4,8) medium (5), (57,5) small (1)
* **Tilemap** (64 cols × 18 rows; row 0 is the top; every row is exactly 64 characters):

```
########################################################...#####
#...................###.....................#######............#
#...................###.....................#######....-----...#
#..............................................................#
#..............................................................#
#..............................................................#
.......................................................-----...#
...............................................................#
..............................----.............................#
#########.............................................#######..#
#########.............................................#######..#
#.....................----.....................................#
..........B....---..................B...........B.............B.
..........B...............#########.B...........B.............B.
..........B...............#########.B...........B.............B.
##############.....#####################....####################
##############^^^^^#####################^^^^####################
################################################################
```

### 6.4 `dc_loft` — The Loft

* **Zone:** Driftcache (`driftcache`) · **Size:** 32×18 tiles (960×540 px) · **Map grid:** gx 3.75, gy 1, 1×1 screens
* **On entering:** A cramped attic of racks, warm and silent. A pedestal on the right holds a pulsing core; between you and it a bed of spikes under two crumbling planks and a dropper clinging to the ceiling.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `B` · bottom · cols 5–7 (y=17) · → `dc_cross.T` · **none** · spawn (6, 17)
* **Enemies** (type · tile x,y · behaviour note):
  * `droplatch` · (21,4) · stationary / own logic — drops when player is within 2 tiles horizontally
  * `spitvalve` · (29,8) · stationary / own logic — faces left
* **Hazards:** 7 floor-spike tiles, 4 crumble tiles.
* **Hidden core:** tile (27, 12). Core id `core_dc_loft`.
* **Bits placed (one-time, saved per tile):** (19,10) small (1), (23,10) small (1), (2,14) medium (5)
* **Tilemap** (32 cols × 18 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
################################
################################
################################
#....................B.........#
#....................B.........#
#..............................#
#..............................#
#..............................#
#...........................####
#...........................####
#..................cc..cc...####
#...B....B.....................#
#...B....B................###..#
#...B....B........^^^^^^^.###..#
#####...########################
#####...########################
#####...########################
```

### 6.5 `dc_shrine` — Rackside Shrine

* **Zone:** Driftcache (`driftcache`) · **Size:** 32×18 tiles (960×540 px) · **Map grid:** gx 4, gy 2, 1×1 screens · **SAFE ROOM** (no enemies)
* **On entering:** A hushed alcove lit by a restore node. Scrivvet the broker crouches by a toppled rack with wares spread on a cloth of cable. No enemies ever spawn here.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 12–14 (x=0) · → `dc_cross.R` · **none** · spawn (2, 14)
  * `R` · right · rows 12–14 (x=31) · → `dc_sentinel.L` · **none** · spawn (29, 14)
* **Enemies:** none.
* **Hazards:** none.
* **Restore node:** tile (9, 14) (stands on (9,15)). Node id `node_dc_shrine`.
* **Vendor (Scrivvet):** tile (21, 14).
* **Bits placed (one-time, saved per tile):** (14,9) small (1), (16,9) small (1)
* **Tilemap** (32 cols × 18 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............B...............#
#..............B...............#
#...........-------............#
#....B...................B.....#
.....B...................B......
.....B...................B......
.....B...................B......
################################
################################
################################
```

### 6.6 `dc_sentinel` — Sentinel Stack

* **Zone:** Driftcache (`driftcache`) · **Size:** 48×18 tiles (1440×540 px) · **Map grid:** gx 5, gy 2, 1.5×1 screens · **BOSS ARENA**
* **On entering:** A long gallery floored with fused slabs; two one-way shelves hang at mid-height. At the far right a 5-tile block rises to a dark doorway. The moment you cross the threshold the entrance seals and the stack of discs in the centre stands up.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 12–14 (x=0) · → `dc_shrine.R` · **none** · spawn (3, 14)
  * `R2` · right · rows 7–9 (x=47) · → `lw_hoist.L` · **ECHO JUMP** · spawn (44, 9)
* **Enemies:** none.
* **Hazards:** none.
* **Boss:** Tallock · fight bounds x 1–39 · sealed exits during the fight: `L` · ability pickup appears at (20,14)
* **Tilemap** (48 cols × 18 rows; row 0 is the top; every row is exactly 48 characters):

```
################################################
################################################
################################################
#...................B..........................#
#...................B..........................#
#..............................................#
#..............................................#
#...............................................
#...............................................
#...............................................
#.......................................########
#.......................................########
........----................----........########
......B...........................B.....########
......B...........................B.....########
################################################
################################################
################################################
```

### 6.7 `lw_hoist` — Hoist Gallery

* **Zone:** Loomworks (`loomworks`) · **Size:** 32×36 tiles (960×1080 px) · **Map grid:** gx 6.5, gy 2, 1×2 screens
* **On entering:** Rust-orange machinery towers above a floor of crackling static. Two chain hoists ride slowly up and down; moths drift between them. A single pillar with a chute in its crown is the only dry footing at the bottom.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 4–6 (x=0) · → `dc_sentinel.R2` · **none** · spawn (2, 6)
  * `B` · bottom · cols 14–16 (y=35) · → `lw_belts.T` · **none** · spawn (15, 35)
* **Enemies** (type · tile x,y · behaviour note):
  * `driftmoth` · (16,13) · stationary / own logic
  * `driftmoth` · (9,27) · stationary / own logic
  * `droplatch` · (27,4) · stationary / own logic — hangs from the right ceiling block
* **Hazards:** 7 ceiling-spike tiles, 21 hazard-pool tiles (static). The bottom-left bank is pool too: the chute pillar is the only dry footing at the bottom besides the right bank (x27–30, which hoist H2 reaches at its lowest point).
* **Moving platforms** (id · width · from (x,y) → to (x,y) · speed px/frame · end-wait frames; (x,y) = platform top-left tile; ping-pong; phase offset = index × 45 f):
  * `H1` · 3×1 · (11, 9) → (11, 20) · 1.0 · 40
  * `H2` · 3×1 · (19, 16) → (19, 28) · 1.0 · 40
* **Bits placed (one-time, saved per tile):** (2,17) medium (5), (3,17) small (1), (26,13) small (1), (27,13) small (1), (25,21) medium (5)
* **Tilemap** (32 cols × 36 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
#.......................########
#.......................########
#.......................########
............B..................#
............B..................#
............B..................#
##########.....................#
##########.....................#
#.vvvvvvv......................#
#...................B..........#
#...................B..........#
#..............................#
#..............................#
#.......................-----..#
#..............................#
#..............................#
#..............................#
#######........................#
#######........................#
#..............................#
#..............................#
#.....................##########
#.....................##########
#..............................#
#...B..........................#
#...B..........................#
#...B..........................#
#...........................B..#
#...........................B..#
#............#...#.............#
#............#...#.............#
#............#...#.............#
#~~~~~~~~~~~~#...#~~~~~~~~~#####
##############...###############
##############...###############
```

### 6.8 `lw_belts` — Belt Floor

* **Zone:** Loomworks (`loomworks`) · **Size:** 96×18 tiles (2880×540 px) · **Map grid:** gx 6.5, gy 4, 3×1 screens
* **On entering:** The widest hall in the kingdom: a factory floor three screens long. Two static pools are crossed on sliding belt-platforms. Plated walkers hold the middle mound, a ram-beast paces the far end, and high on the right a 2-tile crawlspace with a gap in its floor hides a glowing pedestal (core 2).
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `T` · top · cols 10–12 (y=0) · → `lw_hoist.B` · **none** · spawn (11, 1)
  * `L` · left · rows 12–14 (x=0) · → `lw_shaft.R` · **none** · spawn (2, 14)
  * `R` · right · rows 12–14 (x=95) · → `lw_rest.L` · **none** · spawn (93, 14)
* **Enemies** (type · tile x,y · behaviour note):
  * `platewalker` · (38,14) · patrol x 33–42
  * `platewalker` · (65,12) · patrol x 60–70
  * `rambyte` · (82,14) · patrol x 72–93
  * `droplatch` · (17,3) · stationary / own logic
  * `droplatch` · (57,3) · stationary / own logic
  * `spitvalve` · (49,8) · stationary / own logic — faces left, sits on the one-way shelf over pool 2
* **Hazards:** 24 hazard-pool tiles (static).
* **Moving platforms** (id · width · from (x,y) → to (x,y) · speed px/frame · end-wait frames; (x,y) = platform top-left tile; ping-pong; phase offset = index × 45 f):
  * `M1` · 3×1 · (21, 12) → (28, 12) · 1.5 · 20
  * `M2` · 3×1 · (45, 12) → (52, 12) · 2.0 · 20
* **Hidden core:** tile (93, 6). Core id `core_lw_belts`.
* **Bits placed (one-time, saved per tile):** (10,3) small (1), (12,3) small (1), (49,8) medium (5), (75,6) medium (5), (88,3) small (1)
* **Tilemap** (96 cols × 18 rows; row 0 is the top; every row is exactly 96 characters):

```
##########...###################################################################################
#...............###.................#####...............###....................................#
#...............###.................#####...............###....................................#
#..............................................................................................#
#.......-------.............................................................####################
#..............................................................................................#
#..............................................................................................#
#.........................................................................----######......######
#.........................................................................................######
#...............................................---.......................................######
#........................................................................----.............######
#.........................................................................................######
......B...........................B.......................B...........................B.........
......B...........................B.......................B.###########.B.............B.........
......B...........................B.......................B.###########.B.............B.........
####################~~~~~~~~~~~~############~~~~~~~~~~~~########################################
################################################################################################
################################################################################################
```

### 6.9 `lw_shaft` — Spindle Shaft

* **Zone:** Loomworks (`loomworks`) · **Size:** 32×36 tiles (960×1080 px) · **Map grid:** gx 5.5, gy 3, 1×2 screens
* **On entering:** A vertical service shaft of hanging spools and one-way grates climbing out of sight. A slow hoist runs the left wall. At the very top a ledge leads left into the dark, back toward the Driftcache.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `R` · right · rows 31–33 (x=31) · → `lw_belts.L` · **none** · spawn (28, 33)
  * `R2` · right · rows 2–4 (x=31) · → `dc_cross.L2` · **ECHO JUMP** · spawn (28, 4)
* **Enemies** (type · tile x,y · behaviour note):
  * `hopnode` · (6,33) · patrol x 2–10
  * `droplatch` · (16,1) · stationary / own logic
  * `driftmoth` · (18,18) · stationary / own logic
  * `hopnode` · (24,4) · patrol x 21–25
* **Hazards:** 7 floor-spike tiles.
* **Moving platforms** (id · width · from (x,y) → to (x,y) · speed px/frame · end-wait frames; (x,y) = platform top-left tile; ping-pong; phase offset = index × 45 f):
  * `S1` · 3×1 · (8, 30) → (8, 10) · 1.2 · 30
* **Bits placed (one-time, saved per tile):** (23,27) small (1), (14,23) small (1), (6,15) medium (5), (16,11) small (1), (28,4) large (20)
* **Tilemap** (32 cols × 36 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
#.....................##########
#...............................
#...............................
#...............................
#...................############
#...................############
#..............................#
#........................B.....#
#.............-----......B.....#
#........................B.....#
#..............................#
#.............------...........#
#..............................#
#..............................#
#..............................#
#...------.....................#
#..............................#
#..............................#
#..............................#
#.....................-------..#
#..............................#
#..B...........................#
#..B...........................#
#...........------.............#
#..............................#
#..............................#
#..............................#
#...................-------....#
#..............................#
#...............B..............#
#...............B...............
#...............B...............
#...........^^^^^^^.............
################################
################################
```

### 6.10 `lw_rest` — Spool Rest

* **Zone:** Loomworks (`loomworks`) · **Size:** 32×18 tiles (960×540 px) · **Map grid:** gx 9.5, gy 4, 1×1 screens · **SAFE ROOM** (no enemies)
* **On entering:** A quiet mezzanine of stacked spools around a restore node. A grated hatch in the floor at the left (one-way grate: press Down + Jump to drop through) leads down into green-lit dark.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 12–14 (x=0) · → `lw_belts.R` · **none** · spawn (2, 14)
  * `R` · right · rows 12–14 (x=31) · → `lw_weftyr.L` · **none** · spawn (29, 14)
  * `B` · bottom · cols 4–6 (y=17) · → `bv_catwalk.T` · **none** · spawn (5, 17)
* **Enemies:** none.
* **Hazards:** none.
* **Restore node:** tile (15, 14) (stands on (15,15)). Node id `node_lw_rest`.
* **Tilemap** (32 cols × 18 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..........................B...#
#..........................B...#
#.........B....................#
..........B...........B.........
..........B...........B.........
..........B...........B.........
####---#########################
####...#########################
####...#########################
```

### 6.11 `lw_weftyr` — The Great Loom

* **Zone:** Loomworks (`loomworks`) · **Size:** 48×18 tiles (1440×540 px) · **Map grid:** gx 10.5, gy 4, 1.5×1 screens · **BOSS ARENA**
* **On entering:** A cathedral of threads strung wall to wall. Three one-way shelves hang at the same height. A 1-tile wall at the right screens a hatch in the floor. The loom shuttle overhead begins to spin as the entrance seals.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 12–14 (x=0) · → `lw_rest.R` · **none** · spawn (3, 14)
  * `B` · bottom · cols 42–44 (y=17) · → `bv_sluice.T` · **none** · spawn (43, 17)
* **Enemies:** none.
* **Hazards:** none.
* **Boss:** Weftyr · fight bounds x 1–39 · sealed exits during the fight: `L`, `B` · ability pickup appears at (20,14)
* **Tilemap** (48 cols × 18 rows; row 0 is the top; every row is exactly 48 characters):

```
################################################
################################################
################################################
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#.....----.........----.........----....#......#
#.......................................#......#
............B...........B...........B...#......#
............B...........B...........B...#......#
............B...........B...........B...#......#
##########################################...###
##########################################...###
##########################################...###
```

### 6.12 `bv_sluice` — Sluice Run

* **Zone:** Brinevault (`brinevault`) · **Size:** 64×18 tiles (1920×540 px) · **Map grid:** gx 11.75, gy 5, 2×1 screens
* **On entering:** Pale green coolant drips from every pipe. You land on a high shelf above a 2-tile crawlspace; its floor is missing for 6 tiles above an acid channel. Beyond, the run drops to a flooded floor patrolled by hoppers under a spiked slab, and a spitter on a raised pipe.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `T` · top · cols 2–4 (y=0) · → `lw_weftyr.B` · **none** · spawn (3, 1)
  * `R` · right · rows 12–14 (x=63) · → `bv_cistern.L` · **BURST LINE** · spawn (61, 14)
* **Enemies** (type · tile x,y · behaviour note):
  * `brinejelly` · (40,13) · stationary / own logic
  * `brinejelly` · (56,9) · stationary / own logic
  * `hopnode` (dripnode variant) · (38,14) · patrol x 31–46
  * `spitvalve` (acid valve variant) · (50,10) · stationary / own logic — faces left
* **Hazards:** 9 ceiling-spike tiles, 16 hazard-pool tiles (acid).
* **Bits placed (one-time, saved per tile):** (10,7) small (1), (12,7) small (1), (23,7) medium (5), (53,5) medium (5), (54,5) small (1)
* **Tilemap** (64 cols × 18 rows; row 0 is the top; every row is exactly 64 characters):

```
##...###########################################################
##...###########################################################
##...###########################################################
#........######################................................#
#.----...######################................................#
#........######################................................#
#.................................................-------......#
#..............................................................#
###############......##########...###########..................#
###############......##########...###########..................#
#########............####..........vvvvvvvvv...................#
#########............####.......................#####..........#
#########............####...B.................B.............B...
#########............####...B.................B.............B...
#########............####...B.................B.............B...
#########~~~~~~~~~~~~~~~~#######################################
################################################################
################################################################
```

### 6.13 `bv_cistern` — The Cistern

* **Zone:** Brinevault (`brinevault`) · **Size:** 64×36 tiles (1920×1080 px) · **Map grid:** gx 13.75, gy 5, 2×2 screens
* **On entering:** A cavern two screens tall, its floor an acid lake broken by five rock pillars. An upper gallery of one-way grates and a plated walker on a slab leads to a grate in the ceiling; the right bank holds a brood-cell and a rolling wheel. A high right ledge hides a cache.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 13–15 (x=0) · → `bv_sluice.R` · **none** · spawn (2, 15)
  * `T` · top · cols 50–52 (y=0) · → `bv_catwalk.B` · **none** · spawn (51, 1)
  * `R` · right · rows 30–32 (x=63) · → `bv_rest.L` · **none** · spawn (61, 32)
* **Enemies** (type · tile x,y · behaviour note):
  * `brinejelly` · (20,24) · stationary / own logic
  * `brinejelly` · (28,22) · stationary / own logic
  * `brinejelly` · (34,26) · stationary / own logic
  * `platewalker` · (39,11) · patrol x 34–44
  * `scuttlebit` (brinecrab variant) · (50,32) · patrol x 42–60 — brinecrab variant
  * `voltwheel` · (56,32) · patrol x 42–61
  * `broodcell` · (47,32) · stationary / own logic — anchored to the right bank floor
  * `droplatch` · (22,4) · stationary / own logic
* **Hazards:** 27 hazard-pool tiles (acid), 4 crumble tiles.
* **Bits placed (one-time, saved per tile):** (19,12) small (1), (27,9) small (1), (21,25) medium (5), (27,23) medium (5), (58,9) large (20), (60,9) medium (5), (5,32) small (1)
* **Tilemap** (64 cols × 36 rows; row 0 is the top; every row is exactly 64 characters):

```
##################################################...###########
##################################################...###########
##################################################...###########
#...................#####.......................-------........#
#..............................................................#
#..............................................................#
#..............................................................#
#...............B..............................................#
#...............B.............................------...........#
#...............B..............................................#
#.........................----.........B................########
#......................................B................########
#.................................###########..................#
..................----............###########..................#
...............................................................#
...............................................................#
###############................................................#
###############................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#.........-------..........cc..................................#
#..............................................................#
#....................cc........................................#
#..............................................................#
#...................................##.........................#
#.......................##..........##.........................#
#.....B...........##....##..........##......B.............B.....
#.....B...........##....##....##....##......B.............B.....
#.....B...........##....##....##....##......B.............B.....
##############~~~~~~~~~~~~~~~~~~~~~~~~~~~#######################
################################################################
################################################################
```

### 6.14 `bv_catwalk` — Drip Catwalk

* **Zone:** Brinevault (`brinevault`) · **Size:** 32×36 tiles (960×1080 px) · **Map grid:** gx 14.5, gy 3, 1×2 screens
* **On entering:** From a hatch above you land on a short ledge; a step down leads into a 2-tile crawlspace whose floor breaks over an acid trough. Past it a shaft drops into a lower hall where spikes line the ceiling, jellies drift, and a grate in the floor leads down to the Cistern.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `T` · top · cols 4–6 (y=0) · → `lw_rest.B` · **none** · spawn (5, 1)
  * `B` · bottom · cols 26–28 (y=35) · → `bv_cistern.T` · **BURST LINE** · spawn (27, 35)
* **Enemies** (type · tile x,y · behaviour note):
  * `brinejelly` · (10,20) · stationary / own logic
  * `brinejelly` · (20,27) · stationary / own logic
  * `droplatch` · (18,13) · stationary / own logic
  * `hopnode` (dripnode variant) · (25,32) · patrol x 23–30 (hoppers never hop onto the `B` opening: a hop needs footing at its landing column)
* **Hazards:** 11 ceiling-spike tiles, 21 hazard-pool tiles (acid). A one-way grate at row 31 (x16–18) stands in the acid trough so the large-bit pocket (x1–7) is left with an ordinary jump + Echo Jump.
* **Bits placed (one-time, saved per tile):** (11,4) small (1), (13,4) small (1), (28,8) medium (5), (20,16) small (1), (26,20) small (1), (3,32) large (20)
* **Tilemap** (32 cols × 36 rows; row 0 is the top; every row is exactly 32 characters):

```
####...#########################
#..............................#
#..............#################
#..............................#
#########......................#
###############......######....#
###############......######....#
###############~~~~~~######....#
###########################....#
###########################---.#
###########################....#
###########################....#
###########################....#
#.vvvvvvvvvvv..............---.#
#..............................#
#..............................#
#..............................#
#.................-----........#
#..............................#
#..............................#
#...B..........................#
#...B...................-----..#
#...B..........................#
#..............................#
#..............................#
#.................-----........#
#..............................#
#..............................#
#...........B..................#
#...........B...........-----..#
#...........B..........B.......#
#...............---....B.......#
#......................B.......#
########~~~~~~~~~~~~~~~###...###
##########################...###
##########################...###
```

### 6.15 `bv_rest` — Still Basin

* **Zone:** Brinevault (`brinevault`) · **Size:** 32×18 tiles (960×540 px) · **Map grid:** gx 15.75, gy 6, 1×1 screens · **SAFE ROOM** (no enemies)
* **On entering:** A dry basin above the acid line. A restore node glows green on a plinth. Pipes groan to the right where something heavy drags itself along the walls.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 12–14 (x=0) · → `bv_cistern.R` · **none** · spawn (2, 14)
  * `R` · right · rows 12–14 (x=31) · → `bv_corrosant.L` · **none** · spawn (29, 14)
* **Enemies:** none.
* **Hazards:** none.
* **Restore node:** tile (15, 13) (stands on (15,14)). Node id `node_bv_rest`.
* **Tilemap** (32 cols × 18 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............B...............#
#..............B...............#
#....B..................B......#
.....B..................B.......
.....B..................B.......
.....B......#######.....B.......
################################
################################
################################
```

### 6.16 `bv_corrosant` — Brine Keep

* **Zone:** Brinevault (`brinevault`) · **Size:** 48×24 tiles (1440×720 px) · **Map grid:** gx 16.75, gy 5.67, 1.5×1.33 screens · **BOSS ARENA**
* **On entering:** A tall vault whose walls weep acid. Five one-way grates hang at two heights; a hatch in the floor at the far right is sealed by a crust of brine. The Keeper uncoils from the ceiling as the door shuts.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 18–20 (x=0) · → `bv_rest.R` · **none** · spawn (3, 20)
  * `B` · bottom · cols 42–44 (y=23) · → `ns_base.T` · **none** · spawn (43, 23)
* **Enemies:** none.
* **Hazards:** none.
* **Boss:** Corrosant · fight bounds x 1–41 · sealed exits during the fight: `L`, `B` · ability pickup appears at (22,20)
* **Tilemap** (48 cols × 24 rows; row 0 is the top; every row is exactly 48 characters):

```
################################################
################################################
################################################
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#.............------........------.............#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#.......------......--------......------.......#
#..............................................#
......B................B.................B.....#
......B................B.................B.....#
......B................B.................B.....#
##########################################...###
##########################################...###
##########################################...###
```

### 6.17 `ns_base` — Spire Foot

* **Zone:** Nullspire (`nullspire`) · **Size:** 32×36 tiles (960×1080 px) · **Map grid:** gx 18, gy 7, 1×2 screens
* **On entering:** Violet dark, white static crawling on every edge. You land on a ledge; a hole at its right end drops into a sheer left-hand well where one-way grates zigzag back up. At the bottom a 3-tile tunnel runs under a huge black block; in its ceiling a smooth 10-tile shaft rises to a sealed upper gallery (wall-jump gate).
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `T` · top · cols 2–4 (y=0) · → `bv_corrosant.B` · **none** · spawn (3, 1)
  * `R` · right · rows 17–19 (x=31) · → `ns_climb.L` · **GRIP PROTOCOL** · spawn (29, 19)
* **Enemies** (type · tile x,y · behaviour note):
  * `glarewisp` · (5,14) · stationary / own logic
  * `glarewisp` · (5,24) · stationary / own logic
  * `droplatch` · (20,30) · stationary / own logic
  * `scuttlebit` (static-shot variant) · (18,19) · patrol x 13–23 — static-shot variant on the block top
* **Hazards:** 4 hazard-pool tiles (static).
* **Bits placed (one-time, saved per tile):** (4,12) small (1), (4,20) small (1), (22,31) medium (5), (14,18) medium (5), (29,18) small (1)
* **Tilemap** (32 cols × 36 rows; row 0 is the top; every row is exactly 32 characters):

```
##...###########################
#........#######################
#........###...................#
#........###...................#
######...###...................#
######...###...................#
#........###...................#
#........###...................#
#........###................B..#
#.-----..###................B..#
#........###....B...........B..#
#........###....B..............#
#........###....B..............#
#..-----.###....B..............#
#........###...................#
#........###...................#
#........###...................#
#.-----..###....................
#........###....................
#........###....................
#........###############....####
#..-----.###############....####
#........###############....####
#........###############....####
#........###############....####
#.-----..###############....####
#........###############....####
#........###############....####
#........###############....####
#..-----.###############....####
#..............................#
#....B.........................#
#....B........~~~~.............#
################################
################################
################################
```

### 6.18 `ns_climb` — The Null Spire

* **Zone:** Nullspire (`nullspire`) · **Size:** 48×72 tiles (1440×2160 px) · **Map grid:** gx 19, gy 4.22, 1.5×4 screens
* **On entering:** The empty interior of an inverted spire, four screens tall. A black spine splits it: the left face is crumbling grates and a slow lift; the right face is three sheer shafts stacked over a pit of static. Wisps hunt in the dark. Both faces meet at a crown of one-way grates under a hole in the sky.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 67–69 (x=0) · → `ns_base.R` · **none** · spawn (2, 69)
  * `R` · right · rows 34–36 (x=47) · → `ns_plunge.L2` · **GRIP PROTOCOL** · spawn (45, 36)
  * `T` · top · cols 40–42 (y=0) · → `ns_rest.B` · **GRIP PROTOCOL** · spawn (41, 1)
* **Enemies** (type · tile x,y · behaviour note):
  * `voltwheel` · (12,69) · patrol x 1–25
  * `glarewisp` · (14,45) · stationary / own logic
  * `glarewisp` · (36,30) · stationary / own logic
  * `glarewisp` · (30,8) · stationary / own logic
  * `droplatch` · (38,53) · stationary / own logic
  * `spitvalve` · (4,26) · stationary / own logic — faces right
  * `droplatch` · (44,19) · stationary / own logic
* **Hazards:** 2 floor-spike tiles, 12 hazard-pool tiles (static), 14 crumble tiles.
* **Moving platforms** (id · width · from (x,y) → to (x,y) · speed px/frame · end-wait frames; (x,y) = platform top-left tile; ping-pong; phase offset = index × 45 f):
  * `L1` · 3×1 · (9, 56) → (9, 40) · 1.5 · 30
* **Bits placed (one-time, saved per tile):** (40,66) large (20), (41,66) medium (5), (5,65) small (1), (13,61) medium (5), (4,37) small (1), (3,15) medium (5), (38,50) small (1), (37,24) medium (5), (44,20) small (1), (23,5) large (20)
* **Tilemap** (48 cols × 72 rows; row 0 is the top; every row is exactly 48 characters):

```
########################################...#####
#..............................................#
#..............................................#
#.....................................-------..#
#..............................................#
#.............................------...........#
#...................--------...................#
#.......................................##.....#
#.......................................##.....#
#.............-----.....................##.....#
#.....................####....B.........##.....#
#.....................####....B.........##.....#
#......#-----.........####....B.........##.....#
#......##.............####..............##.....#
#......##.............####..............##.....#
#......##.............####..............##.....#
####...##.............####............^^##.....#
####...##.............####............####..####
#......##.............####............####..####
#......##.............####.....................#
#......##.............####.....................#
#......##.............####................-----#
#......##.............####.....................#
#......##.............####.....................#
#.....................####.....................#
#.....................####..........ccc........#
#.....................####.....................#
#########.............####.....................#
#########.............####.....................#
#.....................####................-----#
#................ccc..####.....................#
#.....................####.....................#
#.....................####.....................#
#.....................####..........-----......#
#...........ccc.......####......................
#.....................####......................
#.....................####......................
#.....................####....######....########
#########.............####....######....########
#########.............####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##..B..#
#...B.................####........##....##..B..#
#...B.................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.............B.......####........##....##.....#
#.............B.......####......############cc##
#.............B.......######....############..##
#.....................######....##.............#
#.....................######....##.............#
#.....................######....##.............#
#.....................######....##.............#
#.....................######....##.............#
#..----...............######....##.............#
#.....................######....##.............#
#.....................######....##.............#
#.........................##....##.............#
#...........ccc...........##..B.##.............#
#.........................##..B.##.............#
#.........................##....##.............#
#.........................##....##.............#
#...-----.................##....##.............#
................................##......##.....#
................................##......##.....#
................................##......##.....#
##################################~~~~~~~~~~~~##
################################################
```

### 6.19 `ns_rest` — Crown Rest

* **Zone:** Nullspire (`nullspire`) · **Size:** 32×18 tiles (960×540 px) · **Map grid:** gx 20.1, gy 3.22, 1×1 screens · **SAFE ROOM** (no enemies)
* **On entering:** The open crown of the spire under a sky of static. A restore node sits among broken antenna-spires. The grate you climbed through is at the left; the far wall opens on a long plunge.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `B` · bottom · cols 4–6 (y=17) · → `ns_climb.T` · **none** · spawn (5, 17)
  * `R` · right · rows 12–14 (x=31) · → `ns_plunge.L` · **none** · spawn (29, 14)
* **Enemies:** none.
* **Hazards:** none.
* **Restore node:** tile (15, 14) (stands on (15,15)). Node id `node_ns_rest`.
* **Tilemap** (32 cols × 18 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#.........................B....#
#.........................B....#
#.........B...............B....#
#.........B....................#
#.........B.........B...........
#.........B.........B...........
#.........B.........B...........
####---#########################
####...#########################
####...#########################
```

### 6.20 `ns_plunge` — The Plunge

* **Zone:** Nullspire (`nullspire`) · **Size:** 32×54 tiles (960×1620 px) · **Map grid:** gx 21.1, gy 3.77, 1×3 screens
* **On entering:** A sheer drop down the outside of the spire. Ledges hold shallow static pools; droppers cling under every overhang; wisps rise to meet you. A side door mid-way leads back into the spire. The floor at the bottom funnels into a hatch lit red from below.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 2–4 (x=0) · → `ns_rest.R` · **none** · spawn (2, 4)
  * `L2` · left · rows 20–22 (x=0) · → `ns_climb.R` · **none** · spawn (2, 22)
  * `B` · bottom · cols 14–16 (y=53) · → `rw_gate.T` · **none** · spawn (15, 53)
* **Enemies** (type · tile x,y · behaviour note):
  * `droplatch` · (19,17) · stationary / own logic
  * `droplatch` · (18,32) · stationary / own logic
  * `glarewisp` · (8,14) · stationary / own logic
  * `glarewisp` · (16,36) · stationary / own logic
  * `broodcell` · (10,49) · stationary / own logic — anchored left of the chute
  * `hopnode` (nullnode variant) · (28,29) · patrol x 19–30
* **Hazards:** 20 ceiling-spike tiles, 23 hazard-pool tiles (static), 6 crumble tiles.
* **Bits placed (one-time, saved per tile):** (15,8) small (1), (16,8) small (1), (14,26) medium (5), (6,34) small (1), (18,44) medium (5), (3,49) large (20)
* **Tilemap** (32 cols × 54 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
#...........####################
............####################
...............................#
...............................#
###########....................#
###########....................#
#..............................#
#..............................#
#.............----.............#
#.........................B....#
#.........................B....#
#...................ccc........#
#..............................#
#.....................~~~~~....#
#.................##############
#.................##############
#...................vvvvvvvvv..#
#..............................#
#..............................#
.....B.........................#
.....B.........................#
...............................#
#########......................#
#########......................#
#..............................#
#..........................B...#
#...........----...........B...#
#..............................#
#...................~~~~~......#
#.................##############
#.................##############
#..................vvvvvvvvvvv.#
#..............................#
#..............................#
#...-----......................#
#..............................#
#..............................#
#..B........ccc................#
#..B...........................#
#...~~~~.......................#
###########....................#
###########....................#
#..............................#
#..............................#
#...............-----..........#
#...........................B..#
#...........................B..#
#..............................#
#...................~~~~~~~~~..#
##############...###############
##############...###############
##############...###############
##############...###############
```

### 6.21 `rw_gate` — Root Gate

* **Zone:** Rootwell (`rootwell`) · **Size:** 48×18 tiles (1440×540 px) · **Map grid:** gx 21.1, gy 6.77, 1.5×1 screens
* **On entering:** Crimson dark and gold filament. Great cable-roots thick as pillars hang from the ceiling. Every corrupted form of the kingdom stands guard here: plated walkers, a ram-beast, spitters on a pedestal and a hanging grate, a brood-cell by the wall, a root-bound patroller under the pedestal and a wisp hunting the dark.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `T` · top · cols 14–16 (y=0) · → `ns_plunge.B` · **none** · spawn (15, 1)
  * `R` · right · rows 12–14 (x=47) · → `rw_rest.L` · **none** · spawn (45, 14)
* **Enemies** (type · tile x,y · behaviour note):
  * `platewalker` (rootplate variant) · (10,14) · patrol x 4–18
  * `platewalker` (rootplate variant) · (32,14) · patrol x 28–38
  * `rambyte` (rootram variant) · (40,14) · patrol x 28–45
  * `spitvalve` (twin valve variant) · (23,10) · stationary / own logic — faces left
  * `spitvalve` (twin valve variant) · (33,7) · stationary / own logic — faces right
  * `broodcell` · (3,14) · stationary / own logic — anchored by the left wall
  * `droplatch` · (40,2) · stationary / own logic
  * `scuttlebit` (rootbound variant) · (23,14) · patrol x 19–27 — under the pedestal
  * `glarewisp` (rootwisp variant) · (38,9) · stationary / own logic — hunts the right half
* **Hazards:** none. The `T` arrival grate sits at row 4 (x12–18): the body clears the ceiling lip (rows 0–1), so the player walks off either end instead of having to drop through.
* **Bits placed (one-time, saved per tile):** (14,2) small (1), (16,2) small (1), (23,10) medium (5), (33,7) medium (5), (44,14) large (20)
* **Tilemap** (48 cols × 18 rows; row 0 is the top; every row is exactly 48 characters):

```
##############...###############################
##############...###############################
#.....B.....................B.............B....#
#.....B.....................B.............B....#
#.....B.....-------.........B.............B....#
#.....B.....................B.............B....#
#.....B...................................B....#
#.........................................B....#
#.............................-------..........#
#..............................................#
#..............................................#
#...................#######....................#
#...................#######.....................
#...............................................
#...............................................
################################################
################################################
################################################
```

### 6.22 `rw_rest` — Last Light

* **Zone:** Rootwell (`rootwell`) · **Size:** 32×18 tiles (960×540 px) · **Map grid:** gx 22.6, gy 6.77, 1×1 screens · **SAFE ROOM** (no enemies)
* **On entering:** A pocket of calm in the root-mass. The restore node here burns gold. Scrivvet has followed you all the way down and will not say how. Beyond the far door the floor thrums.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 12–14 (x=0) · → `rw_gate.R` · **none** · spawn (2, 14)
  * `R` · right · rows 12–14 (x=31) · → `rw_throne.L` · **none** · spawn (29, 14)
* **Enemies:** none.
* **Hazards:** none.
* **Restore node:** tile (9, 14) (stands on (9,15)). Node id `node_rw_rest`.
* **Vendor (Scrivvet):** tile (21, 14).
* **Tilemap** (32 cols × 18 rows; row 0 is the top; every row is exactly 32 characters):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............B...............#
#..............B...............#
#...........-------............#
#....B...................B.....#
.....B...................B......
.....B...................B......
.....B...................B......
################################
################################
################################
```

### 6.23 `rw_throne` — The Rootwell

* **Zone:** Rootwell (`rootwell`) · **Size:** 64×24 tiles (1920×720 px) · **Map grid:** gx 23.6, gy 6.44, 2×1.33 screens · **BOSS ARENA**
* **On entering:** A vast chamber around a sunken well of light. Cable-roots converge on a throne at the back wall where a crowned, seated mass waits. Two low grates flank the floor and one high grate hangs over the well. The door seals behind you.
* **Exits** (id · edge · opening · → target.exit · ability expected · arrival spawn tile):
  * `L` · left · rows 18–20 (x=0) · → `rw_rest.R` · **none** · spawn (3, 20)
* **Enemies:** none.
* **Hazards:** none.
* **Boss:** Kernauth · fight bounds x 1–62 · sealed exits during the fight: `L` · final boss, no pickup
* **Tilemap** (64 cols × 24 rows; row 0 is the top; every row is exactly 64 characters):

```
################################################################
################################################################
################################################################
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#.............................BBBB.............................#
#.............................BBBB.............................#
#...........................--------...........................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#.........------................................------.........#
#..............................................................#
#.............................BBBB.............................#
..............................B..B.............................#
........B.....................B..B.....................B.......#
........B.....................B..B.....................B.......#
################################################################
################################################################
################################################################
```

---

## 7. Enemies (`UB.Enemies`)

### 7.0 Shared rules
* Sizes are hit-box width×height in px; the sprite may overdraw by up to 4 px. Enemies stand with their hit-box bottom on the tile listed in the room's placement (tile (x,y) is the tile their feet occupy; they stand on (x,y+1)). Flyers are centred on the listed tile.
* **Contact damage** is in hearts and applies when the enemy's hit-box overlaps the player's body box and the player has no i-frames; the player then takes the hurt state of §3.2 (16 f hurt, 60 i-frames, knockback `(240 away, −300) × weight`, 6 f hitstop).
* **Hurt:** on taking damage an enemy flashes white for 4 frames and, if its `kbResist` is above 0, enters HURT (hitstun) for `10 + hitstop` frames (no movement, no attack) while the move's knockback `(kx, ky) × kbResist` is applied as its velocity (gravity continues for walkers/hoppers; flyers decelerate at 0.3 px/frame²). `kbResist`: scuttlebit 1.0 · hopnode 1.0 · driftmoth/brinejelly 1.0 · glarewisp 1.0 · spitvalve **0** · rambyte 0.5 (**0** during CHARGE) · platewalker 0.5 (**0** while guarding or bashing) · broodcell **0** · droplatch 1.0 · voltwheel **0** · motes 1.0. Enemies with `kbResist` 0 flash only and are never interrupted. Enemies never damage each other.
* **Death:** the killing blow's world hitstop is the move's hitstop **+2** (§3.4); 14-frame burst of 12 chips in the enemy's accent colour plus 2 px / 4 f shake; drops per §9.2; the `enemiesPurged` stat increments. Enemies are removed on death and respawn on room re-entry (bosses never).
* Enemies ignore `~` pools and `^`/`v` spikes. Walkers turn around at patrol bounds, walls, and ledge edges (no floor tile under their leading edge). Patrol bounds are inclusive tile x values.
* The player's **down-strike** bouncing off an enemy deals the down-strike damage and counts as a hit "from above" for Platewalker.
* **Zone variants** change only what the variant line says; everything else is inherited.
* All numbers in frames at 60 Hz (px/frame velocities; §3.0). Damage reference: Tessik's light chain deals 3/3/5, so an enemy with HP 6 dies to 2 lights, HP 9 to 3, HP 12 to 4, HP 15 to 5 (or 2 heavies), HP 18 to 6, HP 21 to 7. Overclock multiplies by 1.5.
* **Drawing:** every enemy is a rig of 6–14 shapes drawn with the two-pass ink/fill method of §11.2 at the colours listed per type (explicit hex per zone variant below; no `shadowBlur` on enemies — eyes use a translucent halo). Animation per §11.2.3: patrollers run (cyc 10), hoppers squash 6 f at (1.2,0.8) before a hop and stretch in the air, flyers bob 3 px on a 50 f cycle with wings flapping ±30° on an 8 f cycle, turrets rotate the nozzle toward the player, chargers lean 25° and leave dust, the shielded plate flashes `PAPER` when it blocks, motes are `blob` r 5 with a 2-circle trail, droppers hang by a `line` thread and stretch when dropping.
* **Tells** are drawn as the §11.2.4 telegraph pulse (`accent` stroke 4 px at α 0.8↔0.2, 8 f period) on the attacking part for the tell's duration.

### 7.1 SCUTTLEBIT — patroller
* **Zones:** Driftcache (base), Brinevault (Brinecrab), Nullspire (Static-shot), Rootwell (Rootbound).
* **Size** 26×18 · **HP** 6 · **Contact** 1 · **Bits** 2 (two small) · **Speed** 1.0 px/frame.
* **State machine:** `PATROL` (walk facing direction; on reaching a patrol bound, wall, or ledge edge → `TURN`) · `TURN` (6 frames, stopped, sprite flips on frame 3 → `PATROL`) · `HURT` (10) → `PATROL`.
* **Attack tells:** none; it is pure contact.
* **Visual:** a flat oval shell (ellipse 26×14) on six stubby legs (3 short lines each side, alternating 2-frame walk), two antenna dots that bob. Colours shell `#8fb6e8`, underside `#2a3a5c`, eye dots `#ffffff`. ~12 canvas ops.
* **Variants:** *Brinecrab* (Brinevault): HP 9, speed 1.4, shell `#4fae84`, underside `#0d2a20`. *Static-shot* (Nullspire): HP 9, speed 1.1, shell `#7a4fb8`; every 90 frames drops a 1-tile static spark at its feet that lasts 45 frames and deals 1 contact. *Rootbound* (Rootwell): HP 12, speed 1.2, bits 3, shell `#b32a2a`, outline glow `#ffcf5a`.

### 7.2 HOPNODE — hopper
* **Zones:** Driftcache, Loomworks, Brinevault, Nullspire.
* **Size** 24×24 · **HP** 9 · **Contact** 1 · **Bits** 3 (three small) · **Speed** hop vx 2.5 px/frame, vy −7.5 (gravity 0.45).
* **State machine:** `IDLE` (30 frames; faces the player if within 8 tiles) · `CROUCH` (12 frames: squash to 24×16, tell) · `HOP` (airborne ≈ 34 frames; direction = toward player if within 8 tiles else alternate; clamps to patrol bounds by reversing direction at a bound) · `LAND` (8 frames, stretch 20×28 on frame 1) → `IDLE`. `HURT` (10) → `IDLE`. Hopping into a wall stops horizontal motion.
* **Attack tells:** the 12-frame squash.
* **Visual:** a rounded cube (rounded rect 22×22, r 6) on two coiled spring legs (zig-zag lines, compress during CROUCH), a single large lens (circle r 6) with a highlight. Colours body `#b8733a`, lens `#ffb24a`, outline `#2e1a0e`. ~14 ops.
* **Variants:** Brinevault *Dripnode*: lens `#a8ffcf`, body `#1d4d3a`, HP 12. Nullspire *Nullnode*: hop vy −9.0 (higher), body `#2b1848`.

### 7.3 DRIFTMOTH — sine flyer
* **Zones:** Driftcache, Loomworks (base); Brinevault variant **Brinejelly**.
* **Size** 22×16 · **HP** 6 · **Contact** 1 · **Bits** 2 · **Speed** 1.2 px/frame horizontal.
* **Behaviour:** `FLY`: moves horizontally at 1.2 px/frame, y = spawnY + 45·sin(t·2π/90) px (amplitude 1.5 tiles, period 90 frames); reverses when 6 tiles from spawn x or on touching a wall. Never tracks the player. `HURT` (10, pushed back) → `FLY`.
* **Attack tells:** none.
* **Visual:** diamond body (4-point polygon 10×16), two triangular wings whose y-scale = sin(t·2π/12) (flap), two antenna lines. Colours body `#2a3a5c`, wings `#8fd3ff`, outline `#6c86b8`. ~10 ops.
* **Variant — Brinejelly (Brinevault):** size 20×24, HP 9, bits 3; moves **vertically** at 0.8 px/frame with x = spawnX + 30·sin(t·2π/120), reversing 4 tiles from spawn y or at tiles. Visual: a dome (half-circle r 10) with three dangling strands (wavy lines 12 px) and a glow; colours dome `#a8ffcf`, strands `#4fae84`, glow `#0d2a20`.

### 7.4 GLAREWISP — chase flyer
* **Zones:** Nullspire (base), Rootwell variant.
* **Size** 20×20 · **HP** 9 · **Contact** 1 · **Bits** 3 · **Speed** max 3.0 px/frame, accel 0.12 px/frame².
* **State machine:** `DRIFT` (hover at spawn, bob ±6 px over 80 frames; player within 9 tiles → `LOCK`) · `LOCK` (20 frames: brightens to white, emits an expanding ring, tell) · `CHASE` (150 frames: steer toward player centre: v += 0.12·normalize(toPlayer), |v| ≤ 3.0; passes through nothing: collides with `#` like a bouncing ball, reflecting velocity ×0.5) · `TIRED` (60 frames: moves toward spawn at 1.0 px/frame, dimmed, takes ×2 damage) → `DRIFT`. `HURT` (10) → continues previous state.
* **Attack tells:** the LOCK flash and ring; a faint whine (sine 1200→1800 Hz over 20 frames).
* **Visual:** a bright eye-orb (circle r 8 with pupil r 3 that looks at the player) with a tail of 3 fading circles at its last positions (r 5, 4, 3). Colours core `#e8e0ff`, halo `#7a4fb8`, pupil `#0a0612`. ~9 ops.
* **Variant — Rootwisp (Rootwell):** HP 12, max speed 3.4, core `#ffcf5a`, halo `#b32a2a`.

### 7.5 SPITVALVE — turret / spitter
* **Zones:** Driftcache, Loomworks (base); Brinevault *Acid valve*; Rootwell *Twin valve*.
* **Size** 30×30 · **HP** 12 · **Contact** 1 · **Bits** 5 (one medium) · **Speed** 0 (stationary; facing fixed by placement).
* **Projectile (glob):** 10×10, launched from the nozzle at vx = ±3.2 px/frame (facing), vy = −3.0, gravity 0.15 px/frame²; damage 1; lifetime 150 frames; destroyed on touching `#`/`-`/`c`. The player can destroy a glob with any attack (it pops, no bits, +2 Overclock meter); Korvask's Bulwark Catch destroys it (§4.2.5).
* **State machine:** `SCAN` (player within 11 tiles horizontally in the facing half-plane and within ±5 tiles vertically → `CHARGE`) · `CHARGE` (30 frames: nozzle swells 1.0→1.4 scale, ticking sound every 6 frames, tell) · `FIRE` (1 frame: spawn glob; recoil 4 px for 6 frames) · `COOL` (75 frames) → `SCAN`. `HURT` (10) interrupts CHARGE (restarts it afterwards).
* **Attack tells:** the 30-frame nozzle swell + ticking.
* **Visual:** a squat valve body (rounded rect 30×22 at the base), a pipe nozzle (rect 14×8 pointing in facing), a pressure dial (circle r 5 with a needle that sweeps during CHARGE), two bolt dots. Colours body `#5a3519`, nozzle `#b8733a`, dial `#ffb24a`. ~13 ops.
* **Variants:** *Acid valve* (Brinevault): glob leaves a 1-tile-wide, 6-px-tall acid puddle where it lands for 90 frames (hazard, damage 1, no respawn-teleport); body `#1d4d3a`, nozzle `#4fae84`. *Twin valve* (Rootwell): fires two globs, the second 20 frames after the first with vx ±2.4; COOL 60; body `#4d1018`, nozzle `#b32a2a`, dial `#ffcf5a`.

### 7.6 RAMBYTE — charger
* **Zones:** Loomworks (base), Rootwell *Rootram*.
* **Size** 40×28 · **HP** 18 · **Contact** 1 while pacing/stunned, **2** while charging · **Bits** 6 (one medium + one small) · **Speed** pace 0.8 px/frame, charge 6.0 px/frame.
* **State machine:** `PACE` (walk within patrol; player within 10 tiles horizontally and ±2 tiles vertically and in front → `SPOT`) · `SPOT` (24 frames: scrapes a foot — 3 dust puffs, head lowers; tell) · `CHARGE` (6.0 px/frame in facing direction; ends on hitting a wall or patrol bound → `STUN`; ends when the player is ≥ 3 tiles behind it → `BRAKE`) · `STUN` (45 frames: stars above head, takes ×1.5 damage, no contact damage increase) → `PACE` · `BRAKE` (20 frames, skids 8 px) → `PACE`. `HURT` during CHARGE does not stop the charge (it is armoured: knockback 0) but still deals damage.
* **Attack tells:** the 24-frame foot scrape + dust.
* **Visual:** low wedge body (polygon: a long trapezoid 40×20 with the front taller), a plated ridge (3 short arcs along the back), a blunt ram head (rect 10×14 at the front), four leg stubs (walk cycle 4 frames). Colours body `#5a3519`, plates `#b8733a`, ram head `#ffb24a`. ~15 ops.
* **Variant — Rootram (Rootwell):** HP 24, charge 7.0, SPOT 18 frames; colours body `#4d1018`, plates `#b32a2a`, head `#ffcf5a`.

### 7.7 PLATEWALKER — shielded
* **Zones:** Loomworks, Brinevault (base); Rootwell *Rootplate*.
* **Size** 30×36 (body) + shield 8×36 in front · **HP** 15 · **Contact** 1 · **Bits** 6 (one medium + one small) · **Speed** 0.7 px/frame.
* **Shield rule:** an attack whose hit-box centre is on the shield side of the Platewalker's centre x (and the shield is up) is **blocked**: 0 damage, "clank" SFX, a spark, the player is pushed back 3 px/frame for 8 frames, and the hit grants only 25% of its normal overclock gain. A **heavy** attack from the front **guard-breaks**: `STAGGER` (30 frames, shield swings down, knockback 4 px/frame for 6 frames) → `OPEN` (60 frames, shield down, takes normal damage from any side) → `WALK`. Hits from behind or from above (down-strike) always deal full damage.
* **State machine:** `WALK` (patrol at 0.7; turns toward a player who has been behind it within 4 tiles for 30 consecutive frames; player within 3 tiles in front → `BASH`) · `BASH` (tell 18 frames: shield raised 6 px; then lunge 2 tiles at 4 px/frame over 14 frames, shield deals 1 contact; recovery 24 frames) → `WALK` · `STAGGER`/`OPEN` as above. `HURT` (10) only when not guarding.
* **Attack tells:** the 18-frame shield raise.
* **Visual:** a tall rectangular plate (rect 8×36 with 3 rivet dots) held in front by two short arms, a stubby cylindrical body (rounded rect 24×22) with a single visor slit, two legs. Colours plate `#b8733a`, body `#5a3519`, visor `#ffb24a`. ~14 ops.
* **Variant — Rootplate (Rootwell):** HP 21, OPEN 45 frames; plate `#b32a2a`, body `#4d1018`, visor `#ffcf5a`.

### 7.8 BROODCELL — swarm spawner
* **Zones:** Brinevault (base), Nullspire, Rootwell.
* **Size** 36×36 · **HP** 21 · **Contact** 1 · **Bits** 8 (one medium + three small) · **Speed** 0 (anchored to the floor).
* **Motes:** 10×10, HP 3, contact 1, bits 1, lifetime 420 frames, speed 2.2 px/frame toward the player with a wobble (perpendicular sine amplitude 8 px, period 30 frames); fly through nothing (reflect off `#` ×0.5); max **6** alive per Broodcell; when the Broodcell dies all its living motes pop (no bits).
* **State machine:** `DORMANT` (player within 10 tiles → `PULSE`) · `PULSE` (40 frames: swells 1.0→1.25, pores brighten; tell) · `SPAWN` (30 frames: emits one mote on frames 0, 15, 30 from a random pore, each launched upward at 3 px/frame for 10 frames before homing) · `REST` (180 frames) → `PULSE` (skips SPAWN if 6 motes alive). Never moves; `HURT` has no knockback.
* **Attack tells:** the 40-frame swell.
* **Visual:** a lumpy sac (circle r 16 with 3 overlapping circles r 8 for lumps), three glowing pores (circles r 3), four root tendrils into the floor (short curved lines). Colours sac `#1d4d3a`, lumps `#0d2a20`, pores `#a8ffcf`. Nullspire: sac `#2b1848`, pores `#e8e0ff`. Rootwell: sac `#4d1018`, pores `#ffcf5a`, HP 27. Motes: a filled circle r 5 in the pore colour with a 2-circle trail. ~15 ops.

### 7.9 DROPLATCH — ceiling dropper
* **Zones:** Driftcache, Loomworks, Brinevault, Nullspire, Rootwell (universal; colours follow the zone's tile outline/accent).
* **Size** 26×22 · **HP** 9 · **Contact** 1, **2** during `DROP` · **Bits** 3 · **Speed** drop gravity 0.6 px/frame², scuttle 1.6 px/frame, climb 2.0 px/frame.
* **State machine:** `CLING` (hangs under a `#` tile, eyes closed; player's x within 2 tiles and below it → `ALERT`) · `ALERT` (18 frames: eyes open, body twitches ±2 px; tell) · `DROP` (falls with gravity 0.6 until it lands on footing — the first `#`, `-` or `c` under it, one-way grates included (§7.0); contact 2) · `SPLAT` (12 frames: squash 30×14, 4 dust particles) · `SCUTTLE` (120 frames: walks toward the player at 1.6, turning at ledges; contact 1) · `CLIMB` (rises straight up at 2.0 px/frame, passing up through one-way grates, until its top touches a `#` tile, then → `CLING` there; if it rises 20 tiles without a ceiling it clings to the first `#` tile it touches from the side; the room's edges count as walls, so it never walks out through an exit opening) · `HURT` (10) → previous state (a hit during CLING knocks it into `DROP` immediately).
* **Attack tells:** the 18-frame twitch with open eyes.
* **Visual:** a hanging teardrop (circle r 11 with a pointed top, drawn upside-down), a latch hook on top (small arc), two eyes (closed = lines, open = circles), three claws at the bottom (short lines). Colours body = zone tile outline, eyes = zone accent, claws = zone tile fill. ~13 ops.

### 7.10 VOLTWHEEL — bouncer
* **Zones:** Brinevault, Nullspire (base), Rootwell.
* **Size** 28×28 · **HP** 12 · **Contact** 1 · **Bits** 5 (one medium) · **Speed** 2.4 px/frame rolling.
* **State machine:** `ROLL` (moves horizontally at 2.4; reverses on walls or patrol bounds; rolls off ledges and keeps rolling after landing; every 150 frames, if the player is above it within 4 tiles horizontally → `HOP`) · `HOP` (vy −6.0, keeps vx; lands → `ROLL`). Immune to knockback; `HURT` (6 frames flash only). Leaves a spark particle every 4 frames.
* **Attack tells:** a 10-frame bright flash before `HOP`.
* **Visual:** a spoked wheel (circle r 13, 6 spokes rotating with distance travelled: angle = x / 13), a bright rim (stroke 3 px), an arc of static jumping between two spokes. Colours rim `#e8e0ff`, spokes `#7a4fb8`, static `#ffffff`. Brinevault: rim `#a8ffcf`, spokes `#4fae84`. Rootwell: rim `#ffcf5a`, spokes `#b32a2a`, speed 2.8. ~11 ops.


---

## 8. Bosses (`UB.Bosses`)

### 8.0 Shared boss rules
* A boss fight starts when the player's hit-box centre enters the arena's fight bounds (x range in tiles, listed per arena room). Sequence: exits seal (12 frames, shutters drop over the opening tiles, which become `#`) → intro title card (**150 frames**, §12.13: boss name line 1, epithet line 2, boss plays its idle/roar, `bossRoar` SFX on f8, player input ignored, boss music starts on f1) → fight. The camera uses boss-room rules (§11.3.1).
* Boss HP bar: §12.6 (bottom centre, 600 px wide, 20-frame lag ghost). Bosses have **no i-frames**: every hit counts; bosses are never knocked back or interrupted (`kbResist` 0) and only flash white 4 f (§3.4). Boss attacks carry three flags consumed by §4: `damage` (1|2), `unblockable` (not caught by Korvask's Bulwark Catch) and `projectile` (caught = destroyed). Flags per attack are in the table of §8.5.
* Damage reference: per-fighter numbers in §4 (lights 2–8, heavies 6–14, specials 6–16); Overclock multiplies by 1.5. The fight-length estimates assume Tessik landing ~1.6 light hits per second during punish windows and taking 0–3 hits total.
* Boss contact damage (touching the body) is 1 heart unless an attack says otherwise. Boss projectiles and hazards obey the same 60 i-frames as enemies.
* **Enrage** triggers once, when HP first drops to or below the listed threshold: 45-frame roar (boss invulnerable, `bossPhase` SFX, screen shake 9 px / 20 f, the HP bar takes its phase-2 colours, §12.6), palette shifts toward the zone accent, then the listed changes apply for the rest of the fight. **Fairness floor:** an enrage tell cut never takes a telegraph below **20 frames** (`max(20, tell − cut)`), so every attack keeps a readable warning.
* When a boss dies its shots in flight pop at once (nothing of a dead boss can hurt the player during the death animation or the reward), the defeat is recorded in `bossesDefeated` and the save is written right away; if the module is never collected (the player dies during the reward or quits), the arena reloads empty with the module waiting at its pickup tile.
* **Defeat:** boss HP ≤ 0 → 10-frame hitstop, `bossBurst` particles and shake 12 px / 40 f, the death animation listed, bits burst (§9.3: large coins + 3 sparks), `{NAME} PURGED` toast, then the ability module (drawn as the §11.3.7 core diamond in the zone `glow`) floats to the pickup tile and bobs (±4 px, 60-frame period) until touched. Touching it: 120-frame **pickup sequence** — the world keeps running but the player is invulnerable and locked; screen darkens to 40 %, the module orbits the player twice (r 40, 1 rev per 60 f), the ability banner of §12.7 slides in with the ability name, its control hint and flavour line, `ability` SFX chord; on f120 the ability is granted, the seal lifts (opening tiles return to `.`), the boss is recorded in `bossesDefeated`, and the save is written (the only save outside a restore node). Boss music crossfades to the zone song over 120 frames. Bosses never respawn.
* Death animations and the pickup sequence are fully skippable after 30 frames with any key (the grant/save still happens).

### 8.1 TALLOCK — Warden of the Stack (boss 1, `dc_sentinel`)
* **Arena:** `dc_sentinel`, fight bounds x 1–39, floor row 15, two grates at row 12 (x8–11, x28–31; 90 px above the floor, reachable with every fighter's plain jump — Echo Jump is this fight's reward). Sealed exit: `L`. Pickup tile (20,14).
* **HP 120** · **Size** 90×120 (hit-box) · **Phases:** 1 (+ enrage) · **Ground boss**, walks at 1.5 px/frame, cannot jump except in Stack Slam. Starts at x=25 tiles (centre), facing the player.
* **Intro title card:** `TALLOCK` / `WARDEN OF THE STACK`.
* **Pattern:** after each attack's recovery, `WALK` toward the player for 45 frames, then choose: player within 3 tiles → Slab Swing (60%) or Stomp Quake (40%); 3–6 tiles → Stomp Quake (50%) or Stack Slam (50%); > 6 tiles → Disc Toss (70%) or Stack Slam (30%). Never the same attack three times in a row.

| Attack | Tell (frames) | Active | Damage | Recovery | Movement / how to punish |
|---|---|---|---|---|---|
| **Slab Swing** | 30: raises the near slab-arm, arm rim glows accent | 12: arc hit-box 70×40 in front, sweeping top→bottom — its top edge runs from 90 px to 40 px above the floor over the 12 frames | 1 | 40 | Stationary. Dodge: a jump started mid-tell (≈ f10–18 of the 30) sails over the arc even with the back to a wall; a standing fighter is caught as it comes down. Punish: step behind it during the swing (it does not turn for 40 frames) and hit the back; or down-strike its top disc from a grate. |
| **Stomp Quake** | 36: rises 20 px onto its base disc's edge, dust ring | lands: two shockwaves (30×20 each) run left and right along the floor at 5 px/frame, lifetime 80 | 1 each | 50 | Stationary. Jump the wave (it is 20 px tall) or stand on a row-12 grate. Punish: 50 frames of recovery at melee range. |
| **Disc Toss** | 24: the top disc spins up (visible rotation, rising whir) | fires one disc 30×10 at 4.5 px/frame horizontal, vy −4, gravity 0.2; bounces once on the floor (vy ×−0.6), dies on the second contact or after 150 frames | 1 | 30 | Stationary. The disc can be destroyed by any attack. Punish: close in while the disc is in the air. |
| **Stack Slam** | 40: crouches (height ×0.8), base disc glows | jumps to the player's x recorded at tell end: 50-frame arc (vy −11, gravity 0.44, vx set to arrive); landing shock 40×30 on each side for 10 frames | 2 (shock), 1 (body while airborne) | 60 | Big movement. Dodge: move 3+ tiles from the recorded x during the arc. Punish: the longest window — 60 frames while the stack wobbles; heavy attacks here. |

* **Enrage at HP ≤ 36:** walk 2.2 px/frame, all tells −6 frames (Disc Toss stays at the 20 f floor), Disc Toss fires two discs (second 15 frames later, vx ×0.8), Stomp Quake waves 6.5 px/frame, WALK gap 30 frames.
* **Reward:** death animation 90 frames — discs drop one by one from the top with a thud and a 4-px shake each, the base disc cracks open revealing the module. Module → pickup tile (20,14). Banner: `ECHO JUMP ACQUIRED` / `Press JUMP again in the air` / `A second thought, taken mid-fall.` `L` unseals (and `R2` was never sealed: it is simply unreachable without the ability).
* **Visual:** a tower of six flat discs of decreasing width (ellipses 90, 84, 78, 72, 66, 60 wide × 18 tall, stacked with 2-px gaps so the stack visibly wobbles), two slab-arms (rects 16×50, hanging from the third disc, swinging with walk cycle), a single horizontal visor slit (rect 30×6) on the top disc that glows. Colours: discs `#2a3a5c`, disc rims `#6c86b8`, visor/glow `#8fd3ff`, arm slabs `#15213a`. Silhouette: tall tapering stack with two hanging bars; nothing round-bodied or humanoid. ~20 ops.
* **Fair fight length:** ~65 s (120 HP; ~55% of the fight is punish windows).

### 8.2 WEFTYR — The Shuttle That Would Not Stop (boss 2, `lw_weftyr`)
* **Arena:** `lw_weftyr`, fight bounds x 1–39, floor row 15, three grates at row 10 (x6–9, 19–22, 32–35). Sealed exits: `L`, `B` (the chute mouth tiles (42..44,17) become `#`). Pickup tile (20,14).
* **HP 180** · **Size** 110×50 (long horizontal spindle; hit-box 110×40) · **Phases:** 1 (+ enrage) · **Flying boss**, cruises at 3 px/frame between attack positions, ignores tiles except room bounds.
* **Intro:** `WEFTYR` / `THE SHUTTLE THAT WOULD NOT STOP`.
* **Pattern:** fixed cycle with random start: Thread Dash → Snare Line → Needle Rain → Thread Dash → Spool Spin → repeat; between attacks it `CRUISE`s 40 frames to the next start position. While a Snare Line exists it may only Thread Dash.

| Attack | Tell | Active | Damage | Recovery | Movement / punish |
|---|---|---|---|---|---|
| **Thread Dash** | 30: parks at the left or right arena edge at the player's current y (clamped rows 4–13), a taut thread line is drawn across the arena at that y, flickering | crosses the arena at 12 px/frame (≈100 frames) exactly along the drawn line (the shuttle snaps onto it as the pass begins — a far start cannot always reach it during the tell), hit-box 110×40 | 1 | 36: hovers at the far edge, drooping to y = row 12 | Dodge: change height (jump or drop) once the thread stops flickering (frame 30). Punish: it droops within melee reach at the far edge for 36 frames. |
| **Snare Line** | 24: hovers at the arena centre, both blade-arms spread | lays a horizontal trip-thread at knee height (8 px tall, its bottom 14 px above the floor — every standing fighter overlaps it, any jump clears it) across x 1–39 that persists up to 240 frames; contact = 1: the first fighter it catches takes 1 and the thread snaps | 1 | 20 | The line blocks ground movement across the arena: jump it or use the grates. Punish: it hovers low at centre for the 20-frame recovery and the following Thread Dash tell. |
| **Needle Rain** | 40: rises to row 3 at centre, shudders; six needle silhouettes blink at random x (≥ 2 tiles apart) above the arena | six needles (8×24) fall at 7 px/frame from row 0 at the marked x; each sticks in the floor as a 1-tile hazard for 90 frames | 1 (falling or stuck) | 50: descends to row 11 at centre | Dodge: stand between marks. Punish: 50 frames at row 11 — reachable from the centre grate or with an air attack. |
| **Spool Spin** | 30: a shadow ellipse appears on the floor at the player's x; the shuttle rotates to vertical | drops to the floor at that x and spins for 60 frames: hit-box 130×60, drifting toward the player at 2 px/frame | 1 | 60: lies on the floor, dizzy stars | Dodge: get 3+ tiles from the shadow or onto a grate. Punish: 60 frames on the floor = the best window; heavies and specials here. |

* **Enrage at HP ≤ 54:** Thread Dash becomes a **double pass** (after 20 frames at the far edge it dashes back at the player's new y, re-telling for only 15 frames), Needle Rain throws nine needles, cruise 4.5 px/frame, tells −5 frames (Snare Line stays at the 20 f floor).
* **Reward:** death animation 90 frames — the shuttle spins out of control, its thread unspools around the arena (drawn as loosening coils), then it drops and snaps in half. Banner: `BURST LINE ACQUIRED` / `Press DASH to lunge 6 tiles — on the ground or once in the air` / `Skip the frames you do not need.` `L` and `B` unseal.
* **Visual:** a long pointed spindle (polygon 110×30: pointed both ends, thicker at the centre), a bobbin at the centre (three concentric ellipses with diagonal thread hatching), two curved blade-arms (arcs, stroke 4) that fold during Thread Dash and spread during Snare Line, a single red lens near the front, a trailing thread (line to its last 4 positions). Colours: body `#5a3519`, blades `#b8733a`, thread/bobbin `#ffb24a`, lens `#ff5a3a`. Silhouette: a horizontal needle with two wings. ~22 ops.
* **Fair fight length:** ~95 s.

### 8.3 CORROSANT — Keeper of the Brine (boss 3, `bv_corrosant`)
* **Arena:** `bv_corrosant`, fight bounds x 1–41, floor row 21 (24 tall arena), grates at row 16 (x8–13, 20–27, 34–39) and row 11 (x14–19, 28–33). Sealed exits: `L`, `B` (hatch tiles (42..44,21..23) become `#` as a brine crust). Pickup tile (22,20).
* **HP 240** (shared by all segments) · **Size** head 50×40 + 7 body segments 30×30 following at 24-px spacing (total ≈ 260 px) · **Phases:** 1 (+ enrage with Flood) · **Surface crawler**: moves along the floor, walls and ceiling at 3.5 px/frame, head leading, body following the head's path. Hits on the head deal ×1.5 (rounded down, minimum +1) — any hit box that reaches the head's 50×40 box is a head hit, even where it also covers the trailing segment (segment 0 sits 24 px behind the head, inside its box); hits on segments alone ×1.
* **Intro:** `CORROSANT` / `KEEPER OF THE BRINE`.
* **Pattern:** chosen by where it is: on a wall → Wall Lunge (70%) or crawl to ceiling (30%); on the ceiling → Acid Spit (50%) or Ceiling Drip (50%); on the floor → Coil Sweep (100%), then crawl to a wall. Between attacks it `CRAWL`s 60–90 frames to the next surface position (telegraphed by direction).

| Attack | Tell | Active | Damage | Recovery | Movement / punish |
|---|---|---|---|---|---|
| **Wall Lunge** | 30: head rears back 20 px from the wall, jaw opens, three acid drops fall | lunges horizontally across the arena at 10 px/frame to a length of up to 14 tiles, head hit-box 50×40, body segments trail (1 contact) | 2 (head), 1 (body) | 40: retracts to the wall at 5 px/frame, body stretched across the arena | Dodge: jump over the lunge (the head is at the height it reared from; it picks the player's y ±1 tile at tell start). Punish: during the 40-frame retract the stretched body is hittable all along the floor/air; hit the head for ×1.5. |
| **Acid Spit** | 24: throat segment glows accent | spits three globs (10×10) at vx −3/0/+3 px/frame, vy +2, gravity 0.2; each leaves a 2-tile-wide acid puddle (6 px tall) for 180 frames (hazard 1, no teleport) | 1 | 30: hangs still on the ceiling | Dodge: stand between the three impact spots (they land ~4 tiles apart). Punish: with the player on a row-11 grate the head on the ceiling (rows 1–2) is within an air attack. |
| **Ceiling Drip** | 36: crawls to the player's x on the ceiling, body shudders; ten drip silhouettes blink below it across a 6-tile span | ten drips (6×12) fall at 6 px/frame, one every 6 frames, at random x in the span | 1 | 40: head droops 2 tiles down from the ceiling | Dodge: leave the 6-tile span. Punish: the drooping head reaches row 4 — hit it from a row-11 grate with jump attacks (×1.5). |
| **Coil Sweep** | 40: drops to the floor at the arena's left or right end and coils (segments bunch up) | sweeps the floor to the other end at 5 px/frame, body hit-box 1 tile tall along its whole length | 1 | 50: lies stretched along the floor | Dodge: be on any row-16 grate. Punish: 50 frames with the whole body on the floor — down-strikes from the grate chain into ground combos. |

* **Enrage at HP ≤ 72 — Flood:** roar 90 frames; then every 420 frames the arena's floor row (row 20, the tile row above the solid floor) becomes acid for 120 frames (drawn rising over 20 frames; hazard, −1 HP ignoring i-frames, the §3.3 freeze, respawn on the nearest row-16 grate instead of the exit). Tells −8 frames (Acid Spit stays at the 20 f floor), crawl 4.5 px/frame, Acid Spit puddles last 240 frames.
* **Reward:** death animation 120 frames — segments burst into bubbles from tail to head, the head sinks into a spreading puddle that dries into the module. Banner: `GRIP PROTOCOL ACQUIRED` / `Hold toward a wall in the air to cling · JUMP to kick off` / `The walls were never the problem.` `L` unseals; the brine crust over the hatch cracks (tiles (42..44,21..23) return to `.`).
* **Visual:** a flat triangular head (polygon 50×40, point forward) with a wide underslung jaw (second polygon that hinges open), four small eye dots in a row, seven body segments (rounded squares 30×30, each with a dorsal fin triangle), drip particles from every third segment. Colours: head `#1d4d3a`, segments `#0d2a20`, fins/eyes `#a8ffcf`, acid/jaw interior `#4fae84`. Silhouette: a long segmented line ending in a wedge, hugging the room edges. ~24 ops.
* **Fair fight length:** ~120 s.

### 8.4 KERNAUTH — The Root Process (final boss, `rw_throne`, 2 phases)
* **Arena:** `rw_throne`, fight bounds x 1–62, floor row 21, grates row 15 (x10–15, x48–53) and row 10 (x28–35). Sealed exit: `L`. No pickup: victory sequence (§12.16).
* **Intro (phase 1):** `KERNAUTH` / `THE ROOT PROCESS`. **Phase 2 card (60 frames, during the transition):** `KERNAUTH` / `UNBOUND`.

#### Phase 1 — Kernauth, Seated
* **HP 200** · **Size** 150×180 seated mass, centre x = tile 32 (960 px), bottom on the floor (rows 15–20); stationary. Weak point: the **chest core**, drawn as a 60 px circle centred at (960, 510) — rows 16–17, 120 px above the feet, a third of the way down the mass. Any hit box that reaches the **core band** — the mass's full width at that height, 150×60 (y 480–540) — is a core hit (×1): a plain jump's apex puts every fighter's air box on it from outside the body, so no fighter has to trade contact damage for full damage. Hits elsewhere on the mass (grounded lights at its base, a pogo on the crown) deal ×0.5.
* **Pattern:** every 50 frames of `IDLE` (cables sway, core pulses) pick: Cable Sweep (35%), Root Spikes (30%), Orbital Flare (20%), Summon (15%, only if < 4 motes alive). Never the same twice in a row.

| Attack | Tell | Active | Damage | Recovery | Dodge / punish |
|---|---|---|---|---|---|
| **Cable Sweep** | 30: one cable-arm (left or right, the side the player is on 75% of the time) twitches and glows along its length | the cable extends along the floor to the wall at 8 px/frame (hit-box 1 tile tall × its length), holds 10 frames, retracts over 20 | 1 | 30 | Jump over the cable tip as it passes, or stand on a grate. Punish: during the 30-frame recovery the core is exposed and the near cable is idle. |
| **Root Spikes** | 40: five floor spots glow (one at the player's x, four random, all ≥ 3 tiles apart) | spikes erupt 1 tile tall at the spots for 30 frames | 1 | 30 | Move off the marks (≥ 1 tile). Punish: the core during recovery. |
| **Orbital Flare** | 30: three orbs form in the crown | three 16-px orbs launch at 2.5 px/frame toward the player, homing with ≤ 1° turn/frame for 180 frames; HP 3 each (any hit pops them) | 1 | 30 | Pop them or out-run them (their turn rate loses a jumping player). |
| **Summon** | 30: the core darkens | two Motes (as §7.8) spawn from the crown; max four alive | 1 (mote) | 20 | Kill motes on the row-10 grate with air attacks. |

* At HP 0: **transition, 180 frames** — the mass splits down the middle, the crowned core rises to row 6, the throne collapses into the well (the `B` props at rows 17–20 burst into particles, the floor stays), screen shakes 8 px, phase 2 card. Player is invulnerable for the transition.

#### Phase 2 — Kernauth, Unbound
* **HP 240** · **Size** 70×70 flying core with a crown of five spikes and a 100-px cable tail (tail contact 1) · flies at 4 px/frame, ignores tiles except room bounds.
* **Pattern:** fixed loop with random start: Dive Bomb → Static Beam → Fragment Burst → Blink Slam → Static Beam → repeat; 40-frame `HOVER` between attacks (it hovers at row 5–7, moving toward the player's x at 2 px/frame).

| Attack | Tell | Active | Damage | Recovery | Dodge / punish |
|---|---|---|---|---|---|
| **Dive Bomb** | 30: rises 1 tile, a dotted aim line to the player's current position (locked at tell end) | dives at 13 px/frame to that point; on reaching the floor or the point: impact shock 120×30 for 10 frames, registered on the landing frame itself (hits resolve before body contact, so a fighter at the impact takes the shock, not the 1-heart body touch) | 2 (shock), 1 (body) | 50: sits on the floor, crown dimmed | Move 3+ tiles from the lock point. Punish: 50 frames on the floor — the main damage window. |
| **Static Beam** | 40: moves to the left or right wall at the player's y (locked at tell start, clamped rows 4–19), a thin guide line spans the arena | a beam 20 px tall across the full arena for 40 frames | 1 per contact (60 i-frames) | 40: drifts to row 8 | Change height (jump over / drop under). Punish: air attacks from the row-10 grate while it drifts at row 8. |
| **Fragment Burst** | 24: crown spikes fold inward | eight fragments (10 px) in a ring at 3.5 px/frame, lifetime 120 | 1 | 30 | Stand so a gap in the ring passes you (gaps are 45°); or shield with a heavy (destroys fragments). Punish: it hovers still for 30 frames at rows 5–7 — reachable from the centre grate. |
| **Blink Slam** | 12 fade-out + 20: reappears 5 tiles above the player, crown spins | slams down at 14 px/frame; landing shock 120×30 for 10 frames | 2 (shock) | 45 | Dash sideways during the 20-frame reappearance. Punish: 45 frames on the floor. |

* **Enrage at HP ≤ 60 — Panic Loop:** the HOVER gap is removed (attacks chain directly), Static Beam fires **twice** (the second at the player's new y, 30 frames apart, 15-frame tell), tells −8 frames (Fragment Burst and the Blink reappear stay at the 20 f floor), flight 5.5 px/frame, the tail grows to 160 px.
* **Defeat:** §12.16 (victory sequence). No ability module. `kernauth` is recorded in `bossesDefeated` and the save is written with `victory: true`.
* **Visual, phase 1:** a seated mass (rounded trapezoid 150×180 with a slight lean), a crown of seven spikes (triangles) on top, two cable-arms (thick wavy strokes, 12 px, with three knot circles each) resting on the floor to either side, the chest core (circle r 30 with a five-point star inside, pulsing scale 0.9–1.1 at 1 Hz), a lattice of thin lines across the mass. Colours: mass `#4d1018`, cables `#2a080c`, core `#ffcf5a`, crown `#b32a2a`. Silhouette: a crowned seated mountain with two arms on the floor.
* **Visual, phase 2:** the core (circle r 35 with the star, plus an inner white-hot circle r 14 `#fff4d6`), the five crown spikes orbiting it at radius 46 (rotation 2°/frame), a cable tail of six fading circles following its path. Same colours. Silhouette: a spiked sun with a tail.
* **Fair fight length:** phase 1 ~85 s + transition 3 s + phase 2 ~95 s ≈ **3 min**.

### 8.5 Attack flags (consumed by Korvask's Bulwark Catch and the hurt rules)

| Boss | Attack | damage | projectile (caught = destroyed) | unblockable |
|---|---|---|---|---|
| Tallock | Slab Swing | 1 | no | no |
| Tallock | Stomp Quake (shockwaves) | 1 | no | **yes** |
| Tallock | Disc Toss (disc) | 1 | **yes** | no |
| Tallock | Stack Slam (body airborne / landing shock) | 1 / 2 | no | shock **yes**, body no |
| Weftyr | Thread Dash (body) | 1 | no | no |
| Weftyr | Snare Line (persistent thread) | 1 | no | **yes** |
| Weftyr | Needle Rain (falling needle / stuck needle) | 1 | falling **yes** / stuck is a hazard | stuck **yes** |
| Weftyr | Spool Spin | 1 | no | no |
| Corrosant | Wall Lunge (head / body) | 2 / 1 | no | no |
| Corrosant | Acid Spit (glob / puddle) | 1 | glob **yes** / puddle is a hazard | puddle **yes** |
| Corrosant | Ceiling Drip (drips) | 1 | **yes** | no |
| Corrosant | Coil Sweep | 1 | no | **yes** |
| Corrosant | Flood | 1 | no | **yes** (hazard) |
| Kernauth 1 | Cable Sweep | 1 | no | no |
| Kernauth 1 | Root Spikes | 1 | no | **yes** |
| Kernauth 1 | Orbital Flare (orbs) | 1 | **yes** | no |
| Kernauth 1 | Summon (motes) | 1 | motes are enemies | no |
| Kernauth 2 | Dive Bomb (body / shock) | 1 / 2 | no | shock **yes** |
| Kernauth 2 | Static Beam | 1 | no | **yes** |
| Kernauth 2 | Fragment Burst (fragments) | 1 | **yes** (a heavy also destroys them) | no |
| Kernauth 2 | Blink Slam (shock) | 2 | no | **yes** |
| Kernauth 2 | tail contact | 1 | no | no |

Boss body contact (not listed) is 1 and catchable. A caught melee attack or body contact triggers Korvask's Counter-Slam normally (bosses take the 16 dmg, are not moved).

---

## 9. Pickups, economy & vendor (`UB.Pickups`, `UB.Vendor`)

### 9.1 Pickup types
| Pickup | Effect | Draw | Size | Physics / lifetime |
|---|---|---|---|---|
| **Bit, small** | +1 bit, +1 meter | filled hexagon, `BITS` fill, ink outline 2, spins (scaleX = cos(t/20)) | 8 px | scatters with vx ±(1.5–3.0), vy −4, gravity 0.3, bounces ×0.5 on tiles; after 20 frames it is magnetised toward the player within 60 px at 4 px/frame; dropped bits expire after 600 frames (blink the last 120); bits **placed in a map** never expire and are one-time (saved per tile). |
| **Bit, medium** | +5 bits, +1 meter | hexagon with an inner ring | 12 px | same |
| **Bit, large** | +20 bits, +1 meter | hexagon with inner ring and a `shadowBlur 10` glow | 16 px | same |
| **Heart** | heals 1 HP (no effect at max HP, still consumed); `heal` glitter ×6 | rounded "cell" shape (rect 10×14 with a notch) in `HEART`, ink outline 2 | 14 px | same scatter, no magnet, lifetime 600 |
| **Spark** (energy orb) | +25 energy (max 100 / 125 with Spare Cell) **and +10 Overclock meter** | 4-point star 10 px `ENERGY`, `shadowBlur 10`, bobs 3 px | 10 px | same scatter, magnet 60 px, lifetime 600 |
| **Overclock shard** | **+15 Overclock meter** (×1.5 with Hot Clock) | thin diamond 8×16, `METER` fill with a `METER_READY` core, spins | 8×16 px | same scatter, magnet 60 px, lifetime 600 |

### 9.2 Enemy drops
* On death every enemy drops its listed **bits** split into coins: 1 → 1 small; 2 → 2 small; 3 → 3 small; 5 → 1 medium; 6 → 1 medium + 1 small; 8 → 1 medium + 3 small; 12 → 2 medium + 2 small. (Rule: as many mediums as fit while leaving the remainder as smalls.)
* **Heart:** chance = 0 at full HP; otherwise 12% + 8% per missing heart, capped at 40%. Rolled once per kill (motes never drop hearts).
* **Energy orb:** 25% per kill when the player's energy < 50%, else 5%. Motes never drop orbs.
* **Overclock shard:** 8% per kill; **guaranteed** one shard from Rambyte, Platewalker, Broodcell and Voltwheel, in addition to the roll.
* Destroyed projectiles drop nothing (globs and boss projectiles grant +2 Overclock meter when popped). Motes drop 1 small bit.
* Bits placed in rooms (§6) are one-time: each collected tile is recorded in the save as `roomId:x,y` and never respawns.
* A **core** pickup (§6 hidden cores) is a 16 px diamond `CORE_HEART` with an inner ink diamond, `shadowBlur 16`, orbited by 3 dots (r 2, 1 rev / 2 s); touching it: +1 max heart and +1 current heart, +25 meter, `core` SFX, 24 glitter, the `CORE FOUND` banner (§12.7); recorded in `cores`.
* Hazard kills (an enemy pushed into nothing — they ignore hazards) cannot happen; enemies only die to the player.

### 9.3 Boss drops
Tallock 60 bits (3 large) · Weftyr 100 bits (5 large) · Corrosant 140 bits (7 large) · Kernauth none (victory). Every boss also drops **3 sparks**. Boss bits and sparks never expire until collected or the room is left.

### 9.4 Economy
* Bits placed in maps total (computed from the room data in §6): **331**. Clearing every enemy in every room once yields **245** (motes excluded); bosses add 300. A thorough first playthrough collects roughly 700–900 bits; a critical-path rush about 350. All three vendor items together cost 370.
* Bits persist through death (no corpse mechanic). The HUD shows the count top-right (§12.4) with a 10-frame pop on pickup. `bitsLifetime` (total ever collected) is a separate stat shown on the victory screen.

---

### 9.5 Vendor — Scrivvet

* **Who:** a jittery data-broker: a hunched figure the size of the player, wrapped in a cloak of cable scraps, with a lantern-eye on a stalk and six small hands that never stop sorting. Colours: cloak `#2a3a5c`, hands/stalk `#6c86b8`, lantern-eye `#ffcf5a`. Idle: hands shuffle (3-frame loop), eye tracks the player.
* **Where:** `dc_shrine` tile (21,14) and `rw_rest` tile (21,14). Same stock and purchase state in both (one-time purchases, saved).
* **Interaction:** stand within 1 tile and press Up/Interact (`▲ TRADE` prompt, §12.8): a shop panel (§12.17) lists the three items with price, a one-line effect, and `SOLD` once bought. Up/Down selects, Confirm buys, Back closes; the game is paused while the panel is open. Buying: bits bump down, `vendorBuy` chime, the item line greys out, the `{ITEM} PURCHASED` banner shows after the panel closes. Purchases are saved immediately (the second save trigger outside a node, with the boss pickup).
* **Lines (original; shown above the panel, random per opening):** "Everything down here was somebody's, once. Now it's mine. Now it's yours." · "You pay in bits because that's all that's left to pay in." · "The deeper you go, the cheaper I get. Don't ask why I'm down here." Can't afford: "Come back heavier." Sold out: "Nothing left you'd want. Nothing left I'd sell."

| Item | Price | Effect |
|---|---|---|
| **Spare Cell** | 90 bits | Max energy 100 → 125; energy orbs fill +25 as before (so specials can be used one more time per refill). |
| **Hot Clock** | 160 bits | Overclock meter gains ×1.5 from landed hits and shards. |
| **Deep Ping** | 120 bits | The map screen reveals every room of every zone the player has set foot in (all rooms of a visited zone become "discovered"), marks all restore nodes, and marks each **uncollected** hidden core with a `?` on its room. |


---

## 10. Progression proof & overview map

Abilities: **EJ** = Echo Jump (boss 1) · **BL** = Burst Line (boss 2) · **GP** = Grip Protocol (boss 3). Worst-case fighter for every claim below is Brackmaw (run 180, jump 96 px, Echo-Jump apex 192 px, dash 180 px, body 34×54) unless Korvask's 56 px height is the limit. Every claim was also checked mechanically (§10.5).

### 10.1 Overview map (schematic; `*` = boss arena, `(core)` = hidden core, `n` = restore node, `$` = vendor)

```
 DRIFTCACHE                                        LOOMWORKS
 [dc_wake n]--R/L--[dc_fall (core3: GP shaft)]
   start               |R (at its bottom)
                       v L
 [lw_shaft]--R2/L2(EJ shelf)--[dc_cross]--R/L--[dc_shrine n $]--R/L--[dc_sentinel * B1: ECHO JUMP]
   ^ climb                      |T/B (EJ slab)                               |R2/L (5-tile block: EJ)
   |                         [dc_loft (core1)]                                v
   |                                                                     [lw_hoist] (hoists over static)
   |                                                                         |B/T
   +---------R/L----------[lw_belts (core2: BL crawlspace)]--R/L--[lw_rest n]--R/L--[lw_weftyr * B2: BURST LINE]
                                                                    |B/T                     |B/T
 BRINEVAULT                                                         v                        v
                                                             [bv_catwalk]              [bv_sluice]
                                                           (BL crawlspace)           (BL crawlspace)
                                                                    |B/T (BL)                |R/L (BL)
                                                                    v                        v
                                                             [bv_cistern] <------------------+
                                                                    |R/L
                                                                    v
                                                             [bv_rest n]--R/L--[bv_corrosant * B3: GRIP PROTOCOL]
                                                                                             |B/T (hatch unseals)
 NULLSPIRE                                                                                   v
                                                                                      [ns_base (GP 10-tile shaft)]
                                                                                             |R/L (GP)
                                           [ns_rest n]--B/T(GP)--[ns_climb 48x72]<-----------+
                                               |R/L                   |R/L2 (loop C)
                                               v                      v
                                           [ns_plunge]<---------------+
                                               |B/T
 ROOTWELL                                      v
                                           [rw_gate]--R/L--[rw_rest n $]--R/L--[rw_throne * FINAL: KERNAUTH]
```

### 10.2 Exit pairs (25, all reciprocal; machine-checked for opposite edges, equal opening size, air openings and footing under every side-exit spawn)

| # | A | B | Ability to use A→B / B→A | Kind |
|---|---|---|---|---|
| 1 | `dc_wake.R` | `dc_fall.L` | none / none | critical |
| 2 | `dc_fall.R` | `dc_cross.L` | none / none | critical |
| 3 | `dc_cross.L2` | `lw_shaft.R2` | EJ (6-tile shelf) / EJ (one 4-tile hop in lw_shaft) | loop A |
| 4 | `dc_cross.R` | `dc_shrine.L` | none / none | critical |
| 5 | `dc_cross.T` | `dc_loft.B` | EJ (6-tile slab) / none | core 1 |
| 6 | `dc_shrine.R` | `dc_sentinel.L` | none / none | critical |
| 7 | `dc_sentinel.R2` | `lw_hoist.L` | EJ (5-tile block) / none | critical (zone 2 gate) |
| 8 | `lw_hoist.B` | `lw_belts.T` | none / EJ (row-4 grate) | critical |
| 9 | `lw_belts.L` | `lw_shaft.R` | none / none | loop A |
| 10 | `lw_belts.R` | `lw_rest.L` | none / none | critical |
| 11 | `lw_rest.R` | `lw_weftyr.L` | none / none | critical |
| 12 | `lw_rest.B` | `bv_catwalk.T` | none (drop) / none (launch from the row-4 ledge) | loop B |
| 13 | `lw_weftyr.B` | `bv_sluice.T` | EJ (hop the 1-wide wall) / none (row-4 grate) | critical |
| 14 | `bv_sluice.R` | `bv_cistern.L` | BL (crawlspace gap) / BL | critical (zone 3 gate) |
| 15 | `bv_cistern.T` | `bv_catwalk.B` | none / BL (to reach lw_rest) | loop B |
| 16 | `bv_cistern.R` | `bv_rest.L` | none / none | critical |
| 17 | `bv_rest.R` | `bv_corrosant.L` | none / none | critical |
| 18 | `bv_corrosant.B` | `ns_base.T` | none (hatch unseals after B3) / none (row-4 ledge) | critical |
| 19 | `ns_base.R` | `ns_climb.L` | GP (10-tile shaft) / none | critical (zone 4 gate) |
| 20 | `ns_climb.R` | `ns_plunge.L2` | GP / GP | loop C |
| 21 | `ns_climb.T` | `ns_rest.B` | GP / none | critical |
| 22 | `ns_rest.R` | `ns_plunge.L` | none / none | critical |
| 23 | `ns_plunge.B` | `rw_gate.T` | none / none (row-4 grate) | critical |
| 24 | `rw_gate.R` | `rw_rest.L` | none / none | critical |
| 25 | `rw_rest.R` | `rw_throne.L` | none / — (final) | critical |

### 10.3 Critical path, room by room (ability used at each gate)

**Tier 0 — no abilities (Driftcache → boss 1).** New game: `dc_wake` start tile (3,12) on the dais, restore node (5,12).

1. `dc_wake` → `R`. Walk off the dais (2-tile drop) past the tutorial scuttlebit; the exit is at floor level (rows 12–14).
2. `dc_fall` (`L` arrival (2,4) on the entry ledge x1–10, row 4) → `R`. Pure descent: entry ledge → grate row 8 (x13–16; fall) → straight down the well (x11–18) to the grate row 24 (x12–15) → ledge C (x18–23, row 26; fall right 3 tiles, 3 rows) → drop down the x13–17 gap to the grate row 40 (x16–19) (or onto the crumble planks at rows 31/34) → ledge row 42 (x22–30; fall right) → the floor row 49 at x22–30 → `R` (rows 47–49, floor level). The 5-wide spike bed at x12–16 on the floor is **left** of this landing and is never crossed (pogo-able if curious).
3. `dc_cross` (`L` arrival (2,14)) → `R`. Pit 1 (x14–18, spikes one tile **below** the floor): hop onto the row-12 grate (x15–17, 3 tiles up: 90 px ≤ 96) and off its right end to x19 — or jump it directly (Tessik 167 / Vellix 211 px reach ≥ 130/126 needed; Brackmaw's 112 < 118, so the grate). Mound x26–34 (2 up). Pit 2 (x40–43, 4 wide): needed `(5−1)·30 − 34 + 2 = 88 px` ≤ Brackmaw's 112 ✓ for everyone. `R` at floor level.
4. `dc_shrine` (flat; node (9,14); Scrivvet (21,14)) → `R`.
5. `dc_sentinel`: Tallock. Fight bounds x1–39; `L` seals; the row-12 grates (x8–11, x28–31) are the dodge platforms. Reward: **ECHO JUMP** at (20,14).

**Gate 1 — Echo Jump.** `dc_sentinel.R2` sits on the block x40–47 whose top is row 10, **5 tiles (150 px)** above the floor row 15. Single jump max 113.8 px (+6 px step-up) < 150: fails for every fighter. Echo Jump minimum 190 px ≥ 150 ✓ (Brackmaw 192). No `-`/`c` within 3 tiles of the block.

**Tier 1 — Echo Jump (Loomworks → boss 2).**

6. `lw_hoist` (`L` arrival (2,6) on the ledge x1–9, row 6) → `B`. Step down onto hoist **H1** (x11–13, rides rows 9→20, 1.0 px/f, wait 40). At its bottom, jump to **H2** (x19–21, rides rows 16→28) when H2 is within ±2 rows: gap x14–18 = 5 empty tiles, needed `(6−1)·30 − 34 + 2 = 118 px`; Brackmaw's flat reach is 112, so use the Echo Jump (airtime ≈ 0.9 s → 160 px) ✓. Ride H2 to row 28, then drop left into the chute x14–16 between the pillar rims (x13/x17, rows 30–32); the static pools (x4–12, x18–26, row 33) flank the pillar. `B` cols 14–16.
7. `lw_belts` (`T` arrival (11,1) falls onto the row-4 grate x8–14) → `R`. Drop to the floor. Pool 1 (x20–31): from x19 jump 3 tiles up onto belt **M1** (x21–23 → x28–30 at row 12, 1.5 px/f) — 90 px rise (single jump 96, Echo Jump for comfort), ride, hop down to x32. Pool 2 (x44–55): belt **M2** (x45–47 → x52–54, 2.0 px/f) the same way; the spitvalve on the row-9 grate (x48–50) fires left over the pool. Mound x60–70 (2 up). `R` at floor level.
8. `lw_rest` (flat; node (15,14)) → `R`.
9. `lw_weftyr`: Weftyr. Bounds x1–39; `L` and `B` seal; three row-10 grates. Reward: **BURST LINE** at (20,14).

**Gate 2 — Burst Line.**

10. `lw_weftyr.B`: hop the 1-wide wall x40 (rows 10–14, top at row 10: 150 px → Echo Jump) into the hatch pocket x41–46, drop into the chute x42–44. ✓ with EJ only.
11. `bv_sluice` (`T` arrival (3,1) lands on the row-4 grate x2–5; Down+Jump drops through to the crawlspace floor rows 8–9) → `R`. The crawlspace rows 6–7 (ceiling rows 3–5 at x9–30, so it cannot be walked over) has its floor **missing for 6 tiles (x15–20)** over the acid channel (row 15). This is the dash gate: a ground or hop dash of 180 px from the ledge edge lands on x21 (the body hangs over the edge by up to half its width; a 4–6 px hop plus the 6 px step-up adds ~25 px of tolerance for the heavies; Vellix's 210 px is trivial). Without the dash: the corridor is 60 px tall, so the tallest hop is 20 px (Vellix) and the airtime carries 129 px (Vellix, needs 164) or 45 px (Brackmaw, needs 148) — **fails**. Falling in: the cavity under the gap is sealed (rows 10–14 x21–24 solid) and floored with acid (row 15 x9–24) → −1 HP and respawn on the shelf, never a soft-lock. After the gap, walk x21–30, drop at x31–33 to the lower hall (floor row 15 x25–62) under the ceiling spikes (row 10 x35–43, 3 rows above the body) and walk to `R` (rows 12–14).

**Tier 2 — Echo Jump + Burst Line (Brinevault → boss 3).**

12. `bv_cistern` (`L` arrival (2,15) on the ledge rows 16–17 x0–14) → `R`. Fall right onto the row-24 grate (x10–16), then down to the left bank (floor row 33, x1–13). Cross the acid lake (x14–40, row 33) on the pillars: x18–19 (top row 30), x24–25 (29), x30–31 (31), x36–37 (28), then the right bank (x41+, row 32 standing). Gaps are 4 tiles (needed `(5−1)·30 − 34 + 2 = 88 px`), rises ≤ 3 tiles: hop-dash or Echo Jump for every fighter (Brackmaw: Echo Jump from the bank gives ≈ 0.6 s above a 3-tile rise → 108 px + dash 180). `R` is at floor level (rows 30–32).
13. `bv_rest` (flat; node (15,13)) → `R`.
14. `bv_corrosant`: Corrosant. Bounds x1–41; `L` and the brine-crusted hatch `B` (tiles (42..44,21..23) → `#`) seal; row-16 grates (x8–13, 20–27, 34–39) and row-11 grates (x14–19, 28–33). Reward: **GRIP PROTOCOL** at (22,20); the crust cracks.

**Gate 3 — Grip Protocol.**

15. `ns_base` (`T` arrival (3,1) on the ledge rows 4–5 x0–5, standing row 3) → `R`. Drop through the hole x6–8 (rows 4–5) into the left well (x1–8, rows 6–32); the one-way grates at rows 9/13/17/21/25/29 (x2–6 / x3–7) zigzag down (and back up: 4-tile rises → Echo Jump). Floor row 33. Walk right along the 3-tall tunnel (rows 30–32, x9–30) under the black block; hop-dash the static pool x14–17 (row 32; 36 px of headroom for Brackmaw, so the dash does the work). Stand under the shaft x24–27: **rows 20–29 = 10 tiles (300 px), sheer, no footing**. Echo Jump maximum 196 px < 300: **fails** for every fighter. With Grip Protocol: cling to x23 or x28 and wall-jump up to the block top (row 19), then `R` (rows 17–19). The upper gallery is walled off (x9–11, rows 1–19) from the arrival ledge, so the shaft is the only way.

**Tier 3 — all abilities (Nullspire → Rootwell → final boss).**

16. `ns_climb` (`L` arrival (2,69) on the floor; the static pit x34–45 at row 70) → `T`. Right face: walk the floor into shaft 1 through its doorway (x26–27, rows 67–69) → shaft 1 (x28–31, rows 52–69, 18 tiles; walls x26–27/x32–33) → slab row 51 → shaft 2 (x36–39, rows 39–50) → right ledge row 37 (also `R` → loop C) → grates rows 33/29/25(crumble)/21 → Echo Jump up through the hole x42–43 in the block rows 17–18 onto the shaft-3 floor (ledge row 17, x44–46) → shaft 3 (x42–46, rows 7–16; walls x40–41/x47) → crown → grate row 3 (x38–44) → `T` (cols 40–42). Left face alternative: grate row 66 → crumble row 62 → grate row 58 → lift **L1** (x9–11, rows 56→40, 1.5 px/f) → ledge row 38 → crumbles rows 34/30 → ledge row 27 (x1–8; the spitvalve guards it) → in through the doorway x7–8 (rows 24–26) and wall-jump the slot x1–6 (rows 18–26; walls x0/x7) → out through the hole x4–6 in rows 16–17 (the ledge row 16 is x1–3; cling the x7 face rows 12–15) → grates rows 12/9/6/5 → grate row 3. Every shaft is a sheer `#` wall pair ≥ 2 tiles wide with a walkable or jumpable way in at its foot (a single face can also be climbed by cling → wall jump → Echo Jump → re-cling, but no route depends on it).
17. `ns_rest` (flat; node (15,14); `B` is the hatch grate in the floor line at row 15 — the auto-launch on arrival lands on it, Down + Jump drops through) → `R`.
18. `ns_plunge` (`L` arrival (2,4)) → `B`. Pure descent (the only rises are ≤ 3 tiles): the ledge rows 5–6 → grate row 9 → crumbles row 12 → the pool shelf rows 13–14 → ceiling spikes rows 16/32 under the overhangs → `L2` ledge row 23 (loop C back into `ns_climb`) → grates rows 21/39/44 → the crumbles row 46 → the floor row 50 → the hatch x14–16 (rows 50–53).
19. `rw_gate` (`T` arrival (15,1) lands on the row-4 grate x12–18) → `R`. Flat gauntlet: two platewalkers, a rootram, twin valves on the pedestal (x20–26, rows 11–12) and the row-8 grate (x30–36), a broodcell by the left wall, a droplatch at (40,2). `R` rows 12–14.
20. `rw_rest` (flat; node (9,14); Scrivvet (21,14)) → `R`.
21. `rw_throne`: Kernauth, two phases. Victory (§12.16).

### 10.4 Loops, shortcuts, cores and nodes

* **Loop A (zones 1–2):** dc_cross → dc_shrine → dc_sentinel → lw_hoist → lw_belts → lw_shaft → dc_cross.L2. `lw_shaft` is climbed with Echo Jump (floor → grate row 28 is a 6-tile rise, or ride **S1** (x8–10, rows 30→10) up the left wall; grate row 9 → ledge row 5 is a 4-tile hop). Returning dc_cross → lw_shaft needs the 6-tile shelf (`dc_cross.L2`, rows 9–10 x0–8: 180 px, Echo Jump ≥ 190 ✓; from the row-12 grate x15–17 the hop is 3 tiles up and 7 across — Vellix's old 660 jump made this reachable with no abilities, hence the 615 ruling). This is how the player returns to Driftcache for cores 1 and 3 without re-crossing boss 1's arena (which is open after the boss anyway).
* **Loop B (zones 2–3):** lw_rest.B → bv_catwalk → bv_cistern → bv_sluice → lw_weftyr → lw_rest. `bv_catwalk` from above: the arrival ledge (x1–8, row 3) steps down into a 4-tall antechamber (x9–14, floor row 5), then the 2-tall crawlspace (rows 3–4, ceiling row 2) whose floor is missing for 6 tiles (x15–20) over acid: **Burst Line** (the ceiling at x≥15 is 90 px, so no height from the antechamber can be carried into the corridor; the gap maths is exactly `bv_sluice`'s). Falling in = acid → respawn on the ledge, which is a launch pad straight back up to `lw_rest`: no soft-lock, no sequence break. From below: chute auto-launch → grates rows 29/25/21/17 → the right shaft (x27–30) grates rows 13/9 → the crawlspace right end (x21–26, row 4; a 4-tile rise from the row-9 grate: Echo Jump) → dash the gap leftward → antechamber → ledge → `bv_catwalk.T`.
* **Loop C (zone 4):** ns_climb → ns_rest → ns_plunge → `ns_plunge.L2` (row 23 ledge) → `ns_climb.R` (right ledge row 37): reach the restore node and come back without re-climbing from the floor.
* `lw_weftyr` ↔ `bv_sluice` is two-way (the shelf's row-4 grate launches back up; the hatch pocket is left over the 5-tall wall with Echo Jump), so Loomworks' node and core 2 are reachable from Brinevault without crossing the catwalk.

| Core | Room / tile | Needs | Earliest | Route |
|---|---|---|---|---|
| 1 | `dc_loft` (27,12) | **EJ** | after boss 1 | dc_sentinel → dc_shrine → dc_cross: Echo Jump onto the hanging slab (rows 9–10, x54–60; 180 px from the floor, single max 113.8 fails), grate row 6 (3 up), grate row 2 (4 up: Echo Jump), up through `dc_cross.T`. In `dc_loft` the chute (x5–7, nine tiles left of the spike bed) auto-launches you onto the floor whichever way you hold — RIGHT lands on x8–17, LEFT on x1–4; the 7-wide spike bed (x18–24, row 14) is crossed on the two crumble planks (x19–20 and x23–24, row 11: a 4-tile rise then a 3-tile hop; the droplatch at (21,4) drops onto the planks) to the pedestal x26–28 (rows 13–14). Nobody can jump the 7-wide bed directly except by pogo. |
| 2 | `lw_belts` (93,6) | **BL** | after boss 2 | lw_weftyr → lw_rest → lw_belts: grate row 10 (x73–76; 5 tiles up: Echo Jump) and grate row 7 (x74–77) into the crawlspace (rows 5–6, ceiling row 4); dash the 6-tile floor gap (x84–89, rows 5–6 corridor, open below so a miss is only a fall) onto the ledge x90–94. The ledge is 8 tiles (240 px) above the floor with solid mass under it: Echo Jump maximum 196 cannot reach it from below. |
| 3 | `dc_fall` (24,4) | **GP** | after boss 3 | bv_corrosant → bv_rest → bv_cistern → bv_catwalk (dash) → lw_rest → lw_belts → lw_shaft → dc_cross → dc_fall (arrive at the bottom). Climb: floor → grate row 46 (x10–13; 4 up: Echo Jump) → ledge row 42 (x22–30) → grate row 40 (x16–19) → ledge E (x1–12, row 35; 4 up) → crumble row 34 (x14–16) → crumble row 31 (x8–10) → ledge C (x18–23, row 26) → grate row 24 (x12–15) → **cling** on ledge B's left face (x19, rows 14–19, 6 tiles sheer) and wall-jump onto ledge B's top (row 13, x19–29) → walk right into the shaft x27–29 (walls x26 rows 5–11 and x30 rows 2–13) → wall-jump **9 tiles (270 px)** to the pocket (x23–29, rows 2–4) → the core at (24,4) (the large bit (28,3) beside it). Echo Jump maximum 196 < 270: fails without Grip Protocol. |

Restore nodes (6): `dc_wake` (5,12) · `dc_shrine` (9,14) · `lw_rest` (15,14) · `bv_rest` (15,13) · `ns_rest` (15,14) · `rw_rest` (9,14) — zones have 2/1/1/1/1 (Driftcache two because it holds the start). Vendor: `dc_shrine` (21,14) and `rw_rest` (21,14).

### 10.5 Machine check

A kinematic reachability search over the final tilemaps (standing positions as nodes; jumps simulated as ceiling-capped parabolas with the pinned per-fighter physics, the 6 px step-up, Echo Jump at the apex or the lowest point, the dash as a zero-gravity segment at the apex, Grip Protocol as cling-and-climb on any `#` face; moving platforms as footing along their whole track; hazards impassable; chute auto-launch from the spawn tile) was run for all five fighters at all four ability tiers. Result, identical for all five fighters:

| Tier | Abilities | Rooms reached | Bosses reachable | Cores reachable |
|---|---|---|---|---|
| 0 | none | 5: dc_wake dc_fall dc_cross dc_shrine dc_sentinel | Tallock only | none |
| 1 | EJ | 13: + dc_loft lw_hoist lw_belts lw_shaft lw_rest lw_weftyr bv_sluice bv_catwalk (both crawlspaces entered, neither gap crossed) | + Weftyr | core 1 |
| 2 | EJ+BL | 17: + bv_cistern bv_rest bv_corrosant ns_base | + Corrosant | + core 2 |
| 3 | EJ+BL+GP | 23: all | + Kernauth | + core 3 |

Every restore node and both vendor tiles are reached at the tier in which their room first appears. Room count **23** (BRIEF: 20–24).

### 10.6 Fixes applied to the world data (relative to `design/world.md`; the tilemaps in §6 are otherwise byte-for-byte verbatim)

| # | Room | Change | Why |
|---|---|---|---|
| F1 | `dc_fall` | rows 12–13, x22–26: `#` → `.`; row 13, x19–21: `^` → `.`; rows 16–19, x19–21: `.` → `#` | Core 3's pocket+shaft was a sealed cavity (the block ran to row 13). Now ledge B's top (row 13, x19–29) joins the shaft bottom, and ledge B's left face (x19, rows 14–19) is a 6-tile cling wall reachable from the row-24 grate, so the Grip-Protocol climb is honest; the pocket stays a 9-tile wall-jump. |
| F2 | `ns_base` | rows 4–5, x6–8: `#` → `.` | The arrival ledge was a closed box (rows 4–5 solid across x0–11); nothing could enter the left well, so the final boss was unreachable. The x2–4 launch pad for `T` stays. |
| F3 | `bv_sluice` | rows 10–14, x21–24: `.` → `#`; row 15, x9–11: `#` → `~` | Vellix could fall through the dash gap, drift right under the crawlspace floor and Echo-Jump onto the lower hall (boss 3 without the dash). The cavity is now sealed and floored with acid: a miss is always a respawn on the shelf, never a trap. |
| F4 | `bv_catwalk` | row 2, x9–14: `#` → `.` | The ledge→crawlspace step was impassable for every body (standing feet y=120 under a corridor ceiling at y=90). x9–14 is now a 4-tall antechamber; the 2-tall crawlspace starts at the gap, so the dash gate is unchanged. |
| F5 | `lw_belts` | bits (10,4),(12,4) → (10,3),(12,3) | They were inside the row-4 platform tiles. |
| F6 | `ns_climb` | bit (40,50) → (38,50) | It was inside a wall. |
| F7 | `ns_plunge` | droplatches (24,17) → (19,17), (22,32) → (18,32) | They sat on ceiling-spike tiles; moved under the solid ceiling beside the spike rows. |
| F8 (QA 2) | `ns_climb` | rows 67–69, x26–27: `#` → `.`; rows 24–26, x7–8: `#` → `.`; rows 16–17, x4–6: `#` → `.`; rows 17–18, x42–43: `#` → `.` | Both §10.3 #16 routes were broken: shaft 1 was a dead-end pit walled off from the floor, the wall-jump slot x1–6 was a sealed cavity and shaft 3's floor was enclosed by the x40–41 wall, so the only way up was a 600 px single-face climb of the spine. Now shaft 1 has a doorway from the floor, the slot has a doorway from the ledge row 27 and an exit hole in its ceiling, and the shaft-3 floor opens over the grate row 21. |
| F9 (QA 2) | `dc_loft` | rows 15–17: chute x14–16 → x5–7 (`B` cols 5–7, spawn (6,17)) | The chute mouth was two tiles from the spike bed: holding RIGHT through the auto-launch (the natural input — the core is to the right) landed every fighter on the spikes. Nine tiles of floor now lie between the chute and the bed. |
| F10 (QA 2) | `bv_cistern` | row 8, x49–51: `.` → `-` (the grate is x46–51) | Arriving from `bv_catwalk.B` (loop B, tier 2) the row-3 grate is boxed in (x50–52 standing); a plain Down+Jump drop with LEFT held missed the row-8 grate by 4 px and dumped the player on the right bank, losing the gallery route until Grip Protocol. The grate now reaches under the standing span. |

No exit needed moving: all 25 pairs lined up as authored. No tilemap row had a wrong length.

---

## 11. Presentation (`UB.Render`, `UB.Draw`, `UB.Camera`, `UB.FX`, `UB.Backgrounds`, `UB.Tiles`)

### 11.0 Conventions

* Logical canvas **960×540**, origin top-left, `+y` down. Tile = **30 px** → 32×18 tiles fill
  one screen. All HUD coordinates below are in logical pixels.
* 60 Hz logic; render every `requestAnimationFrame` with `alpha = accumulator / (1/60)` for
  interpolation of player/enemy/camera positions only (particles and UI are rendered at their
  last logic state).
* Every colour is a string constant in `UB.Palette`; never inline hex in draw code.
* Fonts (system only, declared once in `UB.Fonts`):
  * `UB.Fonts.UI = '"Trebuchet MS", "Segoe UI", Arial, Helvetica, sans-serif'` — bold sans.
  * `UB.Fonts.MONO = '"Consolas", "Menlo", "DejaVu Sans Mono", "Courier New", monospace'`.
  * Sizes are given as `bold 28px UI`, `18px MONO` etc. Always set `ctx.textBaseline` explicitly
    (`'alphabetic'` for body text, `'middle'` for centred labels).
* Outline rule: every drawn body (tile edges, characters, enemies, pickups, HUD panels) gets a
  stroke in `UB.Palette.INK = '#141018'` at `lineWidth 3`, `lineJoin 'round'`, `lineCap 'round'`.
  Thin detail lines use `lineWidth 2`, hairlines `1`.
* The canvas element has `image-rendering: auto` (we draw vector shapes, not pixels). The
  canvas is scaled with CSS to fit the window keeping 16:9, letterboxed in `#0A080C`, and
  `ctx.setTransform(scale,0,0,scale,0,0)` is NOT used — the canvas stays 960×540 logical and
  CSS does the scaling. `devicePixelRatio` > 1: set `canvas.width = 960*dpr`,
  `canvas.height = 540*dpr`, `ctx.scale(dpr,dpr)` once, keep CSS size at the fitted size.
  Offscreen caches use the same dpr.

### 11.1 Art direction

#### 11.1.1 Look

"Ink and lantern": thick dark outlines, flat fills with one shade step, soft coloured glow
for anything powered, and a limited palette per zone. No gradients inside bodies except glow
halos. Shapes are slightly irregular (hand-drawn): every static outline is drawn with a
per-vertex jitter of ±1 px seeded by the vertex index (stable across frames). Nothing is ever
anti-aliased off; we rely on the browser's path rasteriser.

#### 11.1.2 Global palette (`UB.Palette`)

| Key | Hex | Use |
|---|---|---|
| `INK` | `#141018` | all outlines, text shadows |
| `PAPER` | `#F2EBDD` | menu text, HUD foreground |
| `PAPER_DIM` | `#A89F90` | secondary text |
| `HEART` | `#E8484F` | hearts fill |
| `HEART_EMPTY` | `#4A2A2E` | empty heart fill |
| `CORE_HEART` | `#F2B13C` | core (bonus) hearts fill |
| `ENERGY` | `#3FD3FF` | energy bar fill |
| `ENERGY_DIM` | `#174A5A` | energy bar trough |
| `METER` | `#B86BFF` | Overclock meter fill |
| `METER_READY` | `#FFFFFF` | ready pulse |
| `BITS` | `#8FE388` | bits icon/counter |
| `DANGER` | `#FF3B3B` | low-HP vignette, hurt tint |
| `PANEL` | `rgba(20,16,24,0.82)` | menu panel fill |
| `PANEL_EDGE` | `#F2EBDD` | menu panel stroke (lineWidth 3) |
| `SELECT` | `#FFD166` | menu highlight |
| `LOGO_A` | `#3FD3FF` | logo top gradient stop |
| `LOGO_B` | `#B86BFF` | logo bottom gradient stop |


#### 11.1.3 Zone palettes

The 11-key palette per zone is pinned in §5.1 (`UB.Palette.ZONES[zoneId]`): `bg0`, `bg1`, `bg2`, `tileFill`, `tileShade`, `tileEdge`, `fog`, `glow`, `hazard`, `accent`, plus `index` (1–5) for seeds. Boss rooms use their zone palette with `fog` alpha doubled and `bg0` darkened 20 %.

#### 11.1.4 Tiles

Tile types (§5.5 legend) map to drawing classes: `solid`, `platform` (one-way),
`spike`, `acid`, `static`, `crumble`, `mover` (drawn by the entity layer), `node`, `door`.

**Solid tiles** are drawn as merged regions, not individual squares:

1. **Fill pass.** For every solid tile draw `fillRect(x,y,30,30)` in `tileFill`. (Static layer.)
2. **Hatch pass.** For every solid tile, seeded RNG `rng = UB.Rand.seeded(roomId*7919 + tx*131 + ty)`:
   draw `2 + floor(rng()*3)` short strokes (`lineWidth 1`, `tileShade`, alpha 0.55), each
   from a random point inside the tile, length `6..12`, angle `-35° ± 10°`. Because the seed
   is `(room, tx, ty)` the hatching never flickers.
3. **Edge detection.** For each solid tile check its 4 neighbours. An edge is *exposed* if the
   neighbour is not `solid` (platforms, air, hazards all count as exposed). Build polylines:
   * Top exposed edges: stroke `tileEdge`, `lineWidth 2`, drawn 1 px below the outline (rim light).
   * All exposed edges: stroke `INK`, `lineWidth 3`, with the ±1 px vertex jitter seeded by
     `(roomId, tx, ty, side)`. Merge collinear consecutive edges into one `lineTo` run so a
     20-tile floor is one path, not 20.
   * Exposed outer corners get a small `arc` cap (radius 2) so the ink looks hand-joined.
4. **Pebble pass.** 1 in 6 exposed top edges (seeded) gets a 3–5 px ink pebble sitting on it.

**Platforms** (one-way): a rounded rect 30×8 at the tile top, fill `tileFill`, ink outline
3, a `tileEdge` rim 2 px, and 2 hatch strokes. Adjacent platform tiles merge into one bar.

**Spikes:** triangles base 15 wide, height 22, two per tile, fill `#C9C2B4`, ink outline 2,
tip highlight dot `PAPER`. Orientation: `^` points up (floor), `v` points down (ceiling).

**Acid pool:** filled rect from tile top+8 to tile bottom in `hazard` at alpha 0.75; surface
is a sine wave (`amp 2`, `wavelength 24`, phase `t*2`) stroked `lineWidth 2` in a lighter
hazard (`hazard` + 25 % lightness via `UB.Color.lighten`); 1 bubble per 2 tiles rising every
40 f (dynamic layer). **Static pool:** same body in `glow` at alpha 0.5; instead of a wave,
3 jittering 2 px zigzag lines per tile re-randomised every 4 f (dynamic layer).

**Crumble tile:** solid tile with 3 ink crack lines (seeded) and a `tileEdge` dashed rim
(`setLineDash([4,3])`); when triggered it shakes ±2 px for 20 f, then the dynamic layer draws
4 falling fragments (quads 10×10) for 30 f and the static layer is marked dirty and redrawn
without it (see 1.8).

**Door/exit** tiles: no drawing — the room edge is open; the transition handles it. A **sealed** boss exit draws a shutter: a `tileFill` rect over the opening tiles with 3 horizontal `INK` slats, dropping in over 12 f (§8.0).
**Zone props** (`B` tiles): §5.4, drawn into the static layer in `accent` with ink outlines.
**Moving platforms:** a §11.1.4 platform bar plus, per zone, a chain (Loomworks hoists, 6 ovals 5×4 in `accent` rising to the ceiling), a belt (Loomworks M1/M2: two `accent` rollers r 5 at the ends), a hoist rail (Loomworks S1), or a lift cage (Nullspire L1: two `tileEdge` rails and a `glow` dot).
**Restore node:** a 40 px tall obelisk on the tile: trapezoid base 24→16 wide, fill `accent`,
ink outline, a glow diamond 10×14 at its top that pulses alpha 0.6↔1.0 on a 1.5 s sine and
has `shadowBlur 18` in `glow`. Dormant (not yet used): glow alpha fixed 0.3, no blur.

#### 11.1.5 Background layers (per zone, procedural, cached)

Three layers, each an offscreen canvas 1280×720 (room-independent, zone-dependent), tiled
horizontally with `drawImage` at parallax offsets. Scroll factors: `bg0` 0 (static), `bg1`
0.25, `bg2` 0.5 (relative to camera). Vertical parallax uses half the horizontal factor.

Build (`UB.Backgrounds.build(zoneId)`, seeded RNG `zoneIndex*1000 + layer`):

* **bg0 (far):** fill `bg0`; vertical gradient to `bg1` at the bottom 40 %; 40 "dust"
  dots (r 1–2, `PAPER` alpha 0.06–0.12) seeded.
* **bg1 (far silhouettes):** fill nothing (transparent); silhouettes in `bg1`:
  * driftcache: 12 hanging cable curves (`bezierCurveTo`, `lineWidth 4–8`) from the top edge
    sagging 80–200 px, with 3–5 drip beads; 7 toppled rack silhouettes (rounded rects 40–90
    wide, 120–260 tall, leaning ±8°, 4 slot lines each) rising from the bottom.
  * loomworks: 10 horizontal pipes (rounded rects 24–40 tall) with elbow joints every 200–400 px
    and 6 vertical drops; 8 spool silhouettes (two discs 60–120 wide joined by a 40 px cylinder);
    5 hanging chains (zigzag polylines, 6–12 links) from the top edge.
  * brinevault: 12 rock pillars (tapering rounded rects 30–70 wide rising from the bottom, tops
    at 200–420 px) standing in a flat "lake" band across the bottom 90 px; 10 crystal clusters
    (3–5 thin triangles 10–30 wide, 40–120 tall) growing from pillar tops and the ceiling; 6
    dripping pipe stubs along the top edge.
  * nullspire: 18 inverted spires (tall thin triangles 20–50 wide, 120–300 tall, point DOWN)
    hanging from the top edge, a few tilted ±12°; 4 wide "void ribs" (arcs r 400–600,
    `lineWidth 6`) crossing the frame; every spire edge gets 3 short 1 px `glow` static ticks.
  * rootwell: 16 vein polylines (jagged, 6–10 segments) radiating from a centre point below the
    floor; 4 giant ribs (arcs r 300–500, `lineWidth 10`); 6 cable-root columns (wavy strokes
    `lineWidth 14`) with knot circles.
* **bg2 (mid):** silhouettes in `bg2` with `tileEdge` highlights, denser and smaller than bg1
  (same recipes at 0.5 scale, 1.5× count), plus zone props: driftcache rack status lamps (glow dots r 4
    with `shadowBlur 12`), loomworks warning lamps on the pipes (amber dots r 3, static) and
    belt rollers, brinevault embedded crystal clusters (3 triangles with a `glow` rim) and
    drip beads, nullspire static crawl (3 jittering 1 px `glow` ticks per spire edge, static
    layer only; the live static is the ambient layer), rootwell pulsing nodes (r 6, animated in
    the dynamic pass via a global sine, see 11.1.7).

Caches: `UB.Backgrounds.cache[zoneId] = {bg0,bg1,bg2}` built lazily on first entry to the
zone and kept for the session (5 zones × 3 × 1280×720 ≈ 55 MB at dpr 1 — acceptable; at dpr
≥ 2 build backgrounds at dpr 1 anyway and let `drawImage` upscale, it is a blurry backdrop by
design).

#### 11.1.6 Ambient dynamic layer (per zone, cheap, not cached)

Drawn every frame between bg2 and the tile layer, budget ≤ 60 primitives:

| Zone | Ambient | Count | Motion |
|---|---|---|---|
| driftcache | drifting dust motes r 1.5 `PAPER` α 0.25 | 24 | vx −6..6, vy −10, wrap |
| loomworks | floating sparks r 1–2 `glow` α 0.4 | 20 | rise from the floor channels, vy −40, sway ±6 px, life 50 f |
| brinevault | drips: 2×6 `hazard` beads | 12 | fall from random ceiling tiles at vy 240, splash into 3 dots on contact; plus 8 slow bubbles r 2–3 rising from pools |
| nullspire | static flecks 2×2 `glow` α 0.5 | 40 | teleport every 3 f (seeded by frame) |
| rootwell | ember motes r 2 `glow` α 0.35 | 24 | vy −14, sin drift ±8 px, wrap |

#### 11.1.7 Fog, vignette, glow

* **Fog**: after the entity layer, `fillRect` the whole screen with `zone.fog`. Then a
  radial gradient centred on the player (r 120 → 520) from transparent to `fog` at 0.5×
  alpha — a soft lantern falloff. Boss rooms: no lantern falloff.
* **Vignette**: a cached 960×540 canvas with a radial gradient from transparent (r 300) to
  `rgba(0,0,0,0.55)` (r 640). Drawn last in-game (before HUD). Built once.
* **Glow budget**: `shadowBlur` is expensive. Rules: at most **12** `shadowBlur` draws per
  frame; restore nodes, pickups and powered eyes use `shadowBlur 10–18`; the player's glow
  element uses 14; enemies never use `shadowBlur` (use a translucent halo circle instead).
  `UB.Draw.glow(fn, color, blur)` wraps `save/shadowColor/shadowBlur/fn/restore` and counts
  calls; past 12 it draws without blur.

#### 11.1.8 Performance plan (60 fps)

* **Static tile layer**: on room enter, allocate (or reuse) an offscreen canvas the size of
  the room in pixels (rooms are ≤ 4×3 screens = 3840×1620 max). Draw §1.4 passes once.
  Each frame: `drawImage(static, camX, camY, 960, 540, 0, 0, 960, 540)` — one call. Mark
  dirty when a crumble tile disappears; redraw only the 3×3 tile neighbourhood with
  `clearRect` + re-run the passes for those tiles.
* **Backgrounds**: per zone cache (§1.5). Draw = 3 `drawImage` calls (6 with wrap).
* **Entities**: drawn directly; cull anything whose AABB is > 80 px outside the camera.
* **Particles**: fixed pool of 512 structs in typed arrays (`Float32Array` x,y,vx,vy,life,
  maxLife,size; `Uint8Array` kind/color index). No allocation after boot.
* **Text**: HUD labels that change rarely (zone name, fighter name) are pre-rendered to tiny
  offscreen canvases; numbers are drawn live with `fillText` (monospace, so no reflow jitter).
* **Save/restore**: never more than 3 deep. Avoid `ctx.filter`, `globalCompositeOperation`
  other than `source-over` and `lighter` (used only for sparks and the Overclock aura).
* Allocation rule: no `new`, array literals, closures or string concatenation inside
  `update()`/`draw()` hot loops. Pre-size scratch arrays; use `UB.Pool`.

### 11.2 Character & enemy drawing method

#### 11.2.1 Principle

Every fighter and enemy is a **rig**: a list of segments drawn from primitives (ellipses,
rounded rects, wedges, bezier limbs) in body-local space (body centre = (0,0), `+x` = facing,
`+y` = down, per §3.0). Drawing is two passes over the same shape list:

1. **Ink pass**: every shape stroked in `INK`, `lineWidth 3` (limbs `lineWidth 5` so the 2 px
   limb line gets a 1.5 px ink border on each side).
2. **Fill pass**: every shape filled in its colour; limbs re-stroked at their own width/colour.

Drawing ink first and fills second gives the "coloured over the ink" look and avoids
seams. Glow parts (eyes, cores) are drawn in a third pass with `lighter` compositing and
no ink.

#### 11.2.2 Shared API (`UB.Draw`) — used by `UB.Characters`, `UB.Enemies`, `UB.Bosses`, `UB.HUD`

```
UB.Draw.begin(ctx, x, y, facing, scaleX, scaleY, rotDeg)   // save + translate(x,y) +
        // rotate(rot) + scale(facing*scaleX, scaleY). facing is +1/-1 (flip via scale(-1,1)).
UB.Draw.end(ctx)                                             // restore
UB.Draw.rig(ctx, shapes)        // runs ink pass then fill pass over an array of shape structs
UB.Draw.glowPass(ctx, shapes)   // 'lighter' pass for shapes flagged glow:true

// Shape structs (plain objects, pre-allocated per rig and mutated per frame — no allocs):
{k:'ellipse', x,y, rx,ry, rot, fill}
{k:'rrect',   x,y, w,h, r, fill}            // centred at x,y
{k:'poly',    pts:[x0,y0,x1,y1,...], fill}  // closed; vertex jitter optional (jit:1)
{k:'wedge',   x,y, len, wid, ang, fill}     // triangle pointing along ang (deg)
{k:'limb',    x0,y0, cx,cy, x1,y1, w, col}  // quadratic bezier limb, stroke w in col
{k:'line',    x0,y0, x1,y1, w, col}
{k:'arc',     x,y, r, a0,a1, w, col}        // stroke only
{k:'dot',     x,y, r, fill, glow:true}      // glow:true -> drawn in glowPass with halo r*2.5

// Helpers
UB.Draw.blob(ctx, x,y, rx,ry, fill)                  // ink+fill ellipse in one call (pickups, enemies)
UB.Draw.limb(ctx, x0,y0, x1,y1, bend, w, col)        // 2-joint limb; bend = perpendicular control offset
UB.Draw.outlinePoly(ctx, pts, fill, jitterSeed)      // poly with seeded ±1 px jitter
UB.Draw.smear(ctx, x,y, r, a0,a1, col, alpha)        // motion smear: 3 concentric arcs alpha*1, .6, .3
UB.Draw.shadowBlobUnder(ctx, x, feetY, w)            // ground shadow: ellipse w×6 INK alpha 0.35
UB.Draw.glow(ctx, fn, color, blur)                   // budgeted shadowBlur wrapper (§1.7)
UB.Draw.text(ctx, str, x, y, font, color, align, baseline, inkWidth)  // strokeText INK then fillText
```

#### 11.2.3 Procedural animation (shared `UB.Anim` helpers, all deterministic from frame counters)

| State | Formula (t = frames in state, `cyc` per fighter from §4.2 (Tessik 8, Brackmaw 12, Vellix 6, Orrubel 4, Korvask 10)) |
|---|---|
| Idle | bob `y += sin(t/40*2π)` (1 px); breathing `scaleY = 1 + 0.015*sin(t/40*2π)` |
| Run | `phase = (t % cyc)/cyc*2π`; front leg `dx = 8*sin(phase)`, back leg `-8*sin(phase)`; knee bend `6*max(0,cos(phase))`; body bob `y -= 2*abs(sin(phase))`; arm swing opposite to legs ±6 px; lean 10° forward (per sheet) |
| Jump | squash/stretch `(0.85, 1.15)` for 6 f from takeoff (§3.1), then stretch decays to 1 over 10 f; pose per sheet |
| Fall | `scaleY = 1 + min(0.12, vy/9000)` stretch with speed |
| Land | `(1.2, 0.8)` for 6 f, easing back with `1 - (t/6)^2`; dust puff (§3.6) |
| Attack | per-move: the weapon segment sweeps from `a0` to `a1` over the **active** frames; `UB.Draw.smear` behind it at alpha 0.5 for active + 2 f; on startup frames the segment is "wound" 20° the other way |
| Hurt | `(1.15, 0.85)` 4 f; whole rig tinted: draw the rig a second time with every fill replaced by `#FFFFFF` (frames 1–2) then `DANGER` (frames 3–6) at α 0.6. Shake: rig offset `±2 px` random (seeded by frame) for 6 f |
| Enemy hit flash | same white re-draw for 4 f (§3.4) |
| i-frames | skip drawing on frames where `(iFrames/4) % 2 == 1` (4 on / 4 off) |
| Death | 60 f: `scaleY → 0.3`, `rot → 25°`, every fill lerped to its grey (`UB.Color.desat`) over 40 f, alpha 1→0 over the last 20 f; 12 chips at f1 |
| Overclock transform | f1–8 white flash (full-screen `fillRect` α 0.6→0), ring r0→120 ink 4; f9–20 `scale 1.0→1.25` and palette crossfade via `UB.Color.mix(base, ocBase, k)`; aura (§3.6) starts f20 |
| Overclock revert | 10 f: scale 1.25→1.0, palette mix back, aura stops |

Facing flip: `UB.Draw.begin(..., facing, ...)` applies `scale(facing,1)`; text and HUD never
live inside that transform. Projectiles (Pulse Line, Ring, bolts) are drawn in world space
with their own facing.

#### 11.2.4 Enemy and boss rig rules (rigs are specified in §7 and §8)

* Each enemy type is one rig of 6–14 shapes, drawn with the same two passes, at most one
  glow dot (eye) — enemies never use `shadowBlur`.
* Zone variants are explicit recolours listed per type in §7 (hex values); eyes use the zone
  `glow` unless §7 says otherwise.
* Enemy animation uses the same `UB.Anim` table: patrollers run (cyc 10), hoppers squash
  before jumping (6 f at (1.2,0.8)) and stretch in the air, flyers bob (3 px, 50 f cycle) with
  wing flap (2 wedges rotating ±30° at 8 f cycle), turrets rotate a barrel wedge toward the
  player, chargers lean 25° and leave dust, shielded enemies carry a front `rrect` that flashes
  `PAPER` when it blocks, swarmers are `blob` r 6 with 2 antenna lines, ceiling droppers hang by
  a `line` thread and drop with stretch.
* Bosses: rigs of 20–40 shapes; always have a glow "weak core" dot that brightens on hit; boss
  hit flash is the same 4 f white re-draw; a boss **telegraph** is a 2-colour outline pulse
  (`accent` stroke 4 px at α 0.8↔0.2, 8 f period) on the attacking limb for its startup.

### 11.3 Feel

#### 11.3.1 Camera (`UB.Camera`)

```
target.x = player.x + facing * lookahead     // lookahead ramps 0 → 90 px over 20 f while running
                                             //   (|vx| > 60), back to 0 over 30 f when stopped
target.y = player.y                           // with a vertical deadzone: camera y only moves when
                                             //   player.y leaves [cam.y - 70, cam.y + 110]
cam.x += (target.x - cam.x) * 0.12           // per logic frame (≈ 0.22 s to 90 %)
cam.y += (dy) * 0.18                         // dy = distance outside the deadzone; falling fast
                                             //   (vy > 700) uses 0.30 so the ground is visible
clamp: cam.x ∈ [0, roomW - 960], cam.y ∈ [0, roomH - 540]   (rooms smaller than a screen centre)
```

* Wall cling: lookahead flips to the wall-away direction within 10 f.
* Camera is interpolated at render time with `alpha`; shake is added after interpolation
  and is NOT part of `cam` (so clamping never eats the shake). Final draw offset is rounded
  to integers to keep tile edges crisp.
* Boss rooms: lookahead 0; camera centres the midpoint between the player and the boss,
  clamped to the room.

#### 11.3.2 Room transitions

1. Player crosses an exit edge → `state = TRANSITION`, **freeze 6 f** (last frame held).
2. **Slide 18 f (0.3 s)**: the old room's last frame (captured with one `drawImage` of the
   main canvas into `UB.Render.snap`) slides out in the exit direction while the new room,
   fully set up and drawn, slides in from the opposite side; easing `1-(1-t)^3`.
   Player is placed at the target exit's arrival spawn tile (§6, §5.5) with velocity
   preserved on the axis of travel, and is invulnerable + uncontrolled for the slide.
3. **Settle 4 f**: no input; then play. Total 28 f.
4. The zone-name toast fires only when the zone id changes (§12.5); the first entry to a zone
   also shows the lore card (§12.18) after the toast.
5. A top arrival starts falling at 120 px/s; a bottom arrival is the chute auto-launch (§3.1).
   Respawn (death or hazard) uses a 20 f fade-to-black + 20 f fade-in instead.
6. `roomTransition` SFX on frame 1 of the slide.

#### 11.3.3 Hitstop

Rules are §3.0 and §3.4; presentation adds: during world hitstop the renderer still
runs — particles advance, shake decays, the HUD animates, and **the victim is drawn with its
hit flash and offset `±1 px` jitter** (seeded by frame) so the freeze reads as impact, not a
stall. Hitstop > 5 f also adds a 1-frame 2 % zoom (`scale 1.02` about the impact point) on
its first frame. Local hitstop freezes only the victim's animation counters.

#### 11.3.4 Screen shake (`UB.FX.shake(mag, frames)`)

Decaying random offset: each frame `ox = rand(-1,1)*mag*(remaining/frames)`,
`oy = rand(-1,1)*mag*0.6*(remaining/frames)`; overlapping shakes keep the larger
`mag*remaining` (no stacking). Settings `screenShake=false` → multiply mag by 0.

| Event | mag px / frames |
|---|---|
| light hit | 0 |
| L3 / heavy hit | 3 / 6 |
| special hit | 4 / 8 |
| ultimate hit | 8 / 14 (Tessik beam 6/10, Brackmaw quake 10/16 per §4) |
| player hurt | 5 / 10 |
| enemy killed | 2 / 4 |
| Overclock activate | 6 / 12 |
| land from vy ≥ 900 | 2 / 4 |
| down-strike pogo | 2 / 3 |
| boss slam / roar | 7 / 12 |
| boss hit (by player) | 1 / 3 |
| boss phase change | 9 / 20 |
| boss death | 12 / 40 (then a 60 f slow fade to 0) |
| spike/acid hit | 4 / 8 |
| room transition | 0 |

#### 11.3.5 Damage flash & low-HP

* Player hurt: entity white/red re-draw per §2.3; plus a full-screen `DANGER` `fillRect` at
  α 0.25 on the hit frame fading to 0 over 6 f.
* **Heartbeat vignette** at HP ≤ 1 (or ≤ 2 when maxHearts ≥ 7): a second vignette layer in
  `DANGER`, radial from r 260 to r 640, alpha `0.10 + 0.14 * pulse` where
  `pulse = max(0, sin(t/36*2π))^3` (a "lub" every 0.6 s); a low thump SFX (§13.8 `heartbeat`)
  each pulse peak, at most once per 36 f.
* Boss hit: boss rig white 4 f; boss HP bar chunk flashes `PAPER` for 8 f (§12.6).

#### 11.3.6 Particles (`UB.FX`, pool 512; per-kind `size, life, gravity, drag, colour`)

| Kind | Spawn | Count | Life f | Motion | Draw |
|---|---|---|---|---|---|
| `spark` | light/heavy/special/ultimate hits | 4 / 8 / 10 / 16 (§3.4) | 14–22 | speed 180–420 px/s in a 100° cone away from the attacker, gravity 600, drag 0.9 | 2 px-wide line from pos to pos−v·0.02, colour = attacker's affinity glow, `lighter` |
| `ring` | L3/heavy (1), ultimate (2), Overclock (1 r120) | 1–2 | 12 | radius 0→R (R 30 for hits) ease-out | ink circle `lineWidth 3`, α 1→0 |
| `chip` | enemy killed 12, player hurt 6, death 12, Brackmaw heavy 5 | as listed | 30–45 | speed 120–300, gravity 900, bounce once on tiles (vy *= −0.4) | 4×4 rrect, entity shade colour, α fades last 10 f |
| `dust` | land (6), run step (1 per stride plant, 2 for Brackmaw/Korvask), dash start (5), wall slide (1 per 4 f) | as listed | 18–28 | vx ±40, vy −30, gravity 0, grows r 2→6 | circle `PAPER` α 0.35→0 |
| `glitter` | bit pickup (6), spark pickup (10), core pickup (24) | as listed | 25–40 | radial burst 60–160 px/s, gravity −80 (floats up), drag 0.92 | 4-point star 3–5 px in `BITS` / `ENERGY` / `CORE_HEART` |
| `bitDrop` | enemy death | per §9.2 | until picked | gravity 900, bounce 2×, magnet to player within 90 px at 400 px/s | the bit pickup (§9.1 icon) |
| `bossBurst` | boss death | 60 chips + 6 rings (r 0→200 every 10 f) + 40 sparks | 60–90 | chips as `chip` with speed 300–600 | plus 90 f white-out α 0→0.9→0 |
| `aura` | Overclock active | 1 per 3 f (continuous) | 30 | rises from a random point on the body box bottom edge, vy −60, sways ±3 px | 3 px dot in `ocPalette.glow`, `lighter`, α 0.8→0; plus a body halo ellipse (box w×h × 1.6) in `ocPalette.glow` α 0.12 pulsing 0.08↔0.16 at 20 f |
| `steam/spore/dust ambient` | §1.6 | — | — | — | — |
| `pogo` | down-strike hit | 5 sparks downward + 1 ring r 20 | 12 | | |
| `heal` | restore node use | 16 glitter + 4 rising rings | 40 | | `CORE_HEART`→`PAPER` |
| `telegraph` | boss startup | 6 dots pulled inward to the limb | 10 | | `accent` |

Particles never collide with entities. Max concurrent is the pool; when full, the oldest
`dust`/`aura` is recycled first.

#### 11.3.7 Pickup presentation

* **Bit**: hexagon r 6, fill `BITS`, ink 2, spins (scaleX = cos(t/20)) ; `+1` floats up
  12 px over 20 f in `bold 12px MONO BITS` on pickup.
* **Spark (energy)**: 4-point star 10 px `ENERGY`, `shadowBlur 10`, bobs 3 px.
* **Core**: 16 px diamond `CORE_HEART` with an inner ink diamond, `shadowBlur 16`, orbited by
  3 dots (r 2, 1 rev / 2 s); on pickup the ability-style banner (§12.7) reads `CORE FOUND`.
* **Heart**: the §9.1 cell shape in `HEART`, bobs 2 px; `heal` glitter on pickup.
* **Shard**: thin diamond 8×16 `METER` with a `METER_READY` core, spins (scaleX = cos(t/16)).
* **Ability module** (boss reward): the Core diamond drawn in the zone `glow` at 1.5× with `shadowBlur 18`.
* **Boss shutter, moving platforms, props:** §11.1.4.

---

## 12. HUD & screens (960×540) (`UB.HUD`, `UB.Screens`)

All HUD elements are drawn after the vignette, in screen space, no camera transform, no
shake. Panels use `PANEL` fill + `PANEL_EDGE` stroke `lineWidth 3`, corner radius 10, with a
hand-drawn ±1 px vertex jitter (seeded by panel id, static).

### 12.1 Hearts — top-left

* Origin (24, 22). Each heart cell 30×26, pitch 32 px, in a row (max 9: 6 base + 3 cores).
* **Base heart** shape (hand-drawn): two `arc`s r 7 at (−7,−3) and (7,−3) plus a `poly` to the
  tip (0, 12); fill `HEART` (full) / `HEART_EMPTY` (empty), ink 3.
* **Core hearts** (the +1s from hidden cores) are drawn as **diamonds** 24×26 (`poly`
  (0,−13),(12,0),(0,13),(−12,0)) filled `CORE_HEART`. HP is one integer: the row shows
  base-shaped cells for indices `< baseHearts` and diamond cells for `≥ baseHearts`; cells with
  index `< hp` are full. Cores are therefore the last cells in the row and empty first.
* Losing a heart: that cell scales 1.4→1 over 8 f and emits 3 `chip`s; gaining one (restore
  node/core) scales 0→1.2→1 over 12 f with 6 `glitter`.
* When hp ≤ 1 the full cells pulse scale `1 + 0.08*pulse` in sync with §3.5.
* **Occlusion:** the hearts/energy/meter block (24,22)–(210,115) fades to α 0.35 (eased 0.08 per frame) while the fighter's body box sits behind it in screen space — the camera is pinned to a room's top-left corner on the `dc_fall.L`, `ns_plunge.L`, `bv_sluice.T`, `bv_catwalk.T` and `ns_base.T` arrivals — and back to α 1 once clear. The bits counter and the rest of the HUD never fade.

### 12.2 Energy bar — under hearts

* Rect (24, 56) size 180×12, radius 6; trough `ENERGY_DIM`, fill `ENERGY` width
  `180*energy/100`, ink outline 3. A 1 px `PAPER` tick every 25 energy.
* Fill eases toward the true value at 0.25/frame; on spend, a `PAPER` "ghost" segment of the
  spent width fades over 15 f. Insufficient-energy press: bar flashes `DANGER` 2 f and shakes
  ±2 px for 6 f (with the `deny` SFX).
* Label `ENERGY` in `bold 10px UI PAPER_DIM` at (24, 80).

### 12.3 Overclock meter — under energy

* Rect (24, 88) size 180×8, radius 4; trough `#2A1A3A`, fill `METER` width `180*meter/100`.
* Label `OVERCLOCK` `bold 10px UI PAPER_DIM` at (24, 108); when ready the label text becomes
  `OVERCLOCK — READY  [V]` (or the gamepad glyph `LT`) in `SELECT` and pulses alpha
  0.6↔1.0 at 30 f; the bar gets a travelling highlight (a 24 px wide `METER_READY` α 0.5
  band sweeping left→right every 45 f) and a `shadowBlur 12` glow in `METER` (counts
  toward the budget).
* During Overclock the bar drains (it is the timer, §3.9) in `ocPalette.glow` of the
  fighter and the label reads `OVERCLOCKED`; last 3 s (180 f): bar blinks 6 f on / 6 f off.

### 12.4 Bits counter — top-right

* Icon: hexagon r 8 `BITS` ink 2 at (896, 32). Count right-aligned at x 884, y 32,
  `bold 20px MONO PAPER`, ink stroke 3 (text ink via `UB.Draw.text`).
* On pickup the number pops scale 1.3→1 over 10 f.

### 12.5 Zone-name toast

* On zone change, after the transition settles: centred text at (480, 150):
  `bold 34px UI PAPER` zone name (letter-spacing: draw each char with +2 px advance), with
  the zone blurb (§15.4) below at (480, 184) in `16px MONO PAPER_DIM`.
* Timeline 150 f: fade in 20 f (α 0→1, y 160→150), hold 100 f, fade out 30 f. A 2 px
  `tileEdge` rule 260 px wide draws out from the centre under the name during the fade-in.
* **Timers and overlays:** the toast, banner (§12.7) and boss-card (§12.13) timers freeze with the world while an
  overlay (pause/map/settings/shop/lore) is open in play and resume where they were. One-line system toasts (§15.8:
  `SAVE ERASED`, the gamepad toasts, the storage warning) are drawn on every screen — title, select, game over,
  victory — and above an open overlay (`Gamepad disconnected — paused` stays up over the pause menu); the zone
  toast and banners belong to play and sit under an overlay.

### 12.6 Boss HP bar — bottom centre

* Visible while a boss is active (from its intro to its death). Panel rect (180, 486) size
  600×30 radius 8; trough `#2A1A24`; fill `DANGER`→`#FF8A5C` horizontal gradient, width
  `596*hp/maxHp` inset 2 px; ink outline 3. 10 `PAPER` α 0.3 segment ticks.
* Name above at (480, 476) `bold 18px UI PAPER` centred, with the boss subtitle (§15.6) in
  `12px MONO PAPER_DIM` right after a `·`.
* Damage: a `PAPER` "lost chunk" lingers 20 f then shrinks. Phase 2: trough colour becomes
  `#3A1020` and the fill gradient flips to `#FF3B5C`→`#B86BFF`; bar shakes ±3 px 20 f.
* Intro: bar draws out from the centre over 30 f while the boss title card shows (§12.13).

### 12.7 Ability banner / pickup banner

* Panel (240, 200) size 480×120, slides in from y 170 over 12 f, holds 150 f, fades 20 f.
  Game is NOT paused; input is live.
* Line 1 (480, 236): `bold 26px UI SELECT` e.g. `ECHO JUMP ACQUIRED`.
* Line 2 (480, 268): `16px MONO PAPER` the control hint, e.g. `Press JUMP again in the air`.
* Line 3 (480, 296): `13px MONO PAPER_DIM` the flavour line (§15.5).
* 10 `glitter` burst from the panel corners on open; `ability` SFX.
* Boss ability rewards use this panel inside the 120 f pickup sequence of §8.0 (player locked, screen darkened to 40 %, module orbiting); the panel then holds its normal 150 f after the sequence. Cores, vendor purchases and `RESTORED` use the plain non-blocking banner.

### 12.8 Prompts & misc HUD

* Interaction prompt (restore node, vendor): `bold 14px UI PAPER` `▲ REST` / `▲ TRADE`
  floating 24 px above the object, bobbing 2 px; the key glyph shows the bound key
  (`UP` or the gamepad glyph).
* Control hints during the first 3 rooms of a new game: a bottom-left line at (24, 520)
  `13px MONO PAPER_DIM` cycling `MOVE  ←→   JUMP  Space   LIGHT  Z   HEAVY  X   SPECIAL  C`,
  dismissed forever once each action has been used once (stored in save `hints`); the DASH and OVERCLOCK items appear only once owned/ready.
* Debug (`showHitboxes`): body boxes `#3FD3FF` α 0.6 stroke 1, attack boxes `#FF3B3B` fill
  α 0.25, enemy boxes `#FFD166`, exits `#8FE388`; plus `fps` and `roomId` at (8, 536)
  `11px MONO`.

### 12.9 Title screen

* Background: driftcache bg0/bg1/bg2 caches scrolling slowly (bg1 at 8 px/s, bg2 at 16 px/s,
  wrapping) with driftcache ambient motes; vignette on top; a slow 1.5 s sine "breathing" of
  the fog alpha 0.12↔0.20.
* **Logo** centred at (480, 170): the word `UNDERBYTE` in `bold 92px UI`, letter-spacing
  +6 px, drawn as: (1) ink `strokeText` `lineWidth 10`; (2) fill with a vertical linear
  gradient `LOGO_A` (top) → `LOGO_B` (bottom); (3) a `PAPER` `strokeText` `lineWidth 2` at
  α 0.6 offset (−2,−2) as a chalk highlight; (4) every 240 f a horizontal "scan" band
  (`PAPER` α 0.35, 14 px tall) sweeps top→bottom over 20 f clipped to the text (draw text
  into a 700×120 offscreen once, use it as a mask via `destination-in` on that offscreen —
  this is the one allowed exception to the compositing rule, and it is off-screen).
  Logo idles with a 2 px bob (3 s) and a 0.5° rock.
* Tagline at (480, 232) `18px MONO PAPER_DIM`: §15.1.
* Menu (vertical list, centred, start y 320, pitch 44): `NEW GAME`, `CONTINUE`, `SETTINGS`
  in `bold 24px UI`. Unselected `PAPER` α 0.8; selected `SELECT` with a `▶` marker 26 px to
  the left that nudges ±3 px at 20 f, and the item scales 1.06. `CONTINUE` is drawn
  `PAPER_DIM` α 0.4 and skipped when there is no save; when a save exists it shows a
  sub-line `12px MONO PAPER_DIM`: `TESSIK · DRIFTCACHE · 4 hearts · 01:23:45` (fighter, zone of the saved room, hearts, play time).
* Footer (480, 516) `11px MONO PAPER_DIM`: `an original game · keyboard or gamepad · press
  Enter`. Bottom-right `v1.0` at (944, 528).
* Before the first user gesture a line at (480, 470) `bold 14px UI SELECT` blinks (30 f):
  `PRESS ANY KEY` — the gesture also unlocks audio (§6.1).

### 12.10 Character select

* Header (480, 48) `bold 30px UI PAPER`: `CHOOSE YOUR SPIRIT`. Sub (480, 74) `13px MONO
  PAPER_DIM`: `← → select · Enter confirm · Esc back`.
* **5 cards** in a row: card size 150×110, y 380..490, x positions 60, 240, 420, 600, 780
  (gap 30). Each card: panel; fighter name `bold 16px UI` at top (centre, y+22); title
  `11px MONO PAPER_DIM` (y+40); a 56 px tall mini idle rig (scale 0.9) centred at (x+75,
  y+78). Hovered card: `SELECT` edge, lifts 4 px, scale 1.05; others α 0.75.
* **Big preview** standing at (300, 300): the hovered fighter's rig at scale 3.0 running its
  idle animation; every 180 f it plays the next pose of the cycle `run → light1 → light2 → light3 →
  jump → heavy` (each pose held for its §4.2 total frames, within a 48 f slot, at scale 3), then idle. A
  ground shadow ellipse 120×14 at (300, 300). Behind it a `glow` affinity halo r 110 α 0.10 centred at (300, 202).
  Switching fighters: old rig slides out 40 px and fades 8 f, new one slides in.
* **Stat panel** at (560, 130) size 360×150: 4 bars, label `bold 13px UI PAPER` left at
  x 580, bar from x 680 to 900 (220 wide, 10 tall, radius 5), trough `#2A2230`, fill
  `SELECT`, ink 2; rows y 160, 190, 220, 250 for `HEARTS`, `SPEED`, `JUMP`, `WEIGHT`.
  Values normalised to the roster: hearts `hp/6`, speed `run/300`, jump
  `jumpHeight/113.8`, weight `weight/1.3` (§4.1). Bars animate to target at
  0.2/frame.
* **Moveset panel** at (560, 292) size 360×72: 3 lines `12px MONO PAPER`, from the §4.2
  move names: `LIGHT  L1 / L2 / L3 names`, `HEAVY  name   SPECIAL  name`, `ULTIMATE  name`.
* **Bio** at (60, 322) width 490, `11px MONO PAPER_DIM`, word-wrapped 4 lines max (§4.3), pitch 13: it sits below the halo and clear of the lifted card (top 373).
* Confirm: `confirm` SFX, card flashes `PAPER` 4 f, 20 f fade to black, then the game
  starts (new game) with the zone toast.

### 12.11 Pause menu

* Dim the frozen game frame with `rgba(10,8,12,0.6)`. Panel (330, 150) size 300×240.
  Title `PAUSED` `bold 24px UI PAPER` at (480, 186). Items start y 226 pitch 40 `bold 18px
  UI`: `RESUME`, `MAP`, `SETTINGS`, `QUIT TO TITLE`. Selection style as the title menu.
* `QUIT TO TITLE` asks `Unsaved progress since the last node is lost. Quit?` with
  `YES / NO` (NO default) in a 300×110 panel.
* Music ducks to 40 % volume over 10 f while paused (§13.4).

### 12.12 Map screen (`M`, `Tab`, or pause → MAP)

* Full-screen panel inset 20 px: (20, 20) size 920×500. Header `MAP` `bold 22px UI` at
  (60, 56); zone name of the current room right-aligned at (900, 56) `14px MONO PAPER_DIM`.
* Each room is drawn as a rounded rect at **room grid coordinates × 40 px per screen**
  (rooms are W×H screens → `40W × 40H`, minus 4 px gap), using the room's `gx, gy, w, h`
  from §6 (screens; fractional allowed), with the whole graph auto-centred on the current
  room and clamped to the panel. A **room cursor** (a `SELECT` outline) starts on the current room;
  arrows/stick/d-pad (menu key-repeat) move it to the nearest discovered room in that direction and the
  view pans to keep it centred (clamped); `R` / Confirm recentre (cursor back on the current room, pan 0). Exits whose
  rooms are not adjacent on the grid (`dc_cross.L2`↔`lw_shaft.R2`, `lw_belts.L`↔`lw_shaft.R`,
  `lw_rest.B`↔`bv_catwalk.T`, `ns_climb.R`↔`ns_plunge.L2`) draw a dotted `PAPER_DIM` link
  (`[3,3]`) between their stubs once both rooms are discovered.
* Visited room: fill the zone's `tileFill`, ink 2, with exit stubs (6×6 ink notches) on the
  edges that have exits. Discovered-but-unvisited neighbour (seen through an exit): fill
  `#1A1620` dashed outline (`[4,4]`). Unknown: not drawn, and the panel background has a
  faint `INK` hatch so the fog reads as "paper".
* Icons inside rooms: restore node = `CORE_HEART` diamond 8 px; boss room = `DANGER` skull
  glyph drawn as a circle r 5 with two 2×2 ink eye dots (defeated → `PAPER_DIM`); vendor =
  `BITS` hexagon; core found = small `CORE_HEART` dot. Player = `ENERGY` dot r 5 with a
  pulsing ring r 5→12 every 40 f.
* Legend at the bottom (60, 500) `11px MONO PAPER_DIM`: `◆ node  ● boss  ⬢ vendor  · you`.
  Footer centre: the cursor room's name (`?` while unvisited) and under it the **bestiary line** (§15.11):
  a boss room shows `NAME · EPITHET` (`· purged` once beaten); a visited room lists the distinct enemy
  names it spawns (`no enemies` for safe rooms). Footer right: `Esc / M close`.

### 12.13 Boss title card

* On boss intro (**150 f**, player locked but the world runs; input ignored): a horizontal `INK` band α 0.8 from
  y 190 to 270 full width slides in from the left over 12 f; name at (480, 222) `bold
  36px UI DANGER` letter-spaced +4, subtitle at (480, 254) `14px MONO PAPER`; `bossRoar` SFX
  on f8; shake 7/12. The HP bar draws out from the centre over f120–150. Card exits upward over 10 f at f150. Kernauth's phase-2 card uses the same layout for 60 f during the transition (§8.4).

### 12.14 Settings

* Panel (230, 90) size 500×360. Title `SETTINGS`. Rows pitch 44 starting y 150, label left at
  x 260 `bold 16px UI PAPER`, control right-aligned to x 700:
  1. `MASTER VOLUME` slider 0–10 (bar 160×10, knob r 8 `SELECT`), default 8
  2. `MUSIC VOLUME` slider, default 7
  3. `SFX VOLUME` slider, default 8
  4. `SCREEN SHAKE` toggle `ON/OFF` (pill 56×22), default ON
  5. `SHOW HITBOXES` toggle, default OFF
  6. `RESET SAVE` (only from the title) → confirm dialog
  7. `BACK`
* Left/Right adjust sliders by 1 and play `menuMove` at the new volume so the user hears it;
  toggles flip on Enter/Left/Right. Changes save to `underbyte.settings` immediately.

### 12.15 Game over

* On death animation end: fade to `#07050A` over 40 f (music fades with it); text `SIGNAL
  LOST` `bold 44px UI DANGER` at (480, 240) fades in 20 f with a 3 px ink stroke; sub (480,
  290) `14px MONO PAPER_DIM`: `Rebooting at the last restore node…`; prompt (480, 400)
  `bold 16px UI SELECT` blinking: `Press JUMP or CONFIRM to continue`. Confirm → 20 f fade,
  respawn, `restore` SFX. The deaths stat increments on death, not on confirm.

### 12.16 Victory

* After Kernauth's 240 f finale (§8.4 defeat: core cracks, crown spikes fall every 20 f with 4 px shakes, the well brightens `#ffcf5a`→white over 120 f, roots go dark bottom-up, music resolves to a held F# major chord) and a 60 f white-out, fade to black 60 f; a 1280×720
  rootwell bg2 slowly drifting behind; `ROOT PROCESS PURGED` `bold 40px UI LOGO_A` at (480,
  110) with the logo treatment; stats panel (280, 150) size 400×250, rows `16px MONO`, pitch 26:
  `FIGHTER`, `TIME` (`HH:MM:SS`, play state only), `DEATHS`, `BITS COLLECTED` (lifetime), `CORES FOUND x/3`,
  `ROOMS DISCOVERED x/23`, `ENEMIES PURGED`, `BOSSES 4/4`; each row types in 12 f after the previous. Epilogue text (§15.7) scrolls up from
  y 410 at 18 px/s, `14px MONO PAPER` centred, after the stats (any key advances a line); then `Press CONFIRM for
  the title` at (480, 510). The save keeps the cleared state (`victory:true`); Continue
  reloads at `rw_rest` for free play with `rw_throne` open, empty and quiet (no music, well glowing white).


### 12.17 Vendor panel (Scrivvet)

* Opens on Up within 1 tile of Scrivvet; the game pauses (music duck 0.4). Panel (230, 120) size 500×300. Scrivvet's line (random per opening, §15.9) at (480, 150) `13px MONO PAPER_DIM` word-wrapped to 460 px. Bits owned right-aligned at (700, 182) `bold 16px MONO BITS` with the hexagon icon.
* 3 rows, pitch 56, starting y 220: item name `bold 18px UI PAPER` at x 260, price right-aligned at x 700 `bold 16px MONO BITS` (or `SOLD` in `PAPER_DIM`), effect line `12px MONO PAPER_DIM` at x 260, y+22. Selected row: `SELECT` name and a `▶` marker as in menus. Unaffordable rows: price in `DANGER`; confirming plays `deny` and shows the can't-afford line for 90 f.
* Footer (480, 400) `11px MONO PAPER_DIM`: `↑↓ select · Enter buy · Esc close`.

### 12.18 Zone lore card (first entry only)

* After the zone toast settles: the game pauses; full-screen `INK` α 0.85; zone name at (480, 170) `bold 40px UI` in the zone `glow`, letter-spaced +6, with a 2 px `tileEdge` rule 320 px wide beneath; the lore paragraph (§5.3) at (480, 230) `15px MONO PAPER` word-wrapped to 640 px, line height 22; `Press any key` blinking at (480, 470) `12px MONO PAPER_DIM` after 60 f. Holds up to 240 f or any key, then fades 20 f. Recorded in save `loreSeen`.

---

## 13. Audio (`UB.Audio`, Web Audio, fully synthesized)

### 13.1 Context lifecycle

* No `AudioContext` is created until the first user gesture (`keydown`, `pointerdown`,
  `touchstart` on `window`). On that gesture: `ctx = new (AudioContext||webkitAudioContext)()`,
  build the graph (§13.2), `ctx.resume()`, start the title music. Every later gesture calls
  `if (ctx.state !== 'running') ctx.resume()` (cheap, idempotent).
* `visibilitychange` → hidden: music bus gain → 0 over 0.1 s; visible: back to its setting
  over 0.3 s and `ctx.resume()`. The game never throws if `ctx` is null: every public method
  (`play`, `music`, `setVolume`) early-returns when `!ctx`.
* The music scheduler (§13.5) keys off `ctx.currentTime`, so a suspended context simply pauses
  the song; on resume the scheduler resyncs `nextNoteTime = ctx.currentTime + 0.05` (no
  catch-up burst).

### 13.2 Graph

```
voices ─► sfxBus (Gain) ─► compressor (DynamicsCompressor: thr −18, ratio 4, att 0.003, rel 0.25) ─┐
music instruments ─► musicBus (Gain) ─────────────────────────────────────────────────────────────┼─► master (Gain) ─► destination
send taps ─► reverb (feedback delay: Delay 0.23 s → Gain 0.38 → BiquadFilter lowpass 2200 Hz → back into Delay; wet Gain 0.35) ─► master
```

Gains: `master = (settings.master/10)^2`, `musicBus = (settings.music/10)^2 * duck`,
`sfxBus = (settings.sfx/10)^2`. `duck` = 1.0 in play, 0.4 while paused/menus over the
game, 0.0 during the 40 f game-over fade. Music sends 0.25 of its output to the reverb,
hits/sfx send 0.12, menu sounds 0. Noise source: one 2-second `AudioBuffer` of white noise
(`Math.random()*2-1`) built once; each noise voice is a looping `BufferSource`.

### 13.3 Voice & ADSR (`UB.Audio.voice(spec)`)

Polyphony cap **24 voices** (16 sfx + 8 music); a new voice past the cap steals the oldest
sfx voice (stop at `t+0.01` with a 10 ms ramp to avoid clicks). Each voice:
`osc(type, freq[, detune]) [+ osc2] → BiquadFilter(lowpass, cutoff, Q) → Gain(ADSR) → bus`.
Nodes are created per voice (Web Audio nodes are one-shot) but the voice *records* are a
fixed array of 24 structs reused in place.

```
spec = { type:'sine'|'square'|'sawtooth'|'triangle'|'noise', f:220, f2:null, detune:0,
         slide:{to:110, t:0.12} | null,   // exponentialRamp of frequency
         cut:1800, q:1, cutEnv:{to:400, t:0.2} | null,
         a:0.005, d:0.08, s:0.0, r:0.12, dur:0.1,   // seconds; dur = time at sustain before release
         vol:0.5, bus:'sfx', send:0.12, pan:0 }
```

ADSR: `g.setValueAtTime(0,t); g.linearRampToValueAtTime(vol, t+a); g.linearRampToValueAtTime(vol*s, t+a+d);
g.setValueAtTime(vol*s, t+a+d+dur); g.linearRampToValueAtTime(0, t+a+d+dur+r); osc.stop(t+a+d+dur+r+0.02)`.
Pan uses a `StereoPanner` only for positional sfx (hits/enemies): `pan = clamp((x-camCenter)/480,-1,1)*0.6`.
A tiny random detune (±6 cents) and ±4 % duration on every sfx stops repeats sounding
machine-gunned.

### 13.4 Music engine

* Songs are data: `{ bpm, steps:16 (16ths per bar), bars:8, chords:[...8], tracks:{bass,pad,lead,arp,drums} }`.
  Notes are MIDI numbers; `0` = rest; `freq = 440*2^((n-69)/12)`.
* Chord entry: `{root:62, kind:'m'|'M'|'m7'|'sus2'|'dim'|'M7'}` → voicing intervals
  `m:[0,3,7,10 opt] M:[0,4,7] m7:[0,3,7,10] sus2:[0,2,7] dim:[0,3,6] M7:[0,4,7,11]`.
* **Pad** plays the chord voicing for the whole bar (one voice per chord note, `a 0.35 s`,
  released 0.1 s before the next bar). **Bass/lead/arp** are 16-step-per-bar arrays, 8 bars
  long (128 entries); an entry is a MIDI note, `0` rest, or `-1` tie (hold previous).
  Bass arrays are written **relative to the bar's chord root** (semitone offsets), lead and
  arp absolute. Drums: per-bar 16-step strings, `k` kick, `s` snare, `h` hat, `o` open hat,
  `.` rest, one string per bar (8 strings).
* Transition between songs: 0.8 s crossfade of two scheduler instances (old one keeps
  stepping during fade so the loop stays seamless), then the old one is dropped.

### 13.5 Lookahead scheduler (seamless loop)

```
tick every 25 ms (setInterval; survives rAF throttling):
  while (nextNoteTime < ctx.currentTime + 0.12):
    scheduleStep(step, nextNoteTime)        // creates the voices for every track at this 16th
    nextNoteTime += 60 / bpm / 4
    step = (step + 1) % (16 * bars)          // wrap = seamless loop, no gap, no restart
```

Pads are scheduled on step `% 16 == 0` for the full bar. Because every event is scheduled on
the audio clock, the loop has no seam. On pause, `duck` lowers the bus; the scheduler keeps
running (so the resume is in time). Boss music starts on the boss intro frame; on boss death
crossfade to the zone song over 2 s.

### 13.6 Instrument recipes

| Instrument | Recipe |
|---|---|
| `pad` | 2 × sawtooth detuned ±7 cents + 1 triangle an octave down; lowpass 520 Hz Q 0.7 with `cutEnv` to 900 over 1.2 s; a 0.4 s attack, r 0.6, vol 0.11 per note, send 0.3 |
| `padDark` (Rootwell/boss) | 2 × square ±12 cents, lowpass 380 Hz, slow LFO (`osc 0.15 Hz → gain 120 → filter.frequency`), vol 0.09 |
| `bass` | triangle + square one octave down at 0.4 gain, lowpass 300 Hz, a 0.01 d 0.1 s 0.6 r 0.08, vol 0.22 |
| `bassSaw` (boss/Loomworks) | sawtooth, lowpass 700 Hz with `cutEnv` 1800→700 over 0.08 s, a 0.005 d 0.12 s 0.4 r 0.05, vol 0.2 |
| `lead` | sine + triangle (0.5), vibrato LFO 5.5 Hz depth 6 cents from 0.25 s, lowpass 2400, a 0.02 d 0.15 s 0.5 r 0.25, vol 0.14 |
| `bell` (Brinevault) | sine f + sine 2.76f at 0.3 gain decaying twice as fast, a 0.003 d 0.5 s 0 r 0.6, vol 0.13, send 0.4 |
| `pluck` (Driftcache/Nullspire arp) | square, lowpass with `cutEnv` 3000→600 over 0.12 s, a 0.003 d 0.18 s 0 r 0.1, vol 0.1 |
| `pulse` (Rootwell arp) | square, lowpass 900, a 0.002 d 0.06 s 0 r 0.04, vol 0.08 |
| `kick` | sine `slide` 150→42 Hz over 0.11 s, a 0.002 d 0.2 s 0 r 0.05, vol 0.5 |
| `snare` | noise bandpass 1800 Hz Q 0.8, d 0.14 + triangle 180 Hz d 0.06, vol 0.3 |
| `hat` | noise highpass 7000 Hz, d 0.035 (`o` open: d 0.18), vol 0.14 |
| `drone` (Rootwell) | sine f + sine f*1.005 + sawtooth f/2 through lowpass 200, a 2.0, held, vol 0.1 |

### 13.7 Songs

Song ids and where they play: `title` (title + character select) · `driftcache` "Idle Loop" · `loomworks` "Pressure Line" · `brinevault` "Facets" · `nullspire` "Unanswered" · `rootwell` "Null Pointer" · `boss` "Fault Handler" (all four bosses; phase 2 variant for enrage and Kernauth phase 2; Kernauth adds the Rootwell drone) · `victory` = a held F# major chord (`pad`, F#3/A#3/C#4/F#4) under the finale. Safe rooms (`*_rest`, `dc_shrine`) play their zone song at 70 % music gain. Common note names for readability: `C4 = 60`. Chord rows list 8 bars.

**TITLE — "Boot Sequence"** · 80 BPM · D major (lydian colour) · pad + lead + soft bass, no drums.
Chords: `DM | AM | Bm | GM | DM | AM | Em | GM`.
Bass (per bar, relative): `[0,-1,-1,-1, -1,-1,-1,-1, 7,-1,-1,-1, -1,-1,-1,-1]` every bar.
Lead (absolute, bars 1–8 as 16ths, `-1` ties): bar1 `[74,-1,-1,-1, 78,-1,-1,-1, 81,-1,-1,-1,-1,-1, 80,-1]`,
bar2 `[78,-1,-1,-1,-1,-1,-1,-1, 76,-1,-1,-1, 74,-1,-1,-1]`, bar3 `[71,-1,-1,-1, 74,-1,-1,-1, 78,-1,-1,-1,-1,-1,-1,-1]`,
bar4 `[79,-1,-1,-1, 78,-1, 76,-1, 74,-1,-1,-1,-1,-1,-1,-1]`, bars5–6 = bars1–2, bar7 `[76,-1,-1,-1, 79,-1,-1,-1, 83,-1,-1,-1, 81,-1, 79,-1]`,
bar8 `[78,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0, 74,-1,-1,-1]`.

**DRIFTCACHE — "Idle Loop"** · 72 BPM · D dorian · pad, bass, pluck arp, hats only.
Chords: `Dm7 | Dm7 | GM | Dm7 | FM7 | CM | Dm7 | Am`.
Bass: `[0,-1,-1,-1, 0,0,0,0, 0,0,7,-1, 0,0,0,0]` bars 1–7; bar 8 `[0,-1,-1,-1, 0,0,0,0, 12,-1,10,-1, 7,-1,-1,-1]`.
Arp (pluck, absolute, 2-bar pattern repeated 4×, transposed by the chord root − 62):
`[62,0,65,0, 69,0,72,0, 69,0,65,0, 62,0,69,0 | 65,0,69,0, 72,0,76,0, 72,0,69,0, 65,0,60,0]`.
Drums: `"..h...h...h...h."` all bars. Ambient layer: a `drone` on D2 (38) at vol 0.05.

**NULLSPIRE — "Unanswered"** · 84 BPM · E aeolian · pad, bass, lead, pluck, kick+hat, plus the Nullspire ambient drone (§13.10) mixed under it.
Chords: `Em | CM | GM | DM | Em | Am | CM | Bm`.
Bass: `[0,-1,0,0, 7,-1,0,0, 0,-1,0,0, 10,-1,7,-1]` (bars 1–7), bar8 `[0,-1,0,0, 7,-1,0,0, 12,-1,10,-1, 7,-1,5,-1]`.
Lead (4-bar phrase ×2): bar1 `[0,0,0,0, 71,-1,74,-1, 76,-1,-1,-1, 74,-1,71,-1]`, bar2 `[72,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0, 67,-1,69,-1]`,
bar3 `[71,-1,-1,-1, 74,-1,-1,-1, 79,-1,-1,-1,-1,-1, 78,-1]`, bar4 `[74,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0,0,0,0,0]`.
Pluck: `[52,0,0,0, 0,0,55,0, 0,0,59,0, 0,0,0,0]` relative to chord root as bass (root 52).
Drums: `"k...h...k...h..."` bars 1–7, bar 8 `"k...h...k.k.h.o."`.

**BRINEVAULT — "Facets"** · 96 BPM · F# minor (with major IV) · bells arp, pad, bass, hats (the bells double as the vault's drips).
Chords: `F#m | DM | AM | EM | F#m | BM | DM | C#m`.
Bass: `[0,-1,-1,-1, -1,-1,0,-1, 7,-1,-1,-1, 5,-1,3,-1]`.
Bell arp (absolute, 1-bar pattern transposed by chord root − 66):
`[78,0,81,0, 85,0,81,0, 78,0,85,0, 90,0,85,0]` → in bar 8 reverse the array.
Lead (bells, half notes): bar1 `[81,-1,-1,-1,-1,-1,-1,-1, 85,-1,-1,-1,-1,-1,-1,-1]`, bar2 `[86,-1,-1,-1,-1,-1,-1,-1, 85,-1,-1,-1, 81,-1,-1,-1]`,
bar3 `[80,-1,-1,-1,-1,-1,-1,-1, 83,-1,-1,-1,-1,-1,-1,-1]`, bar4 `[85,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]`, bars5–8 = 1–4 one octave down.
Drums: `"..h.h...h.h...h."` with `o` on bar 4 and 8 step 15.

**LOOMWORKS — "Pressure Line"** · 104 BPM · G minor · bassSaw, padDark, lead, kick/snare/hat.
Chords: `Gm | Gm | E♭M (63 root 'M') | FM | Gm | B♭M | E♭M | DM`.
Bass (saw, driving): `[0,0,0,-1, 0,0,12,-1, 0,0,0,-1, 10,-1,7,-1]`.
Lead: bar1 `[67,-1,-1,-1, 70,-1,-1,-1, 74,-1,-1,-1, 72,-1,70,-1]`, bar2 `[67,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0, 65,-1,67,-1]`,
bar3 `[70,-1,-1,-1, 72,-1,-1,-1, 75,-1,-1,-1,-1,-1, 74,-1]`, bar4 `[72,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0,0,0,0,0]`, bars 5–8 = 1–4 a fifth up (+7).
Drums: `"k..hs..hk.khs..h"` bars 1–7, bar 8 `"k..hs..hk.k.s.ss"`. Extra: a metallic `noise`
bandpass 3200 Hz Q 6 hit (vol 0.12) on step 4 of every other bar ("pipe clank").

**ROOTWELL — "Null Pointer"** · 60 BPM · C phrygian · drone, padDark, pulse arp, sparse kick (the kick doubles as the heartbeat: steps 0 and 1 of each bar in bars 1–3/5–7).
Chords: `Cm | D♭M (61 'M') | Cm | B♭m | Cm | D♭M | A♭M (56 'M') | Gdim (55 'dim')`.
Bass: `[0,-1,-1,-1,-1,-1,-1,-1, 0,-1,-1,-1, 1,-1,0,-1]`.
Pulse arp (absolute, transposed by root − 48, 1 bar): `[48,0,0,49, 0,0,55,0, 0,48,0,0, 51,0,0,0]`.
Drone: C2 (36) held, vol 0.1, with a 0.1 Hz LFO on the lowpass (160↔420 Hz).
Drums: `"k..............."` bars 1–3, 5–7; bars 4 and 8 `"k.......k.....k."`. Every 8 bars a
reversed-envelope noise swell (a 1.5 s, lowpass 600) into bar 1.

**BOSS — "Fault Handler"** · 150 BPM · A harmonic minor · bassSaw 8ths, padDark, lead stabs, full drums.
Chords: `Am | Am | FM | E M | Am | Dm | FM | EM`.
Bass: `[0,-1,0,-1, 0,-1,0,-1, 0,-1,0,-1, 0,-1,12,-1]` bars 1–7, bar 8 `[0,-1,0,-1, 0,-1,0,-1, 12,-1,11,-1, 8,-1,7,-1]`.
Lead stabs (absolute): bar1 `[69,-1,0,0, 0,0,69,-1, 0,0,72,-1, 0,0,71,-1]`, bar2 `[69,-1,0,0, 0,0,0,0, 76,-1,0,0, 75,-1,0,0]`,
bar3 `[77,-1,0,0, 0,0,77,-1, 0,0,76,-1, 0,0,72,-1]`, bar4 `[71,-1,0,0, 0,0,68,-1, 0,0,0,0, 69,-1,0,0]`, bars 5–8 = 1–4 with
bar 8 `[80,-1,-1,-1, 79,-1,-1,-1, 76,-1,-1,-1, 75,-1,71,-1]`.
Drums: `"k.h.s.h.k.h.s.h."` bars 1–7, bar 8 `"k.h.s.h.k.k.s.ss"`.
Phase 2: bpm 158, add a `pulse` arp doubling the bass an octave up, hats become `o` on the
off-beats, lead +12. Final boss uses the same song with the `drone` from Rootwell underneath.

### 13.8 SFX recipes (`UB.Audio.play(name, x?)`)

Times in seconds; `type` = oscillator; "affinity type" = sine (Signal), square (Ore),
sawtooth (Flux), triangle (Cipher), square ±15 cents pair (Pressure) — from §4.

| Name | Recipe |
|---|---|
| `jump` | affinity type, f 300 slide→ 620 over 0.09, a 0.003 d 0.06 s 0 r 0.05, vol 0.25 |
| `doubleJump` | as `jump` with f 420→ 900 plus a second voice 1 octave up at 0.12 vol |
| `land` | noise lowpass 500 d 0.07 vol 0.2 + sine 90 Hz d 0.05 vol 0.2; heavy fighters (Brackmaw/Korvask) sine 60 Hz vol 0.3 |
| `step` | noise lowpass 400 d 0.03 vol 0.06 (every stride plant) |
| `dash` | sawtooth f 180 slide→ 60 over 0.12 + noise highpass 3000 d 0.12 with cutEnv 6000→800, vol 0.22 |
| `wallSlide` | looping noise bandpass 1200 Q 2 vol 0.08 while sliding (one voice, stopped on release) |
| `lightHit` | affinity type f 520 slide→ 260 over 0.06, a 0.002 d 0.07 s 0 r 0.03, vol 0.3 + noise d 0.03 vol 0.15; L2 f 560, L3 f 620 with d 0.11 |
| `heavyHit` | affinity type f 220 slide→ 70 over 0.14 vol 0.4 + noise lowpass 900 d 0.12 vol 0.3 + sine 55 d 0.2 vol 0.3 |
| `special` | fighter: Tessik sine 880 slide→ 1760 0.15 + delay send 0.5; Brackmaw square 90→40 0.3 + noise 0.25; Vellix sawtooth 400→2400 0.08; Orrubel triangle 1200 ×3 pings 60 ms apart; Korvask square pair 150 d 0.1 then 300 d 0.1 |
| `ultimate` | `special` recipe doubled with a second voice +7 semitones, plus `overclockPulse` (sine 48 Hz d 0.4 vol 0.4) |
| `whiff` | noise highpass 2000 d 0.05 vol 0.08 (every attack active-start without a hit) |
| `pogo` | triangle 700 slide→ 1200 0.06 vol 0.22 |
| `hurt` | square 300 slide→ 120 over 0.18 vol 0.35 + noise lowpass 1200 d 0.1 vol 0.25; a 0.9 s musicBus dip to 0.6 |
| `death` | sawtooth 440 slide→ 40 over 0.9 vol 0.3, lowpass cutEnv 3000→200 over 0.9 + 3 noise bursts at 0, 0.25, 0.5 |
| `spike` | noise bandpass 2500 Q 3 d 0.08 vol 0.3 + triangle 900→300 0.1 vol 0.2 |
| `enemyHit` | affinity type f 400 slide→ 200 0.05 vol 0.2 (plays with `lightHit`, panned) |
| `enemyDeath` | square 240 slide→ 60 0.25 vol 0.25 + noise d 0.15 vol 0.2 + 4 `pickupBit`-like blips staggered 30 ms |
| `pickupBit` | sine f 1320 then 1760 (two 40 ms notes), a 0.002 d 0.06 vol 0.18, pitch +2 semitones per bit collected within 0.5 s (max +12) |
| `energy` (spark) | triangle arpeggio 660→880→1320, 50 ms each, vol 0.2, send 0.3 |
| `heal` | sine chord 523/659/784 a 0.05 d 0.6 vol 0.15 each, staggered 80 ms, send 0.4 |
| `core` | `heal` plus a sine 1047 slide→ 2093 over 0.8 vol 0.15 and a `kick` |
| `restore` | square 110 a 0.3 d 0.8 vol 0.15 + `heal`; then a soft noise sweep (lowpass 200→3000 over 1 s) vol 0.08 |
| `overclockOn` | sine 55 slide→ 110 over 0.25 vol 0.5 + sawtooth 220 slide→ 1760 over 0.4 lowpass cutEnv 400→6000 vol 0.25 + noise highpass 1000 reversed-envelope (a 0.3 d 0.05) vol 0.2; musicBus dips to 0.3 for 0.4 s |
| `overclockEnd` | sawtooth 880 slide→ 110 over 0.5 vol 0.2 lowpass cutEnv 5000→200 |
| `overclockWarn` | sine 880 d 0.05 vol 0.12, on each blink of the last 3 s |
| `deny` | square 150 d 0.08 ×2 (gap 60 ms) vol 0.15 |
| `menuMove` | triangle 740 d 0.04 vol 0.12 |
| `menuConfirm` | sine 660 then 990 (50 ms each) a 0.002 d 0.12 vol 0.18 |
| `menuBack` | triangle 500 slide→ 330 0.08 vol 0.12 |
| `ability` | sine chord 440/554/659/880 staggered 60 ms a 0.01 d 1.0 vol 0.14 send 0.5 + `kick` |
| `bossRoar` | sawtooth pair ±20 cents f 80 slide→ 160 slide→ 60 over 0.9, lowpass cutEnv 200→1800→300, vol 0.45 + noise lowpass 400 a 0.1 d 0.6 vol 0.3 + sine 40 d 0.8 vol 0.4 |
| `bossHit` | square 180 slide→ 90 0.08 vol 0.3 + noise bandpass 900 d 0.06 vol 0.2 (plays with the player's hit SFX) |
| `bossPhase` | `bossRoar` at pitch ×1.3 + `overclockOn` sweep |
| `bossDeath` | 6 descending `heavyHit`s 120 ms apart (f ×0.8 each) + sawtooth 220 slide→ 20 over 2.5 s lowpass 2000→100 vol 0.3 + noise lowpass 300 a 0.5 d 1.5 vol 0.3; musicBus 0 over 0.5 s |
| `roomTransition` | noise lowpass cutEnv 300→2000→300 over 0.3 vol 0.12 + sine 220 slide→ 330 0.3 vol 0.08 |
| `crumble` | noise lowpass 800 d 0.3 vol 0.2 with 3 `land` clicks |
| `platformMove` | none (silent) |
| `turretShot` / `bolt` | triangle 1000 slide→ 500 0.07 vol 0.15 |
| `heartbeat` | sine 50 d 0.12 vol 0.35 then 45 d 0.1 vol 0.25 (gap 90 ms) |
| `vendorBuy` | `pickupBit` ×3 ascending + `menuConfirm` |
| `save` | `menuConfirm` + triangle 1320 d 0.2 vol 0.1 |

Rate limits: the same sfx name may not start more than once per 2 logic frames (hits:
3 frames, `step`: 6 frames); extra requests are dropped, not queued. Ultimate and boss
sounds ignore the voice cap (they steal).

### 13.9 Mixing & test hooks

Default level targets at settings 8/7/8: music peaks ≈ −14 dBFS, hits ≈ −8 dBFS, boss roar
≈ −4 dBFS; the compressor catches stacking. `UB.debug.audio()` returns
`{ctxState, voices, song, step, bpm}` and `UB.debug.mute()` sets master 0 for headless tests
(Playwright runs with no gesture, so `ctx` stays null — all audio code must be gesture-safe).

### 13.10 Ambient SFX layers (per zone, `UB.Audio.ambient(zoneId)`)

Started on zone entry, stopped on zone change, mixed into the music bus at 0.6 of the music gain so settings scale them. All deterministic timers run on logic frames; voices are ordinary §13.3 voices.

| Zone | Layer |
|---|---|
| Driftcache | a "dust tick" (noise lowpass 1200, d 0.05, vol 0.08) every 180–360 f (seeded); a sine hum at 55 Hz vol 0.04 held |
| Loomworks | a chain-rattle burst (noise bandpass 2400 Q 3, d 0.12, vol 0.1) each time a mover reverses direction, panned to it; a rising sawtooth sweep 120→480 Hz over 0.6 s (lowpass 900, vol 0.06) every 480 f |
| Brinevault | water drips: sine pings at a random pitch 800–1600 Hz (a 0.002 d 0.09, vol 0.1, send 0.5) every 24–120 f; a low bubbling (noise bandpass 100–300 Hz, vol 0.05) held |
| Nullspire | two sines at 880 and 884 Hz (vol 0.03 each, beating) held; a static crackle (white noise 30 ms, highpass 3000, vol 0.12) every 60–240 f; a descending bass note (triangle 110→55 Hz over 1.5 s, vol 0.08) every 720 f |
| Rootwell | heartbeat: two sine thumps at 50 Hz (d 0.12 vol 0.25, then d 0.1 vol 0.18, 0.15 s apart) every 72 f, in addition to the song; a choir stack (3 detuned triangles on F#2/C#3/F#3, lowpass 600, vol 0.02 → 0.08 ramping with the player's x in `rw_gate`→`rw_rest`→`rw_throne`) held |

---

## 14. Save format (`UB.Save`)

Two `localStorage` keys. Every read is wrapped in `try/catch` (private mode, quota,
`file://` on some browsers): a failure means "no save" and the game still runs; a write
failure shows a 90 f toast `Could not save (storage blocked)` and continues.

### 14.1 `underbyte.save` (one slot)

```json
{
  "version": 1,
  "fighter": "tessik",
  "roomId": "dc_shrine",
  "spawn": { "nodeId": "node_dc_shrine" },
  "hearts": 6,
  "maxHearts": 6,
  "baseHearts": 5,
  "cores": ["core_dc_loft"],
  "abilities": { "echoJump": true, "burstLine": false, "gripProtocol": false },
  "bits": 137,
  "bitsLifetime": 212,
  "discovered": ["dc_wake", "dc_fall", "dc_cross", "dc_loft", "dc_shrine", "dc_sentinel", "lw_hoist", "lw_shaft"],
  "visited": ["dc_wake", "dc_fall", "dc_cross", "dc_loft", "dc_shrine", "dc_sentinel"],
  "bossesDefeated": ["tallock"],
  "bitsCollected": ["dc_wake:19,10", "dc_wake:20,10", "dc_wake:21,10", "dc_fall:14,7"],
  "vendor": ["spare_cell"],
  "nodesUsed": ["node_dc_wake", "node_dc_shrine"],
  "loreSeen": ["driftcache"],
  "hints": { "move": true, "jump": true, "light": true, "heavy": false, "special": false, "dash": false, "overclock": false },
  "enemiesPurged": 41,
  "playTimeFrames": 83211,
  "deaths": 2,
  "victory": false,
  "savedAt": 1760400000000
}
```

Rules:
* Written at a restore node (full heal; `spawn.nodeId` set; `roomId` = the node's room), at a boss
  ability pickup (f120 of the sequence, `spawn` unchanged), at a vendor purchase, and at the
  victory screen. Game Over never writes. Death keeps `abilities`, `cores`, `bossesDefeated`,
  `bits`, `bitsLifetime`, `bitsCollected`, `vendor`, `discovered`, `visited`, `loreSeen` and
  `enemiesPurged` in memory (they are part of the respawned state and are written at the next
  save); only position, hearts, energy and meter reset. A defeated boss stays defeated and its
  seals stay open, so progression is never lost.
* `maxHearts = baseHearts + cores.length` is recomputed on load; `hearts` is set to
  `maxHearts` on load (you always load at a node).
* `discovered` = rooms shown on the map (visited + the target rooms of every exit of a visited room); `visited` ⊆ discovered. With **Deep Ping**, every room whose zone has a visited room counts as discovered at load and on each room entry.
* `playTimeFrames` counts logic frames in the `PLAY` state only (not menus or pauses).
* Load: unknown `version` → ignore and treat as no save; `fighter` not in the roster →
  `tessik`; `roomId` unknown or `spawn.nodeId` unknown → `dc_wake` with `node_dc_wake`. Energy
  starts at 50 and meter at 0 on load (§3.8, §3.9). Seals of every boss in `bossesDefeated`
  are open; `bv_corrosant`'s hatch crust is open once `corrosant` is defeated.
* `UB.debug.save()`/`UB.debug.load()` wrap these for tests.

### 14.2 `underbyte.settings`

```json
{
  "version": 1,
  "master": 8,
  "music": 7,
  "sfx": 8,
  "screenShake": true,
  "showHitboxes": false,
  "touchControls": "auto"
}
```

Volumes are integers 0–10 mapped to gain `(v/10)^2` (perceptual). Written on every change.
Missing keys take the defaults above, and so does any value of the wrong type or outside its range
(volumes: finite numbers 0–10, rounded; toggles: booleans; `touchControls`: `auto|on|off`); the file is
never deleted by `RESET SAVE` (which clears only `underbyte.save`).

---

## 15. All text strings (`UB.Text`) — all original

Every string the game shows, grouped by screen. Fighter ids: `tessik`, `brackmaw`, `vellix`, `orrubel`, `korvask`; display names are the capitalised ids.

### 15.1 Title

* Logo: `UNDERBYTE`
* Tagline: `A kingdom buried in its own memory. Purge it from the inside.`
* Menu: `NEW GAME` · `CONTINUE` · `SETTINGS`
* Prompt: `PRESS ANY KEY`
* Footer: `an original game · keyboard or gamepad · press Enter`
* No-save hint (when CONTINUE is selected and empty): `No signal found. Start a new run.`
* New game over existing save: `Overwrite the saved run?` → `YES` / `NO`

### 15.2 Character select

* Header: `CHOOSE YOUR SPIRIT`
* Sub: `← → select · Enter confirm · Esc back`
* Stat labels: `HEARTS` · `SPEED` · `JUMP` · `WEIGHT`
* Moveset labels: `LIGHT` · `HEAVY` · `SPECIAL` · `ULTIMATE`
* Confirm line: `Boot as {NAME}?` (shown for 1 frame under the card; just the SFX in practice)

### 15.3 Fighter bios (one paragraph each, shown under the cards)

* **Tessik — The Courier Lantern.** Tessik once carried messages between the kingdom's
  layers and still mutters route names under its breath. It believes every corrupted thing
  is only a message that lost its address, and that a sharp enough blade can re-deliver it.
  Balanced in every stat; the right first choice.
* **Brackmaw — The Walking Vault.** A retired archival lock that decided the safest vault
  is the one that walks toward the problem. It speaks in short declaratives and considers
  being knocked over a personal failing. Slow, armoured, and the hardest hitter here.
* **Vellix — The Prefetch Streak.** A cache routine that lives three steps ahead of everyone
  and is bored by the present. Reckless and bright, it treats every fight as a timing puzzle
  it has already solved. Fastest in the roster, and the most fragile.
* **Orrubel — The Ring Warden.** A watchdog process that trusts nothing it has not measured
  twice and prefers to fight from behind a wall of its own instruments. Soft-spoken and
  precise, it apologises to enemies as it pins them. Long reach, a returning ring, and
  sentries.
* **Korvask — The Clamp Balancer.** A load-balancer that misremembers its old job as
  "holding things until they stop struggling." Gruff and loyal, it believes any problem
  can be solved by getting closer to it. A bruiser whose counter turns enemy attacks
  into pain.

### 15.4 Zone names & intro blurbs (toast line 2)

| Id | Name | Blurb |
|---|---|---|
| driftcache | `DRIFTCACHE` | `Where the kingdom kept what it meant to forget.` |
| loomworks | `LOOMWORKS` | `The looms still run with nothing left to carry.` |
| brinevault | `BRINEVAULT` | `The coolant stayed. The heart did not.` |
| nullspire | `NULLSPIRE` | `Addresses that point at nothing all point here.` |
| rootwell | `ROOTWELL` | `It has never once let go of a child.` |

The long lore paragraphs for the first-entry card are in §5.3.

### 15.5 Ability & pickup banners

| Event | Line 1 | Line 2 (control hint; glyphs swap for gamepad) | Line 3 (flavour) |
|---|---|---|---|
| Echo Jump | `ECHO JUMP ACQUIRED` | `Press JUMP again in the air` | `A second thought, taken mid-fall.` |
| Burst Line | `BURST LINE ACQUIRED` | `Press DASH (Shift / RB) to lunge 6 tiles — on the ground or once in the air` | `Skip the frames you do not need.` |
| Grip Protocol | `GRIP PROTOCOL ACQUIRED` | `Hold toward a wall in the air to cling · JUMP to kick off` | `The walls were never the problem.` |
| Core | `CORE FOUND` | `Max hearts +1` | `A piece of the kingdom that never rotted.` |
| Vendor item | `{ITEM} PURCHASED` | `{EFFECT}` | — |
| Restore node | `RESTORED` | `Saved · hearts full · energy full` | — |

Vendor items (§9.5): `SPARE CELL` — `Max energy 100 → 125` (90 bits); `HOT CLOCK` — `Overclock gains ×1.5 from hits and shards` (160 bits); `DEEP PING` — `Map shows every room, node and core of zones you have entered` (120 bits). Vendor lines are in §15.9.

### 15.6 Boss title cards

| Id | Name | Subtitle |
|---|---|---|
| tallock | `TALLOCK` | `WARDEN OF THE STACK` |
| weftyr | `WEFTYR` | `THE SHUTTLE THAT WOULD NOT STOP` |
| corrosant | `CORROSANT` | `KEEPER OF THE BRINE` |
| kernauth (final) | `KERNAUTH` | `THE ROOT PROCESS` / phase 2 card: `KERNAUTH` · `UNBOUND` |

Boss defeated toast (bottom, 120 f): `{NAME} PURGED`.

### 15.7 Epilogue (victory scroll)

```
The Root Process let go.

For the first time since the kingdom was buried, nothing below
is holding on to anything above. The racks in Driftcache settle
a final inch. The looms run down and stop. The brine goes still.
The spire, with no address left to answer, forgets to hang there,
and simply ends.

You are a program with nothing left to run. You stay anyway,
in the quiet, where the light from the well reaches the ceiling
for the first time.

It is enough.

Thank you for playing.
```

### 15.8 System strings

* Pause: `PAUSED` · `RESUME` · `MAP` · `SETTINGS` · `QUIT TO TITLE`; quit confirm: `Unsaved
  progress since the last node is lost. Quit?` `YES` / `NO`.
* Settings: `SETTINGS` · `MASTER VOLUME` · `MUSIC VOLUME` · `SFX VOLUME` · `SCREEN SHAKE` ·
  `SHOW HITBOXES` · `RESET SAVE` · `BACK` · `ON` / `OFF`; reset confirm: `Erase the saved
  run? This cannot be undone.`; after the erase a 90 f toast `SAVE ERASED`.
* Map: `MAP` · legend `◆ node  ● boss  ⬢ vendor  · you` · `Esc / M close` · `R recentre`.
* Game over: `SIGNAL LOST` · `Rebooting at the last restore node…` · `Press JUMP or CONFIRM
  to continue`.
* Victory: `ROOT PROCESS PURGED` · stats `FIGHTER` `TIME` `DEATHS` `BITS COLLECTED` `CORES
  FOUND` `ROOMS DISCOVERED` `ENEMIES PURGED` `BOSSES` · `Press CONFIRM for the title`.
* Prompts: `▲ REST` · `▲ TRADE` · storage toast `Could not save (storage blocked)` ·
  gamepad toast `Gamepad connected` / `Gamepad disconnected — paused`.
* Hint strip: `MOVE ←→  JUMP Space  LIGHT Z  HEAVY X  SPECIAL C  DASH Shift  OVERCLOCK V` (gamepad: `MOVE stick  JUMP A  LIGHT X  HEAVY Y  SPECIAL B  DASH RB  OVERCLOCK LT`).
* Boss defeated toast: `{NAME} PURGED` (e.g. `TALLOCK PURGED`), bottom centre, 120 f.
* Pickup float text: `+1`, `+5`, `+20` (bits), `+25` (spark, in `ENERGY`), `+1 ♥` (heart), `+15` (shard, in `METER`).
* Interaction prompts: `▲ REST` (node), `▲ TRADE` (vendor); gamepad glyph `↑`.

### 15.9 Scrivvet (vendor) lines

* Greeting (random per opening): `Everything down here was somebody's, once. Now it's mine. Now it's yours.` · `You pay in bits because that's all that's left to pay in.` · `The deeper you go, the cheaper I get. Don't ask why I'm down here.`
* Can't afford: `Come back heavier.`
* Sold out (all three bought): `Nothing left you'd want. Nothing left I'd sell.`
* In `rw_rest` the first greeting is always: `Don't ask how I got down here. I don't know either.`

### 15.10 Ability names and the three abilities' in-game descriptions (map legend, pause menu)

`ECHO JUMP — a second jump in the air` · `BURST LINE — a 6-tile lunge, ground or air` · `GRIP PROTOCOL — cling to walls and kick off them`.

### 15.11 Enemy and boss names (for the bestiary line in the map screen footer when hovering a boss room)

Scuttlebit, Hopnode, Driftmoth, Brinejelly, Glarewisp, Spitvalve, Rambyte, Platewalker, Broodcell, Droplatch, Voltwheel; variants Brinecrab, Static-shot, Rootbound, Dripnode, Nullnode, Rootwisp, Acid Valve, Twin Valve, Rootram, Rootplate. Bosses: Tallock, Weftyr, Corrosant, Kernauth.

---

## 16. Open questions resolved (lead designer rulings)

Every conflict between `design/combat.md` (C), `design/world.md` (W) and `design/presentation.md` (P) and every gap found during validation, with the ruling now in force.

### 16.1 Naming

| Topic | C / W / P said | Ruling |
|---|---|---|
| Zone names | W: Driftcache, Loomworks, Brinevault, Nullspire, Rootwell · P: Cache Shallows, Spore Stacks, Quartz Registry, Coolant Pipeworks, Root Deep | **W wins** (P declared its names provisional). Ids `driftcache … rootwell`, index 1–5. P's palettes and background recipes were re-themed to W's zones (§5.1, §11.1.5). |
| Boss names | W: Tallock, Weftyr, Corrosant, Kernauth · P: placeholders | **W wins.** Title cards in §15.6. |
| Ability names | W: Echo Jump, Burst Line, Grip Protocol · P: Double Jump / Dash / Wall Cling | **W wins** for names; P's banner format kept. Save keys `echoJump`, `burstLine`, `gripProtocol`. |
| Fighter placeholders FIGHTER_1..5 | P | Replaced everywhere: tessik, brackmaw, vellix, orrubel, korvask. |
| Vendor | W: Scrivvet with Spare Cell / Hot Clock / Deep Ping · P: Energy Cell / Heavy Plating / Bit Magnet | **W wins** (W owns the vendor). P's item strings dropped. |
| Epilogue text | W and P each wrote one | **W's** (it names the real zones). P's victory layout kept. |
| Pickup names | C "spark" · W "energy orb" / "Overclock shard" | One pickup **Spark** = +25 energy +10 meter; a separate **Shard** = +15 meter (W said "+10 %"; pinned to 15 so it is distinct from the spark). |

### 16.2 Physics and traversal (the big one)

* **Units.** C uses px/s for fighters; W uses px/frame everywhere. Ruling: fighters px/s, enemies/bosses/projectiles/movers px/frame, both at a fixed 60 Hz (§3.0). W's "reference tuning" (run 4.0 px/f, jump −9.6, gravity 0.45, 22×40 body) is **retired**; C's per-fighter physics stand, with the changes below.
* **Body size vs 2-tile corridors.** W required bodies ≤ 26×44; C's bodies go up to 34×56. Ruling: C's bodies stand (all fit a 60 px corridor); the dash gate is re-derived for real body heights (§3.10). The two heavies have only 4–6 px of hop room in a crawlspace, so the dash must do the work:
* **Dash distance.** C: 150/120/180/150/135 px; W: 150 px = 5 tiles for all. Ruling: **180 px for everyone, Vellix 210** (§4.1). A 150 px dash left Brackmaw 4 px short of a 6-tile gap even with a frame-perfect hop; 180 crosses it from a standing start with the step-up tolerance and the hop as margin.
* **Ledge forgiveness.** New rule: 6 px step-up (§3.0). Needed so a ground dash that ends flush with a ledge lands reliably; small enough that no "must fail" height changes (checked in §3.10).
* **Vellix's jump.** C: 660 px/s (apex 124.5 px = 4.15 tiles). W requires a single jump to **fail a 4-tile ledge**, and the mechanical check showed Vellix (300 run + 4.15-tile jump) reaching `dc_cross.L2` from the row-12 grate with **no abilities** and sequence-breaking into Loomworks (boss 2 before boss 1). Ruling: **Vellix jumpVel 615** (apex 108 px = 3.6 tiles). Still the second-highest first jump and by far the longest flat reach (211 px).
* **Second-jump strength.** C: 0.85 for all. With 0.85 the heavies' Echo Jump tops out at 165/169 px and cannot clear W's 6-tile DJ gates (`dc_cross.T` slab → core 1, `dc_cross.L2` shelf). Ruling: **per-fighter `djMult`**: Brackmaw 1.00, Korvask 1.00 (their second jump is a full thruster burst — a feel differentiator), Tessik 0.85, Orrubel 0.85, Vellix 0.90 (so her 6-tile margin is 16 px, not 6). All five now clear 6 tiles (190–196 px) and fail 7 (210).
* **Specials as traversal.** C's Blink Strike (200 px gravity-suspended, air-usable) and Afterimage Storm trivially crossed every dash gate; Korvask's Clamp Press lunge (110 px) and Brackmaw's dive did not. Ruling (§4.2.3, §3.7): Blink Strike is **grounded and floor-bound** (stops at a drop); Storm suspends gravity only while locked on a target and untargeted blinks are 90 px with gravity on.
* **Chute auto-launch.** W: launch at the fighter's full jump impulse. With a 96 px jump Brackmaw could not clear a 3-tall chute mouth sideways. Ruling: **1.2 × jumpVel** with Echo Jump/air dash available and 20 f of i-frames (§3.1).
* **Top arrival velocity.** W: `vy = +2 px/frame`. Ruling: `+120 px/s` (identical, stated in fighter units).
* **Static pools.** C: bounce-out hazard `(0,−420)`; W: all pools respawn. Ruling: **W** — every `~` is a respawn hazard (§3.3); the bounce rule is dropped (it stranded heavy fighters inside pools).
* **Hazard timing.** C: 30 f freeze, respawn with 30 i-frames; W: 45 i-frames, 10 f hitstop, placement after 20 f. Ruling: 6 f hitstop, 30 f freeze, 10 f fade, 45 i-frames (§3.3).
* **Enemy hit reaction.** C: flash 4 f, hitstun 10 + hitstop, knockback from the move × kbResist; W: flash 6 f, HURT 10 f, 3 px/f knockback, exceptions list. Ruling: **C's system** with W's exception list expressed as `kbResist` values (§7.0).
* **Enemy death.** W: 8 particles, 8 f hitstop; C/P: +2 hitstop, 12 chips. Ruling: move hitstop +2, 12 chips, 14 f burst (§3.4, §7.0).
* **Player contact knockback.** W: 5 px/f for 10 f; C: `(240 away, −300) × weight`. Ruling: C (§3.2).
* **Restore node energy.** C: node sets energy to 100. Ruling: energy to max (125 with Spare Cell), meter unchanged (§5.5).

### 16.3 World fixes found by validation (tilemap changes are listed in §10.6)

* `dc_fall` core 3 was sealed: the x22–26 block ran to row 13, so the shaft bottom had no connection to the room. Rows 12–13 at x22–26 are now air.
* `ns_base` arrival ledge was a closed box (rows 4–5 solid across x0–11): no way into the left well, so the final boss was unreachable. Rows 4–5 at x6–8 are now air (the x2–4 launch pad stays).
* `bv_catwalk` ledge→crawlspace step was physically impassable for every body height (standing height 120, corridor ceiling at 90). Row 2 at x9–14 is now air: a 4-tall antechamber ahead of the gap; the 2-tall crawlspace starts at the gap, so the dash gate is unchanged.
* `bv_sluice` dash gate could be bypassed by Vellix by falling through the gap, drifting right under the crawlspace floor and double-jumping onto the lower hall. Rows 10–14 at x21–24 are now solid and row 15 x9–11 is acid: a fall through the gap is always acid → respawn on the shelf, never a trap.
* Placement: `lw_belts` bits (10,4),(12,4) were inside platform tiles → (10,3),(12,3); `ns_climb` bit (40,50) was inside a wall → (38,50); `ns_plunge` droplatches at (24,17),(22,32) sat on ceiling-spike tiles → (19,17),(18,32).
* W's claim "dc_fall spike bed x12–16 is a 5-wide pit: single jump clears" is false for everyone but Vellix; the bed is **off the critical path** (the floor to its right is reached from ledge E) and is crossable by pogo. Documented, not changed.
* W's §3.1 said `bv_sluice`'s shelf is "row 8"; the shelf is the row-4 grate and the crawlspace floor is rows 8–9. Text corrected in §6.

### 16.4 Presentation and flow

* **Room transition:** W: 12 f fade out / 12 f in; P: freeze 6 + slide 18 + settle 4. Ruling: **P's slide** (§11.3.2) with W's per-exit arrival spawn tiles (P's "1 tile inside the edge" dropped).
* **Boss intro:** W 150 f; P 60 f. Ruling: **150 f**; P's card visuals; the HP bar draws from f120 to f150.
* **Ability pickup:** W's 120 f orbit sequence vs P's non-blocking banner. Ruling: bosses use W's 120 f sequence showing P's banner; cores, vendor and restore use the non-blocking banner (§8.0, §12.7).
* **Zone title card:** W: 240 f card with the long lore; P: 150 f toast with a short blurb. Ruling: both — the lore **card** (§12.18) once per zone on first entry, then the **toast** (§12.5) on every zone change.
* **Bits counter:** W top-left, P top-right. Ruling: top-right (§12.4).
* **Map:** P needed `gx, gy` per room that W never gave. Ruling: §6 lists `gx, gy, w, h` in screens for every room; 40 px per screen (not 48) so the whole graph nearly fits the panel; non-adjacent connections draw dotted links (§12.12).
* **Victory stats:** W listed 8 rows, P 6. Ruling: W's 8 rows in P's layout (§12.16).
* **Hint strip:** includes DASH and OVERCLOCK keys (§15.8).
* **Music:** P's five songs were written for P's zone list. Ruling (§13.7): Driftcache "Idle Loop", Loomworks "Pressure Line", Brinevault "Facets", Nullspire "Unanswered" (P's 84 BPM E-aeolian song, renamed, plus the beating-sine drone), Rootwell "Null Pointer"; W's ambient descriptions become per-zone ambient SFX layers (§13.10).
* **Enemy colours:** P proposed zone-tint recolouring; W gave explicit hex per variant. Ruling: W's explicit colours (§7).

### 16.5 Economy

* Bit coin meter gain +1 per coin (C) kept. Spark +25 energy/+10 meter (C). Shard +15 meter. Hot Clock multiplies hit and shard meter gain ×1.5 (not pickups of bits/sparks/cores).
* Bosses drop W's bits **and** C's 3 sparks.
* Vendor purchases save immediately (so a purchase is never lost to a death).

### 16.6 Save triggers

Written at: restore node use, boss death (the defeat is recorded the moment the boss falls), boss ability pickup (f120), vendor purchase, victory. Never at Game Over. Death keeps everything but position/hearts/energy/meter in memory (§3.2, §14).

### 16.7 Hearts cap

Base 4–6 + 3 cores = max 9 cells, matching the HUD row (§12.1). Vellix with all cores: 7; Brackmaw/Korvask: 9.

### 16.8 Room count

**23 rooms** (BRIEF: 20–24): Driftcache 6, Loomworks 5, Brinevault 5, Nullspire 4, Rootwell 3. Ids in §6.

### 16.9 Debug/test API (`window.UB.debug`) — the contract implementers must expose

`BRIEF.md` points at a `CONTRACT.md` that does not exist yet; until it does, this is the contract. None of these affect normal play unless called.

```
UB.debug.state()                 // {screen, roomId, zoneId, fighter, x, y, vx, vy, hp, maxHp, energy, meter,
                                 //  abilities:{echoJump,burstLine,gripProtocol}, cores:[...], bits, bossesDefeated:[...],
                                 //  overclock:bool, grounded:bool, frame, deaths, playTimeFrames}
UB.debug.warp(roomId, exitId)    // enter roomId as if arriving through its exit exitId (or exitId null -> the room's
                                 //  first exit's spawn, or the node/start tile if it has one)
UB.debug.teleport(x, y)          // set the body bottom-centre (pixels) in the current room
UB.debug.grant(abilityId, on)    // 'echoJump' | 'burstLine' | 'gripProtocol' (on defaults true)
UB.debug.setHp(n) / setMaxHp(n) / setEnergy(n) / setMeter(n) / addBits(n)
UB.debug.defeatBoss(bossId)      // 'tallock'|'weftyr'|'corrosant'|'kernauth': marks defeated, lifts seals, grants the ability
UB.debug.killEnemies()           // removes every enemy in the room
UB.debug.god(on)                 // invulnerable to everything incl. hazards
UB.debug.step(n)                 // advance n logic frames synchronously (rendering continues)
UB.debug.pressed(action, frames) // hold an input action for n logic frames (keyboard-independent)
UB.debug.newGame(fighterId) / continueGame() / toTitle()
UB.debug.save() / load() / reset()
UB.debug.audio()                 // {ctxState, voices, song, step, bpm}; UB.debug.mute()
UB.debug.rooms()                 // [{id, zone, w, h, exits:[...]}]  UB.debug.enemies() // [{type, x, y, hp, state}]
UB.debug.boss()                  // null | {id, hp, maxHp, phase, state, attack}
UB.debug.showHitboxes(on)
```

The engine must never read wall-clock time for logic (BRIEF rule 5); `UB.debug.step` is how tests make deterministic progress.
