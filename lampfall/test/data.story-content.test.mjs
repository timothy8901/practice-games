import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NPCS, NPCS_BY_ID, NPC_SCRIPTS } from '../js/data/npcs/index.js';
import { STORY_SCRIPTS, STORY_TRIGGERS, EVENT_SCRIPTS, READING_PHASES } from '../js/data/scripts/index.js';
import { SCHEDULES } from '../js/data/schedules.js';
import { NPC_IDS, SCRIPT_IDS } from '../js/data/ids.manifest.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { MAPS_BY_ID } from '../js/data/maps/index.js';
import { createRegistry } from '../js/data/registry.js';
import { createNewWorld } from '../js/state/schema.js';
import { encodeSeedCode } from '../js/core/rng.js';
import { createRunner } from '../js/script/runner.js';
import { walkOps, validateOps } from '../js/script/ops.js';
import { evalCond } from '../js/script/cond.js';
import { whereIs } from '../js/systems/schedule.js';
import { scriptFor } from '../js/systems/flow/eventScripts.js';
import { THREAD_SCRIPTS } from '../js/data/threads/index.js';
import { TRAINER_SCRIPTS } from '../js/data/trainers.js';

const scripts = { ...THREAD_SCRIPTS, ...TRAINER_SCRIPTS, ...NPC_SCRIPTS, ...STORY_SCRIPTS };
const data = createRegistry({ ...DATA_CONTENT, npcs: NPCS, schedules: SCHEDULES, scripts, eventScripts: EVENT_SCRIPTS });
const fresh = () => createNewWorld({ seedCode: encodeSeedCode({ seed: 88, dial: 'FLUX', toggles: [] }) });
function drive(id, world = fresh(), picks = []) {
  const writes = [], requests = [], answers = picks.slice();
  const systems = {
    setFlag(w, key, value = true) { w.flags[key] = value; writes.push(['flag', key, value]); },
    give(w, item, n = 1) { writes.push(['give', item, n]); return { ok: true }; },
    take() { return { ok: true }; }, earn(w, n) { w.wallet.main += n; }, spend(w, n) { w.wallet.main -= n; },
    remember() {}, setBeat() { throw new Error('Set-piece must not advance a thread'); },
  };
  const runner = createRunner(scripts[id], { world, data, scriptId: id, systems, mapId: world.player.mapId });
  let r = runner.step();
  while (!r.done) {
    requests.push(r);
    if (requests.length > 500) throw new Error(`Unbounded story script: ${id}`);
    r = runner.step(r.op === 'choice' ? (answers.shift() ?? 0) : undefined);
  }
  return { world, requests, writes };
}

test('all 43 manifest cast members and all 72 story scenes are authored', () => {
  assert.deepEqual(NPCS.map((n) => n.id), NPC_IDS);
  for (const id of SCRIPT_IDS) assert.ok(STORY_SCRIPTS[id], id);
  assert.equal(NPCS.filter((n) => n.group === 'resident').length, 16);
  assert.ok(Object.isFrozen(NPCS_BY_ID.wren.schedule));
});

test('story, NPC and thread scripts have no unresolved references or malformed branches', () => {
  const errors = [];
  for (const [id, ops] of Object.entries(scripts)) {
    errors.push(...validateOps(ops, { scriptId: id, has: (table, key) => data.has(table, key) }).errors);
  }
  assert.deepEqual(errors, []);
});

test('all trigger overlays resolve a real map cell and use real scripts', () => {
  for (const [mapId, triggers] of Object.entries(STORY_TRIGGERS)) {
    const m = MAPS_BY_ID[mapId];
    for (const t of triggers) {
      assert.ok(t.x >= 0 && t.x < m.w && t.y >= 0 && t.y < m.h, `${mapId}:${t.id}`);
      assert.ok(data.has('scripts', t.script), t.script);
      assert.equal(typeof evalCond(fresh(), t.cond, { data }), 'boolean');
    }
  }
});

test('resident threads, shop posts, topics and named walking paths all resolve', () => {
  for (const n of NPCS) {
    if (n.threadId) assert.equal(data.get('threads', n.threadId).npcId, n.id);
    if (n.shopPost) assert.ok(data.has('shops', n.shopPost.shopId));
    for (const topic of n.topics) assert.ok(data.has('scripts', topic.script), `${n.id}:${topic.script}`);
    for (const e of n.schedule) if (e.path) assert.ok(data.has('schedules', e.path));
  }
});

test('the Relighting refuses an outstanding balance and cannot light the coast early', () => {
  const w = fresh(); w.loans.tier = 7; w.loans.paid = 1;
  const result = drive('the-relighting', w);
  assert.equal(result.writes.some(([kind]) => kind === 'give'), false);
  assert.equal(Boolean(w.flags['lit.calls']), false);
});

test('clearing the final loan hands over Isolde\'s lantern and lights all six rules in order', () => {
  const w = fresh(); w.loans.tier = 7; w.loans.paid = data.get('loans', 'tier-7').amount;
  const r = drive('the-relighting', w);
  assert.equal(r.writes.filter(([kind, item]) => kind === 'give' && item === 'isoldes-lantern').length, 1);
  assert.deepEqual(r.writes.filter(([kind, id]) => kind === 'flag' && id.startsWith('lit.')).map(([, id]) => id),
    ['lit.shiftTide', 'lit.steadied', 'lit.keepersAnchor', 'lit.fleetHome', 'lit.bar', 'lit.calls']);
  assert.ok(w.flags['sys.deliver.lantern']);
  const again = drive('the-relighting', w);
  assert.equal(again.writes.filter(([kind]) => kind === 'give').length, 0);
});

test('the Reading posts seven two-turn phases and supports both free extensions before Accept', () => {
  assert.equal(READING_PHASES.length, 7);
  assert.equal(READING_PHASES.reduce((sum, p) => sum + p.turns, 0), 14);
  const r = drive('the-reading', fresh(), [1, 2, 0]);
  const battles = r.requests.filter((op) => op.op === 'startBattle');
  assert.deepEqual(battles.map((op) => op.holdOut), [14, 2, 2]);
  assert.ok(battles.every((op) => op.source === 'reading' && op.wild.speciesId === 'vagary'));
  assert.equal(r.world.flags['sp.reading-done'], true);
  assert.equal(r.writes.some(([kind]) => kind === 'give' || kind === 'spend'), false);
});

test('the coda sends the new reply once and leaves the remaining serial open', () => {
  const r = drive('coda-morning');
  assert.equal(r.world.flags['sys.deliver.saw-the-light'], true);
  assert.ok(r.requests.some((op) => op.op === 'letter' && op.n === 58));
  assert.equal(drive('coda-morning', r.world).requests.length, 0);
});

test('thread-owned set-pieces never advance threads or independently register event triggers', () => {
  const ids = ['ansel-confession', 'ansel-weir-wheel', 'bell-dig', 'tamsin-sails'];
  for (const id of ids) {
    walkOps(STORY_SCRIPTS[id], (op) => assert.notEqual(op.op, 'beat', id));
    assert.equal(EVENT_SCRIPTS.some((e) => e.script === id), false);
  }
});

test('Linnet is absent after her fall and comes home after the Rimeholt meeting', () => {
  const w = fresh(); w.flags['sp.linnet-fell'] = true;
  assert.equal(whereIs(NPCS_BY_ID.linnet, w, data), null);
  w.flags['sp.linnet-returned'] = true;
  assert.ok(whereIs(NPCS_BY_ID.linnet, w, data));
});

test('first-payment event runs once and the legacy dusk id forwards to the real finale', () => {
  const w = fresh();
  assert.equal(scriptFor(w, data, 'loan:tier', { tier: 2 }), 'first-payment');
  w.flags['seen.first-payment'] = true;
  assert.equal(scriptFor(w, data, 'loan:tier', { tier: 2 }), null);
  assert.equal(STORY_SCRIPTS.relighting[0].script, 'the-relighting');
});

test('optional battle and forecast triggers remain available when declined or visited early', () => {
  const repeat = ['linnet-brackenford-before', 'linnet-gate-before', 'corin-first-forecast', 'passenger-perch', 'pip-before', 'wick-long-road-before'];
  for (const id of repeat) for (const t of Object.values(STORY_TRIGGERS).flat().filter((t) => t.script === id)) assert.equal(t.once, false, id);
});
