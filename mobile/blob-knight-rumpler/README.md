# Blob Knight Rumpler (Android)

Blob Knight Rumpler is the phone game built from the Rumble Arena engine: the
same fighting, wearing the Thrixel art from Mote Rumble, with touch controls and
every fighter renamed to the core it wears. Produces an installable Android app
and a zip to hand around.

The engine page is `kirby-rumble.html` on `origin/main` - the published browser
game, which this build reads and never modifies. Every name it carries from that
era is renamed on the way in (`rename_patches()` in build.py, and web/rename.js
for the fighters), so nothing in the app or its page carries the old name.

```bash
python3 build.py
```

Output: `dist/BlobKnightRumpler-Android.zip` holding `BlobKnightRumpler.apk`, install
notes (`INSTALL.txt`) and `web/index.html`, the same page as a single web file.

## How it works

- **The page.** `build.py` takes the engine page from `origin/main` (or
  `--source FILE`), inlines three.js r152 from `vendor/` so it runs offline, and
  injects `web/mobile.css` and the four layers in `web/`. It also patches lines of the
  game: the viewport meta, the renderer height (full screen), the resolution cap
  (so slow phones can lower it) and the two lines that read movement keys (they
  also read the touch stick's `game.input.ax/az`).
  Each patch must match exactly once or the build stops, so a changed game
  can't produce a quietly broken APK.
- **Touch controls** (`web/mobile.js`): a floating stick on the left half; Attack,
  Special, Shield (hold) and Jump on the right, with cooldown rings; pause and
  sound at the top. They drive `game.input`, the same object the keyboard sets.
  The layer also pauses the fight when the app or tab goes to the background,
  starts phones at 1.5x resolution and drops it (then shadow detail) when the
  frame rate can't hold, and exposes `KB.back()` / `KB.appPause()` for Android. They switch on
  for touchscreens; `?touch=1` / `?touch=0` force them on or off.
- **The art** (`web/thrixel-art.js`, `web/models.js`, `models/`): each ability maps
  to the core built from it for Mote Rumble - sword/Blade, beam/Arc, cutter/Disc,
  hammer/Maul, archer/Bow, fire/Flare, bomb/Cinder, parasol/Veil, which is also how
  they are named on screen (web/rename.js) - so a fighter is
  a Mote body, its two floating gauntlets and its weapon, on the stone arena with
  the floating islands behind it. The rig is untouched: the layer swaps what
  `parts.body`, the arm pivots and `parts.weapon` look like, nothing about how they
  move. It also switches the scene to Mote Rumble's dusk light and filmic tone
  mapping, without which the stone clips to white.
  `tools/pack_models.py` turns the 10 MB Thrixel GLBs into ~300 KB ones (the
  geometry is already small; the 2048px PBR textures are what weighed) and
  measures the arena's deck so the game seats it exactly. Run it after changing
  the art; `models/` is committed, `thrixel_assets/` is not.
- **The app** (`android/`): one Activity with a full-screen WebView. The page is
  served from a virtual https host backed by the APK's assets rather than from
  file://, so `fetch()` can read the models and nothing on the phone's filesystem
  is reachable. Landscape, immersive, screen kept on, Back routed to the game,
  renderer crashes recovered by reloading. minSdk 24 (Android 7.0), targetSdk 34.
- **No Gradle.** The SDK's build-tools (`aapt2`, `d8`, `zipalign`, `apksigner`),
  `platforms/android-34` and a JDK 17 are all it needs.

## Signing key

The first build creates `~/.android/blob-knight-rumpler.jks` with a random password
in `~/.android/blob-knight-rumpler.jks.password`. Both stay out of git. Back them up:
Android only installs an update over an existing install when both builds were
signed with the same key. Raise `--version-code` for each build you hand out.

## Icons

`icon/foreground.svg` and `icon/background.svg` are the adaptive icon's layers.
`python3 icon/render_icons.py` (needs `rsvg-convert` and Pillow) re-renders the
PNGs in `android/res/mipmap-*`, which are committed.

## Testing

`python3 build.py --debuggable` writes `dist/BlobKnightRumpler-debug.apk`, which
Chrome DevTools can attach to (`chrome://inspect`). An emulator works: the
`KB_Phone` AVD in `~/.android/avd` (Android 14, arm64, 1080x2400, WebView 113) boots headless
with `emulator -avd KB_Phone -no-window -gpu swiftshader_indirect`; then
`adb install -r dist/BlobKnightRumpler.apk` and
`adb shell am start -n com.tokenmaxxers.blobknightrumpler/.MainActivity`. The page's
console goes to logcat under the tag `BlobKnightRumpler`. The emulator draws WebGL
on the CPU at a few fps, so it proves behaviour, not speed.
