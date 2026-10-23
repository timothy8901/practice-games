# TEMPORARY SHIMS — delete this folder at integration

Written by the BOOT lane so `main.js` and the day-1 scenes can run before the owning lanes land.
Each file mirrors the path and the exported signatures of the real module in ARCHITECTURE-DRAFT.md.
The STATE shims are gone: `main.js`, `debug/hook.js`, `scenes/boot.js` and `scenes/debugOverlay.js`
import the real `js/state/*` now.

| Shim | Real module | Lane | Imported by |
| --- | --- | --- | --- |
| `data/index.js` | `js/data/index.js` (empty tables) | DATA-IDX | `main.js` |
| `data/registry.js` | `js/data/registry.js` (`get/has/list/verify`) | DATA-IDX | `main.js` |
| `data/dials.js` | `js/data/dials.js` (`DIALS, DIAL_IDS, TOGGLE_ORDER, CHALLENGES`) | DATA-ECON | `main.js`, `scenes/title.js` |
| `systems/clockSys.js` | `js/systems/clockSys.js` (`optionsFrom, tick, serializeInto, restoreFrom`) | SYS-TIME | `main.js`, `scenes/overworld.js` |
| `audio/director.js` | `js/audio/director.js` (`createMusicDirector`) | AUDIO | `main.js` |
| `ui/toast.js` | `js/ui/toast.js` (`createToasts`) | UI-KIT | `main.js` |

To integrate: delete `js/_shims/` and replace every `'/_shims/'` import segment with `'/'`:

    sed -i "s#/_shims/#/#g" js/main.js js/scenes/*.js js/debug/*.js

`tools/smoke-import.mjs` classifies `_shims/<dir>/x.js` exactly like `<dir>/x.js`, so a shim that
touches the DOM in a pure directory fails the smoke run the same way the real file would.
