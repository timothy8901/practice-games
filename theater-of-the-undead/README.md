# THEATER OF THE UNDEAD

A single-player, top-down, twin-stick **Call of Duty: Black Ops Zombies** clone of the map
**Kino der Toten**, rendered in the low-poly visual style of classic **RuneScape** — playable as
one of four survivors **or as any of the 1,025 Pokémon**.

Built with vanilla JavaScript + Three.js (vendored, no build step). All art is procedural
(canvas textures, primitive-built models) and all audio is synthesized via WebAudio — no asset
files. The one exception is the Pokémon roster: sprites and cries stream from the
[PokeAPI archives](https://github.com/PokeAPI/sprites) at play time (and the game falls back to
type-coloured tokens when it can't reach them).

## Run

```bash
cd theater-of-the-undead
python3 -m http.server 8124
# open http://localhost:8124
```
Add `?debug` to the URL for an FPS counter. `?roster=pokemon` opens the Pokémon roster;
`?mon=25` preselects a Pokémon by Pokédex number (Pikachu, in this case).

## Controls

| Action | Keyboard / Mouse | Controller |
|---|---|---|
| Move | WASD | Left stick |
| Aim | Mouse | Right stick |
| Fire | LMB | RT / RB |
| Reload | R | X |
| Buy / Use / Interact | F (hold F to repair a window) | A |
| Knife (a Pokémon's type move) | V | B |
| Grenade | G / RMB | LT / LB |
| Monkey bomb | T | Y |
| Swap weapon | Q | L-stick click |
| Rotate / zoom camera | ◀ ▶ (or middle-mouse drag) / wheel | D-pad |
| Pause | P / Esc | Start |

**Roster screen:** TAB (or Y) flips between SURVIVORS and POKÉMON. On the Pokémon tab the search box
has focus: type to search by name or number (ESC leaves the box and keeps the query), browse with the
arrow keys / d-pad / left stick, the RANDOM button (or X on a controller, or R once you've left the
search box) picks one at random, ENTER (or A) begins. ALL / ORIGINAL 151 filters the grid for this
visit.

## Features

- **Kino layout**: stage (spawn), lobby, alley, dressing room, power room, upstairs (Pack-a-Punch).
  Areas are door-gated and bought with points, which rebuilds zombie navigation.
- **Round-based horde survival** with escalating health/speed/counts and **hellhound rounds**.
- **Barrier windows** zombies break through and climb; repair them for points.
- **Economy**: points for hits/kills/repairs; spend on doors, wall-buys, perks, box, Pack-a-Punch, traps.
- **4 Perk-a-Colas**: Juggernog, Speed Cola, Double Tap, Quick Revive (power-gated except QR).
- **Mystery Box** (rolls a random weapon, occasionally moves), **Pack-a-Punch** (link the teleporter
  mainframe to enable it), **electric traps**.
- **Power-ups**: Max Ammo, Insta-Kill, Nuke, Double Points, Carpenter.
- **Weapons**: M1911, M14, Olympia, MP5K, AK74u, MPL, Stakeout, M16, Commando, Galil, FAMAS, HK21,
  Ray Gun, Thundergun, China Lake, Monkey Bombs — each with a Pack-a-Punch upgrade.
- **4 cosmetic survivors**: Dempsey, Nikolai, Takeo, Richtofen.
- **1,025 Pokémon survivors.** Pick any Pokémon and it takes the field as a pixel-sprite billboard
  that always faces the camera, swapping between its front and back sprite (and mirroring) as it
  turns, carrying the gun at its hip, sized from its real height (Joltik to Wailord, clamped so
  everything stays readable). Base stats bend the run: **HP** scales max health (0.75× Shedinja →
  1.5× Blissey; Juggernog scales with it), **Speed** sets run speed (0.8× → 1.25×), **Attack** sets
  knife damage (0.6× → 1.8×, and the knife is renamed to a move of its type: Pikachu's THUNDER SHOCK,
  Charizard's EMBER…), **Defense** is armor (damage taken 1.2× → 0.7×). Its cry plays on the way
  in and when it goes down. Your pick is remembered.
- **Look**: low-resolution render target upscaled with nearest-neighbour for chunky pixelation,
  flat-shaded low-poly models, tiny palette-limited textures, and linear fog as the draw-distance wall.

## Architecture

`js/main.js` — boot, render pipeline (low-res RT → nearest upscale), state machine, roster screen, game loop.
`config.js` data tables · `pokedex.js` the 1,025-species table (from PokeAPI's CSVs), stat → multiplier
mapping, sprite / cry URLs · `mapdata.js` Kino layout · `textures.js` procedural canvas textures ·
`world.js` map geometry · `nav.js` walkability grid + BFS flow-field · `input.js` keyboard+mouse+gamepad →
unified intent · `camera.js` overhead orbit + aim raycast · `player.js` · `zombie.js` AI + pool ·
`characters.js` models (procedural humans, hellhounds, and the Pokémon sprite billboard) · `weapons.js` ·
`rounds.js` · `perks` (in player/config) · `box.js` · `powerups.js` · `interact.js` · `fx.js` particles ·
`audio.js` synth + streamed cries · `hud.js`.

Original code & art — a fan tribute, not affiliated with Activision / Treyarch or Jagex. Pokémon, its
names, sprites and cries are © Nintendo / Creatures / GAME FREAK; this is a non-commercial fan project.
The sprites and cries stream from the community PokeAPI archives and are not shipped here; the species
table (names, types, base stats, sizes) is built from PokeAPI's open data files.
