# Porchlight — Art & Audio Bible (Reference Extract)

Source: `Porchlight.md`, section "Look, sound & feel" (lines 952–1145). This document is a complete, self-contained reference for engineers, artists and designers. Names, numbers, hex values and rules are reproduced exactly from the source. Where the source marks something **Proposed** or **[NEED SOURCE]**, that status is preserved here.

**Global status rule:** Everything in this bible is *Proposed* until the vertical slice proves it on a Steam Deck.

---

## Table of contents

1. The target in one sentence
2. Three reference screens (what the art must produce)
3. Art direction: field-guide pixel
4. Cast sheet: sprite sizes and signature animations
5. Palette (master, seasonal subsets, every hex value)
6. Time of day: palette LUTs
7. Lighting, weather and tide
8. Camera: flat, with a horizon
9. UI and UX visual language
10. Animation principles
11. Portraits and glyphs (art scope added, Proposed)
12. Audio
13. Performance and platforms
14. Visual targets and references
15. What the vertical slice has to prove
16. Consolidated colour reference
17. Consolidated numbers reference
18. Open items ([NEED SOURCE] list)
19. Appendix — merge hooks for the Wildshift fusion (not from source)

---

## 1. The target in one sentence

> Every screenshot should read as a **naturalist's field-guide plate that learned to glow at night.**

The art has exactly two jobs:

| Job | Meaning |
| --- | --- |
| Make memory look right | Make the things Wild World (WW) players remember — the sunset, the roof colour, the stars over town — look the way memory paints them. |
| Be its own game | Look unmistakably like Porchlight, not a copy of anything. |

---

## 2. Three reference screens

These three screen descriptions are the pitch's own target images. Every figure shown in them is a **placeholder**; none has been tested in play. They are useful as layout and content specifications.

### 2.1 Field view — autumn dusk, 4:52 pm

| Element | Specification |
| --- | --- |
| Camera | Flat camera showing the **horizon** |
| Lighthouse | Dark; **two of its seven scaffold sections** climbed |
| Player's porchlight | Already lit at the lighthouse's foot |
| Player | Red-panda Newcomer standing by the river |
| Tool ring | 8-socket ring, half open: **Rod** selected; **Shovel, Net, Can, Axe** on the upper arc; **three empty sockets** still sliding out |
| Fish | A trout shadow in the river showing its learned **dorsal-fin-and-glint** tell |
| NPC | Tuck the wombat waits on the cobbled plaza beside his **chalk lap course** with a **stopwatch emote** |
| Notice | Tuck's Commons request appears as a **torn-paper toast** |
| Particles | Leaves fall over everything |

### 2.2 The satchel screen

| Element | Specification |
| --- | --- |
| Capacity shown | 65 items in **15 of 20 slots** |
| Example stacks | 23 pears in stacks of 10; 9 mackerel in one slot |
| Tool ring | 8-socket tool ring |
| Wallet | Uncapped; placeholder reads **146,320** |
| Flags | **Sell** and **donate** flags with one-trip totals |
| Release | A **"Let it go"** release button |
| Save | Sub-second **Rest & Save** |
| Comparison callout | Set next to the old 15-slot pocket that 14 oranges filled |

### 2.3 The Hearth Ledger

The Hearth Ledger replaces WW's hidden loan with **one open book**.

| Page / region | Content |
| --- | --- |
| Left page — who you owe | Wren's **interest-free building co-op**, with **no deadline and no penalty** |
| Left page — chapter goal | A **tally-stick progress bar**; **each notch = 10,000◉**; Wren's pace estimate; pending shares from neighbours |
| Right page — today | Today's **18,990◉** broken down by source, and where it went |
| Right page — Commons | Commons Jar projects split into **your share** and **your neighbours'** |
| Bottom — Hearth Ladder | Seven tiers, each a **carved house model**, from the **bedsit** up to the **Lamp Room** |
| Tier labels | **Paid**, **Paying**, **Pick 1 of 5**, **Later**, **Finale** |
| Lighthouse tie-in | The dark lighthouse's scaffolding climbs **one section per tier** |

---

## 3. Art direction: field-guide pixel

### 3.1 Canvas and scaling

| Property | Value |
| --- | --- |
| Native canvas | **480×270**, integer-scaled only |
| 1080p | ×4 |
| 4K | ×8 |
| Steam Deck | renders **426×266 at ×3** (a slightly smaller window onto the same world) |
| Tile size | **16×16** |
| View | **3/4 top-down**, flat (no curvature) |
| Filtering | None: no bilinear filtering, no sub-pixel movement, no rotation (see §10) |

### 3.2 Density

Between **late 16-bit and early 32-bit**, with **modern 2D lighting** on top.

### 3.3 Proportions

- Characters are drawn like **field-guide plates**, not round chibi heads.
- The player is about **2.5 heads tall**: a **12-px head** on a **24×32 body**.
- The source states this rule does more for identity than any other.

### 3.4 Outlines and tonal limits

| Rule | Value |
| --- | --- |
| Outlines | **Selective**, in a **dark shade of each sprite's own hue** |
| No pure black | Darkest colour is **night ink `#141B33`** |
| No pure white | Lightest colour is **`#F6F1E3`** |

---

## 4. Cast sheet: sprite sizes and signature animations

Sprite size is a **characterisation tool** and is set on purpose. The **cast roster is the authoritative source** for every size (body bounding box, width × height). Where an earlier draft disagreed, **the roster wins**.

### 4.1 Sprite size table

| Character | Species | Size (px, W×H) | Why |
| --- | --- | --- | --- |
| The Thatch (each finch) | finch flock | **8×8** | Read as a flock, not five individuals |
| Dimity | moth | **16×16** | Smallest speaker overall; she lives in your porch lamp |
| Wick | puffling | **16×22** | Smallest speaker who walks; his cap slips over his eyes |
| The Newcomer (player) | red panda (preset) | **24×32** | The baseline |
| Wren Hearthwright | beaver | **24×30** | 2 px shorter than the player and 4 px wider at the hips: a pear shape on a flat paddle tail |
| Ambrose | old beaver | Wren's 24×30 rig, **about 28 px wide with his cane** | Same frame as his daughter, grizzled and settled; the cane makes him the wider of the two |
| Tuck | wombat | **26×22** | Wide and low: a box with a headband |
| Hesper Coil | garden snail | **22×26 front, 32×20 side-on** | Widest sprite in the cast (side-on), and the only one without limbs |
| Odile | roseate spoonbill | **22×38 in-engine** (20×32 on the pitch sheet) | Tallest neighbour: a vertical with a ladle |
| Ansel | heron | **24×48** | The tallest; he looms until he confesses |
| Juniper Pell | magpie | **22×32** (from cast sheet) | Wedge tail, cycling sheen |
| Barnaby Thole | hermit crab | **24×30** (from cast sheet) | The only sphere |

Note: Juniper and Barnaby appear in the cast-sheet strip with sizes but not in the prose size table; both are included above for completeness.

### 4.2 Cast sheet, panel 1 — the roster animating

Format: **32×32 cells at ×2**; each character has **idle, walk, signature** cells.

| Character | Species / preset | Sheet size | Signature animation(s) |
| --- | --- | --- | --- |
| The Newcomer | red panda preset | 24×32 | **let it go** |
| Wren Hearthwright | beaver | 24×30 | **the count** |
| Juniper Pell | magpie | 22×32 | **glint** |
| Barnaby Thole | hermit crab | 24×30 | **eureka**, **bell** |
| Tuck | wombat | 26×22 | **nickname** |
| Odile | roseate spoonbill | 20×32 sheet / 22×38 in-engine | **frame** |
| Hesper Coil | garden snail | 22×26 front / 32×20 side | **letter**, **side** |

### 4.3 Cast sheet, panel 3 — one harbor screen, native 480×270 at ×1 (key art b and d)

| State | What is shown |
| --- | --- |
| **High tide, autumn golden hour** | Long dithered shadows fall away from the sun; the causeway is under water and shows only as foam. |
| **Low tide, same hour about a week later** (tide drifts about 50 minutes a day) | Wet sand two ramps darker than dry draws a hard tide line; mud reflects the sky in 2-px streaks; a fish shadow works the channel; the bar shows the ribs of a boat lost in the Ebb winter. |
| **Night low tide, Porchlight Hours** | Same day colours run through the night LUT. Four porches burn across the water plus yours; Ludo lights the boardwalk lamps from his ladder; Tuck and Odile sit on their steps; Hesper's eyestalk lantern glows; the mud cycles `#3FF2E0`; the lighthouse is still dark. |

### 4.4 Mock status

| Status | Characters |
| --- | --- |
| **Drawn to spec** (seven roster sprites) | The Newcomer, Wren, Juniper, Barnaby, Tuck, Odile, Hesper |
| **Specified but NOT drawn yet** | Ambrose, the Thatch, Dimity, Ludo, Augusta, Ansel, Wick, Isolde |
| **Placeholder sketch** | Ludo in the night mock |

The cast sheet is a **mock, not final art**. The figure requires a page script; without it the canvases stay blank and the captions carry the content.

---

## 5. Palette

### 5.1 Structure

| Rule | Value |
| --- | --- |
| Master palette | **One 64-colour master palette** |
| Seasonal subsets | One subset per season (Spring, Summer, Autumn, Winter), plus Night and UI desk groups |
| Ramps | **Hue-shifted**: shadows lean **blue-violet**, highlights lean **warm cream**, so even noon has temperature |
| Signature colour | Each season gets **one signature colour** (ringed on the cast sheet) |
| Darkest colour | `#141B33` night ink (no pure black) |
| Lightest colour | `#F6F1E3` (no pure white) |

### 5.2 Seasonal subsets (from the cast sheet, panel 2)

**Spring**

| Hex | Role |
| --- | --- |
| `#F4E8C1` | — |
| `#A8D5A2` | — |
| `#6BAA75` | — |
| `#F2A7B5` | **Signature: blossom** |
| `#9FD3C0` | — |
| `#7EC4CF` | — |

**Summer**

| Hex | Role |
| --- | --- |
| `#FFE29A` | — |
| `#5FB36B` | — |
| `#2E8B57` | — |
| `#3FA7D6` | — |
| `#E8D3A0` | — |
| `#F28C28` | **Signature: marigold** |

**Autumn**

| Hex | Role |
| --- | --- |
| `#F3C178` | — |
| `#E07A3F` | — |
| `#B5452E` | — |
| `#A3283A` | **Signature: glasswort crimson** (the salt marsh blazes red — autumn feeling without copying WW's trees, O15) |
| `#7A3B2E` | — |
| `#4E6E5D` | — |

**Winter**

| Hex | Role |
| --- | --- |
| `#EAF2F8` | — |
| `#B8CFE0` | — |
| `#6E8CA8` | — |
| `#3B4A6B` | — |
| `#F6D8AE` | **Signature: window glow** on slate |

**Night**

| Hex | Role |
| --- | --- |
| `#141B33` | **Night ink** (darkest colour in the game) |
| `#2B3A67` | **Deep blue** (world drops to ink and this after dark) |
| `#F9C46B` | **Porchlight amber** (reserved) |
| `#FFB547` | **Lighthouse amber** (reserved) |
| `#9FE8C8` | — |
| `#3FF2E0` | **Bioluminescent cyan** (night low-tide mud cycle) |

**UI desk**

| Hex | Role |
| --- | --- |
| `#F4F1E6` | **Ledger paper** |
| `#C9A77C` | **Ledger rules** (lines) |
| `#2A2433` | — (dark ink for UI) |
| `#A8323A` | **Wax-seal red** |
| `#C9A16B` | — (tally wood tone) |
| `#7A5A36` | — (tally wood tone) |
| `#D9A441` | **Brass** |

### 5.3 Amber is reserved at night

- After dark the world drops to **ink `#141B33`** and **deep blue `#2B3A67`**.
- The **only saturated warm colours allowed** at night are:
  - Porchlight amber `#F9C46B`
  - Lighthouse amber `#FFB547`
  - Real flame props
- Purpose: a visual grammar in which **at night the harbor is the progress bar** — you can count lit porches across the water without opening a menu.

---

## 6. Time of day: palette LUTs

| Rule | Value |
| --- | --- |
| Method | **Palette LUTs, not overlays** |
| States per season | **Seven**: dawn, morning, noon, golden hour, blue hour, night, moonlit |
| Total LUT states | 4 seasons × 7 = 28 |
| Transition | Adjacent states blend through an **ordered-dither crossfade over about ten real minutes** |
| Invariant | **No off-palette colour ever appears** |
| Forbidden | Multiply overlays (they muddy pixel art and flatten the warm/cool contrast that makes a lamp read at night) |

---

## 7. Lighting, weather and tide

### 7.1 Normal maps and lights

| Element | Rule |
| --- | --- |
| Hand-painted normals | **3-tone**, only on **characters** and **light-casting props** (porch lamps, lanterns, Ludo's pole, the lens, the glowing mud) |
| Everything else | **Generated normals** (as the production judge required) |
| Point-light falloff | **Dithered 1-px steps**; **no smooth bloom** |
| On-screen point-light cap | **24** (Proposed; see §13) |

### 7.2 Shadows

- **One-colour dithered blobs.**
- Offset tracks the **sun arc**: short at noon, long at golden hour.
- At night: shadows only **under lamps**, pointing **away from the light**.

### 7.3 The lighthouse

| Property | Value |
| --- | --- |
| Visibility | A dark tower visible from almost everywhere |
| Scaffolding | One section higher per house tier (**seven sections** total) |
| After the Relighting | A **dithered amber cone sweeps the town every 8 s** |
| Photosensitivity | Slow sweep, **no flash** — safe for photosensitive players |

### 7.4 Weather

| Effect | Specification |
| --- | --- |
| Rain | **1-px rain**, angled by the wind |
| Wet boards | Catch lamplight in **2-px streaks** |
| Fog | **Two drifting layers** of dithered fog |
| Snow | Present |
| Cloud cover | Skyband cloud cover **matches Augusta's posted odds** |

### 7.5 Tide

| Element | Specification |
| --- | --- |
| Mask | **Per-tile mask** follows the real tide |
| Drift | Tide drifts **about 50 minutes a day** |
| Foam | **3-frame palette cycle** |
| Wet sand | **Two ramps darker** than dry, so the tide line is a **hard edge** (fixes WW O13: couldn't tell where the beach ended) |
| Wet mud | Reflects the sky in **2-px streaks** |
| Night low tide | Mud cycles **bioluminescent cyan `#3FF2E0`** |
| Update rate | Tide mask advances **once per real minute**; foam and glowing mud are near-free palette cycles |

### 7.6 Living world

| Element | Specification |
| --- | --- |
| Trees | Sway in **4 wind-driven frames** |
| Grass | Bends as you pass |
| Bee trees | Hum and shed **gold specks** before anything drops |

---

## 8. Camera: flat, with a horizon

WW's rolling-log curve hides the horizon, its beach geometry is ambiguous, and its map is a small stylised overview (O13). Porchlight replaces all three.

| Feature | Specification |
| --- | --- |
| Projection | **Flat 3/4 top-down, no curvature** (the curve is a recognisable signature of the series being moved away from; without it you can see where you're going) |
| **The Skyband** | A **live sky strip across the top ~40 px**, with **parallax**: sun arc, clouds, moon phase, tide indicator, stars and meteors. Does the job of WW's top screen on a single screen. |
| Horizon moments | At the **shore** and **cliff**, the camera **eases down over half a second**; the sea becomes **parallax strips** running to a **true horizon** with the dark lighthouse on it |
| Look-ahead | Camera leads **two tiles ahead** of a run |
| Peek | Right stick peeks **up to six tiles** and snaps back |
| Fish simulation | Fish are simulated in **every body of water**, so a reach can be scanned from a bridge instead of pacing the bank hoping a shadow spawns (O9) |
| Compass | **The lighthouse is the compass** |
| Map | An **illustrated pixel map** with neighbours' heads, pins, tide state, busy and quiet reaches, spotted fossil cracks, and the **lit-porch count** |

---

## 9. UI and UX visual language

### 9.1 Material language: a keeper's desk

| Material | Hex |
| --- | --- |
| Ledger paper | `#F4F1E6` |
| Ledger rules | `#C9A77C` |
| Tally wood | (UI desk ramp: `#C9A16B`, `#7A5A36`) |
| Brass | `#D9A441` |
| Wax-seal red | `#A8323A` |

**No leaf motifs anywhere.**

### 9.2 Rendering

| Rule | Value |
| --- | --- |
| UI layer | Own **960×540** layer so text stays crisp |
| Steam Deck | A **640×400 grid at ×2** |
| Accessibility | **Dyslexia-friendly glyphs** and **text size** as options |

### 9.3 HUD

| Element | Behaviour |
| --- | --- |
| Skyband | Always present (the only permanent HUD element) |
| Wallet readout | Slides in when buttons change, slides out again |
| Minimap | **No permanent minimap** |
| Clock | A **numeric clock is a toggle** |

### 9.4 Tool ring

| Rule | Value |
| --- | --- |
| Open | **Hold the shoulder button** for **8 brass sockets** |
| Quick swap | **Tap** to swap your **last two tools** |
| Cancel | **Back cancels and never drops anything** (O5) |

### 9.5 Satchel

| Rule | Value |
| --- | --- |
| Grid | **4×5** (20 slots, **up to 40**) |
| Counts | **3×5 pixel font** |
| Full stack | A **notched corner** on a full stack of **10** |
| Overflow | Drops into a **basket at your feet** with a **torn-paper slip** (e.g. "3 oranges went in the basket") — **never a frozen prompt** (O4) |

### 9.6 Dialogue

| Element | Specification |
| --- | --- |
| Box | A **ledger-paper slip** |
| Speaker name | On a **wax-seal tab** in the speaker's **key colour** |
| Portrait | A **32×32 bust** |
| Expressions, story cast | **Four** per character |
| Expressions, neighbours | **Four per species family**, swapped to each resident's palette and markings |
| Second topic | **'Linger'** appears as a **smaller second seal** |
| Scope | Portraits are not yet in production's art scope (see §11) |

### 9.7 Menus and journal

| Element | Specification |
| --- | --- |
| Progress bars | **Tally sticks** whose notches show what's paid |
| Buttons | **Wax seals** you press |
| Day Page | Dimity writes it in a **one-second ink wipe** ending in **'Tomorrow:'** |

### 9.8 Notices and toasts

- Requests and system messages appear as **torn-paper toasts / slips** (Tuck's Commons request; the overflow basket slip).

### 9.9 Fish readability and the bite

| Element | Specification |
| --- | --- |
| Shadow sizes | **Six** dithered shadow sizes |
| Silhouettes | dorsal fin, forked tail, eel ribbon, flat ray, silver school |
| Learned tells | Use **shape and motion, never colour alone**: a **1-px glint every 2 s**, a **bar pattern under moonlight**, a **ribbon wiggle** |
| Bobber | Feints **1–3 times**, then bites with a **splash**, a **rumble** and a **'plip'** |
| Default bite window | **7–31 frames** (about **0.12–0.52 s**), as measured in WW |
| Gentle timing | **0.6–0.9 s**; an accessibility option with its **own record board** |

---

## 10. Animation principles

| Principle | Rule |
| --- | --- |
| Frame rates | **12 fps characters** over a **60 fps world**; **Dimity flutters at 15 fps** |
| Forbidden | No rotation, no sub-pixel movement, no bilinear filtering |
| Anticipation | **One anticipation frame on every action**: arms dip before a shake; the rod draws back before a cast |
| Shake sync | The tree shake is **synced to the tree's sway**, so the tree answers your arms |
| Squash | A hop lands one frame **2 px shorter and 2 px wider**, then springs back. **Never more than about 10%**, so faces stay readable |
| Idle | **One main idle** and **two rare fidgets every 8–15 s** |
| Emotes | **Body acts first** (an ear flattening, a feather fan, a tail thump), then a small **hand-inked glyph draws itself above the head over 3 frames**, like a note in a field guide's margin. **Emotes still read with glyphs off.** |

### 10.1 Idle fidgets by character

| Character | Fidget |
| --- | --- |
| Wren | tail-tap |
| Ambrose | squint-lean |
| Ansel | one-legged breathing |
| Wick | pushing his cap back up |

### 10.2 The payment count (Proposed)

| Element | Rule |
| --- | --- |
| Base unit | One **3-frame bead flick per 1,000◉** |
| Problem | At that rate the **750,000◉ Lamp Room loan** would take over three minutes |
| Fix | Flicks **speed up after the first ten**; the count **rolls up in tens of thousands**; **holding confirm skips to the THWAP** |
| THWAP | **5 frames** plus **2 frames of screen shake** and a **dust puff** |
| Reduced motion | Removes the shake |

---

## 11. Portraits and glyphs — the art scope being added (Proposed)

Production's art scope and budget cover: **sprite animation, furniture, clothing and the 150 field-guide plates**. Dialogue busts and emote glyphs are **not** in it, and pixel art is already the critical path, so they are planned explicitly here.

| Item | Count | Estimate |
| --- | --- | --- |
| Story-cast busts, four expressions | **12 × 4 = 48** (the Thatch share one crew bust; Isolde's first version is a silhouette swap) | About **1.5 artist-days per base bust** and **0.5 per extra expression**: about **36 days** |
| Neighbour-family busts, four expressions | **8 × 4 = 32**, palette- and marking-swapped across all **24 neighbours** | About **24 days**, plus about **8 days** of clean-up on the swaps |
| Emote glyphs, 3 frames each | About **16** | About **10 days** |
| **Total** | **About 80 portraits and 16 glyphs** | **About 78 artist-days**: roughly **4 animator-months**, about **$36k** at production's **$9.0k/month** animator rate |

- Per-bust timings are an estimate until the slice measures them **[NEED SOURCE: per-portrait timing from the slice]**.
- Two asks:
  1. The Producer adds this line to the art scope and budget, as animator time or in the outsourced-art contract (busts brief well against the style bible).
  2. The cut order gets a **new slot between item 7 (furniture and clothing) and item 8 (player species)**: neighbour busts fall back to **one neutral expression per family** while the story cast keeps all four, saving about **1 animator-month**.

---

## 12. Audio

Principle: **the music changes on the hour.** In WW the hour turning is a small daily event and one of the delights most worth keeping (O15).

### 12.1 Hourly music as stems

| Element | Specification |
| --- | --- |
| Themes | **24 hourly themes** |
| Layers per theme | **season, weather, tide and night** layers (stems), instead of 288 authored variants |
| Hour change | A **two-bar bridge**, noticeable without a jolt |
| Ensemble | A **harbor band** |
| After dark | **Low brass** |
| Over the glowing mud | **Glass harmonica** |

### 12.2 The tide is audible

| Tide | Ambient bed |
| --- | --- |
| High tide | **Surf and rigging** |
| Low tide | **Mud ticks, wader calls and dripping pilings** |

The ambient bed follows **real tide height**.

### 12.3 Your Signal (Proposed; the answer to WW's town tune)

| Element | Rule |
| --- | --- |
| Authoring | On the **lease card** you set a **six-note phrase** on **six pentatonic chimes**, so nothing you write sounds wrong |
| Ownership | It belongs to **your house**, not the town |
| Uses | Your **door chime**; **Dimity hums it** on the Day Page; **Wick whistles it** once you're friends; at the **Relighting the ferry horn answers with it** |

### 12.4 Voices without babble

Nobody speaks gibberish syllables. Text scrolls over a **tick from each speaker's trade**. Can be switched off.

| Speaker | Tick |
| --- | --- |
| Wren | woodblock |
| Ambrose | low bowed string |
| Juniper | glass bead |
| Hesper | paper rustle |
| Barnaby | brass ding |
| Augusta | quill scratch |

### 12.5 Foley as feedback

| Sound | Rule |
| --- | --- |
| THWAP | **The loudest sound in the game** and the **sonic logo** |
| Bite 'plip' | Sits **mid-range** so it cuts through rain |
| Footsteps | Change with the **surface** |
| Stacking tick | **Rises in pitch with the count**, so a full stack sounds full |
| Bee hum | A **one-second directional warning** |

### 12.6 Captions for cues

Every sound that matters to play also has a **visual cue**: the **bite**, the **bee hum**, **mail**, and **the hour turning**.

---

## 13. Performance and platforms

### 13.1 Platform table

| Platform | Render | Target |
| --- | --- | --- |
| Steam Deck | **426×266 at ×3** | **60 fps in the vertical slice, as a gate**; optional **30 fps battery mode** |
| PC | **×4 (1080p)** or **×8 (4K)** | **60 fps**; minimum spec **[NEED SOURCE]** |
| Switch 2 (port after 1.0) | **480×270 at ×4 handheld, ×8 docked 4K** [NEED SOURCE: platform specs] | [NEED SOURCE: certification] |

### 13.2 Budgets

| Budget | Value |
| --- | --- |
| On-screen point lights | **Cap of 24** (Proposed) |
| Fish | Held as a **count per reach**; only **on-screen fish** are entities |
| Tide mask | Advances **once per real minute** |
| Foam and glowing mud | Near-free **palette cycles** |
| Off-screen town | Updates **once an in-game hour** |

### 13.3 Scaling rules

- **Integer scaling never blurs the image.**
- PC and Switch 2 both show the **full 480×270 canvas** at whole-number scales.
- Only Steam Deck's **1280×800** screen sees a slightly smaller **426×266** window onto the same world; on Deck alone, **critical information stays inside a 426×266 safe area**.
- On Deck and PC, an optional **Two-Screen layout** moves the **map and Skyband into a side panel**.

---

## 14. Visual targets and references

### 14.1 IP rule

- **Wild World is not on the reference board.** Under the IP plan **no AC screenshots go into any brief**.
- What is taken from WW is written down as **feelings to match, never images to study**: the sunset and the live sky over town, the roof colour you picked, autumn colour, the starry night, and the music turning on the hour.
- The actual reference boards hold: **natural-history field guides, real tidal harbors, lighthouse architecture and maritime ephemera**.
- The games below are **touchstones the team discusses**; **lessons, not assets**.

### 14.2 Reference table

| Reference | What we take | What we leave |
| --- | --- | --- |
| Eastward | Dense, lived-in pixel props and warm interior lamplight | Its heavier adventure mood |
| Sea of Stars | Dynamic light on pixel art that still looks hand-placed | Bloom, combat effects |
| Celeste | Anticipation and squash at tiny sizes; assist options without stigma (the model for Gentle timing) | Precision difficulty |
| Stardew Valley | 16×16 readability in a town of objects; seasonal swaps that read at a glance | The compressed calendar |
| A Short Hike | Coastal warmth; the camera easing down to frame a view | 3D traversal |
| Unpacking | Every object and surface has its own sound | Nothing |
| Natural-history field guides, real tidal harbors, lighthouse architecture, tide tables, ship's logs, tally sticks | Proportions, labelling, the materials of the UI; these fill the actual reference boards | Nothing |

---

## 15. What the vertical slice has to prove

### 15.1 Required demonstrations

The vertical slice must show, **on a Steam Deck at 60 fps**:

1. The harbor at **golden hour**
2. The harbor at **night**
3. The harbor at **night low tide**
4. **One full payment ceremony**

### 15.2 The 50-person look-and-feel test (gate metric, Proposed until the studio signs the gate before M5)

| Rule | Value |
| --- | --- |
| Testers | **50 people** |
| Stimulus | A slice screenshot |
| Question 1 | "What does this remind you of?" |
| Question 2 | "Is this a copy of anything? If so, what?" (asked separately) |
| Expected | Being reminded of the handheld life-sim classics is expected and **only logged** |
| Fail condition | **25% or more** answer that it's a copy → **Fail**; art direction goes back to the board before production starts |
| Recording | **Pass, Fail or Not tested**; a **blank is never a pass** |
| Legal | **Counsel reviews the look before any reveal** [NEED SOURCE: counsel] |

---

## 16. Consolidated colour reference

Every hex value in the source, in one table.

| Hex | Group | Name / role |
| --- | --- | --- |
| `#141B33` | Night | Night ink — darkest colour (no pure black) |
| `#2B3A67` | Night | Deep blue — night world base |
| `#F9C46B` | Night | Porchlight amber (reserved at night) |
| `#FFB547` | Night | Lighthouse amber (reserved at night) |
| `#9FE8C8` | Night | — |
| `#3FF2E0` | Night | Bioluminescent cyan — night low-tide mud cycle |
| `#F6F1E3` | Global | Lightest colour (no pure white) |
| `#F4E8C1` | Spring | — |
| `#A8D5A2` | Spring | — |
| `#6BAA75` | Spring | — |
| `#F2A7B5` | Spring | Signature: blossom |
| `#9FD3C0` | Spring | — |
| `#7EC4CF` | Spring | — |
| `#FFE29A` | Summer | — |
| `#5FB36B` | Summer | — |
| `#2E8B57` | Summer | — |
| `#3FA7D6` | Summer | — |
| `#E8D3A0` | Summer | — |
| `#F28C28` | Summer | Signature: marigold |
| `#F3C178` | Autumn | — |
| `#E07A3F` | Autumn | — |
| `#B5452E` | Autumn | — |
| `#A3283A` | Autumn | Signature: glasswort crimson |
| `#7A3B2E` | Autumn | — |
| `#4E6E5D` | Autumn | — |
| `#EAF2F8` | Winter | — |
| `#B8CFE0` | Winter | — |
| `#6E8CA8` | Winter | — |
| `#3B4A6B` | Winter | — |
| `#F6D8AE` | Winter | Signature: window glow on slate |
| `#F4F1E6` | UI desk | Ledger paper |
| `#C9A77C` | UI desk | Ledger rules |
| `#2A2433` | UI desk | — (dark UI ink) |
| `#A8323A` | UI desk | Wax-seal red |
| `#C9A16B` | UI desk | — (tally wood) |
| `#7A5A36` | UI desk | — (tally wood) |
| `#D9A441` | UI desk | Brass |

Total: 37 hex values listed in the source out of the 64-colour master palette. The remaining colours are not enumerated in this section.

---

## 17. Consolidated numbers reference

| Quantity | Value |
| --- | --- |
| Native canvas | 480×270 |
| Steam Deck render | 426×266 at ×3 |
| Steam Deck screen | 1280×800 |
| Scale factors | ×3 (Deck), ×4 (1080p), ×8 (4K) |
| Tile | 16×16 |
| UI layer | 960×540 (Deck: 640×400 grid at ×2) |
| Player sprite | 24×32; 12-px head; ~2.5 heads tall |
| Cast-sheet cell | 32×32 at ×2 |
| Dialogue bust | 32×32 |
| Expressions per bust | 4 |
| Master palette | 64 colours |
| LUT states per season | 7 |
| LUT crossfade | ~10 real minutes, ordered dither |
| Skyband height | ~40 px |
| Camera ease (horizon moment) | 0.5 s |
| Look-ahead | 2 tiles |
| Peek | up to 6 tiles |
| Lighthouse sweep | every 8 s |
| Lighthouse scaffold sections | 7 (one per house tier) |
| Hearth Ladder tiers | 7 (bedsit → Lamp Room) |
| Tally-stick notch | 10,000◉ |
| Lamp Room loan | 750,000◉ |
| Bead flick | 3 frames per 1,000◉; speeds up after first 10; rolls up in tens of thousands |
| THWAP | 5 frames + 2 frames shake + dust puff |
| Character fps | 12 (Dimity 15) over 60 fps world |
| Squash | 2 px shorter / 2 px wider, ≤ ~10% |
| Idle fidgets | 2 rare, every 8–15 s |
| Emote glyph draw | 3 frames |
| Tool ring | 8 sockets; hold shoulder; tap swaps last two |
| Satchel | 4×5 grid; 20 slots, up to 40; stacks of 10; 3×5 pixel count font |
| Fish shadow sizes | 6 |
| Glint tell | 1 px every 2 s |
| Bobber feints | 1–3 |
| Default bite window | 7–31 frames (~0.12–0.52 s) |
| Gentle bite window | 0.6–0.9 s |
| Rain | 1-px |
| Wet streaks | 2-px |
| Fog layers | 2 |
| Tree sway frames | 4 |
| Foam palette cycle | 3 frames |
| Tide drift | ~50 min/day |
| Tide mask update | once per real minute |
| Off-screen town update | once per in-game hour |
| Point-light cap | 24 (Proposed) |
| Normal-map tones | 3 (hand-painted, chars + light props only) |
| Hourly themes | 24 |
| Stem layers | season, weather, tide, night |
| Hour bridge | 2 bars |
| Signal | 6 notes on 6 pentatonic chimes |
| Bee hum warning | 1 s |
| Day Page ink wipe | 1 s |
| Field-guide plates (production scope) | 150 |
| Story-cast busts | 12 × 4 = 48 |
| Neighbour-family busts | 8 × 4 = 32 across 24 neighbours |
| Emote glyphs | ~16 |
| Portrait scope | ~78 artist-days ≈ 4 animator-months ≈ $36k at $9.0k/month |
| Look-and-feel test | 50 testers; ≥25% "copy" = Fail |
| Frame-rate gate | 60 fps on Deck (slice); optional 30 fps battery mode |

---

## 18. Open items ([NEED SOURCE] list)

| Item | Where |
| --- | --- |
| Per-portrait timing from the slice | §11 Portraits and glyphs |
| PC minimum spec | §13 Platform table |
| Switch 2 platform specs | §13 Platform table |
| Switch 2 certification | §13 Platform table |
| Counsel review of the look before reveal | §15 Slice gate |

Items marked **Proposed** in the source: the entire art direction (until the slice proves it on Deck); the 24 point-light cap; the payment-count speed-up and skip; the portraits-and-glyphs scope line; Your Signal; the 50-person look-and-feel gate metric.

---

## 19. Appendix — merge hooks for the Wildshift fusion (not from source)

The following are suggestions for fusing this bible with the Wildshift pitch (a creature-collecting RPG in which creatures Shift forms at random with visible odds; 12 types; Spires and badges; a Lantern capture; a Chaos dial; Starsalt and Anchor). They are **not** in the Porchlight source and are offered only as starting points.

- **Lantern = porchlight.** Reuse the reserved night-amber grammar: the Lantern capture glows porchlight amber `#F9C46B`, and the only other saturated warm at night is lighthouse amber `#FFB547`. Captured creatures' porches/stalls light up across the harbor, so the night harbor doubles as both the loan progress bar and the collection progress bar.
- **Spires = lighthouse scaffold sections.** Seven scaffold sections map to seven Spires/badges; each badge climbs the scaffold one section; the Relighting is the final badge, and the 8-s amber sweep becomes the endgame sky event.
- **Shift odds as field-guide marginalia.** Visible odds render as hand-inked glyphs that draw themselves over 3 frames above the creature (the emote-as-marginalia rule), readable with glyphs off via body language (ear flatten, feather fan).
- **Twelve types map to palette groups.** Six seasonal/night palette groups (Spring, Summer, Autumn, Winter, Night, UI desk) plus hue-shifted ramps give each of the 12 types a signature colour drawn from the 64-colour master; type-coloured outlines stay "a dark shade of the sprite's own hue".
- **Chaos dial drives the LUT crossfade and weather.** Higher Chaos shortens the ~10-minute ordered-dither crossfade, raises Skyband cloud/meteor density, and increases the odds Augusta posts — all without leaving the palette.
- **Starsalt / Anchor as tide.** Starsalt could be the bioluminescent night-low-tide cycle (`#3FF2E0` mud) harvested on the 50-min-drift tide; Anchor could be the Hearth Ladder's "Paid" state (a form that no longer Shifts), rendered as a wax seal pressed onto the creature's ledger page.
- **Creature sizes as characterisation.** Adopt the roster-wins sprite-size rule: each creature form has a bounding box chosen for read (8×8 flocks up to 24×48 loomers), and a Shift is a 1-frame anticipation + ≤10% squash into the new box.
- **Audio stems for Shift states.** Add a "Shift" stem to the 24 hourly themes alongside season/weather/tide/night; the Lantern capture gets its own THWAP-class signature sound, and type tells get speaker-trade ticks.
- **Fish-readability rules for creatures.** Six shadow sizes + silhouette tells (shape and motion, never colour alone) become the creature-spotting system; Gentle timing with its own record board stays as the accessibility path for capture windows.
