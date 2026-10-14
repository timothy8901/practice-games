# UNDERBYTE playtests

Recorded play sessions by playtesters who each play like a different kind of player.

* `recordings/` holds the gameplay videos (`<player>-<NN>-<what>.mp4`). Each video contains
  only live play: the moments the tester spent deciding what to do next are cut out, so it
  plays back at normal game speed. There is no sound (headless browser).
* `reports/` holds one report per tester: what they played, the bugs they hit (with the
  video and timestamp where each happens), and the features they would want.
* `REPORT.md` is the merged, de-duplicated summary of every report.
* `sessions/` holds each clip's turn log (`session.json`: every input, every debug call,
  event timeline, console errors, and marks with their video timestamps). Screenshots and
  raw captures are not kept.

## How a tester plays

`tools/playserver.cjs` keeps one headless Chromium page open for a whole clip. Game logic is
frozen between turns, so a tester can look at a screenshot, think, then act; while the tester
acts, the game runs in real time and is recorded. `tools/play.cjs` sends one command per call:

```bash
P="node underbyte/playtests/tools/play.cjs"
S=underbyte/playtests/sessions/newcomer-01          # one directory per clip

$P start $S                                         # boot the game (title screen), recording starts
$P start $S --pad                                   # ...with a virtual gamepad instead of a keyboard
$P start $S --save underbyte/playtests/sessions/newcomer-01/save.json   # continue from an earlier clip
$P start $S --size 844x390                          # a different window size

# One turn: steps run in order, in real time. Keys auto-release at the end of the turn
# unless "keep":true. Names: left right up down jump light heavy special dash overclock
# pause map confirm back, or any KeyboardEvent.code (KeyZ, Space, ShiftLeft, Escape...).
$P $S '{"act":[{"down":"right"},{"wait":800},{"tap":"jump","ms":220},{"wait":500},{"up":"right"}]}'
$P $S '{"act":[{"tap":"light"},{"wait":150},{"tap":"light"},{"wait":150},{"tap":"light"},{"wait":400}]}'
$P $S '{"act":[{"tap":["down","jump"]},{"wait":600}]}'          # several keys at once

# Gamepad steps (session started with --pad). Buttons: a b x y lb rb lt rt back start ls rs up down left right.
$P $S '{"act":[{"pad":{"axes":[1,0,0,0]},"ms":800},{"pad":{"press":["a"]},"ms":200},{"pad":{"release":["a"]}}]}'

$P $S '{"shot":true}'                               # look again without advancing time
$P $S '{"mark":"BUG: the bat clipped into the wall here"}'   # note a moment; returns its video time
$P $S '{"debug":"UB.debug.warp(\"lw_hoist\",\"L\")"}'          # logged as a debug call in the report
$P $S '{"quit":true,"out":"newcomer-01-first-steps.mp4"}'      # writes the video + save.json + session.json
```

Every turn prints JSON with the game `state` (screen, room, position, hearts, energy,
Overclock meter, bits, abilities, boss), `events` since the last turn (damage, deaths, room
changes, pickups, boss fight state), console `errors`, the `shot` path of a screenshot to look
at, and `video`, the timestamp this moment has in the final recording.
