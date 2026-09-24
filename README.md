# practice-games

A workspace of small browser games (HTML / vanilla JS). All games are single
self-contained HTML files — no build step.

## Featured: Kirby Brawler

A Smash-style fighter built entirely from inline SVG. Eight copy abilities,
each with a signature move and a chargeable special, plus a hidden final
boss and gauntlet mode.

- **Live game:** `kirby-abilities.html`
- **Homepage:** `index.html` (links to every game in the repo)

### How to play

| Key | Action |
|---|---|
| `←` / `→` | Move |
| `↑` / `Space` | Jump (press twice for a double-jump front flip) |
| `↓` | Guard (blocks damage while held on the ground) |
| `X` | Fast attack — three-tap combo for melee abilities |
| `Z` | Charged attack — hold to charge, arrow keys aim, release to fire |
| `H` | Take a test hit (free play only) |
| `P` | Pause / resume |
| `M` | Toggle sound on/off |

On a phone, a virtual D-pad + buttons appear automatically.

### Modes

- **Free Play** — pick any ability, swap whenever, infinite respawn. Pick a
  stage from the menu (Whispy Woods, Dedede's Stadium, Halberd Deck, or
  Galactic Arena).
- **Gauntlet** — choose one ability, locked for the whole run. Fight all 8
  copy abilities in random order across rotating stages, then a hidden
  final wave. Player KO ends the run; defeating the boss wins.
  - Heart pickups drop between waves so the run is survivable
  - Difficulty scales: later waves are faster and use charged attacks more
  - Boss enters phase 2 at half HP — fans out 3 projectiles per charged
    shot and guards reactively
  - Stats persist: best wave, best time, win/loss, per-ability wins

### Running locally

This is a static site — no build required.

```bash
# Option A — bare minimum (Python)
python3 -m http.server 8000
# Open http://localhost:8000/

# Option B — Docker (nginx + gzip + LAN binding)
docker compose up -d
# Open http://localhost:8080/kirby-abilities.html
# Reach it from a phone on the same wifi at
# http://<your-laptop-ip>:8080
```

A GitHub Pages deploy workflow lives at `.github/workflows/pages.yml`. After
merging into `main` and enabling Pages → Source: GitHub Actions, the site
goes live at https://timothy8901.github.io/practice-games/.

## Blob Knight Rumpler

A top-down 3D arena fighter — `blob-knight-rumpler.html`. One circular
arena, chunky low-poly blob knights built in Three.js, and eight cores —
Blade, Arc, Disc, Maul, Bow, Flare, Cinder and Veil — each with **two
attacks** (`H` / `J`, or `X` / `Z`) and a **shield** (`K`, or `Shift` /
`C`). Two single-player modes: a **1v1 duel** where you choose both
knights and the rules (1/2/3/5 KOs to win, an optional clock with sudden
death on a tie, and an Easy / Medium / Hard / Expert CPU), and
**survival**, an endless ladder of challengers that climbs a tier every
two rounds — your hearts carry from round to round and nothing heals
them, so the run ends when you are knocked out. Before either one you draw
**a buff card**: three of twelve are dealt (art generated with Thrixel, see
`card-art/`), and you take one or go in bare. **76 achievements** track as you
play — twelve overall and eight for each core — and **each one unlocks a
permanent buff**. A core's own eight only apply while you carry that core, so a
full save is a strong Blade rather than one unstoppable knight; the twelve
overall always apply. The whole list, with what each unlocks, is in
[`achievements/`](achievements/README.md) and in the game under Achievements on
the title screen. **Settings** holds two boost switches — the pre-match cards
and the achievement buffs, off independently — along with rebindable keys and a
save string you can copy out and paste back, since progress otherwise lives only
in that browser. Achievements keep tracking with the boosts off. Move with
WASD / arrows,
**`Space` jump-dodges** over swings and projectiles, `P` pauses, `M`
mutes. It pulls Three.js from a CDN, and its knights, arena and sky are
Thrixel models loaded from `knight-art/` beside the page - about 10 MB,
fetched once; the menu holds the first fight until they arrive.

## Grocery Tycoon

- **Grocery Tycoon** (`grocery-tycoon.html`) — a single-file produce-store tycoon
  in the spirit of *RollerCoaster Tycoon* / *Zoo Tycoon*, built around the tension
  of **perishable goods**. Grow a fruit stand into a hypermarket across five store
  tiers while managing inventory & pricing (a real demand curve), freshness &
  **spoilage** (green→yellow→brown, refrigeration, markdowns), a supply chain
  (co-op vs. distributor vs. depot, delivery times, refrigerated trucks, bulk &
  JIT), marketing with diminishing returns, four seasons, random events (heatwave,
  craze, festival, supplier disruption, bad press, health inspection), reputation,
  cashiers & stockers, a rival store, and a no-fail loan system. Real-time day clock
  with Pause/1×/2×/4×. Includes a full **110-achievement** system (categories,
  progress bars, secret `???` entries, completion %), a vegan "Green Thumb" challenge
  ladder, and `localStorage` autosave. Point-and-click / touch only; all balancing
  constants are grouped and commented at the top of the file. Pure vanilla JS, no
  build step — runs by double-clicking.

## Theater of the Undead

- **Theater of the Undead** (`theater-of-the-undead/`) — a top-down twin-stick
  **Call of Duty Zombies** clone of *Kino der Toten*, rendered in the chunky
  low-poly style of classic **RuneScape** (Three.js, vendored — no build step).
  Round-based horde survival with the power switch, 4 perks, the moving Mystery
  Box, Pack-a-Punch, wall-buys, traps, hellhound rounds, power-ups, and 4
  survivors. Keyboard + mouse **or** controller. A multi-file game, so it lives in
  its own folder; the homepage links to `theater-of-the-undead/index.html`.

## NEONFABLE — Void Survivor

- **NEONFABLE** (`neonfable.html`) — a single-file synthwave **bullet-heaven
  roguelite** in the spirit of *Vampire Survivors*. Weapons fire automatically;
  you only steer, dash and draft. **12 weapons** (Pulse Blaster, Orbital Blades,
  Homing Swarm, Arc Coil, Rail Lance, Flak Nova, Gun Drones, Void Field, Phase
  Glaive, Singularity Mines, Prism Ray, Phase Ram), each with a hidden
  **evolution** unlocked by pairing a maxed weapon with its partner passive, plus
  9 passives and a 3-card level-up draft with rerolls. Four bosses — Void Warden,
  Star Archon, Leviathan Prime, and the **ANTIFABLE**, a dark mirror of your own
  ship that appears at 15:00 — then an endless mode. Meta-progression: runs bank
  credits into a permanent hangar shop and 4 unlockable hulls, saved to
  `localStorage`. Also a **daily seeded run** (fixed loadout, identical spawns and
  drafts for everyone that day). Difficulty scales with your *level*, not just the
  clock — leveling speeds up spawns and unlocks tougher enemy types early.
  Finishing a run unlocks **BULLET HELL**, an optional modifier (off by default,
  armed from the hangar before launching) that adds the **Hellion** — a lime,
  ring-haloed emitter that hovers at range, telegraphs, then weaves rotating
  spirals of danmaku with an aimed shot in every wave. Capped at six alive, and
  force-disabled in daily runs so those stay identical for everyone.
  Controls: WASD/arrows + Space, an on-screen joystick and dash button on touch,
  or a gamepad with rumble. The soundtrack and every sound effect are **generated
  live** with the Web Audio API — no audio files. Pure vanilla JS + Canvas 2D, no
  build step, no dependencies.

## Cube Rings

- **Cube Rings** (`cube-rings.html`) — a touch-first Rubik's cube puzzle played on
  the cube's *graph*: three sets of three concentric rings, one ring per layer,
  with every sticker a dot where two rings cross and every face a cluster of
  nine dots. Swipe a dot along a ring and that layer turns, on the rings and on
  the 3D cube above them (drag the cube to look around it; double-tap to reset
  the view). **Timed Mode** scrambles the cube (Easy 2 turns, Medium 4, Hard 7,
  Expert 20), starts the clock on your first swipe, and shows your finishing
  time with a **Play again?** button; best times are kept per difficulty. The
  **Tutorial** walks through faces, rings, turning back, and picking between a
  dot's two rings, then has you solve a small scramble with hints. Undo, sound
  and haptics included. Single file, vanilla JS + Canvas 2D, no dependencies.

## Dictionary / wordlist notes

The Baker's Dozen game supports validating player words against a wordlist.
By default the game tries to load `wordlist.txt` (one word per line) from the
same folder. If `wordlist.txt` is missing or fails to load, the game falls
back to a small embedded dictionary included in the HTML.

Important: the official Scrabble dictionaries (OSPD / Collins) are
copyrighted and cannot be redistributed here. If you have a licensed copy of
an official Scrabble word list, replace `wordlist.txt` with that file (or
adjust the game to query a licensed API). Alternatively, use a public-domain
or open wordlist such as the SCOWL/word-lists or other permissively licensed
lists.

To replace the wordlist:

1. Put a file named `wordlist.txt` in the project root (same folder as the
   game HTML).
2. Each line should contain a single word. Case doesn't matter; the loader
   upper-cases words.
3. Reload the page — the game will load the file on startup.
