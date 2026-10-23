import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags, flagsToSearch, isLocalhost, DEFAULT_FLAGS, SPEED_MAX, SPEED_MIN } from '../js/debug/flags.js';

test('parseFlags: defaults for an empty or missing query', () => {
  assert.deepEqual(parseFlags(''), DEFAULT_FLAGS);
  assert.deepEqual(parseFlags(undefined), DEFAULT_FLAGS);
  assert.deepEqual(parseFlags(null), DEFAULT_FLAGS);
  assert.deepEqual(parseFlags('?'), DEFAULT_FLAGS);
});

test('parseFlags: returns a fresh mutable record each call', () => {
  const a = parseFlags('');
  a.noanim = true;
  assert.equal(parseFlags('').noanim, false);
  assert.equal(Object.isFrozen(a), false);
});

test('parseFlags: every documented flag', () => {
  const f = parseFlags('?debug=1&seed=drift-k7q2-md7f&skipTitle=1&speed=8&touch=1&slot=auto:1&scale=fit&mute=1&noanim=1&strict=1&scene=battle&trainer=wren');
  assert.deepEqual(f, {
    debug: true, seed: 'DRIFT-K7Q2-MD7F', skipTitle: true, speed: 8, touch: true, slot: 'auto:1', scale: 'fit',
    mute: true, noanim: true, strict: true, scene: 'battle', trainer: 'wren',
  });
});

test('parseFlags: boolean spellings', () => {
  for (const v of ['1', 'true', 'yes', 'on', '']) assert.equal(parseFlags(`?debug=${v}`).debug, true, v);
  assert.equal(parseFlags('?debug').debug, true);
  for (const v of ['0', 'false', 'no', 'off', 'maybe']) assert.equal(parseFlags(`?debug=${v}`).debug, false, v);
});

test('parseFlags: speed is clamped and falls back to 1', () => {
  assert.equal(parseFlags('?speed=1000').speed, SPEED_MAX);
  assert.equal(parseFlags('?speed=0.01').speed, SPEED_MIN);
  assert.equal(parseFlags('?speed=0').speed, 1);
  assert.equal(parseFlags('?speed=-3').speed, 1);
  assert.equal(parseFlags('?speed=fast').speed, 1);
  assert.equal(parseFlags('?speed=2.5').speed, 2.5);
});

test('parseFlags: touch tri-state', () => {
  assert.equal(parseFlags('').touch, 'auto');
  assert.equal(parseFlags('?touch=0').touch, false);
  assert.equal(parseFlags('?touch=1').touch, true);
  assert.equal(parseFlags('?touch=auto').touch, 'auto');
});

test('parseFlags: malformed values fall back instead of throwing', () => {
  assert.equal(parseFlags('?seed=a').seed, null);
  assert.equal(parseFlags('?seed=lower-case-ok').seed, 'LOWER-CASE-OK');
  assert.equal(parseFlags('?slot=auto:0').slot, null);
  assert.equal(parseFlags('?slot=manual:3').slot, 'manual:3');
  assert.equal(parseFlags('?scale=huge').scale, null);
  assert.equal(parseFlags('?scene=../evil').scene, null);
  assert.equal(parseFlags('?scene=fieldLog').scene, 'fieldLog');
  assert.equal(parseFlags('?trainer=Wren').trainer, 'wren');
});

test('parseFlags: accepts URLSearchParams', () => {
  assert.equal(parseFlags(new URLSearchParams('mute=1')).mute, true);
});

test('flagsToSearch: round-trips and omits defaults', () => {
  assert.equal(flagsToSearch({}), '');
  assert.equal(flagsToSearch(DEFAULT_FLAGS), '');
  const f = parseFlags('?debug=1&seed=FLUX-AAAA-BBBB&speed=4&touch=0&scene=menu');
  assert.deepEqual(parseFlags(flagsToSearch(f)), f);
  assert.match(flagsToSearch({ touch: false }), /touch=0/);
});

test('isLocalhost', () => {
  assert.equal(isLocalhost('localhost'), true);
  assert.equal(isLocalhost('127.0.0.1'), true);
  assert.equal(isLocalhost('::1'), true);
  assert.equal(isLocalhost('app.localhost'), true);
  assert.equal(isLocalhost('example.com'), false);
  assert.equal(isLocalhost(null), false);
  assert.equal(isLocalhost(undefined), false);
});
