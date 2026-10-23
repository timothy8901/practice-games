# Polish backlog (items deferred from verification passes)

## Audio
- Theme bass layer is the largest RMS contributor (~0.15 solo vs 0.06-0.13 melodies); full mixes peak 0.74-0.81 so the master limiter works constantly. Try trimming theme bass gain 0.6 -> 0.5 and listen for pumping in the walking-bass hours. (music director, proto/music)
- Density arc: dusk melody has the least rest (6%); the busiest melody is late morning, not midday. Consider thinning dusk.
- Adopt the engine's prefix stems (setStem('perc')) and the 'kit' preset to simplify applyStems/defaultStems.

## Creature art (from the art director)
- Back views are mirrored fronts with faces filled; true backs for Mudfist, Tossup, Siltback.
- Chillnub and Puddlepip silhouettes are simple ovals; add a curl seam / plate overhang.
- Idle frame 2 is a derived 1px squash; hand-drawn breathing would be better.
- Mechanical 1px highlight rims on Rushling, Squallcoil, Rimeplate.
- Stillox horns read slightly ear-like at 1x.

## Tiles / world render (art director, verdict usable)
- Deep/shallow water shelf stair-steps on the tile grid; no directional swell toward shore.
- Night LUT is a fairly bright moonlit blue to pass 3:1 contrast; porch lamps pop less than in a darker night (bible conflict: readability wins).
- No per-season LUT sets and no ~10-minute dithered LUT crossfade; grading is a per-colour formula remap.
- Broadleaf sway is a whole-crown 1px shift (only the pine bends).
- No wet-boards lamplight streaks; boat small; houses have one massing (no gables/porches/dormers) so streets repeat.
- Glowing mud uses identical 2x2 blobs; vary shapes.
- Fog 'one palette step down' approximated by alpha bands.
- Skyband clouds stay cream in rain; add overcast cloud sprites.

## Characters (art director, verdict usable)
- Single 16x24 cell for everyone; the cast doc wants size-as-character (Ansel tallest, Wick small, Barnaby/Hesper wide).
- Portraits have one neutral expression; bible wants 4 (6 for main cast). Linnet's portrait shadow fur goes purple (no dark brown ramp).
- Lease-card palette options, markings and eye shapes not implemented on the rig.
- Sit frames stiff; Ansel's sit crude. Fish wind-up arm does not rise with the rod.
- Ludo front flight muddy at 1x.

## Creature art, second pass (art director verdict: usable)
- Coilcrest reads as a blob of fins at 1x; give it a clear coiled body line.
- Hulkwight's shell hides the face; open the visor so the eyes read.
- Emberjaw needs a brighter ember accent and a heavier jaw.
- Duskwisp is a dark oval with eyes; add a trailing wisp tail and a lighter rim.
