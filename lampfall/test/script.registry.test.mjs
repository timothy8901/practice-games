// js/script/registry.js: resolveScript priority rules (§6.3) and EVENT_SCRIPTS lookup.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveScript, eventScript, SOURCE_ORDER } from '../js/script/registry.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';
import { createNewWorld } from '../js/state/schema.js';
import { encodeSeedCode } from '../js/core/rng.js';
import { noRepeatDays } from '../js/data/tuning.js';
import { t } from '../js/data/strings.js';

const say = (text) => [text, { op: 'end' }];
const data = createRegistry({
  npcs: [
    {
      id: 'wren', name: 'Wren', home: 'x', threadId: 'wren-t', schedule: [],
      topics: [
        { id: 'pear-favour', favour: 'pear', script: 's-favour', priority: 1 },
        { id: 'intro', cond: { not: { flag: 'sp.met' } }, script: 's-intro', priority: 10, once: true },
        { id: 'remind', script: 's-remind', priority: 2, repeatDays: 2 },
        { id: 'broken', script: 's-missing', priority: 99 },
      ],
      lines: { generic: [{ id: 'g1', text: 'One.' }] },
    },
    {
      id: 'quiet', name: 'Quiet', home: 'x', schedule: [], topics: [],
      lines: {
        generic: [{ id: 'g1', text: 'One.' }, { id: 'g2', text: 'Two.' }, { id: 'g3', text: 'Three.' }],
        sweep: ['Sweeping.'],
        evening: ['Evening line.'],
        porch: ['Porch line, {player}.', 'Second porch line.'],
      },
    },
    { id: 'mute', name: 'Mute', home: 'x', schedule: [], topics: [], lines: {} },
  ],
  threads: [{ id: 'wren-t', npcId: 'wren', beats: [{ id: 1, cond: { flag: 'sp.ready' }, script: 's-beat-1' }, { id: 2, script: 's-beat-2' }] }],
  scripts: {
    's-favour': say('Favour.'), 's-intro': say('Intro.'), 's-remind': say('Remind.'), 's-beat-1': say('Beat one.'),
    's-beat-2': say('Beat two.'), 'mailbox-box-1': say('Mail.'), 'custom': say('Custom.'),
  },
  eventScripts: [{ id: 'e1', event: 'loan:tier:2', script: 's-beat-1' }, { id: 'e2', event: 'loan:tier:3', script: 's-gone' }],
  maps: [],
});

/** World at day `d`, minute-of-day `m`. */
function worldAt(m = 10 * 60, d = 5) {
  const w = createNewWorld({ seedCode: encodeSeedCode({ dial: 'FLUX', seed: 3, toggles: [] }) });
  w.clock.total = d * 1440 + m;
  w.player.name = 'Ada';
  return w;
}
const mem = (extra = {}) => ({ met: true, talks: 0, nickname: null, lastTalkDay: 0, lastPorchDay: null, affinity: 0, favours: [], saidLines: {}, remembered: {}, ...extra });
const npc = (w, id, extra = {}) => resolveScript(w, data, { kind: 'npc', id, ...extra });

test('SOURCE_ORDER is the fixed §6.3 priority', () => {
  assert.deepEqual(SOURCE_ORDER, ['thread', 'favour', 'topic', 'schedule', 'porch', 'generic', 'default']);
});

test('(1) the next thread beat whose cond holds outranks everything', () => {
  const w = worldAt();
  w.flags['sp.ready'] = true;
  w.npcs.wren = mem({ favours: ['pear'] });
  const r = npc(w, 'wren');
  assert.equal(r.source, 'thread');
  assert.equal(r.scriptId, 's-beat-1');
  assert.equal(r.beat, 1);
  assert.deepEqual(r.ops, data.get('scripts', 's-beat-1'));
  w.threads['wren-t'] = { beat: 1, done: false, startedDay: 0, lastAdvancedDay: 0 };
  assert.equal(npc(w, 'wren').scriptId, 's-beat-2');                    // beat 2 has no cond
  w.threads['wren-t'].done = true;
  assert.notEqual(npc(w, 'wren').source, 'thread');
});

test('(2) a pending favour outranks ordinary topics', () => {
  const w = worldAt();
  w.npcs.wren = mem({ favours: ['pear'] });
  const r = npc(w, 'wren');
  assert.deepEqual([r.source, r.scriptId, r.topicId], ['favour', 's-favour', 'pear-favour']);
});

test('(3) highest-priority eligible topic; topics with missing scripts are skipped', () => {
  const w = worldAt();
  assert.deepEqual([npc(w, 'wren').source, npc(w, 'wren').topicId], ['topic', 'intro']);
});

test('(3) once and repeatDays are honoured through saidLines', () => {
  const w = worldAt(10 * 60, 5);
  w.npcs.wren = mem({ saidLines: { intro: 1 } });
  assert.equal(npc(w, 'wren').topicId, 'remind');                       // intro is once and was said
  w.npcs.wren.saidLines.remind = 4;                                     // said yesterday, repeatDays 2
  assert.equal(npc(w, 'wren').source, 'generic');
  w.npcs.wren.saidLines.remind = 3;                                     // two days ago: eligible again
  assert.equal(npc(w, 'wren').topicId, 'remind');
  w.flags['sp.met'] = true;
  delete w.npcs.wren.saidLines.intro;
  w.npcs.wren.saidLines.remind = 5;
  assert.equal(npc(w, 'wren').source, 'generic');                       // intro's cond now fails
});

test('(4) the schedule pose line', () => {
  const r = npc(worldAt(), 'quiet', { pose: 'sweep' });
  assert.equal(r.source, 'schedule');
  assert.equal(r.lineId, 'sweep1');
  assert.equal(r.scriptId, 'quiet#sweep1');
  assert.deepEqual(r.ops, [{ op: 'say', who: 'quiet', text: 'Sweeping.' }, { op: 'end' }]);
});

test('(5) porch talk inside the porch window outranks the phase line; outside it does not', () => {
  const evening = worldAt(20 * 60);
  const r = npc(evening, 'quiet', { atPorch: true });
  assert.deepEqual([r.source, r.lineId, r.ops[0].text], ['porch', 'porch1', 'Porch line, {player}.']);
  assert.equal(resolveScript(evening, data, { kind: 'porch', id: 'quiet' }).source, 'porch');
  assert.equal(npc(evening, 'quiet').source, 'schedule');               // not at the porch: evening line
  assert.equal(npc(evening, 'quiet').ops[0].text, 'Evening line.');
  assert.equal(npc(worldAt(10 * 60), 'quiet', { atPorch: true }).source, 'generic'); // morning: no porch talk
});

test('(6) generic pool: recently said lines are skipped, least recently said wins', () => {
  const w = worldAt(10 * 60, 10);
  w.npcs.quiet = mem({ saidLines: { g1: 10 } });
  assert.equal(npc(w, 'quiet').lineId, 'g2');
  w.npcs.quiet.saidLines = { g1: 10 - noRepeatDays, g2: 9, g3: 9 };     // g1 is out of the window
  assert.equal(npc(w, 'quiet').lineId, 'g1');
  w.npcs.quiet.saidLines = { g1: 10, g2: 9, g3: 8 };                    // all recent: the oldest wins
  assert.equal(npc(w, 'quiet').lineId, 'g3');
});

test('(6) linger resolves again, skipping the line just said', () => {
  const w = worldAt();
  assert.equal(npc(w, 'quiet').lineId, 'g1');
  assert.equal(npc(w, 'quiet', { linger: true, lastLineId: 'g1' }).lineId, 'g2');
  const ev = worldAt(20 * 60);
  assert.equal(npc(ev, 'quiet', { atPorch: true, linger: true, lastLineId: 'porch1' }).lineId, 'porch2');
});

test('(7) the default line when an npc has nothing to say', () => {
  const r = npc(worldAt(), 'mute');
  assert.deepEqual([r.source, r.scriptId, r.ops[0].text], ['default', 'mute#default', t('npc.default')]);
});

test('signs, triggers and use-verbs', () => {
  const w = worldAt();
  const sign = resolveScript(w, data, { kind: 'sign', id: 'quay-sign', text: 'Mind the tide.' });
  assert.deepEqual([sign.scriptId, sign.ops[0].text], ['quay-sign#sign', 'Mind the tide.']);
  assert.equal(resolveScript(w, data, { kind: 'trigger', id: 'step-1', script: 'custom' }).scriptId, 'custom');
  assert.equal(resolveScript(w, data, { kind: 'mailbox', id: 'box-1' }).scriptId, 'mailbox-box-1');
  const fallback = resolveScript(w, data, { kind: 'bed', id: 'nowhere' });
  assert.deepEqual([fallback.source, fallback.ops[0].text], ['default', t('npc.default')]);
});

test('malformed targets and unknown npcs throw', () => {
  assert.throws(() => resolveScript(worldAt(), data, null), TypeError);
  assert.throws(() => resolveScript(worldAt(), data, { kind: 'npc' }), TypeError);
  assert.throws(() => resolveScript(worldAt(), data, { kind: 'npc', id: 'ghost' }), /no 'npcs' row with id 'ghost'/);
});

test('resolution is deterministic and never mutates the world', () => {
  const w = worldAt(20 * 60);
  w.npcs.quiet = mem({ saidLines: { g2: 1 } });
  const before = JSON.stringify(w);
  const a = npc(w, 'quiet', { atPorch: true });
  const b = npc(w, 'quiet', { atPorch: true });
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(w), before);
});

test('eventScript maps bus events to existing scripts only', () => {
  assert.equal(eventScript(data, 'loan:tier:2'), 's-beat-1');
  assert.equal(eventScript(data, 'loan:tier:3'), null);
  assert.equal(eventScript(data, 'nothing'), null);
});

test('placeholder data: a fresh world talking to ph-keeper gets the intro topic', () => {
  const reg = createRegistry(DATA);
  const r = resolveScript(worldAt(), reg, { kind: 'npc', id: 'ph-keeper' });
  assert.deepEqual([r.source, r.scriptId], ['topic', 'ph-intro']);
  assert.equal(eventScript(reg, 'loan:tier:2'), 'ph-beat-1');
});
