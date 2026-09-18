# Mote Rumble — design & engineering contract

A 3D platform-fighter for Unreal Engine 5.8 (Mac, Metal), in the spirit of
Super Smash Bros. Ultimate with Monster-Hunter-weight weapons. Original IP by
Not Tim Games. This document is the contract between the modules; the headers
in `Source/MoteRumble/` are the source of truth for signatures.

## The game

* **Fighters ("Motes")**: limbless floating spirit knights. An egg-shaped
  armoured body, two detached floating gauntlets, one oversized weapon.
  Eight of them, one per Core: Blade (odachi), Arc (lightning glaive), Disc
  (returning chakram), Maul (war hammer), Bow (recurve bow), Flare (fire
  gauntlets), Cinder (bombs), Veil (battle parasol). Data lives in
  `MoteFighterData.cpp`.
* **Rules**: Smash-style. Damage is a percent that only rises; knockback grows
  with it (the real Smash formula, `AMoteCharacter::ComputeKnockback`). You are
  KO'd by leaving the blast zones around a floating circular platform. 3 stocks.
* **Controls** (`MotePlayerController`): WASD move (camera-relative), Space
  jump (x2 air jumps, hold while falling to hover), H light (3-hit combo /
  aerial), J heavy (hold to charge; the fighter's signature), K shield
  (+direction = roll), L dodge (air dodge = recovery), P pause.
* **Flow** (`MoteGameMode`): Title (CPUs spar behind the logo) → Select (P1,
  then rival/Random + CPU level) → Intro (camera sweep, fighters beam in) →
  Countdown (READY? 3 2 1 GO!) → Fight → GameSet (slow-mo final KO, "GAME!") →
  Results (winner pose, stats, Rematch / Change fighters).

## Space conventions

* UE units: cm, seconds, degrees. +X forward, +Y right, +Z up.
* The platform's walkable top is the disc of radius 1500 at **Z = 0**, centred
  on the origin. Blast zones: horizontal radius 4300, top +3400, bottom -2300.
* The gameplay camera looks along **+X** from the -X side, pitched down 30–40°.
  So P1 spawns at -Y (screen left) facing +Y, P2 at +Y facing -Y.
* A fighter's capsule is radius 46, half-height 64. Its `VisualRoot` sits 30 cm
  above capsule centre; the body (130 cm tall) is centred on `BodyPivot`.

## Modules and ownership

| File | Owner | What |
|---|---|---|
| `MoteTypes.h`, `MoteFighterData.cpp` | core | enums, move/fighter data, tuning |
| `MoteCharacter.*` | core | fighter state machine, moves, hitboxes, knockback, shield, dodge |
| `MoteGameMode.*` | core | match flow, stocks, blast zones, menus, slow-mo, demo/record modes |
| `MotePlayerController.*` | core | input |
| `MoteProjectile.*` | core | arrows, discs, bombs, bolts, fireballs, lightning |
| `MoteArena.cpp` | core | walkable disc, blast zones, spawn points, respawn halos |
| `MoteEvents.*`, `MoteAudio.*` | core | event hub, sound playback + cue log |
| `MoteAnimator.*` | animation | procedural choreography of body, hands, weapon |
| `MoteFX.*` | vfx | every transient effect + weapon ribbon trails |
| `MoteCameraDirector.*` | camera | framing, shake, cinematic modes |
| `MoteHUD.*` | ui | all 2D: title, select, damage panels, banners, pause, results |
| `MoteAIController.*` | ai | CPU opponent |
| `MoteArenaScenery.cpp` | scenery | platform art, sky islands, props, embers, lights |
| `Tools/import_content.py` | content | imports art/audio, authors FX materials, builds the level |
| `Tools/gen_audio.py` | audio | synthesizes all SFX/VO/music WAVs |
| `Tools/make_video.py` | content | frames + cue log → MP4 with a rebuilt soundtrack |

Modules talk through `UMoteEventHub` (hits, KOs, announcements, flashes,
impacts). Presentation code never changes gameplay state.

## Asset paths (created by `Tools/import_content.py`)

* Fighters: `/Game/Art/Fighters/SM_<Key>_Body`, `SM_<Key>_Gauntlet`
  (`<Key>` = Blade, Arc, Disc, Maul, Bow, Flare, Cinder, Veil)
* Weapons: `/Game/Art/Weapons/SM_<Key>_Weapon`, plus `SM_Bow_Arrow`
  (Flare has no weapon — its gauntlets are the weapon)
* Arena: `/Game/Art/Arena/SM_Arena_Platform`, `SM_Sky_Island`,
  `SM_Crystal_Cluster`, `SM_Ruined_Pillar`, `SM_Brazier`
* Audio: `/Game/Audio/<wav name without extension>` (sfx_*, vo_*, mus_*)
* Level: `/Game/Maps/Arena` (lighting, sky, clouds, fog, post-process only;
  everything else is spawned at runtime by C++)

Every C++ load of these uses `LOAD_Quiet | LOAD_NoWarn` and falls back to
engine primitives, so the game always runs even with nothing imported.

## FX materials (`/Game/FX/`, authored by the content script)

All are **Unlit**. Parameter names are exact and case-sensitive.

| Material | Blend | Parameters | Use |
|---|---|---|---|
| `M_FX_Additive` | Additive, two-sided | `Color` (vec), `Intensity` (4), `Opacity` (1), `RimPower` (0) | glows, flashes, orbs. Emissive = Color·Intensity·Opacity·pow(saturate(dot(N,V)), RimPower) — RimPower 0 = flat, 1–3 = soft ball |
| `M_FX_Ring` | Additive, two-sided | `Color`, `Intensity`, `Opacity`, `RingRadius` (0.8, 0..1 of the plane half-size), `RingWidth` (0.12), `Softness` (0.5) | shockwaves, jump rings, telegraphs on `/Engine/BasicShapes/Plane` |
| `M_FX_Ribbon` | Additive, two-sided | `Color`, `Intensity`, `Opacity` | procedural ribbons: U = age (0 head → 1 tail), V = 0 base → 1 tip; alpha fades with U and softly at both V edges |
| `M_FX_Smoke` | Translucent, two-sided | `Color`, `Opacity`, `RimPower` (2) | dust, smoke puffs on spheres: opacity·pow(saturate(dot(N,V)), RimPower) |
| `M_FX_Shield` | Additive | `Color`, `Opacity`, `Intensity` | shield bubble: fresnel rim + faint fill |
| `M_FX_Overlay` | Additive | `FlashColor`, `FlashAmount`, `RimColor`, `RimAmount` | mesh overlay on every fighter part: FlashColor·FlashAmount + RimColor·RimAmount·fresnel |

## Building and running

```bash
UE=/Users/tim/Downloads/UE_5.8
PROJ=$(pwd)/MoteRumble.uproject   # absolute path to this worktree's project
$UE/Engine/Build/BatchFiles/Mac/Build.sh MoteRumbleEditor Mac Development -Project="$PROJ" -WaitMutex
# Play (uncooked) - exits by itself:
$UE/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor "$PROJ" -game -windowed \
  -ResX=1280 -ResY=720 -MoteDemo -MoteShots -MoteQuitAfter=45 -nosplash -unattended
# Screenshots land in Saved/Shots/. Logs: ~/Library/Logs/Unreal Engine/MoteRumbleEditor/
```

Headless editor Python (content pipeline):

```bash
$UE/Engine/Binaries/Mac/UnrealEditor-Cmd "$PROJ" -run=pythonscript -script="$(pwd)/Tools/import_content.py" -unattended -nosplash -nop4
```

Trailer: `-MoteRecord=30 -ResX=1920 -ResY=1080` dumps 60 fps frames to
`Recordings/frames` and a cue log to `Recordings/cues.json`; then
`python3 Tools/make_video.py` builds `Recordings/mote_rumble_demo.mp4`.
