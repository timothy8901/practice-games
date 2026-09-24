# Rat in a Ball — 64 Environmental Pieces

Built from `ENVIRONMENT_PIECES_DOCUMENTATION.md` (what the pieces are) and
`PHYSICS-ENGINE-HANDOFF.md` (what the physics will actually do with them).

Each piece is real 3-D geometry whose render buffers and collision triangles come
out of the same mesher pass, carries the sockets and surface numbers the
documentation tabulates, and declares its runtime behaviour as data. There are no
sprites, no placeholder boxes, and no second collision mesh to drift out of sync.

```
3d-mazeball/
  src/mesher.js      geometry + collision in one pass, zero dependencies
  src/kit.js         grid standard, materials, path and profile helpers
  src/pieces.js      the 64 pieces, the category table, the decisions log
  src/behaviors.js   surfaces, latched impulses, fields, triggers, moving bodies
  src/selftest.js    52 checks + 4 provocations that must go red
  src/rng.js         hash32 / mulberry32 / shuffle — copied verbatim, handoff §12
  src/physics.js     the solver, GridCollider, and the §10 self-tests
  src/dynamics.js    DynamicBody: the moving parts a triangle soup cannot express
  src/generator.js   the daily maze — topology, socket matching, difficulty
  src/assemble.js    placement → merged geometry, colliders, spawn, route
  src/validate.js    the publish gate: graph, clearance, headless bot
  test.mjs           headless runner:  node 3d-mazeball/test.mjs
```

Nothing here imports Three.js or anything else. The review page renders it with
its own ~250-line WebGL viewer; a game would render it with whatever it likes.

---

## 1. The grid standard

| | Value | Source |
| --- | ---: | --- |
| Tile | 10.0 × 10.0 m | documentation §2, unchanged |
| Track width | **2.4 m** (6.9 r) | changed — decision **D02** |
| Narrow beam | 1.05 m (3 r) | handoff §4.3 "playable minimum" |
| Ball radius | 0.35 m | handoff §3, maze column |
| Elevation L0 / L1 / L2 | 0 / **+1.0** / **+2.0** m | changed — decision **D03** |
| Deck thickness | 0.32 m | |
| Kerb / rail height | **0.55** / 0.62 m | changed — decision **D08** |

Local space is the engine's cell convention: `+X` east, `+Z` south, `Y` up, so
north is `−Z` (matching `DELTA.N = [0, −1]` in the original `sockets.js`).

Sockets are per-edge elevation levels — `{ S: 0, N: 1 }` means "open on the south
edge at L0, open on the north edge at L1". An absent edge is closed. Air ports
(`#32 → #33`, `#50 → #51`) and portal pairs (`#53 ↔ #54`) are declared separately
via `air` and `pairWith`.

Every open edge is stubbed 0.12 m past the tile boundary so neighbours overlap
rather than meet on a hairline (handoff §4.2 — a hairline crack at a corner
catches the ball).

## 2. Physics contract

The kit is authored against the handoff's maze tuning column:

```
GRAVITY 18   MAX_TILT 0.30 rad   FIXED 1/120   maxSpeed 14   drag 0.997
```

Two consequences shape almost every piece:

- **Max commandable acceleration is `g·sin(MAX_TILT)` = 5.32 m/s².** Every ramp
  grade, every wind field and every belt speed in the kit is checked against it.
  That check is in the suite, not just in a comment.
- **`maxSpeed × FIXED = 0.117 m` must stay under the ball radius** (handoff §2.6)
  or the ball tunnels through walls. This is what caps the size-modifier tunnel
  at 0.5× rather than 0.25×.

`friction` is fed straight into the slip impulse and is a **grip** coefficient,
not a Coulomb µ (handoff §2.4) — see D01. `bounce` is restitution and must stay
below 1 — see D04.

Colliders are emitted **one per material** (handoff §2.4), so a piece with a
timber deck and steel rails hands the solver two `GridCollider`s with the right
numbers on each. `buildPiece(id).colliders` is already in that shape.

## 3. Decisions taken

Eight places where the two source documents disagreed, where the spec could not
be built as written, or where playing it proved a number wrong. All eight are
reviewable items in `review/`.

| | Decision | Why |
| --- | --- | --- |
| **D01** | Friction column read as grip, not µ | Handoff §2.4 warns the convention is easy to invert. The documentation's own ordering (0.05 ice, 0.95 melted cheese) already reads as grip, so all 64 values transfer verbatim. |
| **D02** | Track 4.0 m → 2.4 m | 4.0 m is 11.4 r against a 0.35 m ball — wider than the guide's own "generous / tutorial" tier. Handoff §4.3 says to set corridor width from the ball. |
| **D03** | Elevation steps +3/+6 m → **+1.0/+2.0 m** | +3 m over a 10 m tile is 16.7°, and gravity down that slope is 5.17 m/s² against 5.32 m/s² of tilt — the *gentle* ramp would have been unclimbable from rest. 2.0 m is close to the arithmetic ceiling for a one-tile climb once the ramp's eased ends are accounted for. |
| **D04** | e = 1.80 and e = 1.20 re-expressed as latched impulses | The solver applies `v += n·(1+e)·|vn|`; e > 1 adds energy every contact and diverges. #41 gets e = 0.62 + a latched +20 m/s radial kick, #45 gets e = 0.50 + a latched +11 m/s vertical snap. |
| **D05** | Diagonal NE/NW sockets mapped onto the square lattice | #11/#12 become centred S→N doglegs; #19 becomes S in, N and E out. Keeps Wave Function Collapse on a plain 4-neighbour grid. |
| **D06** | #15 hairpin needs a two-lane edge | Its documented sockets are `S_in` and `S_out` — two ports on one edge, the only piece in the kit that needs this. Buildable, but not WFC-placeable as it stands. |
| **D07** | #30/#31 are 180° banked loops, not 360° corkscrews | A true corkscrew entering S and leaving N on the same centre-line self-crosses, and there is not enough elevation to clear a ball plus a deck at the crossing. |
| **D08** | Kerb height 0.30 m → **0.55 m** | Hopping a kerb needs `v ≥ √(2gh)`; at 0.30 m that is 3.3 m/s, less than the ball picks up crossing its own corridor. Kerbed corridors did not contain it and the solvability bot fell out 61 times a run. This is the "how much Monkey Ball" dial — the pieces meant to drop you have no kerb and are unaffected. |

## 4. Behaviour model

`behaviors.js` expresses everything the fixed-step loop needs as data, and owns
the three traps the handoff already paid for:

- **`Latch`** — every one-shot impulse is gated on one. An effect applied "while
  grounded" fires 120×/s and becomes a rocket (handoff §11.3). There is a test
  that counts the firings.
- **`teleport()`** — lands the ball `exitOffset` past the destination, *outside*
  its own trigger radius, and puts the pair on a cooldown (handoff §11.4). A
  blind bot found the resulting soft-lock in 40 s last time.
- **`worldToLocalYaw` / `localToWorldYaw`** — spelled out in both directions
  because the world→local transform for a yawed box is the transpose, not the
  same matrix with a negated angle (handoff §8). Getting it backwards mirrors
  the collider and reads as a physics glitch rather than a maths error.

Conveyors are modelled as a **belt velocity the friction impulse chases**, not as
a constant acceleration — a raw +8 m/s² would run the ball to the speed clamp
instead of settling at the 8 m/s the documentation quotes. There is a test that
integrates the belt for five seconds and asserts it converges on −8.

Moving parts (`bodies`) are descriptors for handoff §8 `DynamicBody`: pendulum,
spindle, boulder, drawbridge, lift, turntable, trapdoor, switch blade, spikes,
key gate, boss arms. Their phase comes from stage time only — never wall-clock,
never `Math.random` — or the daily stops replaying identically (handoff §5.2).

## 5. Tests

```bash
node 3d-mazeball/test.mjs
```

52 checks across registry, surfaces, geometry, sockets, playability, determinism
and behaviours — plus 4 **provocations** that deliberately break a piece and
assert the suite goes red.

The provocations exist because of the caution at the end of handoff §10: their
"geometry reaches every opening" check passed for the wrong reason, because it
sampled vertex proximity instead of surface coverage. The socket tests here
sample a disc of vertical columns against the real collision soup and ask whether
a ball would find support at the socket's elevation.

Four defects the suite caught while the kit was being written, none of which were
visible in a render:

- #13's spline overshot the tile boundary by 0.97 m (uniform Catmull-Rom
  overshoots on uneven control spacing; it is centripetal now, with straight
  tails into both ports).
- #30/#31 climbed linearly and so arrived 0.12 m below their socket level half a
  metre inside the edge, where the neighbouring tile expects to meet them flat.
- #16's banked profile left the deck centre 0.38 m above the socket at both
  ports — identical in the viewer, wrong at the join.
- The first closed-edge test flagged the wind fan's turbine housing as a leak; a
  wall standing at a closed edge is the correct thing to build there.

Two more the contact sheet caught that no assertion would have: four horizontal
cylinders (conveyor rollers, cheese wheel, fan disc, size tunnel) had been built
with the Y-axis `cyl()` and were standing up as posts, and a one-sided wall
profile left the wall's outer face open below the deck skirt.

## 6. The generator

`generator.js` → `assemble.js` → `validate.js` implements documentation §4's four
phases. `review/maze.html` drives the result.

**Phase 1, topology.** A recursive backtracker with a straightness bias produces
a perfect maze; the solution is the tree's diameter, and a handful of dead-end
spurs are kept off it. The bias is not cosmetic — handoff §5.3 makes long
straights before tight turns the primary difficulty knob, and only three of the
64 pieces are corners against roughly thirty straights, so an unbiased maze is
half made of the same three tiles.

**Phase 2, socket matching.** Every piece is indexed by the four-character
signature it presents at each rotation (`"0-0-"` is a north-south straight at
ground level). A cell's required signature is looked up exactly, so a piece can
only be placed where its sockets and elevations already agree. All 15 flat
signatures the lattice can ask for are covered.

**Phase 3, difficulty.** Candidates are weighted by *danger band* against a
budget curve that rises along the solution. Weighting per piece instead lets the
thirty calm straights out-vote the eight hazards by sheer count no matter what
the budget says — hazards came out at 3% of every maze until this was banded.
Checkpoints, cheese and clocks are injected on plain straights; the portal pair,
the secret exit and the boss chamber take structural slots.

**Phase 4, assembly.** Pieces are rotated and translated once, into the same
buffers the mesher emitted. Render geometry merges by material (12–15 draw calls
for a whole maze); collision merges by *surface* — material plus friction plus
bounce — because the solver reads one `{friction, bounce}` per collider.

Elevation can only be a **bump**: one climbing cell immediately followed by a
descending one. No piece in the set is flat at L1 or L2, so a plateau is not
expressible. That is a property of the 64 pieces, not a shortcut.

### The publish gate

`node 3d-mazeball/test.mjs` covers the kit. For a seed, `validateSeed()` runs
handoff §5.5's three checks — graph reachability through matching sockets,
corridor clearance against a real ball, and a headless follow-the-path bot — plus
reproducibility. `validateRun()` sweeps a run of days the way a nightly job would.

The bot distinguishes two outcomes deliberately. **Open** means it reached the
goal, which proves the route exists. **Clean** means it drove every metre
unaided. A seed that is open but not clean lists exactly which segments needed
help, so "the route is closed" and "a proportional controller is not clever
enough" never get conflated. At the time of writing, 12 of 14 consecutive days
are open and 2 are clean; the recurring hard segments are the climbing loops
(#30/#31), the moving tile (#39) and the dashed gap (#3).

## 7. What is not here

- **No `DynamicBody` sag** for #34 — the suspension bridge is static geometry
  with the sag baked in, because making the walkway itself dynamic would leave
  the ball nothing to stand on.
- **Trapdoor, drawbridge and switch gate run on timers**, not on contact. The
  descriptors carry the contact fields; the runtime ignores them for now.
- **#15, #32/#33, #50/#51 and #62 are not auto-placed** — see `NOT_AUTO_PLACED`
  in generator.js for the reason on each. #62 is the sharp one: the gate opens on
  a Key item and no piece grants one, so placing it would wall off the maze.
- **No scoring, no timer UI, no leaderboard.** Pickups are declared, not counted.
- **The two non-open days in a 14-day sweep are not diagnosed.** They fail the
  gate, which means they would not publish; what is wrong with them is unknown.
