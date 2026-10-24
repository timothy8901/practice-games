# Lampfall browser playtest — October 24, 2026

**Result:** the opening and first town progression are playable, but ordinary play exposed thirteen bugs. Only reproduced bugs were changed. This is a broad early-game playtest, not certification of the entire campaign.

## Method and saved progress

Played in a visible Chromium browser with ordinary keyboard and mouse input, reading screens and inspecting screenshots. The main run began from a fresh save on Flux, seed **FLUX-4KNZ-CH4G**. No money, levels, items, badges or story flags were granted; no debug warps or simulated time were used in this run. The game's own day-length, text, battle-speed and fishing assistance settings were exercised. Source map coordinates and a route computed from the authored map were consulted when the unlabeled local map made navigation unclear. Read-only diagnostics identified gathering and NPC collisions after they were observed during play.

The main run reached **Day 4**, cleared the 6,000-button first loan through errands, gathering and sales, lit the porch, completed the roof overnight, and received/read Isolde's first letter. Puddle reached level 6 after beating Pip; Coin was caught and named. A natural wild Puddlepip was Read, weakened to 1 HP with Capture Stance and caught on the second attempt. The boardwalk route to Lowmoor was walked normally. A Grey Mullet was caught, kept and donated. Slot 1 preserves that progression. A previous Slot 3 was replayed to reproduce the indoor payment trigger and overnight scenes after fixes. Replay progress is separate from the main checkpoint.

A second fresh run checked the Opossum/Pewter/Mask customization and the starter's Held entry. Later-game fixtures and automated tests are supplemental evidence; they do not represent a human campaign completion.

## Reproduced bugs and fixes

| ID | Problem observed through play | Fix and verification |
| --- | --- | --- |
| HP-001 | The first battle displayed a red **Save failed: busy** toast without a manual save attempt. | Autosaves now wait until battles/transitions finish. Re-tested a capture battle without the false failure; deferred-save regression tests pass. Evidence: 037, 153–164. |
| HP-002 | Authored native-fruit trees said they were empty on their first shake and gave no fruit. | Native fruit is resolved consistently from the run seed. Three presses yield three fruit, stripping/regrowth tests pass, and collected pears were sold normally. Evidence: 074–080, 214, 268–273. |
| HP-003 | Gathered goods appeared as raw identifiers such as `pear`, with missing detail. | Satchel uses the collection-item adapter. Pear and Grey Mullet names/details now display. Evidence: 080, 201, 266. |
| HP-004 | The party's starter counted as Seen but **0/42 Held**. | Successful creature gifts register Held; existing saves backfill owned party/box forms. Both a fresh starter and the existing run were checked. Evidence: 141–143, 200; fresh-run 015–016. |
| HP-005 | Settings said **4×**, but the next battle used **2×**. | Battle reads the saved preference; battle speed changes write back to settings. Pip's actual battle displayed **SPEED 4×**. Evidence: 133–136, 154–155, 235–237. |
| HP-006 | Turning in place, then shaking a tree reset facing to the previous walking direction; repeated interaction missed the tree. | Persist facing on turn events. Repeated harvesting now keeps the chosen direction. Evidence: 203–206, 267–268. |
| HP-007 | Field Log told me to donate a specimen at the Archive, but its counter offered empty Buy/Sell tabs and no donation action. | Archive now offers Donate for carried, logged specimens not already donated. Keep is the default; confirming consumes one specimen and marks the Field Log. Actual Grey Mullet donation and the **1 donated** counter were verified. Evidence: 167–172, 226–231. |
| HP-008 | Paying through the pause ledger staged the yard ceremony inside Pell's shop. Sleeping likewise staged roof work and Hesper's gate visit inside the bedroom. | These three scenes establish the correct exterior map before placing actors/camera. Replayed the indoor payment through normal Save/Load and confirmed the yard location. Overnight replay evidence is included. Evidence: 218, 255–258; 276, 290–291 after fixes. |
| HP-009 | After loan 1, Dimity occupied the single cottage-door approach and prevented entry. | Her standing location is beside the doorway. Entered the cottage and reached the bed after reload. Evidence: 245–249, 285. |
| HP-010 | Rain drew across interiors, including the cottage and shops. | Interior rendering suppresses outdoor weather. Interior screenshot and tests check the absence of particles; the test also checks weather returns outdoors. Evidence: 218, 250, 263. |
| HP-011 | During replay, Odile got stuck in the doorway while following a route through the solid porch bench. | NPC routes now detour around solid props instead of repeatedly selecting the blocked tile. A real-driver regression covers walking around a bench; the resumed cottage path is accessible. Evidence: 282–285 and NPC diagnostic. |

| HP-012 | Entering Lowmoor revealed missing trainer sprites and two renderer warnings for `trainerVest`/`trainerCoat`. | Registered the already-authored generic bodies under the IDs used by trainers. Every trainer sprite now resolves in a regression test; the Lowmoor reload is included in evidence. Evidence: 309–312. |

| HP-013 | The native save-transfer text box ignored pixel-perfect letterboxing, extended outside the game frame and covered its buttons. | Position the text box with the display’s game-to-screen conversion. A layout regression checks its bounds; export/import were then exercised in the real browser. Evidence: 313–315 before; 316–320 after, including the successful import. |

The pre-existing Relighting trigger correction was preserved separately; it was not discovered by this human playtest.

## What I played and checked

- New game, seed/lease, starter choice and naming; secondary character customization.
- Arrival, Wick/Corin conversations, Reading Glass, tutorial holdout battle, Read card, moves, post-battle return.
- Town walking, day/night presentation, gates and solid obstacles; local and isle maps.
- Four first-night errands: orchard, notice, apron and shell, totaling 2,000 loan credit.
- Native-fruit harvesting, empty-tree behavior, purse discovery, shop sales, quantity changes, partial repayment and first-loan clearance.
- Patient fishing: Grey Mullet kept and Herring released, with collection records. Standard/Gentle misses were affected by automation latency and are not treated as game defects.
- Capture Stance, a failed capture followed by a successful Tossup capture, naming Coin and returning to town.
- Pip trainer battle: Undertow, incoming damage, victory, 200-button reward and Puddle's level increase.
- Unscripted Puddlepip encounter: Read, damage, failed capture, Capture Stance leaving 1 HP, successful capture, bench EXP and default-name confirmation. Walked the marsh boardwalk into Lowmoor.
- Party/Summary, Satchel, storage deposit and withdrawal, Ledger, Settings, Field Log, Archive Memory, Archive donation, Journal/letter screen, Save/Load and manual-slot overwrite confirmation.
- Lie down, refusal to sleep too early, a nap to dusk, sleep till dawn, healing, Day Page, verified saving, porch-light scene, overnight roof and first Keeper letter.
- Reload/Continue and loading an earlier manual slot. A portable export and browser storage backup preserve the tested progress.

No page errors or browser console errors were recorded in the main session. Two missing-trainer-art console warnings appeared on the first Lowmoor visit; those sprites were fixed and re-tested after reload. The evidence log preserves each sampled state and screenshot path; the long wall-clock span includes pauses, investigation and regression work, not continuous active play.

## Player feedback — recorded, not changed

**What worked:** the harbor atmosphere, changing light, warm porch lamps and character voices give the two pitches a shared identity. Read information and Capture Stance create understandable tactical choices. The loan's visible balance, errand credit and THWAP make small town activities feel connected to a larger goal. Storage, safe-default confirmations and verified saves are reassuring.

**Opening pace:** a substantial amount of text and repeated confirmation comes before free play. The narrative is engaging, but the first meaningful decision could feel distant to a new player.

**Finding places:** the local map lacks building labels and clear quest destinations. I repeatedly had to search for the yard, shop, Archive and cottage routes. Orchard trees, fences, lamps and house entrances can make short trips surprisingly indirect. Source coordinates helped; a first-time player would not have that aid.

**Control discoverability:** Capture Stance has a visible button, but its backquote shortcut is hard to discover. Different naming screens have different confirmation behavior. Z/X are literal letters during text entry, which caused tester input mistakes; those mistakes are not counted as bugs.

**Tutorial expectations:** Corin's capture explanation quotes roughly 62% while the full-HP Tossup capture screen showed 33%, then 36%. Record this as a mismatch in expectations/balance to review, not a confirmed rules defect. The orchard script also describes three fruit falling without itself awarding those fruit; the player must still shake the trees.

**Later reminders:** an empty mailbox saying “Post comes at six” does not explain that the porch must first be lit. Early empty Memory/Journal screens can leave the next step unclear. No changes were made for these clarity observations.

**Battle and economy balance:** Pip was defeated in one Undertow in this run. That is one data point, not enough to justify rebalancing. Fruit, purse income and errand credits paid the first loan without a deadline or forced grind once the harvesting bugs were fixed.

## Verification boundary

The complete multi-isle campaign, every Spire, every resident thread, all seven loans earned naturally, every Shift/capture outcome, the full collection, long-term balance, and the ending have **not** all been completed in this ordinary-input run. Physical controller/touch devices, Safari/Firefox, mobile layouts, and subjective audio quality remain unverified. A separate accelerated fixture was re-run on the final code and reached Relighting, all seven Reading phases, credits and the coda with no browser errors or save-validation problems; it is explicitly separate from this playthrough.

Final automated results and the exact snapshot count are summarized in `Verification.txt` in the exported evidence bundle. Selected before/after screenshots are listed in the evidence index in that bundle. The exported Day 4 save can be pasted into Save → Transfer → Import. No Pages deployment or main-branch merge was performed.
