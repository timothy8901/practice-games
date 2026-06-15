# Comnyang personalization — local AI brain for a desktop-pet cat

Personal mod project for **Comnyang**, a third-party desktop-pet cat
(Electron app). It gives the cat a fully offline AI "brain" (Qwen3 1.7B via
node-llama-cpp on Metal), situation-aware speech bubbles, a 10am feeding +
eating animation, stretch/idle animation variants, a Claude-task-complete OS
notification, and a 3-click Factory Reset that restores the stock app.

See `CLAUDE.md` for the project constraints and task list, and
`docs/INTEGRATION.md` for the integration map.

## Layout

```
app/brain/          the brain module (all original code): persona, situations,
                    DST-correct scheduler, mock/local/claude backends, worker,
                    install manifest + factory reset, node test suites
docs/               integration map + build notes (anchors, signing, backups)
build.sh            repack + ad-hoc re-sign + relaunch (local deploy loop)
app/ (local only)   unpacked app.asar of the installed Comnyang build, carrying
                    small surgical insertions at documented IPC channel sites
app.asar.orig (local only)   pristine asar — factory-reset baseline
models/ (local only)         qwen3-1.7b-q4_k_m.gguf (~1 GB)
```

**The public mirror of this project intentionally excludes** the vendor's app
tree (`app/` apart from `app/brain/`), `app.asar.orig`, the model file, and
`node_modules` — Comnyang is commercial, licensed software and its code and
artwork are not ours to redistribute. The excluded pieces are reproducible
locally: extract the asar from your own installed copy, apply the insertions
documented in `docs/`, drop the GGUF into `models/`, and run `./build.sh`.

## Testing

```
node app/brain/test/harness.js            # brain pipeline (mock backend)
node app/brain/test/harness.js --backend local --model models/qwen3-1.7b-q4_k_m.gguf
node app/brain/test/scheduler-test.js     # 10am-Chicago feeding, DST-correct
node app/brain/test/factory-reset-test.js # mod removal restores stock app
```

Everything is reversible: every file/setting/hook the mods add is listed in an
install manifest, and the in-app **Factory Reset** tray item (or restoring
`app.asar.orig`) returns the app to stock behaviour.
