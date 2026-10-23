// Unit tests for js/systems/threads.js (SYS-TOWN). Run: node --test test/systems.threads.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../js/systems/threads.js';
import * as loans from '../js/systems/loans.js';
import { validateWorld, threadStateDefaults } from '../js/state/schema.js';
import { evalCond } from '../js/script/cond.js';
import { createRegistry } from '../js/data/registry.js';
import { makeWorld, makeData, recBus, MIN } from './fixtures/town.fixture.mjs';

const data = makeData();
const meet = (w, ...ids) => { for (const id of ids) w.npcs[id] = { met: true, talks: 1, lastTalkDay: 0, lastPorchDay: -1, nickname: null, affinity: 0, favours: [], saidLines: {}, remembered: {}, gifts: {}, nicknameChoice: null, lastLineId: null, lingerDay: -1, lastGiftDay: -1 }; };
const ids = (list) => list.map((b) => `${b.threadId}:${b.beat}`);
/** A recording stand-in for systems/loans.residentShare. */
const shareSpy = () => {
  const calls = [];
  return { calls, residentShare: (world, threadId, ctx) => { calls.push([threadId, ctx.day]); return { ok: true, credited: 300 }; } };
};

describe('reading', () => {
  it('kinds and states', () => {
    assert.equal(T.kindOf({}), 'lead');
    assert.equal(T.kindOf({ kind: 'cast' }), 'cast');
    assert.equal(T.kindOf({ kind: 'bogus' }), 'lead');
    const w = makeWorld();
    assert.deepEqual(T.stateOf(w, 'tully-mile'), threadStateDefaults());
    assert.deepEqual(w.threads, {}, 'reading never writes');
    assert.equal(T.lastBeatOf(data.threads[0]), 3);
    assert.equal(T.lastBeatOf({ beats: [] }), 0);
  });

  it('involvement: beat 1 needs the NPC met and `involve`; under way means involved', () => {
    const w = makeWorld({ day: 1 });
    assert.equal(T.isInvolved(w, data, 'tully-mile'), false);
    meet(w, 'tully');
    assert.equal(T.isInvolved(w, data, 'tully-mile'), true);
    meet(w, 'linnet');
    assert.equal(T.isInvolved(w, data, 'linnet-grub'), false, 'involve cond');
    w.flags['sp.dock-done'] = true;
    assert.equal(T.isInvolved(w, data, 'linnet-grub'), true);
    assert.equal(T.isInvolved(w, data, 'odile-lights', { tuning: { threadStartNeedsMet: false } }), true);
    assert.equal(T.isInvolved(w, data, 'nope'), false);
  });
});

describe('eligibleBeats', () => {
  it('lists next beats whose rules hold, and only for threads the player is in', () => {
    const w = makeWorld({ day: 2, minute: 12 * MIN });           // Tuesday
    assert.deepEqual(eligible(w), []);
    meet(w, 'tully', 'odile', 'thessaly');
    assert.deepEqual(ids(eligible(w)), ['tully-mile:1', 'thessaly-bench:1'], 'odile’s beat 1 is a Monday beat');
    const b = eligible(w)[0];
    assert.deepEqual(b, { threadId: 'tully-mile', npcId: 'tully', kind: 'lead', beat: 1, script: 'tully-1', where: null, porch: false, last: false, title: 'The Mudlark Mile' });
  });

  it('one beat a day; spacing; the Monday waiver; weekday gates; immediate beats', () => {
    const w = makeWorld({ day: 2 });
    meet(w, 'tully');
    assert.equal(T.advance(w, data, 'tully-mile').ok, true);
    assert.deepEqual(T.advance(w, data, 'tully-mile'), { ok: false, reason: 'today' }, 'one beat a day');
    assert.equal(T.beatBlock(w, data, data.threads[0], { day: 3 }), 'spacing', 'beat 2 needs two days');
    assert.equal(T.beatBlock(w, data, data.threads[0], { day: 4 }), null);
    const mon = makeWorld({ day: 7 });                            // Sunday
    meet(mon, 'tully');
    T.advance(mon, data, 'tully-mile');
    assert.equal(T.beatBlock(mon, data, data.threads[0], { day: 8 }), null, 'Monday waives the spacing for a thread you are in');
    assert.equal(T.beatBlock(mon, data, data.threads[0], { day: 8, tuning: { threadMondayWaivesSpacing: false } }), 'spacing');
    const od = makeWorld({ day: 2 });
    meet(od, 'odile');
    assert.equal(T.beatBlock(od, data, data.threads[1]), 'weekday');
    assert.equal(T.beatBlock(od, data, data.threads[1], { day: 8 }), null, 'core day 8 is a Monday');
    const ln = makeWorld({ day: 2 });
    meet(ln, 'linnet');
    ln.flags['sp.dock-done'] = true;
    assert.equal(T.advance(ln, data, 'linnet-grub').ok, true);
    assert.equal(T.advance(ln, data, 'linnet-grub').ok, true, 'an immediate beat may follow on the same day');
    const capped = makeWorld({ day: 2 });
    meet(capped, 'thessaly');
    T.advance(capped, data, 'thessaly-bench');
    assert.equal(T.beatBlock(capped, data, data.threads[3], { tuning: { threadDailyCapKinds: ['lead'] } }), null, 'tuning can lift the cap per kind');
  });

  it('a beat cond must hold; porch beats show only at the porch', () => {
    const w = makeWorld({ day: 2 });
    meet(w, 'tully');
    w.threads['tully-mile'] = { beat: 2, done: false, startedDay: 0, lastAdvancedDay: 0 };
    assert.equal(T.beatBlock(w, data, data.threads[0]), 'cond');
    w.flags['sp.race'] = true;
    const b = eligible(w).find((x) => x.threadId === 'tully-mile');
    assert.deepEqual([b.beat, b.porch, b.last, b.where], [3, true, true, { mapId: 'green', x: 1, y: 1 }]);
    assert.deepEqual(T.beatTopics(w, data, 'tully'), [], 'not at the porch');
    const topics = T.beatTopics(w, data, 'tully', { atPorch: true });
    assert.deepEqual(topics, [{ id: 'thread:tully-mile:3', script: 'tully-3', priority: 1000, threadId: 'tully-mile', beat: 3, porch: true, kind: 'lead', where: { mapId: 'green', x: 1, y: 1 } }]);
  });

  it('beatTopics: beats carried by another NPC, priorities, sorting', () => {
    const w = makeWorld({ day: 2 });
    meet(w, 'thessaly');
    w.threads['thessaly-bench'] = { beat: 2, done: false, startedDay: 0, lastAdvancedDay: 0 };
    assert.deepEqual(T.beatTopics(w, data, 'thessaly'), []);
    const t = T.beatTopics(w, data, 'wren');
    assert.deepEqual(t.map((x) => [x.id, x.priority]), [['thread:thessaly-bench:3', 1005]]);
    assert.equal(T.beatTopics(w, data, 'wren', { tuning: { threadTopicPriority: 10 } })[0].priority, 15);
  });
});

describe('advance and setBeat', () => {
  it('advance records the beat, emits, and refuses out of turn', () => {
    const w = makeWorld({ day: 2 });
    const bus = recBus();
    assert.deepEqual(T.advance(w, data, 'nope'), { ok: false, reason: 'unknown-thread' });
    assert.deepEqual(T.advance(w, data, 'tully-mile'), { ok: false, reason: 'not-involved' });
    meet(w, 'tully');
    assert.deepEqual(T.advance(w, data, 'tully-mile', { bus }), { ok: true, beat: 1, done: false, share: null });
    assert.deepEqual(w.threads['tully-mile'], { beat: 1, done: false, startedDay: 2, lastAdvancedDay: 2 });
    assert.deepEqual(bus.of('thread:beat'), [{ threadId: 'tully-mile', npcId: 'tully', kind: 'lead', beat: 1, day: 2, done: false }]);
    assert.equal(evalCond(w, { thread: { id: 'tully-mile', beat: 1 } }), true);
    assert.deepEqual(T.advance(w, data, 'tully-mile', { force: true }).beat, 2, 'force skips the rules');
    assert.deepEqual(validateWorld(w), []);
  });

  it('finishing a lead thread pays the resident share once through the injected loans', () => {
    const w = makeWorld({ day: 2 });
    meet(w, 'tully');
    const spy = shareSpy();
    const bus = recBus();
    T.advance(w, data, 'tully-mile', { loans: spy });
    T.advance(w, data, 'tully-mile', { loans: spy, day: 4 });
    w.flags['sp.race'] = true;
    const r = T.advance(w, data, 'tully-mile', { loans: spy, bus, day: 5 });
    assert.deepEqual(r, { ok: true, beat: 3, done: true, share: { ok: true, credited: 300 } });
    assert.deepEqual(spy.calls, [['tully-mile', 5]]);
    assert.deepEqual(bus.of('thread:done'), [{ threadId: 'tully-mile', kind: 'lead', share: true, result: { ok: true, credited: 300 } }]);
    assert.deepEqual(T.advance(w, data, 'tully-mile', { loans: spy, day: 9 }), { ok: false, reason: 'done' });
    assert.deepEqual(T.eligibleBeats(w, data, { day: 9 }).filter((b) => b.threadId === 'tully-mile'), []);
    assert.equal(spy.calls.length, 1);
  });

  it('template and cast threads pay nothing by default; reward.share overrides either way', () => {
    const w = makeWorld({ day: 2 });
    meet(w, 'thessaly', 'odile');
    const spy = shareSpy();
    for (let b = 1; b <= 3; b++) T.setBeat(w, data, 'thessaly-bench', b, { loans: spy });
    assert.equal(w.threads['thessaly-bench'].done, true);
    assert.deepEqual(spy.calls, [], 'template: no share');
    T.setBeat(w, data, 'odile-lights', 2, { loans: spy });
    assert.deepEqual(spy.calls, [], 'a lead thread whose last beat says share: false');
    const d = makeData();
    d.threads[2] = { ...d.threads[2], beats: [d.threads[2].beats[0], { ...d.threads[2].beats[1], reward: { share: true } }] };
    T.setBeat(w, d, 'linnet-grub', 2, { loans: spy });
    assert.deepEqual(spy.calls.map((c) => c[0]), ['linnet-grub'], 'cast arc with share: true');
    const noLoans = makeWorld({ day: 2 });
    assert.equal(T.setBeat(noLoans, data, 'tully-mile', 3).share, null, 'no collaborator, no crash');
  });

  it('setBeat: bounds, re-opening, and a single payout', () => {
    const w = makeWorld({ day: 2 });
    const spy = shareSpy();
    assert.deepEqual(T.setBeat(w, data, 'nope', 1), { ok: false, reason: 'unknown-thread' });
    assert.deepEqual(T.setBeat(w, data, 'tully-mile', 4), { ok: false, reason: 'bad-beat' });
    assert.deepEqual(T.setBeat(w, data, 'tully-mile', -1), { ok: false, reason: 'bad-beat' });
    assert.deepEqual(T.setBeat(w, data, 'tully-mile', 1.5), { ok: false, reason: 'bad-beat' });
    assert.equal(T.setBeat(w, data, 'tully-mile', 3, { loans: spy }).done, true);
    assert.equal(T.setBeat(w, data, 'tully-mile', 3, { loans: spy }).done, true);
    assert.equal(spy.calls.length, 1, 'already done: no second payout');
    assert.equal(T.setBeat(w, data, 'tully-mile', 1).done, false, 're-opened');
    assert.equal(w.threads['tully-mile'].startedDay, 2);
    assert.deepEqual(validateWorld(w), []);
  });

  it('works with the real loans.residentShare (RULES-ECON) as the collaborator', () => {
    const w = makeWorld({ day: 2 });
    const reg = createRegistry({ threads: data.threads, npcs: data.npcs });
    const before = w.loans.paid;
    const r = T.setBeat(w, reg, 'tully-mile', 3, { loans: { residentShare: (world, id, ctx) => loans.residentShare(world, id, { bus: ctx.bus }) } });
    assert.equal(r.share.ok, true);
    assert.deepEqual(w.loans.residentShares, ['tully-mile']);
    assert.ok(w.loans.paid >= before);
    assert.deepEqual(validateWorld(w), []);
  });
});

describe('previews', () => {
  it('mondayBeats: what the Commons board posts for the week', () => {
    const w = makeWorld({ day: 3 });                                 // Wednesday
    meet(w, 'odile', 'tully');
    assert.deepEqual(ids(T.mondayBeats(w, data)), [], 'no thread under way yet');
    T.advance(w, data, 'tully-mile');
    assert.deepEqual(ids(T.mondayBeats(w, data)), ['tully-mile:2'], 'next Monday (core day 8)');
    const mon = makeWorld({ day: 8 });
    meet(mon, 'odile');
    assert.deepEqual(ids(T.mondayBeats(mon, data)), ['odile-lights:1'], 'on Monday itself new threads count too');
  });

  it('openThreads: threads under way and whether they can land tomorrow', () => {
    const w = makeWorld({ day: 2 });
    meet(w, 'tully', 'thessaly');
    T.advance(w, data, 'tully-mile');
    T.advance(w, data, 'thessaly-bench');
    const open = T.openThreads(w, data);
    assert.deepEqual(open, [
      { threadId: 'tully-mile', npcId: 'tully', title: 'The Mudlark Mile', kind: 'lead', beat: 1, nextBeat: 2, readyTomorrow: false },
      { threadId: 'thessaly-bench', npcId: 'thessaly', title: 'Template', kind: 'template', beat: 1, nextBeat: 2, readyTomorrow: true },
    ]);
    assert.equal(T.openThreads(w, data, { day: 3 })[0].readyTomorrow, true, 'two days after the beat');
  });

  it('tuning defaults and validation', () => {
    const t = T.tuningOf(null);
    assert.deepEqual([t.threadShareKinds, t.threadMondayDow, t.threadMondayWaivesSpacing], [['lead'], 0, true]);
    assert.deepEqual(T.TUNING_KEYS, Object.keys(T.DEFAULTS));
    assert.throws(() => T.tuningOf({ tuning: { threadShareKinds: ['villain'] } }), /threadShareKinds/);
    assert.throws(() => T.tuningOf({ tuning: { threadMondayDow: 7 } }), /threadMondayDow/);
  });
});

function eligible(w, opts) {
  return T.eligibleBeats(w, data, opts);
}
