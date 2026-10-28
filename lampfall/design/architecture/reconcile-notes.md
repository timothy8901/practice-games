# Interface points to reconcile in the final architecture pass

Status as of 2026-10-28, checked against the code after fix wave 3a and the final fix pass (each bullet ends with its status). **Done in code; the code wins** means the draft text was not rewritten: ARCHITECTURE-DRAFT §16 says the module JSDoc is authoritative for those signatures.

From the world-model verifier (js/world, 156 + 68 adversarial tests green):
- §4.1 collision 'H' semantics: tide.js treats HIGH_ONLY as the mirror of LOW_ONLY (walkers cross only at high tide; boats float at low/mid). Confirm or change the draft text. — **Done**: 'H' is open only at high tide in both the draft and tide.js.
- §4.2 loadMap(def, tiles, {legend}) takes the tileset, not the Registry; js/world never imports js/data. Update the draft. — **Done in code**; the code's JSDoc wins (ARCHITECTURE §16).
- §4.5 INTERACTION_PRIORITY is per kind (npc>roamer>item>sign>use-trigger>tree>rock>boat>prop>water>crack/mud>door>tile), not ['entity','useTrigger','tileVerb']. Pick one and document it. — **Done in code** (per-kind list in interact.js); the code wins (ARCHITECTURE §16).
- §4.8 resolveWarp has a 5th opts arg and extra reasons 'unknown-map' and 'blocked'. Update the draft. — **Done in code**; the code wins (ARCHITECTURE §16).
- lighting.js owner: manifest says WORLD-FX, built by WORLD-MAP. Record in tools/lint-owners.mjs. — **Open** (bookkeeping only): lint-owners records world-state keys, not module owners.
- js/world/npc.js consumes systems/schedule.whereIs (SYS-TOWN, not built yet). NPC_DEFAULTS.catchUpTiles=12 and wander pause are placeholders. — **Done**: schedule.whereIs is built and used, catchUpTiles comes from tuning. Still open: tuning.npcFeel / roamerFeel are read nowhere, so NPC_DEFAULTS set the feel.
- Path cache is a standalone LRU (createPathCache) owned by the overworld scene, not store.derived (§4.4). — **Done in code** (overworld owns createPathCache); the code wins.
- TileInfo.tide is numeric TIDE_MASK codes in the real tilemap, strings in fixtures; consumers must accept the numeric form. — **Done**: tideMaskOf accepts numeric codes.
- lighting.DAY_PARTS = prototype hour table; retune if the GDD adopts judge-3's seven day-parts (music uses 8 three-hour blocks). — **Done**: GDD-00 adopted eight three-hour day-parts; lighting keeps its own LUT keyframes.
- tools/validate-data must reject non-finite encounter weights (rng.weighted throws on NaN/Infinity). — **Done**: validate-data rejects non-finite or non-positive encounter weights.

From the UI-kit verifier (js/ui, verdict solid):
- drawHud takes plain values (clockText, tide, wallet, tool, contextVerb, pendingShift, device); the G form only reads display size. Scenes must pass values. — **Done** (as built).
- createToolRing needs tools/current/last passed explicitly. — **Done** (as built).
- main.js already subscribes to the bus 'toast' event; if BOOT switches to createToasts(G) and keeps its own listener every toast shows twice. Pick one. — **Done**: only main.js listens; no double toasts.
- Focus `index` setter clamps but does not skip disabled items; use set(i). — **Done**: no caller uses the index setter.
- Toast fade uses globalAlpha (briefly off-palette); dithered fade is a polish item. — **Open** (polish).
- Disabled-reason tooltip (1.6 s) can cover the neighbouring row (e.g. the effectiveness word in the move menu). — **Open** (polish).
- Textbox choices have a 250 ms choice lock; confirm has a 500 ms lock with a faint default cursor. — **Done** (documented behaviour).

From the SYS-TIME verifier (clockSys, weather; verdict acceptable):
- New games start at 17:40 day 1 (schema NEW_GAME_START_MINUTE) with a day-1 low at 16:40 (DAY1_LOW_MINUTE); tide seed lives in state/schema (tideSeedFor), clockSys delegates. — **Done** (as built).
- Integration to wire: overworld/fishing call weather.update after clockSys.tick and after any rest; dayFlow listens to day:start and clock:anchor; warps/tilemap call clockSys.gateTide; bed/porch scenes call rest/sit/stand. restoreFrom resets speed to 1 and unpauses (porch Sit never survives a reload). — **Done**: weather.update runs after the tick in the overworld, fishing and dayFlow; dayFlow listens to day:start and clock:anchor; rest/sit/stand are wired.
- Real Clock resync spanning > 7 days reports only the last midnight; dayFlow misses the days between (acceptable: absence catch-up summarises). — **Done**: since save v7, Real Clock keeps `clock.realOffset`, so days that pass between sessions count.
- docs-checkpoint0.md / README claims that setTide and day length wait on core are out of date (freezeTide + setMinutesPerDay exist). — **Done** for README (rewritten 2026-10-28). **Open**: docs-checkpoint0.md still says freezeTide / setMinutesPerDay are missing; both exist.

From the RULES-ECON verifier (bag, wallet, loans, shops; verdict acceptable):
- Items resolve from `items` OR `collections` (econ.itemOf / allItems); shore finds stack to 10 via tuning bag.stackByGroup. — **Done** (as built).
- Script beat must set sp.lamp-room-offered (Wren offers the Lamp Room at loan 6); loans does not set it. — **Done**: lamp-room-offered fires on loan:tier:7 and sets the flag.
- validate-data should require ask:true on script `take` of one-of-a-kind items (bag.take returns needsConfirm otherwise). — **Done** (wave 2, LG-RN33): validate-data rejects a one-of-a-kind `take` without `ask: true`.
- cond `hasItem` (selectors.itemCount) counts satchel stacks only; currency items (starsalt) read from the wallet -> {hasItem:'starsalt'} is always false. Fix in cond or selectors. — **Done** (wave 2, LG-RN34): `hasItem` on a currency reads the wallet.
- threads.js calls loans.residentShare without data and must pass the economy day (06:00 turnover). — **Done** (waves 2 and 3a): scriptHost passes loans.residentShare to the thread system; a finished thread pays once.
- Not built: Gallery frame income, Raft relic refining, Barnaby's archivePrice service (data fields exist). — **Done** (wave 2): Gallery frames, Raft refining and Barnaby's duplicate desk are built.
- A test file (audio.director.test.mjs) has been seen hanging check.sh runs; tools/check.sh should run each file with a timeout. — **Done**: tools/test-suite.mjs runs each file in its own process with a 180 s timeout.

## TUNING RECONCILIATION (must happen before integration; GDD-00 wins)
The rules lanes kept prototype DEFAULTS where GDD-00 later set different numbers. js/data/tuning.js and the FLOW callers must pass:
- mendsPerBattle 3 (tuning.js says 2), benchShare 0.6 (tuning.js says 0.5) — **Done**.
- payoutPerLevel 50 x highest level (battle default 40); expYieldDivisor 5 (default 7); EXP curve 8 x L^2 for every form (needs data.expForLevel/levelFromExp or the gainExp callback); holdOutExp 100 for the dock hold-out (default 0) — **Done**, with one change: the curve is 8·L² through Lv8, then (3·L³ − 512)/2 (MID-06, GDD-00 §18).
- captureOddsMax 0.95 (default 0.99); capture bands Slim/Fair/Good/Sure on Freefall (default Low/Fair/Good) — **Done**.
- Shift windows [8, 20, 34] (creature lane default 9/20/34) — **Done**.
- dials.js Freefall wardBadge should be false (badge only after the first blocked hit, rules 8.2/17.1); Freefall readCard party pips: decide (rules imply pips without shimmer) — **Done in behaviour**: battleFlow forces Freefall's Ward badge to 'after-block' (dials.js still says true), and Freefall Read cards show no pips (battle/read.js). Recorded in GDD-00 §18.

## From the battle / creature / Forecast / capture / audio lanes
- FLOW: createBattle({gainExp: (c,a) => creature.gainExp(c,a,data,{tuning})}) so in-battle level-ups use the individual's own curve. — **Done**.
- FLOW: route captures through systems/capture.attemptCapture (engine _captureAttempt rolls unrounded odds) with rng stream capture:<battleId>:<attempt>; UI shows only captureOdds().shown. — **Done** (stream capture:<battleId>:<attempt>).
- Heartmark: GDD-00 wants 4 anchors per form + one rolled per creature (stream heartmark:<uid>); schema stores mark {x,y}. Decide: store the anchor index (recommended) and resolve pixels from the form's anchors at draw time. — **Done**: creature.mark stores the anchor key.
- Still Knot put on while a window is already open: hides it until removed (undecided; fine). — **Accepted** as is.
- Errant 'Down card never a hatchling' not implemented (0% Down kept, tunable). — **Done** as 0% Down on Drift and Flux (forecast ERRANT_ZERO_DOWN).
- Signatures differ from ARCHITECTURE §5.1/§5.4 (data injected, tunables as DEFAULTS + tuning arg; rollForecast(world, creature|uid, data, opts)); update the draft. — **Done in code**; the code wins (ARCHITECTURE §16).
- spire/summit AI 'finisher' step and summit heal threshold 0.4 are invented defaults. — **Accepted** as is.
- Battle scene must emit battle:hp after each switch and battle:event (or call G.music.battleEvent(ev)) in animation order, for the tense stem and sfx. — **Done**.
- Overworld must pass sfx: tile.sfx in player:step for wet footsteps. — **Done**.
- Debug hook should call G.music.refresh() after setTime. — **Done**.
- clockSys DAY_PARTS and tracks DAY_PARTS must change together if the day-parts change. — **Done**: one day-part table in tuning.js.
- main.js onShow can unmute even when settings.muted is true (BOOT bug). — **Done**: onShow restores the mute state from before hiding.

From the SYS-TOWN verifier (letters, schedule, memory, threads, dayPage; verdict solid):
- FLOW: call dayPage.overnight at Sleep or at the clock:anchor morning, never at the porch bench; hand step.base (not step.rng) to gather.glintFor and weather.rollDay; forward wallet:changed, loan:paid and NOTE_EVENTS to dayPage.noteEvent; pass {loans: {residentShare}} to threads.advance/setBeat; attach TUNING as data.tuning or opts.tuning; bind __game.deliverLetter and __game.sleep. — **Done**.
- Calendar: day 1 is a Sunday (selectors.DAY0_WEEKDAY = 6) everywhere. — **Done**.
- Cast chapter must give each resident npc.porch {id (PORCH_IDS), mapId, x, y, facing, litAtStart?, days?, hours?} plus §14.5 schedule/topics/lines and festival spots; tuning.porchesLitAtStart holds the seven arrival-lit porches. — **Done**: 16 Pellwick residents carry npc.porch; 20 porch ids.
- Porch Supper is only a capability (festival row host:'porch'); add the row in content if wanted. — **Not needed**: no Porch Supper in GDD-00 or GDD-05.
- Content fix: threads/mudlark-mile beat 2 advance.days should be 2 ('Legs need a day'). — **Done** (wave 2, LG-RN66), and talk now honours thread pacing (wave 3a).

From the SYS-GATHER+WORLD verifier (fishing, gather, fieldLog, encounter; lane tests green):
- STATE: add settings.fishing ('standard'|'gentle'|'patient', default 'standard') with a migration; systems/settings.normalize currently drops it. — **Done** (`settings.fishingMode` in the schema and normalize).
- Real Clock: day numbers are absolute, so the Glint (500 + 60 x day) would pay ~a million. Use a run-relative day (days since new game) in wallet/clockSys/gather. — **Done** (wave 2, LG-RN70): days are run-relative under Real Clock; save v7 adds realOffset.
- DATA: wire js/data/collections.js and encounters into js/data/index.js; DATA has no `tuning` table: scenes must pass ctx.tuning = data/tuning.TUNING (or add it to DATA). — **Done**: all tables are wired; TUNING is passed by import.
- Kept: Brine tell threshold 1 catch (GDD-00 §9); encounter floor 8 free steps; night low = night now and within ±90 min of a low. — **Accepted**.

From the creatures/battle chapters and the balance verifier:
- ENGINE GAP: arena weather (Weather Spire's posted 3-turn cycle; Cass's and Idris's squall on entry) and held items are NOT implemented in js/battle/engine.js. The Weather Spire theme depends on weather. Add a weather field + per-type modifiers + posted turns, and held-item hooks, then re-run tools/balance-sim.mjs. — **Done**: the engine runs weather and held items, and battleFlow passes weatherKinds, weatherCycle, onEntry and held items.
- Boss Shifts, Relay no-repeat rounds and between-fight bag use are modelled by the balance harness, not the engine; battleFlow/spire scenes must implement them from js/data/spires.js. — **Done** (wave 1): the engine posts and lands boss Shifts; the Relay plays three rounds with a pick screen before each, and the satchel opens between rounds.
- systems/forecast refuses a star card when the star form equals the current form, so Star-touched Sloshkin can never appear from Sloshkin; fix the comparison (Star-touched is a palette variant of the same form). — **Done**: no star-equals-current refusal remains.
- Disc teaching: systems/creature.canLearn and the shop learner strips must read species flags.teachable (species/index.canBeTaught is the rule). — **Done**.
- Heartmark: drawMark picks one of the four anchors and keeps that key through every Shift. — **Done**.
- Dusksight has hook null plus a nightHook that the battle flow applies under night rules. — **Done**.

From the economy/town chapters:
- Wire DATA.loans / commissions / commons / shops / items / dials / challenges / toggleOrder / collections / festivals / weather (staged in js/data/content.js). — **Done**.
- Pass tuning via ctx.tuning, not as a DATA table (registry flags camelCase keys as bad ids). — **Done**.
- systems/party BOX_CAPACITY is one constant: the Cellar's 40 slots need a per-world capacity. — **Done**: boxCapacity is 20, or 40 with the Cellar.
- Maps: Pellwick needs a 'flats' reach (dab, sand eel, glimmer sprat are flats fish); reaches need a kind from collections.REACH_KINDS; bug spots need a habitat from BUG_HABITATS. — **Partly done**: reaches have kinds and bug spots have habitats; the flats reach is on Lowmoor (Stones Channel), not in Pellwick.
- A listener must keep the stamp.* counters (each stamp names its bus event); capture:ok should carry `scripted`, battle:end should carry `porchDuel`. — **Done** (wave 1, LG-RN87): js/systems/stamps.js keeps the counters; capture:ok carries `scripted` and battle:end carries `porchDuel`.
- Market night is dow 5 (Saturday) 20:00-24:00 and dow 6 00:00-02:00 (fixed in shops.js). — **Done**.

From the creature-art + engine-weather lane (engine verdict: ship):
- ENGINE now has arena weather (js/battle/weather.js) and held items (js/battle/heldItems.js). FLOW must: copy a party member's held item into the battle creature's `heldItem`; pass `weatherKinds`, the Spire's posted cycle and each trainer's `onEntry` weather into createBattle; and party.applyOutcome must drop items the battle consumed. — **Done**, except dropping consumed held items in party.applyOutcome, which no shipped item needs (none is consumable).
- Ballast Stone item text must match the engine rule (heldItems.js is authoritative; fix items.js text). — **Done**.
- spires.js Mirror Spire dossier text is stale after the level retune; regenerate from trainers.js. — **Done**: a test checks every dossier's team against trainers.js.
- Heartmark anchors: every form has head/chest/back/tail anchors (also for idle2 and back frames). validate-data checks each anchor sits on the sprite. — **Done**.
- Weakest forms after the art pass: Coilcrest, Hulkwight, Emberjaw, Duskwisp (see polish-backlog). — **Done** (wave 3a redraws).

From the SCN-MENU and SCN-UI lanes (both verdict: ship):
- BOOT: update test/boot.scenes.test.mjs line 86 to the GDD-00 menu order ['party','bag','ledger','mapScreen','fieldLog','letter','settings','saveLoad']. — **Done**.
- DATA-PRES: in test/data.presentation.test.mjs, build menu keys from MENU_ITEMS `it.id` instead of `it.scene`. The Journal row pushes 'letter' and otherwise needs a key `menu.letter` that does not exist. — **Done**.
- STATE: add the GDD-09 §6 settings to the schema, systems/settings.normalize and lint specs: battleSpeed, fishingMode, largeText, highContrast, clearVisuals, pathView, volumes.ambience, touchLayout, wakePoint, autoAdvance, captions. Until then they live in the localStorage mirror `<SAVE_PREFIX>settingsExt`. Every change is already also sent to settings.update, so they will start landing in saves as soon as the schema accepts them. — **Done**.
- BOOT: at boot, apply world.settings (input.loadBindings(settings.bindings), clockSys.applySettingsEffects, settings.readMirror on the title). Nothing does this yet. — **Done**: main.applyDeviceSettings applies the mirror and bindings at boot and on load.
- Battle, fishing, input, render and HUD owners: read the new settings (battleSpeed, fishingMode, pathView, touchLayout, clearVisuals, highContrast, largeText, wakePoint, ambience) from menuKit.readExt(G) or the settings:changed {changed, ext} event until STATE adds them. — **Done** for battle speed, fishing, touch layout, Clear Visuals, high contrast, large text, wake point and ambience. **Open**: Path view hold/toggle is stored, but the field does not read it (mapRenderer.pathViewNext is unused).
- SCN-FLOW (title): push 'saveLoad' with {from: 'title', mode: 'load'} and handle resume({world, slot}) as in ARCHITECTURE §2.5. The crash-resume row appears there whenever persist.crashed() is true. Call persist.setNoRewind(wantsNoRewind(world)) when a run starts. — **Done** (wave 1, LG-RN103 for setNoRewind).
- SCN-UI (letter.js): the pause row Journal pushes 'letter' with {journal: true}. The letter scene should show the Journal tabs (GDD-09 §3.23) when it sees that flag. — **Done** (wave 1): Letters, Stamps, Season Book, Seed Card and Log tabs.
- Storage (box.js) needs someone (team decision) to own a home entry point: push 'box' from a cottage interaction. The pause menu has no Storage row, matching GDD-00. — **Done**: the cottage storage crate (and the Cellar) open Storage.
- RULES-CREATURE: store the Heartmark anchor in creature.mark (e.g. mark.spot, as reconcile-notes recommends). Until then menus use art/heartmark.pickAnchor(uid) plus the {x,y} offset. — **Done** (`mark.anchor`).
- RULES-CREATURE: add creature.applyItemEffect (partial heal, revive, cure). menuModel.applyFieldEffect currently mutates the creature inside the bag scene's tx, called through systems/bag.use's apply callback. — **Open** (polish): menuModel.applyFieldEffect still applies item effects.
- RULES-CREATURE: add a party.boxMove/boxSwap so storage cells can be reordered. Dropping a stored creature on another cell is currently refused with 'Storage keeps its own order.' — **Done** (wave 1, LG-RN108).
- DATA-ITEMS / RULES-CREATURE: item rows use held: {blocksShift: true} but creature.blocksShifts reads row.blocksShifts. As a result the Still Knot never sets stillKnot, and the 'Held by Still Knot' row never shows. — **Done**.
- DATA-IDX: once the real tables (types, moves, abilities, species, families, items, maps) are wired into data/index.js, the menus show real content in the game. test/pages/menus.html loads them itself for now. — **Done**.
- STRINGS: move the English literals marked `// str` in js/scenes/{menu,party,box,bag,settings,saveLoad,menuModel}.js into strings.js. — **Partly done**: many strings moved in waves 1–3a and the final pass, but `// str` literals remain in 23 scene files (365 lines on 2026-10-28).
- AUDIO: the ambience volume has no bus in core/audio yet. The setting is stored and announced but has no audible effect. — **Done** (wave 1): core/audio has an ambience bus.
- main.js (BOOT) must call dayFlow.install(G), eventScripts.install(G), dayFlow.bindDebug(G) and eventScripts.bindDebug(G); none of the flow wiring is live in the real game until it does. — **Done**.
- The overworld (SCN-WORLD) must call eventScripts.runPending(G) in enter() and resume(), so pending scripts and saved cutscenes start. — **Done**.
- The overworld must expose a `stage` object for cutscenes (shape documented as the Stage typedef in js/scenes/cutscene.js: entity, walk, isMoving, face, teleport, spawn, despawn, warp, camera). Without it, world ops only take their time and nothing moves. — **Done**.
- The overworld must not advance the clock while the top scene has `freezesClock` set. The cutscene sets it and uses updateBelow:true so NPCs keep walking. — **Done**: the clock ticks only while the overworld is the top scene.
- SCRIPT lane: js/script/runner.js names a say's speaker from world.npcs[who].nickname, but memory.setNickname stores there the name the neighbour calls the PLAYER. After Tully nicknames you 'Mudsy', his name tab would read 'Mudsy'. My speakerOf works around it by using the npc row's name; the runner itself should be fixed. — **Done** (wave 2, LG-RN117).
- SCRIPT lane: add `fade {to:'in'|'out', ms?, color?}` and `letterbox {on}` to OPS in js/script/ops.js. The cutscene already handles both, but the runner rejects unknown ops today. — **Open** (polish): `fade` and `letterbox` are still not in OPS.
- interactFlow (FLOW) should open my screens: dialogue with {target:{kind:'npc'|'porch'|'sign', id}} for talk (this also records memory talk / lines / Linger); shop with {shop}; shop with {mode:'crate'} at the gate; letter with {n, from:'mailbox'|'counter'|'journal'|'wall'}; dayFlow.askSleep(G) for the bed; dayFlow.sit(G) / stand(G) for the porch bench; dayFlow.quitPage(G) before quitting to title; dayFlow.atWaystone(G) at Waystones. — **Done**.
- The cutscene's startBattle uses G.flow.startBattle(G, setup) if it exists, otherwise it pushes 'battle' with {setup} and passes result.result back to the script. battleFlow (or main.js) should set G.flow. — **Not needed**: G.flow is unset and the cutscene's fallback (push 'battle' with the setup) is the path every story battle uses.
- The forecast scene, when given {uid, onClose}, should call onClose when it pops, and pop with {formId}; deferred Forecasts and the cutscene `forecast` op depend on that. — **Done**: the deferred-Forecast soft-lock (LG-RN121) was fixed on 2026-10-27.
- The Journal's Log tab (SCN-MENU) should read textLog(G).lines() from js/scenes/scriptHost.js. — **Done** (Journal Log tab).
- Strings lane: move every literal marked `// str` in my scene files into js/data/strings.js. — **Partly done**: see the STRINGS item above.
- js/scenes/scriptHost.js and js/scenes/nameEntry.js are new shared modules, not registered scenes. scenes/index.js is unchanged. The lease card can reuse createNameEntry. — **Done** (noted).
- OUTSIDE LANE (BOOT, css/style.css): the rule `#touch > * { pointer-events: auto }` beats core/input's `.wsp-touch { pointer-events: none }`. The overlay root (`.wsp-touch.wsp-touch--abs`, inset 0, z-index 1000) then sits over the whole canvas, so no tap ever reaches a menu on a touch device. Only the d-pad, A/B and MENU buttons work. Fix: `#touch > .wsp-touch { pointer-events: none }`. I confirmed the two-step tap works once that override is in place. — **Done**: `#touch > .wsp-touch { pointer-events: none }`.
- OUTSIDE LANE (overworld): Pause opens only on `menu` (Enter/Esc), never on `start` (P / Start), which GDD-00 §13 and GDD-09 §4.1 require. Pressing P in the field does nothing. — **Done** (wave 1, MID-21): Esc / P / Start / the MENU pill open pause; Enter is Confirm only.
- OUTSIDE LANE (BOOT): nothing at boot applies `settings.readMirror` / `input.loadBindings` / `clockSys.applySettingsEffects`. After a reload, world-backed settings (text speed, reduced motion, volumes, day length, bindings) only come back by loading a save. The localStorage mirror is written correctly. The `settingsExt` rows (large text, contrast, battle speed and the rest) do persist across reloads. — **Done**: see the BOOT item above (applyDeviceSettings).
- OUTSIDE LANE (SCN-UI letter.js): the Journal row pushes 'letter' with {journal: true}, but the scene ignores the flag and shows the empty mailbox page. — **Done**: see the SCN-UI letter.js item above.
- OUTSIDE LANE (FLOW): `__game.sleep` is not wired (dayFlow is not installed), so I could not check Sleep → Day Page → 06:00 letter. — **Done**: `__game.sleep` is bound.
- OUTSIDE LANE (dialogue): the name-entry panel opens over a slip that still shows the previous choice prompt ('Pick one.'). Keyboard choices, typed nicknames with the confirm step, and hold-to-skip (the world ends in the post-cutscene state, flag set and item given) all work. — **Done** (wave 1, LG-RN130).
- OUTSIDE LANE (owners): two tests still fail: test/boot.scenes.test.mjs:86 (old menu order) and test/data.presentation.test.mjs (`menu.letter` key). data.test and script.cond also fail but have nothing to do with this lane. validate-data, lint-owners, lint-art and smoke-import all pass. — **Done**: the full suite passes.
- OUTSIDE LANE (unfixed): js/scenes/boot.js imports installEndingTrigger which js/scenes/ending.js does not export yet — game and bench fail to load modules importing scenes/index.js until that lane finishes — **Done**: ending.js exports installEndingTrigger.
- OUTSIDE LANE: lint-owners flags js/scenes/boot.js writing world.pendingScript directly — **Done**: lint-owners passes.
- OUTSIDE LANE: strings template confirm.oneOfAKind reads 'Use the Isolde's Lantern?' — **Done**: the template reads 'Use the {item}? There is only one.' and item names drop a leading 'The'.
- OUTSIDE LANE: pre-existing check.sh failures boot.scenes (menu order), data.presentation (menu.letter), data.test, script.cond (loan tier); builder's integration list (main.js install calls, overworld stage/runPending/freezesClock, runner nickname speaker bug, fade/letterbox ops) still pending — **Done**: check.sh is green (4,765 tests, 0 failing, 2026-10-28).
