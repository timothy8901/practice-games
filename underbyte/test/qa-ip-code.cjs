/*
 * UNDERBYTE — test/qa-ip-code.cjs  (QA round 2 — lens: ORIGINALITY & CODE QUALITY)
 *
 * What it proves (one PASS/FAIL line per check, exit 0 only when every check passes):
 *   A. Originality (static): no franchise term from BRIEF rule 1 anywhere in js/, index.html, the design
 *      docs or the tests (regex-definition lines and BRIEF.md itself are the only exemptions); no `*mon`
 *      creature-name suffix outside plain English words; the soft substrings (the first syllables of the
 *      franchise and publisher names the task brief lists) and a franchise-adjacent vocabulary list are
 *      printed as INFO for a human read; every player-facing string table is scanned too.
 *   B. Code quality (static): every js file is 'use strict' + exactly one IIFE on window.UB; no fetch / XHR /
 *      import / require / CDN / external URL / image-audio-font files; no console.log / debugger / eval /
 *      innerHTML; localStorage only in engine.js; wall-clock timers only in audio.js; Math.random only in
 *      presentation files; index.html has <title>, viewport meta, <noscript>, the 960×540 canvas and the 13
 *      contract scripts in order; test/README.md matches run-all.cjs (and this suite's own check count).
 *   C. Runtime over file:// (the harness): the only global is UB (Object.keys + own-property diffs against a
 *      script-free document and a same-document iframe); every resource request is a local file of the game
 *      folder; the canvas letterboxes and scales at four window sizes; world data validates; contact sheets of
 *      all 5 fighters (idle / run / jump / light3 / heavy / Overclock), every enemy type + variant and the 4
 *      bosses (idle, two live attacks each, Kernauth phase 2) are written to test/shots/qa-ip-*.png.
 *   D. Logic probes (read-review follow-ups on engine.js / entities.js / characters.js): music + duck after
 *      death → respawn, the boss reward phase, projectiles after a boss death, the state-leak matrix (every
 *      fighter × {light chain, dash, special, Overclock transform, hurt, cling} × {room change, hazard respawn,
 *      death → respawn}), timers on room re-entry (crumble, movers, seals), the save-write triggers (never
 *      during a transition / hazard / intro / dying / game over), the Corrosant locked exit, the Overclock
 *      activation shove vs bosses (no damage), pause during the hazard fade (menu must stay visible),
 *      collision edge cases of UB.Entity (tunnelling, wall face, ceiling, one-way, drop-through, step-up,
 *      mover carry).
 *   E. A 3-minute (≥ 10 800 logic frames) scripted session over every real room with a rotating fighter, every
 *      fighter's Overclock + ultimate, all four boss fights, overlays, hazards, death/respawn and real exit
 *      transitions, with a NaN scan of every entity every 10 frames and zero console warnings/errors; plus
 *      4 s of the real rAF loop with keyboard events.
 *   F. The game served over http (python3 -m http.server on a free port): boots, validates, plays.
 *   G. `--run-all`: also runs test/run-all.cjs and compares its check counts with test/README.md.
 *
 * Run:  node underbyte/test/qa-ip-code.cjs [--run-all]
 */
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn, spawnSync } = require('child_process');
const { launch, INDEX } = require('./harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
const RUN_ALL = process.argv.indexOf('--run-all') >= 0;

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, info) {
  if (ok) pass++; else { fail++; failures.push(name); }
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info).slice(0, 700) : ''));
}
function info(name, detail) { console.log('INFO ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 700) : '')); }

// ------------------------------------------------------------------------------------------------
// A. Originality — static scan
// ------------------------------------------------------------------------------------------------
function listFiles(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (name === 'shots' || name === 'node_modules' || name.startsWith('.')) continue; listFiles(p, out); }
    else if (/\.(js|html|md|cjs|json|css|txt)$/i.test(name)) out.push(p);
  }
  return out;
}
// Build the forbidden terms from fragments so this file never contains them literally.
const J = (a) => a.join('');
const BANNED = [
  [J(['digi', 'mon']), 'franchise name'], [J(['digi', 'volv']), 'franchise term'], [J(['digi', 'vice']), 'franchise term'],
  [J(['digi', 'tal', '\\s+', 'world']), 'franchise term'], [J(['digi', 'destined']), 'franchise term'],
  [J(['hollow', '\\s*', 'kn', 'ight']), 'franchise name'], [J(['hallow', 'nest']), 'franchise location'],
  ['\\b' + J(['kn', 'ight']) + 's?\\b', 'banned word'], ['\\b' + J(['na', 'il']) + 's?\\b', 'banned word'],
  ['\\b' + J(['g', 'eo']) + '\\b', 'banned word'], ['\\b' + J(['so', 'ul']) + 's?\\b', 'banned word'],
  [J(['pok', '[eé]', 'mon']), 'franchise name'], [J(['nint', 'endo']), 'company'], [J(['ban', 'dai']), 'company'],
  [J(['pika', 'chu']), 'franchise character'], [J(['agu', 'mon']), 'franchise character'], [J(['grey', 'mon']), 'franchise character'],
  [J(['gabu', 'mon']), 'franchise character'], [J(['chari', 'zard']), 'franchise character'], [J(['bulba', 'saur']), 'franchise character'],
  ['\\b' + J(['sam', 'us']) + '\\b', 'franchise character'], ['\\b' + J(['met', 'roid']) + '\\b', 'franchise name'],
  [J(['castle', 'vania']), 'franchise name'], ['\\b' + J(['hor', 'net']) + '\\b', 'franchise character'], [J(['dirt', 'mouth']), 'franchise location'],
  ['\\b' + J(['pale', '\\s+', 'king']) + '\\b', 'franchise character'], ['\\b' + J(['dream', '\\s*', 'na', 'il']) + '\\b', 'franchise term'],
  ['\\b' + J(['void', '\\s+', 'heart']) + '\\b', 'franchise term'], ['\\b' + J(['radi', 'ance']) + '\\b', 'franchise character'],
  ['\\b' + J(['silk', 'song']) + '\\b', 'franchise name'], ['\\b' + J(['tam', 'er']) + 's?\\b', 'franchise term'],
  ['\\b' + J(['mega', 'man']) + '\\b', 'franchise name'], ['\\b' + J(['zel', 'da']) + '\\b', 'franchise name'],
  ['\\b' + J(['kir', 'by']) + '\\b', 'franchise name'], ['\\b' + J(['mar', 'io']) + '\\b', 'franchise name'],
].map(([s, why]) => ({ re: new RegExp(s, 'i'), why }));
const MON_OK = ['summon', 'common', 'uncommon', 'salmon', 'lemon', 'demon', 'sermon', 'cinnamon', 'persimmon', 'gammon',
  'backgammon', 'simon', 'solomon', 'mormon', 'mammon', 'ammon', 'damon', 'ramon', 'hammon', 'lemmon', 'summons'];
const SOFT = [J(['di', 'gi']), J(['hol', 'low']), J(['hal', 'low']), J(['che', 'rry']), J(['pok', 'e']), J(['nin', 'ten']), J(['ban', 'da'])];
// franchise-adjacent vocabulary: plain English uses are fine; printed so a human can judge the context
const ADJACENT = ['vessel', 'void', 'dream', 'mask', 'grub', 'charm', 'bench', 'infection', 'wyrm', 'evolv', 'crest', 'champion', 'rookie', 'trainer', 'badge', 'starter', 'legendary', 'mascot', 'shade'];

function staticOriginality() {
  const files = listFiles(ROOT, []).filter(f => path.basename(f) !== 'BRIEF.md');   // BRIEF.md states the rule itself
  const hits = [], monHits = [], soft = {}, adj = {};
  for (const f of files) {
    const rel = path.relative(ROOT, f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // a test's own regex definition (e.g. /\b(…|…)\b/i) necessarily spells the words: exempt those lines
      const isRegexDef = /\/\\b\(/.test(line) || /new RegExp\(/.test(line) || /J\(\[/.test(line) || /^const ADJACENT/.test(line);
      if (!isRegexDef) {
        for (const b of BANNED) if (b.re.test(line)) hits.push(rel + ':' + (i + 1) + ' [' + b.why + '] ' + line.trim().slice(0, 120));
        const mons = line.match(/\b[a-z]{2,}mon\b/gi) || [];
        for (const m of mons) if (MON_OK.indexOf(m.toLowerCase()) < 0) monHits.push(rel + ':' + (i + 1) + ' ' + m);
        if (/\.(js|html)$/.test(rel)) for (const w of ADJACENT) {
          const re = new RegExp('\\b' + w + '\\w*\\b', 'ig'); let m;
          while ((m = re.exec(line))) { if (!/^\s*(\/\/|\*)/.test(line)) (adj[w] = adj[w] || []).push(rel + ':' + (i + 1) + ' …' + line.slice(Math.max(0, m.index - 24), m.index + w.length + 24).trim() + '…'); }
        }
      }
      for (const s of SOFT) {
        const re = new RegExp(s, 'ig'); let m;
        while ((m = re.exec(line))) { const ctx = line.slice(Math.max(0, m.index - 20), m.index + s.length + 20).trim(); (soft[s] = soft[s] || []).push(rel + ':' + (i + 1) + ' …' + ctx + '…'); }
      }
    }
  }
  check('A1 no BRIEF rule-1 franchise term / character / location in js, html, docs, tests (' + files.length + ' files scanned)', hits.length === 0, hits.slice(0, 12));
  check('A2 no *mon creature-name suffix outside plain English words', monHits.length === 0, monHits.slice(0, 12));
  for (const s in soft) info('A3 soft substring "' + s + '" occurrences (plain-English uses are fine; judged by hand)', soft[s].slice(0, 8));
  for (const w in adj) info('A4 franchise-adjacent word "' + w + '" in code/UI text (judged by hand)', adj[w].slice(0, 6));
  // A5 every player-facing string table is covered by the scan above: list the tables found so a reader knows what was read
  const ui = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8'), world = fs.readFileSync(path.join(ROOT, 'js', 'world.js'), 'utf8');
  const ch = fs.readFileSync(path.join(ROOT, 'js', 'characters.js'), 'utf8'), bs = fs.readFileSync(path.join(ROOT, 'js', 'bosses.js'), 'utf8');
  const tables = { uiTXT: /const TXT = \{/.test(ui), uiBanner: /const BANNER_TEXT = \{/.test(ui), zoneLore: (world.match(/defZone\('/g) || []).length, roomIntros: (world.match(/intro: '/g) || []).length,
    fighterBios: (ch.match(/bio: '/g) || []).length, bossSubtitles: (bs.match(/subtitle: '/g) || []).length };
  check('A5 the player-facing text tables exist and were scanned (TXT, banners, 5 zone lore cards, 26 room intros, 5 bios, 5 boss subtitles)',
    tables.uiTXT && tables.uiBanner && tables.zoneLore === 5 && tables.roomIntros >= 26 && tables.fighterBios === 5 && tables.bossSubtitles === 5, tables);
}

// ------------------------------------------------------------------------------------------------
// B. Code quality — static
// ------------------------------------------------------------------------------------------------
const CONTRACT_ORDER = ['util', 'input', 'world', 'entities', 'fx', 'audio', 'render', 'characters', 'enemies', 'bosses', 'ui', 'engine', 'main'];
function staticCode() {
  const jsDir = path.join(ROOT, 'js');
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
  check('B1 js/ holds exactly the 13 contract files', jsFiles.join(',') === CONTRACT_ORDER.slice().sort().map(n => n + '.js').join(','), jsFiles);
  const bad = [], hygiene = [];
  for (const f of jsFiles) {
    const src = fs.readFileSync(path.join(jsDir, f), 'utf8');
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const strictFirst = /^\s*'use strict';/.test(body);
    const openers = (body.match(/^\(function \(UB\) \{/gm) || []).length;
    const closers = (body.match(/^\}\)\(window\.UB\);\s*$/gm) || []).length;
    const endsOk = /\}\)\(window\.UB\);\s*$/.test(body);
    // the only code outside the IIFE: util.js creates the namespace
    const outside = body.split('\n').filter(l => l.trim() && !/^\s*'use strict';/.test(l)).slice(0, 1)[0] || '';
    const headOk = /^\(function \(UB\) \{/.test(outside.trim()) || (f === 'util.js' && /^window\.UB = window\.UB \|\| \{\};/.test(outside.trim()));
    if (!(strictFirst && openers === 1 && closers === 1 && endsOk && headOk)) bad.push(f + ' strict=' + strictFirst + ' open=' + openers + ' close=' + closers + ' ends=' + endsOk + ' head=' + JSON.stringify(outside.slice(0, 40)));
    const net = [];
    const probes = [/\bfetch\s*\(/, /XMLHttpRequest/, /\bimport\s*\(/, /^\s*import\s+/m, /^\s*export\s+/m, /\brequire\s*\(/, /https?:\/\//i, /\bnew\s+Image\b/, /\bnew\s+Audio\b/, /\bnew\s+Worker\b/, /\.(png|jpg|jpeg|gif|svg|mp3|ogg|wav|woff2?|ttf)\b/i, /\bWebSocket\b/, /\bnavigator\.sendBeacon\b/, /\bEventSource\b/, /\bimportScripts\b/];
    for (const p of probes) if (p.test(body)) net.push(f + ' matches ' + p);
    if (net.length) bad.push(net.join('; '));
    if (/\bMath\.random\b/.test(body) && f !== 'audio.js' && f !== 'fx.js') bad.push(f + ' uses Math.random in a logic file');
    if (/\b(Date\.now|performance\.now)\b/.test(body) && f !== 'engine.js' && f !== 'main.js' && f !== 'audio.js') bad.push(f + ' reads the wall clock');
    // hygiene: no debug prints, no dynamic code, no DOM-string injection, timers + storage confined to their owners
    if (/\bconsole\.(log|debug|info|table|trace)\b/.test(body)) hygiene.push(f + ' console.log/debug/info');
    if (/\bdebugger\b/.test(body)) hygiene.push(f + ' debugger');
    if (/\beval\s*\(|\bnew\s+Function\b|\.innerHTML\b|document\.write\b/.test(body)) hygiene.push(f + ' eval/Function/innerHTML/document.write');
    if (/\b(setTimeout|setInterval|requestIdleCallback)\s*\(/.test(body) && f !== 'audio.js') hygiene.push(f + ' uses a wall-clock timer (only audio.js may, for its lookahead scheduler)');
    if (/\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/.test(body) && f !== 'engine.js') hygiene.push(f + ' touches web storage (the engine owns save/settings, CONTRACT §10)');
    if (/\bwindow\.[A-Za-z_$]+\s*=(?!=)/.test(body) && !(f === 'util.js' && /^window\.UB = window\.UB \|\| \{\};/m.test(body))) hygiene.push(f + ' assigns a window property');
    if (/^\s*(var|let|const|function|class)\s/m.test(body.replace(/^\(function \(UB\) \{[\s\S]*\}\)\(window\.UB\);\s*$/m, ''))) hygiene.push(f + ' declares something outside the IIFE');
  }
  check('B2 every js file: \'use strict\' + exactly one (function (UB) { … })(window.UB); wrapper, no net/import/require/asset probes', bad.length === 0, bad);
  check('B3 hygiene: no console.log/debugger/eval/innerHTML; timers only in audio.js; storage only in engine.js; no window.* assignment but window.UB; nothing declared outside the IIFE', hygiene.length === 0, hygiene);
  // engine.js may read the clock only for save metadata and the test-only bench
  const eng = fs.readFileSync(path.join(jsDir, 'engine.js'), 'utf8');
  const clockLines = eng.split('\n').map((l, i) => ({ l, i: i + 1 })).filter(o => /\b(Date\.now|performance\.now)\b/.test(o.l) && !/^\s*\*|^\s*\/\//.test(o.l));
  check('B4 engine.js wall-clock reads are only savedAt metadata + UB.debug.bench', clockLines.every(o => /savedAt|bench|t0 = performance|t1 = performance|t2 = performance/.test(o.l)), clockLines.map(o => o.i + ': ' + o.l.trim().slice(0, 80)));

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  check('B5 index.html has <!DOCTYPE html>, lang, charset', /<!DOCTYPE html>/i.test(html) && /<html lang="en">/.test(html) && /<meta charset="utf-8"/i.test(html));
  check('B6 index.html has a <title>', /<title>\s*UNDERBYTE\s*<\/title>/.test(html));
  check('B7 index.html has a viewport meta', /<meta name="viewport" content="width=device-width, initial-scale=1/.test(html));
  check('B8 index.html has a <noscript> message', /<noscript>[^<]*JavaScript[^<]*<\/noscript>/.test(html));
  check('B9 index.html has the 960×540 #game canvas (focusable, labelled)', /<canvas id="game" width="960" height="540"[^>]*tabindex="0"[^>]*aria-label=/.test(html));
  const scripts = (html.match(/<script src="([^"]+)"><\/script>/g) || []).map(s => s.replace(/<script src="|"><\/script>/g, ''));
  check('B10 index.html loads js/*.js with plain <script> tags in the contract order, nothing else', scripts.join(',') === CONTRACT_ORDER.map(n => 'js/' + n + '.js').join(','), scripts);
  check('B11 index.html has no module scripts, no external links, no inline fetch, no inline event handlers', !/type="module"/.test(html) && !/<link/.test(html) && !/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '')) && !/fetch\(/.test(html) && !/\son[a-z]+="/i.test(html));
  const nonText = listFiles(ROOT, []).length;
  const allFiles = []; (function walk(d) { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) { if (n !== 'shots') walk(p); } else allFiles.push(p); } })(ROOT);
  const assets = allFiles.filter(f => /\.(png|jpg|jpeg|gif|svg|mp3|ogg|wav|woff2?|ttf|otf|bin|wasm)$/i.test(f));
  check('B12 no image/audio/font/binary asset files outside test/shots (' + nonText + ' text files)', assets.length === 0, assets.map(f => path.relative(ROOT, f)));
  check('B13 no package.json / node_modules / build config in the game folder (no deps, no build step)', !fs.existsSync(path.join(ROOT, 'package.json')) && !fs.existsSync(path.join(ROOT, 'node_modules')) && !allFiles.some(f => /(webpack|vite|rollup|tsconfig|babel)\.config|\.ts$/.test(f)));

  // README vs run-all
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const runAll = fs.readFileSync(path.join(__dirname, 'run-all.cjs'), 'utf8');
  const suites = JSON.parse((runAll.match(/const SUITES = (\[[^\]]*\])/) || [0, '[]'])[1].replace(/'/g, '"'));
  const tableRows = (readme.match(/^\| `([a-z-]+\.cjs)` \|/gm) || []).map(r => r.replace(/^\| `|\.cjs` \|$/g, ''));
  check('B14 test/README.md suite table == run-all.cjs SUITES (' + suites.join(' ') + ')', suites.join(',') === tableRows.join(','), { suites, tableRows });
  check('B15 every suite the README lists exists and uses the harness', tableRows.every(n => fs.existsSync(path.join(__dirname, n + '.cjs')) && /require\('\.\/harness\.cjs'\)/.test(fs.readFileSync(path.join(__dirname, n + '.cjs'), 'utf8'))));
  const extra = fs.readdirSync(__dirname).filter(f => f.endsWith('.cjs') && f !== 'harness.cjs' && f !== 'run-all.cjs' && suites.indexOf(f.replace('.cjs', '')) < 0);
  check('B16 no suite present in test/ is missing from run-all.cjs / the README', extra.length === 0, extra);
  check('B17 harness exports { launch, INDEX } and README describes its return shape', typeof launch === 'function' && typeof INDEX === 'string' && /\{ browser, page, errors, logs, tap, hold, shot, close \}/.test(readme));
  check('B18 README documents pauseLogic/step/pressed/state/warp/bench and file:// headless Chromium', /pauseLogic\(true\)/.test(readme) && /step\(n\)/.test(readme) && /pressed\(action, frames\)/.test(readme) && /bench\(n\)/.test(readme) && /file:\/\//.test(readme));
}
/** README's check count for this suite must equal the number of checks it actually runs (evaluated last). */
function readmeCountCheck() {
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const row = readme.split('\n').find(l => /^\| `qa-ip-code\.cjs` \|/.test(l)) || '';
  const want = parseInt((row.match(/\| ([0-9]+)[^|]*\|\s*$/) || [])[1], 10);
  const total = pass + fail + 1;   // + this check
  check('B19 test/README.md check count for qa-ip-code.cjs (' + want + ') equals the checks this suite runs (' + total + ')', want === total, { readme: want, actual: total });
}

// ------------------------------------------------------------------------------------------------
// In-page helpers (installed once per page)
// ------------------------------------------------------------------------------------------------
const HELPERS = function () {
  const q = {};
  q.settle = function (max) { for (let i = 0; i < (max || 240); i++) { const s = UB.debug.state(); if (s.screen === 'play' && !s.busy && s.mode === 'normal') return i; UB.debug.step(1); } return -1; };
  q.nanScan = function () {
    const g = UB.game, bad = [];
    const chk = function (label, v) { if (typeof v === 'number' && !isFinite(v)) bad.push(label + '=' + v); };
    const ent = function (label, e) { chk(label + '.x', e.x); chk(label + '.y', e.y); chk(label + '.vx', e.vx); chk(label + '.vy', e.vy); chk(label + '.px', e.px); chk(label + '.py', e.py); chk(label + '.hp', e.hp); };
    const pl = g.player;
    if (pl) { ent('player', pl); chk('player.energy', pl.energy); chk('player.meter', pl.meter); chk('player.facing', pl.facing); chk('player.squashX', pl.squashX); }
    for (let i = 0; i < g.enemies.length; i++) ent('enemy[' + i + ':' + g.enemies[i].type + ']', g.enemies[i]);
    if (g.boss) ent('boss:' + g.boss.id, g.boss);
    for (let i = 0; i < g.projectiles.length; i++) ent('proj[' + i + ':' + (g.projectiles[i].kind || g.projectiles[i].hit && g.projectiles[i].hit.tag) + ']', g.projectiles[i]);
    for (let i = 0; i < g.pickups.length; i++) ent('pickup[' + i + ':' + g.pickups[i].type + ']', g.pickups[i]);
    chk('cam.x', g.cam.x); chk('cam.y', g.cam.y); chk('cam.px', g.cam.px); chk('cam.py', g.cam.py); chk('cam.look', g.cam.look);
    if (g.level) for (let i = 0; i < g.level.platforms.length; i++) { const p = g.level.platforms[i]; chk('mover.x', p.x); chk('mover.y', p.y); chk('mover.dx', p.dx); }
    chk('FX.shakeX', UB.FX.shakeX); chk('FX.shakeY', UB.FX.shakeY);
    return bad.length ? bad.join(', ') : null;
  };
  /** Run `frames` logic frames with seeded random inputs; NaN scan every 10 frames. */
  q.drive = function (frames, seed, opts) {
    opts = opts || {};
    const rng = UB.Util.rng(seed | 0), d = UB.debug;
    let nan = null, nanAt = -1, out = { frames: 0, rooms: {}, hp: 1e9, deaths: 0, transitions: 0 };
    let dir = 0;
    for (let f = 0; f < frames; f++) {
      if (f % 20 === 0) { const r = rng(); dir = r < 0.4 ? 1 : (r < 0.8 ? -1 : 0); }
      if (dir === 1) d.pressed('right', 1); else if (dir === -1) d.pressed('left', 1);
      if (f % 7 === 0 && rng() < 0.35) d.pressed('jump', 8);
      if (f % 11 === 0 && rng() < 0.45) d.pressed('light', 2);
      if (f % 23 === 0 && rng() < 0.25) d.pressed('heavy', 2);
      if (f % 29 === 0 && rng() < 0.25) d.pressed('special', 2);
      if (f % 17 === 0 && rng() < 0.3) d.pressed('dash', 2);
      if (f % 13 === 0 && rng() < 0.2) d.pressed('down', 6);
      if (f % 61 === 0 && rng() < 0.5) d.pressed('overclock', 2);
      if (opts.extra) opts.extra(f, rng);
      d.step(1);
      out.frames++;
      const s = d.state();
      if (s.roomId) out.rooms[s.roomId] = (out.rooms[s.roomId] || 0) + 1;
      if (s.transition) out.transitions++;
      if (s.hp < out.hp) out.hp = s.hp;
      if (f % 10 === 0) { const n = q.nanScan(); if (n && !nan) { nan = n; nanAt = f; } }
      if (opts.stop && opts.stop(s, f)) break;
    }
    out.nan = nan; out.nanAt = nanAt; out.state = d.state();
    return out;
  };
  /** Player state snapshot for the leak matrix. */
  q.plState = function () {
    const g = UB.game, pl = g.player, s = UB.debug.state();
    return { move: pl.move ? pl.moveName : null, dashing: pl.dashing, dashT: pl.dashT, chain: pl.chain, chainTimer: pl.chainTimer, spPhase: pl.sp.phase, held: !!pl.sp.held,
      contactImmune: pl.contactImmune, pogoActive: pl.pogoActive, hurtTimer: pl.hurtTimer, guard: pl.guard, armor: pl.armor, landLag: pl.landLag, lockout: pl.lockout, dashCd: pl.dashCd,
      beamT: pl.beamT, ringOut: pl.sp.ringOut, clinging: pl.clinging, wallLock: pl.wallLock, locked: pl.locked, ocActive: pl.ocActive, ocTransform: pl.ocTransform, overclock: pl.overclock,
      ocRevert: pl.ocRevert, hp: pl.hp, maxHp: pl.maxHp, energy: pl.energy, meter: pl.meter, iframes: pl.iframes, dead: pl.dead, deathTimer: pl.deathTimer, state: pl.state,
      projectiles: g.projectiles.length, mode: s.mode, room: s.roomId, nan: q.nanScan(), dropThrough: pl.dropThrough, squashT: pl.squashT };
  };
  /** Put the player into a live gameplay state in debug_room (feet at (240,450), ground row 15; the spikes are tiles 10–11 = px 300–360). Returns a descriptor. */
  q.setupState = function (kind) {
    const d = UB.debug, g = UB.game, pl = g.player;
    d.killEnemies(); g.projectiles.length = 0; d.setEnergy(100); d.setMeter(0); d.grant('burstLine'); d.grant('gripProtocol'); d.grant('echoJump');
    d.teleport(240, 450); d.step(6); pl.iframes = 0;
    if (kind === 'chain') { d.pressed('light', 2); d.step(1); const s = pl.move ? pl.move.s : 4; d.step(s + 1); return { ok: pl.move !== null && pl.chain === 1, st: q.plState() }; }
    if (kind === 'dash') { d.pressed('dash', 2); d.step(2); return { ok: pl.dashing, st: q.plState() }; }
    if (kind === 'special') { d.pressed('special', 2); d.step(3); return { ok: pl.move !== null && pl.moveName === 'special', st: q.plState() }; }
    if (kind === 'ocTransform') { d.setMeter(100); d.pressed('overclock', 2); d.step(3); return { ok: pl.ocTransform > 0, st: q.plState() }; }
    if (kind === 'ultimate') { d.setMeter(100); d.pressed('overclock', 2); d.step(40); d.setEnergy(100); d.pressed('special', 2); d.step(3); return { ok: pl.ocActive && pl.move !== null && pl.moveName === 'ultimate', st: q.plState() }; }
    if (kind === 'hurt') { d.spawnEnemy('scuttlebit', 7, 14, { patrol: [6, 9] }); const e = g.enemies[0]; e.x = pl.x; e.px = e.x; d.step(2); return { ok: pl.hurtTimer > 0, st: q.plState() }; }
    if (kind === 'cling') { d.teleport(24 * 30 - pl.w / 2 - 2, 400); /* beside the 3-tile block at tiles 24–26 rows 12–14, below its top */ d.step(1); let n = 0; while (n++ < 60 && !pl.clinging) { d.pressed('right', 1); d.step(1); } return { ok: pl.clinging, st: q.plState() }; }
    if (kind === 'down') { d.teleport(240, 300); d.step(2); d.pressed('down', 6); d.pressed('light', 2); d.step(4); return { ok: pl.moveName === 'down', st: q.plState() }; }
    return { ok: false, st: q.plState() };
  };
  // --- contact sheets: draw regions of the world canvas at 2× dpr into a sheet canvas ---
  q.sheet = null;
  q.sheetBegin = function (cols, cellW, cellH, rows) {
    const c = document.createElement('canvas'); c.width = cols * cellW; c.height = rows * cellH;
    const g = c.getContext('2d'); g.fillStyle = '#202020'; g.fillRect(0, 0, c.width, c.height);
    q.sheet = { c: c, g: g, cols: cols, cellW: cellW, cellH: cellH, n: 0 };
  };
  q.cell = function (label, wx, wy, w, h) {
    const g = UB.game; if (!g.level || !q.sheet) return false;
    const rw = g.level.w * 30, rh = g.level.h * 30;
    g.cam.x = g.cam.px = rw <= 960 ? (rw - 960) / 2 : Math.max(0, Math.min(rw - 960, wx - 480));
    g.cam.y = g.cam.py = rh <= 540 ? (rh - 540) / 2 : Math.max(0, Math.min(rh - 540, wy - 270));
    g.setDpr(2); g.render(1);
    const dpr = g.dpr, camX = Math.round(g.cam.x + UB.FX.shakeX), camY = Math.round(g.cam.y + UB.FX.shakeY);
    const sx = (wx - w / 2 - camX) * dpr, sy = (wy - h / 2 - camY) * dpr;
    const S = q.sheet, i = S.n++, col = i % S.cols, row = Math.floor(i / S.cols);
    const dx = col * S.cellW, dy = row * S.cellH;
    const scale = Math.min((S.cellW - 8) / w, (S.cellH - 26) / h);
    S.g.save(); S.g.imageSmoothingEnabled = true; S.g.imageSmoothingQuality = 'high';
    S.g.fillStyle = '#101014'; S.g.fillRect(dx + 2, dy + 2, S.cellW - 4, S.cellH - 4);
    S.g.drawImage(g.world, sx, sy, w * dpr, h * dpr, dx + 4, dy + 4, w * scale, h * scale);
    S.g.fillStyle = '#F2EBDD'; S.g.font = 'bold 13px monospace'; S.g.textBaseline = 'bottom'; S.g.textAlign = 'center';
    S.g.fillText(label, dx + S.cellW / 2, dy + S.cellH - 4);
    S.g.restore();
    return true;
  };
  q.sheetEnd = function () { const u = q.sheet ? q.sheet.c.toDataURL('image/png') : null; q.sheet = null; return u; };
  q.audio = function () { const a = UB.Audio.state(); return { song: a.song, duck: a.duck, ambient: a.ambient }; };
  q.stamp = function () { const s = JSON.parse(localStorage.getItem('underbyte.save') || 'null'); return s ? s.savedAt + ':' + s.roomId + ':' + s.deaths : null; };
  q.gameOverAndRespawn = function () {
    let n = 0; while (n++ < 300 && UB.debug.state().screen !== 'gameover') UB.debug.step(1);
    UB.debug.step(30); UB.debug.pressed('confirm', 2); n = 0; while (n++ < 300 && !(UB.debug.state().screen === 'play' && !UB.debug.state().busy)) UB.debug.step(1);
  };
  window.__qa = q;
};

function saveDataUrl(file, url) { fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); }

// ------------------------------------------------------------------------------------------------
// C–E. Runtime over file://
// ------------------------------------------------------------------------------------------------
async function runtime(t) {
  const { page, browser } = t;
  const ev = (fn, ...a) => page.evaluate(fn, ...a);

  // --- C1 globals (before installing helpers): compare against a blank page of the same browser ---
  const blank = await browser.newPage();
  await blank.goto('file://' + path.join(__dirname, 'README.md'));   // a script-free file:// document: same secure-context globals
  await blank.waitForTimeout(150);
  const baseNames = await blank.evaluate(() => Object.getOwnPropertyNames(window));
  const baseKeys = await blank.evaluate(() => Object.keys(window));
  await blank.close();
  // reload with a request listener attached so every resource fetch is seen (file:// loads are absent from resource timing)
  const reqs = [];
  page.on('request', r => reqs.push(r.url()));
  await page.reload(); await page.waitForTimeout(400);
  const gameNames = await ev(() => Object.getOwnPropertyNames(window));
  const gameKeys = await ev(() => Object.keys(window));
  const leaked = gameNames.filter(k => baseNames.indexOf(k) < 0 && !/^\d+$/.test(k));
  const leakedKeys = gameKeys.filter(k => baseKeys.indexOf(k) < 0 && !/^\d+$/.test(k));
  check('C1 Object.keys(window) diff vs a script-free document is exactly ["UB"]', leakedKeys.length === 1 && leakedKeys[0] === 'UB', leakedKeys);
  check('C2 Object.getOwnPropertyNames(window) diff vs a script-free document is exactly ["UB"]', leaked.length === 1 && leaked[0] === 'UB', leaked);
  const iframeLeak = await ev(() => { const f = document.createElement('iframe'); document.body.appendChild(f); const base = new Set(Object.getOwnPropertyNames(f.contentWindow)); const out = Object.getOwnPropertyNames(window).filter(k => !base.has(k) && !/^\d+$/.test(k)); f.remove(); return out; });
  check('C3 no global other than UB (same-document iframe diff)', iframeLeak.length === 1 && iframeLeak[0] === 'UB', iframeLeak);
  const ns = await ev(() => Object.keys(window.UB).sort());
  const wantNs = ['Audio', 'Bosses', 'Characters', 'Enemies', 'Engine', 'Entity', 'FX', 'Fonts', 'IDS', 'Input', 'Main', 'Palette', 'Render', 'UI', 'Util', 'World', 'debug', 'font', 'game'];
  check('C4 UB namespaces are exactly the contract set', ns.join(',') === wantNs.join(','), ns);
  // resources: everything loaded is a local file of the game folder
  const folder = 'file://' + ROOT.replace(/\\/g, '/');
  const scriptsSeen = reqs.filter(u => /\/js\/[a-z]+\.js$/.test(u)).length;
  check('C5 every request of a page load is a file:// of the game folder (' + reqs.length + ' requests: the page + 13 scripts, nothing else)', reqs.length === 14 && reqs.every(u => u.startsWith(folder)) && scriptsSeen === 13, reqs.filter(u => !u.startsWith(folder) || !/\/js\/[a-z]+\.js$|index\.html$/.test(u)));
  const strictRuntime = await ev(() => { try { (function () { 'use strict'; return typeof UB.Engine.Game === 'function' && typeof UB.debug.state === 'function'; })(); return { ok: true, paused: UB.game.logicPaused, screen: UB.debug.state().screen }; } catch (e) { return { ok: false, err: String(e) }; } });
  check('C6 boot reached the title screen with the debug API live', strictRuntime.ok && strictRuntime.screen === 'title', strictRuntime);

  // --- C7 canvas scaling / letterbox at four viewports ---
  async function canvasAt(w, h) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(80);
    return ev(() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top, bw: c.width, bh: c.height, dpr: window.devicePixelRatio, iw: window.innerWidth, ih: window.innerHeight, ox: document.documentElement.scrollWidth, oy: document.documentElement.scrollHeight }; });
  }
  const sizes = [[640, 360], [1920, 1080], [900, 900], [1280, 720], [400, 300]];
  const scaleBad = [];
  for (const [w, h] of sizes) {
    const c = await canvasAt(w, h);
    const s = Math.min(w / 960, h / 540), ew = Math.floor(960 * s), eh = Math.floor(540 * s);
    const okSize = Math.abs(c.w - ew) <= 1 && Math.abs(c.h - eh) <= 1;
    const okCentre = Math.abs(c.left - Math.floor((w - ew) / 2)) <= 1 && Math.abs(c.top - Math.floor((h - eh) / 2)) <= 1;
    const okRatio = Math.abs(c.w / c.h - 960 / 540) < 0.01;
    const bs = Math.max(1, Math.min(2, Math.floor(c.dpr * s * 2) / 2));   // backing scale = dpr × CSS upscale, quantised to 1 / 1.5 / 2 (crisp letterbox)
    const okBacking = c.bw === Math.round(960 * bs) && c.bh === Math.round(540 * bs);
    const noScroll = c.ox <= w && c.oy <= h;
    if (!(okSize && okCentre && okRatio && okBacking && noScroll)) scaleBad.push({ w, h, c, ew, eh });
  }
  check('C7 canvas scales to fit + letterboxes (centred, 16:9, dpr backing, no page scroll) at 640×360 / 1920×1080 / 900×900 / 1280×720 / 400×300', scaleBad.length === 0, scaleBad);
  await page.setViewportSize({ width: 1280, height: 720 });

  await ev(HELPERS);
  await ev(() => { localStorage.removeItem('underbyte.save'); UB.debug.pauseLogic(true); });
  const wErr = await ev(() => UB.debug.worldErrors());
  check('C8 UB.World.validate() returns []', wErr.length === 0, wErr);

  // --- C9 fighter sheet: idle / run / jump / light3 / heavy / Overclock -----------------------------
  const fighters = ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask'];
  await ev(() => { __qa.sheetBegin(5, 260, 300, 6); });
  const fRows = [];
  for (const id of fighters) {
    const r = await ev((id) => {
      UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 480, y: 450 }); UB.debug.step(3); UB.debug.killEnemies(); UB.debug.step(40);
      const pl = UB.game.player;
      return { idle: __qa.cell(pl.name + ' idle', pl.x, pl.cy(), 110, 120), st: UB.debug.state().playerState };
    }, id);
    fRows.push({ id, ...r });
  }
  for (const id of fighters) await ev((id) => {
    UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 150, y: 450 }); UB.debug.step(3); UB.debug.killEnemies();
    UB.debug.pressed('right', 14); UB.debug.step(14); const pl = UB.game.player; __qa.cell(pl.name + ' run', pl.x, pl.cy(), 110, 120);
  }, id);
  for (const id of fighters) await ev((id) => {
    UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 480, y: 450 }); UB.debug.step(3); UB.debug.killEnemies();
    UB.debug.pressed('jump', 10); UB.debug.step(8); const pl = UB.game.player; __qa.cell(pl.name + ' jump', pl.x, pl.cy(), 110, 130);
  }, id);
  for (const id of fighters) await ev((id) => {
    UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 480, y: 450 }); UB.debug.step(3); UB.debug.killEnemies();
    const pl = UB.game.player; const m = pl.data.moves;
    UB.debug.pressed('light', 2); UB.debug.step(m.light1.s + m.light1.a + 1); UB.debug.pressed('light', 2); UB.debug.step(m.light2.s + m.light2.a + 1); UB.debug.pressed('light', 2); UB.debug.step(m.light3.s + 1);
    __qa.cell(pl.name + ' ' + (pl.move ? pl.move.name : 'light'), pl.x + 20 * pl.facing, pl.cy(), 170, 130);
  }, id);
  for (const id of fighters) await ev((id) => {
    UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 480, y: 450 }); UB.debug.step(3); UB.debug.killEnemies();
    const pl = UB.game.player; const m = pl.data.moves.heavy;
    UB.debug.pressed('heavy', 2); UB.debug.step(m.s + 1);
    __qa.cell(pl.name + ' ' + m.name, pl.x + 20 * pl.facing, pl.cy(), 170, 130);
  }, id);
  const ocRows = [];
  for (const id of fighters) {
    const r = await ev((id) => {
      UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 480, y: 450 }); UB.debug.step(3); UB.debug.killEnemies();
      UB.debug.setMeter(100); UB.debug.step(2); UB.debug.pressed('overclock', 2); UB.debug.step(45);
      const pl = UB.game.player; __qa.cell(pl.name + ' OVERCLOCK', pl.x, pl.cy(), 150, 160);
      return { oc: UB.debug.state().overclock };
    }, id);
    ocRows.push({ id, ...r });
  }
  let url = await ev(() => __qa.sheetEnd());
  saveDataUrl(path.join(SHOTS, 'qa-ip-fighters.png'), url);
  check('C9 fighter sheet: 5 × (idle, run, jump, light chain, heavy, Overclock) rendered → shots/qa-ip-fighters.png', fRows.every(r => r.idle && r.st === 'idle') && ocRows.every(r => r.oc), { fRows, ocRows });

  // --- C10 enemies: every type + variant in the debug room ----------------------------------------
  const ENEMIES = [
    ['scuttlebit', null, 'g'], ['scuttlebit', 'brinecrab', 'g'], ['scuttlebit', 'staticshot', 'g'], ['scuttlebit', 'rootbound', 'g'],
    ['hopnode', null, 'g'], ['hopnode', 'dripnode', 'g'], ['hopnode', 'nullnode', 'g'],
    ['driftmoth', null, 'f'], ['brinejelly', null, 'f'], ['glarewisp', null, 'f'], ['glarewisp', 'rootwisp', 'f'],
    ['spitvalve', null, 'g'], ['spitvalve', 'acidvalve', 'g'], ['spitvalve', 'twinvalve', 'g'],
    ['rambyte', null, 'g'], ['rambyte', 'rootram', 'g'], ['platewalker', null, 'g'], ['platewalker', 'rootplate', 'g'],
    ['broodcell', null, 'g'], ['mote', null, 'f'], ['droplatch', null, 'h'], ['voltwheel', null, 'g'], ['walker', null, 'g'],
  ];
  await ev(() => { __qa.sheetBegin(6, 240, 240, 4); UB.debug.newGame('tessik'); __qa.settle(); UB.debug.warp('debug_room', { x: 90, y: 450 }); UB.debug.step(3); });
  const eRows = [];
  for (const [type, variant, kind] of ENEMIES) {
    const r = await ev(({ type, variant, kind }) => {
      UB.debug.killEnemies(); UB.game.projectiles.length = 0;
      UB.debug.teleport(90, 450); UB.debug.step(2);
      const opts = { patrol: [12, 20] }; if (variant) opts.variant = variant;
      const tx = 16, ty = kind === 'g' ? 14 : (kind === 'f' ? 9 : 1);
      const e = UB.debug.spawnEnemy(type, tx, ty, opts);
      if (!e) return { ok: false };
      UB.debug.step(kind === 'h' ? 2 : 12);
      const en = UB.game.enemies[0]; if (!en) return { ok: false, gone: true };
      const label = type + (variant ? ' / ' + variant : '');
      return { ok: __qa.cell(label, en.x, en.cy(), 84, 84), x: en.x, y: en.y, hp: en.hp, w: en.w, h: en.h, name: en.name };
    }, { type, variant, kind });
    eRows.push({ type, variant, ...r });
  }
  url = await ev(() => __qa.sheetEnd());
  saveDataUrl(path.join(SHOTS, 'qa-ip-enemies.png'), url);
  check('C10 enemy sheet: all 13 types + 10 variants spawn and render → shots/qa-ip-enemies.png', eRows.every(r => r.ok), eRows.filter(r => !r.ok));

  // --- C11 bosses: idle in the arena, two different live attacks, + Kernauth phase 2 ----------------
  const BOSSES = [['dc_sentinel', 'tallock'], ['lw_weftyr', 'weftyr'], ['bv_corrosant', 'corrosant'], ['rw_throne', 'kernauth']];
  await ev(() => { __qa.sheetBegin(3, 420, 420, 5); UB.debug.newGame('tessik'); __qa.settle(); });
  const bRows = [];
  for (const [room, id] of BOSSES) {
    const r = await ev(({ room, id }) => {
      UB.debug.warp(room, null); UB.debug.step(2);
      const g = UB.game, b = g.boss; if (!b) return { ok: false, why: 'no boss' };
      UB.debug.god(true);
      UB.debug.teleport(b.x - 80, g.level.room.h * 30 - 30 - 30);
      let n = 0; while (n++ < 400 && UB.debug.state().bossFight === 'none') UB.debug.step(1);
      UB.debug.step(40);
      const W = Math.max(b.w, 150) + 140, H = Math.max(b.h, 150) + 120;
      const idle = __qa.cell(b.name + ' (' + id + ') intro', b.x, b.cy(), W, H);
      n = 0; while (n++ < 400 && UB.debug.state().bossFight !== 'fight') UB.debug.step(1);
      // two distinct attacks: walk the fight until the boss's attack label changes twice
      const seen = [], shots = [];
      n = 0;
      while (n++ < 3000 && seen.length < 2) {
        UB.debug.step(1);
        const a = b.attack;
        if (a && a !== 'roar' && seen.indexOf(a) < 0 && b.state !== 'tell') { seen.push(a); UB.debug.step(4); shots.push(__qa.cell(b.name + ' · ' + a + ' (' + b.state + ')', b.x, b.cy(), W + 80, H + 60)); }
      }
      return { ok: idle && shots.length === 2 && shots.every(Boolean), id: b.id, attacks: seen, bf: UB.debug.state().bossFight, w: b.w, h: b.h };
    }, { room, id });
    bRows.push({ room, ...r });
  }
  const k2 = await ev(() => {
    const g = UB.game;
    UB.debug.warp('rw_throne', null); UB.debug.step(2);
    const b = g.boss; if (!b) return { ok: false };
    UB.debug.god(true); UB.debug.teleport(b.x - 120, g.level.room.h * 30 - 60);
    let n = 0; while (n++ < 400 && UB.debug.state().bossFight !== 'fight') UB.debug.step(1);
    // phase change inside takeHit: one registered player hit when hp is 1
    b.hp = 1;
    const h = UB.Entity.makeHit('player'); h.dmg = 3; h.x = b.x - b.w; h.y = b.y - b.h - 10; h.w = b.w * 2; h.h = b.h + 20; h.kind = 'heavy'; h.hitstop = 0;
    g.hitBoss(b, h);
    const after = UB.debug.boss();
    UB.debug.step(200);
    const ok = __qa.cell('KERNAUTH phase 2 (UNBOUND)', b.x, b.cy(), b.w + 160, b.h + 120);
    n = 0; let atk = null; while (n++ < 1500) { UB.debug.step(1); if (b.attack && b.state !== 'tell' && b.state !== 'transition') { atk = b.attack; break; } }
    UB.debug.step(3);
    const ok2 = __qa.cell('KERNAUTH 2 · ' + atk + ' (' + b.state + ')', b.x, b.cy(), b.w + 200, b.h + 160);
    return { ok: ok && ok2, after, atk, now: UB.debug.boss(), fight: UB.debug.state().bossFight };
  });
  url = await ev(() => __qa.sheetEnd());
  saveDataUrl(path.join(SHOTS, 'qa-ip-bosses.png'), url);
  check('C11 boss sheet: 4 bosses in their arenas (intro + 2 live attacks each) + Kernauth phase 2 (+ an attack) → shots/qa-ip-bosses.png', bRows.every(r => r.ok) && k2.ok && k2.after && k2.after.phase === 2 && k2.fight === 'fight', { bRows, k2 });
  await ev(() => UB.debug.god(false));

  // --- D. logic probes -----------------------------------------------------------------------------
  // D1 death in an ordinary room → game over → respawn: zone song back, duck restored
  const d1 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle();
    const before = __qa.audio();
    UB.debug.setHp(0); let n = 0; while (n++ < 300 && UB.debug.state().screen !== 'gameover') UB.debug.step(1);
    const atGameOver = __qa.audio();
    UB.debug.step(30); UB.debug.pressed('confirm', 2); n = 0; while (n++ < 300 && !(UB.debug.state().screen === 'play' && !UB.debug.state().busy)) UB.debug.step(1);
    UB.debug.step(60);
    return { before, atGameOver, after: __qa.audio(), s: UB.debug.state().screen, room: UB.debug.state().roomId };
  });
  check('D1 after death → respawn at the node the zone song plays again and the music duck is restored to 1', d1.s === 'play' && d1.after.song === 'driftcache' && d1.after.duck === 1, d1);
  // D2 death DURING a boss fight → respawn in the same zone: the boss track must not keep playing; the boss is back at full HP
  const d2 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle();
    UB.debug.warp('dc_shrine', null); UB.debug.step(2); UB.debug.teleport(9 * 30 + 15, 450); UB.debug.step(2); UB.debug.pressed('up', 2); UB.debug.step(2);
    let n = 0; while (n++ < 120 && UB.debug.state().mode !== 'normal') UB.debug.step(1);
    UB.debug.warp('dc_sentinel', null); UB.debug.step(2);
    const b = UB.game.boss; UB.debug.teleport(b.x - 100, 450);
    n = 0; while (n++ < 400 && UB.debug.state().bossFight !== 'fight') UB.debug.step(1);
    b.hp = 40;
    const inFight = __qa.audio();
    UB.debug.setHp(0); __qa.gameOverAndRespawn();
    UB.debug.step(60);
    const s = UB.debug.state(), after = __qa.audio();
    UB.debug.warp('dc_sentinel', null); UB.debug.step(2);
    const back = UB.debug.boss();
    return { inFight, after, room: s.roomId, boss: s.boss, bf: s.bossFight, zone: s.zoneId, back };
  });
  check('D2 dying to a boss → respawn at the zone node: zone song (not "boss"), duck 1, the arena re-arms the boss at full HP', d2.inFight.song === 'boss' && d2.room === 'dc_shrine' && d2.after.song === 'driftcache' && d2.after.duck === 1 && d2.back && d2.back.hp === d2.back.maxHp && (d2.back.fight === 'none' || d2.back.fight === 'intro'), d2);
  // D3 the boss reward phase: a boss shot still in flight after the boss dies — can it hurt the player?
  const d3 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle();
    UB.debug.warp('bv_corrosant', null); UB.debug.step(2);
    const g = UB.game, b = g.boss; UB.debug.god(true);
    UB.debug.teleport(b.x, g.level.room.h * 30 - 90);
    let n = 0; while (n++ < 400 && UB.debug.state().bossFight !== 'fight') UB.debug.step(1);
    n = 0; while (n++ < 1500 && g.projectiles.length === 0) UB.debug.step(1);
    const projBefore = g.projectiles.length;
    UB.debug.god(false);
    b.hp = 1;
    const h = UB.Entity.makeHit('player'); h.dmg = 3; h.x = b.x - b.w; h.y = b.y - b.h - 10; h.w = b.w * 2; h.h = b.h + 20; h.kind = 'light'; h.hitstop = 0;
    g.hitBoss(b, h);
    const bfAfterHit = UB.debug.state().bossFight;
    UB.debug.step(1);
    const projAfter = g.projectiles.filter(p => !p.dead && p.owner !== 'player').length;
    const hp0 = UB.debug.state().hp;
    let hurtAt = -1; n = 0;
    while (n++ < 240) {
      let live = null; for (let i = 0; i < g.projectiles.length; i++) { const p = g.projectiles[i]; if (!p.dead && !p.noHit && p.owner === 'enemy') { live = p; break; } }
      if (live) { g.player.x = live.x; g.player.y = live.y + g.player.h / 2; g.player.px = g.player.x; g.player.py = g.player.y; g.player.iframes = 0; }
      UB.debug.step(1); const s = UB.debug.state(); if (s.hp < hp0 && hurtAt < 0) { hurtAt = n; break; }
    }
    const s = UB.debug.state();
    return { projBefore, bfAfterHit, projAfter, hp0, hurtAt, hp: s.hp, bf: s.bossFight, mode: s.mode, dead: s.dead };
  });
  check('D3 a boss death ends the fight (dying → reward), pops every live boss shot at once and nothing of it hurts the player afterwards', d3.bfAfterHit === 'dying' && d3.projAfter === 0 && d3.hurtAt < 0 && (d3.bf === 'dying' || d3.bf === 'reward'), d3);
  // D4 reward phase + death before the module is collected: the boss stays dead, the module waits
  const d4 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle();
    UB.debug.warp('dc_shrine', null); UB.debug.step(2); UB.debug.teleport(9 * 30 + 15, 450); UB.debug.step(2); UB.debug.pressed('up', 2); UB.debug.step(2);
    let n = 0; while (n++ < 120 && UB.debug.state().mode !== 'normal') UB.debug.step(1);
    UB.debug.warp('dc_sentinel', null); UB.debug.step(2);
    const g = UB.game, b = g.boss; UB.debug.teleport(b.x - 100, 450);
    n = 0; while (n++ < 400 && UB.debug.state().bossFight !== 'fight') UB.debug.step(1);
    b.hp = 1;
    const h = UB.Entity.makeHit('player'); h.dmg = 3; h.x = b.x - b.w; h.y = b.y - b.h - 10; h.w = b.w * 2; h.h = b.h + 20; h.kind = 'light'; h.hitstop = 0;
    g.hitBoss(b, h);
    n = 0; while (n++ < 600 && UB.debug.state().bossFight !== 'reward') UB.debug.step(1);
    const reward = UB.debug.state();
    UB.debug.setHp(0); __qa.gameOverAndRespawn();
    UB.debug.warp('dc_sentinel', null); UB.debug.step(3);
    const s = UB.debug.state();
    const module = UB.debug.pickups().filter(p => p.type === 'ability').length;
    return { rewardState: reward.bossFight, afterDeath: { boss: s.boss, bf: s.bossFight, defeated: s.bossesDefeated, abilities: s.abilities, module, sealed: g.level.openings.filter(o => o.sealed).length } };
  });
  check('D4 a boss that has died stays dead after a death during its reward: no boss on re-entry, exits open, the module waits at its pickup tile', d4.rewardState === 'reward' && d4.afterDeath.boss === null && d4.afterDeath.defeated.indexOf('tallock') >= 0 && d4.afterDeath.module === 1 && d4.afterDeath.sealed === 0, d4);

  // D5 state-leak matrix: every fighter × live state × {room change, hazard respawn, death → respawn}
  const STATES = ['chain', 'dash', 'special', 'ultimate', 'ocTransform', 'hurt', 'cling', 'down'];
  const leak = [], setupFail = [];
  for (const id of fighters) {
    for (const kind of STATES) {
      const r = await ev(({ id, kind }) => {
        const out = { id, kind };
        const clean = function (st, afterDeath) {
          const bad = [];
          if (st.move !== null) bad.push('move=' + st.move);
          if (st.dashing) bad.push('dashing'); if (st.chain !== 0) bad.push('chain=' + st.chain); if (st.chainTimer !== 0) bad.push('chainTimer=' + st.chainTimer);
          if (st.spPhase !== '') bad.push('sp.phase=' + st.spPhase); if (st.held) bad.push('held'); if (st.contactImmune) bad.push('contactImmune'); if (st.pogoActive) bad.push('pogoActive');
          if (st.hurtTimer !== 0) bad.push('hurtTimer=' + st.hurtTimer); if (st.guard !== 0) bad.push('guard=' + st.guard); if (st.armor) bad.push('armor'); if (st.landLag !== 0) bad.push('landLag=' + st.landLag);
          if (st.beamT !== 0) bad.push('beamT'); if (st.ringOut) bad.push('ringOut'); if (st.clinging) bad.push('clinging'); if (st.wallLock !== 0) bad.push('wallLock=' + st.wallLock);
          if (st.locked) bad.push('locked'); if (st.projectiles !== 0) bad.push('projectiles=' + st.projectiles); if (st.nan) bad.push('NaN:' + st.nan); if (st.dropThrough !== 0) bad.push('dropThrough');
          if (st.mode !== 'normal') bad.push('mode=' + st.mode); if (st.dead) bad.push('dead');
          if (afterDeath) {
            if (st.ocActive || st.overclock !== 0 || st.ocTransform !== 0 || st.ocRevert !== 0) bad.push('overclock leak');
            if (st.lockout !== 0) bad.push('lockout=' + st.lockout); if (st.dashCd !== 0) bad.push('dashCd=' + st.dashCd);
            if (st.hp !== st.maxHp) bad.push('hp=' + st.hp + '/' + st.maxHp); if (st.energy < 50 || st.energy > 52.5) bad.push('energy=' + st.energy);   // 50 + ≤ 2.5 of regen during the fade-in if (st.meter !== 0) bad.push('meter=' + st.meter);
            if (st.iframes !== 0) bad.push('iframes=' + st.iframes); if (st.deathTimer !== 0) bad.push('deathTimer');
          }
          return bad;
        };
        // (a) room change (the loadRoom → place path a transition uses), straight out of the live state
        UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 240, y: 450 }); UB.debug.step(3);
        let su = __qa.setupState(kind); out.setupA = su.ok; out.ocBefore = su.st.ocActive || su.st.ocTransform > 0;
        UB.debug.warp('debug_room2', 'L'); UB.debug.step(1);
        let st = __qa.plState(); out.roomChange = clean(st, false); out.ocAfterRoom = st.ocActive || st.ocTransform > 0 || st.ocRevert > 0;
        if (st.room !== 'debug_room2') out.roomChange.push('room=' + st.room);
        // (b) hazard respawn from the live state: the spikes at (10..11, 14) of debug_room
        UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 240, y: 450 }); UB.debug.step(3);
        su = __qa.setupState(kind); out.setupB = su.ok;
        const pl = UB.game.player; pl.x = 10 * 30 + 15; pl.y = 450; pl.px = pl.x; pl.py = pl.y; pl.iframes = 0;
        let n = 0; while (n++ < 30 && !UB.debug.state().hazardFreeze && !UB.debug.state().dead) UB.debug.step(1);
        out.hazardFired = UB.debug.state().hazardFreeze;
        n = 0; while (n++ < 90 && UB.debug.state().hazardFreeze) UB.debug.step(1);
        UB.debug.step(1);
        st = __qa.plState(); out.hazard = clean(st, false);
        if (st.iframes < 40) out.hazard.push('iframes=' + st.iframes);
        // (c) death → game over → respawn from the live state
        UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 240, y: 450 }); UB.debug.step(3);
        su = __qa.setupState(kind); out.setupC = su.ok;
        UB.debug.setHp(0); __qa.gameOverAndRespawn(); UB.debug.step(1);
        st = __qa.plState(); out.death = clean(st, true);
        return out;
      }, { id, kind });
      if (!(r.setupA && r.setupB && r.setupC)) setupFail.push({ id: r.id, kind: r.kind, a: r.setupA, b: r.setupB, c: r.setupC });
      if (r.roomChange.length || r.hazard.length || r.death.length || !r.hazardFired) leak.push({ id: r.id, kind: r.kind, roomChange: r.roomChange, hazard: r.hazard, death: r.death, hazardFired: r.hazardFired });
      if (r.ocBefore && !r.ocAfterRoom) leak.push({ id: r.id, kind: r.kind, note: 'Overclock did not carry across the room change' });
    }
  }
  check('D5a the leak matrix could set up every live state for every fighter (chain, dash, special, ultimate, Overclock transform, hurt, cling, down-strike)', setupFail.length === 0, setupFail);
  check('D5b no move / dash / chain / special-phase / held victim / contact-immune / pogo / hurt / guard / armour / lag / lock / projectile / mode leaks across a room change, a hazard respawn or death → respawn (40 cases); Overclock carries across rooms', leak.length === 0, leak.slice(0, 8));

  // D6 timers reset on room re-entry: crumble tiles back, movers re-phased, seals cleared, hitstop 0, level lists fresh
  const d6 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle();
    UB.debug.warp('debug_room2', 'L'); UB.debug.step(1);
    const g = UB.game;
    const phase0 = g.level.platforms[0].dist; UB.debug.step(29);
    UB.debug.teleport(12 * 30 + 15, 9 * 30 - 10); let n = 0; while (n++ < 300 && !g.level.gone[9 * 32 + 12]) UB.debug.step(1);
    const goneBefore = g.level.gone[9 * 32 + 12], crumbleBefore = g.level.crumble.length;
    UB.FX.hitstop(4);
    UB.debug.warp('debug_room', 'R'); UB.debug.step(1); UB.debug.warp('debug_room2', 'L'); UB.debug.step(1);
    let goneSum = 0; for (let i = 0; i < g.level.gone.length; i++) goneSum += g.level.gone[i];
    let sealSum = 0; for (let i = 0; i < g.level.sealedMask.length; i++) sealSum += g.level.sealedMask[i];
    return { phase0, goneBefore, crumbleBefore, goneSum, crumbleAfter: g.level.crumble.length, sealSum, phaseAfter: g.level.platforms[0].dist, hitstop: UB.FX.hitstopFrames, enemies: g.enemies.length, pickups: g.pickups.length };
  });
  check('D6 room re-entry rebuilds the runtime level: a vanished crumble tile is back, the crumble list is empty, no seal, the mover restarts at its phase offset, hitstop cleared', d6.goneBefore === 1 && d6.crumbleBefore >= 1 && d6.goneSum === 0 && d6.crumbleAfter === 0 && d6.sealSum === 0 && d6.phaseAfter === d6.phase0 && d6.hitstop === 0, d6);

  // D7 save-write triggers: untouched by a transition, a hazard respawn, a boss intro, a death → game over → respawn, 600 f of play; written by node, core, purchase, boss death
  const d7 = await ev(() => {
    localStorage.removeItem('underbyte.save'); UB.game.savedData = null;
    UB.debug.newGame('tessik'); __qa.settle();
    const s0 = __qa.stamp();
    UB.debug.warp('debug_room', { x: 5 * 30 + 15, y: 450 }); UB.debug.step(3); UB.debug.pressed('up', 2); UB.debug.step(2);
    let n = 0; while (n++ < 120 && UB.debug.state().mode !== 'normal') UB.debug.step(1);
    const afterNode = __qa.stamp();
    UB.debug.teleport(900, 450); n = 0; while (n++ < 120 && UB.debug.state().roomId !== 'debug_room2') { UB.debug.pressed('right', 1); UB.debug.step(1); }
    n = 0; while (n++ < 60 && UB.debug.state().transition) UB.debug.step(1);
    const afterTransition = __qa.stamp();
    UB.debug.teleport(16 * 30 + 15, 450); n = 0; while (n++ < 90 && !UB.debug.state().hazardFreeze) UB.debug.step(1);
    n = 0; while (n++ < 90 && UB.debug.state().hazardFreeze) UB.debug.step(1);
    const afterHazard = __qa.stamp();
    const drive = __qa.drive(600, 77);
    const afterDrive = __qa.stamp();
    UB.debug.warp('debug_boss', null); UB.debug.step(2); const b = UB.game.boss; UB.debug.teleport(b.x - 100, 450);
    n = 0; while (n++ < 400 && UB.debug.state().bossFight !== 'fight') UB.debug.step(1);
    const afterIntro = __qa.stamp();
    UB.debug.setHp(0); __qa.gameOverAndRespawn(); UB.debug.step(5);
    const afterDeath = __qa.stamp(); const deathsMem = UB.debug.state().deaths;
    // core pickup writes
    UB.debug.warp('debug_room2', null); UB.debug.step(2); UB.debug.teleport(25 * 30 + 15, 11 * 30); UB.debug.step(20);
    const afterCore = __qa.stamp();
    return { s0, afterNode, afterTransition, afterHazard, afterDrive, afterIntro, afterDeath, deathsMem, afterCore, driveNan: drive.nan, savedRoom: UB.debug.state().savedRoom, cores: UB.debug.state().cores };
  });
  check('D7 the save is written at the node and the core only — untouched by a transition, a hazard respawn, 600 f of play, a boss intro or a death → game over → respawn (deaths stays in memory until the next write)',
    !d7.s0 && !!d7.afterNode && d7.afterNode === d7.afterTransition && d7.afterNode === d7.afterHazard && d7.afterNode === d7.afterDrive && d7.afterNode === d7.afterIntro && d7.afterNode === d7.afterDeath && d7.deathsMem === 1 && d7.afterCore !== d7.afterNode && d7.cores.indexOf('core_debug') >= 0 && d7.savedRoom === 'debug_room', d7);

  // D8 the Corrosant arena's locked exit (B, the brine crust) is solid on entry while the boss lives and open once it is beaten
  const d8 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle();
    UB.debug.warp('bv_corrosant', null);
    const g = UB.game, lv = g.level;
    const op = lv.openings.find(o => o.id === 'B'), opL = lv.openings.find(o => o.id === 'L');
    const sealedOnEntry = op.sealed, lSealedOnEntry = opL.sealed, tileOnEntry = UB.Entity.tileAt(lv, 43, 23);
    UB.debug.step(2); const fightSeal = { b: op.sealed, l: opL.sealed, bf: UB.debug.state().bossFight };
    UB.debug.defeatBoss('corrosant'); UB.debug.step(1);
    const afterDefeat = { b: op.sealed, l: opL.sealed, tile: UB.Entity.tileAt(lv, 43, 23) };
    UB.debug.warp('bv_rest', null); UB.debug.step(1); UB.debug.warp('bv_corrosant', null); UB.debug.step(1);
    const op2 = g.level.openings.find(o => o.id === 'B');
    return { sealedOnEntry, lSealedOnEntry, tileOnEntry, fightSeal, afterDefeat, reentry: { sealed: op2.sealed, boss: !!g.boss, tile: UB.Entity.tileAt(g.level, 43, 23) } };
  });
  check('D8 bv_corrosant.B is sealed on entry while Corrosant lives (L open), both sealed once the fight starts, unsealed by the defeat and open on re-entry', d8.sealedOnEntry && !d8.lSealedOnEntry && d8.tileOnEntry === '#' && d8.fightSeal.b && d8.fightSeal.l && d8.fightSeal.bf === 'intro' && !d8.afterDefeat.b && !d8.afterDefeat.l && d8.afterDefeat.tile === '.' && !d8.reentry.sealed && !d8.reentry.boss && d8.reentry.tile === '.', d8);

  // D9 the Overclock activation shove is "no damage" (DESIGN §3.9): it must not chip a boss (Corrosant ×1.5 and Kernauth's 0.5 body multiplier round 0 up)
  const d9 = {};
  for (const [room, id] of [['dc_sentinel', 'tallock'], ['bv_corrosant', 'corrosant'], ['rw_throne', 'kernauth']]) {
    d9[id] = await ev(({ room }) => {
      UB.debug.newGame('brackmaw'); __qa.settle(); UB.debug.warp(room, null); UB.debug.step(2);
      const g = UB.game, b = g.boss; UB.debug.god(true);
      UB.debug.teleport(b.x - 100, g.level.room.h * 30 - 60);
      let n = 0; while (n++ < 400 && UB.debug.state().bossFight !== 'fight') UB.debug.step(1);
      UB.debug.step(5);
      // stand inside the 60 px shove box of the boss body, below its centre (never the Kernauth core)
      const pl = g.player; pl.x = b.x - b.w / 2 - 10; pl.y = b.y; pl.px = pl.x; pl.py = pl.y;
      const hp0 = b.hp; UB.debug.setMeter(100); UB.debug.pressed('overclock', 2); UB.debug.step(3);
      const r = { hp0, hp1: b.hp, oc: pl.ocTransform > 0 || pl.ocActive, pushed: pl.hitPush.hitList.indexOf(b) >= 0 };
      // the same 0-damage descriptor straight on the boss body (a shove box holding only the head / the mass, no segment first):
      // bossHurtBy rounds a multiplied 0 up to 1 (mult > 1: "dmg < hit.dmg + 1"; mult < 1: "dmg < 1"), so Corrosant and Kernauth-1 lose a point
      const hp2 = b.hp; const direct = Object.assign({}, b.takeHit(pl.hitPush, g)); r.direct = { dmg: direct.dmg, blocked: direct.blocked, hpBefore: hp2, hpAfter: b.hp };
      UB.debug.god(false); return r;
    }, { room });
  }
  check('D9 the Overclock activation shove (dmg 0) deals no damage to a boss, in play and straight on the body (Tallock, Corrosant head, Kernauth phase 1 mass)', Object.keys(d9).every(k => d9[k].oc && d9[k].pushed && d9[k].hp1 === d9[k].hp0 && d9[k].direct.hpAfter === d9[k].direct.hpBefore && !d9[k].direct.blocked), d9);
  // the same shove on an ordinary enemy: pushed, not damaged
  const d9e = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle(); UB.debug.warp('debug_room', { x: 240, y: 450 }); UB.debug.step(3); UB.debug.killEnemies();
    UB.debug.spawnEnemy('platewalker', 9, 14, { patrol: [7, 9] }); UB.debug.spawnEnemy('scuttlebit', 7, 14, { patrol: [6, 9] });
    const g = UB.game, a = g.enemies[0], b = g.enemies[1]; const hp = [a.hp, b.hp];
    UB.debug.god(true); UB.debug.setMeter(100); UB.debug.pressed('overclock', 2); UB.debug.step(4);
    UB.debug.god(false);
    return { hp, after: [a.hp, b.hp], moved: Math.abs(a.vx) > 0 || Math.abs(b.vx) > 0 || a.hitstun > 0 || b.hitstun > 0 };
  });
  check('D9b the Overclock shove on ordinary enemies: no damage', d9e.after[0] === d9e.hp[0] && d9e.after[1] === d9e.hp[1], d9e);

  // D10 pause opened during the hazard fade (frames 30–40 of the freeze): the pause menu must not be hidden under a full black fade
  const d10 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle(); UB.debug.warp('debug_room2', 'L'); UB.debug.step(30);
    const g = UB.game;
    UB.debug.teleport(16 * 30 + 15, 450); let n = 0; while (n++ < 90 && !UB.debug.state().hazardFreeze) UB.debug.step(1);
    n = 0; while (n++ < 60 && g.hazard.timer < 34) UB.debug.step(1);
    const atPause = { timer: g.hazard.timer, fade: g.fadeLevel };
    UB.debug.pressed('pause', 2); UB.debug.step(1);
    const opened = UB.debug.state().screen;
    UB.debug.step(12);
    const paused = { screen: UB.debug.state().screen, fade: g.fadeLevel, mode: g.mode, timer: g.hazard.timer };
    g.render(1);
    // sample the main canvas: is anything but the fade colour visible in the middle (the PAUSED panel)?
    const ctx = g.mctx, dpr = g.dpr; const img = ctx.getImageData(Math.round(480 * dpr - 100 * dpr), Math.round(270 * dpr - 60 * dpr), Math.round(200 * dpr), Math.round(120 * dpr)).data;
    let bright = 0; for (let i = 0; i < img.length; i += 4) if (img[i] + img[i + 1] + img[i + 2] > 180) bright++;
    const visible = bright > 50;
    UB.debug.pressed('back', 2); UB.debug.step(1); n = 0; while (n++ < 60 && UB.debug.state().mode !== 'normal') UB.debug.step(1);
    const resumed = UB.debug.state();
    return { atPause, opened, paused, bright, visible, resumed: { screen: resumed.screen, mode: resumed.mode, fade: g.fadeLevel, x: resumed.x } };
  });
  check('D10 pausing during the hazard fade (freeze frames 30–40) leaves the pause menu visible (the fade must not cover the overlay); play resumes normally after', d10.opened === 'pause' && d10.visible && d10.resumed.screen === 'play' && d10.resumed.mode === 'normal', d10);
  await page.evaluate(() => { UB.debug.newGame('tessik'); __qa.settle(); UB.debug.warp('debug_room2', 'L'); UB.debug.step(30); const g = UB.game; UB.debug.teleport(16 * 30 + 15, 450); let n = 0; while (n++ < 90 && !UB.debug.state().hazardFreeze) UB.debug.step(1); n = 0; while (n++ < 60 && g.hazard.timer < 34) UB.debug.step(1); UB.debug.pressed('pause', 2); UB.debug.step(13); g.setDpr(1); g.render(1); });
  await page.screenshot({ path: path.join(SHOTS, 'qa-ip-pause-in-hazard-fade.png') });
  await ev(() => { UB.debug.pressed('back', 2); UB.debug.step(60); });

  // D11 UB.Entity collision edge cases (entities.js) against the debug_room geometry
  const d11 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle(); UB.debug.warp('debug_room', { x: 240, y: 450 }); UB.debug.step(3); UB.debug.killEnemies();
    const g = UB.game, lv = g.level, E = UB.Entity, out = {};
    const mk = (x, y, w, h) => new E({ x, y, w, h, units: 'pxf' });
    // (a) no tunnelling: a 20×30 body dropped 400 px in one sweep lands on the floor row (y 450), never below
    let e = mk(300, 300, 20, 30); E.sweep(e, lv, 0, 400); out.fall = { y: e.y, onGround: e.onGround, vy: e.vy };
    // (b) a 2000 px sweep into the block at tile 24 stops on its face (24·30 − hw = 710), hitWall +1, vx 0
    e = mk(600, 450, 20, 30); e.vx = 99; E.sweep(e, lv, 2000, 0); out.wall = { x: e.x, hitWall: e.hitWall, vx: e.vx };
    e = mk(900, 450, 20, 30); e.vx = -99; E.sweep(e, lv, -2000, 0); out.wallL = { x: e.x, hitWall: e.hitWall, vx: e.vx };   // the block's right face: 27·30 + hw = 820
    // (c) a 2000 px sweep up stops under the ceiling row 0 (y = 30 + h), hitCeiling, vy 0
    e = mk(300, 450, 20, 30); e.vy = -50; E.sweep(e, lv, 0, -2000); out.ceil = { y: e.y, hitCeiling: e.hitCeiling, vy: e.vy };
    // (d) one-way row 8 (x 10..13): passes from below, lands from above, Down+Jump (dropThrough) falls through
    e = mk(345, 300, 20, 30); E.sweep(e, lv, 0, -120); out.oneWayUp = { y: e.y, hitCeiling: e.hitCeiling };
    e = mk(345, 200, 20, 30); E.sweep(e, lv, 0, 100); out.oneWayLand = { y: e.y, onGround: e.onGround };
    e = mk(345, 240, 20, 30); e.dropThrough = 10; E.sweep(e, lv, 0, 50); out.dropThrough = { y: e.y, onGround: e.onGround };
    e = mk(345, 240, 20, 30); e.ignoreOneWay = true; E.sweep(e, lv, 0, 50); out.flyerThrough = { y: e.y, onGround: e.onGround };
    // (e) a body resting exactly on a tile top with dy 0 reads grounded (support check), one standing 0.5 px above does not
    e = mk(300, 450, 20, 30); E.sweep(e, lv, 0, 0); out.rest = { onGround: e.onGround, groundTy: e.groundTy };
    e = mk(300, 449.5, 20, 30); E.sweep(e, lv, 0, 0); out.hover = { onGround: e.onGround };
    // (f) step-up (6 px) is inert on tile-aligned geometry: the grounded player walking into the block is stopped, never lifted
    const pl = g.player; pl.x = 700; pl.y = 450; pl.px = pl.x; pl.py = pl.y; pl.onGround = true; pl.wasOnGround = true; pl.vx = 0;
    E.sweep(pl, lv, 20, 0); out.stepUp = { x: pl.x, y: pl.y, hitWall: pl.hitWall, face: 24 * 30 - pl.w / 2 };
    // (g) hazard boxes: a floor spike is inset 4 px each side and starts 6 px below the tile top; a body 5 px above the spike tile top is clear
    out.spikeClear = E.hazardInBox(lv, 10 * 30 + 4, 14 * 30 - 30 + 1, 22, 30, false);     // bottom at tile top + 1 → above the 6 px inset
    out.spikeHit = E.hazardInBox(lv, 10 * 30 + 4, 14 * 30 - 20, 22, 30, false);
    out.spikeSideClear = E.hazardInBox(lv, 10 * 30 - 20, 14 * 30 + 10, 22, 10, false);    // x 280..302 vs the spike box 304..326
    out.spikeSkip = E.hazardInBox(lv, 10 * 30 + 4, 14 * 30 - 20, 22, 30, true);
    // (h) mover carry: the player standing on debug_room2's platform moves with it
    UB.debug.warp('debug_room2', 'L'); UB.debug.step(2);
    const p = g.level.platforms[0]; UB.debug.teleport(p.x + p.w / 2, p.y - 12); let n = 0; while (n++ < 60 && !UB.debug.state().grounded) UB.debug.step(1);
    const x0 = g.player.x, px0 = p.x; let carried = 0;
    for (let i = 0; i < 90; i++) { const bx = g.player.x; UB.debug.step(1); carried += Math.abs(g.player.x - bx); }
    out.mover = { grounded: UB.debug.state().grounded, dx: g.player.x - x0, pdx: p.x - px0, carried, onMover: !!g.player.ground };
    // (i) beyond-the-map tiles are solid except in an open exit's extension; sealed exits read '#'
    out.outside = { leftWall: E.tileAt(g.level, -1, 5), exitExt: E.tileAt(g.level, -1, 13), below: E.tileAt(g.level, 5, 40), above: E.tileAt(g.level, 5, -1) };
    g.sealExits(['L'], true); out.sealed = { ext: E.tileAt(g.level, -1, 13), tile: E.tileAt(g.level, 0, 13) }; g.sealExits(['L'], false);
    out.unsealed = { ext: E.tileAt(g.level, -1, 13), tile: E.tileAt(g.level, 0, 13) };
    return out;
  });
  const d11ok = d11.fall.y === 450 && d11.fall.onGround && d11.fall.vy === 0
    && d11.wall.x === 710 && d11.wall.hitWall === 1 && d11.wall.vx === 0 && d11.wallL.x === 820 && d11.wallL.hitWall === -1
    && d11.ceil.y === 60 && d11.ceil.hitCeiling && d11.ceil.vy === 0
    && d11.oneWayUp.y === 180 && !d11.oneWayUp.hitCeiling && d11.oneWayLand.y === 240 && d11.oneWayLand.onGround && d11.dropThrough.y === 290 && !d11.dropThrough.onGround && d11.flyerThrough.y === 290
    && d11.rest.onGround && d11.rest.groundTy === 15 && !d11.hover.onGround
    && d11.stepUp.x === d11.stepUp.face && d11.stepUp.y === 450 && d11.stepUp.hitWall === 1
    && d11.spikeClear === null && d11.spikeHit === 'spike' && d11.spikeSideClear === null && d11.spikeSkip === null
    && d11.mover.grounded && d11.mover.onMover && Math.abs(d11.mover.dx - d11.mover.pdx) < 0.01 && d11.mover.carried > 20
    && d11.outside.leftWall === '#' && d11.outside.exitExt === '.' && d11.outside.below === '#' && d11.outside.above === '#'
    && d11.sealed.ext === '#' && d11.sealed.tile === '#' && d11.unsealed.ext === '.' && d11.unsealed.tile === '.';
  check('D11 UB.Entity collision edges: no tunnelling, exact wall faces both ways, ceiling, one-way up/land/drop-through/flyer, rest support, inert step-up, spike inset boxes, mover carry, out-of-map + sealed-exit tiles', d11ok, d11);

  // D12 hazard i-frames vs enemy contact at the respawn point, and the chute launch hazard respawn (first solid footing replaces it)
  const d12 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle();
    UB.debug.warp('lw_rest', 'B'); UB.debug.step(1);   // the hatch grate in the floor line: the launch rises through the one-way grate and lands back on it
    const g = UB.game, hr = g.hazardRespawn; const launch = { pending: hr.pending, vy: hr.vy, iframes: hr.iframes, pvy: g.player.vy };
    let n = 0; while (n++ < 300 && hr.pending) UB.debug.step(1);
    const landed = { pending: hr.pending, x: hr.x, y: hr.y, vy: hr.vy, grounded: UB.debug.state().grounded, frames: n };
    return { launch, landed, room: UB.debug.state().roomId };
  });
  check('D12 a chute arrival (lw_rest through its bottom hatch B) launches the player and keeps the hazard respawn pending until the first solid footing, which then replaces it with vy 0', d12.launch.pending && d12.launch.vy < 0 && d12.launch.pvy < 0 && !d12.landed.pending && d12.landed.vy === 0 && d12.landed.grounded && d12.room === 'lw_rest', d12);

  // D13 (information) hitstop pending at QUIT → CONTINUE: how many frozen frames start the next session?
  const d13 = await ev(() => {
    UB.debug.newGame('tessik'); __qa.settle(); UB.debug.warp('debug_room', { x: 5 * 30 + 15, y: 450 }); UB.debug.step(3); UB.debug.pressed('up', 2); UB.debug.step(2);
    let n = 0; while (n++ < 120 && UB.debug.state().mode !== 'normal') UB.debug.step(1);
    UB.debug.spawnEnemy('scuttlebit', 7, 14, { patrol: [6, 9] }); UB.debug.step(2);
    UB.debug.pressed('heavy', 2); n = 0; while (n++ < 40 && UB.FX.hitstopFrames === 0) UB.debug.step(1);
    const pending = UB.FX.hitstopFrames;
    UB.debug.pressed('pause', 2); UB.debug.step(1); const paused = UB.debug.state().screen;
    UB.debug.toTitle(); UB.debug.continueGame(); __qa.settle();
    return { pending, paused, atContinue: UB.FX.hitstopFrames, frozenInput: UB.Input.freezeBuffers };
  });
  info('D13 hitstop pending when the player pauses and quits (' + d13.pending + ' f) → CONTINUE starts with hitstop ' + d13.atContinue + ' f (FX.clear() does not reset hitstopFrames; a cosmetic few frames under the fade-in)', d13);

  // --- E. 3-minute scripted session (≥ 10 800 logic frames) ----------------------------------------
  const logStart = t.logs.length;
  const session = { frames: 0, nan: null, segs: [] };
  async function seg(name, fn, arg) {
    const r = await ev(fn, arg);
    session.frames += r.frames || 0;
    if (r.nan && !session.nan) session.nan = name + ': ' + r.nan + ' @' + r.nanAt;
    session.segs.push({ name, frames: r.frames, rooms: Object.keys(r.rooms || {}).length, hp: r.hp, transitions: r.transitions, nan: r.nan });
  }
  // E1 real inputs in the start room + a walk through every real room (150 f each) with a rotating fighter and god off
  await seg('start-room', () => { UB.debug.newGame('korvask'); __qa.settle(); return __qa.drive(600, 23); });
  const rooms = await ev(() => UB.debug.rooms().filter(r => !UB.World.rooms[r.id].debug).map(r => r.id));
  for (let i = 0; i < rooms.length; i++) {
    await seg('room:' + rooms[i], ({ id, fighter }) => {
      let s0 = UB.debug.state(), n = 0;
      if (s0.baseScreen === 'gameover' || s0.dead) { while (n++ < 400 && !(UB.debug.state().screen === 'play' && !UB.debug.state().busy && !UB.debug.state().dead)) { if (UB.debug.state().screen === 'gameover') UB.debug.pressed('confirm', 2); UB.debug.step(1); } }
      if (UB.debug.state().fighter !== fighter) { UB.debug.newGame(fighter); __qa.settle(); }
      UB.debug.grant('echoJump'); UB.debug.grant('burstLine'); UB.debug.grant('gripProtocol');
      UB.debug.warp(id, null); UB.debug.step(2); UB.debug.god(false); UB.debug.setEnergy(100);
      return __qa.drive(150, 300 + id.length * 7, { stop: function (s) { return s.dead; } });
    }, { id: rooms[i], fighter: fighters[i % 5] });
  }
  // E2 every fighter: Overclock + ultimate + specials against spawned enemies in the debug room
  for (const id of fighters) {
    await seg('oc:' + id, (id) => {
      UB.debug.newGame(id); __qa.settle(); UB.debug.warp('debug_room', { x: 240, y: 450 }); UB.debug.step(3);
      UB.debug.spawnEnemy('scuttlebit', 14, 14, { patrol: [10, 20] }); UB.debug.spawnEnemy('platewalker', 20, 14, { patrol: [18, 24] }); UB.debug.spawnEnemy('glarewisp', 16, 8, {}); UB.debug.spawnEnemy('broodcell', 22, 14, {});
      UB.debug.setMeter(100); UB.debug.setEnergy(100);
      return __qa.drive(300, 9, { extra: function (f) { if (f === 5) UB.debug.pressed('overclock', 2); if (f === 60 || f === 160 || f === 240) UB.debug.pressed('special', 2); if (f === 150) UB.debug.setEnergy(100); } });
    }, id);
  }
  // E3 all four boss fights with real inputs (god mode so the session reaches every attack pattern), a different fighter each
  const bossFighters = ['brackmaw', 'vellix', 'orrubel', 'tessik'];
  for (let i = 0; i < BOSSES.length; i++) {
    const [room, id] = BOSSES[i];
    await seg('boss:' + id, ({ room, id, fighter }) => {
      UB.debug.newGame(fighter); __qa.settle(); UB.debug.warp(room, null); UB.debug.step(2);
      const b = UB.game.boss; UB.debug.teleport(b.x - 120, UB.game.level.room.h * 30 - 60); UB.debug.god(true);
      let n = 0; while (n++ < 400 && UB.debug.state().bossFight !== 'fight') UB.debug.step(1);
      UB.debug.setEnergy(100);
      const r = __qa.drive(600, 5 + id.length, { extra: function (f) { if (f % 120 === 0) UB.debug.setEnergy(100); if (f === 300 && id === 'kernauth') { const bb = UB.game.boss; if (bb && bb.phase === 1) { bb.hp = 1; } } } });
      r.boss = UB.debug.boss(); UB.debug.god(false); return r;
    }, { room, id, fighter: bossFighters[i] });
  }
  // E4 overlays: pause / map / settings / shop / lore while frames tick
  await seg('overlays', () => {
    UB.debug.newGame('korvask'); __qa.settle(); let frames = 0;
    const step = (n) => { UB.debug.step(n); frames += n; };
    UB.debug.skipTo('pause'); step(30); UB.debug.pressed('back', 2); step(10);
    UB.debug.skipTo('map'); step(30); UB.debug.pressed('right', 3); step(10); UB.debug.pressed('back', 2); step(10);
    UB.debug.skipTo('settings'); step(30); UB.debug.pressed('back', 2); step(10); UB.debug.pressed('back', 2); step(10);
    UB.debug.warp('dc_shrine', null); step(5); UB.debug.addBits(400); UB.debug.skipTo('shop'); step(30); UB.debug.pressed('confirm', 2); step(20); UB.debug.pressed('back', 2); step(40);
    UB.debug.skipTo('lore'); step(260);
    UB.debug.skipTo('play'); step(10);
    return { frames, nan: __qa.nanScan(), rooms: {}, state: UB.debug.state() };
  });
  // E5 hazards, node rest, death + respawn, crumble + mover
  await seg('hazard-death-respawn', () => {
    UB.debug.newGame('vellix'); __qa.settle(); let frames = 0;
    const step = (n) => { UB.debug.step(n); frames += n; };
    UB.debug.warp('debug_room', { x: 5 * 30 + 15, y: 450 }); step(3); UB.debug.pressed('up', 2); step(60);
    UB.debug.teleport(10 * 30 + 15, 420); step(60);
    UB.debug.warp('debug_room2', 'L'); step(30); UB.debug.teleport(12 * 30 + 15, 9 * 30); step(240);
    UB.debug.teleport(7 * 30 + 15, 6 * 30); step(200);
    UB.debug.setHp(0); let n = 0; while (n++ < 300 && UB.debug.state().screen !== 'gameover') step(1);
    step(30); UB.debug.pressed('confirm', 2); n = 0; while (n++ < 300 && !(UB.debug.state().screen === 'play' && !UB.debug.state().busy)) step(1);
    step(60);
    return { frames, nan: __qa.nanScan(), rooms: {}, hp: UB.debug.state().hp, state: UB.debug.state() };
  });
  // E6 real exit transitions in both directions (held direction key through the opening)
  await seg('transitions', () => {
    UB.debug.newGame('tessik'); __qa.settle(); let frames = 0, transitions = 0;
    for (let k = 0; k < 6; k++) {
      const from = k % 2 ? 'debug_room2' : 'debug_room', to = k % 2 ? 'debug_room' : 'debug_room2', dir = k % 2 ? 'left' : 'right';
      UB.debug.warp(from, k % 2 ? 'L' : 'R'); UB.debug.step(6); frames += 6;
      let n = 0; while (n++ < 240 && UB.debug.state().roomId !== to) { UB.debug.pressed(dir, 1); UB.debug.step(1); frames++; }
      if (UB.debug.state().roomId === to) transitions++;
      n = 0; while (n++ < 60 && UB.debug.state().transition) { UB.debug.step(1); frames++; }
    }
    return { frames, transitions, nan: __qa.nanScan(), rooms: {} };
  });
  if (session.frames < 10800) await seg('top-up', (need) => { UB.debug.newGame('orrubel'); __qa.settle(); UB.debug.warp('debug_room', { x: 240, y: 450 }); UB.debug.god(true); UB.debug.spawnEnemy('hopnode', 20, 14, {}); UB.debug.spawnEnemy('spitvalve', 26, 11, {}); const r = __qa.drive(need, 42); UB.debug.god(false); return r; }, 10800 - session.frames + 60);
  const E = session;
  const warnLines = t.logs.slice(logStart).filter(l => /^\[(warning|error)\]/.test(l));
  check('E1 scripted session ran ≥ 10 800 logic frames (3 min at 60 Hz): ' + E.frames + ' frames over ' + E.segs.length + ' segments', E.frames >= 10800, E.segs);
  check('E2 no NaN in any entity / camera / mover position during the session', !E.nan, E.nan);
  check('E3 no console warnings or errors during the session', warnLines.length === 0, warnLines.slice(0, 10));
  const bossSegs = E.segs.filter(s => s.name.startsWith('boss:'));
  check('E4 every boss segment ran 600 frames of live fight', bossSegs.length === 4 && bossSegs.every(s => s.frames === 600), bossSegs);
  const trSeg = E.segs.find(s => s.name === 'transitions');
  check('E5 real exit transitions completed in both directions', trSeg && trSeg.transitions === 6, trSeg);
  check('E6 session touched every real room (' + rooms.length + ') with every fighter in rotation', E.segs.filter(s => s.name.startsWith('room:')).length === rooms.length && rooms.length >= 20, rooms.length);

  // E7 the real rAF loop with keyboard events for 4 s (presentation path, unpaused)
  await ev(() => { UB.debug.newGame('vellix'); __qa.settle(); UB.debug.grant('burstLine'); UB.debug.pauseLogic(false); });
  const f0 = await ev(() => UB.debug.state().frame);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.down('Space'); await page.waitForTimeout(150); await page.keyboard.up('Space');
  await page.keyboard.down('KeyJ'); await page.waitForTimeout(80); await page.keyboard.up('KeyJ'); await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight'); await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(600);
  await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(60); await page.keyboard.up('ShiftLeft'); await page.waitForTimeout(400);
  await page.keyboard.down('KeyK'); await page.waitForTimeout(80); await page.keyboard.up('KeyK'); await page.waitForTimeout(600);
  await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(1100);
  const live = await ev(() => { const s = UB.debug.state(); UB.debug.pauseLogic(true); return { frame: s.frame, fps: UB.game.fps, nan: __qa.nanScan(), hints: s.hints, x: s.x }; });
  check('E7 real rAF loop ticks logic (≥ 150 frames in 4 s) with keyboard input, fps counter alive, no NaN', live.frame - f0 >= 150 && live.fps >= 20 && !live.nan && live.hints.move && live.hints.jump, { f0, live });
  check('E8 no page errors / console errors over the whole file:// run', t.errors.length === 0, t.errors.slice(0, 5));
  const allWarn = t.logs.filter(l => /^\[warning\]/.test(l));
  check('E9 no console warnings at any point of the file:// run (' + t.logs.length + ' console lines)', allWarn.length === 0, allWarn.slice(0, 10));
}

// ------------------------------------------------------------------------------------------------
// F. http serving
// ------------------------------------------------------------------------------------------------
function freePort() { return new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); }); }
function waitPort(port, ms) {
  return new Promise((res) => {
    const t0 = Date.now();
    (function tryOnce() {
      const c = net.connect(port, '127.0.0.1');
      c.once('connect', () => { c.destroy(); res(true); });
      c.once('error', () => { c.destroy(); if (Date.now() - t0 > ms) res(false); else setTimeout(tryOnce, 100); });
    })();
  });
}
async function httpRun() {
  const port = await freePort();
  const py = spawnSync('python3', ['--version'], { encoding: 'utf8' });
  check('F1 python3 is available for http.server', py.status === 0, py.stderr);
  if (py.status !== 0) return;
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
  try {
    const up = await waitPort(port, 8000);
    check('F2 http.server came up on 127.0.0.1:' + port, up);
    if (!up) return;
    const t = await launch({ url: 'http://127.0.0.1:' + port + '/index.html', bootMs: 500 });
    const { page } = t;
    const ev = (fn, ...a) => page.evaluate(fn, ...a);
    const boot = await ev(() => ({ ub: !!window.UB && !!window.UB.debug, screen: UB.debug.state().screen, errs: UB.debug.worldErrors().length, href: location.href }));
    check('F3 over http: boots to the title, world validates', boot.ub && boot.screen === 'title' && boot.errs === 0, boot);
    const res = await ev(() => performance.getEntriesByType('resource').map(r => r.name));
    const origin = 'http://127.0.0.1:' + port + '/';
    check('F4 over http: every resource is same-origin js/*.js (13) — no CDN, no fonts, no images', res.length === 13 && res.every(u => u.startsWith(origin + 'js/')), res);
    await ev(HELPERS);
    const play = await ev(() => {
      UB.debug.pauseLogic(true); UB.debug.newGame('korvask'); __qa.settle();
      const r = __qa.drive(600, 5);
      UB.debug.warp('lw_belts', null); UB.debug.step(2);
      const r2 = __qa.drive(300, 9);
      // save + reload path over http (localStorage on an http origin)
      UB.debug.warp('debug_room', { x: 5 * 30 + 15, y: 450 }); UB.debug.step(3); UB.debug.pressed('up', 2); UB.debug.step(2);
      let n = 0; while (n++ < 120 && UB.debug.state().mode !== 'normal') UB.debug.step(1);
      const saved = UB.debug.state().hasSave;
      return { s: r.state.screen, room: r.state.roomId, frames: r.frames + r2.frames, nan: r.nan || r2.nan, room2: r2.state.roomId, saved };
    });
    check('F5 over http: NEW GAME plays 900 frames across two zones without NaN and the node save works', play.s === 'play' && play.frames === 900 && !play.nan && play.room2 === 'lw_belts' && play.saved, play);
    await page.reload(); await page.waitForTimeout(400);
    const cont = await ev(() => { UB.debug.pauseLogic(true); const ok = UB.debug.continueGame(); let n = 0; while (n++ < 240 && !(UB.debug.state().screen === 'play' && !UB.debug.state().busy)) UB.debug.step(1); return { ok, room: UB.debug.state().roomId, fighter: UB.debug.state().fighter }; });
    check('F6 over http: CONTINUE after a reload restores the saved run', cont.ok && cont.room === 'debug_room' && cont.fighter === 'korvask', cont);
    const warn = t.logs.filter(l => /^\[(warning|error)\]/.test(l));
    check('F7 over http: no console warnings / errors', warn.length === 0 && t.errors.length === 0, warn.concat(t.errors).slice(0, 8));
    await t.close();
  } finally { try { srv.kill(); } catch (e) { /* ignore */ } }
}

// ------------------------------------------------------------------------------------------------
// G. run-all (opt-in)
// ------------------------------------------------------------------------------------------------
function runAllCheck() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'run-all.cjs')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const tail = out.split('\n').filter(Boolean).slice(-12);
  check('G1 test/run-all.cjs exits 0 (every suite passes)', r.status === 0, tail);
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const rows = readme.split('\n').filter(l => /^\| `[a-z-]+\.cjs` \|/.test(l));
  const mism = [];
  for (const row of rows) {
    const name = row.match(/^\| `([a-z-]+)\.cjs`/)[1];
    const want = (row.match(/\| ([0-9]+)[^|]*\|\s*$/) || [])[1];
    const got = (out.match(new RegExp('PASS ' + name + '\\s+[0-9.]+s\\s+(\\d+)/(\\d+)')) || [])[2];
    if (want && got && want !== got) mism.push(name + ': README says ' + want + ', suite ran ' + got);
  }
  check('G2 README check counts match the suites\' own summaries', mism.length === 0, mism);
}

(async () => {
  staticOriginality();
  staticCode();
  const t = await launch();
  try { await runtime(t); }
  catch (e) { check('C–E runtime section completed without a thrown error', false, String(e && e.stack || e)); }
  await t.close();
  try { await httpRun(); } catch (e) { check('F http section completed without a thrown error', false, String(e && e.stack || e)); }
  if (RUN_ALL) runAllCheck(); else info('G run-all.cjs not executed (pass --run-all to include it; it needs an idle machine)');
  readmeCountCheck();
  console.log(pass + '/' + (pass + fail) + ' checks passed' + (fail ? ' — FAILED: ' + failures.join(' | ') : ''));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
