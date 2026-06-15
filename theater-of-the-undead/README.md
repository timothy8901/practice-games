# THEATER OF THE UNDEAD

A single-player, top-down, twin-stick **Call of Duty: Black Ops Zombies** clone of the map
**Kino der Toten**, rendered in the low-poly visual style of classic **RuneScape**.

Built with vanilla JavaScript + Three.js (vendored, no build step). All art is procedural
(canvas textures, primitive-built models) and all audio is synthesized via WebAudio — no asset files.

## Run

```bash
cd theater-of-the-undead
python3 -m http.server 8124
# open http://localhost:8124
```
Add `?debug` to the URL for an FPS counter.

## Controls

| Action | Keyboard / Mouse | Controller |
|---|---|---|
| Move | WASD | Left stick |
| Aim | Mouse | Right stick |
| Fire | LMB | RT / RB |
| Reload | R | X |
| Buy / Use / Interact | F (hold F to repair a window) | A |
| Knife | V | B |
| Grenade | G / RMB | LT / LB |
| Monkey bomb | T | Y |
| Swap weapon | Q | R-stick click |
| Rotate / zoom camera | ◀ ▶ (or middle-mouse drag) / wheel | D-pad |
| Pause | P / Esc | Start |

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
- **Look**: low-resolution render target upscaled with nearest-neighbour for chunky pixelation,
  flat-shaded low-poly models, tiny palette-limited textures, and linear fog as the draw-distance wall.

## Architecture

`js/main.js` — boot, render pipeline (low-res RT → nearest upscale), state machine, game loop.
`config.js` data tables · `mapdata.js` Kino layout · `textures.js` procedural canvas textures ·
`world.js` map geometry · `nav.js` walkability grid + BFS flow-field · `input.js` keyboard+mouse+gamepad →
unified intent · `camera.js` overhead orbit + aim raycast · `player.js` · `zombie.js` AI + pool ·
`characters.js` models · `weapons.js` · `rounds.js` · `perks` (in player/config) · `box.js` · `powerups.js` ·
`interact.js` · `fx.js` particles · `audio.js` synth · `hud.js`.

Original code & art — a fan tribute, not affiliated with Activision / Treyarch or Jagex.
