// Regressions from the static verification of the content merge (Claude's stashed cast/story
// writing merged into the integrated build):
//  - every NPC line pool is reachable by the live resolver (js/script/registry.js), so merged
//    situation pools (Corin's and Linnet's `act`, Wick's `market`, Ansel's `creek`, Tully's
//    `nickname` / `declined`, Hesper's `letters`) are not dead text;
//  - Wick's market-night line holds on Saturday night only (not Sunday evening);
//  - every line of every script and NPC pool fits one dialogue page at normal text size
//    (scenes/dialogue.pagesFor), as every line of the integrated build did before the merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DATA_CONTENT } from '../js/data/content.js';
import { createRegistry } from '../js/data/registry.js';
import { resolveScript, CONTEXT_POOLS } from '../js/script/registry.js';
import { parseShorthand, subBlocks } from '../js/script/ops.js';
import { evalCond } from '../js/script/cond.js';
import { createNewWorld } from '../js/state/schema.js';
import { PHASES } from '../js/core/time.js';
import { pagesFor } from '../js/scenes/dialogue.js';
import { POSES } from '../tools/validate-data.mjs';
import * as sel from '../js/state/selectors.js';

const data = createRegistry(DATA_CONTENT);
const npcIds = new Set(DATA_CONTENT.npcs.map((n) => n.id));

function world(minute = 14 * 60, day = 5) {
  const w = createNewWorld({ seedCode: 'FLUX-4KNZ-CH4G' });
  w.clock.total = day * 1440 + minute;
  return w;
}
/** The first core day >= `from` whose weekday (0 = Monday) is `dow`. */
function dayWith(dow, from = 3) {
  for (let d = from; d < from + 7; d++) if (sel.dayOfWeek(world(0, d)) === dow) return d;
  throw new Error('no such day');
}
const noTopics = (w, id) => {
  const npc = data.get('npcs', id);
  w.npcs[id] = { ...(w.npcs[id] ?? {}), saidLines: Object.fromEntries((npc.topics ?? []).map((t) => [t.id, sel.day(w)])) };
  if (npc.threadId) w.threads[npc.threadId] = { beat: 99, done: true };
};

test('every NPC line pool is one the resolver can reach (pose, porch, phase, context or generic)', () => {
  const reachable = new Set(['generic', 'porch', ...PHASES, ...CONTEXT_POOLS, ...POSES]);
  const dead = [];
  for (const npc of DATA_CONTENT.npcs) for (const pool of Object.keys(npc.lines ?? {})) if (!reachable.has(pool)) dead.push(`${npc.id}.${pool}`);
  assert.deepEqual(dead, []);
});

test('a merged situation pool reaches the player: Corin on Linnet\'s dark porch', () => {
  const w = world();
  noTopics(w, 'corin');
  w.flags['sp.linnet-fell'] = true;
  const r = resolveScript(w, data, { kind: 'npc', id: 'corin', mapId: 'pellwick' });
  assert.equal(r.lineId, 'a1', JSON.stringify(r));
});

test('Wick\'s market-night line holds on Saturday night, not on Sunday evening', () => {
  const mk1 = data.get('npcs', 'wick').lines.market.find((l) => l.id === 'mk1');
  const holds = (day, minute) => evalCond(world(minute, day), mk1.cond, { data });
  const sat = dayWith(5), sun = dayWith(6);
  assert.equal(holds(sat, 21 * 60), true, 'Saturday 21:00');
  assert.equal(holds(sun, 1 * 60), true, 'the market runs to 02:00 Sunday');
  assert.equal(holds(sun, 21 * 60), false, 'Sunday 21:00 is not market night');
  assert.equal(holds(dayWith(4), 21 * 60), false, 'Friday 21:00');
});

test('every script line and NPC line fits one dialogue page at normal text size', () => {
  const long = [];
  const check = (where, raw) => {
    const op = typeof raw === 'string' ? parseShorthand(raw, (id) => npcIds.has(id)) : raw;
    if (!op || typeof op !== 'object') return;
    const texts = [];
    if (op.op === 'say' && typeof op.text === 'string') texts.push([op.text, !op.who]);
    if (op.op === 'choice' && typeof op.prompt === 'string') texts.push([parseShorthand(op.prompt).text, true]);
    for (const [text, narration] of texts) {
      if (pagesFor(text.replace(/\{(player|npcNick|nick:[^}]+)\}/g, 'Wwwwwwwwww'), narration).length > 1) long.push(`${where}: ${text.slice(0, 60)}`);
    }
    for (const b of subBlocks(op)) for (const o of b) check(where, o);
  };
  for (const [id, ops] of Object.entries(DATA_CONTENT.scripts)) for (const o of ops ?? []) check(id, o);
  for (const npc of DATA_CONTENT.npcs) for (const [pool, rows] of Object.entries(npc.lines ?? {})) {
    for (const l of rows ?? []) {
      const text = typeof l === 'string' ? l : l?.text;
      if (typeof text === 'string' && pagesFor(text, text.startsWith('*')).length > 1) long.push(`${npc.id}.${pool}: ${text.slice(0, 60)}`);
    }
  }
  assert.deepEqual(long, []);
});

test('a neighbour\'s first talk recalls the porch-row meeting only when it was that neighbour', () => {
  // meet-neighbors meets Odile, Thessaly or Bryony (one per trigger); `seen: meet-neighbors` would make
  // all three say "you again" after meeting any one of them.
  for (const id of ['odile', 'thessaly', 'bryony']) {
    const first = DATA_CONTENT.scripts[`talk-${id}-first`][0];
    assert.deepEqual(first.cond, { flag: `np.${id}.met-step` }, id);
  }
});

test('actors staged after a warp stand on a walkable cell of that map (no one inside a mailbox or a wall)', async () => {
  const { MAPS_BY_ID } = await import('../js/data/maps/index.js');
  const { snapshot, walkable, highWater, lowsOf } = await import('../tools/map-reachability.mjs');
  const snaps = [snapshot(highWater(3), {}), snapshot(lowsOf(3).lower, {}), snapshot(highWater(3), { 'lit.bar': true, 'sp.summit-open': true })];
  const propCell = (mapId, x, y) => Object.values(MAPS_BY_ID[mapId]?.markers ?? {}).some((m) => m.x === x && m.y === y && (m.onSolid || m.water));
  const bad = [];
  const walk = (id, ops, map) => {
    for (const raw of ops ?? []) {
      if (!raw || typeof raw !== 'object') continue;
      if (raw.op === 'warp' && raw.mapId) map = raw.mapId;
      if (raw.op === 'teleport' && map && raw.who !== 'player' && Number.isInteger(raw.x) && !propCell(map, raw.x, raw.y)
        && !snaps.some((s) => walkable(s, map, raw.x, raw.y))) bad.push(`${id}: ${raw.who} at ${map} (${raw.x},${raw.y})`);
      if (raw.op === 'if') { walk(id, raw.then, raw.cond?.map ?? map); walk(id, raw.else, map); }
      else for (const b of subBlocks(raw)) walk(id, b, map);
    }
  };
  // a script fired by story triggers on exactly one map starts on that map
  const { STORY_TRIGGERS } = await import('../js/data/scripts/index.js');
  const homes = {};
  for (const [mapId, rows] of Object.entries(STORY_TRIGGERS)) for (const r of rows) (homes[r.script] ??= new Set()).add(mapId);
  for (const [id, ops] of Object.entries(DATA_CONTENT.scripts)) walk(id, ops, homes[id]?.size === 1 ? [...homes[id]][0] : null);
  assert.deepEqual(bad, []);
});

test('a Spire\'s first-entry welcome is skipped for a save that already holds that badge', async () => {
  const { STORY_TRIGGERS } = await import('../js/data/scripts/index.js');
  const { SPIRES } = await import('../js/data/spires.js');
  for (const s of SPIRES) {
    const row = STORY_TRIGGERS[s.map].find((t) => t.script === `story-spire-${s.id}-enter`);
    const w = world();
    assert.equal(evalCond(w, row.cond, { data }), true, `${s.id}: fresh`);
    w.badges.push(s.id);
    assert.equal(evalCond(w, row.cond, { data }), false, `${s.id}: badge held`);
  }
});

// Browser verification of the merge: a pool line written `* ...` (narration, as in script shorthand)
// reached the dialogue box with its literal asterisk (Corin's `sit` line at the loft desk).
test('a `* ` pool line resolves to narration without the asterisk (Corin at the loft desk)', () => {
  const w = world(11 * 60, dayWith(0));
  noTopics(w, 'corin');
  const sit = data.get('npcs', 'corin').lines.sit.find((l) => l.text.startsWith('* '));
  assert.ok(sit, 'corin has a narrated sit line');
  const r = resolveScript(w, data, { kind: 'npc', id: 'corin', mapId: 'int-archive', pose: 'sit' });
  const say = r.ops.find((o) => o.op === 'say');
  assert.ok(say && !say.text.startsWith('*'), JSON.stringify(r));
  assert.equal(r.lineId, sit.id);
  assert.equal(say.text, sit.text.slice(2));
  assert.equal(say.who, null, 'narration says so, so the runner never gives it the NPC tab (MID-16)');
});
