# WILDSHIFT — Gameplay Rules Spec

Reference extraction of the Gameplay section of the WILDSHIFT pitch (source lines 1–740). Engineers and designers build from this document without the original. Names, numbers and rules are kept exact. Where the pitch gives only an estimate or leaves a number unmeasured, that is stated.

---

## 0. How to read this document

### 0.1 Rule status markers (carried over from the pitch)

| Marker | Meaning |
| --- | --- |
| **(lead decision)** | Settled. Implement as written. Playtests may still tune the numeric values where the pitch says so (Drift/Flux odds). |
| **(Proposed)** | Open for playtest. Implement as written for the vertical slice; expect change. |
| **(estimate)** | Starting tuning value. Expose as a data-driven constant. |
| **[NEED SOURCE]** | Nobody has measured this number yet. A placeholder value must be chosen and flagged. |

### 0.2 Glossary of WILDSHIFT terms

| Term | Meaning |
| --- | --- |
| **Shift** | Permanent form change, replaces fixed evolution. Up / Side / Down. Growth-driven, forecast before it lands. |
| **Shift Forecast** | The three-card screen (Up / Side / Down) shown before a Shift resolves. |
| **Shift window** | A level threshold at which a creature becomes eligible to Shift. About 3 per creature per run. |
| **Heartmark** | Mark on every creature born since the Starfall; lights in comet magenta when bonded. Carries identity across forms. |
| **Heartmark technique** | One move pinned by the player at the first Shift; usable in every form forever. |
| **Shiftlog** | Strip of every form a creature has held, in order. |
| **Memory** | Holding area for moves a new form cannot learn; relearnable free at any Shelter once a later form can use them. |
| **Bond** | Per-creature pip meter (max 5) that shifts Forecast odds from Down toward Up. |
| **Starsalt** | Steering currency, spent on Reroll and Recall. Refined from skyglass dust by the Scatter. |
| **Anchor stone** | Consumable; cancels one Shift window. |
| **Still Knot** | Held item; blocks every Shift for its holder while held. |
| **Skyglass / skyglass tilt** | Held skyglass biases which types appear on Forecast cards (badge 5). |
| **Star-touched form** | Rare form in every family pool at a fixed ~2% weight. |
| **Recall** | Shelter service: return a creature to any form in its Shiftlog for Starsalt. |
| **Read** | Scouting action: reveals a foe's types and ability. |
| **Field Log** | Bestiary with three states per form: Seen / Read / Held. |
| **Dossier** | Posted roster at each Spire door and the Summit gate. |
| **Coverage view** | Party-screen view of which types the party's current moves hit hard; flags immunity gaps. |
| **Scouting Prism** | Upgrade that adds moves, held items and heal pips to Read cards on every dial. |
| **Ward** | Family of defensive abilities that block whole categories of moves (Glasshide, Mirrorveil, Stillcoat; Prismoth's Prism Ward). |
| **Crackdust** | Single-use item that suppresses a Ward for 3 turns (estimate). |
| **Strong / Neutral / Weak / Blocked** | The game's effectiveness words. Strong = super-effective. Blocked = Ward or immunity. |
| **Scrap** | Fallback attack used automatically when every move is at 0 PP. |
| **Mends** | Per-creature, per-battle budget of 3 recovery-move uses. |
| **Plumbline** | Guaranteed disc from the 7th Spire: always hits, clears target stat stages, blocks re-boosting 2 turns. |
| **Spire** | Badge location (8 in total). Spire leader awards a badge. |
| **Shelter** | Heal/shop/service building. Sells Starsalt, anchor stones, Ethers, etc.; hosts the Rematch board and Training Yard pickup. |
| **Waystone** | Route checkpoint. Autosave point and the place where deferred Shifts resolve. Fast-travel nodes from badge 2. |
| **Curve level** | Per-island posted target level = next Spire leader's ace − 3 (estimate). |
| **Training Yard** | Badge-6 facility: up to 3 stored creatures earn 25% of party EXP. |
| **Rematch board** | Shelter board of 6 rematchable trainers scaled to the curve. |
| **glint** | Money. |
| **Summit Purse** | Forced savings: 1,500 glint deposited at each badge from badge 5; opens only at the Summit gate. |
| **Lantern** | Capture device. Grades priced 250 / 700 / 1,400. The one sure-catch Lantern lives in the Keepsakes pocket. |
| **Capture Stance** | Toggle in wild battles: party damage cannot drop the wild creature below 1 HP. |
| **Errant** | Roaming legendary on ordinary routes (~1 in 300 encounters) plus fixed story sightings. |
| **Keepsakes** | Bag pocket for one-of-a-kind items. Bag cursor never starts there. |
| **Summit** | Final gauntlet at Shardcrown: four Summit Keepers then the Champion, back to back. |
| **Summit Bell** | Drift/Flux: after a loss, resume at the Keeper (or Champion) who beat you, with a party snapshot. |
| **Chaos dial** | Drift / Flux / Freefall / Custom. Sets randomness depth and information depth. |
| **Seed / Seed Card** | Shareable run code; end-of-run shareable summary card. |
| **Island chain** | 7 islands, 8 Spires. The Brindle Isles are the starting tide-flats. |

### 0.3 Named entities referenced by the rules

| Name | Role |
| --- | --- |
| **PUDDLE** | Demo creature: a Sloshkin, Lv20 in the live demo, Lv30 in the Forecast mockup. Heartmark technique: Undertow. |
| **Sloshkin** | Brine starter. Ability Shoresense. Signature Undertow. |
| **Prismoth** | The pitch's Ward creature (Glass/Gust). Prism Ward lets only Strong hits through; for Glass/Gust that means Kiln and Rime. |
| **Corin** | Teaches Capture Stance at the start. |
| **Linnet Rask** | Rival. Opening fight: Caldermaw, a scripted Lv5 story Shift. |
| **Teo Varga of the Scatter** | Boss trainer. Does not force Shifts on the player's side. |
| **Provost Agathe Merrow of the Mooring** | Boss trainer. Uses Anchor Pulse: blocks Shifts on her own team and the Scatter's forced Shifts. |
| **Idris Fenwake** | Champion. Ace: Vesperay, the evasion-and-recovery tank the counterplay rules are tuned against. |
| **Shardcrown** | Location of the Summit. |
| **The Scatter** | Faction; refines skyglass dust into Starsalt. |
| **The Mooring** | Faction (Provost Merrow). |
| **Hollow** | Type immune to Plain and Grit (the chart's one deliberate homage to the Normal/Fighting-vs-Ghost wall). |

### 0.4 Types named in this section

Brine, Stone, Grit, Glass, Gust, Kiln, Rime, Plain, Hollow, Moss, plus **Star**. The creatures section states the chart has **12 types plus Star**; only the ten above are named within the gameplay rules. Known relation: **Hollow is immune to Plain and Grit**.

### 0.5 Palette keys used by rules

| Key | Colour | Rule use |
| --- | --- | --- |
| **m** | comet magenta | Heartmarks, skyglass, Shift effects, the Forecast panel, the Vagary. Never on uniforms, bags, type badges or other UI icons. The "Shift pending" pip is NOT drawn in m. |
| **w** | white-ish highlight | Heartmark highlight on cool-coloured bodies. |
| **y** | yellow-ish highlight | Heartmark highlight on warm bodies and on white bodies. |
| **k** | black | Silhouette test fill. |
| **o** | coral | PP counter at 25% PP. |
| **r** | berry red | PP counter at 0 PP; "Hit your ally?" prompt. |

---

## 1. Core loops and the badge schedule

### 1.1 Loop tiers

| Loop | Length | Content |
| --- | --- | --- |
| **Moment to moment** | seconds–minutes | Walk a route. Read what you meet. Fight, catch, or decline. Battles feed EXP. Story beats and Heartmark technique use feed Bond. |
| **Session** | 30–60 minutes (estimate) | Push from one Waystone to the next. At a Waystone the game autosaves and resolves any deferred Shifts through the Forecast. Then re-plan: re-teach moves from discs, adjust the bench, check the Coverage view against the next Spire's dossier. |
| **Island** | one leg of the chain | Each leg ends at a Spire (8 in all). The Spire leader awards a badge. The leader's full roster is posted at the door. Badges unlock chaos-steering tools (table below). |
| **Run** | full game | Clear the Summit. The game prints a Seed Card (each Heartmark creature's Shiftlog, Summit attempts, Ward walls met). Share the seed code. Replay the same seed on another dial, or race a friend on the same one. |

Design intent for the loop shape: a decision point follows every roll of the dice. Surprise still lands; the player always gets a turn to respond.

### 1.2 Badge unlock schedule

| Stage | Unlocks | Status |
| --- | --- | --- |
| **Start** | Read; Shift Forecast with Accept and Anchor; bench EXP. Corin teaches Capture Stance. | Read and bench EXP from the start: lead decision. |
| **Badge 1** | Reroll (the 1st Spire teaches it and gives the first Starsalt). A chip-damage disc is guaranteed in the seed by now. | Reroll at the 1st Spire: lead decision. Chip-damage disc by badge 1: lead decision. |
| **Badge 2** | Fast travel between visited Waystones. | Proposed. |
| **Badge 3** | Ethers stocked at every Shelter. | Lead decision. |
| **Badge 4** | Recall at any Shelter. | Proposed. |
| **Badge 5** | Skyglass tilts. The Summit Purse takes its first deposit. | Tilts: Proposed. Purse from badge 5: lead decision. |
| **Badge 6** | The Training Yard. The 6th Spire teaches bench training in the fiction. | Lead decision. |
| **Badge 7** | The Plumbline disc. | Lead decision. |
| **Badge 8** | The Summit gate. | Proposed. |

---

## 2. Shifts: when and how they happen

### 2.1 Definition

- A Shift moves a creature **Up** to a stronger form, **Side** to a different form of similar strength, or **Down** to a weaker one.
- A Shift is **permanent** (it does not wear off after a battle), **driven by growth**, and **forecast before it lands**. No device the trainer wears triggers it.
- Shifts replace fixed evolution entirely.

### 2.2 Volume (lead decision)

| Rule | Value |
| --- | --- |
| Shift windows per creature per run | about 3, tied to the island level curve |
| When a window opens | the first time the creature reaches each of three curve points |
| The three curve points | estimate: the curve levels posted for islands 2, 4 and 6 |
| Creature caught past a point | skips that window (late catches Shift less; playtest whether late catches feel flat) |
| Stored creatures (incl. Training Yard) | hold a window until they rejoin the party (Proposed) |
| Target Forecast rate | at most about 1 Forecast per 30 minutes of play; vertical slice tracks Forecasts per hour against this |
| Expected Forecasts per full run | about 18–25 for a party of six with 3 windows each, as the party changes (estimate) |
| Rejected earlier draft | a window at Lv12 then every 7 levels: implied 24–42 Forecasts, decision-fatigue risk |

Worked example from the creatures section: Sloshkin's three windows sit at about **Lv9, Lv20 and Lv34** (est.).

### 2.3 Per-creature presets (lead decision)

| Preset | Behaviour |
| --- | --- |
| **Auto-Anchor** | The game Anchors every window for this creature while you hold anchor stones. With no stone left, the Forecast opens. |
| **Auto-accept Up** | The game Accepts for you when the Up card has the highest odds. Any other spread opens the Forecast. (Proposed definition.) |

### 2.4 Timing

| Event | Rule |
| --- | --- |
| One level before a window | A **"Shift pending" pip** appears on the party screen. It is not drawn in comet magenta (m). |
| After the battle in which a window opens | Prompt: **"Open Forecast now"** or **"Later"**. |
| "Later" | Defers the Shift to the **next Waystone**, where every deferred Shift resolves together, one Forecast after another (lead decision). |
| Input timing | **No Shift input has a time limit.** (Lead decision: no input timing anywhere in the game.) |

### 2.5 Shifts and battles (lead decision)

- The player's creatures **never Shift in battle**. A window that opens mid-fight waits until the battle ends.
- Named boss trainers may run **scripted Shifts on their own creatures**; each one posts its Forecast on screen first.
- **Teo Varga of the Scatter** does not force Shifts on the player's side.
- **Provost Agathe Merrow of the Mooring** uses **Anchor Pulse**, which blocks Shifts on her own team and the Scatter's forced Shifts.

### 2.6 What a Shift never touches (lead decision)

A Shift never changes any of the following:

1. Level
2. EXP
3. Held item
4. Nickname
5. Bond
6. Trained stat points
7. The Heartmark technique

A Lv40 creature stays Lv40 after any Shift. (Chaos V2 re-read EXP on the new species' curve, so a Lv19 Ludicolo became a Lv16 Rhydon and a Lv30 Altaria became a Lv27 Gardevoir. WILDSHIFT keeps the level.)

### 2.7 Stat floor (lead decision)

| Dial | Max drop of any single base stat in one Shift |
| --- | --- |
| Drift | 10% |
| Flux | 20% |
| Freefall | no floor |

- The floor applies per base stat, per Shift. Down outcomes still hurt; the floor stops a carry collapsing in one roll.
- There is **no separate bonus rule** on top of the floor.

---

## 3. The Shift Forecast screen

### 3.1 Structure (lead decision)

- When a Shift resolves, the Forecast shows **exactly three cards: Up, Side and Down**.
- The result is **always one of the three**. There is **no hidden fourth outcome**.
- Each card is drawn from the creature's **family pool**. The hidden per-family Shift tables (owned by the creatures section) set which form lands on each card; the dial sets each card's odds. The player sees only the three cards and their odds.

### 3.2 Mockup (Flux)

```
SHIFT FORECAST                          Dial: Flux
PUDDLE  Sloshkin  Brine          Lv30   Bond ■■■□□
UP 55%            SIDE 35%          DOWN 10%
Siltback          Mudfist           Puddlepip
Brine / Stone     Grit              Brine
Total +55         Total +5          Total -40
Ab: Tidecall      Ab: Slatehide     Ab: Glasshide (Ward)
Keeps 4/4 moves   Keeps 3/4         Keeps 4/4
Heartmark: Undertow (kept in every form)
[A] Accept  [X] Reroll: 1 Starsalt  [Y] Anchor: 1 anchor stone
```

Arithmetic shown: Flux base odds are 40 / 35 / 25. PUDDLE's three Bond pips move 15 points from Down to Up (the Flux cap), so the cards read 55 / 35 / 10.

### 3.3 Card contents

| Field | Rule |
| --- | --- |
| **Odds** | Whole percentage. |
| **Sprite** | Full colour. On Freefall, a form you have not **Seen** shows as a silhouette, and its ability shows as "?" until you have **Read** that form. |
| **Types** | Of the candidate form. |
| **Stat total change** | Relative to the current form (e.g. Total +55 / +5 / −40). |
| **Ability** | Name; a one-line effect on a second press. Ward abilities are flagged "(Ward)". |
| **Moves kept** | "Keeps 3/4" means one current move goes to Memory. |
| **Heartmark line** | Names the Heartmark technique, kept in every form. |

### 3.4 Actions

| Action | Effect |
| --- | --- |
| **Accept** | Plays the roll. The three cards flip face down, shuffle for about **1.5 seconds** (estimate), and one turns over. Nothing in the flip responds to button timing (lead decision). The player knows the menu, not the pick. |
| **Reroll** | Redraws all three cards (cost in §4.6). |
| **Anchor** | Spends one anchor stone and cancels this Shift (rules in §4.7). |

### 3.5 Other Forecast rules

- **A Down card is a real offer.** It may carry something valuable (in the mockup, Puddlepip carries Glasshide, a Ward ability). Some players will Accept hoping the Down card turns over; the design wants that.
- After the first viewing, **one button skips straight to the flip**.
- Boss trainers' scripted Shifts also post their Forecast on screen first (§2.5).

---

## 4. Odds, Bond, Starsalt, Reroll, Anchor, Still Knot

### 4.1 Base odds per dial (lead decision; playtests may tune)

| Dial | Up | Side | Down |
| --- | --- | --- | --- |
| **Drift** | 50 | 40 | 10 |
| **Flux** | 40 | 35 | 25 |
| **Freefall** | [NEED SOURCE] | [NEED SOURCE] | [NEED SOURCE] |

Freefall should approximate Chaos V2. The team must sort the ~15 logged Chaos V2 evolutions into Up / Side / Down by stat-total change and set the odds from that count.

### 4.2 Star-touched forms (lead decision)

- Every family pool contains one Star-touched form at a **fixed ~2% weight**, on **every dial**, **outside any odds flattening**.

### 4.3 Bond (lead decision on sources and caps; values are estimates)

| Rule | Value |
| --- | --- |
| Sources | Story beats and Heartmark technique use only. Raw battle counts and accepted Shifts give nothing. |
| Pip per story beat | 1 pip per major story beat with the creature in the party |
| Pip per technique use | 1 pip per 30 uses of its Heartmark technique in trainer battles |
| Maximum | 5 pips |
| Effect per pip | moves 5 percentage points from Down to Up |
| Cap on Flux | +15 (i.e. 3 pips' worth) |
| Cap on Freefall | +10 (2 pips' worth) |
| Cap on Drift | Down never drops below 5% (estimate), which caps Bond at +5 (1 pip's worth) |

Rationale for capping: uncapped, 5 pips would move 25 points and take Flux's Down card to 0%, so the dial would stop meaning anything for a bonded creature.

Resulting odds after full Bond effect:

| Dial | Base | Max Bond shift | Odds at cap |
| --- | --- | --- | --- |
| Drift | 50 / 40 / 10 | +5 | 55 / 40 / 5 |
| Flux | 40 / 35 / 25 | +15 | 55 / 35 / 10 |
| Freefall | [NEED SOURCE] | +10 | base Up +10, Down −10 |

### 4.4 Skyglass tilts (badge 5)

- A **held piece of skyglass** biases the draw.
- Example: **Brine skyglass guarantees that at least one card keeps a Brine type**.
- Tilts shape the menu. They **never set any outcome to 100%**.

### 4.5 Starsalt (steering currency)

| Source | Amount |
| --- | --- |
| Starting amount | 0 |
| 1st Spire | the first Starsalt: 3 (estimate) |
| Skyglass nodes on routes | 1–2 each; refill after each badge |
| Later Spire wins | 3 |
| Errants beaten or caught | 2 |
| Shelter purchase | 1,500 glint each, at most 3 per visit |

All amounts are estimates. Fiction: the Scatter refines skyglass dust into Starsalt.

### 4.6 Reroll (lead decision)

| Rule | Value |
| --- | --- |
| Unlock | the 1st Spire |
| Effect | redraws all three cards from the creature's seeded stream (pulls the next draw in the stream) |
| Cost within one Shift | 1 Starsalt, then 2, then 4, then keeps doubling (estimate past the third) |
| Hard cap | none |

Escalation is meant to discourage rerolling until a perfect card appears.

### 4.7 Anchor (lead decision)

- Anchor spends **one anchor stone** and **cancels this Shift**. That window is **used up** (it does not re-open).
- Anchoring **always** costs a stone, on every dial.

| Dial | Anchor stone supply |
| --- | --- |
| **Drift** | Issued free. Start with 3; refill to 3 at each badge (estimates). They still run out between badges. |
| **Flux** | Bought at Shelters, 1,000 glint (estimate). |
| **Freefall** | Bought at Shelters, at most 1 per badge. |

Challenge-mode interactions: **Restless** makes each Anchor spend two stones; **Ride the Dice** disables Anchor (§18.5).

### 4.8 Still Knot

- A **held item** that blocks **every Shift** for its holder.
- It occupies the **held-item slot**; the cost is the loss of other held-item options.
- Windows do not open while it is held (a player who loves a form keeps it as long as the Knot stays on).

---

## 5. Heartmark: what carries across forms

### 5.1 The mark (lead decision on behaviour; visuals section owns pixel spec)

- Every creature born since the **Starfall** has a faint Heartmark.
- It lights in **comet magenta (m)** only once the creature bonds with a trainer. **Wild creatures show none.**
- Shape: a small four-point sparkle; a plus at 3px, or a plus with diagonal glints at 5px. Highlight pixel is **w** on cool-coloured bodies and **y** on warm ones (and **y** on white bodies, Proposed).
- It is placed **per individual** and stays in the **same relative spot through every form**, so the player can see it is the same companion.

### 5.2 Carried across every form

| Carried | Notes |
| --- | --- |
| Nickname | |
| Bond | |
| **Heartmark technique** | One move, pinned by the player at the **first Shift**. Usable in **every** form, including forms that could never learn it. Keeps its PP boosts. PUDDLE's is Undertow. Creatures section proposes it also keeps its same-type bonus in every body (Proposed). |
| Level, EXP | |
| Held item | |
| Trained stat points | |
| **Shiftlog** | Strip of every form the creature has held, shown on its summary page. |

### 5.3 Moves and Memory

- Moves the **new form can learn stay**.
- Moves it **cannot learn go to Memory**.
- **Any Shelter relearns a Memory move at no cost** once a later form can use it.
- The Forecast card's "Keeps N/4" line tells the player how many moves survive before they commit. Playtest whether "Keeps 3/4" feels fair.

### 5.4 Recall (badge 4, Proposed)

| Rule | Value |
| --- | --- |
| Where | any Shelter |
| Cost | 6 Starsalt (estimate) |
| Effect | return the creature to **any form in its Shiftlog** |
| Preservation | keeps everything a Shift keeps (§2.6) |

### 5.5 Errants and the Down card (Proposed)

- On **Drift and Flux**, a caught **Errant's Down card always shows 0%**.
- The Forecast still shows three cards; the Down card **never lands**.
- (Freefall is not covered by this rule.)

### 5.6 Where surprise survives

- The player never knows which card flips.
- On Freefall, unseen forms arrive as silhouettes.

---

## 6. Readable chaos: scouting

Read is available **from the start on every dial** (lead decision). Randomized abilities stay in the game; scouting is the answer.

### 6.1 Read before trainer battles (lead decision)

| Step | Rule |
| --- | --- |
| Trainer spots you | A compact strip of **party pips** shows by default: one pip per creature on the trainer's roster, with a **Ward shimmer on any Ward creature** (Drift and Flux only). |
| Full Read card | Opens on a button press. |
| Auto-skip | If every creature on that roster is already **Read** in the Field Log, the Read step is skipped and the battle starts. |

### 6.2 Full Read card contents by dial

| Dial | Roster shown | Species | Types | Abilities |
| --- | --- | --- | --- | --- |
| **Drift** | full roster | yes | yes | yes |
| **Flux** | full roster | yes | yes | only for species already Read |
| **Freefall** | lead creature only | yes | yes (lead's types) | no |
| **+ Scouting Prism** (any dial) | adds **moves, held items and heal pips** to the card | | | |

### 6.3 Fight or Decline

- **Optional route trainers** offer **Fight** or **Decline**.
- Declining forfeits their payout and EXP.
- **Story trainers, rivals and Spire trainers cannot be declined.**

### 6.4 In-battle Read

| Rule | Value |
| --- | --- |
| Where | a command next to **Fight** |
| Effect | reveals **one foe's ability** with a one-line effect |
| Drift / Flux | works **once per foe** and **does not use your turn** |
| Freefall | **costs the turn** |
| Challenge mode | **Blind Read** turns all scouting off |

### 6.5 Dossiers

Each **Spire door** and the **Summit gate** post a dossier containing:

- Full rosters
- Abilities
- Heal items carried (as pips)
- A **tactic tag**, e.g. "evasion + recovery"

### 6.6 Coverage view

- On the party screen.
- Shows which types the party's **current moves hit hard** (Strong).
- Flags **immunity gaps** with a red **"Gap"** label (words plus icon; colour is never the only signal).
- Canonical gap: a party with only Plain and Grit attacks is flagged against **Hollow**, which is immune to both.
- When a disc already in the bag would close a flagged gap, the view points at that disc.

---

## 7. The Field Log (bestiary)

### 7.1 States per form (lead decision)

| State | Earned by | Notes |
| --- | --- | --- |
| **Seen** | Met in the wild, in a trainer's party, or **face up** on a Forecast card. | A silhouette does **not** count. |
| **Read** | Scouted with Read or a dossier. | The log stores the form's **types and ability for this seed**. Abilities are **fixed per species per seed**, so every later encounter shows them. |
| **Held** | A creature you own has held this form, by catch or by Shift. | |

### 7.2 Completion

- Completion counts **Held** forms.
- Scope: about **100 forms in about 30 families** (estimate).

### 7.3 Ways to chase a specific form

1. Catch it wild where it spawns.
2. Steer a Shift toward it with **skyglass tilts** and **Reroll** (reroll until the form shows on a card, then take its odds).
3. On Freefall, **Seeing** a form first turns its silhouette into a full sprite on later Forecast cards.
4. Once Held, keep it with a **Still Knot** or get it back later with **Recall**.
5. **Shift-only forms** (e.g. Skeinwing) can only be reached by Shift.

---

## 8. Ward abilities

### 8.1 The Ward family

| Ward | Effect | Status |
| --- | --- | --- |
| **Glasshide** | Only **Strong** (super-effective) hits land. (The run's Wonder Guard.) | core |
| **Mirrorveil** | **Status moves fail.** | Proposed for playtest |
| **Stillcoat** | Hits **under 50 power** do nothing. | Proposed for playtest; 50 is an estimate |
| **Prism Ward** (Prismoth) | Lets only Strong hits through. For a Glass/Gust Prismoth that means **Kiln and Rime** (the coral and blue bands on its wings). | pitch's teaching creature |

Prismoth is the native Ward species that teaches the rule.

### 8.2 The tell (lead decision; visuals section owns the spec)

| Element | Rule |
| --- | --- |
| Shimmer | A **hex-lattice shimmer** on the Ward creature that replays about **every 4 seconds**. |
| Badge | A **"Ward ?"** badge sits by its HP bar. |
| Freefall | The badge appears **only after the first blocked hit**. |
| Pre-battle | The party-pip strip shows a Ward shimmer on Ward creatures (Drift and Flux). |

### 8.3 The readout after a blocked hit (lead decision)

The message names the Ward, e.g. **"Glasshide held. Only Strong hits get through."** The readout then lists:

1. Which of your **party's techniques can land**, by creature and move name.
2. The **types** that can hit it.
3. **Indirect damage** that works: poison, burn, trap, weather chip.
4. **Crackdust**, if you carry it.

### 8.4 Crackdust

- Single-use item.
- **Suppresses a Ward for 3 turns** (estimate).
- A Shelter staple (never randomized).
- Guaranteed in stock at the Shelter before any mandatory Ward trainer, priced **below one route trainer's payout** at that Shelter (lead decision).
- In **Empty Wallet** mode it appears as a field pickup instead (Proposed).

### 8.5 Placement rules (fixed at new game)

| Rule | Status |
| --- | --- |
| At most **one Ward creature per trainer** | Proposed |
| **No Ward creatures on the first two routes** | Proposed |
| **Crackdust guaranteed in stock** at the Shelter before any mandatory Ward trainer, priced below one route trainer's payout | lead decision |
| **One chip-damage disc (poison or trap) guaranteed by badge 1** | lead decision |

Rationale for hard guarantees: "offered somewhere in the seed" is not enough; the party may have Shifted away from the answering types or never bought the disc. The guarantee must be an item the player actually holds or can buy at the moment it matters.

### 8.6 Scrap and Wards

Scrap (§9.2) does **not** pierce Wards.

---

## 9. Battle rules: PP, the soft-lock fix, Scrap

### 9.1 Menu-level rules

| Rule | Status |
| --- | --- |
| A move at **0 PP cannot be selected**. Pressing A on it plays a short buzz and shows **"No PP left."** | lead decision |
| In **trainer battles, Run is greyed out** and the reason is shown. | |
| The battle menu **flushes buffered input** at the start of every turn and at every screen change. | |
| PP counters turn **coral (o) at 25%** and **berry (r) at 0** PP. | thresholds are estimates |

These rules are enforced in the menu, **before the battle engine sees the input**.

### 9.2 Scrap (lead decision)

| Property | Value |
| --- | --- |
| Trigger | every move of the creature is at 0 PP |
| Type | typeless |
| Power | 50 (estimate) |
| Accuracy | never misses (estimate) |
| Cost | user loses **1/8 of max HP** (estimate) |
| Wards | does **not** pierce Wards |
| HP cost when blocked | applies **even when a Ward blocks the hit**, so no fight can stall forever (Proposed) |

### 9.3 PP supply

| Item / rule | Value |
| --- | --- |
| **Ether** | restores 10 PP to one move; **600 glint** (estimate). Stocked at every Shelter from **badge 3** (lead decision). |
| **Full Ether** | restores all moves; **1,800 glint** (estimate). Same availability. |
| **Summit top-up** | between Summit fights each move regains **5 PP** (§16.2). |

The test plan that enforces these rules is in §20.

---

## 10. Evasion and recovery counterplay

Tuning target: **Vesperay**, Idris Fenwake's evasion-and-recovery ace.

### 10.1 Rules

| Rule | Value | Status |
| --- | --- | --- |
| Evasion stage cap | **+2** | lead decision |
| Afterimages | stack to **2** at most | |
| Accuracy multiplier at +1 evasion | **×0.83** | estimate |
| Accuracy multiplier at +2 evasion | **×0.67** | estimate |
| **Mends** | each creature has a **battle budget of 3 Mends**, shown as pips. Each use of a recovery move spends one. At **0 Mends, recovery moves fail**. | lead decision |
| Guard moves | **fail on consecutive turns** | |
| Evasion move PP | at most **5 PP** | estimate |
| Trainer AI | uses an evasion move **at most twice per battle** | estimate |

### 10.2 Plumbline (lead decision)

| Property | Value |
| --- | --- |
| Source | the **7th Spire** awards the Plumbline disc in **every seed** |
| Accuracy | always hits |
| Effect 1 | clears the target's stat stages |
| Effect 2 | **blocks re-boosting for 2 turns** |

The 2-turn block is the load-bearing part: a plain stat-clear spends a turn and the ace re-boosts the next turn.

### 10.3 Other tools

- Every seed puts **at least three sure-hit techniques** in the disc pool (estimate).
- Stat stages show as **arrow pips** beside each HP bar. Mends show as pips too.
- Dossier tactic tags name the plan ("evasion + recovery") before you walk in.

### 10.4 Design goal

- An evasion ace stays a wall worth planning for.
- A player **with** Plumbline has a reliable answer.
- A player **without** it still lands about **two hits in three** with a 100%-accuracy move (0.67 at the +2 cap).

---

## 11. Doubles targeting

All rules below apply to double battles.

| # | Rule |
| --- | --- |
| 1 | The **target cursor resets every turn**. It starts on the foe your chosen move hits hardest. **Ties go to the left foe** (lead decision). |
| 2 | The **action menu starts on Fight** every turn. |
| 3 | Each target label shows **name, HP bar and an effectiveness word**: Strong, Neutral, Weak, or Blocked (Ward or immunity). Words and icons always appear together; colour is never the only signal. |
| 4 | A damaging move aimed at your **own ally** needs a second press on a **berry-red "Hit your ally?"** prompt. |
| 5 | **Spread moves highlight every creature they will hit**, ally included, before you confirm. |
| 6 | **B on the second creature's menu steps back one menu**, and the screen says which creature you are choosing for. |
| 7 | The second creature's command screen shows the **first creature's queued action** at the top. |
| 8 | If a target **faints before your move lands**, the move **retargets the other foe** and the battle log says so. |
| 9 | A **"Remember last target"** setting exists. It is **off by default**. |
| 10 | All targeting works with the **d-pad alone**. |

Rationale: a reset to the best target costs at most one extra press and removes a whole class of wrong-target turns.

---

## 12. Progression: bench growth and the level curve

### 12.1 EXP rules

| Rule | Value | Status |
| --- | --- | --- |
| **Bench EXP** | On from the start. Creatures that battled get **100%** EXP. **Every other party member gets 60%.** | lead decision |
| **Training Yard** | Unlocked by the 6th Spire. **Up to 3 stored creatures**, picked at any Shelter, get **25% of party EXP**. | lead decision (values are estimates) |
| **Curve level** | Each island posts one: **next Spire leader's ace − 3**. Shown on the map and party screen. Shift windows sit on this curve. | estimate |
| **Catch-up** | A creature below the curve gains **+50% EXP for every 5 levels under**, capped at **×3**. | estimates |
| **Over-curve damping** | Starts at **curve + 10**. Applies **only to Rematch-board EXP**: a creature more than 10 levels over the curve gains Rematch-board EXP at **×0.5**. Story, route and Spire EXP is **never damped**. | lead decision (×0.5 is an estimate) |

Catch-up multiplier table (derived from the rule above):

| Levels under curve | Multiplier |
| --- | --- |
| 0–4 | ×1.0 |
| 5–9 | ×1.5 |
| 10–14 | ×2.0 |
| 15–19 | ×2.5 |
| 20+ | ×3.0 (cap) |

### 12.2 New catches

- Wild levels on each route sit at **curve − 4 to curve − 8** (estimate), so a fresh catch can join without a grind.

### 12.3 Warnings

- If the **party's median level** sits more than **8 under a Spire ace** (estimate), the door guide says so and points to the Rematch board.

### 12.4 Rematch board

- Every Shelter has a board of **6 rematchable trainers** (estimate) scaled to the curve.
- Rematches are pulled on demand (replaces unsolicited rematch calls; calls exist only as an opt-in setting).
- Also serves as on-demand income (§13.1).

### 12.5 Target

- Bringing a benched creature from **25 levels under the curve up to it** should take **under an hour** of play (estimate).

### 12.6 Strict variant

- The **No Carry** challenge mode (§18.5) is the strict version of damping: no creature may sit more than 8 levels above the party median; EXP stops at the cap.

---

## 13. Economy

Currency: **glint**.

### 13.1 Income

- Trainer payouts scale with the curve.
- The Rematch board gives repeatable income on demand.
- Spare items sell at **half price**.

### 13.2 Losses (lead decision)

| Event | Cost |
| --- | --- |
| Blackout (loss outside the Summit) | **10% of glint, capped at 3,000** |
| Summit loss | **nothing** |

### 13.3 The Summit Purse (lead decision)

| Rule | Value |
| --- | --- |
| Starts | badge 5 |
| Deposit | a fixed **1,500 glint at every badge** (badges 5, 6, 7, 8), shown on the badge screen |
| Total by badge 8 | **6,000 glint** |
| If you hold less than 1,500 | it takes what you have (Proposed) |
| Opens | at the **Summit gate** and nowhere else |

### 13.4 Price list (estimates unless noted)

| Item | Price (glint) | Notes |
| --- | --- | --- |
| Starsalt | 1,500 | at most 3 per Shelter visit |
| Anchor stone | 1,000 | Flux and Freefall only (free on Drift). Freefall: at most 1 per badge |
| Revival item | 1,800 | revives at 50% HP |
| Ether | 600 | 10 PP to one move; from badge 3 |
| Full Ether | 1,800 | all moves; from badge 3 |
| Crackdust | below one route trainer's payout at that Shelter | lead decision |
| Technique discs | 3,000 – 8,000 | reusable |
| Lantern grades | 250 / 700 / 1,400 | three grades |
| Recall | 6 Starsalt (not glint) | badge 4, Proposed |

### 13.5 Item chaos

- Field pickups **can be randomized on Flux and Freefall**.
- The pickup message **names the item before you take it**.
- **Shelter staples never randomize:** healing, revival items, Ethers, Lanterns, Starsalt, anchor stones and Crackdust.

---

## 14. Technique discs and shops

### 14.1 Kept from the hack

- Disc contents are **random per seed** and **fixed at new game**. Finding a disc is still a small lottery.

### 14.2 Changed

| Rule | Value | Status |
| --- | --- | --- |
| **Compatibility randomized with the move** | Every disc can be learned by **at least 25% of species in the seed**, and by **at least one species catchable on the route where the disc is found**. | estimates |
| **Discs are reusable** | | |
| **Shops show the move** | Each listing shows **name, type, power, accuracy, PP, a one-line effect, and compatibility icons for every creature in your party and storage**. | |
| **Coverage guarantee** | By **badge 3** the seed makes available **at least one disc that answers each immunity in the type chart**. A Plain and Grit attacker always gets a way past Hollow creatures before the Spire that leans on them. | Proposed |
| **Heartmark link** | A disc move can become a Heartmark technique. Once pinned it survives every Shift, even into forms that could never learn the disc. | |
| **Chip-damage guarantee** | One poison-or-trap disc guaranteed by badge 1 (§8.5). | lead decision |
| **Sure-hit guarantee** | At least three sure-hit techniques in every seed's disc pool (§10.3). | estimate |
| **Plumbline** | 7th Spire, every seed (§10.2). | lead decision |

### 14.3 Freefall shop option

- Shops list discs **by type only** ("Moss disc, ???").
- The **price always shows**.
- Any disc over **5,000 glint** (estimate) asks for **confirmation** before purchase.

---

## 15. Catching and Errants

### 15.1 Errants (lead decision: wild legendaries stay)

| Rule | Value |
| --- | --- |
| Appearance | roaming legendaries on **regular routes** at about **1 in 300 encounters** (estimate), plus **fixed story sightings** |
| Entry | a distinct cry and its own intro, then the prompt **"Errant. Enter Capture Stance?"** |
| Fleeing | Errants **do not flee on turn one** |
| Self-KO moves | allowed; the **Scouting Prism** shows those moves ahead of time |
| Counter abilities | stay in the pool (e.g. an ability that blocks explosion-type moves) |
| KO'd Errants | **return** on a nearby route after your **next badge** or **2 hours of play**, whichever comes first (lead decision) |
| Starsalt | beating or catching an Errant gives 2 Starsalt (§4.5) |
| Forecast | on Drift and Flux a caught Errant's Down card always shows 0% (§5.5, Proposed) |

### 15.2 Capture Stance (lead decision)

- A **toggle** available in **any wild battle**, taught by **Corin** at the start.
- While on, **your party's damage cannot drop the wild creature below 1 HP**.
- Uses **no move slot**.

### 15.3 The Lantern (lead decision)

- Capture uses the Lantern. You **raise it**, its light draws the creature in, and a **3-segment glow meter** fills.
- There is **no throw arc, no wobble and no click**.
- Send-out is a **light-to-form unfold**.
- The capture flow and the odds display go to the **pre-production patent clearance review** before any animation is made.
- Lantern grades are priced 250 / 700 / 1,400 glint.

### 15.4 Capture odds (lead decision)

| Dial | Display |
| --- | --- |
| Drift | exact percentage, shown in the Lantern menu before you spend a Lantern |
| Flux | exact percentage |
| Freefall | bands: **Low / Fair / Good** |

- Each **failed attempt on the same creature adds +3%**, capped at **+15%** (estimates).

### 15.5 The one sure-catch Lantern (lead decision: one-of-a-kind items need a confirm)

- Lives in a separate **Keepsakes** pocket.
- The **bag cursor never starts there**.
- Using it opens a **confirm screen that names the target**, with **No as the default**.

---

## 16. The Summit gauntlet

### 16.1 Structure (lead decision)

| Rule | Value |
| --- | --- |
| Location | **Shardcrown** |
| Sequence | **Four Summit Keepers**, then the **Champion, Idris Fenwake**, back to back |
| Between fights | **No Shelter.** HP and fainted creatures **do not recover** between fights |
| Items | **All items are allowed** |
| Gate | opens at badge 8 (Proposed); the Summit Purse opens here |

### 16.2 Changes vs. a classic league (numbers are estimates unless noted)

| Change | Value |
| --- | --- |
| **Dossier at the gate** | full rosters, abilities, heal pips and tactic tags |
| **Heal cap** | each Keeper carries **at most 2 heal items**, shown as pips |
| **PP top-up** | between fights, **each move regains 5 PP** |
| **No glint loss** | Summit losses cost nothing (lead decision), plus the Summit Purse |

### 16.3 The Summit Bell (lead decision; Drift and Flux)

- After a loss, the Summit Bell lets the next attempt **start at the Keeper who beat you**, or at the **Champion's door** if Idris did.
- Fiction: Idris's gate remembers a challenger once.
- The Bell attempt starts with the **party as it stood when that fight began: same HP, PP and items** (Proposed snapshot).
- Because a snapshot can trap a party that arrived spent, you can **always decline the Bell and restart from the first Keeper**.
- **The Bell does not refill anything.** PP spent before a fight stays spent.

### 16.4 Freefall

- Keeps the **full restart after every loss**.

---

## 17. The Chaos dial

All four settings are selectable at new game (lead decision).

### 17.1 Master comparison

| Property | **Drift** (story first) | **Flux** (default, Proposed) | **Freefall** (approximates Chaos V2) | **Custom** |
| --- | --- | --- | --- | --- |
| Randomized at new game | creatures from themed route pools, abilities, discs | creatures, abilities, discs, field items | everything Flux randomizes | every toggle exposed |
| Shift odds Up/Side/Down | 50 / 40 / 10 | 40 / 35 / 25 | [NEED SOURCE] (measure from ~15 logged evolutions) | per toggle |
| Anchor stones | issued free; start 3, refill to 3 each badge | bought at Shelters, 1,000 glint | bought at Shelters, at most 1 per badge | per toggle |
| Stat floor per Shift | 10% | 20% | none | per toggle |
| Bond cap | +5 (Down never below 5%) | +15 | +10 | per toggle |
| Unseen forms on Forecast | full sprite | full sprite | silhouette; ability "?" until Read | per toggle |
| Pre-battle Read card | full roster: species, types, abilities | full roster: species, types; abilities once Read | lead creature and its types only | per toggle |
| Pre-battle Ward shimmer on party pips | yes | yes | no | per toggle |
| In-battle Read | once per foe, free | once per foe, free | costs the turn | per toggle |
| "Ward ?" badge | from battle start | from battle start | only after first blocked hit | per toggle |
| Capture odds | exact % | exact % | Low / Fair / Good bands | per toggle |
| Disc shop listings | full details | full details | type only ("Moss disc, ???"); price shown; >5,000 asks confirm | per toggle |
| Errant Down card | 0% | 0% | normal | per toggle |
| Field item pickups | not randomized | randomized | randomized | per toggle |
| Summit Bell | on | on | off (full restart after every loss) | per toggle |
| Star-touched weight | ~2% | ~2% | ~2% | ~2% (fixed on every dial) |

The Drift and Flux odds are lead decisions that playtests may tune.

### 17.2 Opening fight (lead decision)

- **Linnet Rask's Caldermaw** is a **scripted Lv5 story Shift on every dial**, so every player meets the same over-tier opener.
- The first fight is a **"hold out 3 turns"** scene that **continues on any result**.
- The rematch and Linnet's later teams follow the dial.

### 17.3 Changing the dial (lead decision)

| Rule | Value |
| --- | --- |
| Where | any Shelter |
| Stays fixed from new game | creature placements, Ward placements, disc contents |
| A change touches only | Shift odds, scouting depth, anchor rules |
| Seed Card | any mid-run change marks it **"not race-eligible"** |
| Stat floor and Summit Bell | follow the dial you **started** on (Proposed reading; confirm with the lead) |

### 17.4 What the dial never changes (safety rules, on at every setting including Custom)

1. No soft-locks.
2. No input timing.
3. Verified saves.
4. A confirm before spending one-of-a-kind items.
5. Star-touched forms hold their fixed ~2%.

---

## 18. Seeds, social play and challenge modes

### 18.1 Seed codes

- A seed is a short code such as **FLUX-K7Q2-MD7F** (format is a placeholder).
- It encodes the **starting dial, every Custom toggle and the random seed**.
- The same code gives the same: creature placement, Ward placement, abilities, disc contents, trainer teams and Shift tables.

### 18.2 Seeded Shifts

- Each creature draws its Shift cards from **its own seeded stream**, keyed to **the seed, the catch and the Shift count**.
- Two players on the same seed who make the same choices see the same Forecasts.
- A **Reroll pulls the next draw** in the stream.

### 18.3 Seed Card

Printed at the end of a run; shareable. Fields:

| Field |
| --- |
| seed code |
| dial |
| play time |
| Summit attempts |
| Ward walls met |
| each Heartmark creature's Shiftlog |
| the longest-serving creature |
| "not race-eligible" flag if the dial was changed mid-run |
| active challenge modes |

### 18.4 Social play (lead decision)

- **Single-player at launch.** No trading and no PvP (per-seed Shift tables and Ward placement make cross-seed balance impossible).
- Social play = **seed races** and the **Seed Card**.
- Post-launch plan (production section): a **weekly community seed** with **opt-in leaderboards**.
- Idea, not a promise: **async seed duels**.

### 18.5 Challenge modes

Opt-in, **stackable**, each shown on the Seed Card.

| Mode | Rule | Status |
| --- | --- | --- |
| **No Rewind** | One autosave slot and no manual reloads. | |
| **One Life** | A creature that faints leaves the party for good. | |
| **No Carry** | No creature may sit more than **8 levels above the party median**. EXP stops at the cap. | 8 is an estimate |
| **Restless** | About **6 Shift windows** per creature instead of 3, and each Anchor spends **two** anchor stones. Sized to stay under about 1 Forecast per 30 minutes; vertical slice must confirm. | estimates |
| **Ride the Dice** | Anchor is disabled. | |
| **Blind Read** | All scouting off. Stacked with Freefall, closest to how Chaos V2 felt. | |
| **One Heart** | Only the starter may battle. | |
| **Empty Wallet** | No shops. The guaranteed Ward answers (Crackdust and the chip-damage disc) appear as field pickups instead. | Proposed |
| **Accidental Hero** | Your starter and your first catch cannot enter the Summit. | |

---

## 19. Save safety

### 19.1 Autosave triggers

| Trigger |
| --- |
| Entering any town or Waystone |
| Before every Spire door, rival battle and the Summit gate |
| After every catch and every resolved Shift |
| Every 10 minutes on routes (estimate) |

### 19.2 Slots

- **Three rotating autosaves** plus **three manual slots** (estimate).
- **No Rewind** mode: one autosave slot, no manual slots.

### 19.3 Verified writes

1. Write to a temp block.
2. Read it back.
3. Check the checksum.
4. Only then swap it in.

A failure shows a **red "Save failed" banner** and **retries**. A save **never fails silently**.

### 19.4 Fixed menu

- **Save is always the last item** of the main menu, and **one Up press from the top always reaches it**.
- New features add entries **above** it.
- Each save confirmation shows the **location and the time**.

### 19.5 Crash recovery

- On boot after a crash, the game offers **"Resume from autosave: [place], [minutes] ago"** and lists what that rolls back, such as "1 trainer battle".

### 19.6 Input hygiene

- **Every scene change and every menu open flushes buffered input.**
- Related fixes: Keepsakes pocket + bag cursor reset (sure-catch Lantern), Run greyed out in trainer battles (RUN-loop freeze).

---

## 20. Engine testing (lead decision)

| Part | Content |
| --- | --- |
| **Menu state graph** | Enumerate the menu state graph and test every menu transition. Each transition compares the frame before and after, so a black map fails the build. |
| **Checkpoint fuzzing** | Coverage-guided fuzzing from saved states at each story checkpoint. Seed the corpus with the known failure shapes: moves at 0 PP, RUN pressed in trainer battles, doubles menus with stray B presses. |
| **Coverage report** | Report coverage per build. **Any hang or soft-lock fails the build**, the same as a crash. |

A frame-count fuzzer from boot cannot claim coverage of deep states, hence checkpoint seeding.

---

## 21. Quality-of-life list

| # | Item | Rule |
| --- | --- | --- |
| 1 | **Grass reads as grass** | Tall grass has its own sway animation and outline. Trees never share its palette. |
| 2 | **Weather you can see through** | Fog, rain and darkness overlays cap at **35% opacity** (estimate). A **"Clear visuals"** toggle removes the overlay and keeps the gameplay effect. |
| 3 | **Map with collision** | The map marks ledges, ramps and blocked tiles. An optional route line draws a path to a pinned waypoint. |
| 4 | **Puzzles keep state** | Leaving a puzzle room saves its state. Every puzzle room has a reset lever. Boulder puzzles allow undo. Rotating gates preview their next position. The seed never changes a puzzle from its in-game hint. |
| 5 | **Travel confirms** | Ferry and travel NPCs ask "Sail to [place]?" with **No as the default**. |
| 6 | **Fast travel** | Between visited Waystones from badge 2 (Proposed). |
| 7 | **Rematch board** | Replaces rematch calls. Calls exist only as an opt-in setting. |
| 8 | **Bag cursor** | Resets to the top of each pocket (setting, **on by default**). One-of-a-kind items live in Keepsakes. |
| 9 | **Speed** | Battle animations at **1x, 2x or 4x**. Instant text. The Shift flip can be skipped after the first viewing. |
| 10 | **Achievements** | Small toasts that never block input or break the map. Short joke banners stay; WILDSHIFT writes its own titles. |
| 11 | **Party screen** | Shows Shift pending pips, the curve gap and the Coverage view. |
| 12 | **Accessibility** | Full remapping. Effectiveness and status always use **words plus icons, never colour alone**. No Shift or capture input depends on timing. |

---

## 22. Consolidated numbers reference

### 22.1 Shift system

| Constant | Value | Status |
| --- | --- | --- |
| Windows per creature | ~3 | lead decision |
| Window curve points | islands 2, 4, 6 curve levels | estimate |
| Sloshkin windows | ~Lv9 / Lv20 / Lv34 | estimate |
| Max Forecast rate | 1 per 30 min | target |
| Forecasts per run | 18–25 | estimate |
| Flip shuffle duration | ~1.5 s | estimate |
| Drift odds | 50/40/10 | lead decision |
| Flux odds | 40/35/25 | lead decision |
| Freefall odds | unmeasured | [NEED SOURCE] |
| Star-touched weight | ~2% every pool, every dial | lead decision |
| Bond max pips | 5 | estimate |
| Bond per story beat | 1 pip | estimate |
| Bond per technique uses | 1 pip / 30 uses (trainer battles) | estimate |
| Bond effect per pip | 5 points Down→Up | estimate |
| Bond cap Drift / Flux / Freefall | +5 / +15 / +10 | lead decision |
| Drift Down minimum | 5% | estimate |
| Stat floor Drift / Flux / Freefall | 10% / 20% / none | lead decision |
| Reroll cost sequence | 1, 2, 4, 8, 16 ... (no cap) | lead decision; past 3rd is estimate |
| Anchor cost | 1 stone (2 in Restless) | lead decision |
| Drift stones | start 3, refill to 3 per badge | estimate |
| Flux stone price | 1,000 glint | estimate |
| Freefall stone limit | 1 per badge | lead decision |
| Recall cost | 6 Starsalt | estimate (Proposed feature) |
| Restless windows | ~6 | estimate |

### 22.2 Starsalt sources

| Source | Amount |
| --- | --- |
| 1st Spire | 3 |
| Route skyglass node | 1–2, refill per badge |
| Later Spire win | 3 |
| Errant beaten/caught | 2 |
| Shelter | 1,500 glint, max 3/visit |

### 22.3 Battle

| Constant | Value |
| --- | --- |
| Scrap power / type / accuracy | 50 / typeless / never misses |
| Scrap self-cost | 1/8 max HP |
| PP colour thresholds | coral at 25%, berry at 0 |
| Ether / Full Ether | 10 PP one move, 600 / all moves, 1,800 |
| Evasion cap | +2 |
| Accuracy at +1 / +2 | ×0.83 / ×0.67 |
| Mends per creature per battle | 3 |
| Evasion move max PP | 5 |
| AI evasion uses per battle | ≤2 |
| Plumbline re-boost block | 2 turns |
| Sure-hit techniques per seed | ≥3 |
| Crackdust duration | 3 turns |
| Stillcoat threshold | <50 power |
| Ward shimmer period | ~4 s |
| Ward creatures per trainer | ≤1 (Proposed) |
| Ward-free routes | first two (Proposed) |
| In-battle Read uses | once per foe (Drift/Flux) |

### 22.4 Progression

| Constant | Value |
| --- | --- |
| Bench EXP | 60% (battlers 100%) |
| Training Yard | 3 creatures, 25% of party EXP |
| Curve level | next Spire ace − 3 |
| Catch-up | +50% per 5 levels under, cap ×3 |
| Damping start | curve + 10 |
| Damping factor (Rematch-board EXP only) | ×0.5 |
| Wild levels | curve −4 to −8 |
| Median warning | >8 under Spire ace |
| Rematch board size | 6 trainers |
| Catch-up target | 25 levels in <1 hour |
| No Carry cap | median + 8 |

### 22.5 Economy

| Constant | Value |
| --- | --- |
| Blackout loss | 10% glint, cap 3,000 |
| Summit loss | 0 |
| Purse deposit | 1,500 per badge from badge 5 → 6,000 |
| Sell price | 50% |
| Starsalt | 1,500 |
| Anchor stone | 1,000 |
| Revival item (50% HP) | 1,800 |
| Ether / Full Ether | 600 / 1,800 |
| Discs | 3,000–8,000 |
| Lanterns | 250 / 700 / 1,400 |
| Freefall disc confirm threshold | >5,000 |
| Disc learnability | ≥25% of species; ≥1 species on the find route |
| Coverage guarantee deadline | badge 3 |

### 22.6 Catching and Summit

| Constant | Value |
| --- | --- |
| Errant encounter rate | ~1 in 300 |
| Failed-attempt bonus | +3% per fail, cap +15% |
| KO'd Errant return | next badge or 2 h play, whichever first |
| Capture Stance floor | 1 HP |
| Lantern meter | 3 segments |
| Summit Keepers | 4, then Champion |
| Keeper heal items | ≤2 |
| Summit PP top-up | 5 PP per move between fights |

### 22.7 Save / QoL

| Constant | Value |
| --- | --- |
| Route autosave interval | 10 min |
| Save slots | 3 auto + 3 manual |
| No Rewind slots | 1 auto, 0 manual |
| Weather overlay cap | 35% opacity |
| Animation speeds | 1x / 2x / 4x |

---

## 23. Appendix A: Creature-section rules read in overflow (lines 688–740)

These rules sit at the top of the creatures section and bear directly on the gameplay systems above.

### A.1 Roster and sprites

| Item | Value |
| --- | --- |
| Pitch roster | 15 creatures; 6 with concept sprites (Sloshkin, Skeinwing, Scrapling, Prismoth, Vesperay, Vagary); 9 text-only. Together they cover all 12 types plus Star. Status: Proposed. |
| Launch target | ~100 species in ~30 Shift families (est.) |
| Sprite sizes | 32×32 concept art; 64×64 final battle sprites; 96×96 large legendaries |
| Sprite rules | left-front 3/4 view; master palette keys only; silhouette test (filled solid k it still reads); one feature spottable at 1x on a handheld; each look ends with a "must not read as" line |
| Comet magenta (m) | only on Heartmarks, skyglass, Shift effects, the Forecast panel, and the Vagary (the comet itself). Never on uniforms, bags, type badges or other UI icons. |
| Names | all working names; clearance status Not tested. Flagged: Vagary (itch.io game title; also an English word), Scrapling (vs Sculplings on Steam), Skeinwing (vs Skinwing, MTG card). |

### A.2 Shift families (restated)

- Each species belongs to a family. The family pool lists every body the creature can become: its **forward line**, a **skip-ahead**, a **hatchling**, **forms from other families**, and **one Star-touched form**.
- The Forecast shows exactly three cards; the dial sets each card's odds; the family's hidden table sets which form lands on each card. The Sloshkin table (end of the creatures section, outside this extraction) is the worked example.

### A.3 Sloshkin (Brine, starter_base)

| Field | Value |
| --- | --- |
| Habitat | tide-flats of the Brindle Isles, where the first skyglass fell |
| Ability | **Shoresense**: on switch-in it Reads the foe automatically. The foe's ability and any Ward go straight into the Field Log. |
| Signature / Heartmark technique | **Undertow**: Brine, 65 power, 100% accuracy, lowers the target's Speed one stage (est.). Stays usable and keeps its same-type bonus in every body (Proposed). |
| Heartmark | on the forehead; w highlight (cool body) |
| Shift windows | about Lv9, Lv20 and Lv34 (est.) |
| Demo forms in mockup | Up: Siltback (Brine/Stone, +55, Tidecall). Side: Mudfist (Grit, +5, Slatehide). Down: Puddlepip (Brine, −40, Glasshide Ward). |

### A.4 Prismoth (Ward demo)

- Glass/Gust moth. **Prism Ward** lets only Strong hits through; for Glass/Gust that means **Kiln and Rime** (the coral and blue bands on its wings).

### A.5 Field Log note from the creatures section

- Seen: met in battle or shown face-up on a Forecast card. Read: scouted. Held: owned in that form.
- A player chases a form by catching it where it lives wild, or by Rerolling a Forecast until the form shows on a card and then taking its odds.
- Shift-only forms such as Skeinwing can only be reached by Shift.

---

## 24. Appendix B: Run evidence the rules trace to (compact)

Kept for designers who want to know what each rule answers. Not rules themselves.

| Rule | Run event it answers |
| --- | --- |
| Shift Forecast, no input timing | Evolution could only be stopped by a short B-press window; misses turned Flygon→Wailmer, Heracross line→Seviper, Lv34 Rayquaza→Trapinch |
| Shift never touches level | Lv19 Ludicolo→Lv16 Rhydon; Lv30 Altaria→Lv27 Gardevoir |
| ~3 windows, ≤1 Forecast/30 min | ~15 Chaos evolutions in 45 hours; MUDDY had seven bodies |
| Down card is a real offer; surprise kept | Lv40 Wailmer→Seadra, which beat the Champion's Latias with 11 HP left |
| Read, Ward tell, Ward readout | ~10 Wonder Guard walls, each found only by a wasted turn; four cost full losses; Route 120 Metagross wiped the team twice |
| Crackdust / chip-disc guarantees | Ludicolo's Absorb could hit the twins' Groudon but only to ~35% HP; lost twice |
| Coverage view, Hollow immunity | Machoke's Normal/Fighting-only moveset walled by Brawly's Dusclops, Juan's Banette, Drake's Dusclops; TM40 Leaf Blade fixed it late |
| 0 PP unselectable, Scrap, Run greyed, input flush | Five hard freezes, all at the move menu; at least three on 0-PP moves; one after a RUN loop |
| Ethers from badge 3, Summit PP top-up | League run 2: Body Slam and Low Kick at 0 PP vs Drake; run 3: Leaf Blade ran out on Dusclops |
| Evasion cap +2, Mends 3, Plumbline 2-turn block | Wallace's Latias (Double Team + Recover + Protect) ended runs 4, 5, 6; Haze resets got re-boosted; Juan's Banette (Double Team + Rest) took three tries |
| Doubles cursor reset | Target defaulted to right foe; third A press; per-creature cursor memory; B cancelled second creature's move |
| Bench EXP 60%, Training Yard, catch-up | Bench ~30 levels under the curve; MUDDY Lv27 vs Machoke Lv73; Seadra's Lv49→74 grind took ~5 hours |
| Over-curve damping on Rematch EXP only | Seadra reached Lv75 against a Lv55–58 Champion team (an accidental hero the design wants to allow) |
| Blackout 10% cap 3,000; Summit Purse; no Summit loss | 6 Revives before League run 3 took money to ~0; Glacia's Beautifly drained every Revive in run 6 |
| Shops show the move; compatibility shuffled with it | TM30 rolled Lick, nobody could learn it; shop TM38 cost 5,500 and was Constrict |
| Pickup message names randomized items | A Potion became Soda Pop |
| Capture Stance | Accidentally KO'd a Lv15 Rayquaza and a Lv25 Jirachi |
| Capture odds shown, +3% per fail | Four Ultra Balls failed on a Rayquaza before a Great Ball caught it; 8 Ultra Balls failed on a Ninetales; Deoxys took ~6 |
| Keepsakes pocket, confirm with No default | Bag remembered its cursor slot; a stray press threw the Master Ball at a wild Lv26 Kyogre |
| Summit Bell, heal cap, dossier | League took 8 runs / 7 losses; Drake ended runs 1, 2, 3, 7; Wallace ended 4, 5, 6; every loss restarted at the first member |
| Errant counter abilities stay | Wailmer's Damp blocked a Regice's Explosion twice |
| Opening scripted Lv5 Shift | Rival May's Lv5 Groudon in the first fight |
| Verified saves, fixed Save slot | PokéNav shifted the start menu and saves silently failed; a crash backup load also rewound a Brawly loss |
| Achievement toasts never break the map | Opening ACHIEVE left the map black until the party screen was opened |
| Grass/trees/weather readability | Bushy trees near Mauville read as grass; Lavaridge fog; rain after Kyogre; dark caves |
| Puzzle state, reset lever | Mossdeep switch puzzle reset on exit; Sootopolis ice layout differed; Fortree gates and Seafloor boulders cost time |
| Travel confirm | Re-talking Mr. Briney sailed the player back to Petalburg |
| Fast travel | Story order sent the player Mt Pyre → Magma Hideout → Slateport → Aqua Hideout |

---

## 25. Appendix C: Open items to resolve in pre-production

### C.1 [NEED SOURCE]

| Item | Needed action |
| --- | --- |
| Freefall Shift odds | Sort the ~15 logged Chaos V2 evolutions into Up/Side/Down by stat-total change; set odds from the count. |

### C.2 Proposed (playtest)

- Stored creatures hold a Shift window until they rejoin the party.
- Auto-accept Up preset definition.
- Scrap HP cost applies even when a Ward blocks it.
- Recall (badge 4, 6 Starsalt).
- Errant Down card 0% on Drift and Flux.
- Mirrorveil and Stillcoat Wards.
- ≤1 Ward creature per trainer; no Wards on the first two routes.
- Fast travel at badge 2; skyglass tilts at badge 5; Summit gate at badge 8.
- Summit Purse takes what you have if under 1,500.
- Disc coverage guarantee by badge 3.
- Summit Bell snapshot of HP/PP/items.
- Flux as the default dial.
- Stat floor and Summit Bell follow the starting dial after a mid-run change.
- Empty Wallet: guaranteed Ward answers become field pickups.
- Heartmark technique keeps same-type bonus in every body.
- "Keeps 3/4" move-retention fairness.
- Whether late catches (fewer windows) feel flat.
- Restless mode staying under 1 Forecast per 30 min.

### C.3 Lead decisions whose numeric values are still estimates

Drift/Flux odds (tunable), Bond pip sources/caps values, Reroll escalation past the 3rd, Drift stone counts, Scrap stats, PP colour thresholds, evasion accuracy multipliers, Training Yard size and share, catch-up and damping multipliers, curve offset (−3), all glint prices, Errant rate and return timer, capture-fail bonus, Summit heal cap and PP top-up, autosave interval and slot counts, weather overlay cap.

### C.4 Pre-production clearances

- Capture flow (Lantern, glow meter) and odds display: **patent clearance review before any animation is made**.
- Creature names: trademark search and roster check against Pokémon, Temtem, Coromon, Cassette Beasts, Digimon and Monster Sanctuary.
