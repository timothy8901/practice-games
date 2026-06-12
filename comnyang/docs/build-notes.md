# Build / repack notes (for the future build.sh)

## Pristine-backup timing — MUST handle in build.sh

The bootstrap inserted in `app/main.js` (task 1b) calls
`buildDefaultManifest()` → `backupAppAsar(resourcesDir)` on the app's first
launch. That runs **after** a repack, so at that moment
`Resources/app.asar` is already the *modded* build — the runtime backup
would capture a modified asar, not the pristine one.

Fix: `backupAppAsar` is idempotent (it only copies if
`app.asar.comnyang-backup` doesn't exist). So `build.sh` must pre-seed
`Contents/Resources/app.asar.comnyang-backup` from this repo's
`app.asar.orig` **before** the first modded launch. Then the runtime call
becomes a no-op and the factory reset restores true stock.

## main.js anchor

The task-1b insertion sits at the (previously unique) anchor
`f.quit();return}Rs(),` inside `f.whenReady().then(async()=>{...})`.
Minified identifiers in v0.1.45: `f`=app, `ce`=BrowserWindow, `i`=pet
window, `to(...)`=logger. Any app update regenerates main.js — re-grep
anchors after an update; never rely on byte offsets; never reformat
`app/**`.

## Signing reality (from docs/INTEGRATION.md)

Repacking invalidates the signature + `ElectronAsarIntegrity` hash in
Info.plist. For local use: update/disable the asar-integrity fuse and
ad-hoc re-sign (`codesign --force --deep --sign - Comnyang.app`).
