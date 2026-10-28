// js/script/runner.js: the resumable script coroutine (§6.2), driven by a fake host that records
// every yielded host op and answers from a list, over a real world with fake system bindings.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRunner, interpolate, runWithFakeHost } from '../js/script/runner.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';
import { createNewWorld } from '../js/state/schema.js';
import { encodeSeedCode } from '../js/core/rng.js';
import { createBus } from '../js/core/events.js';

const SCRIPTS = {
  ...DATA.scripts,
  'helper': ['Helper line.', { op: 'give', item: 'ph-lantern', n: 1 }, { op: 'end' }, 'never said'],
  'helper-ask': [{ op: 'wait', ms: 5 }, 'In the helper.', { op: 'setFlag', id: 'sp.helped' }],
  'outer': ['Before.', { op: 'call', script: 'helper-ask' }, 'After.', { op: 'end' }],
  'lost': ['You blacked out.', { op: 'setFlag', id: 'sp.lost' }],
};
const data = createRegistry({ ...DATA, scripts: SCRIPTS });

function newWorld() {
  const w = createNewWorld({ seedCode: encodeSeedCode({ dial: 'FREEFALL', seed: 11, toggles: [] }) });
  w.player.name = 'Ada';
  return w;
}

/** Fake bindings that apply the obvious rule to the real world and log every call. */
function fakeSystems(log = []) {
  const stack = (w, item) => w.bag.pockets.medicine.find((s) => s.id === item);
  return {
    log,
    give(w, item, n) { log.push(['give', item, n]); const s = stack(w, item); if (s) s.n += n; else w.bag.pockets.medicine.push({ id: item, n }); return { ok: true }; },
    take(w, item, n) {
      log.push(['take', item, n]);
      const s = stack(w, item);
      if (!s || s.n < n) return { ok: false };
      s.n -= n;
      if (s.n === 0) w.bag.pockets.medicine.splice(w.bag.pockets.medicine.indexOf(s), 1);
      return { ok: true };
    },
    earn(w, a) { log.push(['earn', a]); w.wallet.main += a; },
    spend(w, a) { log.push(['spend', a]); w.wallet.main -= a; },
    setBeat(w, id, beat) { log.push(['beat', id, beat]); const t = (w.threads[id] ??= { beat: 0, done: false, startedDay: 0, lastAdvancedDay: 0 }); t.beat = beat ?? t.beat + 1; },
    remember(w, npc, key, value) { log.push(['remember', npc, key, value]); },
    addCreature(w, spec) { log.push(['addCreature', spec.species, spec.level, spec.nick]); w.party.push({ uid: `c${w.party.length + 1}`, speciesId: spec.species, nickname: spec.nick ?? spec.species }); },
  };
}

/**
 * Drives a runner to completion. `answers` is consumed in order by requests that take an answer
 * (choice, take ask, nickname, forecast, startBattle); everything else is answered `undefined`.
 */
function drive(runner, answers = [], max = 200) {
  const queue = answers.slice();
  const requests = [];
  let res = runner.step();
  while (!res.done) {
    requests.push(res);
    if (requests.length > max) throw new Error('runaway script');
    const needs = ['choice', 'nickname', 'forecast', 'startBattle'].includes(res.op) || (res.op === 'take' && res.ask);
    res = runner.step(needs ? queue.shift() : undefined);
  }
  return requests;
}

const ctxFor = (world, extra = {}) => ({ world, data, systems: fakeSystems(), npc: null, mapId: 'ph-field', ...extra });

test('pure ops run inside the runner; only host ops are yielded', () => {
  const w = newWorld();
  const ctx = ctxFor(w);
  const r = createRunner([{ op: 'setFlag', id: 'sp.a' }, { op: 'inc', id: 'sp.n', by: 2 }, { op: 'earn', amount: 7 }, { op: 'wait', ms: 300 }, { op: 'end' }], ctx);
  const req = r.step();
  assert.deepEqual(req, { id: 1, op: 'wait', ms: 300 });
  assert.equal(w.flags['sp.a'], true);
  assert.equal(w.counters['sp.n'], 2);
  assert.equal(w.wallet.main, 7);
  assert.deepEqual(r.step(), { done: true });
  assert.equal(r.isDone(), true);
  assert.deepEqual(r.step(), { done: true });
});

test('say shorthand: speaker resolved through npc data, text interpolated', () => {
  const w = newWorld();
  const ops = ['ph-keeper: Morning, {player}.', 'PLACEHOLDER Keeper: Hello.', 'Narration only.'];
  const reqs = drive(createRunner(ops, ctxFor(w)));
  assert.deepEqual(reqs.map((q) => [q.op, q.who, q.name, q.text]), [
    ['say', 'ph-keeper', 'PLACEHOLDER Keeper', 'Morning, Ada.'],
    ['say', 'PLACEHOLDER Keeper', 'PLACEHOLDER Keeper', 'Hello.'],
    ['say', null, null, 'Narration only.'],
  ]);
});

test('say defaults its speaker to ctx.npc; the name tab is the npc row name, never the nickname they gave the player (LG-RN117)', () => {
  const w = newWorld();
  w.npcs['ph-keeper'] = { met: true, talks: 1, nickname: 'Kip', lastTalkDay: 0, lastPorchDay: null, affinity: 0, favours: [], saidLines: {}, remembered: {} };
  const [q] = drive(createRunner([{ op: 'say', text: 'Hi {npcNick}' }], ctxFor(w, { npc: 'ph-keeper' })));
  assert.equal(q.who, 'ph-keeper');
  assert.equal(q.name, data.get('npcs', 'ph-keeper').name);
  assert.notEqual(q.name, 'Kip');
  assert.equal(q.text, 'Hi Kip');
});

test('MID-16: a `* ...` line inside an NPC talk stays narration (no speaker, no name tab)', () => {
  const w = newWorld();
  const reqs = drive(createRunner(['* The keeper is mending a net.', 'Plain line.', 'PH Keeper: Named.'], ctxFor(w, { npc: 'ph-keeper' })));
  assert.equal(reqs[0].who, null);
  assert.equal(reqs[0].name, null);
  assert.equal(reqs[0].text, 'The keeper is mending a net.');
  assert.equal(reqs[1].who, 'ph-keeper', 'an unprefixed plain line is the NPC speaking');
});

test('choice with goto: each answer takes its branch (placeholder ph-intro)', () => {
  for (const [answer, expectGive, lastLine] of [[0, true, 'PLACEHOLDER Keeper: Freefall, is it.'], [1, false, 'PLACEHOLDER Keeper: The sticks will wait. The tide will not.']]) {
    const w = newWorld();
    const ctx = ctxFor(w, { scriptId: 'ph-intro' });
    const reqs = drive(createRunner(data.get('scripts', 'ph-intro'), ctx), [answer]);
    const choice = reqs.find((q) => q.op === 'choice');
    assert.deepEqual(choice.options.map((o) => o.index), [0, 1, 2]);   // option 2's cond (not met) holds
    assert.equal(choice.defaultIndex, 1);
    assert.equal(ctx.systems.log.some((l) => l[0] === 'give'), expectGive);
    assert.equal(w.flags['sp.ph-met'] === true, expectGive);
    if (expectGive) {
      assert.ok(reqs.some((q) => q.op === 'move' && q.who === 'ph-keeper' && q.path === 'LLU'));
      assert.deepEqual(ctx.systems.log.find((l) => l[0] === 'beat'), ['beat', 'ph-thread', 1]);
    }
    const says = reqs.filter((q) => q.op === 'say').map((q) => `${q.name}: ${q.text}`);
    assert.equal(says[says.length - 1], lastLine);
    assert.equal(w.flags['seen.ph-intro'], true);                        // finishing marks the script seen
  }
});

test('choice options filtered by cond keep the author index; then-blocks run and fall through', () => {
  const w = newWorld();
  w.flags['sp.vip'] = true;
  const ops = [
    { op: 'choice', prompt: 'Pick, {player}', options: [
      { text: 'Hidden', cond: { not: { flag: 'sp.vip' } }, goto: 'x' },
      { text: 'Shown', then: ['Inside then.', { op: 'setFlag', id: 'sp.then' }] },
      { text: 'Also' },
    ], defaultIndex: 2 },
    'After choice.',
    { op: 'label', id: 'x' },
  ];
  const ctx = ctxFor(w);
  const r = createRunner(ops, ctx);
  const choice = r.step();
  assert.equal(choice.prompt, 'Pick, Ada');
  assert.deepEqual(choice.options, [{ text: 'Shown', index: 1 }, { text: 'Also', index: 2 }]);
  assert.equal(choice.defaultIndex, 1);                                 // author default 2 is shown at 1
  assert.equal(r.step(0).text, 'Inside then.');
  assert.equal(r.step().text, 'After choice.');
  assert.equal(w.flags['sp.then'], true);
  assert.equal(r.vars._choice, 1);
  assert.deepEqual(r.step(), { done: true });
});

test('choice: no answer takes the default; an out-of-range answer throws', () => {
  const ops = [{ op: 'choice', options: [{ text: 'a', then: ['A'] }, { text: 'b', then: ['B'] }], defaultIndex: 1 }];
  const r1 = createRunner(ops, ctxFor(newWorld()));
  r1.step();
  assert.equal(r1.step(undefined).text, 'B');
  const r2 = createRunner(ops, ctxFor(newWorld()));
  r2.step();
  assert.throws(() => r2.step(5), /choice answer 5/);
});

test('if / cond picks then or else and resumes after the block', () => {
  for (const [count, expected] of [[1, 'PLACEHOLDER Keeper: Keep that lit.'], [0, 'PLACEHOLDER Keeper: Hm.']]) {
    const w = newWorld();
    if (count) w.bag.pockets.medicine.push({ id: 'ph-lantern', n: count });
    const ops = [{ op: 'if', cond: { hasItem: 'ph-lantern' }, then: ['PLACEHOLDER Keeper: Keep that lit.'], else: ['PLACEHOLDER Keeper: Hm.'] }, 'Done.'];
    const reqs = drive(createRunner(ops, ctxFor(w)));
    assert.deepEqual(reqs.map((q) => q.text), [expected.split(': ')[1], 'Done.']);
  }
  // no else and a false cond: skips straight past
  const reqs = drive(createRunner([{ op: 'if', cond: false, then: ['no'] }, 'yes'], ctxFor(newWorld())));
  assert.deepEqual(reqs.map((q) => q.text), ['yes']);
});

test('nested ifs and wallet conds (placeholder ph-remind)', () => {
  const w = newWorld();
  w.wallet.main = 600;
  const reqs = drive(createRunner(data.get('scripts', 'ph-remind'), ctxFor(w)));
  assert.deepEqual(reqs.map((q) => q.text), ['You could clear a tier today.']);
});

test('branch switches on vars, flags, counters, world paths and falls back to default', () => {
  const ops = [{ op: 'branch', on: 'dial', cases: { freefall: ['ff'], default: ['dflt'] } }];
  assert.equal(drive(createRunner(ops, ctxFor(newWorld())))[0].text, 'ff');
  const w = newWorld(); w.run.dial = 'drift';
  assert.equal(drive(createRunner(ops, ctxFor(w)))[0].text, 'dflt');
  assert.equal(drive(createRunner([{ op: 'branch', on: 'mood', cases: { happy: ['h'] } }, 'x'], ctxFor(newWorld(), { vars: { mood: 'happy' } })))[0].text, 'h');
  const w2 = newWorld(); w2.flags['np.ph-keeper.mood'] = 'cross';
  assert.equal(drive(createRunner([{ op: 'branch', on: 'np.ph-keeper.mood', cases: { cross: ['c'] } }], ctxFor(w2)))[0].text, 'c');
  const w3 = newWorld(); w3.player.tool = 'rod';
  assert.equal(drive(createRunner([{ op: 'branch', on: 'player.tool', cases: { rod: ['r'] } }], ctxFor(w3)))[0].text, 'r');
  assert.deepEqual(drive(createRunner([{ op: 'branch', on: 'none', cases: { a: ['a'] } }, 'z'], ctxFor(newWorld()))).map((q) => q.text), ['z']);
});

test('setFlag defaults to true, accepts values, and forwards the bus', () => {
  const w = newWorld();
  const bus = createBus();
  const seen = [];
  bus.on('flag:set', (p) => seen.push(p.id));
  drive(createRunner([{ op: 'setFlag', id: 'sp.a' }, { op: 'setFlag', id: 'sp.b', value: 3 }], { world: w, data, bus }));
  assert.equal(w.flags['sp.a'], true);
  assert.equal(w.flags['sp.b'], 3);
  assert.deepEqual(seen, ['sp.a', 'sp.b']);
});

test('give / take / earn / spend / addCreature / remember / thread / beat go through ctx.systems', () => {
  const w = newWorld();
  const ctx = ctxFor(w, { npc: 'ph-keeper' });
  drive(createRunner([
    { op: 'give', item: 'ph-lantern', n: 3 }, { op: 'take', item: 'ph-lantern' }, { op: 'earn', amount: 50 }, { op: 'spend', amount: 20 },
    { op: 'addCreature', species: 'ph-pip', level: 5, nick: 'Pip' }, { op: 'remember', npc: 'ph-keeper', key: 'gift', value: 'pear' },
    { op: 'thread', id: 'ph-thread' }, { op: 'beat', thread: 'ph-thread', to: 2 },
  ], ctx));
  assert.deepEqual(w.bag.pockets.medicine, [{ id: 'ph-lantern', n: 2 }]);
  assert.equal(w.wallet.main, 30);
  assert.equal(w.party[0].nickname, 'Pip');
  assert.equal(w.threads['ph-thread'].beat, 2);
  assert.deepEqual(ctx.systems.log.map((l) => l[0]), ['give', 'take', 'earn', 'spend', 'addCreature', 'remember', 'beat', 'beat']);
  assert.deepEqual(ctx.systems.log[6], ['beat', 'ph-thread', null]);    // `thread` without beat = advance one
});

test('take ask yields a request; true takes, false leaves the bag alone', () => {
  for (const [answer, left] of [[true, 1], [false, 2]]) {
    const w = newWorld();
    w.bag.pockets.medicine.push({ id: 'ph-lantern', n: 2 });
    const ctx = ctxFor(w);
    const r = createRunner([{ op: 'take', item: 'ph-lantern', ask: true }, { op: 'if', cond: { hasItem: 'ph-lantern', n: 2 }, then: ['kept'], else: ['gave'] }], ctx);
    const req = r.step();
    assert.equal(req.op, 'take');
    assert.equal(req.ask, true);
    assert.equal(r.step(answer).text, answer ? 'gave' : 'kept');
    assert.equal(w.bag.pockets.medicine[0].n, left);
    assert.equal(r.vars._took, answer);
  }
});

test('an unbound system throws a readable error', () => {
  const r = createRunner([{ op: 'give', item: 'ph-lantern' }], { world: newWorld(), data });
  assert.throws(() => r.step(), /op 'give' needs ctx\.systems\.give/);
});

test('wait, camera, music and other world ops are yielded verbatim with increasing ids', () => {
  const reqs = drive(createRunner([
    { op: 'wait', ms: 250 }, { op: 'camera', to: 'player', ms: 300 }, { op: 'music', track: null, fade: 500 }, { op: 'toast', text: '{wallet} coins' },
  ], ctxFor(newWorld())));
  assert.deepEqual(reqs.map((q) => q.op), ['wait', 'camera', 'music', 'toast']);
  assert.deepEqual(reqs.map((q) => q.id), [1, 2, 3, 4]);
  assert.equal(reqs[0].ms, 250);
  assert.equal(reqs[2].track, null);
  assert.equal(reqs[3].text, '0 coins');
});

test('call runs another script and returns; end inside the callee returns to the caller', () => {
  const ctx = ctxFor(newWorld());
  const reqs = drive(createRunner(['Start.', { op: 'call', script: 'helper' }, 'Back.'], ctx));
  assert.deepEqual(reqs.map((q) => q.text), ['Start.', 'Helper line.', 'Back.']);
  assert.deepEqual(ctx.systems.log, [['give', 'ph-lantern', 1]]);
});

test('end in the root script stops it', () => {
  assert.deepEqual(drive(createRunner(['a', { op: 'end' }, 'b'], ctxFor(newWorld()))).map((q) => q.text), ['a']);
});

test('startBattle: answer stored; a blackout with onLose jumps to a label or calls a script', () => {
  const w = newWorld();
  const r = createRunner([{ op: 'startBattle', trainer: 'ph-rival-1', onLose: 'lose' }, 'Won.', { op: 'end' }, { op: 'label', id: 'lose' }, 'Lost.'], ctxFor(w));
  assert.equal(r.step().trainer, 'ph-rival-1');
  assert.equal(r.step({ blackout: true }).text, 'Lost.');
  assert.deepEqual(r.vars._battle, { blackout: true });
  const w2 = newWorld();
  const reqs = drive(createRunner([{ op: 'startBattle', trainer: 'ph-rival-1', onLose: 'lost' }, 'After.'], ctxFor(w2)), [{ blackout: true }]);
  assert.deepEqual(reqs.slice(1).map((q) => q.text), ['You blacked out.', 'After.']);
  assert.equal(w2.flags['sp.lost'], true);
  const reqs3 = drive(createRunner([{ op: 'startBattle', trainer: 'ph-rival-1', onLose: 'lost' }, 'After.'], ctxFor(newWorld())), [{ blackout: false }]);
  assert.deepEqual(reqs3.slice(1).map((q) => q.text), ['After.']);
});

test('nickname and forecast answers land in vars', () => {
  const r = createRunner([{ op: 'nickname', who: 'c1', offer: 'Name it, {player}?' }, { op: 'forecast', who: 'player:c1' }, 'Hi {var:_nickname}.'], ctxFor(newWorld()));
  assert.equal(r.step().offer, 'Name it, Ada?');
  r.step('Bubbles');
  assert.equal(r.step('ph-pup').text, 'Hi Bubbles.');
  assert.equal(r.vars._forecast, 'ph-pup');
});

test('an infinite goto loop is stopped with a readable error', () => {
  const r = createRunner([{ op: 'label', id: 'top' }, { op: 'goto', id: 'top' }], ctxFor(newWorld()));
  assert.throws(() => r.step(), /infinite goto loop/);
});

test('goto to a missing label and unknown ops fail loudly at run time', () => {
  assert.throws(() => createRunner([{ op: 'goto', id: 'nope' }], ctxFor(newWorld())).step(), /goto 'nope': no such label/);
  assert.throws(() => createRunner([{ op: 'dance' }], ctxFor(newWorld())).step(), /unknown op 'dance'/);
  assert.throws(() => createRunner('x', ctxFor(newWorld())), TypeError);
  assert.throws(() => createRunner([], {}), TypeError);
});

test('resume from serialized state: same pending request, same final world as an uninterrupted run', () => {
  const script = data.get('scripts', 'ph-intro');
  // uninterrupted reference run
  const wA = newWorld();
  const reqsA = drive(createRunner(script, ctxFor(wA, { scriptId: 'ph-intro' })), [0]);
  // interrupted at the `move` request (after the choice), saved through JSON, resumed in a new runner
  const wB = newWorld();
  const ctxB = ctxFor(wB, { scriptId: 'ph-intro' });
  const r1 = createRunner(script, ctxB);
  const seen = [];
  let res = r1.step();
  while (res.op !== 'move') { seen.push(res); res = r1.step(res.op === 'choice' ? 0 : undefined); }
  const saved = JSON.parse(JSON.stringify(r1.save()));
  const r2 = createRunner(script, ctxFor(wB, { scriptId: 'ph-intro' }), saved);
  const again = r2.step();
  assert.equal(again.op, 'move');
  assert.equal(again.path, res.path);
  assert.ok(again.id > res.id, 'request ids stay unique across a resume');
  const tail = [];
  let t = r2.step();
  while (!t.done) { tail.push(t); t = r2.step(); }
  const strip = (q) => ({ ...q, id: 0 });
  assert.deepEqual([...seen, again, ...tail].map(strip), reqsA.map(strip));
  assert.deepEqual(wB.flags, wA.flags);
  assert.deepEqual(wB.bag, wA.bag);
});

test('resume inside a nested block and inside a called script', () => {
  // nested: pending request lives in an if.then block
  const ops = [{ op: 'if', cond: true, then: ['one', { op: 'wait', ms: 1 }, 'two'] }, 'three'];
  const r1 = createRunner(ops, ctxFor(newWorld()));
  r1.step(); const w = r1.step();
  assert.equal(w.op, 'wait');
  const st = JSON.parse(JSON.stringify(r1.save()));
  assert.deepEqual(st.pc, [0, 0, 1]);
  const r2 = createRunner(ops, ctxFor(newWorld()), st);
  assert.equal(r2.step().op, 'wait');
  assert.deepEqual([r2.step().text, r2.step().text], ['two', 'three']);

  // call stack: pending request lives in the callee `helper-ask`
  const world = newWorld();
  const outer = data.get('scripts', 'outer');
  const c1 = createRunner(outer, ctxFor(world, { scriptId: 'outer' }));
  assert.equal(c1.step().text, 'Before.');
  assert.equal(c1.step().op, 'wait');
  const saved = JSON.parse(JSON.stringify(c1.save()));
  assert.equal(saved.top, 'helper-ask');
  assert.equal(saved.callStack.length, 1);
  const c2 = createRunner(outer, ctxFor(world, { scriptId: 'outer' }), saved);
  assert.equal(c2.step().op, 'wait');
  assert.equal(c2.step().text, 'In the helper.');
  assert.equal(c2.step().text, 'After.');
  assert.deepEqual(c2.step(), { done: true });
  assert.equal(world.flags['sp.helped'], true);
  assert.equal(world.flags['seen.outer'], true);
});

test('resume keeps script vars; a pending `save` op resumes after itself', () => {
  const ops = [{ op: 'nickname', who: 'c1' }, { op: 'save', reason: 'cutscene' }, 'Named {var:_nickname}.'];
  const r1 = createRunner(ops, ctxFor(newWorld()));
  r1.step();
  assert.equal(r1.step('Fen').op, 'save');
  const st = JSON.parse(JSON.stringify(r1.save()));
  assert.equal(st.vars._nickname, 'Fen');
  const r2 = createRunner(ops, ctxFor(newWorld()), st);
  assert.equal(r2.step().text, 'Named Fen.');
});

test('a finished runner saves a position that resumes as done', () => {
  const ops = ['a'];
  const r1 = createRunner(ops, ctxFor(newWorld()));
  drive(r1);
  const r2 = createRunner(ops, ctxFor(newWorld()), JSON.parse(JSON.stringify(r1.save())));
  assert.deepEqual(r2.step(), { done: true });
});

test('interpolate fills known tokens and leaves unknown ones visible', () => {
  const w = newWorld();
  w.wallet.main = 42;
  w.party.push({ uid: 'c7', nickname: 'Moss' });
  const ctx = { world: w, data, npc: 'ph-keeper', vars: { n: 3 } };
  assert.equal(interpolate('{player} has {wallet}; {nick:c7}; {npc}; {var:n}; {nick:c9}; {weird}|~', ctx),
    'Ada has 42; Moss; PLACEHOLDER Keeper; 3; {nick:c9}; {weird}|~');
  assert.equal(interpolate('{npc}', { world: w }), '{npc}');
  assert.equal(interpolate(5, ctx), 5);
});

test('runWithFakeHost answers by op name and records requests', () => {
  const w = newWorld();
  const { requests, runner } = runWithFakeHost(data.get('scripts', 'ph-intro'), ctxFor(w), { choice: 1 });
  assert.ok(runner.isDone());
  assert.equal(requests[0].op, 'say');
  assert.equal(requests.filter((q) => q.op === 'choice').length, 1);
  assert.equal(w.flags['sp.ph-met'], undefined);
});

test('every placeholder script runs to completion with a fake host', () => {
  for (const id of Object.keys(DATA.scripts)) {
    const w = newWorld();
    const { runner } = runWithFakeHost(data.get('scripts', id), ctxFor(w, { scriptId: id }), { choice: 0, startBattle: { blackout: false } });
    assert.ok(runner.isDone(), id);
  }
});
