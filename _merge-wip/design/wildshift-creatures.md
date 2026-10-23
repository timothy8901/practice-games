# WILDSHIFT Creature Data Reference

Extracted from `Wildshift_Pitch.md`, section "Creatures with a Heartmark" through "Example Shift table" (source lines 698-1252). This document is self-contained: it reproduces every creature, type, chart value and Shift-table weight in that section so that engineers and designers can build from it without the original.

**Status conventions used in the source and preserved here**

| Marker | Meaning |
| --- | --- |
| `(est.)` | A number the pitch gives as a tuning estimate, not a measured or final value. |
| `Proposed` | A rule or feature the pitch proposes; owner sign-off pending. |
| `[NEED SOURCE]` | A value the pitch could not fill in. It is not a typo; treat as unknown. |
| `Derived` | Marked by this document, not the source: computed from the type chart in this doc. |

**Palette keys.** The source refers to colours by single-letter master-palette keys. Only the letters are given in this section; the hex values live in the pitch's visuals section (outside this extract). Keys used here:

| Key | What this section says about it |
| --- | --- |
| `m` | Comet magenta. Heartmarks, skyglass, Shift effects, the Forecast panel and the Vagary's body only. Never on uniforms, bags, type badges or other UI icons. |
| `w` | Heartmark highlight pixel on cool bodies; Sedgehare's ear glint. Implied white (a white body switches to `y` "so it stays visible"). |
| `y` | Heartmark highlight pixel on warm bodies and on white bodies; the comet glyph on the Star badge. |
| `k` | Fill used for the silhouette test ("filled solid k, it still reads as that creature"). |
| `b` | Brine type badge; Brinelance's HP bar while Last Ebb is active. |
| `v` | Plain type badge; Creelwight's rope ring while Empty Weave is unused. |
| `u` | Grit type badge. |
| `o` | Kiln type badge. |
| `g` | Moss type badge. |
| `s` | Rime type badge. |
| `e` | Stone type badge. |
| `r` | Rust type badge. |
| `i` | Glass type badge. |
| `p` | Hollow type badge. |
| `d` | Star type badge (with a `y` comet glyph). |

---

## 1. Section-wide rules

### 1.1 Roster facts

| Fact | Value |
| --- | --- |
| Creatures in this pitch section | 15 |
| With drawn concept sprites | 6: Sloshkin, Skeinwing, Scrapling, Prismoth, Vesperay, Vagary |
| Text-only entries | 9: Brinelance, Creelwight, Sedgehare, Wirewhisk, Rimeplate, Squallcoil, Tossup, Stillox, Caldermaw |
| Type coverage | All 12 ordinary types plus Star |
| Launch target | About 100 species in about 30 Shift families (est.) |
| Concept sprite size | 32x32 |
| Final battle sprite size | 64x64 |
| Large legendary sprite size | 96x96 |
| Design status | Proposed. These are design briefs; the studio's creature team owns final designs and names. |
| Selection rule | Every creature answers a moment from the Emerald Chaos V2 run. If the moment cannot be named, the creature waits for a later pass. |

### 1.2 Sprite rules

- Each sprite faces left-front 3/4.
- Uses master palette keys only.
- Passes a silhouette test: filled solid `k`, it still reads as that creature.
- Each species gets one feature a player can spot at 1x on a handheld screen.
- Comet magenta `m` appears only on Heartmarks, skyglass, Shift effects, the Forecast panel and the Vagary itself. Never on uniforms, bags, type badges or other UI icons.
- Each look ends with a "must not read as" line naming the Pokemon it could be mistaken for. (In this section only Bilgebob's line is written out: must not read as Wailmer or Cetoddle.)

### 1.3 The Heartmark

| Property | Value |
| --- | --- |
| Shape | A small four-point sparkle in `m`. |
| At 3px | A plus. |
| At 5px | A plus with diagonal glints. |
| Highlight pixel | `w` on cool bodies, `y` on warm bodies. On a white body the highlight is `y` so it stays visible (as on Skeinwing, Proposed). |
| Position | Sits in the same relative spot on one individual through every form. |
| Who has one | Every creature born since the Starfall has a faint mark. |
| When it lights | Only once the creature bonds with a trainer. Wild creatures show none. |
| Unbonded look | The Scrapling and Vesperay concept sprites show the unbonded look, with the mark's spot left plain. |
| Heartmark technique | One technique per creature that survives every Shift, stays usable and keeps its same-type bonus in every body (Proposed). Tossup's Blank Slate lets it choose which. |

### 1.4 What a Shift never touches

Level, EXP, held item, nickname, Bond, trained stat points and the Heartmark technique.

- Context: in the run, Chaos evolutions kept moves and EXP but re-read EXP on the new species' curve, so an evolution could cost levels (a Lv19 Ludicolo became a Lv16 Rhydon; MUDDY went from a Lv30 Altaria to a Lv27 Gardevoir). WILDSHIFT keeps the level.
- Per-stat floor: no base stat drops more than **10% per Shift on Drift** or **20% on Flux**. **Freefall has no floor.**
- Shifts are permanent, driven by growth (about three level windows per creature), and preceded by a Forecast of three outcomes with their odds.

### 1.5 Shift families and the Forecast

- Each species belongs to a family. The family pool lists every body the creature can become: its forward line, a skip-ahead, a hatchling, forms from other families and one Star-touched form.
- The Forecast shows exactly three cards: **Up**, **Side** and **Down**.
- The dial (Drift / Flux / Freefall) sets each card's odds. The family's hidden table sets which form lands on each card.
- The Sloshkin table (section 6) is the worked example.

### 1.6 Ward

- Ward is a class of abilities. It answers the randomized Wonder Guard that walled the run about ten times.
- Prismoth is the native Ward species that teaches the rule.
- Tell: a hex-lattice shimmer that replays about every 4 s, plus a "Ward ?" badge.
- On Freefall the badge appears only after the first blocked hit.
- After a blocked hit, the readout lists which of the party's techniques can land.

### 1.7 Field Log

Each form moves through three states:

| State | Meaning |
| --- | --- |
| Seen | Met in battle, or shown face-up on a Forecast card. |
| Read | Scouted. |
| Held | Owned in that form, by catch or by Shift. |

- Filling the Field Log is the long-tail goal.
- A player chases a form by catching it where it lives wild, or by Rerolling a Forecast until the form shows on a card and then taking its odds.
- Shift-only forms such as Skeinwing can only be reached by Shift.

### 1.8 Names

All names are working names. A web search on 22 Oct 2026 found no other creature with any of these names. Items needing a check:

| Name | Concern |
| --- | --- |
| Vagary | Exact match: an indie game of that title on itch.io (in development, last devlog 2019). Also an ordinary English word. |
| Scrapling | Near miss: Sculplings (monster-collecting roguelike on Steam). |
| Skeinwing | Near miss: Skinwing (Magic: The Gathering card). |

Clearance status: Not tested. A web search does not replace a trademark search or a full roster check against Pokemon, Temtem, Coromon, Cassette Beasts, Digimon and Monster Sanctuary.

---

## 2. Roster summary

No numeric base stats or stat totals are given anywhere in this section. Only qualitative stat notes exist; they are recorded per creature. Prismoth is the one exception with a numeric rule (max HP is a quarter of normal for its level, est.).

| # | Creature | Types | Role tag | Sprite | Ability | Heartmark technique | Other named move | Shift pool lean |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Sloshkin | Brine | starter_base | Drawn 32x32 | Shoresense | Undertow (Brine 65) | - | Sloshkin family (see section 6) |
| 2 | Skeinwing | Brine / Gust | starter_shift | Drawn 32x32 | Featherbed | Undertow (carried) | Skein Sweep (Gust 60) | Sloshkin family, Shift-only form |
| 3 | Scrapling | Grit | early_carry | Drawn 32x32 (unbonded) | Big Sibling | Shadowbox (Hollow 50) | - | Narrow: Knuckleback (Grit) then Cragmitt (Grit/Stone) |
| 4 | Prismoth | Glass / Gust | ward | Drawn 32x32 | Prism Ward | Not stated | Dust Veil (Glass 30) | Glass and Gust |
| 5 | Vesperay | Brine / Glass | champion_ace | Drawn 32x32 (unbonded) | Afterimage | Not stated | Vesper Mend (recovery) | Brine and Glass |
| 6 | Vagary | Star | comet_legendary | Drawn 32x32 (magenta body) | Unfixed | None (never Shifts) | Tailfall (90, queued type) | Never Shifts, never on a Forecast card |
| 7 | Brinelance | Brine / Rime | accidental_shift_hero | Text only | Last Ebb | Gnash (Hollow 60) | - | Reached from Bilgebob's Up card (6 of 100 on Flux, est.) |
| 8 | Creelwight | Hollow / Rust | hollow_wall | Text only | Empty Weave | Not stated | Snuff (Hollow 50) | Mostly Hollow and Rust |
| 9 | Sedgehare | Moss | crit_threat | Text only | Keen Glint | Not stated | Reap (Moss 70) | Moss and Grit |
| 10 | Wirewhisk | Bolt | scout | Text only | Tailhum | Arc Ping (Bolt 30) | - | Mostly Bolt and Gust |
| 11 | Rimeplate | Rime / Stone | down_shift_example | Text only | Plateshed | Not stated | Plate Toss (Rime 60) | Down card: Chillnub (Rime) hatchling |
| 12 | Squallcoil | Bolt / Brine | errant | Text only | Skyroam | Not stated | Bandlight (Bolt 90) | Errant; Down card never a hatchling on Drift/Flux (Proposed) |
| 13 | Tossup | Plain | wild_card_common | Text only | Blank Slate | Any one of its techniques (chosen at first Shift) | Sure Pinch (Plain 40) | One form per type, 12 forms (est.) |
| 14 | Stillox | Stone | unshifting_titan | Text only | Unshifting | n/a (never Shifts) | Bedrock Charge (Stone 100) | Outside the Shift system |
| 15 | Caldermaw | Kiln / Stone | rival_opener | Text only | Furnace Jaw | Not stated | Kiln Maw (Kiln 75) | Scripted Lv5 story Shift; later down to Sootling (Kiln) |

"Not stated" means the source names a signature move but does not say whether it is the Heartmark technique. Where the source does say so, it is recorded.

### 2.1 Defensive profile (Derived from the type chart in section 4)

Multipliers for damage taken, computed from the chart with dual types multiplied. Only non-neutral entries listed. These agree with every Counterplay paragraph in the source.

| Creature | Types | x4 | x2 | x0.5 | x0.25 | x0 (immune) |
| --- | --- | --- | --- | --- | --- | --- |
| Sloshkin | Brine | - | Grit, Bolt | Kiln, Moss, Rime, Stone, Glass | - | - |
| Skeinwing | Brine/Gust | Bolt | Grit | Kiln, Moss, Glass, Hollow | Stone | - |
| Scrapling | Grit | - | Gust, Glass | - | - | - |
| Prismoth | Glass/Gust | - | Kiln, Rime | Grit, Moss, Rust | - | - (but Prism Ward blocks every non-Strong hit) |
| Vesperay | Brine/Glass | - | Hollow | Rime, Rust, Glass | Moss | - |
| Vagary | Star | - | - | - | - | - (neutral to everything; see Unfixed) |
| Brinelance | Brine/Rime | - | Grit, Brine, Bolt | Moss, Rime, Gust, Stone, Rust, Glass | - | - |
| Creelwight | Hollow/Rust | - | Moss, Rime, Gust | Brine, Hollow | - | Plain, Grit |
| Sedgehare | Moss | - | Brine, Kiln, Rime | Grit | - | - |
| Wirewhisk | Bolt | - | Moss, Stone, Rust | Grit | - | - |
| Rimeplate | Rime/Stone | - | Kiln, Moss, Hollow | Plain, Gust, Rust, Glass | - | - |
| Squallcoil | Bolt/Brine | - | Bolt, Rust | Kiln, Rime, Glass | - | - |
| Tossup | Plain | - | Grit, Rust | - | - | - |
| Stillox | Stone | - | Moss, Hollow | Plain, Brine, Glass | - | - |
| Caldermaw | Kiln/Stone | - | Grit, Gust, Hollow | Plain, Rime, Glass | - | - |

Notes on the derivation: Rimeplate takes 0.5 from Gust by the chart (Gust vs Rime 0.5, Gust vs Stone 1), which the source lists as "resists"; the source lists Prismoth's resists nowhere because Prism Ward makes them moot.

---

## 3. Creature entries

Each entry preserves the source's six blocks: flavour, Ability, Signature, Shift, Counterplay, From the run.

### 3.1 Sloshkin

| Field | Value |
| --- | --- |
| Types | Brine |
| Role tag | starter_base |
| Sprite | Drawn 32x32 concept (bonded look) |
| Heartmark | On the forehead; `w` highlight (cool body); same relative spot on every form this individual takes |
| Stats | Slow (est.). No other stat data. |

**Flavour.** Sloshkins live on the tide-flats of the Brindle Isles, where the first skyglass fell. They sit buried to the eyes in warm mud and pop up when someone walks past. Islanders say a Sloshkin picks its trainer, and the faint mark on its forehead lights the day it does.

**Ability: Shoresense.** On switch-in it Reads the foe automatically. The foe's ability and any Ward go straight into the Field Log.

**Signature / Heartmark technique: Undertow.**

| Property | Value |
| --- | --- |
| Type | Brine |
| Power | 65 |
| Accuracy | 100% |
| Effect | Lowers the target's Speed one stage (est.) |
| Heartmark | Yes. Stays usable and keeps its same-type bonus in every body (Proposed). |

**Shift.**
- About 3 Shift windows, tied to the island curve: about **Lv9, Lv20 and Lv34** (est.).
- Each window opens a Forecast of three cards drawn from the family pool (section 6).
- The player accepts, rerolls for Starsalt, or spends an anchor stone. No timing input.
- Level, EXP, held item, nickname, Bond, trained stat points and Undertow carry through.
- The Shiftlog on its summary page records every form in order. (MUDDY's seven forms would read as one strip.)
- Up to four forms over about three windows.

**Counterplay.**
- Grit and Bolt hit it for double.
- It resists Kiln, Moss, Rime, Stone and Glass.
- It is slow (est.); Undertow's Speed drop is its only tempo tool. Lead with a fast Bolt attacker.

**From the run.** MUDDY the Mudkip went through seven forms: Mudkip, then Swampert at Lv16 (skipping Marshtomp), Machop at Lv20, Wynaut in the Fortree gym, Ludicolo at Lv27, Altaria on Mt Pyre at Lv30 and Gardevoir in the Magma Hideout. Moves and EXP carried each time (as a Wynaut it kept Fly and Zap Cannon). Each Chaos evolution re-read EXP on the new species' curve, so the Lv30 Altaria became a Lv27 Gardevoir. MUDDY never carried; it finished at Lv27, 46 levels behind Machoke (Lv73). Sloshkin keeps the journey through many bodies, adds a visible mark and a carried technique, and keeps its level through every Shift.

### 3.2 Skeinwing

| Field | Value |
| --- | --- |
| Types | Brine / Gust |
| Role tag | starter_shift |
| Sprite | Drawn 32x32 concept |
| Heartmark | On the head; `y` highlight because the body is white (Proposed) |
| Stats | Fragile (est.). No other stat data. |
| Availability | Shift-only. No hatchling, no wild encounter. |

**Flavour.** No Skeinwing hatches. Every one started as something else. After a skyglass storm, skeins of them fly high over the outer islands, out of any trainer's reach. Old fishers study the coral collars to guess what each bird used to be.

**Ability: Featherbed.** Halves damage from the first contact hit each battle. Once it is used, the feather fringe on its near wing flattens on screen.

**Techniques.**

| Move | Type | Power | Notes |
| --- | --- | --- | --- |
| Undertow | Brine | 65 | Carried through the Heartmark from Sloshkin. |
| Skein Sweep | Gust | 60 | Form technique. Hits both foes in doubles (est.). |

**Shift.**
- Exists only as a Shift outcome.
- When a Sloshkin becomes a Skeinwing, three things stay readable on screen: the Heartmark on the head, the coral band reborn as a collar, and the eye.
- In the Sloshkin pool it is an **Up card (stage 2)**.
- From Skeinwing the directions re-centre: **Bogmonarch and Lumenveil are Up, Siltback is Side, and Sloshkin, the other stage-1 forms and the hatchlings are Down.**

**Counterplay.**
- Bolt hits it four times over; Grit hits it for double.
- It resists Kiln, Moss, Glass and Hollow, and takes a quarter from Stone.
- It is fragile (est.). Featherbed only softens the first contact hit, and the flattened fringe shows when it is spent.

**From the run.** MUDDY became an Altaria on Mt Pyre at Lv30, then a Lv27 Gardevoir in the Magma Hideout. Each form looked like a different creature; only the nickname and the carried moves showed it was still MUDDY. Skeinwing is the test case for the theme: a player who has never seen it should still recognise their Sloshkin from the coral collar, the eye and the Heartmark.

### 3.3 Scrapling

| Field | Value |
| --- | --- |
| Types | Grit |
| Role tag | early_carry |
| Sprite | Drawn 32x32 concept, unbonded look (mark's spot left plain) |
| Spot feature | Red patch on its shoulder ("its badge") |
| Stats | Slow (est.). No other stat data. |

**Flavour.** The smallest creature on the first route and the quickest to start a fight. Scraplings wrap their fists in whatever they find: sailcloth, net cord, old bandage. Dock workers keep one around to chase off gulls three times its size and call the red patch on its shoulder its badge.

**Ability: Big Sibling.** After each battle it takes part in, the lowest-level creature in the party gets an extra **30% of Scrapling's EXP** (est.), on top of the **60% bench share** every non-battler already gets. The post-battle EXP screen shows the share as an arrow. The share is lost if Scrapling faints in that battle.

**Signature / Heartmark technique: Shadowbox.**

| Property | Value |
| --- | --- |
| Type | Hollow |
| Power | 50 |
| PP | 10 (est.) |
| Flavour | A jab at its own shadow. |
| Heartmark | Yes. The brawler keeps a Hollow answer in any body: neutral against Hollow, double against Stone and Glass. |

**Shift.**
- Its pool is narrow on purpose.
- Its Up card mostly draws the forward line, **Knuckleback (Grit)** and then **Cragmitt (Grit/Stone)**, at **70 of 100 Up weight on Drift** (est.).
- To stop it changing, spend anchor stones at each window or give it the Still Knot.
- Shadowbox survives every Shift through the Heartmark.

**Counterplay.**
- Hollow is immune to its Grit moves, and the move panel says No effect before the player picks. Only Shadowbox gets through, at neutral.
- Gust and Glass hit it for double.
- It is slow (est.), so a fast Gust attacker can take it before it swings.

**From the run.** A Machoke caught at Lv2 on Route 101 carried the run with Seadra and ended at Lv73. At about 28 hours the log reads that everything except Machoke was about 30 levels under the curve. With only Normal and Fighting moves, Machoke was walled by Ghost types: Brawly's Dusclops, Juan's Banette and Drake's Dusclops. The fix was luck: TM40 rolled Leaf Blade in this hack, taught after the second loss to Drake. Shadowbox gives the brawler its own weak Hollow answer. Big Sibling turns the carry's EXP into growth for the bench.

### 3.4 Prismoth

| Field | Value |
| --- | --- |
| Types | Glass / Gust |
| Role tag | ward |
| Sprite | Drawn 32x32 concept |
| Stats | Max HP is a quarter of normal for its level (est.), so one Strong hit ends it. |

**Flavour.** Prismoths drink the light off skyglass dust. Their wings are thin, dark glass, and only the colours banded on them let light through. Island children learn it as a rhyme: read the wings, then swing.

**Ability: Prism Ward.**
- Only Strong hits land. For Prismoth that means **Kiln and Rime**.
- Poison and burn chip, weather and trap damage still land.
- Tell: the hex-lattice shimmer plus a "Ward ?" badge on send-in. On Freefall the badge appears only after the first blocked hit.
- After a blocked hit, the readout lists which of the party's techniques can land, and the Field Log keeps it.

**Signature: Dust Veil.**

| Property | Value |
| --- | --- |
| Type | Glass |
| Power | 30 |
| Effect | 30% chance to poison (est.) |
| Design note | Damage is low on purpose; Prismoth stalls while poison chips. |

**Shift.**
- Ward is a class of abilities. Seeds can place a Ward on other species; Ward placements are fixed at new game.
- Placement guarantees on every seed: **Crackdust** is in stock at the Shelter before any mandatory Ward trainer, priced below one route trainer's payout, and one chip-damage disc (poison or trap) is guaranteed by badge 1.
- Prismoth's own pool leans Glass and Gust.
- Abilities follow the form: a bonded Prismoth that Shifts keeps Prism Ward only if the new form has it.

**Counterplay.**
- Read the wings. Any Kiln or Rime technique ends it.
- Poison, burn, weather and trap damage also work.
- Crackdust suppresses the Ward.
- On Drift and Flux the badge shows on send-in, so the player can switch before wasting a turn. On Freefall the badge waits for the first blocked hit.

**From the run.** Randomized Wonder Guard walled the run about ten times: a Rustboro gym trainer's Metagross; the Route 117 twins' Groudon (lost twice); Maxie's Masquerain (lost once); a Route 120 trainer's Lv28 Metagross that wiped the team twice (routed around); Tate & Liza's Lv42 Salamence; an Abra on the Route 127-131 crossing; two Beautifly in Juan's gym; Glacia's Beautifly; and probably Drake's Torchic. Wonder Guard was named on the first blocked hit. Missing: any warning before the first wasted turn, and any list of which moves could land. In League run 6, Glacia's Beautifly drained every Revive, so the Champion fight started with no Revives or Full Restores. Sand Tomb's trap damage worked on the Route 120 Metagross.

### 3.5 Vesperay

| Field | Value |
| --- | --- |
| Types | Brine / Glass |
| Role tag | champion_ace |
| Sprite | Drawn 32x32 concept, unbonded look |
| Owner | Idris Fenwake (the Champion); his Vesperay wears his anchor ring around the base of its tail |
| Tell | The eye panel on its back brightens before it heals |
| Stats | None given. |

**Flavour.** The Champion's partner. Vesperays rise from the deep at dusk and glide just above the water, trailing reflections of themselves. The eye panel on its back brightens before it heals, and every sailor on the islands knows that sign.

**Ability: Afterimage.**
- Each evasion stage it gains shows as a decoy copy beside it, up to **two**, matching the **+2 evasion cap**.
- The move panel shows the exact hit chance before the player picks.
- A hit that lands on a decoy pops it and deals no damage.
- Multi-hit moves pop one decoy per hit. Moves that hit every foe pop both.
- The **Plumbline disc** always hits, clears its stat stages and blocks re-boosting for 2 turns.

**Signature: Vesper Mend (recovery).**
- Every creature has a battle budget of **3 Mends**, shown as pips. Vesper Mend draws from it.
- Turn 1: the eye panel brightens and both sides see it.
- End of turn 2: it heals **50% of max HP** (est.).
- A Hollow hit in between dims the panel and cancels the heal. The Mend is spent either way.
- Alternating heals and guards can no longer loop.

**Shift.**
- The Champion's Vesperay is anchored by Idris's ring and keeps the same kit on every seed, so the last fight is learnable.
- The player's creatures never Shift in battle. Trainer creatures never Shift mid-battle, except scripted boss Shifts, each with a posted Forecast.
- In the story's Anchor Release scene the ring cracks and Vesperay's Heartmark flares. The story section owns what happens next; any Shift there follows the scripted-boss rule.
- Wild Vesperays appear in the post-game. Once caught, they Shift like any other family. Their pool leans Brine and Glass.

**Counterplay.**
- Hollow is its only weakness: Brinelance's Gnash and Scrapling's Shadowbox both hit it for double.
- It resists Moss (a quarter), Rime, Rust and Glass.
- Land a Hollow hit while the eye panel is bright to cancel the heal.
- Multi-hit moves clear decoys.
- The Plumbline disc from the 7th Spire is the guaranteed answer. A plain stat clear is not enough (in the run, Haze was tried and the boosts came straight back).

**From the run.** Champion Wallace's Lv56 Latias used Double Team behind Recover and Protect and OHKO'd the bench. It ended League runs 4, 5 and 6. In run 5 Haze was tried and the boosts came straight back. In run 8, Seadra (Lv75) beat it with Bite three times and survived at 11 HP. Vesperay keeps the fight's shape (evasion plus recovery), puts both on screen, caps them, and gives the player a guaranteed answer.

### 3.6 Vagary

| Field | Value |
| --- | --- |
| Types | Star (cycles; see Unfixed) |
| Role tag | comet_legendary |
| Sprite | Drawn 32x32 concept; drawn in `m` because it is the comet |
| Form | A ring of comet tail with a crystal head |
| Stats | None given. It has no healing move. |

**Flavour.** The Vagary is a comet on a long orbit. On its last pass it broke over the Brindle Isles, and its skyglass fell everywhere. Part of it was alive, and islanders call that part Vagary too. It has not held one type since, and islanders say every Shift echoes the crack on its brow. The Mooring wants the change it brings stopped. The Scatter wants more of it, and refines its skyglass dust into Starsalt. When the comet returns, the Heartshard rides with it, and the only place to reach it is a sea stack. The story section owns the finale.

**Ability: Unfixed.**
- At the end of each turn its type moves to the next in a posted loop of four: **Star, then three types drawn from the seed**.
- The next two types show as badges over its HP bar.
- The three shards count down: one lights each turn, and when all three are lit it returns to Star.
- Its type changes. Its form never does.

**Signature: Tailfall.**

| Property | Value |
| --- | --- |
| Power | 90 (est.) |
| Type | Takes the type next in the queue, so the player sees each hit's type one turn early. |

**Shift.**
- Vagary is the source of every Shift and never Shifts itself.
- It never appears on a Forecast card.
- Unfixed only changes its type.
- Its magenta body is the one place the palette rules allow `m` outside Heartmarks, skyglass, Shift effects and the Forecast panel.

**Counterplay.**
- Read the queue and switch into a resist one turn ahead.
- On Star turns nothing is strong or weak against it, so those are the turns to heal or set up.
- It has no healing move.

**From the run.** The run's plot had two villain teams with mirror-image goals, a Groudon/Kyogre weather crisis, Rayquaza at Sky Pillar and a lot of backtracking. The run's stories came from the chaos itself: about 15 Chaos evolutions in 45 hours. Vagary makes that chaos the plot, with one cause the player can see from the first route to the last fight.

### 3.7 Brinelance

| Field | Value |
| --- | --- |
| Types | Brine / Rime |
| Role tag | accidental_shift_hero |
| Sprite | Text only |
| Pre-Shift form | Bilgebob (Brine): a round floating whale. Must not read as Wailmer or Cetoddle. |
| Stats | None given. |

**Flavour.** A Bilgebob is a round, slow whale that floats in harbour mouths and dozes in the warm water by the docks. A few become Brinelances: lean, salt-crusted hunters with a single long lance of rime. Nobody plans for it. It just happens, and the ones it happens to fight like they know they were a long shot.

**Ability: Last Ebb.** Below **25% HP** (est.), its Brine and Hollow moves gain **30% power** (est.). The HP bar turns `b` while it is active, so both sides can see it.

**Signature / Heartmark technique: Gnash.**

| Property | Value |
| --- | --- |
| Type | Hollow |
| Power | 60 |
| Effect | 30% flinch chance (est.). Each hit also pops one Afterimage decoy (same as the Gnash disc Linnet gives in the story). |
| Heartmark | Yes. Learned as a Bilgebob and carried through the Shift. |

**Bilgebob's ability: Sodden.** Stops every creature on the field from using a self-KO move. Does not carry over to Brinelance, because abilities follow the form.

**Shift.**
- Brinelance sits in Bilgebob's Up card at its third window, late in the run (est.).
- It has a low weight in that card: **6 of 100 on Flux** (est.), so it shows on about one Up card in 17 there.
- The card reads "Brinelance (Brine/Rime)" with its odds, and the player can take the long shot.
- Sodden does not carry over; Gnash does, through the Heartmark.
- Hidden-odds rolls exist only as a Custom toggle.

**Counterplay.**
- Grit, Brine and Bolt hit it for double.
- It resists Moss, Rime, Gust, Stone, Rust and Glass.
- Finish it before it falls under the Last Ebb line, or use status once it does.

**From the run.** Wailmer's Damp blocked a wild Regice's Explosion twice. At Lv40, Wailmer Chaos-evolved into Seadra. Seadra then ground Victory Road alone in two blocks with League run 7 between them: Lv49 to 60 (about 20 rounds), then Lv60 to 74 (about 30 rounds), about 5 hours of edited video (parts 40-44). In run 8 it carried the League and beat Wallace's Latias with Bite three times, surviving at 11 HP. Brinelance keeps the long-shot hero. Bench EXP from the start aims to cut the grind.

### 3.8 Creelwight

| Field | Value |
| --- | --- |
| Types | Hollow / Rust |
| Role tag | hollow_wall |
| Sprite | Text only |
| Tell | A `v` ring of rope circles it until Empty Weave is used |
| Stats | None given. |

**Flavour.** An iron creel lost in a storm, rusting on the seabed and still fishing. The cage is empty, but something inside keeps the door shut. Fishers who hear it knocking on a hull cut their lines.

**Ability: Empty Weave.** The first hit each battle that is **not** Strong against it deals half damage. A `v` ring of rope circles it until the effect is used.

**Signature: Snuff.**

| Property | Value |
| --- | --- |
| Type | Hollow |
| Power | 50 (est.) |
| Effect | Removes the target's raised stat stages. Punishes setup. |

**Shift.**
- Caught Creelwights Shift like any family. Their pool stays mostly Hollow and Rust, so a Hollow wall stays a Hollow wall.
- Scouting rule: the Scouting Prism adds moves, held items and heal pips to the Read card, so a Drake-style stack of healing items shows before the fight.

**Counterplay.**
- Plain and Grit do nothing, and the move panel says No effect before the player picks.
- Moss, Rime and Gust hit it for double.
- It resists Brine and Hollow.
- Break Empty Weave with a weak hit first.

**From the run.** Ghost types walled the run's Normal/Fighting carry again and again: Brawly's Lv16 Dusclops, Juan's Lv46 Banette (three tries, with Double Team, Rest and Ice Beam) and Drake's Lv53 Dusclops. Drake ended four of the seven League losses. His Dusclops, healed with Full Restores, ended runs 1, 2 and 3, with Machoke out of PP or facing an immune target. Shiftry ended run 7.

### 3.9 Sedgehare

| Field | Value |
| --- | --- |
| Types | Moss |
| Role tag | crit_threat |
| Sprite | Text only |
| Tell | Ear edges glint `w` on a turn its next hit will crit |
| Teaching slot | Around the 4th or 5th Spire (est.) |
| Stats | None given. |

**Flavour.** A marsh hare whose long ears are blades of sawgrass. It sits still in the reeds until something steps close, then the ears come down. Reed-cutters have a saying: if the ears glint, step back.

**Ability: Keen Glint.** Raises its crit chance two stages. **Proposed, needs gameplay sign-off:** crits are rolled at the start of the turn for every creature, and when Sedgehare's next hit will crit, its ear edges glint `w`.

**Signature: Reap.**

| Property | Value |
| --- | --- |
| Type | Moss |
| Power | 70 |
| Effect | High crit rate (est.) |

**Shift.** Exists to teach the glint early, around the 4th or 5th Spire (est.). Its pool leans Moss and Grit.

**Counterplay.**
- Watch the ears. On a glint turn, switch to a creature that can take the crit, or guard.
- Brine, Kiln and Rime hit it for double.
- It resists Grit.

**From the run.** In Norman's gym, a trainer's Lv26 Bellossom landed Slash crits and swept the whole team. Norman fell on the second try. Crits stay in WILDSHIFT, and Sedgehare shows them before the player picks a move.

### 3.10 Wirewhisk

| Field | Value |
| --- | --- |
| Types | Bolt |
| Role tag | scout |
| Sprite | Text only |
| Tell | Copper coil of its tail hums when another creature is near |
| Stats | Low attack and low HP (est.); a support pick. |

**Flavour.** Harbour towns keep Wirewhisks to sniff out trouble. The copper coil of its tail hums when another creature is near. An experienced handler can tell from the hum what that creature knows.

**Ability: Tailhum.** On switch-in, reveals one foe move. Before the player owns the Scouting Prism, a Wirewhisk in the lead also adds the lead foe's moves to the Read card.

**Signature / Heartmark technique: Arc Ping.**

| Property | Value |
| --- | --- |
| Type | Bolt |
| Power | 30 |
| Priority | Moves first |
| Effect | Reveals the target's full moveset (est.) |
| Heartmark | Yes. The scouting move survives any Shift. |

**Shift.** Its pool is mostly Bolt and Gust. Read is available from the start; Wirewhisk adds moves early, before the Prism, for players who want the full read.

**Counterplay.**
- Moss, Stone and Rust hit it for double.
- It resists Grit.
- Low attack and low HP (est.) make it a support pick.

**From the run.** The run had no way to see a foe's ability or moves before committing. Wonder Guard was named only once a hit failed. A Route 120 trainer's Metagross wiped the team twice, and in League run 6 Glacia's Beautifly drained every Revive. Read covers abilities from the start. Wirewhisk adds moves early.

### 3.11 Rimeplate

| Field | Value |
| --- | --- |
| Types | Rime / Stone |
| Role tag | down_shift_example |
| Sprite | Text only |
| Hatchling | Chillnub (Rime): a small curled ball with one plate |
| Stats | Slow (est.). No other stat data. |

**Flavour.** Rimeplates cling to cold tide-pool rocks on the northern islands under eight overlapping plates of rime. Pry one loose and it curls into a ball. A Shift sometimes knocks a bonded one back to a hatchling, a Chillnub, that keeps the adult's level, its Heartmark technique and its trainer.

**Ability: Plateshed.** The first Strong hit each battle deals neutral damage, and one plate visibly falls off.

**Signature: Plate Toss.**

| Property | Value |
| --- | --- |
| Type | Rime |
| Power | 60 (est.) |
| Flavour | It throws one of its own plates. The thrown plate grows back at the end of that turn. |

**Shift (Down-Shift example).**
- Rimeplate can drop to its hatchling, Chillnub (Rime).
- Down-Shift rules for every family: level, EXP, held item, nickname, Bond, trained stat points and the Heartmark technique carry over.
- No base stat drops more than 10% (Drift) or 20% (Flux) in one Shift. Freefall has no floor.
- The Down card shows the stat change before the player accepts.

**Counterplay.**
- Kiln, Moss and Hollow hit it for double.
- It resists Plain, Gust, Rust and Glass.
- Once Plateshed is spent, Strong hits land in full.
- It is slow (est.).

**From the run.** Chaos evolutions went down as well as sideways. MUDDY dropped to a Wynaut inside the Fortree gym. Heracross became Armaldo and then Seviper. Crobat became Hariyama. A Lv19 Ludicolo became a Lv16 Rhydon, because the new species read EXP on a slower curve. None of these showed the outcome before it landed. The only control was a timed B press.

### 3.12 Squallcoil

| Field | Value |
| --- | --- |
| Types | Bolt / Brine |
| Role tag | errant |
| Sprite | Text only |
| Class | Errant: great creatures the Starfall scattered onto ordinary routes |
| Stats | None given. |

**Flavour.** A storm krait that never stays near one island. Fishers track it by the lightning walking across the sea.

**Ability: Skyroam.** It moves one route per in-game hour (est.). Once the player has seen it, it shows on the map.

**Signature: Bandlight.**

| Property | Value |
| --- | --- |
| Type | Bolt |
| Power | 90 (est.) |
| Tell | Its bands light in sequence the turn before it strikes. |

**Shift / Errant catching rules (apply to every Errant).**
- Capture uses the **Lantern**. Raise it, light draws the creature in, and a **3-segment glow meter** fills, with no throw arc, wobble or click.
- **Capture Stance**, taught by Corin and costing no move slot, stops the party's damage at 1 HP.
- Capture odds show before the player spends a Lantern.
- One-of-a-kind items need a confirm.
- A KO'd Errant returns after the next badge or 2 hours of play, whichever comes first.
- Proposed: on Drift and Flux, a caught Errant's Down card is never a hatchling. The Forecast still shows three cards.

**Counterplay.**
- Bolt and Rust hit it for double.
- It resists Kiln, Rime and Glass.
- Because it roams, a player can meet it early at a low level and still catch it fairly with Capture Stance and the visible odds.

**From the run.** Legendaries wandered ordinary routes: Jirachi Lv25, Rayquaza at Lv15, 26 and 27, Regice, Kyogre Lv26, Deoxys Lv36 and Groudon Lv40. A Jirachi and a Rayquaza were KO'd by accident while trying to catch them. A Rayquaza was caught with a Great Ball after four Ultra Balls failed; Deoxys took about six Ultra Balls. A remembered bag cursor turned a scripted "down" press into a Master Ball thrown at a Lv26 Kyogre. Later, a Lv34 Rayquaza Chaos-evolved down into a Trapinch.

### 3.13 Tossup

| Field | Value |
| --- | --- |
| Types | Plain |
| Role tag | wild_card_common |
| Sprite | Text only |
| Stats | Weak until its first Shift (est.). |

**Flavour.** The most common creature on the islands and the least predictable. A Tossup is a small hermit crab that lives in whatever it finds: a bottle, a teacup, a net float. When it Shifts it can become almost anything, so island children treat them like lottery tickets.

**Ability: Blank Slate.** Its Heartmark can carry **any one of its techniques, chosen at its first Shift**. Other species carry a fixed one. Proposed: the gameplay section owns how Heartmark techniques are picked.

**Signature: Sure Pinch.**

| Property | Value |
| --- | --- |
| Type | Plain |
| Power | 40 |
| Accuracy | Never misses (est.) |
| Role | An early sure-hit move against evasion. |

**Shift.**
- Wild-card pool: one form per type, **12 forms** (est.), split evenly inside each card.
- Lets a player put full chaos in one party slot while the rest of the team stays steady.
- Star-touched stays at the fixed ~2% like every family.

**Counterplay.**
- Grit and Rust hit it for double.
- Its stats are weak until its first Shift (est.).

**From the run.** About 15 Chaos evolutions in 45 hours gave the run most of its stories. Tossup keeps that lottery as one party slot the player opts into. Sure Pinch is a small early answer to evasion, the problem behind League runs 4, 5 and 6 at Wallace's Latias.

### 3.14 Stillox

| Field | Value |
| --- | --- |
| Types | Stone |
| Role tag | unshifting_titan |
| Sprite | Text only |
| Faction | Emblem of the Mooring (its horns are carved on their banners) |
| Stats | None given. |

**Flavour.** The oldest line of creatures on the islands, and the only one that has never Shifted. A bonded Stillox lights its Heartmark like any other creature, but the mark only ever sits on one body. The Mooring treats it as proof that stillness is possible.

**Ability: Unshifting.** It cannot Shift and its type never changes. Any effect that would force a type or form change fails against it.

**Signature: Bedrock Charge.**

| Property | Value |
| --- | --- |
| Type | Stone |
| Power | 100 (est.) |
| Timing | Braces for one turn while dust falls from its columns, then hits. |

**Shift.**
- Stillox is the only ordinary species outside the Shift system. Vagary, the comet itself, also never Shifts.
- The **Still Knot**, a held item, blocks Shifts for any creature that holds it.
- Proposed lore: the Mooring weaves Still Knots from shed Stillox hair.

**Counterplay.**
- Moss and Hollow hit it for double.
- It resists Plain, Brine and Glass.
- Bedrock Charge telegraphs a turn ahead, so switch or guard.

**From the run.** Early on, a rule was set: cancel evolutions on liked creatures by pressing B. The press had to land in a short window and missed several times: Flygon became Wailmer, Armaldo became Seviper, and a Lv34 Rayquaza became a Trapinch. Stillox is the species version of "keep this one". The Still Knot is the item version.

### 3.15 Caldermaw

| Field | Value |
| --- | --- |
| Types | Kiln / Stone |
| Role tag | rival_opener |
| Sprite | Text only |
| Owner | Linnet Rask (rival); her opening creature becomes one in her first battle |
| Down form | Sootling (Kiln): a palm-sized ember grub |
| Stats | None given. |

**Flavour.** A volcanic titan that dens in the lava tubes of the islands. Linnet Rask's opening creature becomes one in her first battle. Later it Shifts down into Sootling, and her story turns on that.

**Ability: Furnace Jaw.** Its first Kiln move each battle never misses.

**Signature: Kiln Maw.**

| Property | Value |
| --- | --- |
| Type | Kiln |
| Power | 75 (est.) |

**Shift (opening rival rule).**
- Linnet's Caldermaw is a scripted **Lv5** story Shift on every dial, run as a scripted boss Shift with a posted Forecast.
- The first fight is a "hold out 3 turns" scene that continues on any result.
- The rematch and later teams follow the dial.
- Its later Shift down into Sootling (Kiln) belongs to the story section.

**Counterplay.**
- Grit, Gust and Hollow hit it for double.
- It resists Plain, Rime and Glass.
- In the opening scene the player is meant to hold out for 3 turns. Winning is optional.

**From the run.** The "Identity Crisis" banner fired in Oldale. Then rival May's Lv5 Groudon won on Route 103; MUDDY was ground to Lv11-12 for the rematch. Groudon came back as the Route 117 twins' Wonder Guard wall (lost twice) and as a wild Lv40 in Victory Road. Sootling echoes the Lv34 Rayquaza that Chaos-evolved down into a Trapinch.

---

## 3A. Forms referenced without a full entry

These names appear inside creature entries or the Sloshkin pool table but have no brief of their own in this section.

| Form | Types | Where it appears | What is known |
| --- | --- | --- | --- |
| Bilgebob | Brine | Brinelance entry | Round, slow floating whale; harbour mouths. Ability Sodden (no self-KO moves on the field). Learns Gnash. Must not read as Wailmer or Cetoddle. |
| Sootling | Kiln | Caldermaw entry | Palm-sized ember grub. Caldermaw's scripted Down-Shift (story). Linnet's Act III-IV lead after two more off-screen Shifts. |
| Chillnub | Rime | Rimeplate entry; Sloshkin pool (Down, other family's hatchling) | Small curled ball with one plate. Rimeplate's hatchling. |
| Knuckleback | Grit | Scrapling entry | Scrapling's forward line, stage after Scrapling. |
| Cragmitt | Grit / Stone | Scrapling entry | Scrapling's forward line, stage after Knuckleback. |
| Siltback | Brine / Stone | Sloshkin pool (Up: forward, stage 2) | Sloshkin's planned forward line. Side card from Skeinwing. |
| Bogmonarch | Brine / Stone | Sloshkin pool (Up: skip-ahead, stage 3) | Sloshkin's stage-3 skip-ahead. Up card from Skeinwing. |
| Lumenveil | Glass | Sloshkin pool (Up: other family, stage 3) | Other-family stage 3. Up card from Skeinwing. |
| Mudfist | Grit | Sloshkin pool (Side: other family, stage 1) | Other-family stage 1. |
| Rushling | Moss / Brine | Sloshkin pool (Side: other family, stage 1) | Other-family stage 1. |
| Puddlepip | Brine | Sloshkin pool (Down: own hatchling) | Sloshkin's own hatchling. |
| Star-touched Sloshkin | Brine / Star | Sloshkin pool (takes the Side card's slot) | Fixed ~2% appearance; story hook for the Vagary. |

Derived defensive profiles for these forms (dual types multiplied):

| Form | Types | x2 | x0.5 | x0.25 |
| --- | --- | --- | --- | --- |
| Bilgebob | Brine | Grit, Bolt | Kiln, Moss, Rime, Stone, Glass | - |
| Sootling | Kiln | Grit, Brine, Gust | Moss, Rime | - |
| Chillnub | Rime | Brine, Kiln | Gust, Rust | - |
| Knuckleback | Grit | Gust, Glass | - | - |
| Cragmitt | Grit/Stone | Moss, Gust, Hollow | Plain, Brine | - |
| Siltback | Brine/Stone | Grit, Bolt, Hollow | Plain, Brine, Kiln, Rime, Stone | Glass |
| Bogmonarch | Brine/Stone | Grit, Bolt, Hollow | Plain, Brine, Kiln, Rime, Stone | Glass |
| Lumenveil | Glass | Kiln, Stone, Hollow | Grit, Moss, Bolt, Rust | - |
| Mudfist | Grit | Gust, Glass | - | - |
| Rushling | Moss/Brine | Brine, Bolt | Moss, Stone, Glass | - |
| Puddlepip | Brine | Grit, Bolt | Kiln, Moss, Rime, Stone, Glass | - |
| Star-touched Sloshkin | Brine/Star | Grit, Bolt | Kiln, Moss, Rime, Stone, Glass | - |

## 3B. Items, people and mechanics referenced in the creature entries

| Name | Kind | What the creature section says |
| --- | --- | --- |
| Starsalt | Currency / consumable | Refined from skyglass dust by the Scatter. Pays for Forecast Rerolls (1, 2, 4 escalating within one Shift, no hard cap). The 1st Spire teaches Reroll and gives the first Starsalt. |
| Anchor stone | Consumable | Cancels the current Shift. Drift issues them free and refills at each badge; Flux sells them at Shelters; Freefall allows at most 1 per badge. The Mooring offers them. |
| Still Knot | Held item | Blocks Shifts for any creature that holds it. Proposed lore: woven by the Mooring from shed Stillox hair. |
| Crackdust | Consumable | Suppresses a Ward. Guaranteed in stock at the Shelter before any mandatory Ward trainer, priced below one route trainer's payout. |
| Chip-damage disc (poison or trap) | Move disc | One is guaranteed by badge 1 (answers Ward). |
| Plumbline disc | Move disc | From the 7th Spire. Always hits, clears the target's stat stages and blocks re-boosting for 2 turns. The guaranteed answer to Afterimage. |
| Gnash disc | Move disc | Given by Linnet Rask in the story (win or lose at the Shardcrown gate). Hollow move that pops one Afterimage per hit. |
| Scouting Prism | Key item | From the 3rd Spire. Adds moves, held items and heal pips to the Read card. |
| Read | Action | Available from the start. Reveals a foe's ability and any Ward into the Field Log. |
| Lantern | Capture item | Raise it; light draws the creature in; a 3-segment glow meter fills. No throw arc, wobble or click. Odds shown before spending one. |
| Capture Stance | Taught technique | Taught by Corin; costs no move slot; stops the party's damage at 1 HP. |
| Mend pips | Battle resource | Every creature has a battle budget of 3 Mends shown as pips. |
| Bench EXP | Rule | Every non-battler gets a 60% bench share of EXP. |
| Evasion cap | Rule | +2 stages. |
| Shelter | Location | Shop. Sells anchor stones on Flux; stocks Crackdust. |
| Waystone | Location | Deferred Shifts resolve together at the next Waystone. |
| Spires (1st-8th) | Progression | Badge-equivalent tests. 1st teaches Reroll; 3rd gives Scouting Prism; 4th/5th introduce Sedgehare's glint; 7th gives Plumbline. |
| Idris Fenwake | Character | The Champion. His anchor ring anchors his Vesperay. |
| Linnet Rask | Character | The rival. Opens with the creature that becomes Caldermaw at Lv5. |
| Corin | Character | Teaches Capture Stance. |
| The Mooring | Faction | Wants change stopped. Emblem: Stillox. Offers anchor stones. |
| The Scatter | Faction | Wants more change. Refines skyglass into Starsalt. |
| Heartshard | Story object | Rides with the returning comet; reached only via a sea stack. |
| Dials: Drift / Flux / Freefall | Difficulty setting | Set Forecast card odds, stat floors, anchor supply, badge visibility and silhouette rules. Freefall approximates Chaos V2. Custom allows hidden odds (Proposed). |

---

## 4. Types

Thirteen types: twelve ordinary types plus Star. Abbreviations are the three-letter column heads used in the source chart.

| # | Type | Abbr | Badge key | Theme | Strong against (deals 2x) | Resisted by (deals 0.5x) | No effect on (0x) | Takes double from | Resists (takes 0.5x) | Immune to |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Plain | Pla | `v` | Everyday bodies and blows. | none | Stone | Hollow | Grit, Rust | none | - |
| 2 | Grit | Gri | `u` | Fists, grapples and grinding sand. | Plain, Brine, Kiln, Rust | Moss, Bolt, Glass | Hollow | Gust, Glass | none | - |
| 3 | Brine | Bri | `b` | Salt sea. | Kiln, Moss, Rime | Stone, Rust | - | Grit, Bolt | Kiln, Moss, Rime, Stone, Glass | - |
| 4 | Kiln | Kil | `o` | Flame, forges and kilns. | Moss, Rime, Glass, Hollow | Brine, Rust | - | Grit, Brine, Gust | Moss, Rime | - |
| 5 | Moss | Mos | `g` | Roots, lichen and reeds. | Bolt, Stone, Rust | Brine, Kiln, Glass | - | Brine, Kiln, Rime | Grit | - |
| 6 | Bolt | Bol | `y` | Lightning and current. | Brine, Gust | Glass | - | Moss, Stone, Rust | Grit | - |
| 7 | Rime | Rim | `s` | Ice and hard cold. | Moss, Gust, Rust | Brine, Kiln | - | Brine, Kiln | Gust, Rust | - |
| 8 | Gust | Gus | `w` | Wind and flight. | Grit, Kiln, Hollow | Rime | - | Bolt, Rime | Stone, Hollow | - |
| 9 | Stone | Sto | `e` | Rock, cliffs and sea stacks. | Bolt, Glass | Brine, Gust | - | Moss, Hollow | Plain, Brine, Glass | - |
| 10 | Rust | Rus | `r` | Corrosion, scrap and old iron. | Plain, Bolt | Rime, Glass | - | Grit, Moss, Rime | Brine, Kiln, Glass, Hollow | - |
| 11 | Glass | Gla | `i` | Skyglass, mirrors and light. | Grit, Hollow | Brine, Stone, Rust | - | Kiln, Stone, Hollow | Grit, Moss, Bolt, Rust | - |
| 12 | Hollow | Hol | `p` | Spirits, echoes and empty places. | Stone, Glass | Gust, Rust | - | Kiln, Gust, Glass | none | Plain, Grit |
| 13 | Star | Sta | `d` with a `y` comet glyph | Comet creatures only. | none (neutral to all) | none | - | none | none | - |

### 4.1 Type descriptions (source wording)

| Type | World logic |
| --- | --- |
| Plain | Stone shrugs off a plain blow, and it passes straight through Hollow. |
| Grit | Sand smothers a kiln and soaks up brine, and grit scours rust. A fist sinks into moss, numbs on a live current and skids off glass. |
| Brine | Salt quenches a kiln, melts rime and kills roots. A sea stack stands against it, and salt only feeds rust. |
| Kiln | A kiln slumps glass, melts rime, burns moss and burns off shadow. Salt quenches it, rust is already burnt, and wind starves it. |
| Moss | Roots crack stone, swallow old iron and ground a current. Salt, heat and glass stop them. |
| Bolt | It runs through salt water and strikes what flies. Glass insulates against it, and roots ground it. |
| Rime | Cold kills roots, grounds wings and makes iron brittle. Salt water and heat shrug it off. |
| Gust | Wind starves a flame, throws a fighter and scatters echoes. |
| Stone | Stone shatters glass and grounds lightning. Roots crack it, and caves are hollow stone. |
| Rust | Rust eats everyday things and breaks circuits. Salt feeds it, a flame finds nothing left to burn, and cold iron wards off spirits. |
| Glass | A mirror shows what is hollow and turns a fighter's blow. Stone shatters glass and Hollow haunts it. |
| Hollow | Plain and Grit pass straight through it. This is the one deliberate homage: the wall that stopped the run's Normal/Fighting Machoke. |
| Star | Badge `d` with a `y` comet glyph, because comet magenta `m` never goes on UI icons. Comet creatures only: Vagary and Star-touched forms. Star sits outside the chart. It deals and takes neutral damage against every type. A Star-touched form's other type still counts for damage it takes. |

---

## 5. Type chart

Status: **Proposed, all values est. until playtest.**

Rows attack, columns defend. **2** = double damage (Strong). **½** = half damage (Weak). **0** = no effect (Blocked / immune). **·** = neutral (1x). Dual types multiply.

| Attack ↓ / Defend → | Pla | Gri | Bri | Kil | Mos | Bol | Rim | Gus | Sto | Rus | Gla | Hol | Sta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Plain** | · | · | · | · | · | · | · | · | ½ | · | · | **0** | · |
| **Grit** | **2** | · | **2** | **2** | ½ | ½ | · | · | · | **2** | ½ | **0** | · |
| **Brine** | · | · | · | **2** | **2** | · | **2** | · | ½ | ½ | · | · | · |
| **Kiln** | · | · | ½ | · | **2** | · | **2** | · | · | ½ | **2** | **2** | · |
| **Moss** | · | · | ½ | ½ | · | **2** | · | · | **2** | **2** | ½ | · | · |
| **Bolt** | · | · | **2** | · | · | · | · | **2** | · | · | ½ | · | · |
| **Rime** | · | · | ½ | ½ | **2** | · | · | **2** | · | **2** | · | · | · |
| **Gust** | · | **2** | · | **2** | · | · | ½ | · | · | · | · | **2** | · |
| **Stone** | · | · | ½ | · | · | **2** | · | ½ | · | · | **2** | · | · |
| **Rust** | **2** | · | · | · | · | **2** | ½ | · | · | · | ½ | · | · |
| **Glass** | · | **2** | ½ | · | · | · | · | · | ½ | ½ | · | **2** | · |
| **Hollow** | · | · | · | · | · | · | · | ½ | **2** | ½ | **2** | · | · |
| **Star** | · | · | · | · | · | · | · | · | · | · | · | · | · |

### 5.1 Same chart as a Strong / Weak / Blocked list

| Attacking type | Strong (2x) vs | Weak (0.5x) vs | Blocked (0x) vs |
| --- | --- | --- | --- |
| Plain | - | Stone | Hollow |
| Grit | Plain, Brine, Kiln, Rust | Moss, Bolt, Glass | Hollow |
| Brine | Kiln, Moss, Rime | Stone, Rust | - |
| Kiln | Moss, Rime, Glass, Hollow | Brine, Rust | - |
| Moss | Bolt, Stone, Rust | Brine, Kiln, Glass | - |
| Bolt | Brine, Gust | Glass | - |
| Rime | Moss, Gust, Rust | Brine, Kiln | - |
| Gust | Grit, Kiln, Hollow | Rime | - |
| Stone | Bolt, Glass | Brine, Gust | - |
| Rust | Plain, Bolt | Rime, Glass | - |
| Glass | Grit, Hollow | Brine, Stone, Rust | - |
| Hollow | Stone, Glass | Gust, Rust | - |
| Star | - | - | - |

### 5.2 Chart shape

- 56 strong, weak or no-effect pairings (verified: 2 + 8 + 5 + 6 + 6 + 3 + 5 + 4 + 4 + 4 + 5 + 4 across the twelve attacking rows).
- The only immunity is Hollow against Plain and Grit.
- Every type takes double from 2 or 3 types.
- Star is neutral both ways.
- The move panel shows **Strong, Neutral, Weak, No effect or Blocked by Ward** before the player picks.
- Ward (section 1.6) is a separate layer on top of the chart: with Prism Ward only Strong hits land, regardless of this table.

### 5.3 Chart diff versus Pokemon (for counsel)

Status: Proposed. Counsel review: Not started.

**Method.** Each WILDSHIFT type maps to its closest Pokemon type:

| WILDSHIFT | Pokemon |
| --- | --- |
| Plain | Normal |
| Grit | Fighting |
| Brine | Water |
| Kiln | Fire |
| Moss | Grass |
| Bolt | Electric |
| Rime | Ice |
| Gust | Flying |
| Hollow | Ghost |
| Stone | Rock or Ground |
| Rust | Steel or Poison |
| Glass | Psychic or Fairy |

A pairing counts as the same as Pokemon's if any mapped pair goes the same direction (both strong, or both weak or no effect). This rule counts generously against WILDSHIFT.

**Result.**
- WILDSHIFT has 56 strong, weak or no-effect pairings. 32 of them (57%) differ from Pokemon's. 24 match.
- Going the other way (Stone as Rock, Rust as Steel, Glass as Psychic): Pokemon has 58 such pairings among these types, and 36 of them are neutral or reversed in WILDSHIFT.
- Star sits outside the chart and is neutral both ways.

**The one deliberate homage.** Hollow is immune to Plain and Grit. It is the wall that stopped the run's Normal/Fighting Machoke (Brawly's Dusclops, Juan's Banette, Drake's Dusclops). It is the only immunity in the chart.

**The 24 matches.** Two are the homage (Plain>Hollow 0, Grit>Hollow 0). The other 22 come mostly from shared physical logic; Hollow>Glass 2 comes from the world rule that Hollow haunts glass:

| Match | Value |
| --- | --- |
| Plain > Stone | ½ |
| Grit > Plain | 2 |
| Grit > Rust | 2 |
| Grit > Glass | ½ |
| Brine > Kiln | 2 |
| Kiln > Brine | ½ |
| Kiln > Moss | 2 |
| Kiln > Rime | 2 |
| Moss > Kiln | ½ |
| Moss > Stone | 2 |
| Bolt > Brine | 2 |
| Bolt > Gust | 2 |
| Rime > Brine | ½ |
| Rime > Kiln | ½ |
| Rime > Moss | 2 |
| Rime > Gust | 2 |
| Gust > Grit | 2 |
| Stone > Bolt | 2 |
| Stone > Gust | ½ |
| Glass > Grit | 2 |
| Glass > Rust | ½ |
| Hollow > Glass | 2 |

**Next step.** In pre-production the systems designer produces the full side-by-side table for counsel. US copyright does not protect game mechanics as such; patents can, so counsel reviews both. The goal is a chart that does not read as a reskin.

---

## 6. Example Shift table: Sloshkin family (hidden pool weights)

The player never sees this table. They see three Forecast cards. The dial sets the odds on each card. This table sets which form lands on each card.

### 6.1 Card odds by dial (base, before Bond)

| Card | Drift | Flux | Freefall |
| --- | --- | --- | --- |
| Up | 50% | 40% | [NEED SOURCE] |
| Side | 40% | 35% | [NEED SOURCE] |
| Down | 10% | 25% | [NEED SOURCE] |

- Freefall approximates Chaos V2. Its odds stay [NEED SOURCE] until someone measures them from the ~15 logged Chaos evolutions.
- **Bond** moves points from Down to Up, capped at **+15 on Flux** and **+10 on Freefall**. (No cap is stated for Drift.)
- Bond pips come from story beats and Heartmark-technique use.

### 6.2 Pool weights inside each card (as seen from Sloshkin)

| Form | Types | Card | Drift | Flux | Freefall | Run moment it echoes |
| --- | --- | --- | --- | --- | --- | --- |
| Siltback | Brine/Stone | Up: forward, stage 2 | 70 | 45 | 25 | The planned line |
| Skeinwing | Brine/Gust | Up: Shift-only form, stage 2 | 20 | 25 | 25 | MUDDY became an Altaria on Mt Pyre at Lv30 |
| Bogmonarch | Brine/Stone | Up: skip-ahead, stage 3 | 10 | 15 | 25 | MUDDY went from Mudkip to Swampert at Lv16, skipping Marshtomp |
| Lumenveil | Glass | Up: other family, stage 3 | 0 | 15 | 25 | MUDDY ended as a Gardevoir in the Magma Hideout |
| Mudfist | Grit | Side: other family, stage 1 | 50 | 50 | 50 | MUDDY became a Machop at Lv20 |
| Rushling | Moss/Brine | Side: other family, stage 1 | 50 | 50 | 50 | MUDDY became a Ludicolo at Lv27 |
| Puddlepip | Brine | Down: own hatchling | 100 | 70 | 50 | MUDDY became a Wynaut in the Fortree gym |
| Chillnub | Rime | Down: other family's hatchling | 0 | 30 | 50 | A Lv34 Rayquaza Chaos-evolved down into a Trapinch |
| Star-touched Sloshkin | Brine/Star | Takes the Side card's slot | ~2% | ~2% | ~2% | No run equivalent. Story hook for the Vagary |

- Weights are per card and sum to 100 within each card on each dial (Up: 70+20+10+0, 45+25+15+15, 25+25+25+25; Side: 50+50; Down: 100+0, 70+30, 50+50).
- 0 means the form never appears on that dial.
- Freefall flattens the weights inside each card.
- All weights are estimates for tuning.
- The Star-touched row is not a weight inside a card; it is a fixed ~2% chance per Forecast that the Side card is replaced by the Star-touched form.

### 6.3 Rules

| Rule | Detail |
| --- | --- |
| Three cards, no fourth outcome | The game draws one form for each card from that card's rows, by weight. Accept always lands on one of the three cards shown. |
| Star-touched | A fixed ~2% of Forecasts on every dial, outside any flattening, show the Star-touched form in the Side card's slot at the Side card's odds. It is a card the player can see, so the rule of no hidden fourth outcome holds. The chance of actually becoming Star-touched is therefore under 1% per Forecast on Drift and Flux (about 0.8% and 0.7%, est.: 2% x 40%, 2% x 35%). On Freefall it depends on the Side odds, which are [NEED SOURCE]. |
| Directions follow the current form | Up is a higher stage, Side is the same stage, Down is a lower stage. From Skeinwing, Siltback is a Side card and Sloshkin is a Down card. Every stage keeps at least one form per card. A top-stage form draws its Up card from other families' stronger forms, and a hatchling draws its Down card from weaker hatchlings (pool-building rules, est.). |
| Current form | Its own row drops out, and its weight spreads across the other forms on its card in proportion. |
| Shiftlog pull (Proposed) | Each form already in this creature's Shiftlog gets +5 weight on its card (est.), so a creature drifts back toward bodies it has been. |
| Silhouettes | Unseen forms show as silhouettes on Freefall only. On Drift and Flux every card shows in full. |
| Accept | Plays the roll. |
| Reroll | Redraws all three cards from the same weights. Costs Starsalt, escalating 1, 2, 4 within one Shift, with no hard cap. The 1st Spire teaches it and gives the first Starsalt. |
| Anchor | Spends one anchor stone and cancels this Shift. Drift issues anchor stones free and refills them at each badge. Flux sells them at Shelters. Freefall allows at most 1 per badge. |
| Timing input | None anywhere. |
| Windows | About 3 per creature over a run, tied to the island level curve. For Sloshkin: about Lv9, Lv20 and Lv34 (est.). Deferred Shifts resolve together at the next Waystone. Per-creature presets: auto-Anchor, auto-accept Up. Target: at most ~1 Forecast per 30 minutes of play. |
| What carries | Level, EXP, held item, nickname, Bond, trained stat points and the Heartmark technique (Undertow for this family). Per-stat floor: no base stat drops more than 10% (Drift) or 20% (Flux) per Shift. No floor on Freefall. The Down card shows the stat change before Accept. |
| Battles | The player's creatures never Shift in battle. Trainer creatures never Shift mid-battle, except scripted boss Shifts: named boss trainers may Shift their own creatures, and each scripted boss Shift gets a posted Forecast. |
| Hidden odds only in Custom (Proposed) | Rolls with hidden odds exist only as a Custom toggle. Drift, Flux and Freefall always show the odds on all three cards. |

### 6.4 Worked example: resolving one Sloshkin Forecast on Drift

1. Roll the card the player will land on if they Accept: Up 50%, Side 40%, Down 10% (plus any Bond shift from Down to Up).
2. Independently of that, with ~2% probability the Side slot shows Star-touched Sloshkin instead of a Side-pool form.
3. Draw one form for each card by weight: Up from {Siltback 70, Skeinwing 20, Bogmonarch 10, Lumenveil 0}; Side from {Mudfist 50, Rushling 50}; Down from {Puddlepip 100, Chillnub 0}.
4. Show the three cards face-up with their odds (Drift never shows silhouettes). Every form shown becomes "Seen" in the Field Log.
5. Player chooses Accept (resolve), Reroll (Starsalt 1, then 2, then 4...; redraw all three) or Anchor (spend an anchor stone; no Shift).
6. On Accept, apply the form; carry level, EXP, held item, nickname, Bond, trained stat points and Undertow; clamp any base-stat drop to 10%; append the form to the Shiftlog; mark it "Held".

---

## 7. Machine-readable data (JSON)

Generated from the tables above. `typeChart[attacker][defender]` gives the multiplier (2, 1, 0.5 or 0); dual types multiply. `null` marks a value the source does not give (including every `[NEED SOURCE]`). `est: true` on a move means the source marked at least one of its numbers as an estimate. Each creature's `defense` block is derived from the chart.

```json
{
 "meta": {
  "source": "Wildshift_Pitch.md lines 698-1252",
  "status": "Proposed; all numbers est. until playtest",
  "rosterCount": 15,
  "launchTarget": {"species": 100, "families": 30, "est": true},
  "spriteSizes": {"concept": 32, "battle": 64, "largeLegendary": 96},
  "paletteKeyNote": "Single-letter master palette keys; hex values live in the visuals section."
 },
 "heartmark": {"colourKey": "m", "shapeAt3px": "plus", "shapeAt5px": "plus with diagonal glints", "highlightCool": "w", "highlightWarm": "y", "highlightOnWhiteBody": "y", "samePositionAcrossForms": true, "lightsOnBond": true, "wildShowNone": true, "techniqueSurvivesEveryShift": true, "techniqueKeepsStab": "Proposed"},
 "shiftGlobals": {
  "neverTouches": ["level", "EXP", "held item", "nickname", "Bond", "trained stat points", "Heartmark technique"],
  "statFloorPerShift": {"Drift": 0.1, "Flux": 0.2, "Freefall": null},
  "forecastCards": ["Up", "Side", "Down"],
  "windowsPerCreature": 3,
  "ward": {"tell": "hex-lattice shimmer about every 4 s plus 'Ward ?' badge", "freefallBadge": "after first blocked hit", "afterBlockedHit": "readout lists which party techniques can land"},
  "fieldLogStates": ["Seen", "Read", "Held"],
  "evasionCap": 2,
  "mendBudgetPerBattle": 3,
  "benchExpShare": 0.6
 },
 "types": [
  {"id": "plain", "name": "Plain", "abbr": "Pla", "badgePaletteKey": "v", "description": "Everyday bodies and blows.", "strongAgainst": [], "resistedBy": ["Stone"], "noEffectOn": ["Hollow"], "takesDoubleFrom": ["Grit", "Rust"], "resists": [], "immuneTo": []},
  {"id": "grit", "name": "Grit", "abbr": "Gri", "badgePaletteKey": "u", "description": "Fists, grapples and grinding sand.", "strongAgainst": ["Plain", "Brine", "Kiln", "Rust"], "resistedBy": ["Moss", "Bolt", "Glass"], "noEffectOn": ["Hollow"], "takesDoubleFrom": ["Gust", "Glass"], "resists": [], "immuneTo": []},
  {"id": "brine", "name": "Brine", "abbr": "Bri", "badgePaletteKey": "b", "description": "Salt sea.", "strongAgainst": ["Kiln", "Moss", "Rime"], "resistedBy": ["Stone", "Rust"], "noEffectOn": [], "takesDoubleFrom": ["Grit", "Bolt"], "resists": ["Kiln", "Moss", "Rime", "Stone", "Glass"], "immuneTo": []},
  {"id": "kiln", "name": "Kiln", "abbr": "Kil", "badgePaletteKey": "o", "description": "Flame, forges and kilns.", "strongAgainst": ["Moss", "Rime", "Glass", "Hollow"], "resistedBy": ["Brine", "Rust"], "noEffectOn": [], "takesDoubleFrom": ["Grit", "Brine", "Gust"], "resists": ["Moss", "Rime"], "immuneTo": []},
  {"id": "moss", "name": "Moss", "abbr": "Mos", "badgePaletteKey": "g", "description": "Roots, lichen and reeds.", "strongAgainst": ["Bolt", "Stone", "Rust"], "resistedBy": ["Brine", "Kiln", "Glass"], "noEffectOn": [], "takesDoubleFrom": ["Brine", "Kiln", "Rime"], "resists": ["Grit"], "immuneTo": []},
  {"id": "bolt", "name": "Bolt", "abbr": "Bol", "badgePaletteKey": "y", "description": "Lightning and current.", "strongAgainst": ["Brine", "Gust"], "resistedBy": ["Glass"], "noEffectOn": [], "takesDoubleFrom": ["Moss", "Stone", "Rust"], "resists": ["Grit"], "immuneTo": []},
  {"id": "rime", "name": "Rime", "abbr": "Rim", "badgePaletteKey": "s", "description": "Ice and hard cold.", "strongAgainst": ["Moss", "Gust", "Rust"], "resistedBy": ["Brine", "Kiln"], "noEffectOn": [], "takesDoubleFrom": ["Brine", "Kiln"], "resists": ["Gust", "Rust"], "immuneTo": []},
  {"id": "gust", "name": "Gust", "abbr": "Gus", "badgePaletteKey": "w", "description": "Wind and flight.", "strongAgainst": ["Grit", "Kiln", "Hollow"], "resistedBy": ["Rime"], "noEffectOn": [], "takesDoubleFrom": ["Bolt", "Rime"], "resists": ["Stone", "Hollow"], "immuneTo": []},
  {"id": "stone", "name": "Stone", "abbr": "Sto", "badgePaletteKey": "e", "description": "Rock, cliffs and sea stacks.", "strongAgainst": ["Bolt", "Glass"], "resistedBy": ["Brine", "Gust"], "noEffectOn": [], "takesDoubleFrom": ["Moss", "Hollow"], "resists": ["Plain", "Brine", "Glass"], "immuneTo": []},
  {"id": "rust", "name": "Rust", "abbr": "Rus", "badgePaletteKey": "r", "description": "Corrosion, scrap and old iron.", "strongAgainst": ["Plain", "Bolt"], "resistedBy": ["Rime", "Glass"], "noEffectOn": [], "takesDoubleFrom": ["Grit", "Moss", "Rime"], "resists": ["Brine", "Kiln", "Glass", "Hollow"], "immuneTo": []},
  {"id": "glass", "name": "Glass", "abbr": "Gla", "badgePaletteKey": "i", "description": "Skyglass, mirrors and light.", "strongAgainst": ["Grit", "Hollow"], "resistedBy": ["Brine", "Stone", "Rust"], "noEffectOn": [], "takesDoubleFrom": ["Kiln", "Stone", "Hollow"], "resists": ["Grit", "Moss", "Bolt", "Rust"], "immuneTo": []},
  {"id": "hollow", "name": "Hollow", "abbr": "Hol", "badgePaletteKey": "p", "description": "Spirits, echoes and empty places.", "strongAgainst": ["Stone", "Glass"], "resistedBy": ["Gust", "Rust"], "noEffectOn": [], "takesDoubleFrom": ["Kiln", "Gust", "Glass"], "resists": [], "immuneTo": ["Plain", "Grit"]},
  {"id": "star", "name": "Star", "abbr": "Sta", "badgePaletteKey": "d", "description": "Comet creatures only (Vagary and Star-touched forms). Outside the chart; neutral both ways. Badge d with a y comet glyph.", "strongAgainst": [], "resistedBy": [], "noEffectOn": [], "takesDoubleFrom": [], "resists": [], "immuneTo": []}
 ],
 "typeChart": {
  "Plain": {"Plain": 1, "Grit": 1, "Brine": 1, "Kiln": 1, "Moss": 1, "Bolt": 1, "Rime": 1, "Gust": 1, "Stone": 0.5, "Rust": 1, "Glass": 1, "Hollow": 0, "Star": 1},
  "Grit": {"Plain": 2, "Grit": 1, "Brine": 2, "Kiln": 2, "Moss": 0.5, "Bolt": 0.5, "Rime": 1, "Gust": 1, "Stone": 1, "Rust": 2, "Glass": 0.5, "Hollow": 0, "Star": 1},
  "Brine": {"Plain": 1, "Grit": 1, "Brine": 1, "Kiln": 2, "Moss": 2, "Bolt": 1, "Rime": 2, "Gust": 1, "Stone": 0.5, "Rust": 0.5, "Glass": 1, "Hollow": 1, "Star": 1},
  "Kiln": {"Plain": 1, "Grit": 1, "Brine": 0.5, "Kiln": 1, "Moss": 2, "Bolt": 1, "Rime": 2, "Gust": 1, "Stone": 1, "Rust": 0.5, "Glass": 2, "Hollow": 2, "Star": 1},
  "Moss": {"Plain": 1, "Grit": 1, "Brine": 0.5, "Kiln": 0.5, "Moss": 1, "Bolt": 2, "Rime": 1, "Gust": 1, "Stone": 2, "Rust": 2, "Glass": 0.5, "Hollow": 1, "Star": 1},
  "Bolt": {"Plain": 1, "Grit": 1, "Brine": 2, "Kiln": 1, "Moss": 1, "Bolt": 1, "Rime": 1, "Gust": 2, "Stone": 1, "Rust": 1, "Glass": 0.5, "Hollow": 1, "Star": 1},
  "Rime": {"Plain": 1, "Grit": 1, "Brine": 0.5, "Kiln": 0.5, "Moss": 2, "Bolt": 1, "Rime": 1, "Gust": 2, "Stone": 1, "Rust": 2, "Glass": 1, "Hollow": 1, "Star": 1},
  "Gust": {"Plain": 1, "Grit": 2, "Brine": 1, "Kiln": 2, "Moss": 1, "Bolt": 1, "Rime": 0.5, "Gust": 1, "Stone": 1, "Rust": 1, "Glass": 1, "Hollow": 2, "Star": 1},
  "Stone": {"Plain": 1, "Grit": 1, "Brine": 0.5, "Kiln": 1, "Moss": 1, "Bolt": 2, "Rime": 1, "Gust": 0.5, "Stone": 1, "Rust": 1, "Glass": 2, "Hollow": 1, "Star": 1},
  "Rust": {"Plain": 2, "Grit": 1, "Brine": 1, "Kiln": 1, "Moss": 1, "Bolt": 2, "Rime": 0.5, "Gust": 1, "Stone": 1, "Rust": 1, "Glass": 0.5, "Hollow": 1, "Star": 1},
  "Glass": {"Plain": 1, "Grit": 2, "Brine": 0.5, "Kiln": 1, "Moss": 1, "Bolt": 1, "Rime": 1, "Gust": 1, "Stone": 0.5, "Rust": 0.5, "Glass": 1, "Hollow": 2, "Star": 1},
  "Hollow": {"Plain": 1, "Grit": 1, "Brine": 1, "Kiln": 1, "Moss": 1, "Bolt": 1, "Rime": 1, "Gust": 0.5, "Stone": 2, "Rust": 0.5, "Glass": 2, "Hollow": 1, "Star": 1},
  "Star": {"Plain": 1, "Grit": 1, "Brine": 1, "Kiln": 1, "Moss": 1, "Bolt": 1, "Rime": 1, "Gust": 1, "Stone": 1, "Rust": 1, "Glass": 1, "Hollow": 1, "Star": 1}
 },
 "creatures": [
  {
   "id": "sloshkin",
   "name": "Sloshkin",
   "types": ["Brine"],
   "roleTag": "starter_base",
   "spriteStatus": "concept_32x32_drawn",
   "bondedInSprite": true,
   "flavour": "Lives on the tide-flats of the Brindle Isles where the first skyglass fell. Sits buried to the eyes in warm mud and pops up when someone walks past. Islanders say a Sloshkin picks its trainer; the faint mark on its forehead lights the day it does.",
   "heartmark": {"position": "forehead", "highlightKey": "w"},
   "ability": {"name": "Shoresense", "effect": "On switch-in, Reads the foe automatically. The foe's ability and any Ward go straight into the Field Log."},
   "heartmarkTechnique": "Undertow",
   "moves": [
    {"name": "Undertow", "type": "Brine", "power": 65, "accuracy": 100, "pp": null, "priority": null, "effect": "Lowers the target's Speed one stage.", "heartmarkTechnique": true, "est": true, "keepsStabInEveryBody": "Proposed"}
   ],
   "stats": {"numeric": null, "notes": "Slow (est.)."},
   "shift": {"family": "Sloshkin", "windowsLevel": [9, 20, 34], "windowsEst": true, "formsOverRun": "up to four forms over about three windows", "poolLean": null, "notes": "See sloshkinShiftTable. Shiftlog on the summary page records every form in order."},
   "defense": {"x4": [], "x2": ["Grit", "Bolt"], "x0_5": ["Kiln", "Moss", "Rime", "Stone", "Glass"], "x0_25": [], "x0": []},
   "counterplay": "Grit and Bolt hit it for double. Resists Kiln, Moss, Rime, Stone and Glass. Slow; Undertow's Speed drop is its only tempo tool. Lead with a fast Bolt attacker.",
   "mustNotReadAs": null,
   "runEcho": "MUDDY the Mudkip: seven forms (Mudkip, Swampert Lv16, Machop Lv20, Wynaut, Ludicolo Lv27, Altaria Lv30, Gardevoir); finished Lv27, 46 levels behind Machoke."
  },
  {
   "id": "skeinwing",
   "name": "Skeinwing",
   "types": ["Brine", "Gust"],
   "roleTag": "starter_shift",
   "spriteStatus": "concept_32x32_drawn",
   "bondedInSprite": true,
   "flavour": "No Skeinwing hatches; every one started as something else. After a skyglass storm, skeins of them fly high over the outer islands. Old fishers study the coral collars to guess what each bird used to be.",
   "heartmark": {"position": "head", "highlightKey": "y", "note": "y because the body is white (Proposed)"},
   "ability": {"name": "Featherbed", "effect": "Halves damage from the first contact hit each battle. Once used, the feather fringe on its near wing flattens on screen."},
   "heartmarkTechnique": "Undertow",
   "moves": [
    {"name": "Undertow", "type": "Brine", "power": 65, "accuracy": 100, "pp": null, "priority": null, "effect": "Carried through the Heartmark from Sloshkin. Lowers target Speed one stage.", "heartmarkTechnique": true, "est": true},
    {"name": "Skein Sweep", "type": "Gust", "power": 60, "accuracy": null, "pp": null, "priority": null, "effect": "Form technique. Hits both foes in doubles.", "heartmarkTechnique": false, "est": true}
   ],
   "stats": {"numeric": null, "notes": "Fragile (est.)."},
   "shift": {
    "family": "Sloshkin",
    "shiftOnly": true,
    "hatchling": null,
    "wildEncounter": false,
    "cardFromSloshkin": "Up, stage 2",
    "directionsFromSkeinwing": {"Up": ["Bogmonarch", "Lumenveil"], "Side": ["Siltback"], "Down": ["Sloshkin", "other stage-1 forms", "hatchlings"]},
    "readableContinuity": ["Heartmark on the head", "coral band reborn as a collar", "the eye"]
   },
   "defense": {"x4": ["Bolt"], "x2": ["Grit"], "x0_5": ["Kiln", "Moss", "Glass", "Hollow"], "x0_25": ["Stone"], "x0": []},
   "counterplay": "Bolt hits it four times over; Grit for double. Resists Kiln, Moss, Glass and Hollow; quarter from Stone. Fragile. Featherbed only softens the first contact hit.",
   "mustNotReadAs": null,
   "runEcho": "MUDDY became an Altaria on Mt Pyre at Lv30, then a Lv27 Gardevoir. Skeinwing is the test case for recognising your Sloshkin across bodies."
  },
  {
   "id": "scrapling",
   "name": "Scrapling",
   "types": ["Grit"],
   "roleTag": "early_carry",
   "spriteStatus": "concept_32x32_drawn",
   "bondedInSprite": false,
   "flavour": "Smallest creature on the first route and quickest to start a fight. Wraps its fists in sailcloth, net cord or old bandage. Dock workers keep one to chase off gulls three times its size and call the red patch on its shoulder its badge.",
   "heartmark": {"position": null, "highlightKey": null, "note": "Concept sprite shows the unbonded look (mark's spot left plain)."},
   "ability": {"name": "Big Sibling", "effect": "After each battle it takes part in, the lowest-level creature in the party gets an extra 30% of Scrapling's EXP (est.), on top of the 60% bench share every non-battler gets. Shown as an arrow on the post-battle EXP screen. Lost if Scrapling faints in that battle."},
   "heartmarkTechnique": "Shadowbox",
   "moves": [
    {"name": "Shadowbox", "type": "Hollow", "power": 50, "accuracy": null, "pp": 10, "priority": null, "effect": "A jab at its own shadow. Neutral against Hollow, double against Stone and Glass.", "heartmarkTechnique": true, "est": true}
   ],
   "stats": {"numeric": null, "notes": "Slow (est.)."},
   "shift": {"family": "Scrapling", "poolLean": ["Grit"], "forwardLine": ["Knuckleback (Grit)", "Cragmitt (Grit/Stone)"], "upWeightForwardLineDrift": 70, "notes": "Pool narrow on purpose. To stop it changing: anchor stones each window or the Still Knot."},
   "defense": {"x4": [], "x2": ["Gust", "Glass"], "x0_5": [], "x0_25": [], "x0": []},
   "counterplay": "Hollow is immune to its Grit moves (panel says No effect); only Shadowbox gets through, at neutral. Gust and Glass hit it for double. Slow, so a fast Gust attacker can take it first.",
   "mustNotReadAs": null,
   "runEcho": "Machoke caught Lv2 on Route 101, ended Lv73; walled by Ghost types until TM40 rolled Leaf Blade."
  },
  {
   "id": "prismoth",
   "name": "Prismoth",
   "types": ["Glass", "Gust"],
   "roleTag": "ward",
   "spriteStatus": "concept_32x32_drawn",
   "bondedInSprite": true,
   "flavour": "Drinks the light off skyglass dust. Wings are thin, dark glass; only the colours banded on them let light through. Rhyme: read the wings, then swing.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Prism Ward", "class": "Ward", "effect": "Only Strong hits land (for Prismoth: Kiln and Rime). Poison and burn chip, weather and trap damage still land. Max HP is a quarter of normal for its level (est.). Tell: hex-lattice shimmer (replays about every 4 s) plus a 'Ward ?' badge on send-in; on Freefall the badge appears only after the first blocked hit. After a blocked hit the readout lists which party techniques can land; the Field Log keeps it."},
   "heartmarkTechnique": null,
   "moves": [
    {"name": "Dust Veil", "type": "Glass", "power": 30, "accuracy": null, "pp": null, "priority": null, "effect": "30% chance to poison. Low damage on purpose; stalls while poison chips.", "heartmarkTechnique": false, "est": true}
   ],
   "stats": {"numeric": null, "maxHpMultiplier": 0.25, "notes": "Max HP a quarter of normal for its level (est.); one Strong hit ends it."},
   "shift": {"family": "Prismoth", "poolLean": ["Glass", "Gust"], "notes": "Abilities follow the form: keeps Prism Ward only if the new form has it. Seeds can place a Ward on other species; placements fixed at new game. Guarantees: Crackdust stocked at the Shelter before any mandatory Ward trainer, priced below one route trainer's payout; one chip-damage disc (poison or trap) by badge 1."},
   "defense": {"x4": [], "x2": ["Kiln", "Rime"], "x0_5": ["Grit", "Moss", "Rust"], "x0_25": [], "x0": []},
   "counterplay": "Any Kiln or Rime technique ends it. Poison, burn, weather and trap damage also work. Crackdust suppresses the Ward. Badge shows on send-in on Drift and Flux; on Freefall after the first blocked hit.",
   "mustNotReadAs": null,
   "runEcho": "Randomized Wonder Guard walled the run about ten times with no warning before the first wasted turn."
  },
  {
   "id": "vesperay",
   "name": "Vesperay",
   "types": ["Brine", "Glass"],
   "roleTag": "champion_ace",
   "spriteStatus": "concept_32x32_drawn",
   "bondedInSprite": false,
   "flavour": "The Champion's partner. Rises from the deep at dusk and glides just above the water, trailing reflections. The eye panel on its back brightens before it heals. Idris Fenwake's Vesperay wears his anchor ring around the base of its tail.",
   "heartmark": {"position": null, "highlightKey": null, "note": "Concept sprite shows the unbonded look."},
   "ability": {"name": "Afterimage", "effect": "Each evasion stage shows as a decoy copy beside it, up to two (+2 evasion cap). Move panel shows exact hit chance. A hit on a decoy pops it and deals no damage. Multi-hit moves pop one decoy per hit; moves that hit every foe pop both. The Plumbline disc always hits, clears its stat stages and blocks re-boosting for 2 turns."},
   "heartmarkTechnique": null,
   "moves": [
    {"name": "Vesper Mend", "type": null, "power": null, "accuracy": null, "pp": null, "priority": null, "effect": "Recovery. Draws from the battle budget of 3 Mends (pips). Turn 1: eye panel brightens, both sides see it. End of turn 2: heals 50% of max HP (est.). A Hollow hit in between dims the panel and cancels the heal; the Mend is spent either way.", "heartmarkTechnique": false, "est": true, "category": "recovery", "healFraction": 0.5, "delayTurns": 1, "cancelledBy": "Hollow hit while the panel is bright"}
   ],
   "stats": {"numeric": null, "notes": null},
   "shift": {"family": "Vesperay", "poolLean": ["Brine", "Glass"], "notes": "Champion's Vesperay is anchored by Idris's ring and keeps the same kit on every seed. Anchor Release story scene: ring cracks, Heartmark flares (story section owns it; scripted-boss rule). Wild Vesperays in the post-game Shift like any family."},
   "defense": {"x4": [], "x2": ["Hollow"], "x0_5": ["Rime", "Rust", "Glass"], "x0_25": ["Moss"], "x0": []},
   "counterplay": "Hollow is its only weakness (Brinelance's Gnash, Scrapling's Shadowbox). Resists Moss (quarter), Rime, Rust, Glass. Land a Hollow hit while the eye panel is bright to cancel the heal. Multi-hit moves clear decoys. Plumbline disc (7th Spire) is the guaranteed answer; a plain stat clear is not enough.",
   "mustNotReadAs": null,
   "runEcho": "Wallace's Lv56 Latias: Double Team behind Recover and Protect; ended League runs 4, 5 and 6."
  },
  {
   "id": "vagary",
   "name": "Vagary",
   "types": ["Star"],
   "roleTag": "comet_legendary",
   "spriteStatus": "concept_32x32_drawn",
   "bondedInSprite": null,
   "flavour": "A comet on a long orbit that broke over the Brindle Isles; part of it is alive: a ring of comet tail with a crystal head. Has not held one type since. The Mooring wants its change stopped; the Scatter refines its skyglass dust into Starsalt. The Heartshard rides with its return; reachable only from a sea stack.",
   "heartmark": {"position": null, "highlightKey": null, "note": "Body drawn in m (comet magenta); the one allowed use of m on a body."},
   "ability": {"name": "Unfixed", "effect": "At the end of each turn its type moves to the next in a posted loop of four: Star, then three types drawn from the seed. The next two types show as badges over its HP bar. Three shards count down (one lights each turn); when all three are lit it returns to Star. Type changes; form never does."},
   "heartmarkTechnique": null,
   "moves": [
    {"name": "Tailfall", "type": "queued", "power": 90, "accuracy": null, "pp": null, "priority": null, "effect": "Takes the type next in the queue, so the player sees each hit's type one turn early.", "heartmarkTechnique": false, "est": true}
   ],
   "stats": {"numeric": null, "notes": "No healing move."},
   "shift": {"family": null, "neverShifts": true, "neverOnForecast": true, "notes": "Source of every Shift. Unfixed only changes its type."},
   "defense": {"x4": [], "x2": [], "x0_5": [], "x0_25": [], "x0": []},
   "counterplay": "Read the queue and switch into a resist one turn ahead. On Star turns nothing is strong or weak against it: heal or set up then.",
   "mustNotReadAs": null,
   "runEcho": "About 15 Chaos evolutions in 45 hours; Vagary makes that chaos the plot with one visible cause."
  },
  {
   "id": "brinelance",
   "name": "Brinelance",
   "types": ["Brine", "Rime"],
   "roleTag": "accidental_shift_hero",
   "spriteStatus": "text_only",
   "bondedInSprite": null,
   "flavour": "A Bilgebob is a round, slow whale dozing in harbour mouths. A few become Brinelances: lean, salt-crusted hunters with a single long lance of rime. Nobody plans for it.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Last Ebb", "effect": "Below 25% HP (est.), its Brine and Hollow moves gain 30% power (est.). The HP bar turns b while active.", "threshold": 0.25, "powerBonus": 0.3, "boostedTypes": ["Brine", "Hollow"]},
   "heartmarkTechnique": "Gnash",
   "moves": [
    {"name": "Gnash", "type": "Hollow", "power": 60, "accuracy": null, "pp": null, "priority": null, "effect": "30% flinch chance. Each hit pops one Afterimage decoy (same as the Gnash disc). Learned as a Bilgebob.", "heartmarkTechnique": true, "est": true, "flinchChance": 0.3, "popsAfterimage": 1}
   ],
   "stats": {"numeric": null, "notes": null},
   "shift": {
    "family": "Bilgebob",
    "preShiftForm": {
     "name": "Bilgebob",
     "types": ["Brine"],
     "ability": {"name": "Sodden", "effect": "Stops every creature on the field from using a self-KO move."},
     "mustNotReadAs": ["Wailmer", "Cetoddle"]
    },
    "cardFromBilgebob": "Up, third window (late)",
    "weightOnFlux": 6,
    "approxUpCardsPerAppearanceFlux": 17,
    "cardText": "Brinelance (Brine/Rime)",
    "notes": "Sodden does not carry (abilities follow the form); Gnash does."
   },
   "defense": {"x4": [], "x2": ["Grit", "Brine", "Bolt"], "x0_5": ["Moss", "Rime", "Gust", "Stone", "Rust", "Glass"], "x0_25": [], "x0": []},
   "counterplay": "Grit, Brine and Bolt hit it for double. Resists Moss, Rime, Gust, Stone, Rust, Glass. Finish it before the Last Ebb line, or use status once it is under it.",
   "mustNotReadAs": null,
   "runEcho": "Wailmer Chaos-evolved into Seadra at Lv40; Seadra ground Victory Road alone and beat Wallace's Latias in run 8."
  },
  {
   "id": "creelwight",
   "name": "Creelwight",
   "types": ["Hollow", "Rust"],
   "roleTag": "hollow_wall",
   "spriteStatus": "text_only",
   "bondedInSprite": null,
   "flavour": "An iron creel lost in a storm, rusting on the seabed and still fishing. The cage is empty, but something inside keeps the door shut.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Empty Weave", "effect": "The first hit each battle that is not Strong against it deals half damage. A v ring of rope circles it until used."},
   "heartmarkTechnique": null,
   "moves": [
    {"name": "Snuff", "type": "Hollow", "power": 50, "accuracy": null, "pp": null, "priority": null, "effect": "Removes the target's raised stat stages.", "heartmarkTechnique": false, "est": true}
   ],
   "stats": {"numeric": null, "notes": null},
   "shift": {"family": "Creelwight", "poolLean": ["Hollow", "Rust"], "notes": "A Hollow wall stays a Hollow wall. Scouting Prism adds moves, held items and heal pips to the Read card."},
   "defense": {"x4": [], "x2": ["Moss", "Rime", "Gust"], "x0_5": ["Brine", "Hollow"], "x0_25": [], "x0": ["Plain", "Grit"]},
   "counterplay": "Plain and Grit do nothing (panel says No effect). Moss, Rime and Gust hit it for double. Resists Brine and Hollow. Break Empty Weave with a weak hit first.",
   "mustNotReadAs": null,
   "runEcho": "Brawly's Dusclops, Juan's Banette and Drake's Dusclops walled the Normal/Fighting carry; Drake ended four of seven League losses."
  },
  {
   "id": "sedgehare",
   "name": "Sedgehare",
   "types": ["Moss"],
   "roleTag": "crit_threat",
   "spriteStatus": "text_only",
   "bondedInSprite": null,
   "flavour": "A marsh hare whose long ears are blades of sawgrass. Sits still in the reeds until something steps close. Saying: if the ears glint, step back.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Keen Glint", "effect": "Raises its crit chance two stages. Proposed (needs gameplay sign-off): crits are rolled at the start of the turn for every creature; when its next hit will crit, its ear edges glint w.", "critStages": 2},
   "heartmarkTechnique": null,
   "moves": [
    {"name": "Reap", "type": "Moss", "power": 70, "accuracy": null, "pp": null, "priority": null, "effect": "High crit rate.", "heartmarkTechnique": false, "est": true}
   ],
   "stats": {"numeric": null, "notes": null},
   "shift": {"family": "Sedgehare", "poolLean": ["Moss", "Grit"], "notes": "Teaches the glint early, around the 4th or 5th Spire (est.)."},
   "defense": {"x4": [], "x2": ["Brine", "Kiln", "Rime"], "x0_5": ["Grit"], "x0_25": [], "x0": []},
   "counterplay": "Watch the ears; on a glint turn switch to something that can take the crit, or guard. Brine, Kiln and Rime hit it for double. Resists Grit.",
   "mustNotReadAs": null,
   "runEcho": "A Lv26 Bellossom in Norman's gym swept the team with Slash crits."
  },
  {
   "id": "wirewhisk",
   "name": "Wirewhisk",
   "types": ["Bolt"],
   "roleTag": "scout",
   "spriteStatus": "text_only",
   "bondedInSprite": null,
   "flavour": "Harbour towns keep Wirewhisks to sniff out trouble. The copper coil of its tail hums when another creature is near.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Tailhum", "effect": "On switch-in, reveals one foe move. Before the player owns the Scouting Prism, a Wirewhisk in the lead also adds the lead foe's moves to the Read card."},
   "heartmarkTechnique": "Arc Ping",
   "moves": [
    {"name": "Arc Ping", "type": "Bolt", "power": 30, "accuracy": null, "pp": null, "priority": "moves first", "effect": "Reveals the target's full moveset.", "heartmarkTechnique": true, "est": true}
   ],
   "stats": {"numeric": null, "notes": "Low attack and low HP (est.); support pick."},
   "shift": {"family": "Wirewhisk", "poolLean": ["Bolt", "Gust"], "notes": "Read is available from the start; Wirewhisk adds moves early, before the Prism."},
   "defense": {"x4": [], "x2": ["Moss", "Stone", "Rust"], "x0_5": ["Grit"], "x0_25": [], "x0": []},
   "counterplay": "Moss, Stone and Rust hit it for double. Resists Grit.",
   "mustNotReadAs": null,
   "runEcho": "The run had no way to see a foe's ability or moves before committing."
  },
  {
   "id": "rimeplate",
   "name": "Rimeplate",
   "types": ["Rime", "Stone"],
   "roleTag": "down_shift_example",
   "spriteStatus": "text_only",
   "bondedInSprite": null,
   "flavour": "Clings to cold tide-pool rocks on the northern islands under eight overlapping plates of rime. Pry one loose and it curls into a ball.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Plateshed", "effect": "The first Strong hit each battle deals neutral damage, and one plate visibly falls off."},
   "heartmarkTechnique": null,
   "moves": [
    {"name": "Plate Toss", "type": "Rime", "power": 60, "accuracy": null, "pp": null, "priority": null, "effect": "Throws one of its own plates; it grows back at the end of that turn.", "heartmarkTechnique": false, "est": true}
   ],
   "stats": {"numeric": null, "notes": "Slow (est.)."},
   "shift": {
    "family": "Rimeplate",
    "hatchling": {"name": "Chillnub", "types": ["Rime"], "description": "A small curled ball with one plate."},
    "notes": "Down-Shift example. Down-Shift keeps level, EXP, held item, nickname, Bond, trained stat points and the Heartmark technique; stat floor 10% Drift / 20% Flux / none on Freefall; the Down card shows the stat change before accept."
   },
   "defense": {"x4": [], "x2": ["Kiln", "Moss", "Hollow"], "x0_5": ["Plain", "Gust", "Rust", "Glass"], "x0_25": [], "x0": []},
   "counterplay": "Kiln, Moss and Hollow hit it for double. Resists Plain, Gust, Rust, Glass. Once Plateshed is spent, Strong hits land in full. Slow.",
   "mustNotReadAs": null,
   "runEcho": "MUDDY dropped to a Wynaut in the Fortree gym; a Lv19 Ludicolo became a Lv16 Rhydon; the only control was a timed B press."
  },
  {
   "id": "squallcoil",
   "name": "Squallcoil",
   "types": ["Bolt", "Brine"],
   "roleTag": "errant",
   "spriteStatus": "text_only",
   "bondedInSprite": null,
   "flavour": "A storm krait that never stays near one island; fishers track it by the lightning walking across the sea. One of the Errants, great creatures the Starfall scattered onto ordinary routes.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Skyroam", "effect": "Moves one route per in-game hour (est.). Once the player has seen it, it shows on the map."},
   "heartmarkTechnique": null,
   "moves": [
    {"name": "Bandlight", "type": "Bolt", "power": 90, "accuracy": null, "pp": null, "priority": null, "effect": "Its bands light in sequence the turn before it strikes.", "heartmarkTechnique": false, "est": true}
   ],
   "stats": {"numeric": null, "notes": null},
   "shift": {
    "family": "Squallcoil",
    "isErrant": true,
    "errantRules": {"capture": "Lantern: raise it, light draws the creature in, a 3-segment glow meter fills; no throw arc, wobble or click.", "captureStance": "Taught by Corin, costs no move slot, stops the party's damage at 1 HP.", "oddsShownBeforeSpend": true, "oneOfAKindItemsNeedConfirm": true, "respawnAfterKO": "next badge or 2 hours of play, whichever first", "downCardNeverHatchlingOnDriftFlux": "Proposed"}
   },
   "defense": {"x4": [], "x2": ["Bolt", "Rust"], "x0_5": ["Kiln", "Rime", "Glass"], "x0_25": [], "x0": []},
   "counterplay": "Bolt and Rust hit it for double. Resists Kiln, Rime, Glass. Can be met early at low level and caught fairly with Capture Stance and visible odds.",
   "mustNotReadAs": null,
   "runEcho": "Legendaries wandered ordinary routes; a Jirachi and a Rayquaza were KO'd by accident; a Master Ball was thrown at a Lv26 Kyogre by a remembered bag cursor."
  },
  {
   "id": "tossup",
   "name": "Tossup",
   "types": ["Plain"],
   "roleTag": "wild_card_common",
   "spriteStatus": "text_only",
   "bondedInSprite": null,
   "flavour": "The most common creature on the islands and the least predictable. A small hermit crab living in a bottle, a teacup or a net float. Island children treat them like lottery tickets.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Blank Slate", "effect": "Its Heartmark can carry any one of its techniques, chosen at its first Shift (other species carry a fixed one). Proposed: the gameplay section owns how Heartmark techniques are picked."},
   "heartmarkTechnique": "chosen_at_first_shift",
   "moves": [
    {"name": "Sure Pinch", "type": "Plain", "power": 40, "accuracy": "never misses", "pp": null, "priority": null, "effect": "Early sure-hit move against evasion.", "heartmarkTechnique": false, "est": true}
   ],
   "stats": {"numeric": null, "notes": "Weak until its first Shift (est.)."},
   "shift": {"family": "Tossup", "poolShape": "one form per type, 12 forms (est.), split evenly inside each card", "starTouchedChance": 0.02, "notes": "Full chaos in one party slot."},
   "defense": {"x4": [], "x2": ["Grit", "Rust"], "x0_5": [], "x0_25": [], "x0": []},
   "counterplay": "Grit and Rust hit it for double. Stats weak until its first Shift.",
   "mustNotReadAs": null,
   "runEcho": "About 15 Chaos evolutions in 45 hours gave the run most of its stories."
  },
  {
   "id": "stillox",
   "name": "Stillox",
   "types": ["Stone"],
   "roleTag": "unshifting_titan",
   "spriteStatus": "text_only",
   "bondedInSprite": null,
   "flavour": "The oldest line of creatures on the islands and the only one that has never Shifted. A bonded Stillox lights its Heartmark, but only ever on one body. The Mooring carves its horns on their banners.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Unshifting", "effect": "Cannot Shift and its type never changes. Any effect that would force a type or form change fails against it."},
   "heartmarkTechnique": null,
   "moves": [
    {"name": "Bedrock Charge", "type": "Stone", "power": 100, "accuracy": null, "pp": null, "priority": null, "effect": "Braces for one turn while dust falls from its columns, then hits.", "heartmarkTechnique": false, "est": true, "chargeTurns": 1}
   ],
   "stats": {"numeric": null, "notes": null},
   "shift": {"family": null, "neverShifts": true, "notes": "The only ordinary species outside the Shift system; emblem of the Mooring. Still Knot (held item) blocks Shifts for any holder; Proposed lore: woven from shed Stillox hair."},
   "defense": {"x4": [], "x2": ["Moss", "Hollow"], "x0_5": ["Plain", "Brine", "Glass"], "x0_25": [], "x0": []},
   "counterplay": "Moss and Hollow hit it for double. Resists Plain, Brine, Glass. Bedrock Charge telegraphs a turn ahead: switch or guard.",
   "mustNotReadAs": null,
   "runEcho": "B-press evolution cancels that missed: Flygon to Wailmer, Armaldo to Seviper, Lv34 Rayquaza to Trapinch."
  },
  {
   "id": "caldermaw",
   "name": "Caldermaw",
   "types": ["Kiln", "Stone"],
   "roleTag": "rival_opener",
   "spriteStatus": "text_only",
   "bondedInSprite": null,
   "flavour": "A volcanic titan that dens in the lava tubes of the islands. Linnet Rask's opening creature becomes one in her first battle; later it Shifts down into Sootling, a palm-sized ember grub.",
   "heartmark": {"position": null, "highlightKey": null},
   "ability": {"name": "Furnace Jaw", "effect": "Its first Kiln move each battle never misses."},
   "heartmarkTechnique": null,
   "moves": [
    {"name": "Kiln Maw", "type": "Kiln", "power": 75, "accuracy": null, "pp": null, "priority": null, "effect": null, "heartmarkTechnique": false, "est": true}
   ],
   "stats": {"numeric": null, "notes": null},
   "shift": {
    "family": "Caldermaw",
    "scriptedStoryShift": {"owner": "Linnet Rask", "level": 5, "onEveryDial": true, "postedForecast": true, "firstFight": "hold out 3 turns; continues on any result"},
    "downForm": {"name": "Sootling", "types": ["Kiln"], "description": "Palm-sized ember grub (story section)."}
   },
   "defense": {"x4": [], "x2": ["Grit", "Gust", "Hollow"], "x0_5": ["Plain", "Rime", "Glass"], "x0_25": [], "x0": []},
   "counterplay": "Grit, Gust and Hollow hit it for double. Resists Plain, Rime, Glass. In the opening scene hold out 3 turns; winning is optional.",
   "mustNotReadAs": null,
   "runEcho": "Rival May's Lv5 Groudon on Route 103; Sootling echoes the Lv34 Rayquaza that became a Trapinch."
  }
 ],
 "referencedForms": [
  {
   "name": "Bilgebob",
   "types": ["Brine"],
   "family": "Bilgebob",
   "stage": "pre-Shift form of Brinelance",
   "ability": "Sodden",
   "mustNotReadAs": ["Wailmer", "Cetoddle"],
   "defense": {"x4": [], "x2": ["Grit", "Bolt"], "x0_5": ["Kiln", "Moss", "Rime", "Stone", "Glass"], "x0_25": [], "x0": []}
  },
  {
   "name": "Sootling",
   "types": ["Kiln"],
   "family": "Caldermaw",
   "stage": "down form (story)",
   "defense": {"x4": [], "x2": ["Grit", "Brine", "Gust"], "x0_5": ["Moss", "Rime"], "x0_25": [], "x0": []}
  },
  {
   "name": "Chillnub",
   "types": ["Rime"],
   "family": "Rimeplate",
   "stage": "hatchling",
   "defense": {"x4": [], "x2": ["Brine", "Kiln"], "x0_5": ["Gust", "Rust"], "x0_25": [], "x0": []}
  },
  {
   "name": "Knuckleback",
   "types": ["Grit"],
   "family": "Scrapling",
   "stage": "forward line, after Scrapling",
   "defense": {"x4": [], "x2": ["Gust", "Glass"], "x0_5": [], "x0_25": [], "x0": []}
  },
  {
   "name": "Cragmitt",
   "types": ["Grit", "Stone"],
   "family": "Scrapling",
   "stage": "forward line, after Knuckleback",
   "defense": {"x4": [], "x2": ["Moss", "Gust", "Hollow"], "x0_5": ["Plain", "Brine"], "x0_25": [], "x0": []}
  },
  {
   "name": "Siltback",
   "types": ["Brine", "Stone"],
   "family": "Sloshkin",
   "stage": 2,
   "defense": {"x4": [], "x2": ["Grit", "Bolt", "Hollow"], "x0_5": ["Plain", "Brine", "Kiln", "Rime", "Stone"], "x0_25": ["Glass"], "x0": []}
  },
  {
   "name": "Bogmonarch",
   "types": ["Brine", "Stone"],
   "family": "Sloshkin",
   "stage": 3,
   "defense": {"x4": [], "x2": ["Grit", "Bolt", "Hollow"], "x0_5": ["Plain", "Brine", "Kiln", "Rime", "Stone"], "x0_25": ["Glass"], "x0": []}
  },
  {
   "name": "Lumenveil",
   "types": ["Glass"],
   "family": "other",
   "stage": 3,
   "defense": {"x4": [], "x2": ["Kiln", "Stone", "Hollow"], "x0_5": ["Grit", "Moss", "Bolt", "Rust"], "x0_25": [], "x0": []}
  },
  {
   "name": "Mudfist",
   "types": ["Grit"],
   "family": "other",
   "stage": 1,
   "defense": {"x4": [], "x2": ["Gust", "Glass"], "x0_5": [], "x0_25": [], "x0": []}
  },
  {
   "name": "Rushling",
   "types": ["Moss", "Brine"],
   "family": "other",
   "stage": 1,
   "defense": {"x4": [], "x2": ["Brine", "Bolt"], "x0_5": ["Moss", "Stone", "Glass"], "x0_25": [], "x0": []}
  },
  {
   "name": "Puddlepip",
   "types": ["Brine"],
   "family": "Sloshkin",
   "stage": "hatchling",
   "defense": {"x4": [], "x2": ["Grit", "Bolt"], "x0_5": ["Kiln", "Moss", "Rime", "Stone", "Glass"], "x0_25": [], "x0": []}
  },
  {
   "name": "Star-touched Sloshkin",
   "types": ["Brine", "Star"],
   "family": "Sloshkin",
   "stage": "Star-touched",
   "defense": {"x4": [], "x2": ["Grit", "Bolt"], "x0_5": ["Kiln", "Moss", "Rime", "Stone", "Glass"], "x0_25": [], "x0": []}
  }
 ],
 "sloshkinShiftTable": {
  "family": "Sloshkin",
  "viewedFrom": "Sloshkin",
  "playerSeesThisTable": false,
  "cardOddsByDial": {
   "Drift": {"Up": 0.5, "Side": 0.4, "Down": 0.1},
   "Flux": {"Up": 0.4, "Side": 0.35, "Down": 0.25},
   "Freefall": {"Up": null, "Side": null, "Down": null, "note": "[NEED SOURCE]"}
  },
  "bond": {"movesPointsFrom": "Down", "to": "Up", "capFlux": 15, "capFreefall": 10, "capDrift": null, "pipsFrom": ["story beats", "Heartmark-technique use"]},
  "pool": [
   {
    "form": "Siltback",
    "types": ["Brine", "Stone"],
    "card": "Up",
    "kind": "forward",
    "stage": 2,
    "weights": {"Drift": 70, "Flux": 45, "Freefall": 25},
    "runEcho": "The planned line"
   },
   {
    "form": "Skeinwing",
    "types": ["Brine", "Gust"],
    "card": "Up",
    "kind": "shift_only",
    "stage": 2,
    "weights": {"Drift": 20, "Flux": 25, "Freefall": 25},
    "runEcho": "MUDDY became an Altaria on Mt Pyre at Lv30"
   },
   {
    "form": "Bogmonarch",
    "types": ["Brine", "Stone"],
    "card": "Up",
    "kind": "skip_ahead",
    "stage": 3,
    "weights": {"Drift": 10, "Flux": 15, "Freefall": 25},
    "runEcho": "MUDDY went from Mudkip to Swampert at Lv16, skipping Marshtomp"
   },
   {
    "form": "Lumenveil",
    "types": ["Glass"],
    "card": "Up",
    "kind": "other_family",
    "stage": 3,
    "weights": {"Drift": 0, "Flux": 15, "Freefall": 25},
    "runEcho": "MUDDY ended as a Gardevoir in the Magma Hideout"
   },
   {
    "form": "Mudfist",
    "types": ["Grit"],
    "card": "Side",
    "kind": "other_family",
    "stage": 1,
    "weights": {"Drift": 50, "Flux": 50, "Freefall": 50},
    "runEcho": "MUDDY became a Machop at Lv20"
   },
   {
    "form": "Rushling",
    "types": ["Moss", "Brine"],
    "card": "Side",
    "kind": "other_family",
    "stage": 1,
    "weights": {"Drift": 50, "Flux": 50, "Freefall": 50},
    "runEcho": "MUDDY became a Ludicolo at Lv27"
   },
   {
    "form": "Puddlepip",
    "types": ["Brine"],
    "card": "Down",
    "kind": "own_hatchling",
    "stage": 0,
    "weights": {"Drift": 100, "Flux": 70, "Freefall": 50},
    "runEcho": "MUDDY became a Wynaut in the Fortree gym"
   },
   {
    "form": "Chillnub",
    "types": ["Rime"],
    "card": "Down",
    "kind": "other_family_hatchling",
    "stage": 0,
    "weights": {"Drift": 0, "Flux": 30, "Freefall": 50},
    "runEcho": "A Lv34 Rayquaza Chaos-evolved down into a Trapinch"
   }
  ],
  "starTouched": {
   "form": "Star-touched Sloshkin",
   "types": ["Brine", "Star"],
   "replacesCard": "Side",
   "forecastChance": 0.02,
   "appliesOnEveryDial": true,
   "outsideFlattening": true,
   "effectiveChance": {"Drift": 0.008, "Flux": 0.007, "Freefall": null},
   "runEcho": "No run equivalent. Story hook for the Vagary"
  },
  "rules": {
   "threeCardsNoFourthOutcome": true,
   "directionsFollowCurrentForm": "Up = higher stage, Side = same stage, Down = lower stage. Every stage keeps at least one form per card. Top-stage Up draws from other families' stronger forms; hatchling Down draws from weaker hatchlings (est.).",
   "currentFormRowDropsOut": "its weight spreads across the other forms on its card in proportion",
   "shiftlogPullWeight": {"value": 5, "status": "Proposed", "est": true},
   "silhouettesForUnseenForms": {"Drift": false, "Flux": false, "Freefall": true},
   "reroll": {"currency": "Starsalt", "costs": [1, 2, 4], "escalation": "doubling within one Shift", "hardCap": null, "taughtAt": "1st Spire"},
   "anchor": {"item": "anchor stone", "effect": "cancels this Shift", "Drift": "free, refilled at each badge", "Flux": "sold at Shelters", "Freefall": "at most 1 per badge"},
   "timingInput": false,
   "windowsPerCreature": 3,
   "sloshkinWindowLevels": [9, 20, 34],
   "deferredShiftsResolveAt": "next Waystone",
   "presets": ["auto-Anchor", "auto-accept Up"],
   "forecastRateTarget": "at most ~1 per 30 minutes of play",
   "carries": ["level", "EXP", "held item", "nickname", "Bond", "trained stat points", "Heartmark technique"],
   "statFloorPerShift": {"Drift": 0.1, "Flux": 0.2, "Freefall": null},
   "playerCreaturesShiftInBattle": false,
   "trainerCreaturesShiftInBattle": "only scripted boss Shifts, each with a posted Forecast",
   "hiddenOddsOnlyInCustom": "Proposed"
  }
 }
}
```
