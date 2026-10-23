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
