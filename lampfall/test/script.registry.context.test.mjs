// js/script/registry.js step (5b): the tagged line pools (weather, lead, gift, known, tide, lit,
// loan, badge, shift) reach the player through memory.pickLine, honour each line's tags and cond,
// are taken once per noRepeatDays, and never outrank a pose, porch talk or a topic.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DATA_CONTENT } from '../js/data/content.js';
import { createRegistry } from '../js/data/registry.js';
import { resolveScript } from '../js/script/registry.js';
import { createNewWorld } from '../js/state/schema.js';
import { noRepeatDays } from '../js/data/tuning.js';
import * as sel from '../js/state/selectors.js';

const data = createRegistry(DATA_CONTENT);
const npcTarget = (id, extra = {}) => ({ kind: 'npc', id, mapId: 'pellwick', ...extra });

function world(minute = 14 * 60, day = 5) {
  const w = createNewWorld({ seedCode: 'FLUX-4KNZ-CH4G' });
  w.clock.total = day * 1440 + minute;
  return w;
}
const noTopics = (w, id) => {
  // Every topic of `id` marked said today, so only line pools remain.
  const npc = data.get('npcs', id);
  w.npcs[id] = { ...(w.npcs[id] ?? {}), saidLines: Object.fromEntries((npc.topics ?? []).map((t) => [t.id, sel.day(w)])) };
  if (npc.threadId) w.threads[npc.threadId] = { beat: 99, done: true };
};

test('a rain line from a rich module reaches the player on a rainy afternoon', () => {
  const w = world();
  noTopics(w, 'tamsin');
  Object.assign(w.weather, { today: 'rain', current: 'rain' });
  const r = resolveScript(w, data, npcTarget('tamsin'));
  assert.equal(r.lineId, 'w-rain', JSON.stringify(r));
  // said today: the next talk falls through to an ordinary line, not the same rain line
  w.npcs.tamsin.saidLines['w-rain'] = sel.day(w);
  const again = resolveScript(w, data, npcTarget('tamsin'));
  assert.notEqual(again.lineId, 'w-rain');
});

test('context lines respect their cond (no lit-beam line before the Relighting)', () => {
  const w = world();
  noTopics(w, 'wren');
  for (let i = 0; i < 40; i++) {
    const r = resolveScript(w, data, npcTarget('wren'));
    assert.ok(!/^r\d$/.test(r.lineId), `relit line ${r.lineId} before the Relighting`);
    w.npcs.wren.saidLines[r.lineId] = sel.day(w);
  }
});

test('a pose line and porch talk still outrank context lines', () => {
  const w = world(3 * 60);
  noTopics(w, 'tamsin');
  Object.assign(w.weather, { today: 'rain', current: 'rain' });
  assert.equal(resolveScript(w, data, npcTarget('tamsin', { pose: 'sleep' })).source, 'schedule');
});

test('once said, a context line waits noRepeatDays before it can return', () => {
  const w = world();
  noTopics(w, 'tamsin');
  Object.assign(w.weather, { today: 'fog', current: 'fog' });
  const day = sel.day(w);
  w.npcs.tamsin.saidLines['w-fog'] = day;
  assert.notEqual(resolveScript(w, data, npcTarget('tamsin')).lineId, 'w-fog');
  assert.ok(noRepeatDays > 0);
});
