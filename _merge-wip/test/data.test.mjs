// Validator tests (ARCHITECTURE §8.2): the shipped tables are clean; a fixture with deliberate broken
// references fails with exactly the right `table:id: message` lines, in-process and through the CLI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DATA, DEFAULT_LEGEND } from '../js/data/index.js';
import { TUNING } from '../js/data/tuning.js';
import { validateData, validateWorldAgainst, loadOptions } from '../tools/validate-data.mjs';
import { createRegistry } from '../js/data/registry.js';
import { createNewWorld } from '../js/state/schema.js';
import { encodeSeedCode } from '../js/core/rng.js';
import { makeBrokenData, EXPECTED } from './fixtures/data/broken-data.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'tools', 'validate-data.mjs');
const LINE_RE = /^[A-Za-z]+:[^:\s]+(\[[\d.]+\])?: .+/;

/** Clone of the shipped tables with `edit` applied. */
function variant(edit) {
  const d = structuredClone(DATA);
  edit(d);
  return d;
}
const run = (d, extra = {}) => validateData(d, { tuning: TUNING, legend: DEFAULT_LEGEND, ...extra });

test('the shipped placeholder tables have no errors', () => {
  const { errors } = run(DATA);
  assert.deepEqual(errors, []);
});

test('every message is a `table:id: message` line', () => {
  const { errors, warnings } = run(makeBrokenData());
  for (const line of [...errors, ...warnings]) assert.match(line, LINE_RE, line);
});

test('broken fixture: every deliberate break is reported with the right message', () => {
  const { errors } = run(makeBrokenData());
  for (const [prefix, msg] of EXPECTED) {
    assert.ok(errors.some((e) => e.startsWith(prefix) && e.includes(msg)), `missing: ${prefix} ${msg}\n${errors.join('\n')}`);
  }
});

test('broken fixture: no cascade noise (one error per break)', () => {
  const { errors } = run(makeBrokenData());
  assert.equal(errors.length, EXPECTED.length, errors.join('\n'));
});

test('validateData does not mutate its input', () => {
  const d = makeBrokenData();
  const before = JSON.stringify(d);
  run(d);
  assert.equal(JSON.stringify(d), before);
});

test('CLI exits 0 on the shipped tables', () => {
  const r = spawnSync(process.execPath, [CLI, '--quiet'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /validate-data: 0 errors/);
});

test('CLI exits 1 on the broken fixture and prints `error table:id: message` lines', () => {
  const r = spawnSync(process.execPath, [CLI, '--quiet', '--data', 'test/fixtures/data/broken-data.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 1);
  const lines = r.stderr.trim().split('\n').filter((l) => l.startsWith('error '));
  assert.equal(lines.length, EXPECTED.length, r.stderr);
  for (const l of lines) assert.match(l.slice(6), LINE_RE);
  assert.ok(lines.some((l) => l.includes("scripts:ph-trainer-loss[0]: unknown op 'dance'")));
});

test('CLI --strict fails on warnings', () => {
  const r = spawnSync(process.execPath, [CLI, '--quiet', '--strict'], { cwd: ROOT, encoding: 'utf8' });
  const { warnings } = run(DATA);
  // the shipped data warns only about lanes that have not landed (sprites, bag handlers)
  assert.equal(r.status, warnings.length ? 1 : 0);
});

test('moves: evasion pp, Scrap-only null pp, signature learnset', () => {
  const { errors } = run(variant((d) => {
    d.moves.find((m) => m.id === 'ph-mist').pp = 10;
    d.moves.find((m) => m.id === 'ph-tap').pp = null;
    d.moves.find((m) => m.id === 'ph-gust').signature = 'ph-paw';
  }));
  assert.ok(errors.includes('moves:ph-mist: evasion moves must have pp <= 5'));
  assert.ok(errors.includes('moves:ph-tap: pp may be null only for Scrap'));
  assert.ok(errors.includes("moves:ph-gust: signature species 'ph-paw' does not learn it"));
});

test('species/families: type names, window order, star form, every form in a family', () => {
  const { errors } = run(variant((d) => {
    d.species[0].types = ['Lava'];
    d.families[0].windows = [9, 9, 34];
    d.families[0].star = 'ph-ghost';
    d.families.push({ id: 'ph-empty', name: 'x', windows: [5], shiftTable: {}, star: null });
  }));
  assert.ok(errors.includes("species:ph-pip: type 'Lava' is not in types"));
  assert.ok(errors.includes('families:ph-line: windows must be strictly ascending positive integers'));
  assert.ok(errors.includes("families:ph-line: star form 'ph-ghost' is not a form of this family"));
  assert.ok(errors.includes('families:ph-empty: no species names this family'));
});

test('abilities: Ward count must equal tuning.wardCount; hook keys checked when HOOKS is known', () => {
  const d = variant((x) => { x.abilities[0].hook = 'shore'; });
  const { errors } = validateData(d, { tuning: { ...TUNING, wardCount: 1 }, hooks: new Set(['other']), legend: DEFAULT_LEGEND });
  assert.ok(errors.includes('abilities:*: 0 Ward abilities, tuning.wardCount is 1'));
  assert.ok(errors.includes("abilities:ph-shoresense: hook 'shore' has no entry in battle/abilityHooks.HOOKS"));
});

test('items: oneOfAKind only in keepsakes; use handler checked when USE_HANDLERS is known', () => {
  const d = variant((x) => { x.items[0].oneOfAKind = true; });
  const { errors } = validateData(d, { useHandlers: new Set(['heal']), legend: DEFAULT_LEGEND });
  assert.ok(errors.includes('items:ph-lantern: oneOfAKind items belong in the keepsakes pocket'));
  assert.ok(errors.includes("items:ph-lantern: use handler 'capture:1' is not in systems/bag.USE_HANDLERS"));
});

test('maps: legend chars, warp target bounds, unreachable warps, tide:low bridges, spawn classes', () => {
  const { errors } = run(variant((d) => {
    const f = d.maps.find((m) => m.id === 'ph-field');
    f.ground[0] = 'DDDDSSAAGGG?';
    f.warps[0].to.x = 99;
    f.spawns.push({ area: 'mud', table: 'ph-grass', rate: 0.1 });
    const hut = d.maps.find((m) => m.id === 'ph-hut');
    hut.ground[4] = '#FFFFFF#'; hut.ground[3] = '########';           // wall off the door from the entry
    hut.entry = { x: 3, y: 1 };
  }));
  assert.ok(errors.includes("maps:ph-field: ground (11,0): char '?' is not in the legend"));
  assert.ok(errors.includes("maps:ph-field: warp at (10,4) targets (99,4) outside 'ph-hut'"));
  assert.ok(errors.includes("maps:ph-field: spawn 'ph-grass' area 'mud' matches no tile on this map"));
  assert.ok(errors.includes('maps:ph-hut: warp at (3,5) is not reachable from the entry at low tide'), errors.join('\n'));
});

test('maps: a causeway touching dry land on one end only is an error', () => {
  const { errors } = run(variant((d) => {
    const f = d.maps.find((m) => m.id === 'ph-field');
    f.ground[0] = 'DEDDSSAAGGGG';                                       // lone causeway tile in deep water
  }));
  assert.ok(errors.some((e) => e.startsWith('maps:ph-field: tide:low region at (1,0) must touch dry land on both ends')), errors.join('\n'));
});

test('npcs: schedule order, passable tiles, thread back-reference', () => {
  const { errors } = run(variant((d) => {
    const n = d.npcs[0];
    n.schedule[3].at = 8 * 60;
    n.schedule[0].x = 0; n.schedule[0].y = 0;                           // a wall
    d.threads[0].npcId = 'ph-other';
  }));
  assert.ok(errors.includes('npcs:ph-keeper: schedule[3] at 480 is not after the previous timed entry (540)'));
  assert.ok(errors.includes("npcs:ph-keeper: schedule[0] (0,0) is never passable on 'ph-hut'"));
  assert.ok(errors.includes("npcs:ph-keeper: thread 'ph-thread' belongs to npc 'ph-other'"));
  assert.ok(errors.includes("threads:ph-thread: npcId 'ph-other' is not in npcs"));
});

test('scripts: choice goto labels, call targets, startBattle refs, cond refs inside ops', () => {
  const { errors } = run(variant((d) => {
    d.scripts['ph-arrival'] = [
      { op: 'choice', options: [{ text: 'a', goto: 'missing' }] },
      { op: 'call', script: 'ph-nope' },
      { op: 'startBattle', trainer: 'ph-ghost' },
      { op: 'if', cond: { party: { has: 'ph-ghost' } }, then: [] },
      { op: 'end' },
    ];
  }));
  assert.ok(errors.includes("scripts:ph-arrival[0]: choice option 0 goto 'missing': no such label"));
  assert.ok(errors.includes("scripts:ph-arrival[1]: call.script 'ph-nope' is not in scripts"));
  assert.ok(errors.includes("scripts:ph-arrival[2]: startBattle.trainer 'ph-ghost' is not in trainers"));
  assert.ok(errors.includes("scripts:ph-arrival[3]: if.cond: cond: party.has 'ph-ghost' is not in species"));
});

test('trainers / shops / encounters / letters: value rules', () => {
  const { errors } = run(variant((d) => {
    d.trainers[0].payout = -1;
    d.trainers[0].ai = 'genius';
    d.shops[0].hours = [7 * 60, 2000];
    d.encounters['ph-grass'][0].levels = [5, 2];
    d.encounters['ph-grass'][0].w = 0;
    d.letters[0].relicId = 'ph-pear';
  }));
  assert.ok(errors.includes('trainers:ph-rival-1: payout must be >= 0'));
  assert.ok(errors.some((e) => e.startsWith("trainers:ph-rival-1: ai profile 'genius' unknown")));
  assert.ok(errors.includes('shops:ph-shop: hours must be [open, close] minutes in 0..1440'));
  assert.ok(errors.some((e) => e.startsWith("encounters:ph-grass: 'ph-pip' levels must be [min, max]")));
  assert.ok(errors.includes("encounters:ph-grass: 'ph-pip' weight must be > 0"));
  assert.ok(errors.includes("letters:letter-1: relicId 'ph-pear' is not a relic collection row"));
});

test('optional lane modules: sprites, palette and tracks rules run when supplied', () => {
  const sprites = { 'ph-pip': { rows: ['..', '..'], palette: { z: '#000' }, back: ['..'] } };
  const { errors } = validateData(DATA, {
    legend: DEFAULT_LEGEND, sprites, master: { a: '#fff' },
    tracks: { TRACKS: { day: {} }, CUES: Object.fromEntries(Array.from({ length: 23 }, (_, h) => [h, 'day'])) },
  });
  assert.ok(errors.includes('species:ph-pup: no front sprite in art/creatures'));
  assert.ok(errors.includes("species:ph-pip: sprite palette key 'z' is not in MASTER"));
  assert.ok(errors.includes('tracks:hour-23: no cue for this hour'));
});

test('a flag read but never set is a warning, not an error', () => {
  const { errors, warnings } = run(variant((d) => { d.scripts['ph-remind'].unshift({ op: 'if', cond: { flag: 'sp.never-set' }, then: [] }); }));
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes("flag 'sp.never-set' is read but never set")));
});

test('loadOptions finds the lanes that exist and falls back for the rest', async () => {
  const { opts } = await loadOptions();
  assert.ok(opts.tuning && typeof opts.tuning.noRepeatDays === 'number');
  assert.ok(Array.isArray(opts.effectKeys) || opts.effectKeys instanceof Set || typeof opts.effectKeys === 'object');
});

test('--world: a fresh world validates against the registry; a future version does not', () => {
  const reg = createRegistry(DATA);
  const world = createNewWorld({ seedCode: encodeSeedCode({ dial: 'FLUX', seed: 7, toggles: [] }) });
  assert.deepEqual(validateWorldAgainst(world, reg), []);
  const future = { ...world, v: 999 };
  assert.ok(validateWorldAgainst(future, reg).some((p) => p.startsWith('world:v: 999 is newer')));
  assert.deepEqual(validateWorldAgainst(null, reg), ['world: not an object']);
});
