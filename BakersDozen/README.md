# Baker's Dozen — TestFlight scaffold

This directory holds everything you need to drop into a fresh Xcode project
and ship the Baker's Dozen web game to TestFlight (iOS + Mac Catalyst).

## What's here

- `WebContent/` — offline mirror of https://preview-bakers-dozen-b2b05094.viktor.space/game.html plus icons/manifest. Service-worker registration in `index.html` is commented out (WKWebView file:// can't host one).
- `BakersDozen/BakersDozenApp.swift`, `ContentView.swift`, `GameWebView.swift` — SwiftUI app + `WKWebView` that loads the bundled HTML, then best-effort refreshes from the live URL.
- `BakersDozen/Info.plist` — ready-to-use Info.plist (display name, version, `ITSAppUsesNonExemptEncryption = NO`).
- `BakersDozen/Assets.xcassets/` — AppIcon + launch-screen background color (`#FDE047`, matching the game's yellow hex).

## What you still have to do (requires Xcode & an Apple Developer account)

> **None of this can start until your Apple Developer Program enrollment is active.** Enroll at https://developer.apple.com/programs — $99/year, typically approved in 24–48 h.

1. **New Xcode project:** iOS → App, SwiftUI, Swift, product name `BakersDozen`, bundle id of your choice (e.g. `com.timothy.bakersdozen`), team = your paid team.
2. **Delete** the auto-generated `BakersDozenApp.swift`, `ContentView.swift`, `Assets.xcassets`, and `Info.plist`. Drag the versions from this directory into the project (check "Copy items if needed", target = BakersDozen).
3. **Add `WebContent/` as a folder reference (blue folder).** Drag it in, choose "Create folder references" (not groups) so the directory structure survives in the app bundle.
4. **Enable Mac Catalyst:** target → General → Supported Destinations → add Mac. Set minimum deployments iOS 15.0 / macOS 12.0.
5. **AppIcon:** drop a 1024×1024 PNG named `icon-1024.png` into `Assets.xcassets/AppIcon.appiconset/` (no alpha, sRGB). Xcode 14+ generates the rest.
6. **Signing:** Signing & Capabilities → Automatically manage signing → pick your team.
7. **App Store Connect:** https://appstoreconnect.apple.com → My Apps → "+" → New App. Platforms = iOS and macOS, name = `Baker's Dozen` (have an alternative ready in case the name is taken), bundle id matching step 1, SKU anything stable.
8. **Archive & upload:** Product → destination `Any iOS Device (arm64)` → Product → Archive → Organizer → Distribute App → App Store Connect → Upload. Repeat with destination `Any Mac (Mac Catalyst, arm64)`.
9. **TestFlight:** answer Export Compliance = No (matches Info.plist), fill Test Information, add yourself to an Internal Testing group. Internal builds skip Beta App Review and appear in the TestFlight app within minutes.

## Verification

- Offline run: Xcode simulator → turn off Wi-Fi → relaunch — game must still load from the bundle.
- Remote refresh: with Wi-Fi on, temporarily add a visible marker on the hosted `game.html` and confirm it appears after launch.
- Archive → Validate (in Organizer) must pass before Upload.
- Bump `CFBundleVersion` for every subsequent upload (App Store Connect rejects duplicates).

## Known risks

- **Guideline 4.2 (wrapper apps)** — Apple can reject minimal WKWebView wrappers. Mitigation if rejected for External TestFlight: add a native main menu (New Game / How to Play / Settings) that calls into the web layer via `WKScriptMessageHandler`.
- **Name collision** on `Baker's Dozen` in App Store Connect — have a fallback (e.g. `Baker's Dozen Hex`).
