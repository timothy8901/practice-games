# Orchestrator brief: merging WILDSHIFT and PORCHLIGHT into one browser game

This brief sets the constraints every designer, judge, architect and engineer on this project works under.
Both pitches are WORKS IN PROGRESS, not final products. Take what each proved, cut what does not fit,
and invent what the fusion needs. The result must read as ONE game, never as two games glued together.

## The two sources (reference docs live beside this file)

- WILDSHIFT (wildshift-*.md): a turn-based creature-collecting RPG. Creatures "Shift" into new forms at
  random, and the player sees the odds first (Shift Forecast: three cards Up/Side/Down, Accept / Reroll with
  Starsalt / Anchor with a stone). Heartmark keeps nickname, level, Bond and one pinned technique through every
  form. "Readable chaos": Read a foe's types/ability before committing; Ward abilities have a tell and a readout.
  No soft-locks (0-PP moves unselectable, Scrap fallback), bench EXP, Mends cap on healing, evasion cap,
  Plumbline. Capture with a Lantern showing odds, Capture Stance. 12 types (Plain, Grit, Brine, Kiln, Moss,
  Bolt, Rime, Gust, Stone, Rust, Glass, Hollow) + Star. Eight Spires and a Summit gauntlet. A Chaos dial
  (Drift / Flux / Freefall / Custom) and shareable seeds. World: the Brindle Isles; the Vagary comet; skyglass;
  factions Mooring vs Scatter; rival Linnet Rask; Champion Idris Fenwake.
- PORCHLIGHT (porchlight-*.md): a real-time harbor-town life sim in "field-guide" pixel art. You arrive at
  dusk across a tidal causeway, take an interest-free building loan from Wren Hearthwright (beaver) and her
  father Ambrose, pay it off in seven tiers (each build happens overnight, tally sticks notched and split),
  and the seventh payment relights the dead lighthouse above your cottage. Every morning Hesper Coil (night-
  shift snail) delivers one thirty-year-old undelivered letter; the letters explain why the light went out.
  Two clocks: sun and a real tide (low tide opens the flats, causeway and stepping stones). "The night is half
  the game" (Porchlight Hours; someone is always buying). Neighbors with schedules, memory, porch talk and
  life threads. Shake trees, fish (tells you learn), dig fossils/relics, the daily Glint. Nothing hidden,
  nothing punished; no failure state.

## Hard constraints (non-negotiable)

1. Deliverable: ONE browser game in a new folder at the repo root of practice-games (follow the
   theater-of-the-undead convention: index.html + css/ + js/ ES modules + a README). Vanilla JS, Canvas 2D,
   WebAudio. No build step, no bundler, no framework, NO external network dependencies (no CDN fonts, no
   image assets fetched from elsewhere; all art is drawn procedurally or encoded in code). Must run from a
   plain static server (python -m http.server) in current Chrome, Firefox and Safari on desktop and on a
   phone (touch controls appear automatically). Keyboard, gamepad and touch all work. 60 fps on a laptop.
2. Fully playable, start to finish: title screen → new game → complete arc → ending (the Relighting) →
   credits → post-game. Save/load that never fails silently. A 20-30 minute first session must deliver:
   the arrival, the first creature, the first battle, the first catch, the first loan payment, the first
   old letter, and a Shift Forecast or a clear promise of one. A full run should be 4-8 hours of play.
3. One world, one title, one currency, one clock, one UI language. Shared cast. No dual-currency hacks
   unless each currency has one clear job (e.g. a main currency + Starsalt as the steering currency is fine).
4. Fairness pillars from BOTH pitches hold at every setting: odds visible before every roll; no input
   timing on any Shift or capture; no soft-locks; verified saves; one-of-a-kind items ask before they are
   spent; readable map (grass reads as grass); every tell uses shape/word/icon, never colour alone; no
   scolding, no guilt mechanics, no deadline on the loan.
5. Time is accelerated by default so the game is playable in sittings: default 1 in-game day = about 24 real
   minutes (settings: 12 / 24 / 48 minutes, plus a "Real Clock" mode that uses the actual time of day). Two
   low tides per in-game day. Night must be half the game (night encounters, night buyers, porch talk,
   glowing flats). Nothing is exclusive to one tide; the tide gives shortcuts and bonuses (and opens the
   causeways to the outer isles) but never traps the player.
6. Procedural pixel art at a fixed native resolution (e.g. 480x270 or 384x216) integer-scaled with crisp
   pixels; 16x16 tiles; creatures hand-encoded as palette-indexed string art (24x24 or 32x32) with per-
   individual Heartmark placement; palette rules from both art bibles. UI language: ledger, tally sticks,
   wax seals, torn-paper notices, field-guide type.
7. Procedural audio: hourly themes (at least 6 distinct day-parts) with adaptive stems for night / tide /
   weather / battle; synthesized sfx for every verb; music and sfx volume sliders; mute key.
8. Testability: all data modules and game rules are pure ES modules importable under Node (no DOM at import
   time) so they can be unit-tested; the game exposes a debug hook (URL flag ?debug=1) that lets an
   automated Playwright run speed time, grant items, warp, and read state, so a scripted full playthrough
   can prove the arc works end to end.
9. Original IP only: no Pokémon / Nintendo / Animal Crossing names, species-for-role pairings or assets.

## Scope guide (buildable by a team of agents; expand only where cheap)

- Map: one harbor town (the hub, Porchlight-sized: ~100 trees, quay, flats, river, green, point with the
  lighthouse) + 5 to 7 outlying isles/routes reached by tide-gated causeways and stepping stones, each with
  wild encounters, trainers, a Waystone/Shelter and a Spire at the end of a leg; a Summit.
- Creatures: 36-48 forms in 12-16 Shift families (keep the 15 named Wildshift creatures, invent the rest),
  60-80 techniques, ~20 abilities including the three Wards, the 12-type chart as written.
- Spires: 4 at minimum, 8 if content allows; a Summit gauntlet with the Summit Bell.
- Loans: 7 tiers with commissions and roof colours; the lighthouse scaffolding climbs per tier.
- Cast: merge both casts into one town (Porchlight's cast are the neighbors/shopkeepers; Wildshift's cast
  supply the rival, the Spire leaders, the factions and the Champion). 10-14 neighbors with schedules,
  memory and at least 6 hand-written life threads. ~50-60 old letters in a fixed order telling one story
  that explains BOTH the dark lighthouse AND the Shifting (the Starfall/Vagary and the Ebb winter should be
  the same night, or causally linked).
- Collections: 16-20 fish, 10-12 bugs, 10-12 fossils/relics, plus the Field Log (Seen/Read/Held).
- Chaos dial: Drift and Flux fully; Freefall if cheap; seeds as short codes; a Seed Card at the end.
- Challenge modes: at least No Rewind and One Heart.

## Design questions the panel must answer (with reasons)

- Title (one evocative name; sub-title allowed). Avoid "Tidemark", "Tally & Tide" (sibling concepts).
- The fiction that unifies: why did the light go out, what is the Vagary, what does the Relighting DO
  mechanically (e.g. steadies the Shifts so the Vagary itself can be met; calls the fleet home; opens the
  Summit) — and how do letters, loans, badges and Shifts pace each other without one gating all the rest.
- The player: an anthro animal (Porchlight's lease card) who becomes the Keeper AND a Shiftreader. How
  does the player get the Lantern and the first creature? Who teaches Read / Capture Stance (Corin?).
- Cozy vs combat: Porchlight has no failure state; Wildshift has blackouts. Resolve it (e.g. a blackout
  returns you to your porch at a small cost; neighbors are never fought; Spire leaders live on the isles;
  Porch Duels are friendly). Decide what EXP, money and badges each contribute to the loan ladder.
- Currency: buttons (◉), glint, or one of them renamed; what Starsalt and anchor stones cost in it.
- Session shape: one in-game day in ~24 minutes; what does a good day look like minute by minute?
- Which Porchlight systems become creature-aware (fishing with a Brine creature? shaking trees with a
  Gust creature? glowing-flats relics as skyglass?) and which Wildshift systems become town-aware
  (Shelter = your cottage/Rest; Rematch board = Commons board; Training Yard = a room commission?).

## Quality bar

"Triple-A studio quality, fully playable in browser" means: a complete, coherent, polished loop; menus that
never trap; crisp readable art with lighting and weather; music that changes with the hour; game feel
(transitions, particles, text effects, screen shake used sparingly); accessibility; zero console errors;
no dead ends; every number tuned so the first hour feels great and the arc holds.
