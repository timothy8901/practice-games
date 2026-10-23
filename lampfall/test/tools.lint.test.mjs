// tools/lint-owners.mjs: world-write ownership, Math.random ban, DOM-in-pure-dir ban (§8.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { lintSource, stripNonCode, classify, mayWrite, OWNERS, EXCEPTIONS, lintTree } from '../tools/lint-owners.mjs';
import { worldDefaults } from '../js/state/schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = (rel, src) => lintSource(rel, src, { exceptions: [] }).map((p) => `${p.rule}@${p.line}`);

test('OWNERS has one line for every World key in the schema', () => {
  const keys = Object.keys(worldDefaults());
  for (const k of keys) assert.ok(k in OWNERS, `OWNERS lacks world.${k}`);
  for (const k of Object.keys(OWNERS)) assert.ok(keys.includes(k), `OWNERS names unknown key ${k}`);
});

test('owner writes are allowed; foreign writes of every shape are reported with the owner', () => {
  assert.deepEqual(rules('systems/bag.js', 'world.bag.pockets.items.push(x);\nworld.bag = b;'), []);
  const src = [
    'world.wallet.main += 5;',           // 1 compound, deep
    'world.flags[id] = true;',           // 2 computed member
    'world.party.push(c);',              // 3 mutating call
    'delete world.npcs[id];',            // 4 delete
    'world.stats.steps++;',              // 5 postfix
    '++world.counters.x;',               // 6 prefix
    'world.log.splice(0, 1);',           // 7 splice
    'world.badges ??= [];',              // 8 logical assignment
  ].join('\n');
  assert.deepEqual(rules('systems/bag.js', src), ['owner@1', 'owner@2', 'owner@3', 'owner@4', 'owner@5', 'owner@6', 'owner@7', 'owner@8']);
  const [p] = lintSource('systems/bag.js', 'world.wallet.main = 0;', { exceptions: [] });
  assert.equal(p.file, 'js/systems/bag.js');
  assert.match(p.message, /writes world\.wallet, owned by js\/systems\/wallet\.js/);
});

test('reads, comparisons and lookalikes are not writes', () => {
  const src = [
    'if (world.wallet.main === 3) f();',
    'const ok = world.bag.n >= 2 && world.bag.n <= 9 && world.bag.n !== 1;',
    'const fn = (world) => world.flags;',
    'other.world.flags = 1;',
    'myworld.flags = 1;',
    'const s = world.party.slice().sort();',
    'world.party.map((c) => c.uid);',
  ].join('\n');
  assert.deepEqual(rules('systems/bag.js', src), []);
});

test('unknown world keys are reported as unowned', () => {
  const [p] = lintSource('systems/bag.js', 'world.mystery = 1;', { exceptions: [] });
  assert.match(p.message, /no owner/);
});

test('STATE world builders may write any key; shims are classified like the real path', () => {
  assert.deepEqual(rules('state/schema.js', 'world.wallet.main = 0; world.flags = {};'), []);
  assert.equal(classify('_shims/systems/clockSys.js'), 'systems/clockSys.js');
  assert.deepEqual(rules('_shims/systems/clockSys.js', 'world.clock = c.serialize();'), []);
  assert.ok(mayWrite('systems/wallet.js', 'wallet') && !mayWrite('systems/wallet.js', 'bag'));
});

test('comments and strings never trip a rule', () => {
  const src = [
    '/** Never call Math.random; world.flags = x is forbidden. */',
    "// window.foo; world.bag = 1; Math.random()",
    "const s = 'world.bag = 1; Math.random() window';",
    'const t = `document ${1 + 1} world.wallet = 2`;',
    'const re = /world\\.bag = \'x\'/g;',
  ].join('\n');
  assert.deepEqual(rules('systems/bag.js', src), []);
  assert.deepEqual(rules('systems/flags.js', src), []);
});

test('template expressions are still code', () => {
  assert.deepEqual(rules('systems/bag.js', 'const t = `${world.wallet.main = 1}`;'), ['owner@1']);
});

test('stripNonCode keeps line numbers and code columns', () => {
  const src = "a = 1; // c\n/* x\n y */ b = 'q';\nc = `t${d}t`;";
  const out = stripNonCode(src);
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.equal(out.length, src.length);
  assert.ok(out.includes('a = 1;') && out.includes(' b = \' \';') && out.includes('${d}'));
});

test('Math.random is banned outside js/debug, the G.entropy line and the CORE platform allowlist', () => {
  assert.deepEqual(rules('systems/loot.js', 'const r = Math.random();'), ['random@1']);
  assert.deepEqual(rules('scenes/title.js', 'x = Math .random();'), ['random@1']);
  assert.deepEqual(rules('debug/hook.js', 'x = Math.random();'), []);
  assert.deepEqual(rules('main.js', 'const entropy = makeRng(`${Math.random()}`);'), []);
  assert.deepEqual(rules('main.js', 'const roll = Math.random();'), ['random@1']);
  assert.deepEqual(rules('core/audio.js', 'rand = Math.random'), []);
});

test('DOM globals are banned in pure dirs only', () => {
  assert.deepEqual(rules('systems/x.js', 'const w = window.innerWidth;'), ['dom@1']);
  assert.deepEqual(rules('data/x.js', 'localStorage.getItem(k);'), ['dom@1']);
  assert.deepEqual(rules('script/x.js', 'globalThis.document.title;'), ['dom@1']);
  assert.deepEqual(rules('state/x.js', 'if (navigator) {}'), ['dom@1']);
  assert.deepEqual(rules('state/x.js', 'opts.window = 1; const windowed = true;'), []);
  assert.deepEqual(rules('scenes/x.js', 'window.addEventListener("blur", f);'), []);
});

test('documented exceptions move a write out of the problems list', () => {
  const ex = EXCEPTIONS[0] ?? { file: 'debug/hook.js', key: 'wallet', lane: 'TEST', reason: 'synthetic exception' };
  const excepted = [];
  const problems = lintSource(ex.file, `world.${ex.key}.x = 1;`, { excepted, exceptions: [ex] });
  assert.deepEqual(problems, []);
  assert.equal(excepted.length, 1);
  for (const e of EXCEPTIONS) assert.ok(e.lane && e.reason, 'every exception names a lane and a reason');
});

test('the repository lints clean and the CLI exits 0', () => {
  assert.deepEqual(lintTree(ROOT), []);
  const r = spawnSync(process.execPath, [join(ROOT, 'tools', 'lint-owners.mjs'), '--quiet'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
