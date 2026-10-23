# GDD-09 — PRESENTATION

Screens, controls, motion and juice, accessibility and settings, the Chaos dial, the Seed Card, challenge seals, the audio cue sheet and the UI string glossary for **LAMPFALL**. GDD-00 §13–§15 are binding; this chapter turns them into pixel rectangles, frame counts, toggles, sound names and string keys. Where existing engine code disagrees with GDD-00, the disagreement is listed in §13 as a request; nothing here renames anything.

**Files this chapter owns:** `js/data/strings.js` (the glossary: `STRINGS`, `VARS`, `CONFIRMS`, `t`, `has`, `fill`, `plural`, `varsOf`, `confirmSpec`), `js/data/credits.js` (the roll), `test/data.presentation.test.mjs`, this document.

**Conventions used below.**
- Rectangles are `x,y,w,h` in native pixels on the **480×270** buffer (origin top-left). Text is drawn on the **960×540** overlay at 2× from the same native coordinates, so a text box's native rect is what layout uses.
- Frames are at **60 fps** (1 f = 16.7 ms). "In 6 f / out 4 f" is the panel rule from GDD-00 §14.
- String keys are written `like.this`; every visible word on every screen below has a key in `js/data/strings.js`.
- Actions are `js/core/input.js` action names (`confirm`, `cancel`, `menu`, `run`, `tool`, `map`, `log`, `start`, `select`, `l`, `r`, directions).

---

## 1. Canvas, grid and the UI kit

| Token | Value | Source |
|---|---|---|
| Native buffer | 480×270, integer scale only, nearest-neighbour | GDD-00 §14, `config.NATIVE_W/H` |
| Tile | 16×16 (30×17 visible) | GDD-00 §14 |
| Skyband | top **40 px** of every overworld frame | GDD-00 §13–§14 |
| Layout grid | 4 px (`ui/theme.GRID`); spacing `hair 1, xs 2, sm 4, md 8, lg 12, xl 16, xxl 24` | `ui/theme.SPACE` |
| Safe margin | 8 px from every edge for text and buttons | this chapter |
| Faces | `main` 5×7 (+2 descender, +1 leading, line 10 px), `small` 3×5 (line 7 px); distinct I / l / 1 | `core/font`, `ui/theme.TYPE` |
| Cursor | `▶` left of the focused item, bobs 1 px every 520 ms; plus a 1 px dotted focus ring | `ui/theme.TYPE.cursor`, `TIMING.cursorBobMs` |
| More marker | `▼` bottom-right of a text box, blinks 30 f on / 30 f off | `ui/theme.TYPE.more` |
| Currency glyph | `◉` (buttons) | `ui/theme.TYPE.currency` |
| Touch targets | ≥ 44 CSS px; at the default 3× phone scale that is ≥ 15 native px; every button below is ≥ 16 native px tall | GDD-00 §13 |

**Panel styles** (`ui/panel.drawPanel`): `paper` (cream `#F6F1E3`, ink edge), `ledger` (ledger paper `#F4F1E6` with faint blue rules every 10 px and a red margin line), `notice` (torn-top slip), `card` (rounded 2 px, drop shadow 1 px right/down), `dark` (night ink `#141B33` at 90%, cream text). **Wax-seal buttons** are 16 px tall, wax red `#A8323A` with a cream label; the focused seal rises 1 px and gains the dotted ring. **Tally bars** are twenty notches, one notch per 5%.

**Colour law.** Comet magenta `#FF5BD6` appears only on Heartmarks, skyglass, Shift effects, the Forecast panel, the comet and the Vagary. After dark the two ambers (porchlight `#F9C46B`, lighthouse `#FFB547`) and real flames are the only saturated warms. No pure black or white anywhere (the scene stack's default transition colour is a request in §13). Every tell is shape + word + icon; nothing reads by colour alone.

**Menu law** (ARCHITECTURE §7): `cancel` goes back one level and never changes state; cursors open at the top; pockets never remember a cursor; `up` from the top of the pause menu wraps to **Save**, which is always last; opening any scene flushes input.

---

## 2. Motion rules and the transition catalogue

| Motion | Frames | Rule |
|---|---|---|
| World | 60 fps | camera snapped to whole pixels |
| Characters | 12 fps (a pose every 5 f) | one anticipation frame per verb; squash ≤ 10%; no rotation |
| Walk / run | 16 f per tile / 8 f per tile | bump: 6 f squash + `blocked` thud |
| Grass rustle | 3 frames × 4 f | |
| Panel in / out | **6 f / 4 f** | slides 12 px from its anchor edge with ease-out; never cuts |
| Torn-paper slip | **5 f** | tears in from the right |
| Toast | slide 11 f (180 ms), hold 180 f (3 s), fade 18 f (300 ms) | `ui/theme.TIMING` |
| Tool ring | open after 13 f hold (220 ms), opens over 7 f (120 ms) | `TIMING.toolRingHoldMs/OpenMs` |
| Scene fade / iris / wipe | **24 f** (400 ms, `config.TRANSITION_MS`) | input ignored while running; callback at full cover |
| Battle entry | iris 24 f closing on the player, 6 f hold, open 18 f on the arena | wild: from grass rustle; trainer: after the exclamation 30 f |
| Blackout | 40 f fade to porchlight amber, 20 f hold, 24 f open on the porch | GDD-00 §6 |
| Day Page ink | 60 f (inked in one second) | GDD-00 §9 |
| Confirm / Forecast lock | 30 f (500 ms) ignoring held and new buttons | `TIMING.inputLockMs`; GDD-00 §8 |
| Dialogue choice lock | 15 f (250 ms) mash guard | `TIMING.choiceLockMs` |
| Hit-stop | **0 / 2 / 4 / 6 / 8 f** by effectiveness (§5) | 2 px nudge toward the target |
| Screen shake | only on THWAP (2 f) and crits (2 f, 2 px) | off under reduced motion |
| Heartmark glint | 30 f | on send-out, level-up, Shift, Anchor and Heartmark-technique use |
| Ward shimmer | 48 f lattice sweep every 4 s (240 f) | stilled under reduced motion (badge stays) |
| Number tumble | 2 f per digit change, max 24 f | wallet, odds, payouts |

**Reduced motion** replaces: slides with 4 f cross-dissolves, the Shift scramble with a 30 f dither fade, the Lantern unfold with a 12 f dither fade, shake and particles with nothing; shimmer becomes a static lattice outline. Durations never grow.

---

## 3. Screen specifications

Each screen lists regions, elements, states, transitions and input. "K / G / T" are keyboard, gamepad, touch.

### 3.1 Title (`scenes/title.js`)

| Region | Rect | Shows |
|---|---|---|
| Harbor | 0,0,480,270 | live harbor at the real hour: lighthouse dark until the save's `lit.*` flags, then the beam; porches lit as in the save |
| Skyband | 0,0,480,40 | sun or moon at the real hour, the comet smudge (brighter by act), meteors at night |
| Logo | centred x 240, y 52 | `game.title` at font scale 4 in cream with a 1 px night-ink shadow; `game.subtitle` small at y 88 |
| Seals | 16,186,96,64 | three wax seals 96×16, 8 px apart: `title.continue` / `title.newGame` / `title.settings` (`title.resume` replaces Continue after a crash) |
| Save hint | 120,186,240,16 | `title.save.summary` + `title.save.minutesAgo` beside Continue; `title.noSave` when there is none |
| Seed code | right-aligned at 472,258 | `title.seedCode` small; `game.version` above it at 472,250 |
| Error line | 16,254,300,10 | `title.loadFailed` in wax red; `title.rollback` under a crash resume |

States: **no save** (Continue greyed with the word, cursor on New Game), **save ok** (cursor on Continue), **crashed** (Resume autosave first), **load error** (line stays until the next input). Transitions: boot → title fade 24 f from night ink; Continue → fade 24 f to the overworld; New Game → iris 24 f to the Seed Card; Settings → panel in 6 f. Input: up/down, `confirm`; `cancel` does nothing (there is nothing behind the title); T: tap a seal to focus, tap again to open. Music: `title` cue (§10).

### 3.2 Seed Card (`scenes/seedCard.js`)

A card on the keeper's desk, 336×208 at 72,31 (`card` panel).

| Region | Rect | Shows |
|---|---|---|
| Heading | 84,39 | `seedCard.heading`; `seedCard.subheading` small |
| Dial | 84,60,312,40 | `dial.question`; three pips 96×24 (Drift / Flux / Freefall with `dial.*.tag`), filled `●` for the chosen dial, `○` otherwise |
| Rules strip | 84,104,312,36 | for the focused dial: `dial.odds`, `dial.rule.read`, `dial.rule.capture`, `dial.rule.anchors` (two columns, small face) |
| Seed | 84,146,312,16 | `seedCard.seed` + code (`FLUX-K7Q2-MD7F` form); `seedCard.reroll` and `seedCard.typeSeed` seals |
| Seals | 84,168,200,32 | four challenge seals 32×32 (§9) with names underneath on focus |
| Begin | 312,214,84,16 | `seedCard.begin` wax seal |

States: fresh (Flux, random seed), typed seed invalid (`seedCard.seedInvalid` slip, 5 f), a seal toggled (seal presses 4 f, the code re-encodes and tumbles). Transitions: in by iris from the title; Begin → fade 24 f into the arrival cutscene (the clock is held at 17:40). Input: directions move between dial / seed / seals / Begin; left/right turn the dial; `confirm` toggles a seal; `cancel` returns to the title (nothing kept). Music: continues `title`.

### 3.3 Lease Card (`scenes/leaseCard.js`)

| Region | Rect | Shows |
|---|---|---|
| Card | 8,8,464,254 | `ledger` panel; `lease.heading` + `lease.issuer` across the top |
| Fields | 16,40,224,150 | ten ledger rows 14 px: Species, Fur, Markings, Eyes, Blush, Outfit, Pronouns, Name, Town, Wake point (`lease.field.*`), value right-aligned with `◀ ▶` on focus |
| Preview | 280,40,96,120 | the 16×24 rig at ×3 (48×72) on a turntable; `l`/`r` turn it through four facings, 8 f per step |
| Wren | 400,150,48,48 | Wren's bust; she blinks every 3–5 s and nods 6 f on each change |
| Signal | 120,204,240,40 | six chimes (D E F# A B D) 24×36 each, 40 px apart; the composed Signal as six note heads under them; `lease.signal.play`, `lease.signal.reset` |
| Sign | 392,244,72,16 | `lease.sign` seal |

The card's back (`l`/`r` on the Sign seal, or `lease.back`) holds the Chaos dial pips, the seed code, the challenge seals and the wake point, read-only after the Seed Card. Name and Town open the controller-first entry grid (§3.27). States: first visit (all fields), mirror visit from loan 2 (`lease.mirror`; Town locked with `common.locked`). Transitions: panel in 6 f; Sign → the card flips 12 f (two 6 f halves) and slides down 6 f. Input: up/down fields, left/right values, `confirm` opens entry or plays a chime, `cancel` returns to the previous field (never discards the card).

### 3.4 Overworld HUD (`ui/hud.js`)

| Region | Rect | Shows |
|---|---|---|
| Skyband | 0,0,480,40 | sun and moon on a 24-hour arc, clouds by weather, the comet, meteors after 20:00; **tide needle** at 408,8,64,24 (arrow shape on a five-step scale + `tide.*` word + `tide.lowIn` / `tide.highIn`) |
| Clock chip | 8,8 | sun or moon icon + `hud.time.am/pm`; `hud.day` small under it; `hud.realClock` under Real Clock |
| Wallet | 392,44,80,14 | `wallet.amount`; slides in 6 f on change, holds 120 f, out 4 f; `wallet.delta.gain` floats up 12 px over 30 f |
| Shift pip | 0,120,16,40 | the `✦` badge + `hud.shiftPending` / `hud.shiftsPending`, only while a window is pending |
| Context chip | 16 px above the player's head, centred | device glyph + verb word (`verb.*`), greyed with reason (`verb.needsTool`, `verb.underWater`) |
| Tool chip | 8,248,96,14 | equipped tool icon + `tool.*` name + tool binding glyph |
| Captions | 120,224,240,14 | `caption.*` chips (§6) |

No minimap. States: day / night (moon, porchlight-amber chips), Real Clock, paused (`hud.paused` small, during scenes that hold the clock), clock hidden in cutscenes. Input: none of its own; T: tapping the context chip is `confirm`, swiping down from the Skyband opens the Map.

### 3.5 Dialogue (`scenes/dialogue.js`, `ui/textbox.js`)

| Region | Rect | Shows |
|---|---|---|
| Slip | 8,198,464,64 | `ledger` slip across the bottom 72 px |
| Bust | 16,206,48,48 | 48×48 bust; talking frame alternates every 6 f while text types |
| Name tab | 16,190,~80,12 | wax-seal tab with the speaker's name |
| Text | 72,206,392,48 | four lines at 10 px; typewriter at the text speed (22 / 45 / 90 cps / instant), 90 ms beat on commas, 220 ms on full stops |
| Linger | 416,250,48,12 | `verb.linger` small seal (one more line, never the same line twice) |
| More | 456,254 | `▼` |
| Choices | 312,140,152,~ | a `paper` list slides in 6 f above the slip; 15 f choice lock |

Input: `confirm` completes the line, then advances; `cancel` also completes/advances (never skips a choice); T: tap anywhere on the slip. Each speaker ticks in their trade (§10.5).

### 3.6 Tool Ring (`ui/toolRing.js`)

Eight brass sockets 20×20 on a 28 px radius circle centred on the player, starting at 12 o'clock clockwise: **Rod, Net, Shovel, Reading Glass, Lantern, Grafting Knife, String Lights, Weatherglass** (`tool.*`). Empty sockets show a dotted outline and `toolRing.empty`. The focused tool's name sits under the ring. Hold `tool` (13 f) to open; directions or the stick pick a socket; release equips (`toolRing.swapped` toast). Tap `tool` swaps with the last tool. `cancel` closes without change. T: the ring button above B; drag to a socket.

### 3.7 Satchel (`scenes/bag.js`)

| Region | Rect | Shows |
|---|---|---|
| Panel | 16,24,448,230 | `paper` |
| Tabs | 24,28,432,14 | six pocket tabs 72×14: Wicks, Medicine, Discs, Finds, Held, Keepsakes (`pocket.*`); `l`/`r` switch |
| List | 24,48,240,192 | rows 12 px (16 visible): icon 8×8, name, `bag.count` right-aligned |
| Detail | 272,48,184,160 | 32×32 icon, name, one-line effect, `bag.heldBy`, actions (`bag.action.*`) |
| Slots | 272,228,184,10 | `bag.slots` (20 → 30 with the cottage → 40 with the Cellar) |

States: empty pocket (`bag.empty`), keepsake (no sell, `bag.keepsakeSafe`), disc (learner strip of party heads, lit = can learn). `cancel` never drops an item; one-of-a-kind items open `CONFIRMS.oneOfAKind` (Keep it first).

### 3.8 Hearth Ledger (`scenes/ledger.js`)

| Region | Rect | Shows |
|---|---|---|
| Page | 8,8,464,254 | `ledger` panel |
| Owed | 16,16,320,28 | `ledger.owedTo`; `ledger.toGo`; the twenty-notch stick 16,36,300,12 (`ledger.notches`) |
| Pace line | 16,52,320,10 | `loan.pace.*` from `systems/loans.paceEstimate` |
| Today | 344,16,120,72 | `ledger.today` by source (`ledger.source.*`) |
| Spire shares | 344,92,120,40 | `ledger.spireShares`, one wax seal per share |
| Houses | 16,170,448,72 | seven carved houses 56×64, labels `ledger.house.paid/paying/pick/later/finale` (word + carving: Paid split stick, Paying half-notched, Pick a question mark, Later blank, Finale the lamp) |
| Pay | 400,246,64,16 | `ledger.pay` (at the yard only) |

The last page is **the dial** (§7), reachable only at home. Input: `l`/`r` turn pages; `confirm` on Pay opens the amount picker (`ledger.payHow`, digits step 100/1,000/10,000 with up/down and left/right).

### 3.9 Tide Table & Commons board (`scenes/mapScreen.js` board tab, gate boards)

A plank 464×214 at 8,48. Left: the **Tide Table** chalkboard 16,56,200,198: seven days of `tide.lowAt` rows (today highlighted with a chalk box), spring days marked `tide.spring`, `board.windows` listing each creature's next window and `board.shiftsPending`; after `lit.shiftTide`, `board.shiftTideLine` rows with three tiny card icons. Right: the **Commons board** 224,56,240,198 with pinned slips (`board.slip.*`): weather odds (`weather.odds`), cracks seen, thread beats, the Porch Duel slate (`board.slate.offer` × 3), the Spire dossier (`board.dossier.immune`), Errant sightings (from badge 5), the Commons Jar (`board.jar.progress`). Slips tear in 5 f each, staggered 3 f. Input: directions move between slips; `confirm` enlarges one (panel 6 f).

### 3.10 Map (`scenes/mapScreen.js`)

Full-screen illustrated ring (the GDD-00 §4 diagram as art): six isles, the lagoon, Shardcrown, the Bar, the Lantern Stack, Pellwick. Overlays: neighbor heads 8×8 where they are now; the player `map.youAreHere`; Waystones (lit lamps if Lantern-paths are open, `map.lanternPath`); Errant lightning (`map.errant`, once seen or with the Weatherglass); `map.litPorches` and `tide.nextLows` in a slip at 336,224,136,40; each isle's `map.curve` on focus. Input: directions move between isles; `confirm` offers the ferry (`CONFIRMS.ferry`, Stay first) or a Lantern-path; `cancel` closes; `map` toggles. Open/close: wipe down 24 f.

### 3.11 Party (`scenes/party.js`)

| Region | Rect | Shows |
|---|---|---|
| Rows | 8,16,280,240 | six rows 38 px: 16×16 head icon, nickname, `common.level`, HP bar 64×4 with `party.hp`, PP bar, window pip (`party.pip`), curve gap (`party.curve.*`), `party.heldByKnot` |
| Coverage | 296,16,176,240 | the twelve types as `drawTypeChip` icons with ticks; `party.gap` in words, or `party.noGap` |

States: fainted (`party.fainted`, greyed icon), One Heart (`party.oneHeart` slip), Shift pending (`✦` on the row). Input: up/down; `confirm` opens a mini menu (Summary / Swap / Lead); `l`/`r` switch to Coverage.

### 3.12 Creature Summary

Sprite 64×64 (32×32 at ×2) at 16,16 with the Heartmark at its rolled anchor; nickname, form name, types, `common.level`, `summary.exp`; stats at 96,16,176,64 (`summary.stat.*`); techniques at 280,16,192,64 with PP; ability + held item at 96,88; Bond pips (five, `summary.bond`) at 280,88; the **Shiftlog strip** at 8,206,464,48: each past form as a 32×32 icon with the mark drawn **in the same spot**, arrows between; preset at 280,112 (`summary.preset.*`). `summary.heartmark` names the spot. Input: `l`/`r` switch creatures; `confirm` on the preset cycles it.

### 3.13 Field Log

Grid of **42 plates**, 7 columns × 6 rows, each 60×34, at 30,24. A plate: 32×32 icon (silhouette when unseen), glyph + word `fieldLog.seen` / `fieldLog.read` / `fieldLog.held` (eye / lens / Heartmark glyph). `fieldLog.count` at 8,256. `confirm` opens a plate (panel 6 f): sprite, types, habitat (`fieldLog.habitat`), `fieldLog.anyTide`, `fieldLog.night`, the family line.

### 3.14 Archive (Barnaby's)

Tabs `archive.fish/bugs/finds/stringWall/memory/recall` across 16,16,448,14; lists as in the Satchel; the string wall is a cork board 16,40,448,214 with pinned finds and red strings to letters; Memory (`archive.relearnFree`) and Recall (`archive.recallCost`, `archive.recallLocked`) open the creature picker then a technique / form picker.

### 3.15 Shop

Rows 16 px at 16,40,448,200: icon, name, `shop.price`, `shop.after` (what you would hold after buying), and for discs a learner strip (party heads, lit = can learn; `shop.noLearners`). Header: keeper bust 48×48 at 16,8 and the shop name; `shop.wanted` slip pinned top-right with `shop.wantedBonus`. Tabs `shop.buy` / `shop.sell`. Quantity picker `shop.qty` + `shop.total`. Caps: `shop.dailyCap`, `shop.soldOut`, `shop.cantAfford`. Purchases over 2,500◉ on Freefall use `CONFIRMS.buyDear` (No first).

### 3.16 Battle (`scenes/battle.js`)

| Region | Rect | Shows |
|---|---|---|
| Arena | 0,0,480,198 | backdrop by map and hour (LUT graded) |
| Foe | 320,24,96,80 | foe sprite 64×64 (×2) on a shadow ellipse; Ward lattice shimmer |
| Foe box | 8,8,184,44 | name + `common.level`, type chips, HP bar 120×4 (no numbers), tag row: `battle.tag.ward` (`Ward ?` → `battle.tag.wardKnown` once Read), `battle.tag.eva`, `battle.tag.mends` pips `○○○` (`battle.tag.mendsUnknown` until Read with the Prism) |
| Player | 56,110,96,80 | back sprite 64×64 |
| Player box | 288,146,184,48 | nickname, `common.level`, HP bar with `party.hp`, EXP bar, Heartmark glyph, status chip |
| Message | 8,202,464,20 | the current battle line (`battle.msg.*`) |
| Commands | 8,228,464,32 | five seals 88×28, 4 px apart: `battle.cmd.fight/read/lantern/bag/run`; in wild battles `battle.cmd.stance` toggles from a small seal at 440,204 |
| Moves | 8,202,464,60 | 2×2 grid of 228×28 cells: name, type chip, `battle.pp`, effectiveness word right-aligned (`battle.eff.*`); `battle.ppEmpty` cells refuse with the EMPTY thud and the cursor stays; all empty → `battle.scrap` |
| Speed chip | 440,188,32,10 | `battle.speed` |

States: wild, trainer, Spire (posted strip for scripted Shifts), Summit, story (no Run, `battle.msg.runNo`; hold-out counter `battle.msg.holdout`), Errant (prompt `battle.errant` first). Low HP (≤ 25%) turns the HP bar to a striped pattern (not just red) and raises the `tense` stem. Transitions: §2 battle entry; end: victory sting, panel out 4 f, fade 24 f. Input: directions + `confirm`; `cancel` backs out of Moves/Bag; `l` cycles battle speed (§4); T: tap seals.

### 3.17 Read card

`card` panel 200×96 over the foe box at 8,8, slides down 6 f. Rows: `read.types` (chips), `read.ability` (name + rules text), `read.ward` (`read.wardNone` / `read.wardActive` / `read.wardSuppressed`), and with the Scouting Prism `read.moves`, `read.held`, `read.mends`. Never blank: an unknown field shows `read.unknown`; a grey field shows `read.notYet`; a known one shows `read.confirmed` with a tick-shaped `✦`. On Freefall the card header carries `read.costsTurn`.

### 3.18 Capture

The command panel becomes the Lantern (unfold, §5): `capture.heading`, wick grade (`capture.wick`), the odds as a big number (`capture.odds`, scale 2) and a bar 160×6 at 16,226; the `capture.stanceTag` badge when Stance is on; the **three-segment meter** 176×8 under the foe box at 8,56. One smooth sweep (48 f) fills the segments in order; success folds the foe into light (12 f) with the warm chord; failure gutters in two dither steps (8 f each) with a breath-out and `capture.nextOdds`. Freefall shows `capture.band.*` instead of numbers. No throw, no wobble, no click.

### 3.19 Shift Forecast (`scenes/forecast.js`)

Full screen on a deep-blue panel with a magenta edge.

| Region | Rect | Shows |
|---|---|---|
| Header | 8,8,464,44 | 32×32 portrait with the mark, nickname, `common.level`, `forecast.window`, dial name, `forecast.bond` pips; `forecast.litCoast` after the Relighting |
| Cards | 16,60,144,148 / 168,60,144,148 / 320,60,144,148 | `forecast.up` / `forecast.side` / `forecast.down`: odds as a scale-2 number + bar, then up to three pool forms (32×32) each with its in-card weight; `forecast.unseen` silhouettes on Freefall; `forecast.starTouched` ribbon |
| KEEPS | 8,214,464,14 | `forecast.keeps` + `forecast.keepsList` |
| Actions | 16,240,448,20 | `forecast.accept` / `forecast.reroll` with `forecast.cost` / `forecast.anchor` with `forecast.cost` (or `forecast.anchorFree`) |

States: Reroll locked (`forecast.rerollLocked`), no Starsalt (`forecast.noStarsalt`), no stones (`forecast.noStones`), Ride the Dice (`forecast.anchorOff`), deferred (`forecast.later` + `forecast.deferred`). The current form's row is absent; there is never a hidden fourth outcome. Input: 30 f lock on open (held buttons ignored); left/right between actions; `confirm`; `cancel` = Later when deferral is allowed, otherwise nothing. No timer, ever.

### 3.20 Payment Ceremony (cutscene `first-payment` and every payment)

The yard at dusk, full screen: abacus 120,36,240,40 (ten beads per wire); Ambrose on the sawhorse 40,120,48,48; the stick 140,150,200,14 with twenty notches; Wren's bust at 392,150; roof swatches 8 × 24×24 at 128,214 when a loan clears (`ceremony.pickRoof`, cursor on Slate Blue). Captions: `ceremony.beads`, `ceremony.holdSkip`, `ceremony.split`, `ceremony.buildTonight`. Sequence and frame counts in §5.

### 3.21 Dawn Build

40 f tie-off vignette at 05:40: a 160×90 inset at 160,60 framed in cream; the Thatch tie the last bundle (12 fps poses), the roof fills in the chosen colour in two dither steps, and the scaffold rises one of seven sections (8 px, ease-out 12 f). Caption `build.tieOff`, `build.scaffold`; after loan 7 `build.lampRoom`. Skippable with `confirm` after 20 f.

### 3.22 Day Page

A journal page 352×238 at 64,16 inks in over 60 f top to bottom: `day.heading`; sections `day.buttons`, `day.loan`, `day.catches`, `day.people`, `day.shifts` with `day.line.*`; then **`day.tomorrow`** as a bulleted list (`day.tomorrow.*`, at most six lines; the first is always the thread you chose to keep open). Bottom: the save check stamp 96×20 at 304,230: `day.saved` with a stamp, or the red **`day.notSaved`** banner (wax red, no stamp, stays until a save succeeds). Before Sleep, `rest.nightHolds` lists what tonight still holds. Input: `confirm` closes after the ink finishes (or completes it); `cancel` the same.

### 3.23 Letter reader / Journal

Letter: ledger paper 336×246 at 72,12, the seal 24×24 top-right (wax colour by channel), `letter.from`, `letter.dated`, body at 10 px lines scrolling with up/down, `▼` when more. Journal: tabs `journal.letters/stamps/seasonBook/seedCard/log` at 16,8. Letters list grouped by `journal.channel.*` in string-wall order; Stamps as a 6×4 grid of 64×48 stamps (`stamp.<id>.name`, `.text` on focus, `journal.stampCount`); the Season Book's last page is the Seed Card (§8); Log is the 100-line text log.

### 3.24 Pause (`scenes/menu.js`)

Non-opaque over the overworld (night-ink scrim 45%). Column 140 wide at 320,24: `menu.heading` + the clock; items 14 px: **Party, Satchel, Ledger, Map, Field Log, Journal, Settings, Save** (`menu.*`, Save always last; under No Rewind Save reads `menu.saveLocked`, greyed). In 6 f from the right, out 4 f. Opens on `start` (P / Start / ≡) and on `menu` when nothing is open; `cancel` closes.

### 3.25 Settings

List at 16,32,208,200 grouped by `settings.section.*`; values right-aligned at 232–456 with `◀ ▶`; the focused setting's note (`settings.*Note`) in a slip at 16,232,448,30. Changes apply live (volume previews a `blip`; text speed previews a line). Remap opens a list of `action.*` with each device's glyphs; `settings.remap.press` waits for a token; conflicts ask `settings.remap.conflict`. Full list in §6.

### 3.26 Relighting / Credits (`scenes/ending.js`, `scenes/credits.js`)

The Relighting is a script on the lighthouse map with the beam juice (§5). The Reading uses the battle layout with the 96×96 Vagary at 300,8 and `ending.phase`; on phase seven `ending.yourForecast` with `ending.anchorWay` / `ending.rerollWay` / `ending.acceptWay`. Credits: heading at y 96 (scale 2), lines small below, centred; backgrounds cycle every heading: the beam sweeping the harbor, your tally wall, Odile's canvases, the lit porches, and finally the Seed Card held for 300 f. Each heading holds 150 f + 24 f per line; scroll 20 px/s; reduced motion uses 12 f dither fades between headings. `confirm` doubles speed; nothing skips the first viewing except a confirm on the Seed Card page.

### 3.27 Name entry (shared by the lease card and creature naming)

A 10×4 grid of 24×18 keys at 120,120 (A–Z, a–z by `entry.caps`, digits, `'` `-` `.`), plus `entry.space`, `entry.delete`, `entry.done`; the name in a 160×16 field at 160,96 with a blinking caret; `entry.suggest` offers the form's suggestion (PUDDLE for a Sloshkin). Physical keyboards type directly. Empty → `entry.empty`; max 10 letters (`entry.tooLong`).

---

## 4. Controls

### 4.1 Default bindings (as shipped in `js/core/input.js` `DEFAULT_BINDINGS`)

| Verb (action) | Keyboard | Gamepad (standard mapping) | Touch (automatic on a coarse pointer) |
|---|---|---|---|
| Move (`up/down/left/right`) | arrows / WASD | d-pad / left stick | fixed 8-way d-pad, bottom-left |
| Run (`run`) | hold Shift | hold RT (b7) | — (not shipped; see §4.2) |
| Confirm / context verb (`confirm`) | Z, Enter, Numpad Enter, Space | A (b0) | A, bottom-right |
| Back (`cancel`, never drops an item) | X, Esc, Backspace | B (b1) | B, bottom-right |
| Menu (`menu`) | Enter, Esc | Start (b9) | MENU pill, top-right |
| Pause (`start`) | P | Start (b9) | MENU pill (via `menu`) |
| Tool ring / quick swap (`tool`) | hold C / tap C | hold X (b2) / tap X | — (not shipped; see §4.2) |
| Map & Tide Table (`map`) | M | Y (b3) | — (not shipped; Pause → Map) |
| Journal (`log`) | Tab | LT (b6) | — (Pause → Journal tab) |
| Select (`select`) | ` (backquote) | Back (b8) | — |
| Previous / next tab, Peek (`l` / `r`) | [ / ] | LB (b4) / RB (b5) | — (not shipped; see §4.2) |

**Scene rules.** Overworld: `menu` or `start` opens Pause; `confirm` performs the context verb; `cancel` does nothing (never drops). Menus: `l`/`r` switch tabs or pages. Battle: `l` cycles battle speed 1× → 2× → 4×. Forecast: everything ignored for 30 f. Every menu is fully usable with a d-pad and two buttons; there is no hover; input flushes on every scene change.

### 4.2 Deltas from GDD-00 §13 (requests to the CORE/INPUT owner, §13)

| GDD-00 verb | GDD-00 binding | Shipped | Request |
|---|---|---|---|
| Read / Path view | V / Y / lens | no action | add action `read`: `KeyV`, `gp:b3`, `touch:lens`; move `map` gamepad to Back (b8) |
| Map | M / **Select** | M / Y | as above (Select = b8) |
| Pause | P (Esc when nothing to back out of) | P via `start`; Esc via `menu` | matches once scenes route `menu` to Pause only when nothing is open (rule above) |
| Peek | Q / E / right stick | `[` `]` via `l`/`r` | add `KeyQ`/`KeyE` to `l`/`r`; add right-stick axes 2–3 as a `peek` vector |
| Battle speed | 1 / 2 / 3, LB | none | add action `speed` (`Digit1`–`Digit3` set directly; LB cycles in battle via `l`) |
| Mute | 0 | none | add action `mute`: `Digit0` |
| Tool ring (gamepad) | X | X (b2) | matches |
| Touch move | floating d-pad (left half) | fixed 8-way d-pad, bottom-left | make the d-pad float to the first touch on the left half |
| Touch run | double-tap and hold | none | add run on double-tap-and-hold of the d-pad |
| Touch confirm | big A; tap the context chip | A | let a tap on the HUD context chip emit `confirm` |
| Touch pause | ≡ button | MENU pill | relabel the pill ≡ (needs a ≡ glyph in the 5×7 face) or keep MENU and change GDD-00 |
| Touch tool ring | ring button above B | none | add `touch:tool` above B |
| Touch map | swipe down from the Skyband | none | add a swipe gesture emitting `map` |
| Touch Read | lens button | none | add `touch:lens` with the `read` action |
| Touch Peek | drag empty screen | none | add a drag gesture as the `peek` vector |
| Touch battle speed | speed chip | none | battle scene owns a tappable speed chip |

---

## 5. Juice list (frame counts at 60 fps)

| Moment | Sequence | Sound |
|---|---|---|
| **THWAP** (every payment that cuts a notch) | Wren flicks one bead per 1,000◉ (8 f per bead for ten beads, then 4 f, then 2 f; hold `confirm` to skip to the strike); Ambrose: lift 4 f, **gnaw 6 f** with 2 px chips, **strike 5 f**, **2 f shake** (2 px), dust puff 12 f; the notch carves in 6 f | `blip` per bead (combo pitch), rising `crack` notch tick, **`thwap` at 1.0 volume, the loudest sound in the game** |
| Loan cleared | the stick splits 12 f, your half swings to the tally wall 30 f, roof swatches slide in 6 f | `achievement`, then `bell` when the build is queued |
| **Shift flip** | input lock 30 f; cards face down **12 f**, slide past each other **60 f**, the chosen card turns **18 f**; the scramble **90 f**: 4×4 blocks swap in six steps resolving in four rings outward from the mark; Heartmark glint 30 f | `shiftFlip` on the window; `shift_reveal` sting phases 300 / 600 / 700 ms (charge, scramble, chord); Anchor plays `shift_reveal_anchor` (chord only) |
| **Lantern unfold** | **lift 6 f** (glow steps amber → white in 3 dither steps), a folded square of light drops and opens **square → strip → outline over 12 f**, colour fills in two rings from the mark (8 f) | `lantern` hum rising with the meter; `capture` warm chord; `captureFail` breath-out |
| Capture meter | one smooth sweep 48 f across three segments; success fold 12 f; failure gutter 2 × 8 f | `capture-shake` ticks rise 2 semitones per segment |
| **Payment ceremony** | yard fade 24 f; beads and THWAP above; roof pick; `ceremony.buildTonight`; fade 24 f | world music ducks 50% |
| **Dawn build** | 40 f vignette: tie-off 3 poses × 8 f, roof fills in 2 dither steps × 4 f, scaffold section rises 12 f, the Thatch fly off 8 f | `dawn` ambient, a soft `bell` on the last knot |
| **Porchlight on** | a 3-step dither pool of amber grows 4 f per step (12 f), then holds; moths start orbiting after 60 f; for yours, Dimity lands in it 18 f | the first note of Your Signal (`signalSting`, note 1) |
| **The Relighting beam** | Juniper's lantern lit from your porch lamp (12 f flare); the lens catches in **three dither steps × 10 f**; the **first sweep takes 16 s**, then every 8 s; every lit porch pulses once (one 3-step dither in, 3 out, staggered 2 f by distance); the horn answers with Your Signal; the Skyband fills over 240 f | `relighting` cue (then `h_night`); `signalSting` on the horn |
| **Hit-stop by effectiveness** | Blocked ×0: **0 f** (tink, no nudge); Weak ×0.25: **2 f**; Weak ×0.5 or Neutral ×1: **4 f**; Strong ×2: **6 f**; Strong ×4 or a crit: **8 f** + 2 f outline flash + 2 f shake; the effectiveness word shakes 2 px on Strong and sinks 2 px on Weak | `hitWeak` / `hit` / `hitStrong` / `blocked` (§10.3) |
| Ward | shimmer 48 f every 240 f; on a blocked hit the lattice flares 6 f and the readout slip tears in 5 f | `bell` (Ward ping) + `blocked` |
| Heartmark glint | 30 f: the mark's centre pixel to white-ish `w`, corner glints at ×2 for 12 f | — |
| Level up | number tumble, the box flashes cream 4 f, `toast.levelUp` | `levelUp` |
| Wallet | slide in 6 f, digits tumble 2 f each, out 4 f after 120 f | `coin` combo (+1 semitone per pickup, up to 7) |
| Blackout | 40 f fade to porchlight amber, Dimity's line, wake 24 f | `captureFail` low, then the porch |
| Bee hum | the nest shakes 2 px for 60 f (1 s) before it drops | bee hum (request) + `caption.beeHum` |
| Bite | the float dips 4 px in 2 f; bite window 7–31 f by species (Gentle 36–54 f; Patient none) | `bite` plip + `caption.bite` |
| Text | types at the speed setting with the speaker's trade tick | §10.5 |
| Torn slips | 5 f tear from the right | `toast` |
| Glowing mud | cyan cycle 4 frames × 8 f, bypasses the LUT | — |

---

## 6. Accessibility and settings

Every toggle below lives in `world.settings` (`js/state/schema.js`); "exists" means the schema already has the field, "request" means the STATE owner adds it with the default shown (§13). Labels are `settings.*` keys.

| Setting | Values (default **bold**) | Effect | Field |
|---|---|---|---|
| Day length | 12 / **24** / 48 minutes / Real Clock | real minutes per game day; Real Clock uses device time, Rest saves but never skips, builds take a real night (`settings.realClockNote`) | `minutesPerDay`, `realClock` (exist) |
| Text speed | Slow 22 cps / **Normal 45** / Fast 90 / Instant | typewriter rate (`ui/theme.TEXT_SPEEDS`) | `textSpeed` (exists) |
| Auto-advance text | **Off** / On | On: a finished line advances after 90 f + 2 f per character | `autoAdvance` (request) |
| Battle speed | 1× / **2×** / 4× | animation and sfx durations scale; music tempo never changes | `battleSpeed` (request) |
| Fishing | **Standard** / Gentle / Patient | Gentle widens every bite window to 36–54 f; Patient: hold to reel, no window, own record board | `fishingMode` (request) |
| Reduced motion | **Off** / On | §2 substitutions; no shimmer, shake or particles; flashes stay ≤ 3 per second regardless | `reducedMotion` (exists) |
| Large text | **Off** / On | the overlay draws text at 1.5× with wider boxes; dialogue drops to three lines | `largeText` (request) |
| High contrast panels | **Off** / On | panels become cream on night ink with 2 px edges; HP bars gain notches every 25% | `highContrast` (request) |
| Clear Visuals | **Off** / On | rain, fog and snow overlays off (they cap at 35% anyway) | `clearVisuals` (request) |
| Dyslexia-friendly letters | **Off** / On | an alternate 5×7 face with weighted bottoms and open counters | `dyslexiaFont` (request; needs a third `core/font` face) |
| Captions | Off / **On** | `caption.*` chips for the bite, the bee hum, mail, the hour, the Ward ping, Your Signal, the horn, THWAP, cries, thunder, Errants | `captions` (request) |
| Path view | **Hold** / Toggle | how the Read / Path view button behaves | `pathView` (request) |
| Remap controls | per action, per device | `input.saveBindings()` JSON | `bindings` (exists) |
| Music / Sound effects / Ambience | 0–100% (**80 / 100 / 70**) | mixer buses | `volumes.music`, `volumes.sfx` (exist); `volumes.ambience` (request) |
| Mute | **Off** / On | mutes the master bus; the mute key toggles it | `muted` (exists) |
| Touch layout | **Two-handed** / One-handed | one-handed stacks A, B, ring and ≡ in a thumb arc on the right and moves the d-pad to a swipe area | `touchLayout` (request) |
| Wake after a blackout at | **Your porch** / Last Waystone | also on the lease card back | `wakePoint` (request) |
| Screen scale | **Pixel-perfect** / Fill the window | integer vs fit | `scale` (exists) |
| Battery saver | **Off** / On | 30 fps world, characters unchanged | `fps30` (exists) |
| Skip long animations | **Off** / On | THWAP beads jump to the strike, credits at 2× | `skipAnims` (exists) |

**Fixed guarantees (not toggles):** no timed input on any Shift or capture; every tell is shape, word or icon; flashes ≤ 3 per second; no full-screen white; the beam sweeps and never flashes; four text speeds and a 100-line log (`journal.log`); auto-advance off by default; one-of-a-kind items always ask with the safe option first (§11.4).

---

## 7. The Chaos dial UI

Shown on the Seed Card (§3.2) and, after the run starts, only on the Ledger's last page at home (`dial.page.homeOnly`).

```
 How do you like your odds?
 ┌──────────┐ ┌──────────┐ ┌──────────┐
 │ ○ Drift  │ │ ● Flux   │ │ ○ Freefall│      pips 96×24, ● chosen
 │  gentler │ │ the default│ │   wild   │
 └──────────┘ └──────────┘ └──────────┘
 Up 40 / Side 35 / Down 25      Read: free        Capture: exact %
 Anchor stones: 500◉ each       Stat floor: 20%   Unseen forms: shown
```

- The strip shows the focused dial's GDD-00 §8 numbers (`dial.odds`, `dial.rule.*`); after `lit.steadied` the odds show the steadied values and the header reads `forecast.litCoast`.
- Turning the dial mid-run asks `CONFIRMS.dial` (No first), plays the `shiftFlip` tick, toasts `dial.changed`, and stamps the Seed Card `seedCard.notRaceEligible`.
- Freefall's pip carries a small `★`; Drift a `○` halo; no colour-only signal.

---

## 8. Seeds and the Seed Card

**Seed code.** The shipped `core/rng.encodeSeedCode` writes `DIAL-XXXX-XXXX` (dial word + eight Crockford base-32 characters with a checksum, look-alikes I/L → 1 and O → 0 accepted). GDD-00 §15 describes "a 10-character code"; the dial word plus eight characters satisfies its purpose (dial + toggles + 32-bit seed, typed by hand) and is what the title, Seed Card and text export show.

**On-screen Seed Card** (Season Book last page and the end of the credits), 336×208 card:

| Region | Rect (card-relative) | Shows |
|---|---|---|
| Header | 12,8,312,16 | `seedCard.heading`, the code right-aligned |
| Dial | 12,28,150,16 | pips + dial name; `seedCard.raceEligible` or `seedCard.notRaceEligible` |
| Seals | 170,26,154,36 | four challenge seals (pressed / open) + the Summit seal slot (`seedCard.summitSeal`) |
| Tallies | 12,48,150,48 | `seedCard.days`, `.catches`, `.forecasts`, `.rerolls`, `.anchors`, `.badges` |
| Shiftlogs | 12,104,312,96 | one row per party member: `seedCard.shiftlog` then each form's 16×16 icon with the mark in the same spot |

**Text export** (`seedCard.export`, copied to the clipboard; `seedCard.copied` / `seedCard.copyFailed`):

```
LAMPFALL SEED CARD
Seed: FLUX-K7Q2-MD7F
Dial: Flux (race-eligible)
Seals: No Rewind, One Heart
Days: 14   Catches: 31   Forecasts: 18   Rerolls: 9   Anchors: 4   Seals: 6 of 6
PUDDLE: Sloshkin > Siltback > Skeinwing
Peg: Scrapling > Knuckleback
Summit seal: stamped
```

The card re-stamps with the Summit seal after Idris (`seedCard.summitStamped`).

---

## 9. Challenge seals and the credits roll

### 9.1 Seals

Four wax seals 32×32 on the Seed Card, each a distinct emboss so they never read by colour: **No Rewind** (a stopped hourglass), **One Heart** (a single four-point mark), **Ride the Dice** (two dice), **Blind Read** (a lens with a bar). Names and rules: `challenge.<id>.name` / `.text`. Pressed seals are wax red with a raised emboss; open seals are an empty dotted ring with `challenge.sealOff`. Ride the Dice and Blind Read ship only if the cut line allows (manifest `optional`); when cut, their seals do not render and the row centres the remaining two.

| Seal | In play |
|---|---|
| No Rewind | one autosave slot; Save in the pause menu reads `menu.saveLocked`; the Day Page still shows `day.saved` |
| One Heart | Party shows `party.oneHeart`; catches go to the Log and crate (`capture.fieldLogOnly`) |
| Ride the Dice | the Anchor seal on the Forecast reads `forecast.anchorOff` |
| Blind Read | the Read card shows types only |

### 9.2 Credits roll

`js/data/credits.js` rows in order: title, studio (**Token Maxxer's Anonymous Game Studio**), direction (**timothy8901**), the two source pitches (**WILDSHIFT**, **PORCHLIGHT**), design, built with (**Made with Claude Code**), pixel art, music and sound, the people of Pellwick, the isles, the last keeper, the creatures, thanks, the Seed Card pointer, and the closing tagline. Only fictional names appear besides the repo owner's handle.

---

## 10. Audio cue sheet

### 10.1 Scene ↔ track ↔ stems (`js/audio/director.js` SCENE_MUSIC, `js/audio/tracks` CUES)

| Scene / moment | Track id (title) | Stems on | Rule |
|---|---|---|---|
| boot | — | — | silence |
| title, leaseCard, seedCard | `title` (Lighthouse, 72 bpm, D major) | core, melody, bass, **night**, **tide**; perc off | fade 1,500 ms |
| overworld, fishing | day-part theme for the hour (§10.2), `lantern_market` on Saturdays 18:00–24:00 in the market | core, melody, bass; perc except 01:00–05:00; night 20:00–05:00; tide when tide > 0.7; rain in rain or storm | hour change crossfades over two bars of the incoming theme |
| battle (wild / trainer / Spire / Summit and the Reading) | `battle_wild` (Tall Grass) / `battle_trainer` (Across the Field) / `battle_spire` (The Spire) / `summit` (Summit) | all default; **tense** at HP ≤ 25% | fade 400 ms; tempo fixed at 2×/4× |
| victory | `victory` (Caught the Light) | one-shot | then resumes world |
| forecast | `forecast` (Shift Forecast, E dorian) | core, pad, perc, melody, bass | fade 600 ms |
| Shift resolved | `shift_reveal` (Shift) / `shift_reveal_anchor` on Anchor | one-shot, ducks music to 30% | phases 300 / 600 / 700 ms |
| letter delivered / read | `letter` (A Letter: Your Signal) | one-shot, ducks music to 50% | — |
| ending (the Relighting) | `relighting` (The Relighting) | one-shot, fade 2,000 ms | then `h_night` |
| credits | `credits` (Harbor Lights) | core, melody, bass, perc, night, tide | fade 2,500 ms |
| dialogue, menus, Day Page, ceremony | transparent (world continues, clock paused) | — | ceremony ducks world 50% during the THWAP |

### 10.2 Day-parts (GDD-00 §5)

| Hours | Track | Title | Key / bpm | Motif |
|---|---|---|---|---|
| 00–03 | `h_night_deep` | Harbor Asleep | B minor / 84 | a sigh |
| 03–06 | `h_predawn` | Before the Gulls | E dorian / 88 | rising, answered |
| 06–09 | `h_morning` | Porchlight Morning | D major / 100 | **Heartmark** (home theme) |
| 09–12 | `h_late_morning` | Gull Market | G lydian / 104 | lydian bounce |
| 12–15 | `h_midday` | High Sun on the Water | D major / 108 | a skipping stone |
| 15–18 | `h_afternoon` | Long Shadows on the Pier | A mixolydian / 96 | lazy fall |
| 18–21 | `h_dusk` | Lamps Along the Quay | D major / 92 | **Heartmark** from G |
| 21–24 | `h_night` | Porchlight | B minor / 88 | music box |

### 10.3 SFX events ↔ engine sound names (`js/audio/sfxMap.js` → `core/audio.SFX_NAMES`)

**Bus events.** `player:step` → `step` / `stepWater` (jitter ±6%, 110 ms) · `player:bump` → `blocked` · `wallet:changed` → `coin` (combo +1 semitone, 7 max) / `purse` · `loan:paid` → `stamp` · `loan:tier` → `achievement` · `loan:built` → `bell` · `letter:read` → `blip` · `thread:beat` → `bell` · `npc:talked` → `blip` · `fieldLog:held` → `stamp` · `fieldLog:read` → `blip` · `collection:added` → `catchFish` / `achievement` · `creature:levelUp` → `levelUp` · `creature:learned` → `confirm` · `capture:ok` → `capture` · `capture:fail` → `captureFail` · `shift:window` → `shiftFlip` · `badge:won` / `summit:cleared` → `achievement` · `save:ok` → `stamp` (save chime) · `save:fail` → `error` (save-failed buzz, after the retry) · `toast` → `toast` · `tide:change` high → `wave` · `weather:change` storm → `thunder` · `clock:phase` dawn / night → `dawn` / `night` · `warp` → `doorOpen` or the warp's own sfx · `ui:cursor` → `blip` · `ui:confirm` → `confirm` · `ui:cancel` → `cancel` · `ui:blocked` → `blocked` · `ui:error` → `error` · `ui:textTick` → `textTick`.

**Verbs.** talk / read / look / inspect / sit → `blip` · pickUp → `fruitDrop` · shake → `shake` · fish / board → `splash` · dig → `dig` · catch → `thwap` · enter → `doorOpen` · mailbox → `letter` · use → `confirm` · light → `lantern` · crack → `crack`.

**Battle events.** damage → `hit` (`hitWeak` for status chip) · effectiveness ×0 → `blocked`, ≥ ×2 → `hitStrong`, ≤ ×0.5 → `hitWeak` · crit → `hitStrong` · miss → `cancel` · blocked / guard → `blocked` · faint → `thwap` · heal / mend-spent → `heal` · status inflict/tick → `hitWeak`, cure → `heal` · stat raised/lowered → `blip` (±2 semitones per stage), capped/blocked → `blocked` · switch / learn / item → `confirm` · lantern → `lantern` · capture-shake → `shake` (rising) · capture → `capture` · capture-fail → `captureFail` · read / ward-readout → `bell` · reveal → `shiftFlip` · levelup → `levelUp` · scrap → `thwap` · glint / payout → `coin` · run → `step` · blackout → `captureFail`.

**GDD-00 tells ↔ sounds.**

| Tell | Shipped sound | Note |
|---|---|---|
| Ward ping | `bell` | request a glassy two-tone `wardPing` |
| blocked tink | `blocked` | — |
| EMPTY thud | `blocked` at −5 semitones | request `emptyThud` |
| save chime | `stamp` | two rising notes requested as `saveChime` |
| save-failed buzz | `error` | — |
| Lantern hum / warm chord | `lantern` / `capture` | never a click |
| bee hum | — | request `beeHum` (1 s) |
| bite plip | `bite` | — |
| rising notch tick | `crack` with combo pitch | request `notch` |
| THWAP | `thwap` at 1.0 | every other sound ≤ 0.9 |
| door chime / letter sting / ferry horn | `doorOpen` + `signalSting` / `letter` track / `signalSting` | Your Signal |

### 10.4 Motifs

- **Heartmark** D F# A B (+4 +3 +2, never changes): `title`, `h_morning`, `h_dusk` (from G), `battle_trainer` (rhythm), `summit`, `victory`, `shift_reveal` (resolve chord), `shift_reveal_anchor` (chord only), `relighting` (sung long), `lantern_market` (bar 9, from G), `credits`; and the starter naming beat (the first magenta pixel) cues `shift_reveal_anchor` until a dedicated four-note `heartmark` sting exists (request).
- **Vagary** A G F# D falling: `battle_spire`, `summit` (B-minor half); scripts cue it at skyglass nodes, Errant entries, faction scenes and Spire doors.
- **Your Signal** (the player's six notes, default D5 F#5 A5 B5 A5 D6): the cottage door chime, Dimity's hum, Wick's whistle, the `letter` sting, the ferry horn, the Relighting horn (`signalSting`).

### 10.5 Cries and speaker ticks

**Cries from three parameters** (requested synth `audio.cry({base, slide, wave, tail})`, ≈ 21 f long):

| Parameter | Derivation |
|---|---|
| `base` (MIDI) | by stage: 0 → 76, 1 → 69, 2 → 62, 3 → 55, 4 → 50; plus `hash(speciesId) % 5 − 2` |
| `slide` (semitones over the cry) | by primary type: Plain 0, Grit −2, Brine −3, Kiln +4, Moss +2, Bolt +12 then snap back, Rime +5, Gust +7, Stone −5, Rust −7, Glass +9, Hollow −12, Star +12 |
| `wave` | by primary type: sine (Brine, Rime, Glass, Star), triangle (Plain, Moss, Gust, Hollow), square (Grit, Bolt), saw (Kiln, Stone), saw + noise (Rust) |

Bonded creatures' cries end on a **shared two-note tail**: A5 then D6, 4 f each, sine, 50% gain, so a creature still sounds like itself after a Shift. Star-touched forms add a 12 f octave shimmer. The Vagary's cry is the falling Vagary motif on glass.

**Speaker ticks** (text typewriter, one tick per two characters, `textTick` with a voice): Wren woodblock (−3 st, short), Ambrose bowed string (−10 st, long), Juniper glass bead (+7 st), Hesper paper (noise, filtered), Barnaby brass (+0 st, bright), Corin a soft hoot (−5 st, sine). Everyone else: `textTick` pitched by `hash(npcId) % 7 − 3`. Until voices exist, the pitch offsets alone are used.

### 10.6 Mix

Buses: master, music (80%), sfx (100%), ambience (70%; request). THWAP is the loudest single sound. Music never changes tempo with battle speed; only sfx shorten. Captions accompany the bite, the hum, mail, the hour, the Ward ping, Your Signal, the horn, THWAP, cries, thunder and Errants when Captions is on.

---

## 11. String glossary (`js/data/strings.js`)

### 11.1 API (unchanged and extended)

`t(key, vars)` fills a template (a missing key renders `[key]`), `has(key)`, `fill(tpl, vars)`, `plural(n, one, many)`; added: `varsOf(tpl)` lists a template's placeholders, `VARS` documents every placeholder, `CONFIRMS` + `confirmSpec(id, vars)` build safe-first confirms for `ui/confirm.openConfirm`. Templates use `{name}` and `{n|one|many}`.

### 11.2 Namespaces

| Prefix | What |
|---|---|
| `game.` `currency.` `wallet.` `common.` | title and tagline; buttons ◉, Starsalt, anchor stones, the Keeper's Purse; shared words |
| `title.` `seedCard.` `dial.` `challenge.<id>.` | title screen, Seed Card and its text export, the Chaos dial, challenge seals |
| `lease.` `entry.` | lease card fields and values; name entry |
| `hud.` `daypart.` `weekday.` `tide.` `weather.<id>` | HUD, day-parts, weekdays, tide words and windows, weather |
| `verb.` `warp.<reason>` `tool.` `toolRing.` | context verbs (`world/interact.VERB_LABELS`), warp refusals (`world/warps.WARP_REASONS`), tools |
| `menu.` `pocket.<id>` `bag.` `party.` `summary.` | pause menu, Satchel pockets (`schema.POCKET_IDS`), party, summary |
| `fieldLog.` `archive.` `shop.` | Field Log, Archive, shops and the Crate |
| `ledger.` `loan.` `loan.pace.<key>` `ceremony.` `roof.<id>` `commission.<id>` `build.` | Hearth Ledger, loans (`systems/loans.paceEstimate` keys), the ceremony, roofs, rooms, dawn builds |
| `board.` `map.` `badge.<spire>` `waystone.<id>` `ferry.` | Tide Table, Commons board, map, seals, Waystones, the ferry |
| `battle.` (`cmd`, `eff`, `tag`, `msg`, `blocked.<reason>`, `status.<kind>`, `end.<outcome>`, `ward`, `stance`) | battle panel, effectiveness words (= `battle/effects.WORDS`), foe tags, every engine message as a template, the Ward readout |
| `read.` `capture.` `forecast.` `shift.` | Read card, capture (incl. Freefall bands), the Forecast, Shift results |
| `day.` `rest.` `letter.` `journal.` `stamp.<id>.name/.text` | Day Page and *Tomorrow:*, the bed and bench, letters, Journal, the 24 stamps |
| `fishing.` `settings.` `save.` `confirm.` `toast.` `banner.` `error.` | fishing, settings labels, saves and banners (`Not saved`), confirms, toasts, errors |
| `ending.` `caption.` `hint.` `device.` `action.<action>` `ui.` `npc.default` | the Reading, captions, input hints, devices, remap labels (`input.ACTIONS`), ui-kit defaults (= `ui/theme.STRINGS`), the NPC fallback |

### 11.3 Terminology rules

- **Buttons (◉)** are money, never coins; Starsalt is always capitalised and uncounted (`3 Starsalt`); **anchor stones** in prose, **Anchor** as the verb.
- **The Glint** is the one buried purse a day; low-tide finds are **sparkles**.
- Capitalised game verbs: **Shift, Forecast, Accept, Reroll, Anchor, Read, Ward, Mends, Stance, Recall**. Directions **Up / Side / Down**.
- Effectiveness words are exactly **Strong / Neutral / Weak / Blocked** (+ `Blocked by Ward` on the move grid).
- Badges are **seals** in the UI (`badge.<spire>`: "Turn seal").
- Nobody scolds: failure lines say what happened and what is next (`capture.noWicks`, `shop.cantAfford`, `battle.blackout`).
- "Warden" means Augusta only.

### 11.4 Confirms (safe option first, focused)

| Id | Body | Options (safe first) |
|---|---|---|
| oneOfAKind | `confirm.oneOfAKind` | Keep it / Use it |
| overwrite, delete | `confirm.overwrite`, `confirm.delete` (danger) | No / Save over it, No / Delete |
| newGame, quit | `confirm.newGame`, `confirm.quit` | No / Start, Stay / Go to title |
| ferry, ferryFree | `confirm.ferry*` | Stay / Ride |
| sleep, nap | `confirm.sleep`, `confirm.nap` | No / Sleep, No / Nap |
| dial | `confirm.dial` | No / Turn it |
| sell, sellKeepsake, buy, buyDear | `confirm.sell*`, `confirm.buy*` | No (or Keep it) / Sell or Buy |
| release, forget | `confirm.release` (danger), `confirm.forget` | Keep it / Let it go, No / Forget |
| reroll, anchor, payAll, skipThread | as named | No / Reroll, No / Anchor, Later / Pay, Stay / Leave it |

### 11.5 Placeholder dictionary

`VARS` in `strings.js` documents all placeholders (`amount`, `cost`, `held`, `n`, `nick`, `name`, `move`, `moves`, `target`, `user`, `ward`, `types`, `kinds`, `place`, `time`, `a`/`b` for low pairs, …). The test fails on an undocumented or unused placeholder, on a malformed plural, on a character the 5×7 face cannot draw, and on any duplicate key.

---

## 12. Self-validation

`test/data.presentation.test.mjs` asserts: no duplicate keys in the source literal; hierarchical keys and non-empty values; every `{var}` documented and every `VARS` entry used; well-formed placeholders; no placeholder text, TODOs or borrowed IP; every character drawable by the `main` face; GDD-00 terms (title, buttons, Starsalt, anchor stones, the tide, *Tomorrow:*, Saved/Not saved, the Errant prompt, the Freefall bands, effectiveness words equal to `battle/effects.WORDS`); the Ward readout templates; the day-1 API and keys; every literal `t()` / `has()` key in `js/` exists; every dynamic family (warp reasons, verbs, pace keys, currencies, menu items, theme strings, block reasons, outcomes, status kinds, text speeds, scale modes, pockets, input actions, devices, stats, day-parts, Forecast directions, battle commands, ledger houses) exists; families keyed by other tables' ids (weather, roofs, seals, Waystones, commissions, stamps, challenges, dials) match `ids.manifest.js` exactly; every confirm puts the safe option first; and the credits roll content, ids and glyphs, `validateData` with zero `credits` errors, and a quiet `checkManifest`.

---

## 13. Requests and known discrepancies

**Manifest requests:** none. Every id this chapter references (weather, roof colours, Spires/seals, Waystones, commissions, stamps, challenges, dials, pockets) already exists; strings are not a manifest table.

**Requests to other owners (engine, not content):**

1. **Existing test `test/data.tables.test.mjs` lines 98, 99 and 103** assert the day-1 placeholders (`'1 coin'`, `'3 coins'`, `'GAME'`). GDD-00 makes them `'1 button'`, `'3 buttons'`, `'Lampfall'`; the orchestrator should update those three assertions (this chapter may not edit that file).
2. **Input** (§4.2): add `read`, `speed`, `mute` actions and the Q/E and right-stick Peek; move gamepad `map` to Back (b8).
3. **Settings schema** (§6): add `autoAdvance`, `battleSpeed`, `fishingMode`, `largeText`, `highContrast`, `clearVisuals`, `dyslexiaFont`, `captions`, `pathView`, `volumes.ambience`, `touchLayout`, `wakePoint`.
4. **Audio** (§10): add sounds `wardPing`, `emptyThud`, `saveChime`, `beeHum`, `notch`, a `heartmark` four-note sting, the `audio.cry({base, slide, wave, tail})` voice, and speaker-tick voices; add `seedCard` to `SCENE_MUSIC` as `{cue: 'title'}`.
5. **Battle engine texts** still carry prototype words the UI glossary replaces: payout says "glint" (→ `battle.msg.payout`, buttons), capture bands are Low/Fair/Good (GDD-00: Slim/Fair/Good/Sure, `capture.band.*`), Lantern grade names (Lantern / Bright Lantern / Beacon Lantern) predate the wick model (Tallow / Brass / Skyglass Wick). The battle scene should render events through the `battle.msg.*` / `battle.ward.*` templates using the event fields.
6. **Config**: `config.TITLE = 'GAME'` and `SAVE_PREFIX = 'game.'` → `'Lampfall'` / `'lampfall.'` (GDD-00 §0); `core/scene.DEFAULT_TRANSITION_COLOR '#000000'` → night ink `#141B33` (no pure black).
7. **Schema `DEFAULT_DIAL = 'drift'`**: GDD-00 makes **Flux** the default dial.
8. **Title scene**: GDD-00 moves the dial to the Seed Card; the day-1 title's Seed/Dial rows become the seed code line and a New Game → Seed Card route.
