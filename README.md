# practice-games

This workspace contains small browser games (HTML/JS) used for practice.

## Kirby games

- **Kirby Brawler** (`kirby-abilities.html`) — 2D Smash-style fighter.
  8 copy abilities, gauntlet mode, all inline-SVG art.
- **Kirby Brawler 2: Rumble Arena** (`kirby-rumble.html`) — top-down 3D
  sequel on one circular arena. Chunky low-poly toy fighters (Three.js),
  the same 8 abilities — each with **two attacks** (`H` / `J`, or `X` / `Z`)
  and a **shield** (`K`, or `Shift`/`C`) — against a CPU Kirby with a
  random ability. Move with WASD/arrows, **`Space` jump-dodges** over
  swings and projectiles, `P` pause, `M` mute.

Both are single self-contained HTML pages (the sequel pulls Three.js from
a CDN). The homepage `index.html` links to every game in the repo.

Dictionary / wordlist notes
--------------------------

The Baker's Dozen game supports validating player words against a wordlist. By default
the game tries to load `wordlist.txt` (one word per line) from the same folder. If
`wordlist.txt` is missing or fails to load, the game falls back to a small embedded
dictionary included in the HTML.

Important: the official Scrabble dictionaries (OSPD / Collins) are copyrighted and
cannot be redistributed here. If you have a licensed copy of an official Scrabble
word list, replace `wordlist.txt` with that file (or adjust the game to query a
licensed API). Alternatively, use a public-domain or open wordlist such as the
SCOWL/word-lists or other permissively licensed lists.

To replace the wordlist:

1. Put a file named `wordlist.txt` in the project root (same folder as the game HTML).
2. Each line should contain a single word. Case doesn't matter; the loader upper-cases words.
3. Reload the page — the game will load the file on startup.

If you'd like, I can add an option to fetch a hosted wordlist or integrate a licensed
dictionary API; tell me which source you prefer and I will wire it up.
