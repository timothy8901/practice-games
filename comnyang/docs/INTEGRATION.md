# Integrating the brain into Comnyang (when you're ready)

Nothing here is applied to the app — this is the map. The good news: the app
already emits the exact events the brain needs, so wiring is mostly "on event X,
call `brain.react(...)`". The stable integration surface is the **IPC channel
names** in `main.js` / `preload.js` (those don't change when the bundle is
re-minified): `ai-task-complete`, `ai-task-notification`, `ai-task-state`,
`do-stretch`, `reminder-triggered`, `pomodoro-complete`, `pomodoro-focus-start`.

## 1. Bundle the module

Copy `src/` into the app (e.g. `app/brain/`). In `main.js`, after the pet window
and agent servers are up (the `whenReady → on()/Ri()` path), create one controller:

```js
const { BrainController } = require("./brain/brain-controller");

const brain = new BrainController({
  backend: "local",                                   // or "claude"
  modelPath: path.join(process.resourcesPath, "models", "qwen3-1.7b-q4_k_m.gguf"),
  timeoutMs: 4000,
});
brain.start().catch(() => {/* falls back to canned lines automatically */});

// One place that turns a brain line into a bubble + (optional) OS notification:
const { Notification } = require("electron");
brain.on("line", ({ line, notify }) => {
  if (i && !i.isDestroyed()) i.webContents.send("cat-say", { text: line });   // i = pet window
  if (notify && Notification.isSupported() && !BrowserWindow.getFocusedWindow()) {
    new Notification({ title: /* catName */ "Comnyang", body: line }).show();
  }
});
```

> The worker already shims `process.parentPort`, so it runs under Electron
> `utilityProcess.fork` with no change. **Important:** like `uiohook-napi` and
> `ffmpeg-static`, `node-llama-cpp`'s native binary and the `.gguf` must be in
> `asarUnpack` (electron-builder) so they aren't packed inside `app.asar`.

### Record what you change (so it can be undone)

Before writing anything, capture a manifest + a pristine `app.asar` backup. Do
this once, on first run after the mods are installed:

```js
const manifestLib = require("./brain/install-manifest");
if (!manifestLib.load(app.getPath("userData"))) {
  const m = manifestLib.buildDefaultManifest({
    userDataDir: app.getPath("userData"),
    resourcesDir: process.resourcesPath,            // backs up app.asar here
    modelFile: path.join(process.resourcesPath, "models", "qwen3-1.7b-q4_k_m.gguf"),
    modVersion: "0.1.0",
  });
  manifestLib.save(app.getPath("userData"), m);
}
```

### Feed the cat at 10am America/Chicago

```js
const { scheduleDaily } = require("./brain/scheduler");
const feeder = scheduleDaily(10, 0, "America/Chicago", () => {
  brain.react("feeding_time");                 // the line
  if (i && !i.isDestroyed()) i.webContents.send("do-eat"); // the animation (see §D)
});
// tray toggle can call feeder.stop(); feeder.nextAt() tells you the next feeding.
```

## 2. Fire situations from events the app already has

| App moment (existing) | Add this call |
|---|---|
| agent dispatcher sees `state:"complete"` (sends `ai-task-complete`) | `brain.react("claude_task_complete", { durationMin, project })` |
| agent dispatcher sees `notification` (sends `ai-task-notification`) | `brain.react("claude_needs_input", { agent })` |
| agent dispatcher sees `state:"error"` | `brain.react("claude_error", { agent })` |
| pomodoro focus start (`pomodoro-focus-start`) | `brain.react("pomodoro_focus_start", { focusMin })` |
| pomodoro focus → break (`pomodoro-complete`) | `brain.react("pomodoro_break", { focusMin })` |
| stretch fires (`do-stretch`) | `brain.react("break_stretch")` |
| reminder fires (`reminder-triggered`) | `brain.react("reminder", { text })` |
| daily 10:00 America/Chicago (scheduler) | `brain.react("feeding_time")` + `do-eat` |

Keep the brain's view of mood fresh so lines match the moment:
```js
brain.setMood({
  timeOfDay: hour >= 23 || hour < 5 ? "late night" : "day",
  energy: typingFast ? "high" : idle ? "low" : "neutral",
  focusStreakMin: minutesSinceFocusStart,
  userName, catName,
});
```
The single best hook point is the agent-state dispatcher (the function that today
sends `ai-task-complete` / `ai-task-notification` to the renderer). It already
receives `{ agentId, state, event, cwd }` and de-dupes "complete without an active
task" — reuse that guard so the cat only reacts to real completions.

## 3. Renderer + preload (show the line)

`preload.js` — expose a receiver next to the existing `onReminderTriggered`:
```js
onCatSay: (cb) => o.on("cat-say", (_e, payload) => cb(payload)),
```
`renderer.js` — reuse the existing speech-bubble that `reminder-triggered` already
drives; just feed it the brain line:
```js
window.electronAPI.onCatSay(({ text }) => showBubble(text)); // same bubble as reminders
```

---

# Planned features (architected for, not yet built)

## A. More stretching animations
The renderer preloads a fixed SVG set and plays the stretch poses on `do-stretch`
(`stretch-pose-default`, `stretch-pose-ing`, `stretch-start`, `stretch-end`).
To add variety without touching the geometry:
1. Drop new pose SVGs into `svg/` (e.g. `stretch-side`, `stretch-back`, `stretch-paws`).
2. Register them in the renderer's preload list and, if they have paintable spots,
   in `cell-mappings.js` — the app already ships a **Cell Mapping Editor**
   (`mapping-load` / `mapping-save`) built for exactly this.
3. Have the stretch trigger pick a random variant and pass a `variant` id on the
   `do-stretch` message; the renderer plays the matching SVG. The existing
   center-and-scale window logic stays as-is — variants only swap the artwork.
4. Brain pairing: each stretch already calls `brain.react("break_stretch")`, so a
   new animation and a fresh line arrive together. (Optionally pass the chosen
   variant into `vars` and add variant-specific scenes later.)

## B. More idle animations
There's no idle-animation system yet — today the cat follows the cursor and reacts
to input. Add one:
1. **Idle detector in main:** you already receive every keydown/wheel (global hook)
   and cursor moves. Track `lastInputAt`; after N minutes with no input, enter an
   idle state and send a new `do-idle` message with a `variant` (sleep, groom,
   look-around, tail-flick).
2. Add idle SVGs + register them; the renderer plays on `do-idle` and **cancels on
   the next keypress/cursor move** — you already have `onKeyPressed` / `onCursorPos`
   to break out instantly.
3. Brain pairing: `brain.react("idle")` for an occasional sleepy line (long cooldown
   already set, so it's never naggy). Set `mood.energy = "low"` while idle and
   `"high"` during typing bursts so the brain's tone tracks the animation.

## C. Notification for Claude task completions
Almost free — the detection already exists. The agent dispatcher already recognizes
`state:"complete"` and sends `ai-task-complete`; today that only drives animation.
Add the notification in the **same `brain.on("line")` handler** shown in §1:
- Use Electron's main-process `Notification` (cleaner than HTML5 from the renderer,
  and works even when the cat window is busy). The body is the cat's generated quip,
  so the notification *is* the brain feature.
- **Gate it** so it only fires when the app isn't focused
  (`!BrowserWindow.getFocusedWindow()`) — no point notifying while they're looking at
  the cat. Add a toggle to the existing tray/context menu (which already hosts many
  toggles) and respect it.
- **De-dupe** using the dispatcher's existing "complete without active task" guard
  plus the brain's built-in 8s cooldown on `claude_task_complete`, so a chatty agent
  session doesn't produce a stream of pings.
- If you want a notification even when the brain is disabled, fall back to a fixed
  string (`"Claude finished a task"`); `react()` returns a canned line in that case
  anyway, so the handler stays identical.

## D. Eating animation (pairs with the 10am feeding)
The scheduler in §1 sends `do-eat`; give it an animation the same way the app
already handles `do-stretch` / `do-jump`:
1. Add eating-pose SVG(s) to `svg/` (e.g. `eat-bowl`, `eat-chew`) and register them
   in the renderer's preload list (and the Cell Mapping Editor if they have
   paintable spots).
2. `preload.js`: `onDoEat: (cb) => o.on("do-eat", () => cb()),`
3. `renderer.js`: on `do-eat`, briefly show a kibble bowl and play the chew frames,
   then return to idle — mirror the existing `onDoStretch` handler's
   play-then-restore shape. Cancel on keypress/cursor move so it never gets stuck.
4. The brain line (`feeding_time`, marked notify) and the animation fire together,
   so at 10:00 Chicago the cat both eats and says something about breakfast.

The feeding time/zone live in settings (`feedingHour`, `feedingMinute`,
`feedingTimeZone`) and are listed in the reset manifest, so a factory reset removes
them cleanly. Add a tray checkbox that calls `feeder.stop()` / re-creates it.

## E. Factory reset in 3 clicks
The reset is driven entirely by the manifest written in §1, so "undo everything" is
deterministic — restore the pristine `app.asar`, delete files we added, strip our
settings keys, and clean the Comnyang hook entries out of `~/.claude`, `~/.cursor`,
and `~/.gemini` (which also fixes the lingering-hooks issue from the security
review). It never touches the user's own settings or their own hooks.

**The 3 clicks:** tray icon → "Factory Reset (remove all mods)…" → "Reset" in the
confirm dialog.

```js
const { factoryReset } = require("./brain/factory-reset");

// add this item to the tray/context menu template the app already builds:
{
  label: "Factory Reset (remove all mods)…",
  click: async () => {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      title: "Factory Reset",
      message: "Remove all Comnyang mods and restore the original app?",
      detail: "This undoes the brain, feeding, notifications and any edits we added, "
            + "and removes Comnyang's hooks from Claude / Cursor / Gemini. "
            + "Your cat name, pattern and other settings are kept. The app will restart.",
      buttons: ["Reset", "Cancel"],
      defaultId: 1, cancelId: 1,
    });
    if (response !== 0) return;

    // stop our runtime bits first so nothing rewrites files mid-reset
    try { feeder.stop(); } catch {}
    try { await brain.stop(); } catch {}

    const report = factoryReset({ userDataDir: app.getPath("userData") });
    console.log("[Comnyang] factory reset:", report);

    app.relaunch();
    app.exit(0);
  },
}
```

Notes:
- `factoryReset({ ..., dryRun: true })` returns the same report without writing —
  handy for a "what would this remove?" preview.
- Pass `restoreDevToolBackups: true` to put back the pristine `~/.claude` etc. that
  were captured at install time, instead of surgically stripping entries.
- Because step 1 restores `app.asar` from backup, the restored app launches as
  stock Comnyang. If you applied the mods by repacking a **signed** build, note that
  the backup is your original signed asar, so the restore returns you to the signed
  original — the modded interim build is the only unsigned artifact.

## Applying to a signed build (reality check)
Your Comnyang is a signed, integrity-checked release (`ElectronAsarIntegrity` in
`Info.plist`). Repacking `app.asar` invalidates both the signature and that integrity
hash, so a modded build won't launch under Gatekeeper until you either ad-hoc
re-sign it (`codesign --force --deep --sign - Comnyang.app` for local use) and update
/disable the asar-integrity fuse, or apply these drop-ins to source and rebuild. The
factory reset sidesteps all of that by restoring the original asar you backed up.
