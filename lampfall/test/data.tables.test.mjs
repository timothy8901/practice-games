// js/data/{index,ids,tuning,strings,credits}.js: table shape, id grammar, named constants, string templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DATA, TABLE_NAMES, TILES, DEFAULT_LEGEND, TOGGLE_ORDER } from '../js/data/index.js';
import { ID_RE, isId, assertId, kebab, index, deepFreeze, closestId, editDistance } from '../js/data/ids.js';
import TUNING, * as tuning from '../js/data/tuning.js';
import { STRINGS, t, has, fill, plural } from '../js/data/strings.js';
import { CREDITS } from '../js/data/credits.js';

// Every table the manifest (§1) and §6.3 name.
const DRAFT_TABLES = ['types', 'moves', 'abilities', 'species', 'families', 'items', 'loans', 'shops', 'dials', 'challenges',
  'trainers', 'npcs', 'schedules', 'threads', 'letters', 'scripts', 'eventScripts', 'maps', 'tilesets', 'encounters',
  'collections', 'credits'];

test('DATA has every table the draft names, deep-frozen', () => {
  for (const name of DRAFT_TABLES) assert.ok(name in DATA, `missing table ${name}`);
  assert.deepEqual(TABLE_NAMES, Object.keys(DATA));
  assert.ok(Object.isFrozen(DATA));
  assert.ok(Object.isFrozen(DATA.maps[0].ground));
  assert.ok(Object.isFrozen(DATA.scripts['ph-intro'][1].options[0]));
  assert.throws(() => { 'use strict'; DATA.moves.push({}); }, TypeError);
});

test('day-1 placeholder counts: 1 family of 3 forms, 6 moves, 1 ability, 1 item, 2 maps, 1 npc, 1 letter, 1 shop, 1 trainer, 1 encounter table', () => {
  assert.equal(DATA.families.length, 1);
  assert.equal(DATA.species.filter((s) => s.familyId === DATA.families[0].id).length, 3);
  assert.equal(DATA.moves.length, 6);
  assert.equal(DATA.abilities.length, 1);
  assert.equal(DATA.items.length, 1);
  assert.equal(DATA.maps.length, 2);
  assert.equal(DATA.npcs.length, 1);
  assert.ok(DATA.npcs[0].schedule.length > 0 && DATA.npcs[0].lines.generic.length > 0);
  assert.ok(Object.keys(DATA.scripts).length >= 1);
  assert.equal(DATA.letters.length, 1);
  assert.equal(DATA.shops.length, 1);
  assert.equal(DATA.trainers.length, 1);
  assert.equal(Object.keys(DATA.encounters).length, 1);
});

test('every placeholder row is clearly marked', () => {
  for (const table of ['moves', 'abilities', 'species', 'families', 'items', 'npcs', 'maps', 'trainers', 'shops', 'threads']) {
    for (const row of DATA[table]) assert.ok(row.id.startsWith('ph-') || /PLACEHOLDER/.test(row.name ?? ''), `${table}:${row.id}`);
  }
});

test('TILES and DEFAULT_LEGEND are derived from the tileset rows', () => {
  assert.equal(Object.keys(TILES).length, DATA.tilesets.length);
  assert.equal(TILES.causeway.tide, 'low');
  assert.equal(DEFAULT_LEGEND.E, 'causeway');
  assert.equal(DEFAULT_LEGEND['#'], 'wall');
  assert.ok(Object.isFrozen(TILES) && Object.isFrozen(DEFAULT_LEGEND));
  assert.ok(Array.isArray(TOGGLE_ORDER));
});

test('ids: grammar, assert, kebab', () => {
  assert.ok(ID_RE.test('ph-pip') && ID_RE.test('9lives'));
  for (const bad of ['', '-x', 'X', 'a_b', 'a b', 'é']) assert.equal(isId(bad), false, bad);
  assert.equal(assertId('ok-id'), 'ok-id');
  assert.throws(() => assertId('Bad', 'species[0].id'), /species\[0\]\.id: "Bad" is not a kebab-case id/);
  assert.equal(kebab('Wren Hearthwright'), 'wren-hearthwright');
  assert.equal(kebab('  Mabry  Coil!! '), 'mabry-coil');
  assert.equal(kebab('Élodie'), 'elodie');
});

test('ids: index builds a frozen lookup and fails loudly', () => {
  const i = index([{ id: 'a' }, { id: 'b' }], 'rows');
  assert.equal(i.b.id, 'b');
  assert.ok(Object.isFrozen(i));
  assert.throws(() => index([{ id: 'a' }, { id: 'a' }], 'rows'), /rows:a: duplicate id/);
  assert.throws(() => index([{ id: 'A' }], 'rows'), /rows\[0\]\.id/);
  assert.throws(() => index({}, 'rows'), /must be an array/);
});

test('ids: deepFreeze, closestId, editDistance', () => {
  const o = deepFreeze({ a: [{ b: 1 }] });
  assert.ok(Object.isFrozen(o.a[0]));
  const shallow = Object.freeze([{ inner: { x: 1 } }]);              // outer already frozen
  deepFreeze(shallow);
  assert.ok(Object.isFrozen(shallow[0].inner));
  const cyc = { n: 1 }; cyc.self = cyc;
  assert.equal(deepFreeze(cyc), cyc);
  assert.equal(closestId('splsh', ['tap', 'splash']), 'splash');
  assert.equal(closestId('zzzzzz', ['tap']), null);
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(editDistance('', 'abc'), 3);
});

test('tuning: frozen table with named exports that mirror it', () => {
  assert.ok(Object.isFrozen(TUNING));
  assert.equal(tuning.noRepeatDays, TUNING.noRepeatDays);
  assert.equal(tuning.toolRingHoldMs, 220);
  assert.deepEqual(tuning.porchWindow, TUNING.porchWindow);
  // Systems also read string and boolean keys (flag ids, modes), so allow every JSON scalar and objects.
  for (const [k, v] of Object.entries(TUNING)) assert.ok(['number', 'object', 'string', 'boolean'].includes(typeof v), k);
});

test('strings: t fills placeholders and plurals; missing keys render as [key]', () => {
  assert.equal(t('wallet.main', { n: 1 }), '1 button');   // GDD-00 §7: buttons (◉)
  assert.equal(t('wallet.main', { n: 3 }), '3 buttons');
  assert.equal(t('loan.tier', { tier: 2 }), 'Tier 2 cleared.');
  assert.equal(t('no.such.key'), '[no.such.key]');
  assert.equal(t('bag.got', { n: 2 }), 'Got 2 x {item}.');            // missing var stays visible
  assert.equal(t('game.title'), 'Lampfall');                // GDD-00 §0
  assert.ok(has('save.ok') && !has('nope'));
  assert.equal(fill('{a}-{b}', { a: 'x', b: null }), 'x-');
  assert.equal(plural(1, 'boat', 'boats'), 'boat');
  assert.ok(Object.isFrozen(STRINGS));
});

test('credits: ordered rows with headings and lines', () => {
  assert.ok(CREDITS.length > 0);
  for (const row of CREDITS) {
    assert.ok(isId(row.id));
    assert.equal(typeof row.heading, 'string');
    assert.ok(Array.isArray(row.lines));
  }
  assert.equal(DATA.credits, CREDITS);
});
