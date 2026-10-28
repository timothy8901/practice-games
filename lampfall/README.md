# Lampfall — A Keeper's Season on the Brindle Isles

*Read the odds. Pay what's owed. Keep the light.*

Lampfall is a browser creature RPG and harbor life game. It merges two pitches, **Wildshift** (creatures that Shift into new bodies on odds you can see first) and **Porchlight** (a cozy harbor town that lights up as you pay off your home).

You arrive in Pellwick at dusk with an interest-free loan and the key to the Keeper's Cottage under a lighthouse that has been dark for thirty years. A creature picks you on the causeway. From then on you live one life on one clock, with two tides a day:

- **By day:** shake trees, fish the quay, dig the flats, run errands, and walk tide-gated causeways to six isles. Each isle ends in a Spire that tests one way of reading creatures.
- **By night:** porches light up, neighbours talk on their steps, someone is always buying, and the mud on the flats glows.
- **Shifts:** about three times in a life a creature's window opens, and a Forecast shows three cards (Up, Side, Down) with their odds. You Accept, Anchor or Reroll. Nothing is hidden and nothing asks for timing.
- **Seven loans** grow the cottage and climb the lighthouse scaffold. The last one relights the lamp, and the comet comes down for **the Reading**.
- A snail delivers one thirty-year-old letter every morning, explaining why the light went out.

After the Reading and the credits, the season continues: the Summit, dark houses reopening one per night, the remaining letters and threads.

Everything runs in the browser from plain files: vanilla JavaScript modules, a 480×270 canvas, pixel art written as strings, and procedural music and sound. No build step, no runtime dependencies, no downloads.

## Play locally

The game needs a local web server because it uses JavaScript modules; opening `index.html` from the file system will not work.

- **macOS:** double-click **Play Lampfall.command**. It starts a private server on 127.0.0.1 (port 8877, or a free port) and opens the game in your browser. Keep its terminal window open while playing; Control-C stops it. Requires Python 3.
- **Any system:** from this folder run `python3 serve.py 8000` (or `npm start`), then open <http://127.0.0.1:8000/>.

Saves live in the browser's storage for that exact address and port, so use the same address each time to keep your saves.

## Controls

| Action | Keyboard | Gamepad (standard layout) | Touch |
| --- | --- | --- | --- |
| Move | Arrows or WASD | D-pad or left stick | On-screen d-pad |
| Confirm / interact | Z, Enter or Space | A | A button; tap the context chip or a menu row |
| Back | X, Esc or Backspace | B | B button |
| Pause menu | Esc or P | Start | MENU pill |
| Run | Hold Shift | Hold RT | — |
| Tools | Tap C to swap; hold C for the tool ring | X | — |
| Map and Tide Table | M | Y | Pause menu → Map |
| Read view (field) | V or `` ` `` (backquote) | Back / Select | — |
| Dialogue log | Tab (during dialogue) | LT | — |
| Switch tabs | [ and ] | LB and RB | Tap the tab |
| Battle speed 1× / 2× / 4× | 1 / 2 / 3 | — | Settings |
| Full screen | F toggles it (Esc also leaves) | — | — |

Enter only confirms; it never opens the pause menu. Touch controls appear automatically on a touch screen, and Settings has a one-handed layout that moves the buttons into a right-thumb arc. Settings → Controls remaps every action in the table to other keys or gamepad buttons, except three fixed keys: V (Read view; backquote and Select can be remapped), F (full screen) and 1 / 2 / 3 (battle speed).

## Settings

Settings are under the pause menu (and on the title screen):

- **Time and text:** day length (12, 24 or 48 real minutes, or Real Clock), text speed, auto-advance.
- **Play:** battle speed, fishing help (Standard, Gentle or Patient), blackout wake point (porch or last Waystone), skip animations.
- **Sight:** reduced motion, large text, high contrast, Clear Visuals, screen scale, 30 fps.
- **Sound:** music, sound effects, ambience, mute, captions.
- **Controls:** path view (hold or toggle; stored, but the field does not read it yet), touch layout, key and button remapping.

The Seed Card at the start of a new game sets the **Chaos dial** (Drift, Flux or Freefall: how wild the Shift odds are), the seed code, and optional challenge seals such as **No Rewind** (one autosave, no manual saves) and **One Heart** (only the starter battles).

## Saves

- **Three autosave slots and three manual slots** per browser address. Autosaves happen on map changes, at Waystones, when a story battle starts, after catches and Forecasts, on loan payments, after reading a letter and each morning, plus every 90 seconds while you have unsaved changes on the field. An autosave asked for during a battle or cutscene waits until it has finished (so a story battle's autosave lands after the battle). An autosave less than two game hours after the newest one overwrites it instead of using the next slot, and loading a save with Continue does not autosave.
- **Manual saves:** the last item of the pause menu. Overwriting a used slot asks first.
- **Verified writes:** every save is checked before it replaces the old one. Sitting on the porch bench or sleeping shows the Day Page with "Saved, verified".
- **Export and import:** the save screen exports a save as a text string and imports one back, for moving a save between browsers.
- If the last session did not close cleanly, the title offers to resume from the latest autosave.
- Older saves are upgraded automatically when loaded (the save format is at version 7).

## Development and verification

Use Node 22 or later for the tools. Nothing needs installing for the game itself.

| Command | What it does |
| --- | --- |
| `bash tools/check.sh` (or `npm run check`) | The full gate: data validation, ownership and purity lint, art lint, a smoke import of every module, then every unit test file in its own process (180 s timeout each). Prints `CHECK OK` when everything passes (4,765 tests in 188 files on 2026-10-28). `bash tools/check.sh <pattern>` runs the same gate with only the test files whose path matches. |
| `node tools/validate-data.mjs` | The data rules (ids, references, move and item effects, Heartmark anchors, encounter weights, one-of-a-kind hand-overs), run on the registry in `js/data/index.js`, which still holds the placeholder tables. This is the gate's first step. |
| `node tools/validate-content.mjs` | The same rules on the real game content the game loads (`js/data/content.js`); it should report 0 errors and no pending tables. The unit tests also validate it. |
| `node tools/map-reachability.mjs` | Proves every Waystone and Spire is reachable at any tide, and the tide-only routes. |
| `node tools/script-dryrun.mjs` | Runs every story script path with a fake host and reports dead ends or unknown ops. |
| `node tools/balance-sim.mjs` | Plays each Spire, the Summit and the route trainers through the real battle engine; `--only progression` reports party levels at each Spire door. |
| `node tools/economy-sim.mjs` | Simulates income and loan payments for several kinds of player. |

**URL options** (for example `index.html?debug=1&skipTitle=1&seed=FLUX-XXXX-XXXX`): `debug=1` installs the `window.__game` test hook and the debug overlay, and nothing installs them without it. The other options work with or without `debug=1`: `skipTitle=1` boots straight into the field; `seed=` picks the seed code; `strict=1` throws on any world write outside a transaction; `mute=1`; `noanim=1` runs every transition at 0 ms; `speed=` multiplies the simulation (0.25–64); `touch=1` or `touch=0` forces the touch overlay on or off; `slot=auto:1` (or `manual:2`) loads a save slot at boot; `scale=integer|fit|auto`.

**Browser checks** use Playwright with Chromium. Playwright is not a dependency of this folder, so make the `playwright` package resolvable first (install it, or link a `node_modules` that has it). `node tools/pw-harness.mjs <url> <outdir> [script.json]` loads the page, plays a JSON list of steps (`keys`, `click`, `waitMs`, `eval`, `shot`), saves screenshots and `log.json` in `<outdir>`, and prints the page errors; set `PLAYWRIGHT_EXECUTABLE_PATH` to use an installed Chromium. `check.sh` does not run a browser.

**Where things are:**

- `js/` holds the game. Pure rules (`data`, `state`, `battle`, `world`, `systems`, `script`) run under Node; `scenes`, `ui`, `render`, `audio`, `art` and `main.js` draw and play.
- `test/` holds the unit tests and fixtures; `test/pages/` holds browser check pages.
- `tools/` holds the gate, validators and simulators.
- `design/` holds the design. `design/GDD-00-decisions.md` is authoritative, and its §18 lists what changed during the build. `design/architecture/ARCHITECTURE-DRAFT.md` describes the architecture; §14 is the content authoring guide and §16 records how the shipped code differs from the draft.
- `qa/` holds the playtest reports: `HUMAN-PLAYTEST.md` and `FINAL-PLAYTEST.md`.
- `progress.md` is the build log.
