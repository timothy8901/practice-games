// Shared fixture for the SYS-TOWN tests (letters, schedule, memory, threads, dayPage).
// A plain tables object (the town systems accept a Registry or plain tables), a world builder and a
// recording bus. Core day 0 = GDD day 1 (a Sunday); core day 6 = GDD day 7 (the first Saturday).
import { createNewWorld } from '../../js/state/schema.js';

export const MIN = 60;
/** Sets the world clock to core `day` at minute `minute`. */
export function at(world, day, minute) {
  world.clock.total = day * 1440 + minute;
  return world;
}

/** A fresh world on core day `day` at minute `minute`. */
export function makeWorld({ day = 0, minute = 18 * MIN + 40, seedCode = 'TOWN-TEST' } = {}) {
  return at(createNewWorld({ seedCode }), day, minute);
}

/** A bus that records `[event, payload]` pairs. */
export function recBus() {
  const events = [];
  return { events, emit: (evt, payload) => { events.push([evt, payload]); }, names: () => events.map((e) => e[0]), of: (name) => events.filter((e) => e[0] === name).map((e) => e[1]) };
}

const letterBase = (n, extra) => ({
  n, from: 'Isolde Petrel', to: 'The Keeper', date: `Ebb ${n}`, seal: 'wax-blue', body: `Letter ${n}.`, relicId: null, unlock: null, ...extra,
});

/** 20 Keeper (n 1-20), 18 family (21-38), 18 town (39-56), 2 event (57-58). */
export function serialLetters() {
  const out = [];
  for (let i = 1; i <= 20; i++) out.push(letterBase(i, { id: `k${i}`, channel: 'keeper', index: i, flags: [`sp.k${i}-read`] }));
  for (let i = 1; i <= 18; i++) {
    const n = 20 + i;
    const row = letterBase(n, { id: `f${i}`, channel: 'family', index: i, door: `door-${i}`, heirloom: `heirloom-${i}` });
    if ([1, 5, 9, 13].includes(i)) row.creature = { species: `crit-${i}`, level: 5 };
    out.push(row);
  }
  // F1 lights the Dorrows' porch; F2 goes to Odile's (dark until lit by a flag in tests)
  out[20] = { ...out[20], door: 'dorrows', lightsPorch: 'dorrows' };
  out[21] = { ...out[21], door: 'odile' };
  for (let i = 1; i <= 18; i++) out.push(letterBase(38 + i, { id: `t${i}`, channel: 'town', index: i, find: `find-${i}` }));
  out.push(letterBase(57, { id: 'e1', channel: 'event', index: 1, event: 'lantern' }));
  out.push(letterBase(58, { id: 'e2', channel: 'event', index: 2, event: 'saw-the-light' }));
  out[0] = { ...out[0], reveal: [{ op: 'setFlag', id: 'sp.k1-reveal' }] };
  return out;
}

export function makeData(extra = {}) {
  return {
    npcs: [
      {
        id: 'wren', name: 'Wren', home: 'yard', threadId: null,
        schedule: [
          { at: 6 * MIN, mapId: 'yard', x: 5, y: 4, pose: 'stand' },
          { at: 9 * MIN, mapId: 'quay', x: 10, y: 6, pose: 'path', path: 'quay-sweep', activity: 'sweeping' },
          { at: { tide: 'low' }, mapId: 'flats', x: 3, y: 9, pose: 'wander', wanderR: 3, weather: ['clear'], for: 90 },
          { at: 20 * MIN, mapId: 'quay', x: 9, y: 7, pose: 'sit', days: [0, 1, 2, 3, 4] },
          { at: 23 * MIN, mapId: 'yard', x: 2, y: 2, pose: 'sleep' },
        ],
        porch: { id: 'wren', mapId: 'town', x: 20, y: 5, facing: 'down', litAtStart: true, days: [5, 6] },
        festivals: { 'lantern-market': { mapId: 'green', x: 8, y: 8, pose: 'stand', facing: 'left' }, 'porch-supper': true },
        lines: {
          generic: [{ id: 'g1', text: 'Tally sticks never lie.' }, { id: 'g2', text: 'Pay it when you can.' }, { id: 'g3', text: 'Alder. Notch it wide.' }],
          night: ['Someone is always buying.'],
          porch: [{ id: 'p1', text: 'Sit a minute?' }],
          sweep: ['Cobbles grow sand.'],
          'weather-rain': [{ id: 'w1', text: 'Rain on the roof slates.' }],
          'lead-brine': [{ id: 'l1', text: 'Your swimmer likes the quay.' }],
          shift: [{ id: 's1', text: 'Your creature came back with wings.' }],
          gift: [{ id: 'gf1', text: 'Still thinking about that pear.', tags: ['gift:pear'] }],
          extra: [{ id: 'x1', text: 'Odd one.', tags: ['moon'] }, { id: 'n1', text: 'Morning, {npcNick}.', tags: ['nickname', 'day'] }, { id: 'k1', text: 'Back again.', tags: ['known'] }],
          flagged: [{ id: 'c1', text: 'You heard about the bell?', tags: ['generic'], cond: { flag: 'sp.bell' } }],
        },
        gifts: { love: ['pear'], like: ['plum'], dislike: ['rust'] },
      },
      {
        id: 'juniper', name: 'Juniper', home: 'pells',
        schedule: [{ at: 7 * MIN, mapId: 'pells-loft', x: 1, y: 1, pose: 'stand' }, { at: 22 * MIN + 30, mapId: 'pells-loft', x: 1, y: 2, pose: 'sleep' }],
        shopPost: { shopId: 'pells', mapId: 'pells', x: 3, y: 2, facing: 'down' },
        porch: { mapId: 'town', x: 30, y: 5, litAtStart: true },
        festivals: { 'porch-supper': true },
        lines: { generic: [{ id: 'g1', text: 'Staples never change.' }] },
      },
      {
        id: 'tully', name: 'Tully', home: 'tully-house', threadId: 'tully-mile',
        schedule: [
          { at: 6 * MIN, mapId: 'green', x: 1, y: 1, pose: 'path', path: 'laps' },
          { at: 8 * MIN, mapId: 'tully-house', x: 2, y: 2, pose: 'stand' },
          { at: 12 * MIN, mapId: 'green', x: 4, y: 4, pose: 'stand', priority: 'high', cond: { flag: 'sp.race-day' } },
          { at: 22 * MIN, mapId: 'tully-house', x: 1, y: 1, pose: 'sleep' },
        ],
        porch: { mapId: 'town', x: 40, y: 5, litAtStart: true },
        festivals: { 'porch-supper': { dx: 0, dy: 1 } },
        lines: { generic: [{ id: 'g1', text: 'Never the slowest.' }] },
      },
      {
        id: 'odile', name: 'Odile', home: 'odile-house', threadId: 'odile-lights',
        schedule: [{ at: 14 * MIN, mapId: 'point', x: 6, y: 3, pose: 'stand', activity: 'easel' }],
        porch: { mapId: 'town', x: 50, y: 5, litAtStart: false },
        lines: { generic: [{ id: 'g1', text: 'Eleven lights.' }] },
      },
      {
        id: 'linnet', name: 'Linnet', home: 'linnet-house', absent: { flag: 'sp.linnet-gone' },
        schedule: [{ at: 0, mapId: 'linnet-house', x: 1, y: 1, pose: 'stand' }],
        lines: { generic: [{ id: 'g1', text: 'Hmph.' }] },
      },
      {
        id: 'barnaby', name: 'Barnaby', home: 'archive',
        schedule: [
          { at: 9 * MIN, mapId: 'archive', x: 2, y: 2, pose: 'shop' },
          { at: { tide: 'low', offset: -30 }, mapId: 'flats', x: 7, y: 7, pose: 'wander', for: 120 },
          { at: 19 * MIN, mapId: 'archive', x: 3, y: 1, pose: 'sleep' },
        ],
        lines: { generic: [{ id: 'g1', text: 'Exhibit one.' }] },
      },
      { id: 'thessaly', name: 'Thessaly', home: 'thessaly-house', threadId: 'thessaly-bench', schedule: [{ at: 10 * MIN, mapId: 'green', x: 2, y: 6, pose: 'sit' }], lines: { generic: [] } },
      { id: 'drifter', name: 'Drifter', homeSpot: { mapId: 'quay', x: 4, y: 4, facing: 'up' }, schedule: [{ at: 12 * MIN, mapId: 'quay', x: 6, y: 6, days: [2] }], lines: {} },
      { id: 'ghost', name: 'Ghost', schedule: [], lines: {} },
    ],
    schedules: [
      { id: 'quay-sweep', kind: 'path', mapId: 'quay', points: [[10, 6], [11, 6], [11, 7]] },
      { id: 'laps', kind: 'path', mapId: 'green', points: [[1, 1], [5, 1]] },
      { id: 'night-owl', kind: 'template', entries: [{ at: 21 * MIN, pose: 'stand' }, { at: 4 * MIN, pose: 'sleep', x: 9 }] },
    ],
    shops: [
      { id: 'pells', keeper: 'juniper', hours: [8 * MIN, 22 * MIN] },
      { id: 'ludo', keeper: 'ludo', hours: [22 * MIN, 8 * MIN] },
      { id: 'always', keeper: 'x', hours: [0, 1440] },
    ],
    threads: [
      {
        id: 'tully-mile', npcId: 'tully', title: 'The Mudlark Mile',
        beats: [
          { id: 1, cond: true, script: 'tully-1' },
          { id: 2, cond: true, script: 'tully-2', advance: { days: 2 } },
          { id: 3, cond: { flag: 'sp.race' }, script: 'tully-3', porch: true, where: { mapId: 'green', x: 1, y: 1 } },
        ],
      },
      {
        id: 'odile-lights', npcId: 'odile', title: 'Twelve Lights',
        beats: [
          { id: 1, cond: true, script: 'odile-1', advance: { dayOfWeek: [0] } },
          { id: 2, cond: true, script: 'odile-2', reward: { share: false } },
        ],
      },
      {
        id: 'linnet-grub', npcId: 'linnet', kind: 'cast', title: 'The Ember Grub', involve: { flag: 'sp.dock-done' },
        beats: [{ id: 1, cond: true, script: 'linnet-1' }, { id: 2, cond: true, script: 'linnet-2', advance: { immediate: true } }],
      },
      {
        id: 'thessaly-bench', npcId: 'thessaly', kind: 'template', title: 'Template',
        beats: [{ id: 1, cond: true, script: 'th-1' }, { id: 2, cond: true, script: 'th-2' }, { id: 3, cond: true, script: 'th-3', priority: 5, npcId: 'wren' }],
      },
    ],
    letters: serialLetters(),
    ...extra,
  };
}
