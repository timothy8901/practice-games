// The merge of Claude's stashed story chapter into the integrated build: new beats are wired, and the
// integrated build's staging and ending order survive the richer writing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORY_SCRIPTS, STORY_TRIGGERS, EVENT_SCRIPTS } from '../js/data/scripts/index.js';
import { SPIRES } from '../js/data/spires.js';
import { MAPS_BY_ID } from '../js/data/maps/index.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { createRegistry } from '../js/data/registry.js';
import { createNewWorld } from '../js/state/schema.js';
import { encodeSeedCode } from '../js/core/rng.js';
import { createRunner } from '../js/script/runner.js';
import { walkOps } from '../js/script/ops.js';
import { scriptFor } from '../js/systems/flow/eventScripts.js';
import { STORY_SCRIPTS as ENDING_STEPS } from '../js/scenes/ending.js';

const data = createRegistry({ ...DATA_CONTENT });
const fresh = () => createNewWorld({ seedCode: encodeSeedCode({ seed: 7, dial: 'FLUX', toggles: [] }) });
function drive(id, world = fresh(), picks = []) {
  const writes = [], requests = [];
  const systems = {
    setFlag(w, key, value = true) { w.flags[key] = value; writes.push(['flag', key, value]); },
    inc(w, key, by = 1) { w.counters[key] = (w.counters[key] ?? 0) + by; },
    give(w, item, n = 1) { writes.push(['give', item, n]); return { ok: true }; },
    take() { return { ok: true }; }, earn(w, n) { w.wallet.main += n; }, spend(w, n) { w.wallet.main -= n; },
    remember() {}, setBeat() { throw new Error('a story scene must not advance a thread'); },
  };
  const runner = createRunner(STORY_SCRIPTS[id], { world, data, scriptId: id, systems, mapId: world.player.mapId });
  let r = runner.step();
  while (!r.done) {
    requests.push(r);
    if (requests.length > 600) throw new Error(`unbounded: ${id}`);
    r = runner.step(r.op === 'choice' ? (picks.shift() ?? 0) : r.op === 'startBattle' ? { outcome: 'win' } : undefined);
  }
  return { world, requests, writes };
}

test('each Spire has a first-entry beat on its arrival cell and a badge beat on its own badge event', () => {
  const triggers = Object.entries(STORY_TRIGGERS).flatMap(([mapId, rows]) => rows.map((t) => ({ mapId, ...t })));
  for (const s of SPIRES) {
    const enter = triggers.find((t) => t.script === `story-spire-${s.id}-enter`);
    assert.ok(enter, s.id);
    assert.equal(enter.mapId, s.map);
    assert.equal(enter.kind, 'enter');
    assert.equal(enter.once, true);
    const entry = MAPS_BY_ID[s.map].entry;
    assert.deepEqual({ x: enter.x, y: enter.y }, { x: entry.x, y: entry.y }, `${s.id}: the door lands on the trigger`);
    assert.equal(scriptFor(fresh(), data, 'badge:won', { spireId: s.id }), `story-spire-${s.id}-badge`);
  }
});

test('badge beats hand over each reader tool once', () => {
  const tools = { weather: 'scouting-prism', relay: 'weatherglass', mirror: 'disc-plumbline' };
  for (const [spire, item] of Object.entries(tools)) {
    const r = drive(`story-spire-${spire}-badge`);
    assert.deepEqual(r.writes.filter(([k]) => k === 'give').map(([, i]) => i), [item], spire);
  }
  const weather = drive('story-spire-weather-badge');
  const warp = weather.requests.find((q) => q.op === 'warp');
  assert.equal(warp.mapId, 'emberstep', 'Corin waits outside the Weather Spire');
});

test('new event rows: the first Forecast anywhere, and one dark house a night after the credits', () => {
  const w = fresh();
  assert.equal(scriptFor(w, data, 'shift:resolved', { uid: 'c1' }), 'story-first-forecast-noted');
  w.flags['sp.first-forecast'] = true;
  assert.equal(scriptFor(w, data, 'shift:resolved', { uid: 'c1' }), null);
  const late = fresh();
  Object.assign(late.flags, { 'lit.fleetHome': true, 'sp.credits-seen': true, 'seen.dark-house-reopens': true });
  assert.equal(scriptFor(late, data, 'clock:hour', { hour: 20 }), 'dark-house-reopens', 'repeats nightly');
  late.counters['sys.dark-houses-reopened'] = 7;
  assert.equal(scriptFor(late, data, 'clock:hour', { hour: 20 }), null, 'seven houses, then it stops');
  const lit = [];
  const w2 = fresh();
  for (let night = 0; night < 7; night++) {
    const r = drive('dark-house-reopens', w2);
    lit.push(...r.writes.filter(([k, id, v]) => k === 'flag' && id.startsWith('sys.porch.') && v === true).map(([, id]) => id));
  }
  assert.deepEqual(lit, [2, 3, 4, 5, 6, 7, 8].map((n) => `sys.porch.porch-dark-${n}`));
});

test('the ending director keeps the order: no story script calls the next finale beat itself', () => {
  const finale = new Set(Object.values(ENDING_STEPS));
  for (const [id, ops] of Object.entries(STORY_SCRIPTS)) {
    walkOps(ops, (op) => { if (op.op === 'call') assert.ok(!finale.has(op.script), `${id} calls ${op.script}`); });
  }
});

test('thread set-pieces never set thread flags', () => {
  for (const id of ['ansel-confession', 'ansel-weir-wheel', 'bell-dig', 'tamsin-sails']) {
    const r = drive(id);
    assert.deepEqual(r.writes.filter(([k, f]) => k === 'flag' && /^(th\.|sp\.(ansel-confessed|weir-turned|bell-dug|tamsin-sailed))/.test(f)), [], id);
  }
});

/**
 * Event-queued scenes may start on any map (HP-008): no actor teleport or camera cell before the
 * scene has established its map, except inside a `{map}` guard.
 */
function stagingProblems(list, established, out, id) {
  for (const raw of list) {
    if (typeof raw === 'string') continue;
    const op = raw;
    if (op.op === 'warp') established = true;
    if (!established && op.op === 'teleport' && op.who !== 'player') out.push(`${id}: teleport ${op.who} before the map is set`);
    if (!established && op.op === 'camera' && Array.isArray(op.to)) out.push(`${id}: camera before the map is set`);
    if (op.op === 'if') {
      const guard = Boolean(op.cond && op.cond.map);
      stagingProblems(op.then ?? [], established || guard, out, id);
      stagingProblems(op.else ?? [], established, out, id);
      const notMap = op.cond && op.cond.not && op.cond.not.map;
      if (notMap && (op.then ?? []).some((o) => o && o.op === 'warp' && o.mapId === notMap)) established = true;
    }
    if (op.op === 'choice') for (const o of op.options ?? []) stagingProblems(o.then ?? [], established, out, id);
    if (op.op === 'branch') for (const b of Object.values(op.cases ?? {})) stagingProblems(b, established, out, id);
  }
  return out;
}

test('event-queued story scenes establish their map before staging anyone', () => {
  // corin-reading-glass is chained from wick-keeper on the porch; its event row is a fallback only.
  const exempt = new Set(['corin-reading-glass']);
  const ids = [...new Set(EVENT_SCRIPTS.map((e) => e.script))].filter((id) => STORY_SCRIPTS[id] && !exempt.has(id));
  assert.ok(ids.length > 20);
  const problems = ids.flatMap((id) => stagingProblems(STORY_SCRIPTS[id], false, [], id));
  assert.deepEqual(problems, []);
});

test('a market night that starts away from Pellwick warps home first; Linnet falls only once', () => {
  const w = fresh(); w.player.mapId = 'lowmoor'; w.badges.push('turn', 'ward');
  const r = drive('first-lantern-market', w);
  assert.equal(r.requests.find((q) => q.op === 'warp' || q.op === 'teleport').op, 'warp');
  assert.equal(r.world.flags['sp.linnet-fell'], true);
  assert.equal(scriptFor(r.world, data, 'clock:hour', { hour: 21 }) === 'linnet-fall', false);
});

test('Act IV opens once, whichever of the charges or the Lamp Room comes first', () => {
  const a = drive('charges-pulled');
  const b = drive('lamp-room-built', a.world);
  const toasts = [...a.requests, ...b.requests].filter((q) => q.op === 'toast' && /IV/.test(q.text));
  assert.equal(toasts.length, 1);
  assert.equal(b.world.flags['sp.act-4'], true);
});
