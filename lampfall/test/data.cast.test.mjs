// The cast merge (GDD-06; GDD-00 §10): the integrated build's wiring kept, Claude's authored depth
// brought in. Every resident is somewhere standable every half-hour of two weeks in four story
// scenarios; every topic and talk script the cast owns dry-runs on every choice branch through the real
// script runner with a stub host; ids, porches, threads and duel wiring match what the rest of the
// game references.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { auditCast, linesOf } from './fixtures/castAudit.mjs';
import { DATA_CONTENT } from '../js/data/content.js';
import { createRegistry } from '../js/data/registry.js';
import { NPCS_BY_ID, NPC_SCRIPTS } from '../js/data/npcs/index.js';
import { THREAD_BY_NPC } from '../js/data/threads/index.js';
import { SCHEDULES } from '../js/data/schedules.js';
import { createRunner } from '../js/script/runner.js';
import { validateOps, walkOps } from '../js/script/ops.js';
import { validateCond } from '../js/script/cond.js';
import { createNewWorld } from '../js/state/schema.js';
import { FLAG_IDS, NPC_IDS } from '../js/data/ids.manifest.js';
import { POSES } from '../tools/validate-data.mjs';

const data = createRegistry(DATA_CONTENT);
const MERGED = ['ansel', 'wick', 'tully', 'odile', 'bryony', 'thessaly', 'tamsin', 'corin', 'linnet'];
const RESIDENTS = DATA_CONTENT.npcs.filter((n) => n.group === 'resident').map((n) => n.id);

// ---------------------------------------------------------------------------------------------
// where everyone is
// ---------------------------------------------------------------------------------------------

test('cast audit: every resident is somewhere standable every half-hour of two weeks, every line bar met', () => {
  const { problems, checked } = auditCast();
  assert.deepEqual(problems, []);
  assert.ok(checked > 100000, `${checked} placements`);
});

test('the sixteen scheduled residents of GDD-00 §10', () => {
  assert.deepEqual(RESIDENTS.slice().sort(), ['ambrose', 'ansel', 'augusta', 'barnaby', 'bryony', 'corin', 'hesper', 'juniper', 'linnet', 'ludo',
    'odile', 'tamsin', 'thessaly', 'tully', 'wick', 'wren']);
  assert.equal(DATA_CONTENT.npcs.length, NPC_IDS.length);
});

test('schedules: HEAD loop ids kept, the merged loops and templates resolve, every path entry names a path', () => {
  const ids = SCHEDULES.map((s) => s.id);
  for (const id of ['tully-flats-lap', 'augusta-porch-count', 'corin-night-round', 'wick-errand-run', 'pip-bollards', 'hobb-tide-round',
    'teal-poling-round', 'brannoch-lamp-round', 'isle-post', 'isle-post-late']) assert.ok(ids.includes(id), id);
  const paths = new Set(SCHEDULES.filter((s) => s.kind === 'path').map((s) => s.id));
  const templates = new Set(SCHEDULES.filter((s) => s.kind === 'template').map((s) => s.id));
  for (const npc of DATA_CONTENT.npcs) {
    for (const e of npc.schedule) {
      if (e.pose === 'path') assert.ok(paths.has(e.path), `${npc.id}: path '${e.path}'`);
      assert.ok(e.pose === undefined || POSES.includes(e.pose), `${npc.id}: pose ${e.pose}`);
    }
    for (const t of npc.templates ?? []) assert.ok(templates.has(t.id), `${npc.id}: template '${t.id}'`);
  }
});

// ---------------------------------------------------------------------------------------------
// the integrated build's wiring, kept
// ---------------------------------------------------------------------------------------------

test('merged residents keep thread ids, porch ids and lit porches from the integrated build', () => {
  for (const id of MERGED) assert.equal(NPCS_BY_ID[id].threadId, THREAD_BY_NPC[id] ?? null, id);
  const porchOf = Object.fromEntries(MERGED.map((id) => [id, NPCS_BY_ID[id].porch?.id ?? null]));
  assert.deepEqual(porchOf, { ansel: 'porch-wardens-house', wick: 'porch-dorrow', tully: 'porch-tully', odile: 'porch-odile', bryony: 'porch-bryony',
    thessaly: 'porch-thessaly', tamsin: 'porch-dark-1', corin: 'porch-archive', linnet: 'porch-linnet' });
  for (const id of ['ansel', 'tully', 'corin', 'linnet']) assert.equal(NPCS_BY_ID[id].porch.litAtStart, true, id);
  for (const id of ['wick', 'odile', 'bryony', 'thessaly', 'tamsin']) assert.notEqual(NPCS_BY_ID[id].porch.litAtStart, true, id);
  // Augusta's row stays the canonical porch-wardens-house row (porchesOf keeps the first).
  assert.ok(NPC_IDS.indexOf('augusta') < NPC_IDS.indexOf('ansel'));
  assert.equal(NPCS_BY_ID.ansel.homeSpot.marker, 'ansel-launch', 'GDD-00 §10: Ansel lives in the beached launch');
});

test('merged residents keep the story topics the integrated build wired', () => {
  const topicScript = (npc, tid) => NPCS_BY_ID[npc].topics.find((t) => t.id === tid)?.script;
  assert.equal(topicScript('ansel', 'tells'), 'ansel-fishing-tells');
  assert.equal(topicScript('wick', 'errands'), 'wick-errands');
  assert.equal(topicScript('tully', 'nickname'), 'tully-nickname');
  assert.equal(topicScript('corin', 'glass'), 'corin-reading-glass');
  assert.equal(topicScript('corin', 'stance'), 'corin-capture-stance');
  assert.equal(topicScript('corin', 'first-forecast'), 'corin-first-forecast');
  assert.equal(topicScript('corin', 'ninth-spire'), 'ninth-spire-ask');
  assert.equal(topicScript('linnet', 'rematch'), 'linnet-brackenford-before');
  assert.equal(topicScript('linnet', 'decline'), 'linnet-decline');
  // story topics outrank a first-meeting topic so an errand is never shadowed by an introduction
  for (const [npc, tid] of [['ansel', 'tells'], ['wick', 'errands'], ['tully', 'nickname']]) {
    const t = NPCS_BY_ID[npc].topics;
    assert.ok(t.find((x) => x.id === tid).priority > t.find((x) => x.id === 'first').priority, `${npc}:${tid}`);
  }
});

test('Porch Duels: each slate neighbour has talk-<id>-duel against trainer porch-<id>', () => {
  for (const id of ['wick', 'tully', 'odile', 'tamsin', 'linnet']) {
    const t = NPCS_BY_ID[id].topics.find((x) => x.id === 'porch-duel');
    assert.equal(t?.script, `talk-${id}-duel`, id);
    let trainer = null;
    walkOps(NPC_SCRIPTS[`talk-${id}-duel`], (op) => { if (op.op === 'startBattle') trainer = op.trainer; });
    assert.equal(trainer, `porch-${id}`, id);
    assert.ok(data.has('trainers', trainer), trainer);
  }
});

test('topic ids are unique per resident and never collide with a line id (both live in saidLines)', () => {
  for (const npc of DATA_CONTENT.npcs) {
    const topics = (npc.topics ?? []).map((t) => t.id);
    assert.equal(new Set(topics).size, topics.length, npc.id);
    const lineIds = new Set();
    for (const l of linesOf(npc)) { assert.ok(!lineIds.has(l.id), `${npc.id}: duplicate line id ${l.id}`); lineIds.add(l.id); }
    for (const t of topics) assert.ok(!lineIds.has(t), `${npc.id}: topic '${t}' shares an id with a line`);
  }
});

test('lines the live resolver picks without reading conds (generic, porch, phase, pose pools) carry no story cond', () => {
  const blind = ['generic', 'porch', 'night', 'dawn', 'morning', 'midday', 'afternoon', 'dusk', 'evening', ...POSES];
  const phaseCond = { morning: { hour: [6, 11] }, evening: { hour: [18, 22] }, night: { hour: [22, 6] } };
  const bad = [];
  for (const npc of DATA_CONTENT.npcs) {
    for (const [pool, list] of Object.entries(npc.lines ?? {})) {
      if (!blind.includes(pool)) continue;
      for (const l of list) if (l.cond !== undefined && JSON.stringify(l.cond) !== JSON.stringify(phaseCond[pool])) bad.push(`${npc.id}.${pool}.${l.id}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('Corin and Linnet carry the main-resident tags: morning, evening, night, porch, rain', () => {
  for (const id of ['corin', 'linnet']) {
    const npc = NPCS_BY_ID[id];
    const tags = new Set(linesOf(npc).flatMap((l) => l.tags ?? []));
    for (const pool of ['morning', 'evening', 'night', 'porch']) assert.ok((npc.lines[pool] ?? []).length >= 2, `${id}.${pool}`);
    assert.ok(tags.has('weather:rain'), `${id} rain`);
    assert.ok(linesOf(npc).length >= 30, `${id}: ${linesOf(npc).length}`);
  }
});

test('every cond the cast names validates, every seen id is a script, every gift is an item or collection', () => {
  const items = new Set([...DATA_CONTENT.items.map((i) => i.id), ...DATA_CONTENT.collections.map((c) => c.id)]);
  const has = (t, id) => data.has(t, id);
  const seen = [];
  const collect = (c) => {
    if (!c || typeof c !== 'object') return;
    if (typeof c.seen === 'string') seen.push(c.seen);
    for (const k of ['all', 'any']) if (Array.isArray(c[k])) c[k].forEach(collect);
    if (c.not) collect(c.not);
  };
  for (const npc of DATA_CONTENT.npcs) {
    const conds = [npc.absent, ...(npc.topics ?? []).map((t) => t.cond), ...npc.schedule.map((e) => e.cond), ...linesOf(npc).map((l) => l.cond)];
    for (const c of conds) {
      if (c === undefined || typeof c === 'boolean') continue;
      assert.deepEqual(validateCond(c, { has }), [], `${npc.id}: ${JSON.stringify(c)}`);
      collect(c);
    }
    for (const list of Object.values(npc.gifts ?? {})) for (const id of list) assert.ok(items.has(id), `${npc.id}: gift ${id}`);
    for (const l of npc.lines?.gift ?? []) assert.ok(items.has(l.id.replace(/^gift-/, '')), `${npc.id}: ${l.id}`);
  }
  for (const id of seen) assert.ok(data.has('scripts', id), `seen '${id}'`);
  const spFlags = new Set(FLAG_IDS);
  for (const npc of DATA_CONTENT.npcs) for (const t of npc.topics ?? []) {
    JSON.stringify(t.cond ?? {}).replace(/"flag":"(sp\.[a-z0-9-]+)"/g, (_, f) => { assert.ok(spFlags.has(f), `${npc.id}: ${f}`); return ''; });
  }
});

// ---------------------------------------------------------------------------------------------
// every cast script dry-runs on every choice branch
// ---------------------------------------------------------------------------------------------

function fakeSystems() {
  return {
    give() { return { ok: true }; }, take() { return { ok: true }; }, earn() {}, spend() {},
    remember() {}, addCreature(w, spec) { w.party.push({ uid: `c${w.party.length + 1}`, speciesId: spec.species, nickname: spec.nick ?? spec.species }); },
    setBeat(w, id, beat) { const t = (w.threads[id] ??= { beat: 0, done: false, startedDay: 0, lastAdvancedDay: 0 }); t.beat = beat ?? t.beat + 1; },
  };
}

function worldFor(scenario) {
  const w = createNewWorld({ seedCode: 'FLUX-4KNZ-CH4G' });
  w.player.name = 'Sorrel';
  if (scenario === 'late') {
    for (const f of FLAG_IDS) if (f.startsWith('sp.')) w.flags[f] = true;
    for (const npc of DATA_CONTENT.npcs) w.npcs[npc.id] = { met: true, talks: 20, nickname: 'Lampy', lastTalkDay: 0, lastPorchDay: null, affinity: 0, favours: [], saidLines: {}, remembered: {} };
    for (const th of DATA_CONTENT.threads) w.threads[th.id] = { beat: th.beats.length, done: true, startedDay: 0, lastAdvancedDay: 0 };
  }
  return w;
}

const ANSWERS = { nickname: ['Lampy', null], startBattle: [{ won: true }, { blackout: true }], take: [true, false], forecast: [null] };

/**
 * Runs `scriptId` along every answer path (choices, nickname, battle results); returns the problems.
 * @returns {{problems: string[], paths: number}}
 */
function dryRun(scriptId, npcId, scenario) {
  const problems = [];
  const queue = [[]];
  let paths = 0;
  while (queue.length && paths < 400) {
    const answers = queue.shift();
    paths++;
    const w = worldFor(scenario);
    const r = createRunner(data.get('scripts', scriptId), { world: w, data, systems: fakeSystems(), npc: npcId, mapId: 'pellwick', scriptId });
    let k = 0;
    let res;
    const seenChoice = new Map();
    try {
      res = r.step();
      let steps = 0;
      while (!res.done) {
        if (++steps > 500) { problems.push(`${scriptId} (${scenario}): runaway after 500 requests`); break; }
        if (res.op === 'say' && !(typeof res.text === 'string' && res.text.trim())) problems.push(`${scriptId}: empty say`);
        const branching = res.op === 'choice' ? res.options.map((_, i) => i) : (res.op === 'take' && !res.ask) ? null : ANSWERS[res.op];
        const sig = res.op === 'choice' ? `${res.prompt ?? ''}|${res.options.map((o) => o.text).join('|')}` : null;
        const again = sig !== null && (seenChoice.get(sig) ?? 0) > 0;
        if (sig !== null) seenChoice.set(sig, (seenChoice.get(sig) ?? 0) + 1);
        if (again) {
          // a choice met again on this path (a loop such as Maud's reroll table): walk its options in turn, no new branches
          res = r.step((seenChoice.get(sig) - 1) % branching.length);
        } else if (branching) {
          if (k < answers.length) res = r.step(branching[answers[k++]]);
          else { for (let i = 1; i < branching.length; i++) queue.push([...answers, i]); answers.push(0); k++; res = r.step(branching[0]); }
        } else res = r.step();
      }
    } catch (e) {
      problems.push(`${scriptId} (${scenario}, answers ${JSON.stringify(answers)}): ${e.message}`);
    }
  }
  return { problems, paths };
}

test('every cast talk script and topic script validates and dry-runs on every branch (fresh and late worlds)', () => {
  const owned = new Map(Object.keys(NPC_SCRIPTS).map((id) => [id, id.match(/^talk-([a-z-]+?)-/)?.[1] ?? null]));
  for (const npc of DATA_CONTENT.npcs) for (const t of npc.topics ?? []) owned.set(t.script, npc.id);
  const problems = [];
  let paths = 0;
  for (const [id, npcId] of owned) {
    assert.ok(data.has('scripts', id), `script ${id}`);
    const v = validateOps(data.get('scripts', id), { scriptId: id, has: (t, x) => data.has(t, x), isNpcId: (x) => data.has('npcs', x),
      validateCond: (c) => validateCond(c, { has: (t, x) => data.has(t, x) }) });
    problems.push(...v.errors);
    const who = npcId && data.has('npcs', npcId) ? npcId : null;
    for (const scenario of ['fresh', 'late']) { const r = dryRun(id, who, scenario); problems.push(...r.problems); paths += r.paths; }
  }
  assert.deepEqual(problems, []);
  assert.ok(owned.size >= 100, `${owned.size} scripts`);
  assert.ok(paths >= owned.size * 2, `${paths} paths`);
});
