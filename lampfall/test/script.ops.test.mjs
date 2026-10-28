// js/script/ops.js: the op schema table, shorthand parsing, block walking and static op checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  OPS, OP_NAMES, PURE_OPS, HOST_OPS, isPureOp, isHostOp, parseShorthand, normalizeOp, subBlocks, walkOps,
  labelsOf, validateOps,
} from '../js/script/ops.js';

// The §6.1 vocabulary, split exactly as the draft splits it.
const DRAFT_PURE = ['label', 'goto', 'call', 'end', 'if', 'branch', 'setFlag', 'inc', 'give', 'take', 'earn', 'spend',
  'addCreature', 'remember', 'thread', 'beat',
  'restartSummit']; // the Summit Bell's decline (wave 2): the beaten Keepers stand again
const DRAFT_HOST = ['say', 'choice', 'nickname', 'move', 'face', 'emote', 'teleport', 'spawn', 'despawn', 'wait', 'camera',
  'playSfx', 'music', 'stem', 'openShop', 'startBattle', 'forecast', 'letter', 'toast', 'warp', 'setTime', 'tide', 'sleep', 'save'];

test('OPS holds every §6.1 op with the right pure|host kind', () => {
  assert.deepEqual([...PURE_OPS].sort(), [...DRAFT_PURE].sort());
  assert.deepEqual([...HOST_OPS].sort(), [...DRAFT_HOST].sort());
  assert.equal(OP_NAMES.length, DRAFT_PURE.length + DRAFT_HOST.length);
  assert.ok(isPureOp('setFlag') && !isPureOp('say') && isHostOp('wait') && !isHostOp('nope'));
  assert.ok(Object.isFrozen(OPS));
  assert.equal(OPS.give.fields.item.ref, 'items');
  assert.equal(OPS.say.fields.text.req, true);
});

test('parseShorthand: speaker resolved by npc id, else kept as display name; narration otherwise', () => {
  const isNpc = (id) => id === 'wren';
  assert.deepEqual(parseShorthand('Wren: Morning, Keeper.', isNpc), { op: 'say', who: 'wren', text: 'Morning, Keeper.' });
  assert.deepEqual(parseShorthand('Old Tam: Mind the tide.', isNpc), { op: 'say', who: 'Old Tam', text: 'Mind the tide.' });
  assert.deepEqual(parseShorthand('The tide is out.'), { op: 'say', text: 'The tide is out.' });
  assert.deepEqual(parseShorthand('* Note: 3 boats'), { op: 'say', who: null, text: 'Note: 3 boats' });   // narration says so (MID-16)
  assert.deepEqual(parseShorthand('Time:12:00'), { op: 'say', text: 'Time:12:00' });  // no space after colon
  assert.deepEqual(parseShorthand('Wren: a|b~c', isNpc).text, 'a|b~c');               // page breaks / beats kept
  assert.throws(() => parseShorthand(3), TypeError);
});

test('normalizeOp passes objects through and rejects junk', () => {
  const op = { op: 'wait', ms: 10 };
  assert.equal(normalizeOp(op), op);
  assert.equal(normalizeOp('Hi.').op, 'say');
  assert.throws(() => normalizeOp({ ms: 1 }), TypeError);
  assert.throws(() => normalizeOp(null), TypeError);
});

test('subBlocks / walkOps / labelsOf follow if, branch and choice blocks', () => {
  const script = [
    { op: 'if', cond: true, then: [{ op: 'label', id: 'in-then' }], else: ['x'] },
    { op: 'branch', on: 'dial', cases: { a: [{ op: 'label', id: 'in-a' }], b: [] } },
    { op: 'choice', options: [{ text: 'o', then: [{ op: 'label', id: 'in-opt' }] }, { text: 'p', goto: 'end' }] },
    { op: 'label', id: 'end' },
  ];
  assert.equal(subBlocks(script[0]).length, 2);
  assert.equal(subBlocks(script[1]).length, 2);
  assert.equal(subBlocks(script[2]).length, 2);
  assert.deepEqual(subBlocks({ op: 'say', text: '' }), []);
  const paths = [];
  walkOps(script, (op, path) => paths.push(`${op.op}@${path.join('.')}`));
  assert.ok(paths.includes('label@0.0.0') && paths.includes('say@0.1.0') && paths.includes('label@1.0.0') && paths.includes('label@2.0.0'));
  assert.deepEqual([...labelsOf(script)].sort(), ['end', 'in-a', 'in-opt', 'in-then']);
});

test('validateOps: a well-formed script passes', () => {
  const has = (table, id) => ({ items: ['lantern'], scripts: ['other'] })[table]?.includes(id) ?? false;
  const r = validateOps([
    'Wren: hi',
    { op: 'choice', options: [{ text: 'a', goto: 'x' }, { text: 'b' }], defaultIndex: 1 },
    { op: 'label', id: 'x' },
    { op: 'give', item: 'lantern', n: 2 },
    { op: 'call', script: 'other' },
    { op: 'face', who: 'wren', dir: 'player' },
    { op: 'camera', to: [3, 4] },
    { op: 'end' },
  ], { scriptId: 's', has });
  assert.deepEqual(r, { errors: [], warnings: [] });
});

test('validateOps: unknown ops, missing/typed fields, enums, labels, refs, defaultIndex, startBattle', () => {
  const has = (table, id) => table === 'species' && id === 'pip';
  const { errors, warnings } = validateOps([
    { op: 'dance' },
    { op: 'say' },
    { op: 'wait', ms: 'soon' },
    { op: 'face', who: 'x', dir: 'north' },
    { op: 'goto', id: 'nowhere' },
    { op: 'give', item: 'ghost' },
    { op: 'choice', options: [{ text: 'a' }], defaultIndex: 3 },
    { op: 'startBattle' },
    { op: 'startBattle', wild: { speciesId: 'ghost', level: 3 } },
    { op: 'camera', to: { x: 1 } },
    { op: 'say', text: 'x', colour: 'red' },
    42,
  ], { scriptId: 't', has });
  const expect = [
    "scripts:t[0]: unknown op 'dance'",
    "scripts:t[1]: say: missing required field 'text'",
    "scripts:t[2]: wait: field 'ms' must be a finite number",
    "scripts:t[3]: face: field 'dir' must be one of up down left right player",
    "scripts:t[4]: goto 'nowhere': no such label in this script",
    "scripts:t[5]: give.item 'ghost' is not in items",
    'scripts:t[6]: choice defaultIndex 3 out of range',
    'scripts:t[7]: startBattle needs trainer or wild',
    "scripts:t[8]: startBattle.wild.speciesId 'ghost' is not in species",
    "scripts:t[9]: camera: field 'to' must be a region id, 'player' or [x, y]",
    'scripts:t[11]: op must be a string or {op}, got 42',
  ];
  for (const e of expect) assert.ok(errors.includes(e), `missing ${e}\n${errors.join('\n')}`);
  assert.ok(warnings.includes("scripts:t[10]: say: unknown field 'colour'"));
  assert.ok(warnings.includes("scripts:t: no 'end' op (the script ends when it runs off the last op)"));
});

test('validateOps: conds are checked through opts.validateCond, nested blocks are walked', () => {
  const { errors } = validateOps([
    { op: 'if', cond: { bad: 1 }, then: [{ op: 'goto', id: 'gone' }] },
    { op: 'choice', options: [{ text: 'a', cond: { bad: 2 } }] },
    { op: 'end' },
  ], { scriptId: 'c', validateCond: (c) => (c && c.bad ? [`bad ${c.bad}`] : []) });
  assert.ok(errors.includes('scripts:c[0]: if.cond: bad 1'));
  assert.ok(errors.includes("scripts:c[0.0.0]: goto 'gone': no such label in this script"));
  assert.ok(errors.includes('scripts:c[1]: choice option 0 cond: bad 2'));
});

test('validateOps rejects a non-array script', () => {
  assert.deepEqual(validateOps('nope', { scriptId: 'z' }).errors, ['scripts:z: must be an array of ops']);
});
