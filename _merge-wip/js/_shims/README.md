# TEMPORARY SHIMS — delete this folder at integration

Written by the BOOT lane so `main.js` and the day-1 scenes can run before the STATE, DATA-IDX,
DATA-ECON, SYS-TIME, AUDIO and UI-KIT lanes land. Each file mirrors the path and the exported
signatures of the real module in ARCHITECTURE-DRAFT.md. To integrate: delete `js/_shims/` and replace
every `'/_shims/'` import segment with `'/'` (e.g. `sed -i "s#/_shims/#/#g" js/main.js js/scenes/*.js
js/debug/*.js`). `test/_shims.test.mjs` goes with it.
