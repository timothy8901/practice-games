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
* The platform's walkable top is the disc of radius 850 at **Z = 0**, centred
  on the origin. Blast zones: horizontal radius 2900, top +2600, bottom -1700.
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
| `Tools/gen_audio.py` | audio | synthesizes all 53 SFX/VO/music WAVs (numpy + macOS `say`) |
| `Tools/make_video.py` | content | frames + cue log → MP4 with a rebuilt soundtrack |
| `Tools/flip_glb_normals.py` | content | flips a sculpt that came out of the generator inside out |

Modules talk through `UMoteEventHub` (hits, KOs, announcements, flashes,
impacts). Presentation code never changes gameplay state.

## Asset paths (created by `Tools/import_content.py`)

* Fighters: `/Game/Art/Fighters/SM_<Key>_Body`, `SM_<Key>_Gauntlet`
  (`<Key>` = Blade, Arc, Disc, Maul, Bow, Flare, Cinder, Veil)
* Weapons: `/Game/Art/Weapons/SM_<Key>_Weapon`, plus `SM_Bow_Arrow`
  (Flare has no weapon — its gauntlets are the weapon)
* Arena: `/Game/Art/Arena/SM_Arena_Platform`, `SM_Sky_Island`,
  `SM_Crystal_Cluster`, `SM_Ruined_Pillar`, `SM_Brazier`
* The platform is the v2 re-sculpt (Thrixel project "Mote Rumble"): blockout
  `ecca009c-f5a8-4f61-b87c-9988ab089e37`, textured `74512866-ff52-44b1-9b8a-dfee805a55d8`
  against the original reference image `e804db1b-6f8a-4645-a96b-03ce3c7e60c6`. It
  comes out **inside out**, like the first one did: download it as
  `arena_platform_v2_raw.glb`, run `Tools/flip_glb_normals.py` to write
  `arena_platform_v2.glb`, then re-import with `MOTE_REIMPORT=SM_Arena_Platform`.
  The game warns in the log if the deck it measures faces down.
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
  -ForceRes -ResX=1280 -ResY=720 -MoteDemo -MoteShots -MoteQuitAfter=45 -nosplash -unattended
# Screenshots land in Saved/Shots/. Logs: ~/Library/Logs/Unreal Engine/MoteRumbleEditor/
```

Headless editor Python (content pipeline):

```bash
$UE/Engine/Binaries/Mac/UnrealEditor-Cmd "$PROJ" -run=pythonscript -script="$(pwd)/Tools/import_content.py" -unattended -nosplash -nop4
```

Trailer: `-MoteRecord=30 -ForceRes -ResX=1920 -ResY=1080` dumps 60 fps frames to
`Recordings/frames` and a cue log to `Recordings/cues.json`; then
`python3 Tools/make_video.py` builds `Recordings/mote_rumble_demo.mp4`.


## Traps that cost a day (all of them silent)

* **`-ResX/-ResY` alone do not size the window.** Without `-ForceRes` the game
  opens at whatever the saved user settings say - here 1440x1080 - so every
  recording came out 4:3 while the command line asked for 16:9, and the camera
  solved its framing against an aspect it was never rendered at.
* **A recording run wipes `Recordings/frames` at startup** (`StartPlay`). Never
  launch a second instance while a capture is in flight; it will delete the
  frames the first one has already written.
* **Material usage flags are not inferred.** A material used by an
  `InstancedStaticMeshComponent` without `bUsedWithInstancedStaticMeshes` is
  silently swapped for the default grey one at runtime - the arena's 90 embers
  rendered as grey marbles for the life of the project over this.

* **Sculpts come out inside out, and an inside-out slab's BOTTOM faces up.**
  Both arena platforms so far have. Anything that finds "the floor" by trusting
  winding measures the underside and stands the fighters inside the stone.
  `MeasureDeck` takes the highest broad horizontal surface whichever way it
  faces, counts a surface's larger facing rather than the sum of both (a thin
  plate's two faces round into one height bucket), and logs a warning when the
  deck it picked faces down.
* **A weapon posed at a fixed angle goes through the floor if it is long enough.**
  The roll's -60 degrees put Blade's odachi tip 80 cm under the stage on every
  dodge. `BuildPose` now lifts the pitch just enough to rest a grounded fighter's
  weapon tip on the deck.
* **`RimPower` does nothing on a cube.** All of `M_FX_Additive`'s softness is
  the fresnel term `pow(saturate(dot(N,V)), RimPower)`, and a cube's face
  normals are constant across each face - there is nothing to grade against, so
  the element renders as a hard-edged slab whatever you set. Anything that
  needs a soft edge has to be the sphere, stretched. A cube scaled to 0.05 on
  one axis is not a thin streak, it is a white quad.
* **Additive FX sum.** A dozen elements at intensity 6-10 land on the same
  pixels during a hit and clip to pure white, taking the fighter's accent
  colour with them. Budget the whole effect, not each element.
* **Interchange ignores import options** unless they are wrapped in an
  `InterchangePipelineStackOverride`. Without it `CombineStaticMeshesBehavior`
  never applies and a Thrixel GLB lands as ~15 separate static meshes.
* **`LevelEditorSubsystem.new_level()` will not overwrite** an existing map and
  reports nothing: the actors end up in an untitled level that never gets saved.
  Switch to a scratch level, delete the map, then create it.
* **Spawned lights default to Static mobility.** This project disables static
  lighting, so a static light contributes exactly nothing.
* **`unreal.Rotator(a, b, c)` is (roll, pitch, yaw)**, not (pitch, yaw, roll).
  A "pitch -38" sun spent the day firing horizontally.
* **UE misspells `AerialPespectiveViewDistanceScale`** ("Pespective"), so the
  correctly spelled property silently does nothing.
* `FCanvasTriangleItem` asserts without a texture resource, and canvas text with
  a Slate font asserts unless the blend mode is translucent.
* **A flat cap has no vertices over its middle.** It is tessellated as a fan, so
  every vertex sits out at the rim. Sampling vertices to find the platform's
  walkable deck found a redundant inner face 10 mesh units down instead, and the
  art was fitted 88 cm too high - fighters stood buried to the waist. Measure
  *area*: total the footprint of horizontal, up-facing triangles by height and
  take the highest surface wide enough to be the floor (`FindDeckTop`).
