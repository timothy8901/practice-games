# PORCHLIGHT — Cast Reference

Reference doc for engineers, artists, writers and designers. Extracted from the Porchlight pitch, section "Meet the coast" (source lines 383–543). The source will not be available to readers of this doc, so names, numbers, hex values, frame counts and timings are reproduced exactly.

Characters covered in full (the seven on the pitch sprite sheet):

1. The Newcomer (player)
2. Wren Hearthwright (the one you owe)
3. Juniper Pell (shopkeeper)
4. Barnaby Thole (curator and collector)
5. Tuck (Villager A, "Hearty" personality)
6. Odile (Villager B, "Dreamy" personality)
7. Hesper Coil (the mysterious recurring visitor tied to the story)

Secondary and mentioned characters (everything the section says about them): Ambrose, Dimity, Wick, Tamsin, Bramble, Isolde, "I. Petrel", the Dorrows, the Brack family, the Thatch, Clem/Clementine. Names the task listed that do NOT appear in this section (Ludo, Augusta, Ansel, Ferdinand) are cross-referenced by source line number only in Section 13.

Terminology used by the source: "WW" = the comparison life-sim the pitch measures itself against (the pitch's "O-numbers" such as O1, O4, O8, O10, O12, O15 are its numbered observations about WW); "AC" = the competing franchise whose special characters and villager names must be checked for collisions. `[NEED SOURCE]` marks a check the pitch author flagged as unverified.

---

## 1. Conventions shared by every sprite

| Convention | Value |
|---|---|
| Cell | 32×32 px at in-game resolution |
| Ground line | Feet on row 31 (Hesper: foot on rows 28–31; Tuck: body sits rows 10–31) |
| Horizontal centre | x = 15 |
| Pitch-sheet walk facing | Down (in-engine left/right variants are noted per character) |
| Motion rule | All secondary motion is a pixel shift ("never rotation") |
| Outline rule | Selective, per-character dark colour; never pure black |
| Viewer behaviour | Press an animation name to play it; "step" advances one frame |
| Animation types | Every character has `idle`, `walk` and one SIGNATURE one-shot |
| Only animated colour in the cast | Juniper's iridescent sheen (palette cycle) |
| Only round body | Barnaby |
| Only limbless body | Hesper |
| Only high curled tail | The Newcomer (red panda) |

### 1.1 Silhouette keys (read-at-a-glance contrasts)

| Character | Silhouette key | Body box | Notes |
|---|---|---|---|
| Newcomer | Two tall rounded ears + big bushy tail curling UP behind right hip to shoulder height | 24×32 | ~2.5 heads tall: head 12×11, torso 10, legs 6 |
| Wren | Pear shape (shoulders 14 px, hips 20 px) + big FLAT PADDLE TAIL lying on ground, low-left 10×5 oval | 24×30 | 2 px shorter than player, 4 px wider at hips; tiny 2-px ears so head reads flat-topped apart from spectacles bump |
| Juniper | Compact upright bird, LONG WEDGE TAIL trailing down-left to bottom-left corner (10 px), sharp 4-px beak; head always in 3/4 turn | 22×32 | Hard black/white split is the second key |
| Barnaby | A SPHERE; brass diving helmet (20×18 dome) one size too small | 24×30 | Legs on row 31 |
| Tuck | Near-perfect SQUARE with flat top, broken only by two 3×3 round ears and sweatband ends; "a box with a headband" | 26×22 | Widest, lowest sprite; no neck; 3-px legs |
| Odile | Tall vertical with a LADLE (7-px flat bill ending in 3×3 spatula); beret bump; long stick legs | 20×32 (in-engine 22×38) | Tallest, thinnest sprite; pitch sheet shortens her legs to fit |
| Hesper | Limbless; rounded canvas MAIL SATCHEL where a shell would be; two long eyestalks in a wide V | Front 22×26; side 32×20 | Soft foot "skirt" 22 px wide at bottom |

### 1.2 Timing contrasts

| Character | Idle frames @ ms | Walk frames @ ms | Signature | Signature frames @ ms (holds) |
|---|---|---|---|---|
| Tuck | 4 @ 160 (fastest idle) | 4 @ 125 | `flex_and_name_you` | 5 @ 100 (F3 300, F4 400) |
| Juniper | 3 @ 180 | 4 @ 125 | `glint_and_pocket` | 5 @ 90 (F1 250) |
| Wren | 4 @ 200 | 4 @ 125 | `the_count` | 5 @ 100 (F3–F4 loop ×1 per 1,000 buttons; F5 400) |
| Barnaby | 3 @ 220 | 4 @ 110 (fastest walk) | `eureka_fog` | 5 @ 100 (F3 200, F5 200) |
| Newcomer | 4 @ 250 | 4 @ 125 (in-engine 8-frame) | `let_it_go` | 6 @ 90 (F3 180, F6 300) |
| Hesper | 4 @ 300 | 4 @ 200 (2 px per cycle) | `one_letter_late` | 6 @ 140 (F4 500, F6 600) |
| Odile | 3 @ 320 (slowest idle) | 4 @ 150 | `frame_the_light` | 5 @ 120 (F3 500) |

---

## 2. Cast at a glance

| Character | Species | Role / job | Replaces (vs WW) | Life thread / story payout | Flags |
|---|---|---|---|---|---|
| The Newcomer | Red panda (default); 6 species | Player; lighthouse "Keeper" | WW player avatar; lease card instead of hidden taxi quiz (O1) | Pays 7 loans; relights the lighthouse | River-otter option needs competitive species check `[NEED SOURCE]` |
| Wren Hearthwright | Beaver | Builders' co-op; holds your interest-free hearth loan; designs rooms | WW mortgage holder (debt split from shop) | Loan 3 commission = her first original design; Lamp Room = masterpiece | AC beaver special character exists in a different role `[NEED SOURCE]` |
| Juniper Pell | Magpie | Shopkeeper; secret pawnbroker-in-reverse | WW general store (no part in debt) | Returns heirlooms as porches light; 5% resident share on completion | "Pell" one letter off a WW post-office character `[NEED SOURCE]` |
| Barnaby Thole | Hermit crab | Archive curator; batch identification; string wall | WW museum curator (an owl in WW) (O10) | Bell house upgrade; hosts Odile's gallery; pins the last string | — |
| Tuck | Wombat | Villager A, "Hearty"; nickname-giver; Mudlark Day reviver | WW villager slot (nearest: jock) | "The Mudlark Mile", 5 beats, 3–6 real weeks; 5% resident share; sweatband wearable | "Tuck", "Clem", "Bramble" collide with AC villager names; rename all three `[NEED SOURCE: naming check]` |
| Odile | Roseate spoonbill | Villager B, "Dreamy"; painter | WW villager slot ("Dreamy" is new; nearest: normal) | "Twelve Lights"; gallery in autumn; 5% resident share; painting of your porch | — |
| Hesper Coil | Garden snail | Night postal worker; one old letter per morning at 6 am | WW town-hall post desk + morning-mail ritual (O15) | Delivers the ~120-letter, thirty-year backlog that is the main story | — |

---

## 3. Master palette used in this section

Hex values exactly as the source gives them, with every use the source names. Shared tokens are listed once with all users.

### 3.1 Shared tokens

| Hex | Name (as used) | Used by |
|---|---|---|
| `#141B33` | Night ink | Newcomer eyes and jumper outline; Juniper eyes and outline; Barnaby stalked eyes |
| `#F6F1E3` | Mask white / warm white | Newcomer mask, eye highlight, splash ring, fish eye; Barnaby rivets and porthole glint; Odile neck |
| `#F4F1E6` | Paper white | Wren clipboard paper and abacus spark; Tuck race bib and bicep sparkle; Hesper envelope corners |
| `#D9A441` | Brass | Wren spectacles, pencil, overall buttons, abacus beads; Juniper trinket glint, sparkle, the brass BUTTON (currency); Hesper satchel buckle |
| `#3B4A6B` | Navy | Newcomer jumper bands and fish back; Odile beret |
| `#4F6D7A` | Co-op canvas | Wren overalls; Newcomer errand apron variant |
| `#34505C` | Co-op canvas shadow | Wren overall shadow and clipboard ruling |
| `#E07A3F` | Warm orange | Newcomer crown highlight; Tuck sweatband |
| `#F2A7B5` | Pink | Newcomer optional blush; Odile main plumage |
| `#C9B48A` | Canvas tan | Odile bill; Hesper satchel |
| `#8C7A5A` | Canvas tan shadow | Odile bill shadow; Hesper satchel shadow |
| `#E9F7F2` | Mint white | Barnaby fog dither; Hesper glisten streak and shimmer trail |
| `#3FA7D6` | Paint blue | Odile wingtip fleck, drifting fleck in signature |
| `#FFE29A` | Paint yellow | Odile wingtip fleck, sparkle in signature |

### 3.2 Per-character tokens

**Newcomer (red panda preset)**

| Hex | Use |
|---|---|
| `#C2502A` | Rust head; tail rings (alternating) |
| `#E07A3F` | Crown highlight |
| `#F6F1E3` | White mask: 6×3 muzzle patch, two 2×1 eyebrow dots, ear rims; eye highlight |
| `#141B33` | Eyes 2×3; outline around jumper |
| `#3A1F1C` | Nose 2×1; outline around fur |
| `#F2A7B5` | Optional 2×1 blush |
| `#3B4A6B` | Navy jumper bands (collar and hem are navy) |
| `#F4E8C1` | Cream jumper bands |
| `#4A2A22` | Dark "socks" (forearms and legs); tail tip |
| `#7A5A36` | Small boots |
| `#E9C08A` | Tail rings (alternating with rust) |
| `#4F6D7A` | Errand variant co-op apron |

**Wren Hearthwright**

| Hex | Use |
|---|---|
| `#8A5A3B` | Hazel fur |
| `#B07A52` | Highlights on crown and cheeks |
| `#E9D3B0` | Cream muzzle 6×4; tail-slap dust pixel |
| `#F2A541` | Orange incisors, 2×2 block, always visible (face signature) |
| `#2E1C12` | Eyes 2×2; pencil tip; outline |
| `#CFE7F2` | Eye glint; lens glints |
| `#D9A441` | Spectacle rings (two 3×3), pencil 1×4, two brass buttons, abacus beads |
| `#5A3A2A` | Tail base; abacus frame 8×5 |
| `#3E2618` | Tail crosshatch diamond grid (1-px lines) |
| `#4F6D7A` / `#34505C` | Canvas overalls / shadow and clipboard ruling |
| `#F4F1E6` | Clipboard paper 6×8; abacus bead spark |

**Juniper Pell**

| Hex | Use |
|---|---|
| `#1F1D2A` | Black head, back, wings |
| `#3A3848` | Plumage highlights; thin legs |
| `#F1EEE6` | White belly panel 8×10; two 3×4 shoulder patches; eye glint |
| `#B9B4C4` | Belly shadow |
| `#2A6F8F` → `#3FAE8C` | Iridescent sheen on tail and wing edges, palette-cycled over 4 steps at 150 ms |
| `#141B33` | Eyes 2×2; outline |
| `#C97B2C` | Shopkeeper's apron |
| `#8A4F1A` | Apron shadow; five 2×2 pocket rectangles |
| `#D9A441` | 1-px trinket glint in one pocket; sparkle; the brass button |

**Barnaby Thole**

| Hex | Use |
|---|---|
| `#B8862F` | Helmet base |
| `#E3B867` | Helmet highlight crescent (upper left) |
| `#7A5A1E` | Helmet shadow (lower right); 2×2 top valve |
| `#F6F1E3` | Four single-pixel rivets; porthole glint |
| `#9FD3C0` | 8×8 round porthole glass |
| `#141B33` | Two stalked eyes, each 1×2 |
| `#E06A4F` | Mismatched coral claws (left big 6×5, right small 4×4) |
| `#A8402E` | Claw shadow |
| `#3A2410` | Outline |
| `#8C6A3E` | SUMMER VARIANT ship's bell |
| `#C9A54A` | Bell highlights |
| `#E9F7F2` | Porthole fog (50% ordered dither) |

**Tuck**

| Hex | Use |
|---|---|
| `#7D6A58` | Brown-grey fur |
| `#5A4A3E` | Shadow along bottom and sides |
| `#A8927C` | Highlight along top edge |
| `#C9B49A` | Pale muzzle and belly; walk dust puff |
| `#2A2433` | Square 4×2 nose block; 1×2 eyes; the "7" on the bib |
| `#E07A3F` | Orange sweatband |
| `#B5452E` | Sweatband shadow |
| `#F4F1E6` | Cream race bib; bicep sparkle |
| `#2B221C` | Outline |

**Odile**

| Hex | Use |
|---|---|
| `#C9B48A` / `#8C7A5A` | Bill / bill shadow |
| `#F2A7B5` | Main pink |
| `#E07A9A` | Deeper wing pink; viewfinder outline in signature |
| `#B5527A` | Shadow pink |
| `#A3283A` | Crimson shoulder patch; legs (10 px); eye 1×1 |
| `#F6F1E3` | Pale cream-white neck, gentle S-curve |
| `#3B4A6B` | Navy beret tipped over right eye |
| `#3FA7D6`, `#FFE29A` | Single-pixel paint flecks on wingtips |
| `#4A1E30` | Dark plum outline; eye ring |

**Hesper Coil**

| Hex | Use |
|---|---|
| `#C9B48A` / `#8C7A5A` | Mail satchel 18×14 / shadow |
| `#F4F1E6` | Two or three envelope corners sticking up like paper spikes |
| `#D9A441` | 2×2 brass buckle at centre of flap |
| `#2E3A2C` | Dark eye tips; dark moss outline |
| `#A9B8A0` | Pale olive body |
| `#7A8C74` | Body shadow |
| `#E9F7F2` | 1-px glisten streak on foot skirt; shimmer trail pixels (fade over 3 s) |
| `#F9C46B` | Night lantern 2×2 on left eyestalk, dithered 1-px halo |
| `#E8D3A0` | Old letters (prop) |
| `#A8323A` | Wax seal on old letters |

---

## 4. THE NEWCOMER (player character)

### 4.1 Identity

| Field | Value |
|---|---|
| Name | Player-named ("The Newcomer" is the placeholder; later called "Keeper" by Wick) |
| Species | Red panda is the default preset. Six player species on a shared two-legged paper-doll rig: **water vole, river otter, red panda, opossum, ferret, mongoose** |
| Role | Player avatar; tenant of the Keeper's Cottage bedsit; eventual lighthouse keeper |
| Creator | An editable **lease card** filled in with Wren (visible, editable character creator) — not a hidden quiz |
| Replaces | WW's player avatar, but an animal rather than a human-looking kid; lease card instead of WW's hidden taxi quiz (O1) |
| Flag | AC has otter special characters; the river-otter option on the lease card needs the competitive species check `[NEED SOURCE]` |

### 4.2 Personality and voice

- Mostly a blank for the player to fill. The default animations supply a temperament: **earnest, curious and a little over-eager**.
- The newcomer who says yes to every errand and stops to watch the tide come in.
- **Never speaks unprompted.** Talks only through choices: **Linger topics, nickname replies, porch talk**.
- **Never shown failing or being scolded**: no sting face, no guilt (Pillar 7).
- Body language over words: leans in to listen, hops when a build finishes, waves at lit porches.

### 4.3 Sample lines

| Context | Line |
|---|---|
| Linger topic | "(Linger) What's actually up the north creek?" |
| Nickname reply | "(to Tuck's nickname) How about 'Lantern' instead?" |

### 4.4 Look (red panda preset)

| Element | Spec |
|---|---|
| Cell / body | 32×32 cell; body bounding box 24×32; feet on row 31; centred on x=15 |
| Proportions | About 2.5 heads tall: head 12×11, torso 10, legs 6 |
| Silhouette key | Two tall rounded ears (4 px, cream inner tips) plus a big bushy tail that curls UP behind the right hip to shoulder height (8×11; the tip breaks the body outline 4 px to the right). Nobody else in the cast has a high, curled tail |
| Head | Rust `#C2502A` with `#E07A3F` highlight on the crown |
| Mask | White `#F6F1E3`: a 6×3 muzzle patch, two 2×1 "eyebrow" dots above the eyes, white ear rims. 1-px rust "tear-track" stripes run from the inner eye corners down the white cheeks |
| Eyes / nose / blush | Eyes 2×3 `#141B33` with a 1-px `#F6F1E3` highlight; nose 2×1 `#3A1F1C`; optional 2×1 blush `#F2A7B5` |
| Body | Lighthouse-stripe jumper, horizontal 2-px bands of navy `#3B4A6B` and cream `#F4E8C1` (navy at collar and hem), striped sleeves to the elbow |
| Limbs | Forearms and legs are dark "socks" `#4A2A22`; small boots `#7A5A36` |
| Tail | 4 rings alternating `#C2502A` and `#E9C08A`, dark tip `#4A2A22` |
| Outline | Selective. `#3A1F1C` around fur, `#141B33` around the jumper; never pure black |
| Errand variant | The co-op apron (`#4F6D7A`, from Wren's palette) layered over the jumper |

### 4.5 Arc

| Act | Beats |
|---|---|
| ACT 1 | Walks the tidal causeway at dusk, when nobody arrives on foot any more, with the sea closing over the stones behind them. Fills in the lease card with Wren (the visible, editable character creator). Moves into the bedsit of the Keeper's Cottage at the foot of the dark lighthouse. Works through the **First Week Errands** clipboard. Pays **loan 1 (12,000 buttons)**: their porchlight comes on, visible across the harbor; **Dimity moves into the lamp**; **Wick starts calling them "Keeper"** |
| ACT 2 | The daily loop (**shake, fish, dig, sell, pay**) grows the cottage one tier at a time while the tower scaffolding climbs. Chooses **four room commissions**. Sees neighbors' life threads through; each finished thread brings in a **5% resident share**. Reads Hesper's morning letters and pins relics to Barnaby's string wall |
| ACT 3 | Pays the **seventh loan** for the **Lamp Room**. At dusk Juniper hands over **Isolde's keeper's lantern**, and the Newcomer and Wick carry its flame up the stair. The beam sweeps every roof and a ferry horn answers |
| One line | From "the newcomer on the dark point" to "the reason the coast is lit", and the game keeps going after that |

### 4.6 Routine / economy

- Core daily loop: shake (trees), fish, dig, sell, pay.
- Has a Linger verb (topic prompts with NPCs), nickname replies, porch talk.
- Releasing a fish is allowed and is the signature animation (WW's pocket menu never allowed it, O4).
- Receives: bedsit key and 12,000-button loan from Wren; nicknames from Tuck; sweatband wearable from Tuck; porch painting from Odile; one letter per morning from Hesper; heirlooms (ultimately Isolde's lantern) from Juniper; 5% resident shares from completed threads.

### 4.7 Animations

**idle** — 4 frames, loop, 250 ms per frame. Breath and tail sway. Reads as calm and attentive.

| Frame | Pose |
|---|---|
| F1 | Neutral, arms at sides |
| F2 | Chest rises; head and torso up 1 px; tail tip curls 1 px higher |
| F3 | Neutral |
| F4 | Tail tip flicks 1 px outward and the left ear twitches 1 px down (the twitch plays only every other loop) |

**walk** — 4 frames, loop, 125 ms per frame, facing down. In-engine the player gets the full 8-frame walk; this is the pitch-sheet cycle.

| Frame | Pose |
|---|---|
| F1 | Left foot forward (left leg 2 px longer, right leg tucked); right arm swings forward 1 px |
| F2 | Passing pose, feet together, whole sprite up 1 px, tail swings 1 px left |
| F3 | Right foot forward, left arm forward |
| F4 | Passing, up 1 px, tail 1 px right |
| Secondary | Ears bob 1 px one frame late |

**let_it_go** — SIGNATURE. 6 frames, one-shot, 90 ms per frame (F3 held 180 ms, F6 held 300 ms). Releasing a fish; sets the gentle, nothing-is-punished tone. Fish prop is 8×4 and stays inside the sheet's palette: navy `#3B4A6B` back, cream `#F4E8C1` belly, 1-px `#F6F1E3` eye.

| Frame | Pose |
|---|---|
| F1 | Cradles the fish at chest height in both paws, eyes looking down at it |
| F2 | Anticipation crouch, squash 1 px, fish lowered to the waist |
| F3 | Swing; arms overhead, body stretched 1 px taller, fish above the head, eyes closed in happy arcs (held 180 ms) |
| F4 | Release; paws open and the fish heads for the upper-left corner, using a second pre-drawn fish frame bent mid-flip (no sprite rotation), with two 1-px water drops |
| F5 | The fish dives out of the cell at bottom-left, arms come down, tail lifts 1 px |
| F6 | A 3-px `#F6F1E3` splash ring at bottom-left while the player gives a small wave (held 300 ms) |

---

## 5. WREN HEARTHWRIGHT — "The one you owe"

### 5.1 Identity

| Field | Value |
|---|---|
| Species | Beaver |
| Role / job | Builders' co-op; holds the player's hearth loan; counts payments; draws blueprints; designs the room commissions and the Lamp Room |
| Family | Daughter of **Ambrose** (see Section 12) |
| Replaces | WW's mortgage holder. In WW the landlord is also the shopkeeper; PORCHLIGHT gives the debt to a builders' co-op, **interest-free**, and hands the shop to a different character (Juniper) |
| Flag | AC has a beaver special character, a fishing-tourney host, in a completely different role. The species-for-role mapping stays distinct, but it belongs in the competitive check `[NEED SOURCE]` |

### 5.2 Personality and voice

- **Precise, anxious and secretly funny.**
- Counts everything twice, three times when it's your money.
- Speaks in **exact numbers** and apologises for them, then slips in a **deadpan joke under her breath** and checks whether you heard.
- **Never pressures you**: "Pay it when you can."
- Her anxiety is about **her own work**, not your debt. She's terrified her first original design will disappoint, so you end up rooting for her as much as she roots for you.
- Tics: **pushes her spectacles up when nervous; taps her tail to keep count.**

### 5.3 Sample lines

| Context | Line |
|---|---|
| Loan offer (Act 1) | "Twelve thousand buttons, no interest. Pay it when you can. We build while you sleep." |
| Counting a payment | "Four thousand… five thousand… five thousand eight hundred. I counted twice. Sorry. Three times." |
| Ledger Board pace estimate (her handwriting) | "about 6 days" |
| Co-op sign, post-finale, in her own hand | "Lamp Room by W. Hearthwright." |

### 5.4 Look

| Element | Spec |
|---|---|
| Cell / body | 32×32 cell; body 24×30 (2 px shorter than the player and 4 px wider at the hips); feet on row 31; centred on x=15 |
| Silhouette key | Pear shape (shoulders 14 px, hips 20 px) with a big FLAT PADDLE TAIL lying on the ground behind her and jutting out low-left as a 10×5 oval: a low horizontal bar where the player has a high curl. Ears tiny (2 px), so her head reads flat-topped apart from the spectacles bump |
| Face | Hazel fur `#8A5A3B` with `#B07A52` highlights on crown and cheeks. Cream muzzle `#E9D3B0` (6×4) with two orange incisors `#F2A541` as a 2×2 block that is **always visible** (her face signature). Eyes 2×2 `#2E1C12` with a 1-px `#CFE7F2` glint |
| Spectacles | Round, pushed up on her forehead: two 3×3 brass rings `#D9A441` with `#CFE7F2` lens glints |
| Pencil | Behind her right ear: 1×4 `#D9A441` with a `#2E1C12` tip |
| Tail | `#5A3A2A` crosshatched in a diamond grid of 1-px `#3E2618` lines |
| Outfit | Canvas overalls `#4F6D7A` (`#34505C` shadow) with two brass buttons `#D9A441` |
| Props | Ledger clipboard under her left arm (6×8, paper `#F4F1E6` ruled with 1-px `#34505C` lines). Pocket abacus clipped to her bib (8×5 frame in `#5A3A2A`, three rows of 1-px `#D9A441` beads) |
| Outline | `#2E1C12`, selective |
| Rig sharing | Her father Ambrose isn't one of the seven but shares her rig with a grizzled palette, bottle-bottom lenses and a cane |

### 5.5 Arc

| Act | Beats |
|---|---|
| ACT 1 | Waits at the causeway end with a lantern and the lease card. Tells you plainly that her small talk only sets your **starter houseplant** and the **first morning's weather**. Hands over the bedsit key and a **12,000-button hearth loan**: "Pay it when you can. We build while you sleep." Counts loan 1 at the co-op yard while Ambrose gnaws the notches and splits the **tally stick** with one THWAP of his tail. **Your half goes on your wall** |
| ACT 2 | Ambrose can't read blueprints any more, so she starts signing them herself. **Your loan-3 commission is the first design she didn't copy from his book**, and she's visibly nervous. If you tell her it's your favourite room, **she remembers and brings it up later**. On early mornings you can see her waving from the ladder while **the Thatch** tie off your roof. The **Ledger Board's pace estimate ("about 6 days") is her handwriting** |
| ACT 3 | Offers the **seventh loan for the Lamp Room**, her masterpiece |
| FINALE | Ambrose, nearly blind, walks the Lamp Room with one hand on the wall and says it's better than his. Wren hides behind her clipboard. Afterwards the co-op sign gets a new line in her own hand: "Lamp Room by W. Hearthwright." |

### 5.6 Routine / economy

- Present at the causeway end at dusk on day 1; at the co-op yard for payment ceremonies; on the ladder in early mornings during builds.
- The co-op **builds overnight** ("We build while you sleep").
- Issues **seven loans** in total; loan 1 is 12,000 buttons; all **interest-free**; no deadline, no pressure.
- Loan 3 is tied to her first original room design; loan 7 is the Lamp Room.
- Each payment plays the payment ceremony: her `the_count`, then Ambrose's notch-gnaw and THWAP on his own sprite.
- Remembers if you called the loan-3 room your favourite.

### 5.7 Animations

**idle** — 4 frames, loop, 200 ms per frame. Tail-tap tally. Reads as someone silently counting.

| Frame | Pose |
|---|---|
| F1 | Neutral, clipboard under arm, spectacles on head |
| F2 | Tail tip lifts 1 px; eyes glance 1 px down at the clipboard |
| F3 | Tail slaps down and a single `#E9D3B0` dust pixel pops beside the tip |
| F4 | Eyes back up to the viewer; ears twitch 1 px |

**walk** — 4 frames, loop, 125 ms per frame, facing down. A beaver waddle. The tail drags on the ground throughout, so its bottom edge stays on row 31.

| Frame | Pose |
|---|---|
| F1 | Left foot forward (2 px lower), whole upper body shifted 1 px left (a pixel shift, never rotation), tail swings 1 px right |
| F2 | Passing pose, feet together, body up 1 px, clipboard bobs up 1 px |
| F3 | Right foot forward, body 1 px right, tail 1 px left |
| F4 | Passing, up 1 px |

**the_count** — SIGNATURE. 5 frames, one-shot with a loop section, 100 ms per frame. The first beat of the payment ceremony; shows her as precise, anxious and quietly proud.

| Frame | Pose |
|---|---|
| F1 | Unclips the abacus and holds it at chest height in both paws, clipboard tucked |
| F2 | Spectacles drop from forehead to nose (2 px down); she means business now |
| F3 | A paw flicks one bead 3 px left, with a 1-px `#F4F1E6` spark and a "click" SFX |
| F4 | Tail tap with a dust pixel |
| Loop | **F3–F4 loop once per 1,000 buttons paid**, so a 12,000-button payment clicks 12 times |
| F5 | Finish. She pushes the spectacles back up with one finger, does a small squash (1 px wider, 1 px shorter) and smiles with her incisors; **hold 400 ms** |
| After | Ambrose's notch-gnaw and THWAP then play on his own sprite |

---

## 6. JUNIPER PELL — Shopkeeper

### 6.1 Identity

| Field | Value |
|---|---|
| Species | Magpie |
| Role / job | Runs the shop from day 1; buys what you sell; sells goods; secretly the town's "pawnbroker in reverse" |
| Replaces | WW's general store (the shop half of WW's landlord-shopkeeper), with **no part in the debt** |
| Flag | Naming: "Pell" is one letter off the name of a WW post-office character. Do a naming check before any reveal `[NEED SOURCE]` |

### 6.2 Personality and voice

- **A theatrical haggler with a soft centre.**
- Sharp-eyed and quick-tongued; loves anything that shines; plays every sale like a stage show ("You're robbing me!") but **always lets you win**.
- Collects **stories** more than objects.
- Secret (comes out slowly as the shop expands): for **thirty years** she has bought the town's pawned heirlooms one at a time so no mainland dealer could get them, and she **gives each one back for nothing when its porch relights**.
- Tics: **freezes mid-sentence when something glints; dives behind the counter at the first sign of bees.**

### 6.3 Sample lines

| Context | Line |
|---|---|
| On currency | "Buttons! My favourite currency. Don't tell the other currencies." |
| Haggling (you selling 30 oranges) | "Thirty oranges and you want HOW much? …Fine. FINE. You're robbing me blind and I'm charmed." |
| Stock haggle line | "You're robbing me!" |

### 6.4 Look

| Element | Spec |
|---|---|
| Cell / body | 32×32 cell; body 22×32; feet on row 31; centred on x=15 |
| Silhouette key | Compact upright bird with a LONG WEDGE TAIL trailing down-left behind her legs to the bottom-left corner of the cell (10 px), and a sharp 4-px beak. Even in the down-facing view her head is held in a **3/4 turn so the beak juts left**, because a bird seen face-on is unreadable at 32 px |
| Second key | The hard black/white split: black head, back and wings `#1F1D2A` (highlights `#3A3848`) against a white belly panel `#F1EEE6` (8×10, shadow `#B9B4C4`) and two 3×4 white shoulder patches |
| Sheen | Tail and wing edges carry an iridescent sheen that **palette-cycles `#2A6F8F` to `#3FAE8C` over 4 steps at 150 ms**; the only animated colour in the cast |
| Eyes / legs | Eyes 2×2 `#141B33` with a 1-px `#F1EEE6` glint; thin legs `#3A3848` |
| Outfit | Shopkeeper's apron `#C97B2C` (shadow `#8A4F1A`) with too many pockets: five 2×2 `#8A4F1A` rectangles, one showing a 1-px `#D9A441` trinket glint |
| Outline | `#141B33` (night ink); black plumage needs the darkest outline in the master palette |

### 6.5 Arc

| Stage | Beats |
|---|---|
| Day 1 onward | Runs the shop from day 1 |
| Shop expansions | Each expansion happens **overnight** and **never costs a closed day**: if the work spills over, she sells from a **cart outside at full price** (fixes O8). Each expansion also opens up more of her **back room**: shelves of wrapped and labelled heirlooms |
| Heirloom returns | As Hesper's letters name their owners, Juniper hands them back when those porches light: **the Dorrows' kettle**, **the nameboard from the Brack family's oyster boat for Tamsin**, "and so on" |
| Mid-game reveal | Her family kept the shop open through the **Ebb winter**, and ever since she has been the town's pawnbroker in reverse, buying heirlooms only so she can give them back |
| Thread completion | Pays a **5% resident share** |
| FINALE | At dusk on **Relighting day** she gives you the last heirloom from the back room, **Isolde's keeper's lantern**, whose flame lights the lamp |

### 6.6 Routine / economy

| Topic | Detail |
|---|---|
| Buys | Whatever the player sells (oranges are the quoted example; "something shiny" triggers her signature animation) |
| Sells | Shop goods (specific inventory not given in this section) |
| Gives | Heirlooms from the back room, free, when their owner's porch relights; Isolde's lantern at the finale |
| Hours | Open from day 1; never a closed day; expansions overnight; cart outside at full price during spill-over work. Specific opening hours are not given in this section |
| Currency | Buttons (the 2×2 brass sprite in her signature animation is the game's currency) |

### 6.7 Animations

**idle** — 3 frames, loop, 180 ms per frame. Restless and watchful.

| Frame | Pose |
|---|---|
| F1 | Neutral |
| F2 | The magpie tail pump; tail flicks up 2 px and the sheen advances one step |
| F3 | A quick head flick to her right (head shifts 1 px, beak now juts right), then back to F1 |

**walk** — 4 frames, loop, 125 ms per frame, facing down. A pigeon-toed strut with a bird head-bob. In-engine her **run is a two-footed hop**.

| Frame | Pose |
|---|---|
| F1 | Left foot forward, head forward and down 1 px |
| F2 | Passing pose, body up 1 px, head back |
| F3 | Right foot forward, head forward and down 1 px |
| F4 | Passing, up 1 px |
| Secondary | Tail swings 1 px opposite the stepping foot; sheen cycles continuously |

**glint_and_pocket** — SIGNATURE. 5 frames, one-shot, 90 ms per frame (F1 held 250 ms). Shows her sharp eye and harmless acquisitiveness. **Plays whenever you sell her something shiny.**

| Frame | Pose |
|---|---|
| F1 | Freeze. She stops mid-gesture and one eye widens from 2×2 to 3×3 (held 250 ms) |
| F2 | A 1-px `#D9A441` sparkle flashes at the upper right of the cell and her head snaps 1 px toward it |
| F3 | Hop. The whole sprite rises 2 px, legs tuck to a 2-px stub, tail fans 1 px wider |
| F4 | Lands with a 1-px squash and her beak plucks the glint. It's a 2×2 brass BUTTON, the game's currency |
| F5 | She tucks it into an apron pocket with a wingtip, pumps her tail up, runs the sheen through all 4 steps and gives the viewer innocent half-lidded eyes (eyes drop to a 2×1 line) |

---

## 7. BARNABY THOLE — Curator and collector

### 7.1 Identity

| Field | Value |
|---|---|
| Species | Hermit crab |
| Role / job | Curator of **the Archive**; names everything you bring in **one batch**; writes **provenance cards** (tide, place, finder); keeps the **string wall** that links relics to letters |
| Replaces | WW's museum curator (an owl in WW). The Archive also hosts the string wall, and identification happens in one batch (O10) |
| Home | A brass diving helmet; from midsummer, a ship's bell dug out of the Old Quay |

### 7.2 Personality and voice

- **Excitable, fussy and kind; a pedant who apologises for being one.**
- Cares less about what a thing is than **where it was found, by whom and at what tide**. Provenance is his love language.
- Insists his helmet "fits perfectly"; it does not.
- Gets so excited that his porthole fogs.
- A small creature in a big field; secretly worries the Archive isn't "a real museum".
- **Talks fast, in parentheses.** Breaks the habit exactly once (late game, see arc).

### 7.3 Sample lines

| Context | Line |
|---|---|
| Receiving a find | "A cockle! Oh, a COCKLE. East flats, low tide, Tuesday — I'm writing it on the card. Provenance is everything." |
| On the helmet | "No, the helmet fits perfectly. I simply prefer to be… snug." |
| Late game, pinning the last string (no parentheses) | "Oh. Oh, that poor keeper." |
| Plinth label after moving into the bell | "Exhibit 1: My Old House" |

### 7.4 Look

| Element | Spec |
|---|---|
| Cell / body | 32×32 cell; body 24×30; legs on row 31; centred on x=15 |
| Silhouette key | A SPHERE; the only round body in the cast |
| Helmet | Brass diving helmet (a 20×18 dome), one size too small: `#B8862F` base, `#E3B867` highlight crescent on the upper left, `#7A5A1E` shadow on the lower right, four single-pixel `#F6F1E3` rivets around an 8×8 round face porthole of `#9FD3C0` glass with a 1-px `#F6F1E3` glint |
| Face | Through the glass: two stalked eyes (each 1×2 `#141B33`) and a small mouth |
| Claws | Mismatched coral claws `#E06A4F` (shadow `#A8402E`) poke out of the too-tight neck ring: **left claw big (6×5), right claw small (4×4)**, true hermit-crab asymmetry |
| Legs / valve | Four short legs show under the rim; a 2×2 valve (`#7A5A1E`) on top where bubbles come out |
| Outline | `#3A2410` |
| SUMMER VARIANT | From the spring-tide Old Quay beat onward he lives in a **ship's bell** instead, `#8C6A3E` with `#C9A54A` highlights. A trapezoid with a flared rim and a visible clapper that dings as he walks; same claws and legs |

### 7.5 Arc

| Stage | Beats |
|---|---|
| Week 1 onward | Names everything you bring in one batch, writes provenance cards (tide, place, finder) and keeps the string wall. Every relic history and every letter you show him gets pinned and threaded to the others, so **the wall becomes the visible state of the mystery** |
| Midsummer | A spring tide uncovers the **Old Quay** and a **ship's bell**. Once you dig the bell out, he moves out of the helmet and into it: a house upgrade of his own that mirrors yours. He puts the helmet on a plinth labelled "Exhibit 1: My Old House" |
| Autumn | Hosts **Odile's Twelve Lights gallery** in the Archive |
| Late game | Pins the last string, between **the weir records, Isolde's letters and the lamp**, and for once doesn't talk in parentheses: "Oh. Oh, that poor keeper." |

### 7.6 Routine / economy

- Accepts relics and finds; identification is a single batch, not one-at-a-time.
- Output per item: a provenance card recording tide, place and finder.
- Accepts letters to pin to the string wall (the mystery's visible state).
- The Archive hosts events (Odile's gallery in autumn).
- `eureka_fog` plays on **every new Archive entry**.
- Hours: not given in this section.

### 7.7 Animations

**idle** — 3 frames, loop, 220 ms per frame.

| Frame | Pose |
|---|---|
| F1 | Neutral |
| F2 | Helmet settles 1 px lower and legs splay 1 px outward |
| F3 | The big claw opens a 1-px gap and snaps shut ("tik") |
| Every 4th loop | A 1-px bubble rises from the valve and pops at row 1 |

**walk** — 4 frames, loop, 110 ms per frame, facing down. A fast patter (his in-engine left/right walk is a **sideways scuttle**).

| Frame | Pose |
|---|---|
| F1 | Leg set A down (outer left, inner right), helmet at base |
| F2 | Helmet up 1 px, highlight crescent unchanged (no rotation) |
| F3 | Leg set B down |
| F4 | Helmet up 1 px and shifted 1 px right, then back |
| Secondary | Claws swing 1 px alternately with each step. The summer bell version adds a 1-px clapper swing and a "ding" on F1 |

**eureka_fog** — SIGNATURE. 5 frames, one-shot, 100 ms per frame (F3 and F5 held 200 ms). Delight that literally steams him up. Plays on every new Archive entry.

| Frame | Pose |
|---|---|
| F1 | Eyes go wide behind the glass (1×2 to 2×3) |
| F2 | The porthole starts to fog: a 50% ordered dither of `#E9F7F2` over the glass |
| F3 | Fully fogged mint-white; both claws thrown up above the helmet's equator, widening the silhouette to 28 px (held 200 ms) |
| F4 | A 3-px bubble rises from the top valve and the claws wiggle 1 px |
| F5 | The bubble pops in a 1-px plus-shaped burst at row 1, the fog clears from the centre outward, and his eyes are beaming (held 200 ms) |

---

## 8. TUCK — Villager A, "Hearty" personality

### 8.1 Identity

| Field | Value |
|---|---|
| Species | Wombat |
| Role / job | Starter neighbor; nickname-giver; athlete reviving **Mudlark Day** |
| Personality type | **Hearty** |
| Replaces | A WW villager slot; the nearest WW personality type is jock |
| Flag | Name flags: "Tuck" is close to an existing AC villager name, and the vision's neighbors "Clem" and "Bramble" share names with existing AC villagers. **Rename all three before any reveal** `[NEED SOURCE: naming check]` |

### 8.2 Personality and voice

- **Loud, warm, physical, relentlessly encouraging.**
- Everything is training, so carrying three oranges counts as "a rep".
- Says exactly what he thinks the moment he thinks it, and never stays on a feeling for long.
- **Gives everyone a nickname within a day**, and takes it brilliantly if you decline or suggest a better one ("Ooh, better. Locked in.").
- Only one thing makes him nervous: **Mudlark Day**.
- CONTRAST WITH ODILE: he lives in the present and is loud, square and body-first; she lives a little ahead in time and is quiet, tall and eye-first. They're close friends anyway. She once painted him mid-lap and he cried.

### 8.3 Sample lines

| Context | Line |
|---|---|
| First meeting / nickname | "NEW NEIGHBOR! Welcome! Strong carrying arm on you. I'm calling you 'Ringtail.'" |
| Player declines and counters | "No? Respect. What've you got? …'Lantern'? Ohh, that's better than mine. Locked in!" |
| Accepting a better nickname (stock) | "Ooh, better. Locked in." |

Nickname flow: he proposes one (default example "Ringtail"); the player can **accept, decline, or suggest another** (example "Lantern"). This is Porchlight's version of the "C-cat" moment (O12) from the author's WW run, made consensual.

### 8.4 Look

| Element | Spec |
|---|---|
| Cell / body | 32×32 cell; body 26×22, sitting on the bottom of the cell (rows 10–31); centred on x=15. The widest, lowest sprite in the cast |
| Silhouette key | A near-perfect SQUARE with a flat top, broken only by two 3×3 round ears at the corners and the trailing ends of his sweatband: "a box with a headband" at any size. No neck: a big flat head runs straight into heavy shoulders, with short 3-px legs and broad paws |
| Fur | Brown-grey `#7D6A58`, `#5A4A3E` shadow along the bottom and sides, `#A8927C` highlight along the top edge; pale muzzle and belly `#C9B49A` |
| Face | A big square 4×2 nose block in `#2A2433` (the wombat's best feature) and tiny 1×2 eyes in `#2A2433`, set wide |
| Kit | Orange sweatband `#E07A3F` (shadow `#B5452E`) across his forehead, its ends trailing 2 px to his left. A cream race bib `#F4F1E6` pinned to his chest with a "7" in `#2A2433` (3×5 pixel font) |
| Outline | `#2B221C` |

### 8.5 Arc and life thread: "The Mudlark Mile"

- Starter neighbor who gives you your **first nickname in week 1**.
- Lead life thread **"The Mudlark Mile"**: **5 beats over 3–6 real weeks; it advances only if you're involved.**

| Beat | Event |
|---|---|
| 1 | He asks you to **time his laps** across the flats at low tide |
| 2 | He pins a **Commons request for a grey mullet** for his "race diet" |
| 3 | He **loses a practice race to Tamsin the badger** and sulks for exactly one day |
| 4 | On his porch at night he admits he was the slowest kid on the coast, and that **nobody has run Mudlark Day since the harbor died**, so he's reviving it alone |
| 5 | On **Mudlark Day** you pace him through the mud, and **win or lose he gives you his sweatband as a wearable** |

- Finishing the thread pays a **5% resident share toward your current loan**.
- Side texture: a **garden-fence feud with Bramble the marmot** that you can broker or quietly take a side in, and **both of them remember which you chose**.

### 8.6 Routine / economy

- Trains on the flats at low tide; porch talk at night (beat 4).
- Requests: grey mullet via the Commons board.
- Gives: nicknames (accept/decline/counter); his sweatband (wearable) at the end of the thread.
- Hours: not given beyond the above.

### 8.7 Animations

**idle** — 4 frames, loop, 160 ms per frame; the fastest idle in the cast. Warm-up bounce. He can't stand still.

| Frame | Pose |
|---|---|
| F1 | Neutral |
| F2 | Knee bend; squash 1 px shorter and 1 px wider |
| F3 | Spring up to 1 px above neutral, sweatband ends lifting |
| F4 | Back to neutral, with the sweatband ends flicking down 1 px a beat late |

**walk** — 4 frames, loop, 125 ms per frame, facing down. A stompy jog-walk with a side-to-side rock.

| Frame | Pose |
|---|---|
| F1 | Left paw forward, whole body shifted 1 px left, a 1-px `#C9B49A` dust puff at the paw |
| F2 | All paws under, body up 1 px |
| F3 | Right paw forward, body 1 px right, dust puff |
| F4 | Up 1 px |
| Secondary | The sweatband ends lag one frame behind the body |

**flex_and_name_you** — SIGNATURE. 5 frames, one-shot, 100 ms per frame (F3 held 300 ms, F4 held 400 ms). The nickname moment. **Plays when he gives, accepts or changes a nickname.**

| Frame | Pose |
|---|---|
| F1 | Anticipation; squash 2 px wider and 1 px shorter, eyes squeezed shut |
| F2 | Both arms go up into a double-biceps flex, and two bumps rise above his shoulders, breaking the flat top |
| F3 | Hold, with a 1-px `#F4F1E6` sparkle on each "bicep" and one sweat drop flying off (held 300 ms) |
| F4 | He snaps one paw straight at the viewer (drawn 1 px larger and centred low in the cell, a foreshortened point), mouth open in a grin (held 400 ms) |
| F5 | Settles back to neutral with his nose 1 px up, proud |

---

## 9. ODILE — Villager B, "Dreamy" personality

### 9.1 Identity

| Field | Value |
|---|---|
| Species | Roseate spoonbill |
| Role / job | Starter neighbor; painter |
| Personality type | **Dreamy** (a new personality type with no direct WW equivalent; the nearest is normal) |
| Replaces | A WW villager slot |

### 9.2 Personality and voice

- **Soft-spoken and unhurried, already half in tomorrow's sunset.**
- Notices light before she notices people, then surprises you by noticing exactly how you feel.
- Talks in **half-finished sentences that trail off into colour names** ("…apricot").
- Shy about praise, but bold about asking you to **stand very still in one spot at one exact minute**.
- CONTRAST WITH TUCK: quiet where he's loud, tall where he's square, lingering where he moves on. She has the slowest idle in the cast; he has the fastest. She once painted him mid-lap and he cried.

### 9.3 Sample lines

| Context | Line |
|---|---|
| Posing you for a painting | "Oh… stand there. No — there. Where the light goes… apricot. Yes. Don't move for a minute." |
| The morning after your porch lights | "Your porch came on last night. I saw it from the green. Honey, with a cold edge. I'll need a bigger brush." |
| Stalled on the lighthouse canvas | "you can't paint a light that isn't there" |

### 9.4 Look

| Element | Spec |
|---|---|
| Cell / body | 32×32 cell; body 20×32 using the full cell height; feet on row 31; centred on x=15. The tallest, thinnest sprite in the cast; **in-engine she's 22×38**, and the pitch sheet shortens her legs to fit |
| Silhouette key | A tall vertical with a LADLE. Her long flat bill `#C9B48A` (shadow `#8C7A5A`) hangs down in front of her chest, 7 px long, ending in a round 3×3 spatula, with the head held in a slight 3/4 turn so the spoon reads. Add a beret bump on top and long stick legs |
| Plumage | Pink `#F2A7B5`, deeper wing pink `#E07A9A`, shadow `#B5527A`, a crimson shoulder patch `#A3283A`, and a pale cream-white neck `#F6F1E3` in a gentle S-curve |
| Legs | 10 px, `#A3283A` |
| Beret | Navy `#3B4A6B` tipped over her right eye |
| Paint flecks | Wingtips flecked with single pixels of paint, `#3FA7D6` and `#FFE29A` |
| Eye | 1×1 `#A3283A` ringed in `#4A1E30` |
| Outline | `#4A1E30` (dark plum) |

### 9.5 Arc and life thread: "Twelve Lights"

| Stage | Beats |
|---|---|
| Trigger | Whenever a porch comes on (through your loans or a Commons project reopening a dark house), she asks you to stand in a particular spot at **golden hour** and paints the scene |
| Mid-thread | She **stalls on the lighthouse** ("you can't paint a light that isn't there"), and that canvas sits unfinished on her easel for weeks |
| Autumn | **Barnaby hosts her gallery in the Archive** and she gives you **the painting of your own porch for the cottage wall**. The thread completes there and pays a **5% resident share** |
| Epilogue | She finishes the **twelfth canvas, the lighthouse lit**, on the night of the Relighting, and **the credits roll over her paintings** |

### 9.6 Routine / economy

- Paints at golden hour; watches the town from the green at night.
- Asks the player to pose (stand still at an exact spot and minute) each time a porch relights.
- Gives: the painting of the player's porch (a cottage wall item).
- Hours beyond "golden hour" not given.

### 9.7 Animations

**idle** — 3 frames, loop, 320 ms per frame; the slowest idle in the cast, deliberately opposite Tuck's. One-legged daydream.

| Frame | Pose |
|---|---|
| F1 | Standing on one leg, the other tucked as a 2-px bump under her belly |
| F2 | Head drifts up 1 px, eyes half-lidded (the eye becomes a 1-px line) |
| F3 | A slow blink as the beret slips 1 px. Back to F1 |

**walk** — 4 frames, loop, 150 ms per frame, facing down. A high-stepping wader's gait.

| Frame | Pose |
|---|---|
| F1 | Left leg lifted with the knee 3 px up; neck and head forward and down 1 px, so the spoon swings forward |
| F2 | Left leg down, body up 1 px, head back |
| F3 | Right leg lifted 3 px, head forward |
| F4 | Leg down, body up 1 px |
| Secondary | The spoon swings one pixel behind the head as follow-through |

**frame_the_light** — SIGNATURE. 5 frames, one-shot, 120 ms per frame (F3 held 500 ms). She sees everything as a painting. **Plays when she asks you to stand somewhere.**

| Frame | Pose |
|---|---|
| F1 | She stops and looks past you (eye 1 px up and left) |
| F2 | Both wings lift outward 3 px beyond the body, widening the silhouette to 26 px |
| F3 | The wingtips fold forward and meet in front of her face, forming a 10×7 rectangular "viewfinder" outlined in `#E07A9A` with her eye visible through the gap (held 500 ms) |
| F4 | A `#FFE29A` sparkle blinks inside the frame, and one `#3FA7D6` paint fleck drifts 2 px down from a wingtip |
| F5 | A contented sigh. Wings fold down, the beret slides 1 px to the other side, eyes closed |

---

## 10. HESPER COIL — The mysterious recurring visitor tied to the story

### 10.1 Identity

| Field | Value |
|---|---|
| Species | Garden snail |
| Role / job | Postal worker; works nights; delivers the thirty-year letter backlog, exactly one per morning, at 6 am |
| Replaces | WW's town-hall post desk plus the morning-mail ritual (O15). Her role delivering the story one letter at a time is new |

### 10.2 Personality and voice

- **Slow, meticulous, soft-voiced and quietly guilty.**
- She **reads every letter before she delivers it**, which is why she's slow and why she always seems to know more than she says.
- **Answers questions with questions.**
- Stubborn about order ("Order is a kindness"): **exactly one old letter per morning, never two, whatever you offer.**
- Works nights because "snails do our best work when nobody's watching."
- Mysterious through restraint. She never tells you what the next letter says, but **her eyestalks droop on mornings when it's a hard one**.

### 10.3 Sample lines

| Context | Line |
|---|---|
| Morning delivery | "Good morning. One for you. It's… a little late. Thirty years, give or take. I'm sorry." |
| On reading the mail | "Yes, I read it. I read all of them. Somebody should, before they go back out into the world." |
| On order | "Order is a kindness" |
| On night work | "snails do our best work when nobody's watching." |

### 10.4 Look

| Element | Spec |
|---|---|
| Cell / body | 32×32 cell. FRONT VIEW (used for idle, walk and signature): body 22×26, foot on rows 28–31, centred on x=15. SIDE VIEW (in-engine left/right): a long, low 32×20 |
| Silhouette key | The only limbless member of the cast. Where her shell should be, she carries a rounded canvas MAIL SATCHEL (18×14, `#C9B48A` with `#8C7A5A` shadow), shaped like a spiral shell but with a squared flap. Two or three white envelope corners `#F4F1E6` stick up out of its top edge like paper spikes |
| Eyestalks | Two long eyestalks (6–7 px) splay outward in a wide V so the dark eye tips `#2E3A2C` poke out past the satchel's left and right edges |
| Buckle | A 2×2 brass buckle `#D9A441` at the centre of the flap |
| Body | Pale olive `#A9B8A0` with `#7A8C74` shadow, a soft foot "skirt" spreading 22 px wide at the bottom, and a 1-px `#E9F7F2` glisten streak along it |
| Night | A tiny lantern hangs from her left eyestalk, 2×2 `#F9C46B` with a dithered 1-px halo |
| Trail | 1-px `#E9F7F2` shimmer pixels left behind her that fade over 3 s |
| Props | Old letters are `#E8D3A0` with a `#A8323A` wax seal |
| Outline | `#2E3A2C` (dark moss) |

### 10.5 Arc

| Act | Beats |
|---|---|
| ACT 1 | She can't reopen the post office until you **carry the mail sack in from the causeway** (one of the First Week Errands); then her lamp comes on. At **6 am the next morning** she slides out the first yellowed envelope of the **thirty-year backlog**, addressed **To the Keeper**: "The light is fine. It's the river that's wrong. —I." From then on she comes to your mailbox every morning with exactly one old letter. There are **about 120** in a **fixed order**, **capped at one per in-game morning even if the clock is changed** |
| ACT 2 | Some mornings her shimmer trail leads **up the lighthouse stair**; she has been reading **Isolde's letters** up there by the dead lamp. Her arc moves from **shame** (the letters are thirty years late) to **fear** (she knows where they lead and dreads how the town will take it). Once, she **asks you whether she should stop delivering** |
| ACT 3 | When the truth is out, the town throws her a **"Late Delivery" party on the green** with her as guest of honour |
| AFTER THE CREDITS | She arrives flustered. One envelope in today's sack isn't from the backlog. It's **postmarked last week, from the Outer Isles**, and reads "I saw the light. —I. Petrel." The rest of the backlog keeps arriving, so the game goes on |

### 10.6 Routine / economy

| Topic | Detail |
|---|---|
| Hours | Works nights; delivery at 6 am each morning |
| Delivery rule | Exactly one old letter per in-game morning; never two; cap holds even if the system clock is changed |
| Backlog size | About 120 letters, fixed order |
| First letter | "The light is fine. It's the river that's wrong. —I." (addressed To the Keeper) |
| Prerequisite | Player must carry the mail sack in from the causeway (First Week Errand) before the post office reopens |
| Post-credits | Non-backlog letter from the Outer Isles, postmarked last week: "I saw the light. —I. Petrel." |
| Tell | Eyestalks droop on the morning of a hard letter |

### 10.7 Animations

**idle** — 4 frames, loop, 300 ms per frame. Reading lean.

| Frame | Pose |
|---|---|
| F1 | Neutral, stalks in their V |
| F2 | Both stalks lean inward 1 px, as if bending over a page |
| F3 | They lean in 2 px, tips almost touching |
| F4 | The stalks spring back out to the V with a 1-px quiver; she has just read something |
| Night | The lantern alternates between two glow sizes every frame |

**walk** — 4 frames, loop, 200 ms per frame, facing down. Half-speed crawl. **She advances only 2 px per cycle**, slow on purpose. A new shimmer-trail pixel spawns behind her on every frame.

| Frame | Pose |
|---|---|
| F1 | A 1-px ripple bulge on the left edge of the foot skirt |
| F2 | The ripple moves to the centre and the satchel dips 1 px |
| F3 | The ripple reaches the right edge; left stalk up 1 px, right stalk down 1 px |
| F4 | The satchel rises back and the stalks swap |

**one_letter_late** — SIGNATURE. 6 frames, one-shot, 140 ms per frame (F4 held 500 ms, F6 held 600 ms). The 6 am delivery, the heartbeat of the story.

| Frame | Pose |
|---|---|
| F1 | She stops at your mailbox and both eyestalks turn to face you (the eyes become 2×2 dots) |
| F2 | The satchel buckle unclasps; buckle drops 1 px, flap lifts 2 px |
| F3 | A yellowed `#E8D3A0` envelope slides halfway up out of the satchel (6×4 visible) |
| F4 | The envelope is fully out, resting on top of the satchel with its `#A8323A` wax seal showing, and her stalks lean in to read it one last time (her habit) (held 500 ms) |
| F5 | A dip of her head nudges it forward; it slides down the front of her shell to the bottom of the cell, leaving a 1-px shimmer streak |
| F6 | The letter rests at her foot facing the viewer, her stalks droop 1 px (apologetic), and a single shimmer pixel twinkles (held 600 ms) |

---

## 11. Life threads, payouts and story milestones

| Thread / milestone | Owner | Length / trigger | Beats | Payout |
|---|---|---|---|---|
| First Week Errands | Newcomer | Week 1 clipboard | Includes carrying the mail sack in from the causeway (reopens post office) | Unlocks Hesper's deliveries |
| Loan 1 | Wren | 12,000 buttons | Porchlight comes on; Dimity moves into the lamp; Wick starts calling you "Keeper"; tally stick split, your half on your wall | — |
| Loan 3 | Wren | Room commission | Wren's first original design (not copied from Ambrose's book) | Wren remembers if you call it your favourite |
| Loans 1–7 | Wren | Seven loans, interest-free | Cottage grows one tier at a time; tower scaffolding climbs; four room commissions chosen in Act 2 | Loan 7 = Lamp Room |
| The Mudlark Mile | Tuck | 5 beats over 3–6 real weeks; advances only if you're involved | Time laps; grey mullet Commons request; loses to Tamsin, sulks one day; porch confession; Mudlark Day race | 5% resident share toward current loan; sweatband wearable (win or lose) |
| Twelve Lights | Odile | One painting per porch relit; twelve canvases | Stalls on the lighthouse mid-thread; autumn gallery at the Archive; porch painting gift; twelfth canvas on Relighting night | 5% resident share (at gallery) |
| Heirloom returns | Juniper | As Hesper's letters name owners and their porches light | Dorrows' kettle; Brack oyster-boat nameboard to Tamsin; "and so on"; mid-game reveal (Ebb winter) | 5% resident share on completion; Isolde's lantern at finale |
| The string wall | Barnaby | Every relic history and letter shown to him | Old Quay bell (midsummer spring tide) → bell house; Odile's gallery (autumn); last string between weir records, Isolde's letters and the lamp | Visible state of the mystery |
| The backlog | Hesper | ~120 letters, 1 per morning at 6 am | First letter "The light is fine. It's the river that's wrong. —I."; shimmer trail up the stair; asks whether to stop; "Late Delivery" party | Post-credits letter from I. Petrel; backlog continues |
| Relighting | All | Loan 7 paid | Juniper gives Isolde's lantern at dusk; Newcomer and Wick carry the flame up; beam sweeps every roof; ferry horn answers; Ambrose approves Lamp Room; co-op sign updated; Odile's twelfth canvas; credits over her paintings | Game continues |

General rule stated for the Newcomer's Act 2: **each finished neighbor life thread brings in a 5% resident share**.

---

## 12. Secondary and mentioned characters

Everything the section states. Where the section gives no species or role, that is recorded as "not given in this section".

### Ambrose (Wren's father)

| Field | Value |
|---|---|
| Species | Beaver (shares Wren's rig) |
| Look | Wren's rig with a grizzled palette, bottle-bottom lenses and a cane |
| Role | Elder of the builders' co-op; author of the design book Wren used to copy from; splits the tally stick |
| Act 1 | At the co-op yard, while Wren counts loan 1, he gnaws the notches and splits the tally stick with one THWAP of his tail. His notch-gnaw and THWAP animations play on his own sprite after Wren's `the_count` F5 |
| Act 2 | Can't read blueprints any more, so Wren starts signing them herself |
| Finale | Nearly blind, walks the Lamp Room with one hand on the wall and says it's better than his |
| Relationships | Father of Wren; the standard she measures herself against |

### Dimity

| Field | Value |
|---|---|
| Species / role | Not given in this section |
| Beat | When loan 1 is paid and the Newcomer's porchlight comes on, **Dimity moves into the lamp** |
| Cross-reference | Appears elsewhere in the source at lines 73, 95, 113, 229, 299, 564, 630, 701, 721, 767, 819, 855, 861, 974, 1040, 1078, 1083, 1109, 1160–1161, 1183, 1195, 1197, 1203, 1235, 1438, 1621 |

### Wick

| Field | Value |
|---|---|
| Species / role | Not given in this section |
| Beats | Starts calling the Newcomer "Keeper" after loan 1. In Act 3, the Newcomer and Wick carry the flame of Isolde's lantern up the lighthouse stair |
| Cross-reference | Source lines 35, 268, 721, 771, 819, 829, 861, 975, 1040, 1086, 1109, 1158, 1160–1161, 1201–1202, 1438 |

### Tamsin

| Field | Value |
|---|---|
| Species | Badger |
| Beats | Beats Tuck in a practice race (Mudlark Mile beat 3; he sulks for exactly one day). Receives the **nameboard from the Brack family's oyster boat** from Juniper when the relevant porch lights (so Tamsin is connected to the Brack family) |
| Cross-reference | Source lines 67, 268, 447, 491, 709, 780, 820, 823, 831, 837, 863, 1177, 1191 |

### Bramble

| Field | Value |
|---|---|
| Species | Marmot |
| Beats | Garden-fence feud with Tuck; the player can broker it or quietly take a side; both remember which you chose |
| Flag | Name shares with an existing AC villager; rename before any reveal `[NEED SOURCE: naming check]` |
| Cross-reference | Source lines 83, 479, 491, 665, 718, 722, 728, 731, 734, 772, 835, 837, 839, 1177, 1200, 1240 |

### Isolde (the former keeper)

| Field | Value |
|---|---|
| Role | The lighthouse keeper of thirty years ago; author of the letter backlog (letters signed "—I."); owner of the **keeper's lantern** that is the last heirloom in Juniper's back room and whose flame relights the lamp |
| Beats | First letter, addressed To the Keeper: "The light is fine. It's the river that's wrong. —I." Hesper reads Isolde's letters up the lighthouse stair by the dead lamp. Barnaby's last string connects the weir records, Isolde's letters and the lamp ("Oh. Oh, that poor keeper."). Juniper hands over Isolde's keeper's lantern at dusk on Relighting day |
| Post-credits | A letter postmarked last week from the Outer Isles reads "I saw the light. —I. Petrel." The section does not state outright that "I. Petrel" is Isolde; the shared initial and the sign-off are the only link given |
| Cross-reference | Source lines 268, 403, 447, 469, 535, 709, 728, 778, 785, 802–803, 861, 865, 1040, 1096, 1161, 1201–1202, 1438 |

### The Dorrows

| Field | Value |
|---|---|
| Role | A family whose **kettle** is one of the heirlooms Juniper hands back when their porch lights |

### The Brack family

| Field | Value |
|---|---|
| Role | Family that owned an **oyster boat**; its nameboard is returned by Juniper to Tamsin |

### The Thatch

| Field | Value |
|---|---|
| Role | The crew who **tie off your roof** on early mornings while Wren waves from the ladder (co-op roofers; no further detail in this section) |

### Clem / Clementine

| Field | Value |
|---|---|
| In this section | Named only in Tuck's naming flag as one of "the vision's neighbors" whose name collides with an existing AC villager; to be renamed `[NEED SOURCE: naming check]` |
| Cross-reference | "Clem" at source lines 35, 479, 718, 833, 1177, 1240; "Clementine" at 772, 833, 835, 1177 |

---

## 13. Names in the task list that do NOT appear in this section

These characters are not described anywhere in lines 383–543. Line numbers are where the name occurs elsewhere in the source file, for whichever doc covers those sections.

| Name | Source lines where the name occurs |
|---|---|
| Ludo | 71, 81, 249, 281, 563, 624, 734, 777, 829, 846, 1038, 1040, 1052, 1161, 1163–1164, 1174, 1180, 1192, 1196, 1232, 1241, 1438 |
| Augusta | 63, 93, 109, 278, 581, 677, 757, 770, 780, 863, 1040, 1055, 1110, 1161, 1176, 1181, 1200, 1438 |
| Ansel | 268, 602, 636, 709, 756, 776, 784–786, 821, 829, 854, 863, 887, 919, 921, 982, 1040, 1086, 1152, 1157, 1161, 1181, 1202, 1438 |
| Ferdinand | 732, 780, 829, 1158, 1177, 1192 |

---

## 14. Relationship map

| From | To | Relationship (as stated) |
|---|---|---|
| Newcomer | Wren | Tenant/debtor; she holds the interest-free hearth loan; fills in the lease card together; can tell her the loan-3 room is their favourite (she remembers) |
| Newcomer | Juniper | Customer; sells her goods (she haggles theatrically, always lets you win); receives heirlooms, finally Isolde's lantern |
| Newcomer | Barnaby | Brings relics and letters for batch identification and the string wall |
| Newcomer | Tuck | Nicknamed by him in week 1 (accept/decline/counter); times his laps; paces him on Mudlark Day; receives his sweatband |
| Newcomer | Odile | Poses for her paintings; receives the painting of their own porch |
| Newcomer | Hesper | Receives one old letter each morning at 6 am; carried in her mail sack in week 1; she asks them once whether she should stop |
| Newcomer | Wick | Wick calls them "Keeper" after loan 1; they carry the lantern flame up the stair together |
| Newcomer | Dimity | Dimity moves into the lamp when the porchlight first comes on |
| Newcomer | Bramble / Tuck | Can broker their garden-fence feud or take a side; both remember |
| Wren | Ambrose | Daughter; copied his design book until loan 3; he can no longer read blueprints; he approves her Lamp Room in the finale |
| Wren | The Thatch | Works alongside them on the roof builds |
| Tuck | Odile | Close friends despite being opposites (present/loud/square/body-first vs. ahead-in-time/quiet/tall/eye-first); she painted him mid-lap and he cried |
| Tuck | Tamsin | Loses a practice race to her; sulks one day |
| Tuck | Bramble | Garden-fence feud |
| Odile | Barnaby | He hosts her Twelve Lights gallery in the Archive in autumn |
| Juniper | Tamsin | Returns the Brack oyster-boat nameboard to her |
| Juniper | The Dorrows | Returns their kettle |
| Juniper | Isolde | Keeps Isolde's keeper's lantern as the last heirloom in the back room |
| Hesper | Isolde | Reads Isolde's letters by the dead lamp; delivers them thirty years late; her arc runs shame → fear |
| Barnaby | Isolde | Pins the last string between the weir records, Isolde's letters and the lamp |
| Juniper | Hesper | Hesper's letters name the heirlooms' owners, which tells Juniper when to return each one |
| The town | Hesper | Throws her a "Late Delivery" party on the green once the truth is out |

---

## 15. Economy: what each character sells, buys, gives and takes

| Character | Takes / buys from player | Sells / gives to player | Pricing or rule |
|---|---|---|---|
| Wren | Loan payments in buttons (counted 1,000 per abacus click) | Bedsit key; 7 interest-free loans (loan 1 = 12,000 buttons); cottage tiers; 4 room commissions; Lamp Room; Ledger Board pace estimate | "Pay it when you can"; builds overnight |
| Juniper | Anything the player sells (oranges, shiny things, fish/produce implied by the daily loop) | Shop goods; heirlooms returned free when porches relight; Isolde's lantern | Haggle theatre, player always wins; never closed; cart at full price during expansion spill-over |
| Barnaby | Relics, finds, letters (for pinning) | Provenance cards (tide, place, finder); string-wall state; gallery hosting | Batch identification |
| Tuck | Grey mullet (Commons request); your time as lap-timer and pacer | First nickname; sweatband wearable (win or lose) | Thread advances only with player involvement |
| Odile | Your time standing still at an exact spot and minute | Painting of your own porch (cottage wall item) | Triggered by each porch relight |
| Hesper | Mail sack carried in from the causeway (week 1) | One old letter per morning | Exactly one, never two, whatever you offer |
| Resident share | — | 5% toward the current loan per completed life thread (Tuck, Odile, Juniper threads named; stated as general rule) | — |

Currency: **buttons**. Sprite: 2×2 brass `#D9A441`.

---

## 16. Routines and hours (as given in this section)

| Character | Time of day / schedule facts |
|---|---|
| Newcomer | Arrives on the causeway at dusk (Act 1). Daily loop: shake, fish, dig, sell, pay. Receives mail at 6 am |
| Wren | Day 1: waits at causeway end at dusk. Co-op builds overnight ("while you sleep"). Early mornings: visible waving from the ladder during roof work. Payment ceremonies at the co-op yard |
| Juniper | Shop open from day 1; no closed days; expansions overnight; cart outside at full price if work spills over. Finale handover at dusk on Relighting day |
| Barnaby | At the Archive; batch identification; midsummer spring-tide Old Quay beat; autumn gallery |
| Tuck | Trains on the flats at low tide; porch talk at night (beat 4); Mudlark Day race |
| Odile | Golden hour painting sessions; on the green at night; autumn gallery; twelfth canvas on Relighting night |
| Hesper | Works nights; mailbox delivery at 6 am every morning; shimmer trail sometimes leads up the lighthouse stair in the mornings |
| Ambrose | At the co-op yard for the loan-1 tally; finale walk-through of the Lamp Room |

Exact opening/closing hours for the shop, Archive, co-op and post office are **not given in this section**.

---

## 17. Naming and competitive-check flags (all `[NEED SOURCE]`)

| Item | Flag |
|---|---|
| River otter player species | AC has otter special characters; needs competitive species check |
| Wren (beaver) | AC has a beaver special character (fishing-tourney host) in a different role; species-for-role mapping stays distinct but must be checked |
| "Pell" (Juniper) | One letter off a WW post-office character's name; naming check before any reveal |
| "Tuck" | Close to an existing AC villager name; rename before reveal |
| "Clem" | Shares a name with an existing AC villager; rename before reveal |
| "Bramble" | Shares a name with an existing AC villager; rename before reveal |

---

## 18. Gaps: things this section does not specify

Engineers should source these from other sections or decide them, rather than assume:

- Species and roles for **Dimity** and **Wick** (only their beats are given here).
- Any description of **Ludo, Augusta, Ansel, Ferdinand, Clem/Clementine** beyond name flags (see Section 13 for line pointers).
- Exact shop inventory and prices; exact buy prices for sold goods.
- Exact open/close hours for Juniper's shop, the Archive, the co-op yard and the post office.
- Loan amounts for loans 2–7 (only loan 1 = 12,000 buttons is stated).
- The full list of First Week Errands (only the mail sack is named).
- The content of letters beyond the first ("The light is fine. It's the river that's wrong. —I.") and the post-credits one ("I saw the light. —I. Petrel.").
- The six non-default player species' palettes and silhouette keys (only the red panda preset is drawn).
- In-engine 8-frame player walk and left/right facings for every character (only down-facing pitch-sheet cycles are specified, with notes on in-engine differences for the player, Juniper, Barnaby, Odile and Hesper).
- Sound effects beyond the ones named: abacus "click", claw "tik", bell "ding", Ambrose's THWAP, ferry horn.
