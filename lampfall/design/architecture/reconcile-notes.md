# Interface points to reconcile in the final architecture pass

From the world-model verifier (js/world, 156 + 68 adversarial tests green):
- §4.1 collision 'H' semantics: tide.js treats HIGH_ONLY as the mirror of LOW_ONLY (walkers cross only at high tide; boats float at low/mid). Confirm or change the draft text.
- §4.2 loadMap(def, tiles, {legend}) takes the tileset, not the Registry; js/world never imports js/data. Update the draft.
- §4.5 INTERACTION_PRIORITY is per kind (npc>roamer>item>sign>use-trigger>tree>rock>boat>prop>water>crack/mud>door>tile), not ['entity','useTrigger','tileVerb']. Pick one and document it.
- §4.8 resolveWarp has a 5th opts arg and extra reasons 'unknown-map' and 'blocked'. Update the draft.
- lighting.js owner: manifest says WORLD-FX, built by WORLD-MAP. Record in tools/lint-owners.mjs.
- js/world/npc.js consumes systems/schedule.whereIs (SYS-TOWN, not built yet). NPC_DEFAULTS.catchUpTiles=12 and wander pause are placeholders.
- Path cache is a standalone LRU (createPathCache) owned by the overworld scene, not store.derived (§4.4).
- TileInfo.tide is numeric TIDE_MASK codes in the real tilemap, strings in fixtures; consumers must accept the numeric form.
- lighting.DAY_PARTS = prototype hour table; retune if the GDD adopts judge-3's seven day-parts (music uses 8 three-hour blocks).
- tools/validate-data must reject non-finite encounter weights (rng.weighted throws on NaN/Infinity).

From the UI-kit verifier (js/ui, verdict solid):
- drawHud takes plain values (clockText, tide, wallet, tool, contextVerb, pendingShift, device); the G form only reads display size. Scenes must pass values.
- createToolRing needs tools/current/last passed explicitly.
- main.js already subscribes to the bus 'toast' event; if BOOT switches to createToasts(G) and keeps its own listener every toast shows twice. Pick one.
- Focus `index` setter clamps but does not skip disabled items; use set(i).
- Toast fade uses globalAlpha (briefly off-palette); dithered fade is a polish item.
- Disabled-reason tooltip (1.6 s) can cover the neighbouring row (e.g. the effectiveness word in the move menu).
- Textbox choices have a 250 ms choice lock; confirm has a 500 ms lock with a faint default cursor.

From the SYS-TIME verifier (clockSys, weather; verdict acceptable):
- New games start at 17:40 day 1 (schema NEW_GAME_START_MINUTE) with a day-1 low at 16:40 (DAY1_LOW_MINUTE); tide seed lives in state/schema (tideSeedFor), clockSys delegates.
- Integration to wire: overworld/fishing call weather.update after clockSys.tick and after any rest; dayFlow listens to day:start and clock:anchor; warps/tilemap call clockSys.gateTide; bed/porch scenes call rest/sit/stand. restoreFrom resets speed to 1 and unpauses (porch Sit never survives a reload).
- Real Clock resync spanning > 7 days reports only the last midnight; dayFlow misses the days between (acceptable: absence catch-up summarises).
- docs-checkpoint0.md / README claims that setTide and day length wait on core are out of date (freezeTide + setMinutesPerDay exist).

From the RULES-ECON verifier (bag, wallet, loans, shops; verdict acceptable):
- Items resolve from `items` OR `collections` (econ.itemOf / allItems); shore finds stack to 10 via tuning bag.stackByGroup.
- Script beat must set sp.lamp-room-offered (Wren offers the Lamp Room at loan 6); loans does not set it.
- validate-data should require ask:true on script `take` of one-of-a-kind items (bag.take returns needsConfirm otherwise).
- cond `hasItem` (selectors.itemCount) counts satchel stacks only; currency items (starsalt) read from the wallet -> {hasItem:'starsalt'} is always false. Fix in cond or selectors.
- threads.js calls loans.residentShare without data and must pass the economy day (06:00 turnover).
- Not built: Gallery frame income, Raft relic refining, Barnaby's archivePrice service (data fields exist).
- A test file (audio.director.test.mjs) has been seen hanging check.sh runs; tools/check.sh should run each file with a timeout.

## TUNING RECONCILIATION (must happen before integration; GDD-00 wins)
The rules lanes kept prototype DEFAULTS where GDD-00 later set different numbers. js/data/tuning.js and the FLOW callers must pass:
- mendsPerBattle 3 (tuning.js says 2), benchShare 0.6 (tuning.js says 0.5)
- payoutPerLevel 50 x highest level (battle default 40); expYieldDivisor 5 (default 7); EXP curve 8 x L^2 for every form (needs data.expForLevel/levelFromExp or the gainExp callback); holdOutExp 100 for the dock hold-out (default 0)
- captureOddsMax 0.95 (default 0.99); capture bands Slim/Fair/Good/Sure on Freefall (default Low/Fair/Good)
- Shift windows [8, 20, 34] (creature lane default 9/20/34)
- dials.js Freefall wardBadge should be false (badge only after the first blocked hit, rules 8.2/17.1); Freefall readCard party pips: decide (rules imply pips without shimmer)

## From the battle / creature / Forecast / capture / audio lanes
- FLOW: createBattle({gainExp: (c,a) => creature.gainExp(c,a,data,{tuning})}) so in-battle level-ups use the individual's own curve.
- FLOW: route captures through systems/capture.attemptCapture (engine _captureAttempt rolls unrounded odds) with rng stream capture:<battleId>:<attempt>; UI shows only captureOdds().shown.
- Heartmark: GDD-00 wants 4 anchors per form + one rolled per creature (stream heartmark:<uid>); schema stores mark {x,y}. Decide: store the anchor index (recommended) and resolve pixels from the form's anchors at draw time.
- Still Knot put on while a window is already open: hides it until removed (undecided; fine).
- Errant 'Down card never a hatchling' not implemented (0% Down kept, tunable).
- Signatures differ from ARCHITECTURE §5.1/§5.4 (data injected, tunables as DEFAULTS + tuning arg; rollForecast(world, creature|uid, data, opts)); update the draft.
- spire/summit AI 'finisher' step and summit heal threshold 0.4 are invented defaults.
- Battle scene must emit battle:hp after each switch and battle:event (or call G.music.battleEvent(ev)) in animation order, for the tense stem and sfx.
- Overworld must pass sfx: tile.sfx in player:step for wet footsteps.
- Debug hook should call G.music.refresh() after setTime.
- clockSys DAY_PARTS and tracks DAY_PARTS must change together if the day-parts change.
- main.js onShow can unmute even when settings.muted is true (BOOT bug).

From the SYS-TOWN verifier (letters, schedule, memory, threads, dayPage; verdict solid):
- FLOW: call dayPage.overnight at Sleep or at the clock:anchor morning, never at the porch bench; hand step.base (not step.rng) to gather.glintFor and weather.rollDay; forward wallet:changed, loan:paid and NOTE_EVENTS to dayPage.noteEvent; pass {loans: {residentShare}} to threads.advance/setBeat; attach TUNING as data.tuning or opts.tuning; bind __game.deliverLetter and __game.sleep.
- Calendar: day 1 is a Sunday (selectors.DAY0_WEEKDAY = 6) everywhere.
- Cast chapter must give each resident npc.porch {id (PORCH_IDS), mapId, x, y, facing, litAtStart?, days?, hours?} plus §14.5 schedule/topics/lines and festival spots; tuning.porchesLitAtStart holds the seven arrival-lit porches.
- Porch Supper is only a capability (festival row host:'porch'); add the row in content if wanted.
- Content fix: threads/mudlark-mile beat 2 advance.days should be 2 ('Legs need a day').

From the SYS-GATHER+WORLD verifier (fishing, gather, fieldLog, encounter; lane tests green):
- STATE: add settings.fishing ('standard'|'gentle'|'patient', default 'standard') with a migration; systems/settings.normalize currently drops it.
- Real Clock: day numbers are absolute, so the Glint (500 + 60 x day) would pay ~a million. Use a run-relative day (days since new game) in wallet/clockSys/gather.
- DATA: wire js/data/collections.js and encounters into js/data/index.js; DATA has no `tuning` table: scenes must pass ctx.tuning = data/tuning.TUNING (or add it to DATA).
- Kept: Brine tell threshold 1 catch (GDD-00 §9); encounter floor 8 free steps; night low = night now and within ±90 min of a low.
