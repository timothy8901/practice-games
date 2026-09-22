# Kirby Brawler 2 for Android

Packages the browser game `kirby-rumble.html` (Kirby Brawler 2: Rumble Arena) as
an installable Android app with touch controls, plus a zip to hand around.

```bash
python3 build.py
```

Output: `dist/KirbyBrawler2-Android.zip` holding `KirbyBrawler2.apk`, install
notes (`INSTALL.txt`) and `web/index.html`, the same page as a single web file.

## How it works

- **The page.** `build.py` takes `kirby-rumble.html` from `origin/main` (or
  `--source FILE`), inlines three.js r152 from `vendor/` so it runs offline, and
  injects `web/mobile.css` and `web/mobile.js`. It also patches five lines of the
  game: the viewport meta, the renderer height (full screen), the resolution cap
  (so slow phones can lower it) and the two lines that read movement keys (they
  also read the touch stick's `game.input.ax/az`).
  Each patch must match exactly once or the build stops, so a changed game
  can't produce a quietly broken APK.
- **Touch controls** (`web/mobile.js`): a floating stick on the left half; Attack,
  Special, Shield (hold) and Jump on the right, with cooldown rings; pause and
  sound at the top. They drive `game.input`, the same object the keyboard sets.
  The layer also pauses the fight when the app or tab goes to the background,
  drops the render resolution (then shadow detail) on phones that can't hold
  45 fps, and exposes `KB.back()` / `KB.appPause()` for the Android side. They switch on
  for touchscreens; `?touch=1` / `?touch=0` force them on or off.
- **The app** (`android/`): one Activity with a full-screen WebView loading
  `file:///android_asset/www/index.html?app=android`. Landscape, immersive, screen
  kept on, Back routed to the game, renderer crashes recovered by reloading.
  minSdk 24 (Android 7.0), targetSdk 34.
- **No Gradle.** The SDK's build-tools (`aapt2`, `d8`, `zipalign`, `apksigner`),
  `platforms/android-34` and a JDK 17 are all it needs.

## Signing key

The first build creates `~/.android/kirby-brawler-2.jks` with a random password
in `~/.android/kirby-brawler-2.jks.password`. Both stay out of git. Back them up:
Android only installs an update over an existing install when both builds were
signed with the same key. Raise `--version-code` for each build you hand out.

## Icons

`icon/foreground.svg` and `icon/background.svg` are the adaptive icon's layers.
`python3 icon/render_icons.py` (needs `rsvg-convert` and Pillow) re-renders the
PNGs in `android/res/mipmap-*`, which are committed.

## Testing

`python3 build.py --debuggable` writes `dist/KirbyBrawler2-debug.apk`, which
Chrome DevTools can attach to (`chrome://inspect`). An emulator works: the
`KB_Phone` AVD in `~/.android/avd` (Android 14, arm64, 1080x2400, WebView 113) boots headless
with `emulator -avd KB_Phone -no-window -gpu swiftshader_indirect`; then
`adb install -r dist/KirbyBrawler2.apk` and
`adb shell am start -n com.tokenmaxxers.kirbybrawler2/.MainActivity`. The page's
console goes to logcat under the tag `KirbyBrawler2`. The emulator draws WebGL
on the CPU at a few fps, so it proves behaviour, not speed.
