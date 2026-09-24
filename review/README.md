# Review harnesses

Two local, self-contained pages over the artifact in
[`../3d-mazeball/`](../3d-mazeball/). Both read the source modules directly and
**never write to them**; feedback lives in this browser's `localStorage` and
leaves only through the export button.

| | |
| --- | --- |
| `severed.html` | **The Severed Floor** — the game. Play the daily shift, jump to any room, see the publish gate for this shift and the next fortnight. |
| `maze.html` | The same harness with the theme off — bare tracks in a void, for looking at physics and generator behaviour without the dressing. |
| `index.html` | **The 64 pieces** — every piece in 3-D, its spec, its build notes, and the decisions taken while building it. |

## Run it

```bash
python3 review/serve.py
```

from the repository root, then open **http://localhost:8129/review/severed.html**.
The untheme harness is at `/review/maze.html` and the piece catalogue at
`/review/`.

It has to be served over HTTP rather than opened as a `file://` URL — the pages
load the artifact as ES modules, and module imports are blocked on `file://`.
`serve.py` is a plain static server with `Cache-Control: no-store`; without that,
editing a module and reloading gives you a half-old module graph and a
mystifying "does not provide an export named X" against source that plainly
exports it.

## What is on the page

- **Overall verdict** — approve / revise / needs discussion, and a free-text
  overall comments box.
- **Decisions (8)** — the places where the two source documents disagreed, the
  spec could not be built as written, or playing it proved a number wrong. Each
  changed the artifact, so each takes a comment and an approve toggle of its own.
- **The 64 pieces**, in source order, grouped by their eight documented
  categories. Every card shows a live 3-D render, its sockets, its grip and
  restitution (with the documented value alongside where they differ), its
  behaviours, and the build notes for that piece.
- **Automated checks** — the same suite `node ../3d-mazeball/test.mjs` runs, re-run
  in the browser against the modules the page is rendering.

Click any render to open the inspector: drag to orbit, scroll to zoom, ← / →
to step through the set, Esc to close. The toggles overlay the **collision mesh**
(what the solver actually sees, which is not always what you see), a **0.35 m ball**
parked at the piece's entry socket for scale, and a 1 m grid.

Every item takes an approve toggle and any number of comments at **must fix**,
**should improve** or **question**. ⌘/Ctrl + Enter submits a comment.

## Export

**Export feedback** downloads two files and copies the Markdown to the clipboard
if the browser allows it:

- `ratball-review_<version>_<timestamp>.md` — readable: verdict, overall
  comments, then everything grouped by severity, then every comment by item.
- `ratball-review_<version>_<timestamp>.json` — structured, `schema:
  "ratball-review/1"`.

Both carry the artifact name and version, the reviewer, the export timestamp in
both ISO and local form, the overall verdict and comments, and every comment with
its exact item reference (`#04`, `D02`) and source path
(`3d-mazeball/src/pieces.js · 04_straight_boost.jpg`). The JSON also lists which
items were left untouched, so a partial review is obvious as a partial review.

Clipboard copy needs a real click for user activation, and falls back silently to
the two downloads if the browser refuses.

## The Severed Floor (`severed.html`)

A man in a suit, rolling through an office floor, looking for the elevator.
Same physics, same generator, same publish gate — the fiction and the paint are
a layer on top, and `3d-mazeball/src/theme.js` is the whole of it.

**How the reskin works.** The 64 pieces were authored with literal hex in each
builder, which is the right way to write them and the wrong way to repaint them.
`theme.js` installs a single colour remap at the one choke point every triangle
passes through, and re-tints the entire kit *by hue band* — oak and brown become
carpet, gold becomes signage blue, low-saturation steels stay grey. Doing it by
band rather than by a 95-entry lookup means the relationships between colours
survive: a piece that was two shades of oak is still two shades of carpet, and a
piece added tomorrow is themed for free. Switching the theme off gives back the
original artwork exactly.

**Hallways** are the same bumper-wall mechanism as before, dressed: 2.1 m walls
grown from each piece's own recorded centre-line, with a dark skirting board, a
light-blue accent line at chest height and a ceiling panel every 4.5 m. They are
real collision geometry — this is what keeps him in the corridor — and they open
out where spurs meet a junction so a crossroads stays a crossroads.

**Two pieces are swapped for props** rather than re-tinted, because no amount of
paint turns a spinning party ring into an elevator: `#58` becomes the elevator
(recessed steel doors, call plate, lit indicator) and `#57` becomes the arrival
desk. Both are built in piece-local space and carry their own route, so the
corridor stitches onto them like any other tile.

**Enclosed corridors, camera down inside them.** These are one decision, not
two. The camera sits 1.8 m behind the marble at 11°, about 0.9 m up — head
height on a 0.62 m doll — and the corridors have a suspended tile ceiling on the
real 0.6 m commercial grid module, with recessed light panels every 3.6 m. Using
the real module matters: it is the only object in the corridor with a fixed,
familiar size, so it is what the eye reads speed and distance against.

The ceiling never collides. The marble cannot reach 2.35 m, and putting it in
the collision set would make the camera's boom think it was buried in geometry
on every frame.

The trade is that you can no longer see over the walls to read the route ahead.
**Floor plan** lifts back out to the old raised view and hides the ceiling
automatically; **Ceiling** toggles it in place. The aspect list asks whether
losing the overview is tension or frustration — that is the open question.

**He tumbles.** The doll rolls with the ball rather than staying upright — that
is what "rolling through the hallways" means, and he is built squat, about 0.62 m
shoe to hair, because a correctly-proportioned man rolling end over end reads as
a ragdoll bug while a doll rolling end over end reads as a doll. **Upright** in
the toolbar holds him on his feet so the two can be compared, and the aspect list
asks which you would ship.

## The bare harness (`maze.html`)

- **Drive it.** Click the view, then WASD or arrows tilt the stage, Q/E or drag
  turn the camera, R respawns, Space pauses. Tilting rotates the gravity vector
  — you are never pushing the ball.
- **Follow cam** (on by default) swings the camera round behind the rat and
  keeps it over its shoulder. It is deliberately lazy: it only commits to a
  heading once the ball has held it for 0.3 s above 2 m/s, because handoff §6
  warns that a camera which tracks raw velocity whips on every ricochet. Q/E or
  a drag suspends it for 1.6 s so you can look around, then it re-centres. Turn
  it off for a free camera.
- **Training wheels** (off by default) fences every corridor with bumper walls
  so the ball cannot roll off the sides. The rails follow each piece's own
  recorded centre-line at its own deck width, and open out where spurs meet a
  junction so a crossroads stays a crossroads. It fences the *sides* only —
  a hole in the middle of a piece (the broken bridge, the acid pit, the dashed
  track) is the puzzle and is left alone. Toggling rebuilds the world, so it is
  real collision geometry rather than a rendering trick; your position and clock
  are kept. Every note you write records whether it was on.
- **World tilt** is the first toggle on purpose. Handoff §1.1 says to make the
  visual-tilt decision switchable from day one and put it in front of a human,
  because in a corridor a tipping horizon can read as nausea rather than
  feedback. It is at 35% strength; the aspect list asks which you would ship.
- **Jump to** any tile on the solution. Handoff §13 singles this out as the
  feature that saved the most time last go round.
- **Checks** runs the publish gate for the loaded seed. **Seed sweep** runs it
  over a run of consecutive days and colours each: green clean, amber open but
  the reference bot needed help somewhere, red failed the gate. Click a day to
  load it.
- Notes are filed against fixed **aspects** so sessions line up, and every note
  records the seed you were on when you wrote it.

## Recording a gameplay video

```bash
node 3d-mazeball/record.mjs > review/_run.json    # pick a shift, drive it, save the replay
```

`record.mjs` searches forward from today for a shift the reference bot drives
*clean* — reaching the elevator without needing a hand on any segment — and
writes a 30 Hz replay of position, velocity and angular velocity. It is a replay
rather than a render, so the capture step feeds it back through the game's own
world, camera and doll: the footage is the real thing, not a diagram of it.

Then open `review/_capture.html`, run a frame sink on port 8231 that writes each
POST to `frames/`, and call `startCapture()` in the console. Encode with:

```bash
ffmpeg -framerate 38 -i frames/f%05d.jpg -c:v libx264 -crf 24 -pix_fmt yuv420p out.mp4
```

Capture uses a flatter camera than the game (≈33° rather than 45°). At the
playing angle a long corridor reads as near-top-down, which is fine to play
under and dull to watch.

## Notes

- Feedback is keyed to the kit version, so bumping `KIT_VERSION` starts a clean
  review rather than silently attaching old comments to new geometry.
- Thumbnails render through one shared offscreen WebGL context and paint lazily
  on scroll; 64 simultaneous contexts would exhaust the browser's limit.
- `window.contactSheet()` in the console composites all 64 renders into one image
  — useful for eyeing the whole set at once.
