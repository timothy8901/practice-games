# Lampfall final playtests — October 28, 2026

**Result:** two final browser playthroughs covered the opening through Day 3 by ordinary play, and every later system from the six Spires to the post-game in an accelerated run. Neither run had a page error or a console error; validation and saving passed at every checkpoint. The runs logged 45 findings (23 early, 22 late), from save and progression blockers down to wording. A final fix pass fixed or partly fixed nearly all of them, and a separate verifier re-checked the fixes in the browser. This document records what was played, what was found and what is still open. It does not certify a full natural campaign.

Earlier evidence: `qa/HUMAN-PLAYTEST.md` (a hand playtest to Day 4, October 24) and the fix-wave reports summarised in `progress.md`.

## Setup common to both runs

- Chromium (Playwright build 1194) with SwiftShader, driven by Playwright with real key presses.
- Game served locally from `lampfall/` with `python3 -m http.server`; debug hook on (`index.html?debug=1`) for reading state only, unless noted.
- Page errors and console messages were collected on every launch, and the screenshots were looked at by eye.
- Screenshots, dialogue logs and driver scripts were kept in the session scratchpad. They are not part of the repository.

## Run 1: natural early campaign

**How it was played.** Fresh Flux game, seed `FLUX-9KK8-ZJCH`, ferret player "Bram", Scrapling starter "Fern". Settings: 12-minute days, Fast text, 4× battles. Every move, menu choice and battle input was a real key press. The debug hook was used to read state, to speed up the clock while walking or waiting, and to take harness autosaves between browser sessions. No resources, levels, flags or warps were granted. The run took about 65 browser sessions and stopped on **Day 3 at 19:19**.

**Errors.** 0 page errors. One console warning, repeated 4 times: missing art for `dossier-board-r` in the Turn Spire.

**Reached by ordinary play**

- Title, Settings, Seed Card, lease card (species, name entry, Signal), the causeway arrival.
- Starter choice and naming; the Wick and Corin porch scenes; the Read card; Linnet's dock hold-out (lost, as scripted).
- All six errands (apron, notice, orchard, mail sack and post office, Barnaby, Ansel); tree shaking; a purse tree; Ludo's eave shop (buy, sell, quantity picker).
- **Loan 1 paid on night one at 22:11**, from 3,000 errand credit, 24 pears sold to Ludo and 250 from the purse; the THWAP ceremony.
- Porch light and Dimity; the Capture Stance lesson and Lantern odds; capture naming; the Pip battle (won).
- Corin's slip note, the bed menu, two Day Pages, the Thatch roof overnight, K1 by hand and K2 from the mailbox, the midnight Raft cutscene.
- Porch gate and NPC schedules over two mornings; Commons board on three evenings; talks with residents.
- Grinding in the reeds to Lv8; the marsh boardwalk to Lowmoor; **the first Shift Forecast** (cards, Accept, rolled Down); Maud's practice table.
- Turn Spire: door, dossier, challenge, **loss**, blackout home ("You came home carried").
- Party and Summary, Satchel, Ledger, Field Log, Journal; manual saves, the overwrite confirm, Continue; reading auto and manual slot contents.

**Not reached:** the Turn Seal (so the Brackenford rematch, which needs badge 1, never opened); any resident thread beat (`world.threads` stayed empty); a Porch Duel (none was ever posted); the Waystone, ferry, fishing beyond one accidental cast, Archive donation and Memory, any progress on loan 2.

**Worst problems found**

1. **One Shift window Shifted the starter twice.** The `shift:resolved` autosave was written in the middle of Corin's Forecast script, before `sp.first-forecast` was set. Continue replayed the script, and Fern went Scrapling → Puddlepip → Sootling on a single Lv8 window.
2. **The tutorial Tossup was caught knowing only Settle**, so it could never deal damage.
3. **Porch Duels never appeared.** NPCs met in story scenes were not marked met, and the evening slate stayed frozen empty.
4. **The porch had one exit tile**, and Hesper (sometimes Wick) stood on it every morning, boxing the player in.
5. **Ludo's night shop was hidden on a wall tile**, and talking to Ludo never opened it.

After the double Shift the Turn Spire became a wall: Maud's Lv8 Puddlepip one-shot the Lv8 Sootling, and the Tossup could not attack.

Smaller findings: the Read card ignored Back; the Lantern panel showed "+3% from missed raises" while capped at 95%; the reeds battle used the beach backdrop; the naming confirm defaulted to "Not yet"; autosaves on Continue filled all three auto slots with copies; the map screen's route list overflowed; story NPCs replayed their first-meeting intros; the Day Page listed "Fern became Sootling" twice and skipped the Spire loss; Corin's stones lines ignored the tide; Linnet said "on my stones" in Pellwick; the Commons line named a tide that had passed; six stamp toasts landed at once over the Journal; Ledger and Day Page text sat off the ruled lines; the unbuilt bedsit drew as a beige wall slab.

**What felt good**

- Lighting and harbor mood: night lamps, the porch light coming on, the Lowmoor marsh.
- Clear battle UI: Strong/Weak labels, the Read card, the Lantern odds panel.
- A much tighter opening: about 12 text boxes from signing the lease to free control.
- Errands that turn night one into a sprint to the first payment and the THWAP.
- Warm writing in the Day Page and letters; Maud's dossier and the Spire concept.
- A kind blackout, safe-default confirms, and "Saved, verified" on the Day Page.

## Run 2: accelerated mid and late campaign

**How it was played.** Each milestone world was built through the game's own modules (`boot.buildRunWorld`, `loans.pay` / `chooseCommission` / `landDue`, `party.giveCreature`, `bag.give`, `memory.ensure`), then every piece was played through the real UI with key presses. Parties were raised to or above the posted curve where a run needed it.

**Errors.** No page errors and no console errors in any run (warnings only). `validate()` returned `[]` and `save()` returned ok at every milestone.

**Played through the UI**

- All six Spires, including both Ward sentinels (a win and a loss) and all three Relay rounds.
- The Summit: a Flux loss to the Bell, a Freefall restart, and a full climb to Idris; the Long Road Wick fight.
- The loan ladder from loan 2 to loan 7 at the yard counter, with real bed sleeps, room picks and roof colours.
- The Relighting firing by itself at 18:00, the full Reading, credits, the coda, and three post-game nights.
- The Tide Table and Day Page after the Relighting; Mudlark Mile thread pacing; the F1 family letter from Hesper's counter to the Dorrows' door; a visitor Porch Duel; paying through the pause-menu Ledger.

**Fixes from earlier waves that held:** Ward sentinels render, block their gaps, step aside after a win and heal the party in place after a loss; the dais chip starts the leader's challenge; boss Shift strips show and vanish correctly (Maud's Puddlepip, Bilgebob, Wick's Skipper); the Relay pick screen opens before every round, the satchel works between rounds and used creatures are greyed; badge gifts arrive once; Summit losses send you to the Bell (Drift/Flux) or restart the climb (Freefall) with no blackout; the Reading reads its phases from `THE_READING` (Ward lattice, phase weather, forced Relay send-in, fading decoys); dark houses reopen one per night after the Relighting; thread beats wait their spacing; the family letter lights the porch and brings Bilgebob; a won visitor duel pays its purse and costs nothing.

**Worst problems found**

1. **The Summit could be skipped.** The Keepers' Hall north door had no condition: with no Keeper beaten, you could walk to Idris, win, and get the Summit seal.
2. **The Reading's last offer drew no cards.** The text said "three cards… odds on every one", but nothing was drawn, Accept never said which ring landed, and the ring names differed from the strip. The Vagary sprite never changed across its seven Shifts and sank into the platform.
3. **Paying from the pause-menu Ledger skipped the room choice**, so loans 3–6 paid that way queued no room.
4. **The +5 PP between Summit fights was applied silently**, with no message anywhere.
5. **Relay sitters got no EXP**, although the dossier says the sitters are readier.

Smaller findings: sentinels used the plain standing-stone art and said "came out of the grass"; `{npcNick}` fell back to the NPC's own name; the duel slip named Barnaby's porch but the duel was offered at the Commons board; the Tide Table drew no card icons, repeated its title and said "1 Shifts pending"; room descriptions were clipped; the room-pick sound went to the wrong audio bus; paying off the Lamp Room asked for a roof colour and repainted the cottage; the Water-pack beat 1 played at Wick's door; the bed offered "Sleep till dawn" before 21:00 and showed a 24-hour clock; the Seed Card's Summit caption sat under the wrong slot; a Hollow Spire wreck post blocked the plank walk; chips showed raw verb ids (`bed`, `commons`, `open`); badge-gift toasts came before the leader handed the gift over; Cass's loss line on Freefall still said the Bell kept your place; missing-art warnings for the Sinking Engine props.

## The final fix pass

Two fix lanes (core and rest) worked through both lists, each followed by an independent verifier who re-checked the fixes in the browser. Full gate after the pass: `bash tools/check.sh` reports **CHECK OK, 4,765 tests passing in 188 files, 0 failing**.

**Fixed and checked in the browser**

- Double Shift: autosaves wait while a cutscene runs and land after it; a replayed script Forecast closes at once if the creature has no open window. Checked by walking onto Corin's real Lowmoor trigger: one Shift, and Continue does not replay it.
- Every caught creature joins with at least one damaging move (the tutorial Tossup gets Tap and Sure Pinch).
- Story speakers are marked met; the evening duel slate re-posts once neighbours are met, every hour and when the Commons board is read. A Day 2 evening board listed Wren, Tully and Augusta.
- Hesper's and Juniper's porch-gate spots moved off the exit; NPCs blocked part-way re-plan around people. The porch stayed open all of Day 2 morning.
- Talking to Ludo from 22:00 to 08:00 opens his night shop; a first sale there moves the objective on.
- A Shift that leaves the creature with no damaging move of its new type now teaches the new form's latest damaging same-type move at its level (a Down-Shifted Scrapling to Sootling learns Ember Lick), and the Forecast result names it.
- Lantern panel shows the miss bonus only when it changed the odds; Back closes the Read card; the reeds use the marsh backdrop; the naming confirm defaults to Yes.
- Autosaves on Continue or a new game are skipped; saves closer than 2 game hours overwrite the newest auto slot instead of rotating.
- Summit order enforced: challenging a Keeper or Idris out of turn says "The climb goes in order: Bastien Kell first."
- Between Summit fights a slip says every move regained 5 PP and HP stays as it is.
- KO EXP goes to whoever was standing at the KO, even after a loss; Relay sitters get the bench share.
- Pause-menu Ledger payments include the room choice; the Lamp Room payoff asks no roof colour.
- Sentinel art and labels; sentinel and Spire intro lines; Tide Table card icons; Seed Card caption; Hollow wreck post; chip words for every verb; 12-hour bed clock with unavailable rests greyed out; stamps batched into one toast with a quiet NEW tag in the Journal; text on the ruled lines; the bedsit void is transparent; Day Page names each Shift's form and notes a lost fight.

**Done in code, not fully wired**

- **The Reading's last offer:** the Forecast scene has a Reading mode (Ring cards with odds, Accept / Anchor / Reroll, the landed ring named), but the ending script still uses its dialogue choice, so the cards are not shown yet.
- **Badge gifts:** the early toast is gone and the seal slip says "A gift waits", but the gift is already in the satchel, so the leader's handover scene skips its `give` and shows no "Received" line.
- **Linnet's hold-out:** the strip and tactic tag now say "Stand as long as you can"; Corin's after-fight line was not reworded. A Reedkit still always falls on turn 1–2.

**Still open**

- The Turn Spire is hard for a Kiln lead against Maud's Brine team (the double Shift that caused it in Run 1 can no longer happen).
- Maud's practice table: Reroll is the default, so mashing Confirm loops "Again?", and every reroll shows the same faces.
- The Dorrows' "house" is a lamp on the cliff stair; its door tile is cliff.
- Not covered by either run: a full natural campaign from Day 3 to the Relighting in one save, physical touch and controller hardware, and browsers other than Chromium. In-game music is about 4 dB quieter after the audio pass and should be checked by ear.
