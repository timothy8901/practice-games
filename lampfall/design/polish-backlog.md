# Polish backlog (items deferred from verification passes)

Status as of 2026-10-28, checked against the code after fix wave 3a and the final fix pass. **Done** means the change is in the code; **Open** means it is not.

## Audio
- Theme bass layer is the largest RMS contributor (~0.15 solo vs 0.06-0.13 melodies); full mixes peak 0.74-0.81 so the master limiter works constantly. Try trimming theme bass gain 0.6 -> 0.5 and listen for pumping in the walking-bass hours. (music director, proto/music) — **Done** (wave 3a): theme bass 0.5, battle bass 0.55, plus 3 dB fixed music headroom; day-part peaks now 0.57-0.74 with no limiting. Still open: battle peaks stay near 0.79 on single kick hits, and in-game music is about 4 dB quieter, which needs a listen.
- Density arc: dusk melody has the least rest (6%); the busiest melody is late morning, not midday. Consider thinning dusk. — **Done** (wave 3a): dusk rest 18%; midday is now the busiest tune.
- Adopt the engine's prefix stems (setStem('perc')) and the 'kit' preset to simplify applyStems/defaultStems. — **Done** (wave 3a).

## Creature art (from the art director)
- Back views are mirrored fronts with faces filled; true backs for Mudfist, Tossup, Siltback. — **Done** (wave 3a).
- Chillnub and Puddlepip silhouettes are simple ovals; add a curl seam / plate overhang. — **Done** (wave 3a).
- Idle frame 2 is a derived 1px squash; hand-drawn breathing would be better. — **Open**, except the four forms redrawn in wave 3a (Coilcrest, Hulkwight, Emberjaw, Duskwisp), which have drawn idle2 frames.
- Mechanical 1px highlight rims on Rushling, Squallcoil, Rimeplate. — **Open**.
- Stillox horns read slightly ear-like at 1x. — **Open**.

## Tiles / world render (art director, verdict usable)
- Deep/shallow water shelf stair-steps on the tile grid; no directional swell toward shore. — **Done** (water.js shelf and swell).
- Night LUT is a fairly bright moonlit blue to pass 3:1 contrast; porch lamps pop less than in a darker night (bible conflict: readability wins). — **Open** by choice: readability wins.
- No per-season LUT sets and no ~10-minute dithered LUT crossfade; grading is a per-colour formula remap. — **Open**.
- Broadleaf sway is a whole-crown 1px shift (only the pine bends). — **Done** (flora.js bends the crown).
- No wet-boards lamplight streaks; boat small; houses have one massing (no gables/porches/dormers) so streets repeat. — **Done**: wet-board streaks (lightPass), a 32×16 rowboat, porch hoods and dormers, and in wave 3a a distinct roof shape for each of the eight roof colours, with body-end tiles. Still open: two houses with the same roof colour share a shape, and the Pellwick map does not use the door-porch tile.
- Glowing mud uses identical 2x2 blobs; vary shapes. — **Done** (ground.js varied blobs).
- Fog 'one palette step down' approximated by alpha bands. — **Open**.
- Skyband clouds stay cream in rain; add overcast cloud sprites. — **Done** (sky.js overcast clouds).

## Characters (art director, verdict usable)
- Single 16x24 cell for everyone; the cast doc wants size-as-character (Ansel tallest, Wick small, Barnaby/Hesper wide). — **Done**: Ansel and Odile tall, Wick small, Tully/Bryony/Augusta wide; Hesper and Barnaby got 24-wide cells in wave 3a.
- Portraits have one neutral expression; bible wants 4 (6 for main cast). Linnet's portrait shadow fur goes purple (no dark brown ramp). — **Done** for four expressions on the main cast (Maud and Tully added in wave 3a) and Linnet's brown ramp; the dialogue picks an expression from a line's `emote` / `expr`. Still open: six expressions for the main cast, and very few lines ask for an expression.
- Lease-card palette options, markings and eye shapes not implemented on the rig. — **Done** (chars/player.js; the lease card edits all three).
- Sit frames stiff; Ansel's sit crude. Fish wind-up arm does not rise with the rod. — **Partly done**: the fishing wind-up arm is fixed; sit frames and Ansel's sit are still open. Hesper's 24-wide fishing pose may clip the rod at the left edge (not checked in the fishing scene).
- Ludo front flight muddy at 1x. — **Open**.

## Creature art, second pass (art director verdict: usable)
- Coilcrest reads as a blob of fins at 1x; give it a clear coiled body line. — **Done** (wave 3a redraw).
- Hulkwight's shell hides the face; open the visor so the eyes read. — **Done** (wave 3a redraw).
- Emberjaw needs a brighter ember accent and a heavier jaw. — **Done** (wave 3a redraw).
- Duskwisp is a dark oval with eyes; add a trailing wisp tail and a lighter rim. — **Done** (wave 3a redraw).
