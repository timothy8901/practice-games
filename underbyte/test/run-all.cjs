/*
 * UNDERBYTE — test/run-all.cjs
 * Runs every Playwright suite in test/ as a child process, one after another (the frame-time
 * checks in ui.cjs / playthrough.cjs measure real render cost and need the CPU to themselves),
 * prints each suite's summary line and a final table. Exit code 0 = every suite exited 0.
 *
 *   node underbyte/test/run-all.cjs            # all suites
 *   node underbyte/test/run-all.cjs smoke ui   # a subset (names without .cjs)
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SUITES = ['smoke', 'verify-core', 'world', 'characters', 'enemies', 'audio', 'ui', 'playthrough'];
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : SUITES;
const rows = [];
let failed = 0;
for (const name of wanted) {
  const file = path.join(__dirname, name + '.cjs');
  const t0 = Date.now();
  process.stdout.write('\n=== ' + name + ' (' + file + ')\n');
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').filter(Boolean);
  const fails = lines.filter(l => l.startsWith('FAIL'));
  const summary = lines.find(l => /\d+\/\d+ (checks|hard checks|steps) passed/.test(l)) || lines[lines.length - 1] || '';
  for (const l of fails) console.log('  ' + l.slice(0, 300));
  console.log('  ' + summary.slice(0, 300));
  const ok = r.status === 0;
  if (!ok) { failed++; if (!fails.length) console.log(out.slice(-3000)); }
  rows.push({ name, ok, secs: ((Date.now() - t0) / 1000).toFixed(1), summary: summary.replace(/ — FAILED:.*$/, '') });
}
console.log('\n' + '='.repeat(72));
for (const r of rows) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name.padEnd(12) + ' ' + r.secs.padStart(6) + 's  ' + r.summary);
console.log('='.repeat(72));
console.log(failed ? failed + ' suite(s) FAILED' : 'all ' + rows.length + ' suites passed');
process.exit(failed ? 1 : 0);
