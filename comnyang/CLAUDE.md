# CLAUDE.md — Comnyang personalization project

Context for Claude Code. Read this fully before editing.

## What this is
We're adding personal features to **Comnyang**, a third-party desktop-pet cat
(Electron app). All new logic lives in a self-contained module, `app/brain/`,
that the app `require()`s. We touch the app's own bundled files only with small,
targeted insertions at known IPC channel names — we do NOT rewrite the app.

A standalone prototype of `brain/` already exists and is tested. Goal: wire it in,
build the animation/UX pieces, and ship a personalized local build.

## Repo layout
```
app/                     unpacked app.asar (the editable app source; minified)
  main.js preload.js renderer/ svg/ hooks/ agents/ ...
  brain/                 our module (copy of the prototype) — most new code goes HERE
app.asar.orig            pristine original asar — DO NOT DELETE (reset baseline + git of record)
build.sh                 repack + re-sign + launch (the test loop)
docs/                    security-review notes + INTEGRATION.md
```

## The brain module (already built + tested)
- `persona.js` — cat voice + prompt builder + output sanitizer (pure)
- `situations.js` — trigger catalog mapped to the app's real events
- `scheduler.js` — DST-correct daily scheduler (10am America/Chicago feeding)
- `backends/{mock,local,claude}.js` — mock (default), node-llama-cpp, Claude Haiku
- `brain-worker.js` — model runs in a SEPARATE process (never blocks the UI/input hook)
- `brain-controller.js` — mood + cooldowns + timeout→fallback; `react(key, vars)`
- `install-manifest.js` + `factory-reset.js` — reversible mods + 3-click reset

## Hard constraints (do not violate)
1. **Privacy posture must stay intact.** The security review confirmed: keystrokes
   are detected as a *contentless* signal (no key data), the only network calls are
   localhost IPC + license validation + GitHub updates, and nothing is exfiltrated.
   Do NOT add any network call, telemetry, or keystroke-content capture. The local
   brain backend keeps the cat fully offline.
2. **Everything must be reversible.** Keep `app.asar.orig` untouched — it's the
   factory-reset baseline. Any new file/setting/hook we add must be listed in the
   install manifest so `factory-reset.js` can undo it.
3. **Additive integration.** Prefer adding code in `app/brain/`. In the app's
   minified files, only insert at the documented IPC channels (below) — small,
   surgical edits, never reformatting the whole file.
4. **Signed build reality.** The original app is code-signed with
   `ElectronAsarIntegrity` in Info.plist. After repacking app.asar you MUST update or
   disable the asar-integrity fuse and ad-hoc re-sign, or it won't launch. `build.sh`
   handles this for local use.

## Integration hook points (stable IPC channel names in the app)
| Event in app | Wire to |
|---|---|
| agent dispatcher `state:"complete"` → sends `ai-task-complete` | `brain.react("claude_task_complete", {...})` + notification |
| → sends `ai-task-notification` | `brain.react("claude_needs_input", {...})` |
| agent `state:"error"` | `brain.react("claude_error", {...})` |
| `pomodoro-focus-start` | `brain.react("pomodoro_focus_start", {focusMin})` |
| `pomodoro-complete` | `brain.react("pomodoro_break", {focusMin})` |
| `do-stretch` | `brain.react("break_stretch")` |
| `reminder-triggered` | `brain.react("reminder", {text})` |
| scheduler 10:00 America/Chicago | `brain.react("feeding_time")` + new `do-eat` |
See `docs/INTEGRATION.md` for exact code snippets.

## Tasks to finalize (work one at a time, test between each)
1. Copy the prototype into `app/brain/`; add the manifest bootstrap + `brain.start()`
   in main.js's `whenReady` path.
2. Wire the AI-task / pomodoro / stretch / reminder situations at the hook points.
3. Feeding: `scheduleDaily(10,0,"America/Chicago", ...)` → `feeding_time` + `do-eat`.
4. **Eating animation**: new `svg/eat-*.svg`, register in renderer preload list +
   Cell Mapping Editor; `preload.onDoEat`; renderer plays then restores (mirror
   `onDoStretch`); cancel on keypress/cursor move.
5. **More stretch animations**: extra `svg/stretch-*` variants; pick a random
   variant on `do-stretch`; geometry unchanged.
6. **More idle animations**: idle timer in main (track lastInputAt from the global
   hook); `do-idle` variants (sleep/groom/look); cancel on input.
7. **Claude completion notification**: main-process `Notification` in the
   `brain.on("line")` handler, gated to `!getFocusedWindow()`, with a tray toggle.
8. **Factory Reset** tray item → confirm dialog → `factoryReset(...)` → relaunch (3 clicks).
9. **Bundle the model**: download Qwen3 1.7B Q4_K_M into `Resources/models/`,
   set backend to `local`, add `node-llama-cpp` to `asarUnpack`.

## Testing (run after every change — no GUI needed)
```
node app/brain/test/harness.js            # brain pipeline (mock backend)
node app/brain/test/scheduler-test.js     # 10am-Chicago feeding, DST-correct
node app/brain/test/factory-reset-test.js # mod removal restores stock app
```
Only after these pass, do a full GUI run via `build.sh`.

## Conventions
- Commit before and after each task; keep diffs small and reviewable.
- Never add a dependency that phones home. node-llama-cpp (local) and the optional
  Claude backend (user's own key, pasted in settings) are the only additions.
- If a change can't be expressed as "new file in brain/ + a one-line app insertion,"
  stop and flag it rather than rewriting app internals.
