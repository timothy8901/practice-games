// Unit tests for js/systems/memory.js (SYS-TOWN). Run: node --test test/systems.memory.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/systems/memory.js';
import { validateWorld, npcMemoryDefaults } from '../js/state/schema.js';
import { resolveScript } from '../js/script/registry.js';
import { createRegistry } from '../js/data/registry.js';
import { makeRng } from '../js/core/rng.js';
import { makeWorld, makeData, at, recBus, MIN } from './fixtures/town.fixture.mjs';

const data = makeData();
const wren = data.npcs.find((n) => n.id === 'wren');
const creature = (uid, extra = {}) => ({ uid, speciesId: 'sloshkin', types: ['Brine'], hp: 10, shiftlog: ['sloshkin'], ...extra });

describe('records', () => {
  it('memoryOf never writes; ensure creates a full record and fills old ones', () => {
    const w = makeWorld();
    assert.deepEqual(M.memoryOf(w, 'wren'), npcMemoryDefaults());
    assert.deepEqual(w.npcs, {});
    const m = M.ensure(w, 'wren');
    assert.deepEqual(m, npcMemoryDefaults());
    assert.equal(M.ensure(w, 'wren'), m, 'same record');
    w.npcs.old = { met: true, talks: 1, lastTalkDay: 0, lastPorchDay: -1, nickname: null, affinity: 0, favours: [], saidLines: {}, remembered: {} };
    M.ensure(w, 'old');
    assert.deepEqual(w.npcs.old.gifts, {});
    assert.equal(w.npcs.old.lingerDay, -1);
    assert.throws(() => M.ensure(w, ''), /npc id/);
    assert.deepEqual(validateWorld(w), []);
  });

  it('talk: met, talks, day, affinity once a day, porch bonus once a day, event', () => {
    const w = makeWorld({ day: 2, minute: 10 * MIN });
    const bus = recBus();
    const r1 = M.talk(w, 'wren', data, { bus });
    assert.deepEqual(r1, { first: true, firstToday: true, talks: 1, affinity: 1 });
    const r2 = M.talk(w, 'wren', data, { bus, porch: true });
    assert.deepEqual(r2, { first: false, firstToday: false, talks: 2, affinity: 2 }, 'porch bonus only');
    M.talk(w, 'wren', data, { porch: true });
    assert.equal(w.npcs.wren.affinity, 2, 'porch bonus once a day');
    assert.equal(w.npcs.wren.lastPorchDay, 2);
    M.talk(w, 'wren', data, { day: 3 });
    assert.equal(w.npcs.wren.affinity, 3);
    assert.equal(M.lastTalked(w, 'wren'), 3);
    assert.equal(M.lastTalked(w, 'tully'), -1);
    assert.deepEqual(bus.of('npc:talked')[0], { npcId: 'wren', day: 2, first: true, firstToday: true, porch: false, talks: 1 });
    M.talk(w, 'tully', data);
    assert.deepEqual(M.talkedOn(w, 2), ['tully']);
    assert.deepEqual(M.talkedOn(w, 3), ['wren']);
    const tuned = makeWorld();
    M.talk(tuned, 'wren', data, { tuning: { affinityPerTalkDay: 5 } });
    assert.equal(tuned.npcs.wren.affinity, 5);
    assert.deepEqual(validateWorld(w), []);
  });

  it('remember / recall / forget keep JSON values only', () => {
    const w = makeWorld();
    assert.deepEqual(M.remember(w, 'wren', 'roof', 'red'), { changed: true });
    assert.deepEqual(M.remember(w, 'wren', 'roof', 'red'), { changed: false });
    const obj = { a: [1, 2] };
    M.remember(w, 'wren', 'obj', obj);
    obj.a.push(3);
    assert.deepEqual(M.recall(w, 'wren', 'obj'), { a: [1, 2] }, 'stored as a copy');
    assert.equal(M.recall(w, 'wren', 'none', 'dflt'), 'dflt');
    assert.throws(() => M.remember(w, 'wren', 'f', () => 1), /JSON/);
    assert.throws(() => M.remember(w, 'wren', 'n', NaN), /JSON/);
    assert.throws(() => M.remember(w, 'wren', 'u', undefined), /JSON/);
    assert.throws(() => M.remember(w, 'wren', 'd', new Date()), /JSON/);
    assert.throws(() => M.remember(w, 'wren', '', 1), /key/);
    assert.equal(M.forget(w, 'wren', 'roof'), true);
    assert.equal(M.forget(w, 'wren', 'roof'), false);
    assert.equal(M.forget(w, 'nobody', 'roof'), false);
    assert.deepEqual(validateWorld(w), []);
  });

  it('recordLine / saidWithin: the 5-day window', () => {
    const w = makeWorld({ day: 10 });
    M.recordLine(w, 'wren', 'g1');
    assert.equal(w.npcs.wren.saidLines.g1, 10);
    assert.equal(w.npcs.wren.lastLineId, 'g1');
    assert.equal(M.saidWithin(w, 'wren', 'g1', 14, 5), true, 'day 14: four days later');
    assert.equal(M.saidWithin(w, 'wren', 'g1', 15, 5), false, 'day 15: five days later, free again');
    assert.equal(M.saidWithin(w, 'wren', 'g1', 9, 5), false, 'a later save never blocks an earlier day');
    assert.equal(M.saidWithin(w, 'wren', 'zz', 10, 5), false);
    assert.throws(() => M.recordLine(w, 'wren', ''), /lineId/);
  });
});

describe('nicknames, gifts, favours, Linger', () => {
  it('setNickname: accept keeps the offer, decline clears, counter stores yours', () => {
    const w = makeWorld();
    const bus = recBus();
    assert.deepEqual(M.setNickname(w, 'tully', 'accept', data, { offer: ' Lamplighter ', bus }), { ok: true, nickname: 'Lamplighter' });
    assert.equal(M.nicknameFor(w, 'tully'), 'Lamplighter');
    assert.equal(w.npcs.tully.nicknameChoice, 'accept');
    assert.deepEqual(M.setNickname(w, 'tully', 'decline', data), { ok: true, nickname: null });
    assert.equal(M.nicknameFor(w, 'tully'), null);
    assert.equal(w.npcs.tully.nicknameChoice, 'decline');
    assert.deepEqual(M.setNickname(w, 'tully', 'counter', data, { counter: '  Sorrel   the  Bold ' }), { ok: false, reason: 'bad-counter' }, '15 chars > 12');
    assert.deepEqual(M.setNickname(w, 'tully', 'counter', data, { counter: ' Sorrel  B ' }), { ok: true, nickname: 'Sorrel B' });
    assert.deepEqual(M.setNickname(w, 'tully', 'counter', data, { counter: '   ' }), { ok: false, reason: 'bad-counter' });
    assert.deepEqual(M.setNickname(w, 'tully', 'accept', data, {}), { ok: false, reason: 'no-offer' });
    assert.deepEqual(M.setNickname(w, 'tully', 'maybe', data), { ok: false, reason: 'bad-choice' });
    assert.equal(M.nicknameFor(w, 'tully'), 'Sorrel B', 'failed answers change nothing');
    assert.deepEqual(M.setNickname(w, 'tully', 'counter', data, { counter: 'Ab', tuning: { nicknameMaxLength: 1 } }), { ok: false, reason: 'bad-counter' });
    assert.deepEqual(bus.of('npc:nickname'), [{ npcId: 'tully', choice: 'accept', nickname: 'Lamplighter' }]);
    assert.deepEqual(validateWorld(w), []);
  });

  it('giveGift: reactions, remembered gifts, one that counts per day', () => {
    const w = makeWorld({ day: 4 });
    const bus = recBus();
    assert.equal(M.reactionTo(wren, 'pear'), 'love');
    assert.equal(M.reactionTo(wren, 'plum'), 'like');
    assert.equal(M.reactionTo(wren, 'rust'), 'dislike');
    assert.equal(M.reactionTo(wren, 'stone'), 'neutral');
    assert.equal(M.reactionTo({ loves: ['x'], likes: ['y'], dislikes: ['z'] }, 'z'), 'dislike');
    assert.equal(M.reactionTo(null, 'x'), 'neutral');
    assert.deepEqual(M.giveGift(w, data, 'wren', 'pear', { bus }), { ok: true, reaction: 'love', firstTime: true, affinityDelta: 3 });
    assert.deepEqual(M.giveGift(w, data, 'wren', 'plum'), { ok: true, reaction: 'again', firstTime: true, affinityDelta: 0 }, 'second gift today');
    assert.deepEqual(M.giveGift(w, data, 'wren', 'pear', { day: 5 }), { ok: true, reaction: 'love', firstTime: false, affinityDelta: 3 });
    assert.deepEqual(M.giveGift(w, data, 'wren', 'pear', { day: 5, tuning: { giftsPerDay: 3 } }), { ok: true, reaction: 'again', firstTime: false, affinityDelta: 0 }, 'same item twice in a day');
    assert.deepEqual(M.giveGift(w, data, 'wren', 'rust', { day: 5, tuning: { giftsPerDay: 3 } }), { ok: true, reaction: 'dislike', firstTime: true, affinityDelta: -1 });
    assert.deepEqual(M.giftMemory(w, 'wren', 'pear'), { n: 3, lastDay: 5 });
    assert.equal(M.giftMemory(w, 'wren', 'none'), null);
    assert.equal(w.npcs.wren.affinity, 5);
    assert.equal(w.npcs.wren.lastGiftDay, 5);
    assert.deepEqual(bus.of('npc:gift')[0], { npcId: 'wren', itemId: 'pear', reaction: 'love', affinity: 3 });
    assert.throws(() => M.giveGift(w, data, 'wren', ''), /itemId/);
    assert.deepEqual(validateWorld(w), []);
  });

  it('favours', () => {
    const w = makeWorld();
    assert.equal(M.addFavour(w, 'wren', 'mullet'), true);
    assert.equal(M.addFavour(w, 'wren', 'mullet'), false);
    assert.equal(M.hasFavour(w, 'wren', 'mullet'), true);
    assert.equal(M.clearFavour(w, 'wren', 'mullet'), true);
    assert.equal(M.clearFavour(w, 'wren', 'mullet'), false);
    assert.equal(M.clearFavour(w, 'nobody', 'mullet'), false);
    assert.equal(M.hasFavour(w, 'wren', 'mullet'), false);
    assert.throws(() => M.addFavour(w, 'wren', ''), /favourId/);
  });

  it('Linger: once a day, only after talking', () => {
    const w = makeWorld({ day: 3 });
    assert.equal(M.canLinger(w, 'wren', data), false);
    assert.deepEqual(M.linger(w, 'wren', data), { ok: false, reason: 'not-talked' });
    M.talk(w, 'wren', data);
    assert.equal(M.canLinger(w, 'wren', data), true);
    const bus = recBus();
    assert.deepEqual(M.linger(w, 'wren', data, { bus }), { ok: true });
    assert.deepEqual(bus.of('npc:linger'), [{ npcId: 'wren', day: 3 }]);
    assert.deepEqual(M.linger(w, 'wren', data), { ok: false, reason: 'already' });
    assert.equal(M.canLinger(w, 'wren', data), false);
    M.talk(w, 'wren', data, { day: 4 });
    assert.equal(M.canLinger(w, 'wren', data, { day: 4 }), true, 'a new day');
    assert.deepEqual(M.linger(w, 'wren', data, { day: 4, tuning: { lingerPerDay: 0 } }), { ok: false, reason: 'off' });
    assert.equal(M.canLinger(w, 'wren', data, { day: 4, tuning: { lingerPerDay: 0 } }), false);
  });
});

describe('lines and tags', () => {
  it('linesOf: bare strings get <pool><i+1> ids; pool keys give default tags', () => {
    const lines = M.linesOf(wren);
    const night = lines.find((l) => l.pool === 'night');
    assert.deepEqual([night.id, night.tags], ['night1', ['night']]);
    assert.deepEqual(lines.find((l) => l.id === 'sweep1').tags, ['pose:sweep']);
    assert.deepEqual(lines.find((l) => l.id === 'w1').tags, ['weather:rain']);
    assert.deepEqual(lines.find((l) => l.id === 'l1').tags, ['lead:brine']);
    assert.deepEqual(lines.find((l) => l.id === 'gf1').tags, ['gift:pear'], 'own tags win over the pool');
    assert.deepEqual(M.linesOf({ lines: { generic: [null, { id: 3 }, 'ok'], bad: 'x' } }).map((l) => l.id), ['generic3']);
    assert.deepEqual(M.linesOf(null), []);
  });

  it('validateLines reports unknown tags, missing args and duplicate ids', () => {
    const problems = M.validateLines(wren);
    assert.deepEqual(problems, ["npcs:wren: line 'x1' tag 'moon' unknown (generic night day porch weather lead shift pose gift nickname known)"]);
    const bad = { id: 'b', lines: { generic: [{ id: 'a', text: '' }], other: [{ id: 'a', text: 'x', tags: ['weather'] }] } };
    assert.deepEqual(M.validateLines(bad), ["npcs:b: line id 'a' is not unique across pools", "npcs:b: line 'a' tag 'weather' needs an argument (weather:<x>)"]);
  });

  it('daytime generic lines rotate through the 5-day window, least recently said first', () => {
    const w = makeWorld({ day: 1, minute: 10 * MIN });
    const seen = [];
    for (let d = 1; d <= 4; d++) {
      at(w, d, 10 * MIN);
      const p = M.talkLine(w, data, 'wren', { pools: ['generic'] });
      seen.push(p.lineId);
    }
    assert.deepEqual(seen.slice(0, 3), ['g1', 'g2', 'g3'], 'each said once before any repeats');
    assert.equal(seen[3], 'g1', 'all said within 5 days: least recently said comes back');
    at(w, 4, 11 * MIN);
    const p = M.pickLine('wren', w, data, { pools: ['generic'] });
    assert.equal(p.repeat, true);
    assert.equal(M.pickLine('wren', w, data, { pools: ['generic'], tuning: { strictNoRepeat: true } }), null);
    at(w, 7, 10 * MIN);
    const fresh = M.pickLine('wren', w, data, { pools: ['generic'] });
    assert.deepEqual([fresh.lineId, fresh.repeat], ['g2', false], 'g2 (day 2) is five days old on day 7');
  });

  it('night, day, porch, weather, lead, pose, gift, nickname, known tags', () => {
    const w = makeWorld({ day: 2, minute: 23 * MIN });
    const ids = (ctx = {}) => {
      const out = [];
      const def = JSON.parse(JSON.stringify(wren));
      for (const l of M.linesOf(def)) {
        const env = { world: w, mem: M.memoryOf(w, 'wren'), day: 2, minute: (ctx.minute ?? 23 * MIN), ctx, night: (ctx.minute ?? 23 * MIN) >= 18 * MIN || (ctx.minute ?? 23 * MIN) < 6 * MIN, porchOpen: true };
        if (l.tags.every((t) => M.tagHolds(t, env))) out.push(l.id);
      }
      return out;
    };
    assert.ok(ids().includes('night1'));
    assert.ok(!ids().includes('p1'), 'porch needs atPorch');
    assert.ok(ids({ atPorch: true }).includes('p1'));
    assert.ok(!ids({ minute: 10 * MIN }).includes('night1'));
    assert.ok(ids({ pose: 'sweep' }).includes('sweep1'));
    assert.ok(!ids().includes('w1'));
    w.weather.current = 'rain';
    assert.ok(ids().includes('w1'), 'weather in effect now');
    w.weather.current = '';
    w.weather.today = 'rain';
    assert.ok(ids().includes('w1'), 'falls back to today');
    assert.ok(!ids().includes('l1'));
    w.party.push(creature('c1'));
    assert.ok(ids().includes('l1'), 'Brine lead');
    assert.ok(!ids().includes('gf1'));
    M.giveGift(w, data, 'wren', 'pear');
    assert.ok(ids().includes('gf1'));
    assert.ok(!ids({ minute: 10 * MIN }).includes('n1'));
    M.setNickname(w, 'wren', 'accept', data, { offer: 'Keeper' });
    assert.ok(ids({ minute: 10 * MIN }).includes('n1'), 'nickname + day');
    assert.ok(!ids().includes('k1'), 'not known before an earlier talk');
    M.talk(w, 'wren', data, { day: 1 });
    assert.ok(ids().includes('k1'));
    assert.ok(!ids().includes('x1'), 'unknown tag never holds');
    assert.equal(M.tagHolds(7, { world: w, mem: npcMemoryDefaults(), day: 0, minute: 0, ctx: {}, night: true, porchOpen: true }), false);
    for (const tag of ['generic:x', 'night:x', 'porch:x', 'weather', 'lead', 'pose', 'shift:x', 'nickname:x', 'known:x']) {
      assert.equal(M.tagHolds(tag, { world: w, mem: M.memoryOf(w, 'wren'), day: 2, minute: 0, ctx: { atPorch: true }, night: true, porchOpen: true }), false, tag);
    }
  });

  it('the Shift line fires once per new form of the lead', () => {
    const w = makeWorld({ day: 2, minute: 10 * MIN });
    w.party.push(creature('c1', { speciesId: 'skeinwing', types: ['Gust'], shiftlog: ['sloshkin', 'skeinwing'] }));
    const p = M.talkLine(w, data, 'wren');
    assert.equal(p.lineId, 's1', 'the Shift remark is the most specific line');
    assert.equal(w.npcs.wren.remembered['shiftSeen.c1'], 'skeinwing');
    at(w, 9, 10 * MIN);
    assert.notEqual(M.pickLine('wren', w, data).lineId, 's1', 'already remarked on this form');
    w.party[0].speciesId = 'vesperay';
    w.party[0].shiftlog.push('vesperay');
    assert.equal(M.pickLine('wren', w, data).lineId, 's1', 'a new form');
    assert.equal(M.pickLine('wren', w, data, { pools: ['shift'], shiftHappened: true }).lineId, 's1');
    const solo = makeWorld({ day: 2, minute: 10 * MIN });
    assert.notEqual(M.pickLine('wren', solo, data)?.lineId, 's1', 'no lead');
  });

  it('specificity: porch beats night beats generic', () => {
    const w = makeWorld({ day: 2, minute: 21 * MIN });
    assert.equal(M.pickLine('wren', w, data, { atPorch: true }).lineId, 'p1');
    assert.equal(M.pickLine('wren', w, data).lineId, 'night1');
    assert.equal(M.pickLine('wren', at(w, 2, 12 * MIN), data).lineId, 'g1');
    w.flags['sp.bell'] = true;
    assert.equal(M.pickLine('wren', w, data, { pools: ['flagged'] }).lineId, 'c1', 'line cond');
    delete w.flags['sp.bell'];
    assert.equal(M.pickLine('wren', w, data, { pools: ['flagged'] }), null);
    assert.equal(M.pickLine('nobody', w, data), null);
    assert.equal(M.pickLine({ id: 'empty', lines: {} }, w, data), null);
  });

  it('Linger skips the line just said and prefers another pool', () => {
    const w = makeWorld({ day: 2, minute: 21 * MIN });
    const first = M.talkLine(w, data, 'wren', { atPorch: true });
    assert.equal(first.lineId, 'p1');
    const second = M.pickLine('wren', w, data, { atPorch: true, linger: true });
    assert.equal(second.lineId, 'night1', 'second topic');
    const explicit = M.pickLine('wren', w, data, { atPorch: true, linger: true, lastLineId: 'night1' });
    assert.equal(explicit.lineId, 'g1', 'p1 was said today, night1 is skipped: a fresh generic line');
  });

  it('an rng breaks exact ties deterministically', () => {
    const w = makeWorld({ day: 2, minute: 12 * MIN });
    const a = M.pickLine('wren', w, data, { pools: ['generic'], rng: makeRng(7) }).lineId;
    const b = M.pickLine('wren', w, data, { pools: ['generic'], rng: makeRng(7) }).lineId;
    assert.equal(a, b);
    const picks = new Set();
    for (let s = 0; s < 40; s++) picks.add(M.pickLine('wren', w, data, { pools: ['generic'], rng: makeRng(s) }).lineId);
    assert.ok(picks.size > 1, 'different seeds pick different ties');
    assert.equal(M.pickLine('wren', w, data, { pools: ['generic'] }).lineId, 'g1', 'no rng: list order');
  });

  it('keys saidLines like script/registry, so the two agree on what was said', () => {
    const w = makeWorld({ day: 2, minute: 12 * MIN });
    const reg = createRegistry({ npcs: data.npcs, threads: [], scripts: {} });
    M.talkLine(w, reg, 'wren', { pools: ['generic'] });
    const r = resolveScript(w, reg, { kind: 'npc', id: 'wren' });
    assert.equal(r.source, 'generic');
    assert.notEqual(r.lineId, 'g1', 'the registry skips the line memory recorded');
    assert.deepEqual(validateWorld(w), []);
  });

  it('tuning: GDD defaults, overrides validated', () => {
    assert.equal(M.tuningOf(null).noRepeatDays, 5, 'GDD-00 §10');
    assert.deepEqual(M.tuningOf(null).nightWindow, [18 * MIN, 6 * MIN], 'GDD-00 §5');
    assert.deepEqual(M.TUNING_KEYS, Object.keys(M.DEFAULTS));
    assert.equal(M.tuningOf({ tuning: { noRepeatDays: 2 } }).noRepeatDays, 2);
    assert.throws(() => M.tuningOf({ tuning: { noRepeatDays: -1 } }), /noRepeatDays/);
    assert.throws(() => M.tuningOf({ tuning: { affinityGift: { love: 1 } } }), /affinityGift/);
    assert.throws(() => M.tuningOf({ tuning: { lingerPerDay: 2 } }), /lingerPerDay/);
  });
});
