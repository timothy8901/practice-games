export const meta = {
  name: 'underbyte-persona-playtests',
  description: 'Seven player-persona playtesters record gameplay and report bugs + feature ideas; triage reproduces and merges into REPORT.md',
  phases: [
    { title: 'Playtest', detail: 'seven personas, each records 2–4 clips' },
    { title: 'Triage', detail: 'reproduce every bug, dedupe, rank features, write REPORT.md' },
  ],
}

const ROOT = '/home/user/practice-games/underbyte'
const PT = ROOT + '/playtests'

const BASE = `You are a PLAYTESTER for UNDERBYTE, an original 2D action-exploration game that runs in the browser (repo /home/user/practice-games, folder ${ROOT}). You play it through a recorded play server and then write a review. Your final text is a machine-read return value.

HOW TO PLAY: read ${PT}/README.md first — it explains the play server (tools/play.cjs). Each clip is one session directory under ${PT}/sessions/ named <your-id>-NN (NN = 01, 02, ...). Start a clip, play it turn by turn, and quit it with {"quit":true,"out":"<your-id>-NN-<short-slug>.mp4"} so the video lands in ${PT}/recordings/. To continue your own progress in the next clip pass --save <previous clip dir>/save.json (saves only exist after resting at a save node, so rest at nodes like a player would). After EVERY turn, use the Read tool on the returned "shot" PNG and react to what you SEE, like a person looking at the screen — the state JSON is there to confirm, not to replace looking. Use {"mark":"..."} the moment something notable happens (bug, confusion, delight) so your report can cite the video timestamp. Keep turns short enough to react (typically 0.3–3 s of play per turn) and long enough that the video reads as real play.

PLAY HONESTLY: use real inputs. Debug calls (UB.debug.*) are allowed ONLY to skip to content a real player would need hours to reach (e.g. warp to a later zone, grant the abilities a player would have by then) or to confirm a bug's repro after you hit it. Every debug call is logged in session.json; list each one in your report and why. Do not read the game's source code or design docs to find secrets before you play; you may read ${ROOT}/DESIGN-SUMMARY.md after your FIRST clip to check whether something you experienced was intended.

BUDGET: 2–4 clips, roughly 100–200 turns in total, and at least 3 minutes of recorded live play overall (the "video" field shows it). Stop when your checklist is covered.

DON'T EDIT the game: you may write only inside ${PT}/sessions/, ${PT}/recordings/ and your report file. Do not git commit or push. When you are finished, delete the shots/ and raw/ subfolders of your session dirs (keep session.json and save.json).

REPORT: write ${PT}/reports/<your-id>.md in your persona's own voice, first person, with these sections: Who I am (2 lines) · What I played (each clip: file name, live length, what happened) · Bugs (each: severity blocker/major/minor, title, exact steps, expected vs actual, video file + timestamp m:ss) · Confusing or frustrating moments · What I loved · Feature requests (each: title, the pitch in 2–3 sentences, why a player like me wants it, rough effort S/M/L) · Ratings 1–10 for fun, controls, clarity, difficulty fairness · One-paragraph verdict. Feature ideas must be ORIGINAL to this game — never propose adding characters, names, music or content from any existing game or franchise.

Return the schema fields; recordings must list the mp4 files you actually produced.`

const SCHEMA = { type: 'object', properties: {
  persona: { type: 'string' },
  report_path: { type: 'string' },
  recordings: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, live_seconds: { type: 'number' }, summary: { type: 'string' } }, required: ['file', 'live_seconds', 'summary'] } },
  bugs: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, area: { type: 'string' }, title: { type: 'string' },
    steps: { type: 'string' }, expected: { type: 'string' }, actual: { type: 'string' }, video: { type: 'string' }, timestamp: { type: 'string' } },
    required: ['severity', 'area', 'title', 'steps', 'expected', 'actual', 'video', 'timestamp'] } },
  features: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, pitch: { type: 'string' }, why: { type: 'string' }, effort: { type: 'string', enum: ['S', 'M', 'L'] } }, required: ['title', 'pitch', 'why', 'effort'] } },
  ratings: { type: 'object', properties: { fun: { type: 'number' }, controls: { type: 'number' }, clarity: { type: 'number' }, fairness: { type: 'number' } }, required: ['fun', 'controls', 'clarity', 'fairness'] },
  debug_calls: { type: 'array', items: { type: 'string' } },
  verdict: { type: 'string' } },
  required: ['persona', 'report_path', 'recordings', 'bugs', 'features', 'ratings', 'debug_calls', 'verdict'] }

const PERSONAS = [
  { id: 'newcomer', who: `You are Rin, 24, who mostly plays cozy and puzzle games and has never finished an action platformer. You read every prompt, you get lost easily, you die a lot, and you only learn controls from what the game shows you. KEYBOARD ONLY, NO debug calls at all. Checklist: is the title/select screen understandable; can you learn every control from the game itself; does the first zone teach you safely; how does death and respawn feel; do you ever not know where to go; can you find and rest at a save node; try Overclock once you notice the meter; how far do you get toward the first boss (and the boss itself, if you reach it) in honest play. Record your genuine first impressions.` },
  { id: 'masher', who: `You are Dex, 11, impatient. You mash buttons, spam specials and Overclock, open the pause menu and map at the worst moments (mid-jump, mid-transition between rooms, during the boss intro card, during the ability banner, on the game-over screen), hold opposite directions at once, press everything during menus, and quit to title in the middle of things. KEYBOARD, and one clip with --pad mashing the virtual gamepad. You may warp once to a boss arena to mash during a boss fight. Your job is to break the game: soft-locks, stuck inputs, menus that won't close, characters stuck in walls, console errors, a frozen screen, the HUD drawing over menus, audio or state not resetting after quit-to-title.` },
  { id: 'speedrunner', who: `You are Vee, a speedrunner and glitch hunter. You learn the movement tech fast: dash-jump distances, pogo chains off enemies and spikes, coyote-time and buffered inputs, wall-jump climbs, damage boosts through hazards, skipping enemies, cancelling recovery with jumps or dashes. You try to sequence-break each ability gate (reach Loomworks without Echo Jump, cross the Burst Line gaps without dash, climb Nullspire without Grip Protocol) with every fighter whose stats might allow it, and to clip out of bounds at room edges, corners, crumble platforms and moving platforms. Use warps + ability grants to practice a gate in isolation (log them). Report every exploit with exact inputs, and say whether it should be fixed or kept as intended tech. Time your fastest route through Driftcache.` },
  { id: 'explorer', who: `You are Mo, a completionist explorer who loves maps, secrets and backtracking. Explore Driftcache fully in honest play, then use warps and grants (log them) to sample each later zone the way a player with the right abilities would. Checklist: does the map screen match what you have explored; are save nodes well spaced; is the vendor findable and are its prices fair for the bits you collect; can you find the three hidden max-heart cores (try before reading DESIGN-SUMMARY, then check); are secrets signposted; can you get stuck anywhere (pits, one-way drops, crumble platforms that strand you); do zone backgrounds and lore cards make each area feel distinct; does backtracking with new abilities feel rewarding.` },
  { id: 'fighter', who: `You are Jules, a fighting-game player. You care about how attacks feel. Play ALL FIVE fighters (Tessik, Brackmaw, Vellix, Orrubel, Korvask), at least a few minutes each across 2–4 clips (warp to busy rooms and boss arenas as needed; log it). Checklist: the light chain, heavy, special, air attack and down-strike of each; cancels and combos you can find; how hits feel (hitstop, knockback, sound you can't hear — note it); Overclock and each ultimate; which fighter is strongest or weakest and why; anything that feels unresponsive, floaty or unfair; whether each fighter's moves are readable on screen. Fight at least one boss with two different fighters.` },
  { id: 'challenger', who: `You are Kai, a hardcore challenge player who plays for boss fights. Fight all four bosses honestly with godmode OFF, starting each with the hearts and abilities a player would realistically have at that point (warp to the arena + grant earlier abilities; log it). Retry each boss until you win or have lost three times. Checklist: are attack tells readable and fair; is there any unavoidable damage; do phases and enrage feel distinct; is the difficulty curve right from boss 1 to the final boss; how long does each fight take; does the victory sequence and the ending land. Record each boss fight as its own clip.` },
  { id: 'access', who: `You are Ana, who plays with a gamepad and cares about comfort and accessibility. Play with --pad only (no keyboard) for at least two clips, including menus. Checklist: can you do everything with the pad (title, select, settings, pause, map, shop, game over, victory); open Settings and try every option (volumes, screen shake, anything else) and report what is missing (remapping, reduced flashing, text size, colour-blind safe hazards, hold-vs-toggle); is text readable at 960×540 and in a smaller window (start one clip with --size 844x390 and one with --size 1280x720); are hazards distinguishable from scenery without relying on colour; are flashes or shakes uncomfortable; how does the game behave when the window is a different shape.` },
]

phase('Playtest')
const reports = await parallel(PERSONAS.map(p => () =>
  agent(`${BASE}\n\nYOUR ID: ${p.id}\nYOUR PERSONA: ${p.who}`, { label: `play:${p.id}`, phase: 'Playtest', schema: SCHEMA })))
const ok = reports.filter(Boolean)
log(`playtests done: ${ok.length}/${PERSONAS.length}; ${ok.reduce((n, r) => n + r.recordings.length, 0)} recordings, ${ok.reduce((n, r) => n + r.bugs.length, 0)} bugs, ${ok.reduce((n, r) => n + r.features.length, 0)} feature ideas`)

phase('Triage')
const TRIAGE_SCHEMA = { type: 'object', properties: {
  report_path: { type: 'string' },
  bugs: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, status: { type: 'string', enum: ['confirmed', 'already_fixed', 'not_reproduced', 'by_design'] },
    title: { type: 'string' }, repro: { type: 'string' }, evidence: { type: 'string' }, reporters: { type: 'array', items: { type: 'string' } }, likely_file: { type: 'string' } },
    required: ['id', 'severity', 'status', 'title', 'repro', 'evidence', 'reporters', 'likely_file'] } },
  features: { type: 'array', items: { type: 'object', properties: {
    id: { type: 'string' }, title: { type: 'string' }, pitch: { type: 'string' }, requested_by: { type: 'array', items: { type: 'string' } },
    value: { type: 'string', enum: ['high', 'medium', 'low'] }, effort: { type: 'string', enum: ['S', 'M', 'L'] }, risk: { type: 'string', enum: ['low', 'medium', 'high'] }, recommend_now: { type: 'boolean' } },
    required: ['id', 'title', 'pitch', 'requested_by', 'value', 'effort', 'risk', 'recommend_now'] } },
  summary: { type: 'string' } },
  required: ['report_path', 'bugs', 'features', 'summary'] }

const triage = await agent(`You are the PLAYTEST LEAD for UNDERBYTE (${ROOT}). Read ${ROOT}/BRIEF.md, ${ROOT}/DESIGN-SUMMARY.md, ${PT}/README.md, and every report in ${PT}/reports/. Your final text is a machine-read return value. Do not edit the game, do not git commit or push. Note: a separate fixer may have been changing js/ during the playtests (closing these known findings: /tmp/claude-0/-home-user-practice-games/ab89bef3-bdd4-5e51-8dea-7555674cc336/scratchpad/wf/round3-findings.json and the failing checks in /tmp/claude-0/-home-user-practice-games/ab89bef3-bdd4-5e51-8dea-7555674cc336/scratchpad/wf/round3-failures.txt), so test against the CURRENT code.

The playtesters' structured results:
${JSON.stringify(ok, null, 1)}

1. BUGS: merge duplicates across testers. Reproduce EVERY merged bug against the current code with a short headless Playwright check (use ${ROOT}/test/harness.cjs and the UB.debug API documented in ${ROOT}/CONTRACT.md; put scratch scripts in ${PT}/sessions/_triage/). Mark each confirmed / already_fixed / not_reproduced / by_design, with the evidence (what your check printed). Give each a stable id (B01, B02...), the reporters, the most likely file, and a precise repro a fixer can run. Severity: blocker = crash, soft-lock or unfinishable; major = a player will clearly notice something wrong; minor = polish.
2. FEATURES: merge the feature requests into a ranked backlog (F01...). For each: value to players (how many personas asked, how much it changes the experience), effort S/M/L, risk to stability, and recommend_now = true only for high-value, low-risk ideas that are original and fit the game (aim for 4–7 recommended). Accessibility basics (remappable controls, reduced flashing, etc.) count as high value.
3. Write ${PT}/REPORT.md for a human reader: a short overview (who played, total recorded minutes, average ratings), a table of recordings (file, tester, length, what it shows), the confirmed bug list with video timestamps, the not-reproduced/by-design items in a short list, the ranked feature backlog with recommendations, and the notable quotes from testers. Then delete ${PT}/sessions/_triage/.
Return {report_path, bugs, features, summary}.`, { label: 'triage', phase: 'Triage', schema: TRIAGE_SCHEMA })
log(`triage: ${triage ? triage.bugs.filter(b => b.status === 'confirmed').length : 0} confirmed bugs, ${triage ? triage.features.filter(f => f.recommend_now).length : 0} recommended features`)
return { personas: ok, triage }