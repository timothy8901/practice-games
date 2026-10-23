// Pure helpers of the SCN-UI scenes (dialogue, cutscene, shop, letter, Day Page, name entry, script host).
// Run: node --test test/scn-ui.helpers.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePath, stripBeats, tickPitch, textLog, speakerOf, LOG_MAX, createSession } from '../js/scenes/scriptHost.js';
import { pagesFor, creatureUidOf } from '../js/scenes/dialogue.js';
import { walkEnd, faceToward, STOP_OPS } from '../js/scenes/cutscene.js';
import { editName, finishName, gridChars, MAX_LEN } from '../js/scenes/nameEntry.js';
import { bodyLines, doorName, sealOf } from '../js/scenes/letter.js';
import { pageLines, tomorrowLine } from '../js/scenes/dayPage.js';
import { learnerState, satchelStacks } from '../js/scenes/shop.js';
import { createNewWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';

describe('script host', () => {
  it('parsePath reads compact, counted and word paths', () => {
    assert.deepEqual(parsePath('UURD'), ['up', 'up', 'right', 'down']);
    assert.deepEqual(parsePath('U3L'), ['up', 'up', 'up', 'left']);
    assert.deepEqual(parsePath('up, left,down'), ['up', 'left', 'down']);
    assert.deepEqual(parsePath(''), []);
    assert.equal(parsePath('U999').length, 64, 'counts are capped');
  });

  it('stripBeats removes ~ and records visible positions (newlines not counted)', () => {
    assert.deepEqual(stripBeats('Hm.~ Yes.'), { text: 'Hm. Yes.', beats: [3] });
    assert.deepEqual(stripBeats('a\nb~c'), { text: 'a\nbc', beats: [2] });
  });

  it('trade ticks: named voices, a stable hash for everyone else, 0 for narration', () => {
    assert.equal(tickPitch('wren'), -3);
    assert.equal(tickPitch('ambrose'), -10);
    assert.equal(tickPitch(null), 0);
    const p = tickPitch('tully');
    assert.ok(p >= -3 && p <= 3);
    assert.equal(tickPitch('tully'), p);
  });

  it('the text log keeps the last 100 lines, cleaned', () => {
    const G = {};
    const log = textLog(G);
    for (let i = 0; i < LOG_MAX + 20; i++) log.push('Wren', `Line ${i}~|`);
    assert.equal(log.size, LOG_MAX);
    assert.deepEqual(log.lines().at(-1), { who: 'Wren', text: `Line ${LOG_MAX + 19}` });
    log.push('', '   ');
    assert.equal(log.size, LOG_MAX, 'blank lines are not kept');
    assert.equal(textLog({}).size, 0, 'one log per context');
  });

  it('speakerOf: a neighbour keeps their own name (their memory nickname is what they call you)', () => {
    const data = createRegistry(DATA);
    const sp = speakerOf({ data }, { who: 'ph-keeper', name: 'Mudlark' });
    assert.equal(sp.name, 'PLACEHOLDER Keeper');
    assert.equal(speakerOf({ data }, { who: 'Stranger' }).name, 'Stranger');
    assert.deepEqual(speakerOf({ data }, {}), { id: null, name: '', portrait: null, tick: 0 });
    assert.equal(speakerOf({ data: null }, { who: 'wren' }).portrait, 'wren', 'a bust by id');
  });

  it('createSession steps inside store.tx and binds the systems', () => {
    const store = createStore(createNewWorld({ seedCode: 'HOST-1' }));
    const txs = [];
    store.bus.on('tx', (p) => txs.push(p.label));
    const G = { store, get world() { return store.world; }, bus: store.bus, data: createRegistry(DATA), rngs: null };
    const s = createSession(G, { ops: [{ op: 'setFlag', id: 'sp.host-test' }, { op: 'earn', amount: 40 }, 'Hello.', { op: 'end' }] });
    const r = s.next();
    assert.equal(r.op, 'say');
    assert.equal(store.world.flags['sp.host-test'], true);
    assert.equal(store.world.wallet.main, 40);
    assert.ok(txs.some((l) => l.startsWith('script:')));
    assert.deepEqual(s.next(), { done: true });
  });
});

describe('dialogue', () => {
  it('pagesFor wraps to four lines, breaks pages on |, keeps beats per page', () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const pages = pagesFor(`${long}|Second~ page.`, false);
    assert.ok(pages.length >= 2);
    assert.ok(pages.every((p) => p.text.split('\n').length <= 4));
    assert.deepEqual(pages.at(-1), { text: 'Second page.', beats: [6] });
    assert.ok(pagesFor(long, true).length <= pagesFor(long, false).length, 'narration is wider');
  });

  it('creatureUidOf accepts a uid or player:<uid>', () => {
    const w = { party: [{ uid: 'c1' }], box: [{ uid: 'c9' }] };
    assert.equal(creatureUidOf(w, 'c1'), 'c1');
    assert.equal(creatureUidOf(w, 'player:c9'), 'c9');
    assert.equal(creatureUidOf(w, 'tully'), null);
  });
});

describe('cutscene', () => {
  it('walkEnd and faceToward', () => {
    assert.deepEqual(walkEnd({ x: 5, y: 5 }, ['left', 'left', 'down']), { x: 3, y: 6, facing: 'down' });
    assert.deepEqual(walkEnd({ x: 1, y: 1 }, []), { x: 1, y: 1, facing: null });
    assert.equal(faceToward({ x: 5, y: 5 }, { x: 2, y: 6 }), 'left');
    assert.equal(faceToward({ x: 5, y: 5 }, { x: 5, y: 1 }), 'up');
  });

  it('a skip never runs past a choice, a name, a battle or a Forecast', () => {
    for (const op of ['choice', 'nickname', 'startBattle', 'forecast', 'letter', 'openShop']) assert.ok(STOP_OPS.includes(op));
    assert.equal(STOP_OPS.includes('say'), false);
  });
});

describe('name entry', () => {
  it('editName types, deletes, caps the length and refuses double spaces', () => {
    assert.deepEqual(editName('Mud', { type: 'char', ch: 's' }), { name: 'Muds', error: null });
    assert.deepEqual(editName('Muds', { type: 'delete' }), { name: 'Mud', error: null });
    assert.equal(editName('', { type: 'char', ch: ' ' }).name, '', 'no leading space');
    assert.equal(editName('A ', { type: 'char', ch: ' ' }).name, 'A ', 'no double space');
    const full = 'x'.repeat(MAX_LEN);
    assert.equal(editName(full, { type: 'char', ch: 'y' }).name, full);
    assert.match(editName(full, { type: 'char', ch: 'y' }).error, /10 letters/);
    assert.equal(editName('', { type: 'set', text: 'PUDDLEJUMPER' }).name, 'PUDDLEJUMP');
  });

  it('finishName needs a letter and trims', () => {
    assert.deepEqual(finishName('  Peg  '), { ok: true, name: 'Peg' });
    assert.equal(finishName('   ').ok, false);
    assert.equal(finishName("'-.").ok, false);
  });

  it('the grid has 40 keys with a space; lower case keeps digits', () => {
    assert.equal(gridChars(true).length, 40);
    assert.ok(gridChars(true).includes(' '));
    assert.equal(gridChars(false)[0], 'a');
    assert.equal(gridChars(false)[30], '0');
  });
});

describe('letter', () => {
  it('bodyLines turns | into paragraph gaps and wraps', () => {
    const lines = bodyLines('One.|Two.');
    assert.deepEqual(lines, ['One.', '', 'Two.']);
  });
  it('doorName and sealOf', () => {
    assert.equal(doorName('porch-dorrow'), 'Dorrow porch');
    assert.equal(doorName(null), 'the right door');
    assert.equal(sealOf('petrel').glyph, 'petrel');
    assert.equal(sealOf('nope').id, 'wax-red');
  });
});

describe('Day Page', () => {
  it('pageLines: heading, quiet lines, Tomorrow capped at six', () => {
    const s = { day: 0, gameDay: 1, dow: 6, buttons: 0, loanPaid: 0, catches: 0, fish: 2, forecasts: 1, battles: 0, lettersRead: 0, talkedTo: ['wren'], notes: ['caught:tossup', 'read:K1'], tomorrow: Array.from({ length: 9 }, () => ({ kind: 'letter', id: 'K2' })) };
    const p = pageLines(s, { data: null, world: null });
    assert.equal(p.heading, 'Day 1, Sunday.');
    assert.ok(p.lines.some((l) => /Tossup, 2 fish/.test(l.text)));
    assert.ok(p.lines.some((l) => /Forecasts read: 1/.test(l.text)));
    assert.ok(p.lines.some((l) => /Read K1/.test(l.text)));
    assert.ok(p.lines.some((l) => /Talked with Wren/.test(l.text)));
    assert.equal(p.tomorrow.length, 6);
    assert.equal(p.tomorrow[0], 'K2 at six');
  });
  it('tomorrowLine per kind', () => {
    assert.equal(tomorrowLine({ kind: 'build', id: 'cottage' }), 'The Thatch tie off the cottage at 5:40');
    assert.equal(tomorrowLine({ kind: 'low', params: { minutes: [305, 1050] } }), 'Lows at 05:05 and 17:30');
    assert.equal(tomorrowLine({ kind: 'carry', id: 'F1', params: { atCounter: true } }), "F1 waiting at Hesper's counter");
  });
});

describe('shop', () => {
  it('learnerState: knows / can (learnset or teachable) / cannot', () => {
    const data = { has: (t, id) => t === 'species' && id === 'sp', get: () => ({ learnset: [[5, 'gust']], flags: { teachable: ['shardlight'] } }) };
    assert.equal(learnerState(data, { speciesId: 'sp', moves: [{ id: 'tap' }] }, 'gust'), 'can');
    assert.equal(learnerState(data, { speciesId: 'sp', moves: [] }, 'shardlight'), 'can');
    assert.equal(learnerState(data, { speciesId: 'sp', moves: [{ id: 'sandtrap' }] }, 'sandtrap'), 'knows');
    assert.equal(learnerState(data, { speciesId: 'sp', moves: [] }, 'flashover'), 'cannot');
    assert.equal(learnerState(data, { speciesId: 'other', moves: [] }, 'gust'), 'cannot');
  });
  it('satchelStacks merges stacks across pockets, skipping tools', () => {
    const w = { bag: { pockets: { wicks: [{ id: 'a', n: 2 }, { id: 'a', n: 3 }], finds: [{ id: 'b', n: 1 }], tools: [{ id: 'rod', n: 1 }] } } };
    assert.deepEqual(satchelStacks(w), [{ id: 'a', n: 5, pocket: 'wicks' }, { id: 'b', n: 1, pocket: 'finds' }]);
  });
});
