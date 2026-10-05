# Dodeca Rings: mobile app

Dodeca Rings is a twelve-faced twisty puzzle box: a regular dodecahedron whose
pentagon faces are tiled five to an edge (372 tiles on 48 rings), with a 3D
view and a 2D ring dial. This folder packages it as a phone app three ways:

| Folder | What it is |
|---|---|
| `www/` | The game as an installable, offline web app: `index.html`, `manifest.webmanifest`, `sw.js` (offline cache), `icons/` |
| `android/` | An Android Studio project (Capacitor 8), app id `io.github.timothy8901.dodecarings` |
| `ios/` | An Xcode project (Capacitor 8, Swift Package Manager) |
| `assets/` | Sources for the app icon and launch screens |

The whole game is the one file `www/index.html`; the native apps show it in a
full-screen web view, so all three versions play the same.

## Quickest: install the web app (no build)

1. Put the contents of `www/` on any HTTPS web host (GitHub Pages works).
2. Open the address on the phone.
   - **Android (Chrome):** menu, then **Install app** (or **Add to Home screen**).
   - **iPhone (Safari):** Share, then **Add to Home Screen**.
3. It opens full screen from its own icon, and works offline after the first visit.

To try it on a computer first: `python3 -m http.server 8080 --directory www`,
then open <http://localhost:8080>.

## Build the Android app

You need Node 22 or newer and Android Studio (with the Android SDK, API 36, and its bundled JDK 21).

```bash
npm install
npx cap sync android
npx cap open android
```

Android Studio opens the project. Press **Run** to put it on a plugged-in
phone (USB debugging on) or an emulator. For an APK to send to a phone, use
**Build > Build App Bundle(s) / APK(s) > Build APK(s)**; it lands in
`android/app/build/outputs/apk/debug/`. From a terminal instead:
`cd android && ./gradlew assembleDebug`. For Google Play, use **Build >
Generate Signed App Bundle or APK** and upload the `.aab`.

The app runs on Android 7.0 (API 24) and newer.

## Build the iPhone and iPad app

You need a Mac with Xcode 16 or newer, and Node 22 or newer.

```bash
npm install
npx cap sync ios
npx cap open ios
```

In Xcode, choose your team under **Signing & Capabilities**, pick a device,
and press **Run**. The app runs on iOS 15 and newer.

## Changing the game

Edit `www/index.html`, then run `npx cap sync` to copy it into both native
projects. (Inside the practice-games repo, `python3 build-www.py` rebuilds
`www/index.html` from the website version, `dodeca-rings.html`, adding the
app's manifest, offline support and icons.) If you change the web app's files, bump `CACHE` in `www/sw.js` so
phones that installed the web version pick up the new one.

The icons and launch screens are drawn from `assets/` (`icon-only.png`,
`icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png`).
After changing them, run `npm run assets` to regenerate every size for both platforms.

## Before publishing to a store

- Change the app id `io.github.timothy8901.dodecarings` if you want a different one:
  it is set in `capacitor.config.json`, `android/app/build.gradle`
  (`applicationId`, `namespace`) and the Xcode project's bundle identifier.
- Raise the version for each release: `versionCode` and `versionName` in
  `android/app/build.gradle`, and the version and build in Xcode.

## Native touches

- Turns buzz the phone (Android asks for the `VIBRATE` permission for this).
- The phone's font-size setting doesn't enlarge the game's text past its buttons:
  `MainActivity.java` keeps the web view's text zoom at 100%.
- The notch and system bars are handed to the page's own safe-area padding
  (`SystemBars` in `capacitor.config.json`).
- The launch screen uses the game's light background, or its dark one in dark mode.
