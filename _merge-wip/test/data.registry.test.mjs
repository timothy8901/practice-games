// js/data/registry.js: id lookups with readable errors over DATA.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';

const tiny = () => ({
  moves: [{ id: 'tap', name: 'Tap' }, { id: 'splash', name: 'Splash' }, { id: 'settle', name: 'Settle' }],
  scripts: { 'intro-a': [{ op: 'end' }], 'intro-b': ['Hi.'] },
  empty: [],
});

test('get returns the row; byId is a read-only index in declaration order', () => {
  const r = createRegistry(tiny());
  assert.equal(r.get('moves', 'splash').name, 'Splash');
  const idx = r.byId('moves');
  assert.ok(idx instanceof Map);
  assert.deepEqual([...idx.keys()], ['tap', 'splash', 'settle']);
  assert.deepEqual(r.ids('moves'), ['tap', 'splash', 'settle']);
  assert.deepEqual(r.list('moves').map((m) => m.id), ['tap', 'splash', 'settle']);
});

test('get on a missing id names the table, the id and the closest id', () => {
  const r = createRegistry(tiny());
  assert.throws(() => r.get('moves', 'splsh'), /no 'moves' row with id 'splsh' \(did you mean 'splash'\?\)/);
  assert.throws(() => r.get('moves', 'zzzzzzzzz'), (e) => e.message === "data.get: no 'moves' row with id 'zzzzzzzzz'");
});

test('unknown table errors suggest the closest table and list every table', () => {
  const r = createRegistry(tiny());
  assert.throws(() => r.get('move', 'tap'), /unknown table 'move' \(did you mean 'moves'\?\); tables: moves, scripts, empty/);
  assert.throws(() => r.list('nope'), /data\.list: unknown table 'nope'/);
});

test('get rejects a non-string id with a TypeError', () => {
  const r = createRegistry(tiny());
  assert.throws(() => r.get('moves', 3), TypeError);
});

test('has / tryGet never throw for unknown ids; has never throws for unknown tables', () => {
  const r = createRegistry(tiny());
  assert.equal(r.has('moves', 'tap'), true);
  assert.equal(r.has('moves', 'nope'), false);
  assert.equal(r.has('nope', 'tap'), false);
  assert.equal(r.has('moves', undefined), false);
  assert.equal(r.tryGet('moves', 'nope'), null);
  assert.equal(r.tryGet('moves', 'tap').name, 'Tap');
  assert.throws(() => r.tryGet('nope', 'x'), /unknown table/);
});

test('object tables are indexed by key', () => {
  const r = createRegistry(tiny());
  assert.deepEqual(r.get('scripts', 'intro-b'), ['Hi.']);
  assert.deepEqual(r.ids('scripts'), ['intro-a', 'intro-b']);
  assert.equal(r.raw('scripts'), r.raw('scripts'));
});

test('where / findBy filter rows', () => {
  const r = createRegistry(tiny());
  assert.deepEqual(r.where('moves', (m) => m.name.startsWith('S')).map((m) => m.id), ['splash', 'settle']);
  assert.deepEqual(r.findBy('moves', 'name', 'Tap').map((m) => m.id), ['tap']);
  assert.throws(() => r.where('moves', 'x'), TypeError);
});

test('verify reports bad ids and duplicates; first row of a duplicate wins', () => {
  const r = createRegistry({
    moves: [{ id: 'tap', n: 1 }, { id: 'tap', n: 2 }, { id: 'Bad_Id' }, { name: 'no id' }],
    scripts: { 'Bad Key': [] },
    broken: 42,
  });
  const problems = r.verify();
  assert.ok(problems.includes('moves:tap: duplicate id'));
  assert.ok(problems.some((p) => p.startsWith('moves[2]: bad id "Bad_Id"')));
  assert.ok(problems.some((p) => p.startsWith('moves[3]: bad id undefined')));
  assert.ok(problems.some((p) => p.startsWith('scripts:Bad Key: bad id')));
  assert.ok(problems.some((p) => p.startsWith('broken: table must be')));
  assert.equal(r.get('moves', 'tap').n, 1);
});

test('createRegistry rejects a non-object DATA', () => {
  assert.throws(() => createRegistry(null), TypeError);
  assert.throws(() => createRegistry([]), TypeError);
});

test('the registry is frozen and the shipped DATA verifies clean', () => {
  const r = createRegistry(DATA);
  assert.ok(Object.isFrozen(r));
  assert.deepEqual(r.verify(), []);
  for (const table of r.tables) assert.ok(Array.isArray(r.list(table)));
  assert.equal(r.get('species', 'ph-pip').familyId, 'ph-line');
});
