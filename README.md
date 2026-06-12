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

## Kirby Brawler 2: Rumble Arena

A top-down 3D sequel — `kirby-rumble.html`. One circular arena, chunky
low-poly toy fighters built in Three.js, and the same 8 copy abilities —
each with **two attacks** (`H` / `J`, or `X` / `Z`) and a **shield** (`K`,
or `Shift` / `C`) — against a CPU Kirby with a random ability. Move with
WASD / arrows, **`Space` jump-dodges** over swings and projectiles, `P`
pauses, `M` mutes. It pulls Three.js from a CDN but is still a single
self-contained HTML page.

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
