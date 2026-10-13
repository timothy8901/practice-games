# UNDERBYTE — Project Brief (read this first)

## What this is
An original browser game for the `practice-games` repo. Genre mash-up:

* A **2D Metroidvania platformer**: an atmospheric, hand-drawn-feel underground kingdom,
  interconnected rooms, save/heal points, ability-gated exploration, zone bosses, a final boss.
* Whose playable characters are a roster of **original "digital monster" brawlers** with
  **fighting-game movesets**: light chain, heavy, unique special, air attack, down-strike,
  and a meter-driven temporary **power-up transformation** ("Overclock").

Working title: **UNDERBYTE**. Premise (original): a buried server-kingdom whose data has
rotted into monsters; you are a "Spirit" — a sentient program — fighting down through its
layers to purge the corrupted Root Process.

## Hard rules (non-negotiable)
1. **100% original content.** No names, characters, designs, levels, music, dialogue, text,
   or assets from Digimon, Hollow Knight, Pokémon, or any other franchise. No near-lookalikes
   either (no orange T-rex-ish lizard with green eyes, no small white-masked bug knight with a
   nail, no yellow electric mouse, etc.). If a reviewer could mistake something for an existing
   franchise character, redesign it. All names are invented words. Do not use the words
   "Digimon", "Digivolve", "Hollow Knight", "Hallownest", "Knight", "Nail", "Geo", "Soul" or
   any franchise term anywhere in code, comments, UI, or docs.
2. **Pure vanilla JS + Canvas 2D + Web Audio.** No frameworks, no CDN, no npm deps at runtime,
   no `fetch()`/XHR, no image/audio/font files. All art is drawn with canvas path commands
   (procedural, hand-drawn feel); all audio is synthesized with Web Audio oscillators/noise.
   Must run from `file://` by double-clicking `index.html`, and on GitHub Pages.
3. **Multi-file layout** under `underbyte/`: `index.html` loads `js/*.js` with plain
   `<script>` tags in a fixed order (no ES modules, so `file://` works). Every module attaches
   to the single global namespace `UB` (e.g. `UB.Engine`, `UB.Characters`, ...). Strict mode,
   no globals other than `UB`.
4. **Keyboard + gamepad** required; on-screen touch controls are a nice-to-have.
5. **Fixed 60 Hz logic timestep** with an accumulator; render every animation frame. Logic must
   not depend on wall-clock deltas (so automated tests are repeatable).
6. **Debug/test API** on `window.UB.debug` (specified in CONTRACT.md) so Playwright tests can
   read state, warp between rooms, grant abilities, and set HP. Debug API never affects normal
   play unless invoked.
7. Logical canvas **960×540**, scaled to fit the window (letterboxed), crisp rendering.
8. Target 60 fps on a mid laptop. No per-frame allocations in hot paths where avoidable.
9. Everything is verified by automated **Playwright** playthroughs
   (`underbyte/test/harness.cjs` provides the launcher; `playwright` is installed globally
   and resolvable via `require('playwright')`).

## Scope (ship ALL of this — it must be fully playable start to finish)
* **Screens:** Title (New Game / Continue / Settings) → Character Select (5 fighters, stats
  and moveset preview) → Game. Pause menu (resume, map, settings, quit to title). Map screen
  (discovered rooms, current room, restore nodes). Game over (respawn at last restore node).
  Victory screen with run stats (time, deaths, bits collected, fighter used).
* **World:** 5 zones, **20–24 rooms** total, interconnected (not linear), in a tile grid.
  Three ability gates in a fixed order of acquisition: **Double Jump → Dash → Wall Cling/Jump**.
  Each ability is guarded by a zone boss. A fourth boss is the **final boss** (2 phases).
  **Restore Nodes** (save + full heal + enemy respawn) in every zone. Currency **"bits"** drops
  from enemies; a vendor sells 1–3 upgrades (optional but nice). **3 hidden "cores"** that each
  add +1 max HP (secret alcoves, some need later abilities → backtracking).
  Hazards: spikes (respawn at room entry edge, −1 HP), acid/static pools, crumbling platforms,
  moving platforms (at least in one zone).
* **Enemies:** 8–10 types with distinct behaviors (patroller, hopper, flyer, turret/spitter,
  charger, shielded, swarmer, ceiling dropper, etc.) with zone-themed variants.
* **Fighters:** 5 original brawlers. Shared kit: run, jump (variable height), light attack
  (3-hit chain), heavy attack (slower, knockback), unique special (costs energy), air attack,
  down-strike (pogo off enemies/spikes), plus acquired abilities. **Overclock meter** fills from
  landed hits and pickups; when full, press the Overclock key to transform for ~12 s: bigger
  palette-shifted form, +damage, +speed, special becomes an ultimate. Each fighter has distinct
  stats (HP, speed, jump, weight) and feel.
* **Save:** localStorage, one slot (fighter, room, abilities, cores, bits, discovered map,
  defeated bosses). Continue from title.
* **Audio:** synthesized ambient music per zone + boss music; SFX for jump, land, hits, hurt,
  pickup, menu, boss roar, overclock.
* **Feel:** hitstop on hits, screen shake, particles, squash/stretch, damage flashes.

## Repo conventions
* Multi-file games live in their own folder (see `theater-of-the-undead/`). Do **not** edit the
  repo root `index.html` or root `README.md` — the user has asked that the game not be put on
  the site yet. The game gets its own `underbyte/README.md`.
* No build step. No dependencies.
