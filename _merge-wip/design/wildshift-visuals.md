# WILDSHIFT — Art & Audio Bible

Reference extraction of the "Visuals: Readable Chaos" section of the Wildshift pitch (source lines 1689–2090). Engineers and designers build from this document; they do not read the original. Names, numbers and rules are kept exact. Where the source marks a value as an estimate, this doc marks it **(est.)**. Where this doc adds something the source does not state (e.g., hex values), it is labelled **[not in source]**.

**Status of everything in this document: Proposed.** Nothing is built or playtested. Every frame count, threshold and budget is an estimate for the relevant lead to tune.

**Ownership.** This section owns two things other sections must use as written:
1. The **sprite-scale table** (section 5).
2. The **Ward tell** (section 9).

Other sections referenced (not reproduced here): Gameplay (Read cost/depth, Mends-qualifying moves, Shift dials), Creatures (type chart, Shift pool weights), Story (faction plots, route order), Production (art budget, throughput, owners).

---

## Table of contents

1. Design goal and the one-screenshot test
2. Native resolution and aspect ratio
3. Palette approach
4. Heartmark drawing spec
5. Sprite scales (single source)
6. Tile readability rules
7. Weather, fog, darkness and lighting
8. Battle HUD and move menu
9. Scouting readout and Ward tells
10. Shift Forecast panel
11. Field UI and menus
12. Battle presentation
13. Animation list
14. Cutscene approach
15. Accessibility
16. Audio direction
17. Art bible: do and don't
18. Quick-reference tables (timings, thresholds, explicit-state strings)
19. Glossary of terms used in this section
20. Open items flagged in the source
21. Implementation notes for a browser build [not in source]

---

## 1. Design goal and the one-screenshot test

- Wildshift keeps the **GBA-era pixel look** and spends its art budget on one job: **making chaos readable before the player commits.**
- Most rules trace to a logged moment in the Emerald Chaos V2 run (45 hours of edited video) where the screen hid something the player needed. Rules with no run moment behind them (palette, audio direction) are craft calls.
- **The one-screenshot test.** The run was played from still screenshots. A still frame has no motion cues, so it is a hard readability test. **Every screen must pass it:** from one frame, a new player can say (a) what is walkable, (b) what is interactive, and (c) what each battle readout means.
- Illustrative before/after from the source: *Before* — tall grass and tree share one green. *After* — tufts read as grass; trees get an outline, trunk and shadow.

---

## 2. Native resolution and aspect ratio

### 2.1 Canvas

| Property | Value |
| --- | --- |
| Native art canvas | **320 x 180**, 16:9 |
| Tile size | 16 x 16 px |
| Tiles visible | 20 across, just over 11 down |
| GBA reference | 15 x 10 tiles at 240 x 160 |
| Text/Large-Text/Japanese overlay | **640 x 360** (exactly 2x the art layer) |
| 16:10 handheld variant (1280 x 800) | Render **320 x 200** (about one more row of map); overlay becomes **640 x 400** |

### 2.2 Integer scaling targets

| Scale | Output | Target |
| --- | --- | --- |
| x4 | 1280 x 720 | Switch handheld |
| x6 | 1920 x 1080 | Switch docked, Switch 2 handheld, most PC monitors |
| x8 | 2560 x 1440 | — |
| x12 | 3840 x 2160 | — |

Rationale: integer scaling on every target so scrolling tiles never shimmer; 16px tiles keep GBA tile density; five extra columns show more route before the player commits.

### 2.3 Rendering rules

- The camera **snaps to whole native pixels**. Sub-pixel motion exists only in game logic.
- **Nearest-neighbour scaling only.** CRT and LCD filters ship as options, **off by default**.
- **Never stretch. Never crop the HUD** (applies especially to the 16:10 variant).
- Two things draw on the 640 x 360 overlay instead of the art layer: **Large Text mode** and **all Japanese text**. The art layer stays 320 x 180.
- Screenshots save at **native size and at x4**.
- **Path view** (section 6) puts collision data on screen.

---

## 3. Palette approach

### 3.1 Master palette

- Base: **Sweetie 16 by GrafxKid** plus **five extras** = **21 keys**.
- Extras: **m** comet magenta, **c** skin light, **h** skin shade, **u** umber, **a** tan.
- **Confirm credit and licence terms before ship.**

### 3.2 Palette key letters as used in the source

The pitch refers to colours by single-letter keys. **Hex values are not given in the source.** The table lists each letter and every role the source assigns it.

| Key | Source | Roles stated in the source |
| --- | --- | --- |
| **k** | Sweetie 16 | Outline key for creatures and characters. Never shades skin. 1px base line on blocking trees/bushes and cliffs. Outline of Heartmark plus on light body areas. High-contrast panels go to k. |
| **n** | Sweetie 16 | UI panel fill. Night remap target for t. Mooring uniforms. |
| **v** | Sweetie 16 | 1px panel border. Secondary text. "Read" (known-from-earlier) readout fields. Fog bands (with w). Mooring uniforms. |
| **w** | Sweetie 16 | Primary text. Heartmark highlight on cool bodies. "Confirmed" readout fields (with check glyph). Interactable glint (1px). Ledge lip (alt). Fog bands. Ward lattice lines (with i). Errant intro streak. Hit-flash outline. Send-out light. Waystone autosave glyph. Lantern pool (with y). |
| **g** | Sweetie 16 | Confirm / safe actions. Night remaps g to t. Canopy-green extras sit between g and t. |
| **t** | Sweetie 16 | Night remap of g; itself remaps to n at night. |
| **e** | Sweetie 16 | Disabled UI. EMPTY moves. 1px wall rim outside the darkness light radius. |
| **o** | Sweetie 16 | Warnings. Low PP (<=25%). EVA stage marker. Foe level 10+ above. Zero revival items in header. Scatter faction shapes. |
| **r** | Sweetie 16 | Danger / failure. "Not saved" banner. Scatter faction shapes. |
| **y** | Sweetie 16 | Unique-item frame. Heartmark highlight on warm bodies. Ledge lip. High-contrast Path-view outlines. Lantern glow start. Lantern pool (with w). |
| **i** | Sweetie 16 | Read (scouting) effects (with w). Rain streaks (with s). Errant platform dust ring. Ward lattice (with w). Mooring uniforms. Counts as a light body area. |
| **s** | Sweetie 16 | Rain streaks (with i). |
| **d** | Sweetie 16 | Mooring uniforms. |
| **p** | Sweetie 16 | Scatter faction shapes (with o, r). |
| **l** | Sweetie 16 | Counts as a light body area. |
| **m** | Extra | **Comet magenta. Reserved** (see 3.3). |
| **c** | Extra | Skin light. Counts as a light body area. |
| **h** | Extra | Skin shade. |
| **u** | Extra | Umber; deep skin tones. Wet-sand extras sit between a and u. |
| **a** | Extra | Tan. Counts as a light body area. Wet-sand extras sit between a and u. |

Light body areas (where the Heartmark plus gets a k outline and loses corner glints): **w, c, y, i, l, a**.

Letters not referenced in this section: one Sweetie 16 key is never named in the section (15 of the 16 base letters appear above).

### 3.3 Proposed default hex mapping [not in source; art lead to confirm]

The pitch does not bind letters to hex values. For a working build, engineers need a mapping. Sweetie 16's published values are listed with the letter each one most plausibly matches given the source's usage (k = black outline, w = near-white text, g→t→n is the night remap chain). **Treat as a placeholder, not a decision.**

| Key | Proposed hex | Sweetie 16 slot |
| --- | --- | --- |
| k | `#1a1c2c` | black |
| p | `#5d275d` | purple |
| r | `#b13e53` | red |
| o | `#ef7d57` | orange |
| y | `#ffcd75` | yellow |
| l | `#a7f070` | light green |
| g | `#38b764` | green |
| t | `#257179` | teal |
| n | `#29366f` | dark blue |
| (b) | `#3b5dc9` | blue — letter not used in this section |
| s | `#41a6f6` | sky blue |
| i | `#73eff7` | cyan / ice |
| w | `#f4f4f4` | white |
| v | `#94b0c2` | light grey |
| e | `#566c86` | grey |
| d | `#333c57` | dark grey |
| m | *(define)* | extra — comet magenta; must read unmistakably as magenta vs. p |
| c | *(define)* | extra — skin light |
| h | *(define)* | extra — skin shade |
| u | *(define)* | extra — umber |
| a | *(define)* | extra — tan |

### 3.4 Who uses which keys

| Asset class | Allowed colours |
| --- | --- |
| Creatures, trainers, overworld people, icons, every UI panel | **Master keys only. No exceptions.** |
| Environments (tiles) | Biome sub-palette: master keys + up to **6 biome extras**, cap **24 colours** per biome (est.) |
| Heartmark, skyglass, Shift effects, Forecast panel | The only places **m** appears |

### 3.5 m is reserved

- **m appears only on:** Heartmarks, skyglass, Shift effects, the Forecast panel.
- **m never appears on:** uniforms, bags, UI icons, item icons, terrain tiles, creature body colours.
- When the player sees m, it means the comet.
- The Scatter faction hauls skyglass, so m shows up near its members **on the skyglass only**, never on uniforms.
- **Read effects use i and w.** Read is scouting; scouting never borrows the comet's colour.
- Errant battle intros use **no m**.

### 3.6 Skin

- Light: **c**. Shade: **h**. Deep tones: **u**.
- **k never shades skin** — at 16px a k shade merges the face into the outline.
- The palette has **no deep skin ramp below u**. A deep skin extra is an **open item** for the next palette revision.

### 3.7 Creature ramps

- Cap: **8 keys per form including its k outline**, plus **m and the highlight** for the Heartmark (est.).
- The six 32x32 concept sprites use 9 to 12 keys in total, so either final redraws trim ramps or the cap rises. **The art lead decides after a test sheet.**

### 3.8 Environment sub-palettes

Each biome: up to 24 colours (est.) = master keys + up to 6 biome extras. Rules for extras:

1. Each extra sits **between two master keys in hue and value**. Examples: a canopy green between **g** and **t** (deep forest); a wet sand between **a** and **u** (beaches).
2. **No extra may read as magenta.** The art lead checks each one in a side-by-side swatch against m.
3. **Extras never appear on sprites or UI.**

### 3.9 Lighting by palette remap

- Time of day and weather use **lookup tables** that remap each biome sub-palette to darker/cooler keys **from the same set**. Example (night): **g → t, t → n**.
- Remaps keep edges crisp and contrast predictable.
- **No multiply. No black overlays.**
- Each biome has **four palette sets: dawn, day, dusk, night.**

### 3.10 What never remaps

**Heartmarks, skyglass, the HUD and the cursor** keep full colour at night, in caves and in storms.

### 3.11 UI colour roles

| Role | Key |
| --- | --- |
| Panel fill | **n** with a **1px v border** |
| Primary text | **w** |
| Secondary text | **v** |
| Confirm / safe actions | **g** |
| Warnings | **o** |
| Danger / failure | **r** |
| Disabled | **e** |
| Unique items | **y frame** |
| High-contrast mode panels | **k** with **w** text |

**Every colour role pairs with a glyph or a word** (see section 15).

---

## 4. Heartmark drawing spec

The Heartmark carries the theme on screen: **identity persists through change.** It is a small **four-point sparkle** drawn in **m** with a highlight: **w on cool-coloured bodies, y on warm ones.**

Grid key: `m` = comet magenta, `*` = highlight (w or y), `.` = the creature's body.

### 4.1 3px mark — a plus

Used on: 32x32 mini portraits and concept sprites, 24x24 party icons, 16x16 and 32x32 followers.

```
.m.
m*m
.m.
```

### 4.2 5px mark — a plus with diagonal glints

Used on: 64x64 battle sprites and 96x96 legendaries. The four corner glints are highlight pixels, so the m shape itself stays a clean four-point sparkle.

```
*.m.*
..m..
mm*mm
..m..
*.m.*
```

**Light-body variant:** on a light body area (**w, c, y, i, l, a**), **outline the plus in k and drop the corner glints.**

### 4.3 Placement rules

| Rule | Detail |
| --- | --- |
| Spot belongs to the individual | The mark stays in the **same relative place through every form**. |
| Anchor regions | Each form's sprite sheet records **four anchor regions — head, chest, back, tail — as pixel coordinates on the front and back sprites** (est. 8 coordinates per form). The individual's region carries across every Shift. If a form lacks that region, its sheet names the nearest equivalent. |
| Starter example | Sloshkin: forehead. Skeinwing (same creature after a Shift): head. Prismoth: thorax. |
| Where a bonded creature shows it | Front sprite, back sprite, mini portrait, party icon, overworld follower. |
| Wild creatures | **Show none.** Every creature born since the Starfall has a faint mark that lights in m only once bonded. |
| Trainer-owned foes | Bonded, so foes in trainer battles **show theirs**. |
| Shape | **Never varies between creatures.** Players tell creatures apart by nickname, Heartmark technique and form. |
| Where it does NOT appear | Info boxes carry **no Heartmark icon** (the mark is already on the sprite; UI icons never use m). |
| Skyglass disambiguation | Skyglass is drawn as **irregular faceted shards with five or more sides**. It never uses a plus or a four-point star. The **Star type badge also avoids the four-point sparkle.** |
| IP guardrail | **No crystal or skyglass overlay ever sits on a creature.** The Heartmark is the only comet mark a creature carries. Vagary's crystal head belongs to its body design and is exempt. |

### 4.4 Why it matters (run context)

MUDDY went Mudkip → Swampert (skipping Marshtomp) → Machop → Wynaut → Ludicolo → Altaria → Gardevoir: seven forms, one nickname. Moves carried (as a Wynaut, MUDDY kept Fly and Zap Cannon). EXP carried but was re-read on the new species' curve, so an evolution could cost levels (Lv30 Altaria → Lv27 Gardevoir). Nothing on the sprite said this was the same creature. The Heartmark puts that thread in every frame.

---

## 5. Sprite scales (single source)

**This table is the single source for sprite sizes and frame counts.** Every other section, including production's art budget, uses these numbers. All sizes are native pixels. **No sprite ever scales by a non-integer factor. If we need a new size, we draw it.**

**Concept art vs final.** The pitch's drawn creature sprites (Sloshkin, Skeinwing, Scrapling, Prismoth, Vesperay, Vagary) are **32x32 concept art**. Their looks are fixed; final sprites redraw them at the sizes below. The pitch's **32x48 trainer art** is concept art too.

| Asset | Final size | Frames (est.) | Notes |
| --- | --- | --- | --- |
| Creature battle sprite | **64x64** | 8 per form: front and back, each 2 idle, 1 attack, 1 hit | Big forms fill the cell edge to edge. |
| Large legendaries (Vagary and the larger Errants) | **96x96** | 8, same split | The only sprites that break the 64x64 cell. |
| Mini portrait | **32x32** | 1 per form | Hand-drawn for Forecast cards, the Shiftlog and the Field Log. **Never a downscale of the 64x64.** |
| Party icon | **24x24** | 2 (bounce) | Carries the 3px Heartmark. |
| Overworld follower | **16x16** small, **32x32** large | 8: 4 directions x 2 | Carries the 3px Heartmark. |
| Trainer battle sprite | **64x64** full body | 1 intro pose; +1 defeat pose for Spire leaders, Summit Keepers, the Champion and Linnet | |
| Dialogue portrait | **48x48** bust | 4 expressions; 6 for the main cast | |
| Overworld people | **16x24** | Player: 4 directions x (4 walk + 4 run) = **32**. NPCs: 4 directions x 4 walk = **16** | Bottom 16 rows stand on the tile grid; the head rises half a tile above. |
| Tiles | **16x16 metatiles** from **8x8 subtiles** | Animated tiles: 3 to 4 | Tall props (trees, buildings, signs) draw their upper half on a layer above actors. |
| Item icons | **16x16** | 1 | |
| Type and status badges | **20x9** | 1 | Glyph plus 3-letter code in a **3x5 badge font**. The 5x7 text font is too wide to fit both in 20px. |
| Key stills | **320x180**; panning stills up to **400x180** | 1 each; 8 to 10 total | See section 14. |
| Text | **8px line, 5x7 glyphs** | | Large Text and Japanese use the 640x360 overlay. |

### 5.1 Per-form budget (est.)

8 battle frames + 1 mini portrait + 2 party frames + 8 follower frames + Heartmark anchor coordinates ≈ **19 frames per form.**

- Production sizes the roster and art schedule against this number.
- Production owns the throughput assumption (frames per artist per week) and names an owner for trainers, portraits and stills.
- **Any form can end up in the player's party after a Shift, so every form needs the full set.**

### 5.2 Scale check

At 320x180 a 64x64 sprite fills **36%** of screen height. GBA 64x64 battle sprites filled **40%** of a 160px screen. Battles keep roughly the weight they had in the run.

---

## 6. Tile readability rules

Run moments behind these: bushy tiles near Mauville looked like tall grass and were trees; Fortree's rotating gates; the Mossdeep switch puzzle (reset on exit); the Sootopolis ice floor (third layout differed in the hack); Seafloor boulders.

| Rule | Specification |
| --- | --- |
| **Grass vs trees** | Encounter grass **always shows ground between its tufts and never has a trunk**; it **rustles when anything steps in**. Blocking trees/bushes **always show a trunk or base, a 1px k line on the lower edge, and a cast shadow to the bottom right**. Artist rule: **if it blocks, it has a base. If it has no base, you can walk into it.** |
| **Encounter tiles** | Every tile that can start an encounter shares one reaction: **it moves when stepped in**. Decorative tiles may idle-animate but **never react to steps**. |
| **Ledges** | One-way ledges show a **light lip (y or w top edge)**, a **2px shadow below**, and a **chevron notch every other tile**. Ledges **never share a colour with walls**. |
| **Walls and cliffs** | Cliff faces are **at least 8px tall with a k base line**. Walkable cliff tops use the **same ground texture as walkable floor elsewhere**. |
| **Interactables** | Signs, switches, items, gates, boulders show a **1px w glint every 2 s** (est.) when the player is **within 3 tiles** (est.). When the player is adjacent and facing one, an **A prompt appears above it**. |
| **Puzzle state** | Switches show state by **shape (raised/pressed) and colour**. Rotating gates show their **pivot and an arrow on each arm**. Ice shows a **fading slide trail**. Boulders show a **push arrow when the player leans on them**. A solved puzzle **lights a marker at its entrance and stays solved**. |
| **Path view** | One button toggles an overlay: **dotted grid on walkable tiles, arrows on ledges, outlines on warps, dot pattern on encounter tiles**. (High-contrast mode: outlines in y.) |
| **Bump feedback** | Walking into a blocking tile plays a **short squash and a soft thud** (6 f squash, see section 13). |

---

## 7. Weather, fog, darkness and lighting

**The rule:** weather and darkness change mood and can change mechanics. **They never hide the walkable map.** (Run: steam fog in Lavaridge Gym and permanent rain after Kyogre each broke the map locator; dark areas needed an auto-explorer or Flash.)

### 7.1 Layer order (bottom to top)

1. Ground
2. Ground props
3. Actors
4. Upper halves of tall props
5. Weather
6. UI

Weather **never draws over the UI** and **never draws at full opacity over ground**.

### 7.2 Ground contrast floor

In every weather and light state, contrast between a walkable tile and a blocking tile stays at **3:1 or higher** (est.; tune in playtests). **The tech artist builds an automated check** that captures each map in each state and flags failures.

### 7.3 Weather types

| Weather | Specification |
| --- | --- |
| **Fog** | Drifting bands in **v and w** at **25–40% coverage** (est.), drawn **above tall props**. Ground within **4 tiles** of the player (est.) stays clear. Farther tiles drop **one palette step** and stay visible. |
| **Rain** | **1x4 px streaks in s and i**, **under 20% screen coverage** (est.). **Puddle ripples appear only on walkable tiles**, so rain doubles as a hint. Storms darken by **one palette remap step**. |
| **Heat** | A **one-step warm remap** and a **2-frame heat shimmer on distant props only**. The ground does not shimmer. |
| **Darkness** | Light radius of **at least 3 tiles** (est.) around the player, edged with a **2-step dither ring**. Outside the radius, **walls keep a 1px e rim** so the room's shape stays readable. Light items widen the radius. **The floor next to the player is always visible.** |
| **Snow and ash** | Same rule as rain: sparse particles, clear ground. |

### 7.4 Lighting model

- Light comes from the **top left** on every sprite and tile.
- Each biome has **four palette sets: dawn, day, dusk, night**.
- Lamps, fires and skyglass use **hand-drawn glow sprites with 2-step dither**, placed by the level designer. **No soft gradients.**
- **Skyglass glows in m and pulses once per second** (est.). The pulse also marks it as a point of interest.

### 7.5 Reduced motion

Stops particle movement and keeps the palette change, so the weather state still reads.

---

## 8. Battle HUD and move menu

### 8.1 Layout at 320x180

| Element | Position |
| --- | --- |
| Foe platform | Upper right |
| Player platform | Lower left |
| Foe info box | Top left |
| Player info box | Right, above the command panel |
| Command panel | Along the bottom, **48px tall** (est.) |

### 8.2 Info boxes

Show: **nickname, level, type badges, status badge, the Ward badge when shown, HP, and a row of Mends pips.** No Heartmark icon (the mark is on the sprite).

| Field | Player side | Foe side |
| --- | --- | --- |
| **HP** | Bar **plus numbers, always** | Bar alone; **bar plus a percentage once Read** |
| **Mends** | **3 pips per creature per battle**; each recovery move spends one (gameplay defines which count). Always shown. | Pips show **once the player holds the Scouting Prism**. Before that the row reads **Mends ?** |
| **Evasion** | Stage marker **EVA +1** or **EVA +2** (the cap), in **o**. After a **Plumbline** hit, the target's box shows a **lock glyph and a 2-turn count** while it cannot re-boost. | Same |
| **Level gap** | — | Foe level turns **o with an up-arrow glyph** when the foe is **10 or more levels above** your active creature (threshold est.). |

Run context: Seadra beat Wallace's Latias at 11 HP, so close calls need exact numbers. Latias stacked Double Team with Recover/Protect across League runs 4–6; Haze was tried once (run 5) and boosts came straight back. Final MUDDY was Lv27 vs Wallace's Lv55–58.

### 8.3 Command menu

- Opens on **Fight** every turn, for each creature. (Run: in doubles, the action cursor remembered each creature's last slot and MUDDY's sat on BAG.)

### 8.4 Move menu

Four moves in a **2x2 grid**. Each shows:

- **Name and type badge.**
- **PP as numbers**, e.g. `PP 12/15`. The number turns **o at 25% or less** (est.).
- **Effectiveness word** against the current target once its types are Read: **Strong**, **Neutral**, **Weak**, **No effect**, or **Blocked by Ward**. Before a Read it shows **?**. (The middle word is *Neutral* because *Plain* is a type name.) Hollow is immune to Plain and Grit, so a Read target lets a Plain/Grit attacker see **No effect** before spending the turn.
- Qualifying anti-Ward techniques get a **small open-hex icon** (section 9.4).

### 8.5 Empty moves and locked actions

- At **0 PP** a move turns **e**, shows **EMPTY with a strike glyph**, and **the cursor skips it**. The player cannot select it.
- When all four are empty, the panel shows **Scrap** in their place under its own label.
- In trainer battles, **RUN shows greyed with a lock glyph**.
- Run context: 5 hard freezes; three followed selecting a move at 0 PP. Gameplay removes the code path; the HUD makes the state obvious.

### 8.6 PP and supplies across a gauntlet

- The **party screen shows total PP left per creature as a bar**.
- Between Summit fights, the party screen header also lists **revival and full-heal items left, in o at zero**.
- Ethers are stocked at every Shelter from badge 3.

---

## 9. Scouting readout and Ward tells

**Read** is available from the start. Gameplay sets what a Read costs and how deep it goes per dial; **the layout stays the same either way.**

### 9.1 Before a trainer battle

- A compact **party-pip strip** slides in under the trainer: **one pip per foe creature**, **filled** if that species is Read in the Field Log, **empty** if not.
- **One button opens the full Read card.**
- When every creature on the roster is already Read in the Field Log, **the card is skipped**.

### 9.2 In battle

Read opens a **panel over the foe info box**.

| Tier | Fields shown |
| --- | --- |
| Base Read | Types; ability name with a one-line effect |
| With the Scouting Prism | Known moves, held item, Mends pips |

### 9.3 Field states (every field, always)

| State | Display |
| --- | --- |
| **Unknown** | `???` |
| **Read** (from a Read or an earlier fight) | Drawn in **v** |
| **Confirmed** (seen in this battle) | Drawn in **w** with a **check glyph** |

**A field is never blank. A blank is never a pass.**

### 9.4 Ward tell (this section owns it; gameplay uses it as written)

Wards come from the run's Wonder Guard problem (about ten foes logged).

| Event / dial | Visual + audio |
| --- | --- |
| **Send-in** (any dial) | Plays the **Ward shimmer** and a **glass ping**. The shimmer replays **about every 4 s** for the rest of the battle. |
| **Drift and Flux**, from send-in | Info box shows a **hex badge reading `Ward ?`**. |
| **Freefall** | **The badge appears only after the first blocked hit.** Shimmer and ping still play, so Freefall keeps one warning. |
| **After a blocked hit** (any dial) | Badge reads **`Ward: known`**. The readout **lists which of the party's techniques can land, by creature and technique name**. Indirect damage that works is listed too (e.g., trap damage). |
| Move menu / party screen | Qualifying techniques get a **small open-hex icon** so a switch target is obvious. |
| Read on Drift/Flux | A Read that reveals a Ward ability shows **its full rule before any hit lands**. Whether a Freefall Read can reveal a Ward before the first block is a **gameplay call**. |
| Crackdust | If the player carries Crackdust, the readout **shows the count**. |

Shimmer animation spec: section 13 (Ward shimmer, 48 f loop).

---

## 10. Shift Forecast panel

A Shift opens the Forecast panel **outside battle**. The player's creatures **never Shift in battle**. Deferred Shifts open together at the next **Waystone**, one panel at a time with a counter (`1 of 3`). **There is no timer and no button timing.**

### 10.1 Mockup (public-safe: starter Sloshkin, nickname PUDDLE, Drift base odds, Bond 0; bracketed numbers = what the player holds)

```
+------------------------------------------------------------+
| SHIFT FORECAST       PUDDLE  Sloshkin  Lv18     1 of 1     |
| [now]   Preset: none   Drift, Bond 0                       |
|------------------------------------------------------------|
| UP                 | SIDE              | DOWN              |
| [Skeinwing]        | [Rushling]        | [Puddlepip]       |
| BRN GST            | MOS BRN           | BRN               |
| 50%  #####         | 40%  ####         | 10%  #            |
| HP+  DF+           | SP+  AT-          | stage down  v     |
|------------------------------------------------------------|
| KEEPS: Lv, EXP, held item, nickname, Bond,                 |
|        trained stats, Heartmark technique (Undertow)       |
| > ACCEPT    REROLL 1 Starsalt (3)    ANCHOR 1 stone (2)    |
+------------------------------------------------------------+
```

### 10.2 Panel rules

| Rule | Detail |
| --- | --- |
| **Exactly three cards** | Up, Side, Down, left to right, drawn from the family pool. The creatures section's tables are the hidden pool weights. **No hidden fourth outcome.** |
| Header | Top left: the current form's **32x32 mini portrait with its Heartmark**; nickname, form name, level; counter (`n of N`). Second line: `[now]`, preset, dial and Bond. |
| Each card | Mini portrait, form name, **type badges**, **odds as a number and a bar**, **stat arrows**. |
| **Silhouettes on Freefall only** | On Freefall, a card whose form the player has never seen shows an **m-outlined silhouette with `???` for name and types**. Its **odds still show**. On Drift and Flux every card shows in full. |
| **Down is visible** | The Down card shows the risk before the roll. (Run: a Lv34 Rayquaza became a Trapinch with no warning.) |
| **KEEPS row** | Lists what a Shift never touches: **level, EXP, held item, nickname, Bond, trained stat points, the Heartmark technique**. |
| **Accept** | Holds the **default cursor**. The panel **ignores any button held from before it opened and all input for its first 0.5 s** (est.). The lock never asks the player to press anything in time. |
| **Reroll** | Shows its **Starsalt cost (1, then 2, then 4 within one Shift)** next to what the player holds. |
| **Anchor** | Shows its cost, **one anchor stone**, next to what the player holds. With no stones it **greys out and reads `No anchor stones`**. On Anchor, the **Heartmark glints once and the panel closes**. |
| **Presets** | A creature's preset (**none**, **auto-Anchor**, **auto-accept Up**) shows under the portrait. When a preset resolves a Shift, **a toast names the creature and the outcome**. |
| Odds | **Number plus bar length. Never colour alone.** |
| After Accept | The **card reveal** plays, then the **Shift scramble** (section 13). |
| Frequency | Gameplay target: **at most about 1 Forecast per 30 minutes** of play. The panel is built to be read slowly; that only works if it stays rare. |

### 10.3 Boss Shifts

Named boss trainers may run **scripted Shifts** on their own creatures. Each gets a **posted Forecast**: a **read-only three-card strip over the foe info box**, shown **the turn before the Shift resolves** (est.). Then the **scramble plays on the foe sprite**.

### 10.4 Shiftlog

A **per-creature timeline of every form it has held**, with the **Heartmark in the same place on each portrait** and the **level beside each form**. MUDDY's seven forms are the internal template screen; **public mockups use PUDDLE**. (Run: Wailmer → Seadra at Lv40, carried the final League run at Lv75.)

### 10.5 How a Shift reads differently from anything in Pokémon

It is **permanent, driven by growth, and forecast before it happens**. The art says so too: **the scramble resolves outward from the Heartmark and never uses a glowing white silhouette.**

---

## 11. Field UI and menus

| Feature | Rule |
| --- | --- |
| **Fixed menu slots** | Pause menu entries **never move**. New entries **append at the bottom**. (Run: adding the PokeNav shifted the SAVE slot; saves failed silently.) |
| **Save feedback** | Every manual save ends with a **toast: `Saved 14:02, verified`** with a **check glyph**. A failed save shows an **r banner reading `Not saved`** with an **X glyph**, and it **stays until dismissed**. Waystone autosaves show a **small Waystone glyph in w** in the corner while they write. |
| **One-of-a-kind items** | Sit in a **y frame** in the bag. Using one opens a confirm **with the cursor on No**: `Use [item]? You have only one.` **Each pocket opens at the top** (never remembers the last cursor slot). |
| **Technique disc shop** | Each row shows **technique name, type badge, power, and a strip of party icons** — **lit** if they can learn it, **crossed** if they cannot. |
| **Funds** | Shops show glint left after each purchase (`After: 1,200`). The badge screen shows the **Summit Purse** deposit (**1,500 glint at every badge from badge 5**). |
| **Item effects** | Pickups and bag entries show the **icon plus a one-line effect**. |
| **Field Log** | Each entry shows its state as a **glyph plus a word: Seen, Read or Held**. Never colour alone. |
| **Achievement banners** | Slide in at the top for **3 s** (est.), **never take input**, **never darken the map**. **No menu blanks the map.** |
| **Rematches** | **No rematch calls.** Rematches sit on each **Shelter's Rematch board**, so nothing interrupts walking. |
| **Travel prompts** | Ferry/travel NPCs show a **destination card with a map thumbnail**. When the destination is the place the player just left, **the cursor starts on No**. |

---

## 12. Battle presentation

| Element | Specification |
| --- | --- |
| **Staging** | Fixed **3/4 side view** on **two biome-matched platforms**, GBA-style. Camera **nudges 2px toward the attacker** (est.) and **shakes on heavy hits**. **Reduced motion disables both.** |
| **Trainer intro** | The 64x64 trainer sprite **slides in over 40 frames** (est.). |
| **Wild intro** | **Grass-swipe transition.** |
| **Errant intro** | A **1px w streak crosses the screen over 30 frames** (est.); the Errant's platform shows a **pale ring of i dust**. **No m.** Staged as an event. |
| **Hit feedback** | **No damage numbers by default.** Hit-stop scales with effectiveness: **No effect 0 f, Weak 2 f, Neutral 4 f, Strong 6 f, Critical 8 f + a 2-frame w outline flash** on the target (est.). The **effectiveness word sits under the HP bar for 45 frames** (est.). Crits must read as crits. |
| **Ability callouts** | When an ability triggers, a **badge with the ability name pops over the creature's info box for 60 frames** (est.). |
| **Doubles targeting** | Each turn the cursor starts on the **default target: the foe your chosen move hits hardest, ties going left**. The chosen target gets an **arrow above its sprite and a lit name box**, and the panel names it in text (`Target: left foe`). **Open question for gameplay:** if "hits hardest" uses types the player has not Read, the default leaks them. |
| **Catch support** | In wild battles the player's info box shows a **`Stance` tag while Capture Stance is on**. With Stance off, moves that could KO a catch target from its current HP carry a **`May KO` tag**. The **Lantern menu shows capture odds as a number and a bar** before a Lantern is spent (gameplay sets format per dial). One-of-a-kind items need a confirm. |
| **Battle speed** | **1x, 2x or 4x** animation speed, set in options and **toggled with one button mid-battle**. **Text speed is separate.** |

---

## 13. Animation list

**60 fps; f = frames. All counts are estimates for the animator to tune.**

### 13.1 Shift pixel-scramble — 90 f (1.5 s)

Plays after the Forecast for the player's creatures, and in battle only for scripted boss Shifts.

| Phase | Frames | Description |
| --- | --- | --- |
| Charge | 18 f | A **1px m outline pulses twice**. The Heartmark glints. |
| Scramble | 36 f | The sprite **splits into 4x4 blocks that swap places in 6 steps of 6 f**. Each step **recolours a third of the blocks to m, w, or a key from the new form**. |
| Resolve | 24 f | Blocks settle into the new silhouette in **4 rings of 6 f, starting at the Heartmark and moving outward**. |
| Reveal | 12 f | A **2 f w outline flash on the sprite only**, then the new idle and a Heartmark glint. |
| Reduced motion | 20 f | **Ordered-dither crossfade** plus the glint. |

### 13.2 Forecast card reveal — 90 f

| Phase | Frames |
| --- | --- |
| Three cards turn face down | 12 f |
| Cards slide past each other twice | 60 f |
| One turns face up | 18 f |

After the first viewing, **one button skips to the turn-up**. Reduced motion: **the chosen card lights and the other two dim, 20 f.**

### 13.3 Ward shimmer — 48 f loop

- A **lattice of 1px w and i hex lines sweeps diagonally across the sprite in 6 frames of 8 f**.
- Plays on **send-in**, then **about every 4 s**.
- **Blocked hit:** a **12 f flare**, the lattice goes **full w**, and **`Blocked by Ward`** text shows.
- On Freefall the lattice still plays before the badge exists.
- **Reduced motion:** a **static lattice on the badge**. On Freefall before the first blocked hit, a **static lattice shows on the sprite for 48 f with the ping**, so the one warning survives.

### 13.4 Heartmark glint — 30 f

- **6 steps of 5 f.** The highlight steps out to each arm tip in turn, **clockwise from the top (4 steps)**, then the **corner glints blink (1 step)**, then the **mark rests (1 step)**.
- The **3px mark blinks its centre highlight instead**.
- Plays on: **send-out, level up, Shift, Anchor, Heartmark technique use**.

### 13.5 Faint — 40 f

- **2 f hit flash.**
- The sprite **sinks out of view behind the platform edge in 8px steps over 24 f** while its **ramp steps one shade darker**.
- The **Heartmark stays on the platform for 14 f after the body is gone, then fades**.

### 13.6 Send-out: light-to-form unfold — 24 f

| Phase | Frames | Description |
| --- | --- | --- |
| Lift | 6 f | The trainer raises the Lantern. Its glow **steps up from y to w**. |
| Unfold | 12 f | A **folded square of w light drops to the platform and opens in 3 steps of 4 f: square → strip → the creature's outline**, like paper unfolding. |
| Settle | 6 f | **Colour fills the outline in 2 rings from the Heartmark outward**, then the Heartmark glints. |
| Recall | 12 f | The unfold in reverse; the light returns to the Lantern. |
| Reduced motion | 12 f | Dither fade. |

### 13.7 Lantern capture — about 1.9 s on success

**No throw arc, no wobble, no click.**

| Phase | Frames | Description |
| --- | --- | --- |
| Raise | 12 f | The trainer raises the Lantern. A **pool of y and w light spreads across the foe's platform in 3 dither steps**. |
| Draw-in | 24 f | The creature **drifts toward the light** while its **ramp steps two shades toward w**. |
| Glow meter | up to 60 f | A **3-segment meter under the foe info box fills in one smooth sweep to the rolled result**. **No pause between segments, no shake, no per-segment sound.** |
| Success | 18 f | The meter completes, the creature **folds into light (send-out unfold in reverse)**, the light returns into the Lantern. |
| Failure | 12 f | The meter **stops where the roll landed**, the light **gutters out in 2 dither steps**, the creature steps back to its spot. |
| Reduced motion | — | Meter fill only, with a dither fade on the creature. |

**The capture flow and the visible-odds UI go through the pre-production patent clearance review before any of this is animated.**

### 13.8 Overworld

| Animation | Spec |
| --- | --- |
| Walk | 4-frame cycle per direction, **16 f per tile** |
| Run | Separate 4-frame cycle, **8 f per tile** |
| Surf | 2-frame bob at **15 f per frame**, **8 f per tile**, plus a **2-frame wake** |
| Ledge hop | **16 f arc, 8px peak**, shadow on the ground |
| Bump | **6 f squash** plus a thud |
| Grass rustle | **3 frames of 4 f** |

---

## 14. Cutscene approach

| Rule | Detail |
| --- | --- |
| **In-engine only** | Cutscenes use the game's own sprites, tiles and portraits. **No pre-rendered video, no second art style.** A script change costs a scene edit instead of a re-render. |
| **Letterbox** | **16px bars top and bottom** (est.) signal a cutscene is playing and input is paused. |
| **Portraits** | **48x48 busts** beside the text box. **4 expressions** for most speakers, **6 for the main cast** (est.). |
| **Key stills** | Big beats get one **full-screen pixel illustration**. Most are **320x180**. Panning stills are drawn up to **400x180** (est.) and **pan 1px every 4 frames** (off in reduced motion). Budget: **8 to 10 stills** (est.). **Still one:** the Vagary breaking over the Brindle Isles. **Finale still:** the Heartshard riding the returning Vagary, seen from a sea stack. **No still shows a descent into a central crater (IP guardrail).** |
| **Length and skipping** | **Under 90 s per scene** (est.). **Every scene is skippable after the first viewing.** Skipping shows a **one-line recap card**. |
| **One visual language for the comet** | Shifts in cutscenes use the **same scramble** as battles. **m means the comet everywhere.** |
| **Where to go next** | When a beat sends the player elsewhere, a **destination card pins the place on the region map**. Route order belongs to the story section. |

### 14.1 Factions read apart at a glance (must work in grayscale)

| Faction | Leader | Shape language | Colours | Motifs |
| --- | --- | --- | --- | --- |
| **The Mooring** | Provost Agathe Merrow | **Straight lines, symmetric** uniforms; props that look **pinned in place** | **n, v, d, i** | **Anchor and chain** |
| **The Scatter** | Teo Varga | **Broken, asymmetric** shapes | **o, r, p** | **Skyglass (m) rides in crates and on their boats.** m never appears on their uniforms. **Nobody wears a device that triggers Shifts.** |

---

## 15. Accessibility

Status: Proposed. Not tested with players.

### 15.1 Colour-blind safe type icons

Each type badge pairs a colour with a **unique glyph** and a **3-letter code**. Proposed codes (labels only; the creatures section owns the chart):

| Type | Code |
| --- | --- |
| Plain | **PLN** |
| Grit | **GRT** |
| Brine | **BRN** |
| Kiln | **KLN** |
| Moss | **MOS** |
| Bolt | **BLT** |
| Rime | **RIM** |
| Gust | **GST** |
| Stone | **STN** |
| Rust | **RST** |
| Glass | **GLS** |
| Hollow | **HLW** |
| Star | **STR** |

- The art lead checks **every badge, status icon and bar under deuteranopia, protanopia and tritanopia simulation** before sign-off.
- **No information lives in colour alone:** effectiveness uses words; odds use numbers and bar length; PP uses numbers and the EMPTY label; Ward state uses badge shape; Mends use pip count.

### 15.2 Text speed

- **Slow, Normal, Fast, Instant.** Hold a button to fast-forward. **Auto-advance off by default.**
- A **message log keeps the last 100 lines** (est.) of dialogue and battle text.

### 15.3 Reduced motion (one toggle)

Swaps the Shift scramble for a dither crossfade; removes screen shake and pans; stops weather particle motion; stills the Ward shimmer; cuts the Lantern capture to its meter. **Flashes stay at or under 3 per second in every mode (WCAG 2.3.1). No full-screen white flash exists anywhere in the game.**

### 15.4 Font

- **Custom pixel font, 8px line height, 5x7 glyphs**, with distinct **I / l / 1**, **0 / O**, **5 / S**.
- **Large Text** draws text at **double size on the 640x360 overlay** (each 5x7 glyph at 4x overlay pixels), so line pitch goes from **8 to 16 art pixels** and text boxes show **half as many lines per page** (est.).
- On a 7-inch 720p screen at x4, a 7px capital measures about **3.4 mm** (est.; verify on device).
- An optional **high-legibility vector font** for the overlay sits at Ideas/Feedback.
- Badge font: **3x5** (section 5).

### 15.5 Japanese text

- Kanji cannot fit 5x7, so **all Japanese text renders on the 640x360 overlay with a ~12px pixel font**.
- 12px glyph + 4px leading = **16px overlay line** = same pitch as an 8px English line on the art layer, so text boxes keep their line count (est.).
- Japanese Large Text: **24px glyph on a 32px overlay line**, half as many lines per page.
- Pre-production checks every text box in both languages and both sizes against the real script. Production budgets font licensing. Kanji coverage list comes from the final script.

### 15.6 High contrast mode

Panels go to **k with w text**. **Path view outlines switch to y.**

### 15.7 Cue pairs

Every important visual cue has a sound partner and vice versa.

| Visual | Sound |
| --- | --- |
| Ward shimmer | Glass ping (glassy two-tone) |
| EMPTY move | Thud (cursor stays put) |
| Verified save | Chime (two rising notes) |
| Failed save (banner) | Buzz (low) |
| Lantern meter | Rising hum |

### 15.8 No timed inputs

- The Forecast panel has **no timer**. **No animation in the game asks for a button press inside a window.**
- The Forecast ignores buttons held from before it opened and all input for its **first 0.5 s** (est.). That lock never asks for a press in time.

### 15.9 Input

**Full button remapping. Every menu works with a d-pad and two buttons.**

---

## 16. Audio direction (not run-grounded)

The run's capture was muted, so nothing here comes from run evidence. Direction for the composer and sound designer to prototype and test. Status: Proposed.

### 16.1 Instrument palette

GBA-adjacent: **two pulse leads, a triangle-style bass, noise percussion and one sample channel**, mixed with **modern headroom and light reverb**. A **"handheld mix"** option that narrows output to those channels sits at Ideas/Feedback.

### 16.2 Motifs

| Motif | Spec |
| --- | --- |
| **Heartmark motif** | A **4-note phrase** in the title theme, the home town theme and **every Shift sting**. Instruments and harmony change by region; **the intervals never change** (identity persists through change, in sound). |
| **Vagary motif** | A separate **falling phrase** for the comet, used in **Errant battles, skyglass sites and faction scenes**. Errant battle themes quote it. |

### 16.3 Cries

Each form has its own cry. **Cries from the player's bonded creatures end on a shared 2-note tail**, so a creature still sounds like itself after a Shift.

### 16.4 Shift sting

Three parts aligned to the animation: **rising charge (18 f)**, **granular scramble (36 f)**, **resolved chord (36 f)**. **Anchor plays only the chord.**

### 16.5 Lantern

Rising hum while the glow meter fills; **warm chord on success**; **soft breath-out on failure**. **No click.** Send-out plays a **short paper-unfold shimmer**.

### 16.6 Tell sounds

| Event | Sound |
| --- | --- |
| Ward send-in | Glassy two-tone ping |
| Blocked hit | Muted tink |
| Empty move | Soft thud while the cursor stays put |
| Save verified | Two rising notes |
| Save failed | Low buzz |
| Unique-item confirm | Heavier tone |

### 16.7 Ambience

Each biome has an **ambience bed**. **Rain, fog and night add layers to the bed instead of swapping tracks.** Caves get a **low drone** so darkness has a sound.

### 16.8 Battle themes

**Wild, trainer, Spire leader, faction, Errant, final.** Errant themes quote the Vagary motif.

### 16.9 Battle speed

At **2x and 4x**, **music keeps its tempo** and **sound effects shorten**.

### 16.10 Mix options

Separate sliders for **music, SFX, cries, UI, ambience**. **Mono toggle.** **Captions for key sound effects in cutscenes.**

---

## 17. Art bible: do and don't

### Do

- Use master palette keys only for creatures, trainers, UI and icons.
- Keep m for Heartmarks, skyglass, Shift effects and the Forecast panel.
- Light every sprite and tile from the top left.
- Outline creatures and characters in k. A lighter outline on the lit side may use the darkest key in that area. Never shade skin with k.
- Give every blocking object a visible base and a shadow.
- Pair every colour signal with a shape, a number or a word.
- Draw each size you need, from the sprite-scale table. Scale by whole numbers only.
- Keep the walkable floor readable in every weather and light state.
- Draw the Heartmark as the four-point sparkle, in the same relative spot on every form of a bonded individual.
- Show explicit states: `EMPTY`, `???` for Unknown, `Not saved`, `Ward ?`, `Mends ?`, `No anchor stones`.
- Run every screen through the one-screenshot test.

### Don't

- Mix pixel scales on the art layer. The 640x360 overlay for Large Text and Japanese is the only exception.
- Rotate sprites by angles other than 90 degrees, or smooth them with sub-pixel filtering.
- Darken night, storms or caves with multiply or black overlays. Remap the palette instead.
- Let encounter grass and blocking foliage share a silhouette.
- Add environment colours that read as magenta.
- Put m on uniforms, bags or UI icons.
- Draw a Heartmark on a wild creature, or anywhere except a creature sprite and its portraits.
- Draw skyglass, the Star badge or any icon as a four-point sparkle.
- Put crystal or skyglass overlays on creatures, or give the trainer a worn device that triggers Shifts.
- Use a throw arc, a wobble or a click for capture, or a growing white silhouette for send-out.
- Use full-screen white flashes.
- Move a menu entry once the player has learned where it is.
- Let a banner, toast or menu blank the map.
- Leave a field blank. A blank is never a pass.
- Put a button-timing window inside any animation.

---

## 18. Quick-reference tables

### 18.1 Timing constants (60 fps; all est.)

| Constant | Value |
| --- | --- |
| Shift scramble total | 90 f (charge 18 / scramble 36 / resolve 24 / reveal 12) |
| Shift scramble reduced motion | 20 f dither crossfade |
| Forecast card reveal | 90 f (12 / 60 / 18); reduced 20 f |
| Forecast input lock after open | 0.5 s |
| Ward shimmer loop | 48 f (6 frames x 8 f); replay every ~4 s; blocked-hit flare 12 f |
| Heartmark glint | 30 f (6 steps x 5 f) |
| Faint | 40 f (2 f flash; 24 f sink in 8px steps; mark lingers 14 f) |
| Send-out unfold | 24 f (lift 6 / unfold 12 / settle 6); recall 12 f; reduced 12 f |
| Lantern capture (success) | ~1.9 s (raise 12 / draw-in 24 / meter up to 60 / success 18); failure 12 f |
| Trainer intro slide | 40 f |
| Errant intro streak | 30 f |
| Hit-stop | No effect 0 / Weak 2 / Neutral 4 / Strong 6 / Critical 8 (+2 f w outline flash) |
| Effectiveness word display | 45 f |
| Ability callout badge | 60 f |
| Camera attacker nudge | 2px |
| Walk | 4 frames/dir, 16 f per tile |
| Run | 4 frames/dir, 8 f per tile |
| Surf | 2-frame bob, 15 f/frame, 8 f per tile, 2-frame wake |
| Ledge hop | 16 f arc, 8px peak |
| Bump | 6 f squash |
| Grass rustle | 3 frames x 4 f |
| Interactable glint | 1px w every 2 s, within 3 tiles |
| Skyglass pulse | once per second |
| Achievement banner | 3 s |
| Cutscene still pan | 1px every 4 frames |
| Cutscene max length | under 90 s |
| Heat shimmer | 2-frame, distant props only |
| Animated tiles | 3 to 4 frames |

### 18.2 Thresholds and quantities

| Item | Value |
| --- | --- |
| Walkable vs blocking contrast floor | >= 3:1 (every weather/light state) |
| Fog coverage | 25–40%; clear within 4 tiles |
| Rain coverage | < 20% screen; 1x4 px streaks |
| Darkness light radius | >= 3 tiles; 2-step dither ring; 1px e wall rim outside |
| Low PP warning | <= 25% → o |
| Level-gap warning | foe >= 10 levels above → o + up-arrow |
| Evasion cap | EVA +2 |
| Plumbline lock | 2 turns |
| Mends | 3 pips per creature per battle |
| Reroll cost | 1, 2, 4 Starsalt within one Shift |
| Anchor cost | 1 anchor stone |
| Forecast cadence target | <= ~1 per 30 minutes |
| Creature ramp cap | 8 keys incl. k + m + highlight |
| Biome sub-palette | <= 24 colours; <= 6 extras |
| Master palette | 21 keys (Sweetie 16 + m, c, h, u, a) |
| Per-form frame budget | ~19 frames |
| Key stills | 8–10 |
| Message log | last 100 lines |
| Flash limit | <= 3 per second |
| Command panel height | 48px |
| Letterbox bars | 16px top and bottom |
| Summit Purse deposit | 1,500 glint per badge from badge 5 |
| Ethers at Shelters | from badge 3 |

### 18.3 Explicit-state strings (exact text)

| Context | String |
| --- | --- |
| Unknown readout field | `???` |
| Empty move | `EMPTY` (+ strike glyph) |
| All moves empty | `Scrap` |
| Foe Mends before Prism | `Mends ?` |
| Ward badge before block (Drift/Flux from send-in; Freefall after first block becomes known) | `Ward ?` |
| Ward badge after block | `Ward: known` |
| Blocked hit text | `Blocked by Ward` |
| Effectiveness words | `Strong` / `Neutral` / `Weak` / `No effect` / `Blocked by Ward` / `?` |
| Evasion marker | `EVA +1` / `EVA +2` |
| PP | `PP 12/15` |
| Save success toast | `Saved 14:02, verified` (+ check glyph) |
| Save failure banner | `Not saved` (+ X glyph, r, persists) |
| Unique-item confirm | `Use [item]? You have only one.` (cursor on No) |
| Shop remaining funds | `After: 1,200` |
| Anchor unavailable | `No anchor stones` |
| Forecast counter | `1 of 3` |
| Doubles target text | `Target: left foe` |
| Catch tags | `Stance` / `May KO` |
| Field Log states | `Seen` / `Read` / `Held` (glyph + word) |
| Forecast KEEPS row | `KEEPS: Lv, EXP, held item, nickname, Bond, trained stats, Heartmark technique (<name>)` |

---

## 19. Glossary of terms used in this section

| Term | Meaning as used here |
| --- | --- |
| **Shift** | Permanent form change (Up / Side / Down) driven by growth, forecast before it happens. Never in battle for the player. |
| **Forecast** | The three-card panel shown before a Shift resolves. |
| **Drift / Flux / Freefall** | The game's three difficulty dials (Drift easiest, Freefall hardest). Freefall hides unseen Forecast silhouettes and delays the Ward badge. |
| **Heartmark** | Four-point m sparkle on bonded creatures; same relative spot on every form. |
| **Heartmark technique** | A creature's signature move that always survives a Shift. |
| **Anchor / anchor stone** | Spend one stone to refuse a Shift. |
| **Reroll / Starsalt** | Spend Starsalt to redraw the Forecast (1, 2, 4). |
| **Bond** | Pip stat for keeping a creature through change; shown on the Forecast header. |
| **Preset** | Per-creature auto-resolution: none, auto-Anchor, auto-accept Up. |
| **Waystone** | Save/autosave point where deferred Shifts resolve. |
| **Shelter** | Hub location with Rematch board, Ethers, relearning. |
| **Read** | Scouting action revealing types/ability (base) or moves/item/Mends (with Scouting Prism). |
| **Scouting Prism** | Key item that deepens Read. |
| **Field Log** | Species/form log with Seen / Read / Held states. |
| **Ward** | Ability family (from Wonder Guard) that blocks most hits; has a shimmer tell and hex badge. |
| **Crackdust** | Consumable that helps against Wards; readout shows count. |
| **Plumbline** | Technique that always hits, clears stages and locks re-boosting 2 turns. |
| **Mends** | 3-per-battle recovery pips. |
| **Lantern** | Capture device; raise → draw-in → 3-segment glow meter. No throw. |
| **Capture Stance** | Toggle so party damage cannot KO a wild target. |
| **Errant** | Roaming legendary; gets its own intro. |
| **Vagary** | The comet (and a 96x96 legendary with a crystal head). |
| **Skyglass** | Comet material; irregular faceted shards, >=5 sides, m glow, 1 s pulse. |
| **Heartshard** | Appears in the finale still riding the returning Vagary. |
| **Starfall** | Event after which creatures carry a latent Heartmark. |
| **Spire leader / Summit Keeper / Champion** | Gym-leader, Elite-Four and champion equivalents. Get a defeat pose. |
| **Linnet** | Named character who also gets a defeat pose. |
| **The Mooring / The Scatter** | The two factions (Provost Agathe Merrow / Teo Varga). |
| **Brindle Isles** | Region; site of still one. |
| **Summit Purse** | 1,500 glint deposited per badge from badge 5. |
| **Glint** | Currency. |
| **Path view** | Toggleable collision/route overlay. |
| **Type names** | Plain, Grit, Brine, Kiln, Moss, Bolt, Rime, Gust, Stone, Rust, Glass, Hollow, Star. |
| **Named forms in the mockup** | Sloshkin (Lv18 starter, BRN), Skeinwing (Up, BRN GST), Rushling (Side, MOS BRN), Puddlepip (Down, BRN), Undertow (Heartmark technique). Other concept creatures: Scrapling, Prismoth, Vesperay. |

---

## 20. Open items flagged in the source

| Item | Owner |
| --- | --- |
| Sweetie 16 credit and licence confirmation before ship | Production / art lead |
| Deep skin extra below u (next palette revision) | Art lead |
| Creature ramp cap (8 keys) vs concept sprites using 9–12 — decide after a test sheet | Art lead |
| Automated walkable/blocking contrast check per map per state | Tech artist |
| Doubles default target may leak un-Read types | Gameplay |
| Whether a Freefall Read can reveal a Ward before the first blocked hit | Gameplay |
| Which moves count as Mends | Gameplay |
| Read cost/depth per dial | Gameplay |
| Lantern odds display format per dial | Gameplay |
| Capture flow + visible-odds UI: pre-production patent clearance before animating | Production / legal |
| Letter-to-hex mapping for palette keys | Art lead [not in source] |
| 3.4 mm capital height on 7-inch 720p — verify on device | UI |
| Text boxes checked in EN and JA at both sizes against the real script | Pre-production |
| Font licensing for Japanese pixel font; kanji coverage list from final script | Production |
| Optional high-legibility vector font; "handheld mix" audio option | Ideas/Feedback |
| Frames-per-artist-per-week throughput; owners for trainers, portraits, stills | Production |
| All frame counts, thresholds, budgets | Estimates; tune in playtests |

---

## 21. Implementation notes for a browser build [not in source]

These are derived from the rules above to help engineers honour them in a web engine; they are not pitch content.

- **Two canvases.** Render the art layer to a 320x180 offscreen canvas and the text overlay to a 640x360 offscreen canvas; composite both onto the display canvas at the same integer factor (overlay factor = art factor / 2). Pick the largest integer factor that fits the viewport; letterbox the remainder with the body background. Never fractional-scale.
- **Nearest-neighbour.** Set `imageSmoothingEnabled = false` on every context and `image-rendering: pixelated` on the display canvas. CRT/LCD shaders are optional post-passes, default off.
- **Camera snapping.** Keep entity positions as floats in logic; `Math.floor` (or round) only at draw time, and snap the camera origin to integers before culling tiles.
- **Palette as data.** Store the 21 keys as named entries; author sprites in indexed colour (or key-tagged PNGs) so dawn/day/dusk/night and weather remaps are lookup-table swaps, not blend modes. Exempt layers (Heartmark, skyglass, HUD, cursor) bypass the LUT.
- **Layer order** maps directly to draw order: ground → ground props → actors → tall-prop tops → weather → UI.
- **Accessibility flags** (`reducedMotion`, `largeText`, `highContrast`, `textSpeed`, `battleSpeed`) should be read by the animation system at phase boundaries, swapping to the reduced variants listed in section 13 rather than skipping frames ad hoc.
- **Input lock.** Implement the Forecast's 0.5 s ignore window and "ignore buttons held from before open" by requiring a fresh key-down after the panel's open timestamp.
- **Contrast check.** An automated test can render each map in each palette state to the offscreen canvas and compute relative luminance contrast between walkable and blocking tile samples against the 3:1 floor.
