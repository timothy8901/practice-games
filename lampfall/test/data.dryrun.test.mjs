// tools/script-dryrun.mjs: every script in the merged registry runs on every branch with a stub host,
// and the dry-run itself catches the faults it claims to catch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dryRunAll, exploreScript, staticFindings, forceOps, loadRegistry } from '../tools/script-dryrun.mjs';
import { DATA_CONTENT } from '../js/data/content.js';
import { createRegistry } from '../js/data/registry.js';

test('the merged registry dry-runs clean on every branch: no throws, unknown ops or ids, or dead ends', () => {
  const report = dryRunAll();
  assert.ok(report.scripts >= 400, `only ${report.scripts} scripts in the registry`);
  assert.ok(report.paths > report.scripts * 2, 'both passes explored');
  assert.deepEqual(report.findings.map((f) => `${f.kind} ${f.msg}`), []);
  assert.deepEqual(report.truncated, []);
});

test('forced mode turns if / branch into decisions and lifts option conds', () => {
  const forced = forceOps([
    { op: 'if', cond: { flag: 'x' }, then: ['A'] },
    { op: 'branch', on: 'dial', cases: { drift: ['B'], flux: ['C'] } },
    { op: 'choice', options: [{ text: 'rich', cond: { wallet: { gte: 9e9 } }, then: ['D'] }] },
  ], () => false);
  assert.equal(forced[0].op, 'choice');
  assert.deepEqual(forced[0].options.map((o) => o.text), ['then', 'else']);
  assert.deepEqual(forced[1].options.map((o) => o.text), ['case drift', 'case flux', 'no case']);
  assert.equal(forced[2].options[0].cond, undefined);
});

test('the dry-run reports seeded faults', () => {
  const extra = {
    'zz-unknown-op': [{ op: 'dance' }, { op: 'end' }],
    'zz-missing-label': [{ op: 'choice', options: [{ text: 'a' }, { text: 'b', then: [{ op: 'goto', id: 'nowhere' }] }] }, { op: 'end' }],
    'zz-goto-then': [{ op: 'choice', options: [{ text: 'a', then: ['* skipped'], goto: 'x' }] }, { op: 'label', id: 'x' }, { op: 'end' }],
    'zz-bad-sfx': [{ op: 'playSfx', name: 'kazoo' }, { op: 'teleport', who: 'nobody-at-all', x: 1, y: 1 }, { op: 'end' }],
    'zz-forever': [{ op: 'label', id: 'top' }, '* again', { op: 'goto', id: 'top' }],
    'zz-loop-no-exit': [{ op: 'label', id: 't' }, { op: 'choice', options: [{ text: 'again', then: [{ op: 'goto', id: 't' }] }] }],
  };
  const data = createRegistry({ ...DATA_CONTENT, scripts: { ...DATA_CONTENT.scripts, ...extra } });
  const env = { trackIds: new Set(['title']), letterNs: new Set([1]) };
  const kinds = (id) => [
    ...staticFindings(id, extra[id], data, env).map((f) => f.kind),
    ...exploreScript(id, { data, mode: 'natural', mapId: 'pellwick' }).findings.map((f) => f.kind),
    ...exploreScript(id, { data, mode: 'forced', mapId: 'pellwick' }).findings.map((f) => f.kind),
  ];
  assert.ok(kinds('zz-unknown-op').includes('unknown-op'));
  assert.ok(kinds('zz-unknown-op').includes('throw'));
  assert.ok(kinds('zz-missing-label').includes('throw'), 'goto to a missing label throws on its branch');
  assert.ok(kinds('zz-goto-then').includes('dead-end'));
  assert.equal(kinds('zz-bad-sfx').filter((k) => k === 'unknown-id').length, 2);
  assert.ok(kinds('zz-forever').includes('dead-end'));
  assert.ok(kinds('zz-loop-no-exit').includes('dead-end'));
});

test('the explorer takes every option of a branching story scene', () => {
  const { data } = loadRegistry();
  const natural = exploreScript('maud-practice-table', { data, mode: 'natural', mapId: 'lowmoor' });
  assert.ok(natural.completed >= 1 && natural.loops >= 1, 'Reroll/Anchor loop back, Accept leaves');
  const forced = exploreScript('charges-pulled', { data, mode: 'forced', mapId: 'lantern-stack' });
  assert.ok(forced.paths >= 6, 'map guard, three companions and two closing options');
  assert.deepEqual(forced.findings, []);
});
