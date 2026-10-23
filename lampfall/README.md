# Lampfall — A Keeper’s Season on the Brindle Isles

Read the odds. Pay what’s owed. Keep the light.

A browser creature RPG and harbor life game combining the Wildshift and Porchlight pitches. Explore the Brindle Isles, catch and Shift creatures, challenge six Spires, fish the quay, repay seven interest-free loans, and uncover the old Keeper’s letters. The lighthouse finale leads through the Reading and credits to a continuing season in Pellwick.

## Play locally

On macOS, double-click **Play Lampfall.command**. Keep its terminal window open while playing. The launcher starts a private local server and opens the game in your browser. Requires Python 3.

Or run `python3 serve.py 8000` from this folder, then open <http://127.0.0.1:8000/>. The game needs a web server because it uses browser modules. It has no build step, external asset downloads, or runtime JavaScript dependencies.

## Controls

| Action | Keyboard |
| --- | --- |
| Move | Arrows or WASD |
| Confirm / interact | Z, Enter, or Space |
| Back | X or Escape |
| Pause menu | Escape or P |
| Run | Shift |
| Tools | C; hold for the tool ring |
| Map | M |
| Field view / Read | V |
| Full screen | F; Escape exits |

Controller and touch controls are supported. Settings includes key remapping, play speed, fishing assistance, reduced motion, larger text, contrast, sound and captions. Saves stay in this browser; the save screen exports and imports a save string. Keep the same local address/port to reuse browser saves.

## Development and verification

Use Node 22 or later for the test tools. Run `bash tools/check.sh` for data validation, ownership and art checks, module imports, and the complete unit suite. `node tools/validate-content.mjs` checks the assembled game content; `node tools/map-reachability.mjs` proves the tide-dependent routes. Browser QA uses Playwright; set `PLAYWRIGHT_EXECUTABLE_PATH` if using an existing installed Chromium.

The game is not deployed. The repository’s Pages workflow publishes only when changes land on `main`.

The authoritative design is `design/GDD-00-decisions.md`; extracted pitch documents and all chapter notes remain in `design/`. `progress.md` records this continuation and the verification boundary.

## Authoring guide (ARCHITECTURE-DRAFT §14, copied verbatim)

## 14. How chapter writers must format content

Rules for every example: kebab-case ids, frozen exports, one entry per file where the manifest says so, one
index line to register it, then `node tools/validate-data.mjs`. Never edit `js/systems`. Names and
numbers below are placeholders, not decisions.

### 14.1 Species (one form) — `js/data/species/<family>.js`

```js
import { sp } from './_helpers.js';   // sp(id, name, types, familyId, stage, [hp,atk,def,spa,spd,spe], ability, learnset, heartmark, catchRate, expYield, growth, flags)
export const forms = [
  sp('sloshkin', 'Sloshkin', ['Brine'], 'sloshkin', 1, [60, 62, 55, 50, 55, 38], 'shoresense',
    [[1, 'tap'], [1, 'salt-spray'], [5, 'undertow'], [9, 'settle'], [17, 'shellguard']],
    'undertow', 45, 64, 'medium-slow', { roleTag: 'starter_base' }),
];
```

Fields: `id, name, types[1..2], familyId, stage 0..4, base, ability, learnset [[level, moveId]], heartmark
(moveId | null), catchRate 3..255, expYield, growth 'fast'|'medium-fast'|'medium-slow'|'slow', flags`.

### 14.2 Family (Shift table) — same file

```js
export const family = {
  id: 'sloshkin', name: 'Sloshkin line', windows: [9, 20, 34],        // curve levels where a window opens
  shiftTable: {                                                       // per current form: pools by direction, weights relative
    sloshkin:  { up: [{ form: 'skeinwing', w: 3 }, { form: 'brinelance', w: 1 }], side: [{ form: 'puddlepip', w: 1 }], down: [] },
    skeinwing: { up: [], side: [{ form: 'vesperay', w: 1 }], down: [{ form: 'sloshkin', w: 1 }] },
  },
  star: 'vesperay',                                                   // optional star-touched form
};
```

### 14.3 Move — `js/data/moves/<type>.js`

```js
import { m } from './_helpers.js';   // m(id, name, type|null, category, power, accuracy|null, pp|null, priority, effect, text, signature?)
export default [
  m('undertow', 'Undertow', 'Brine', 'physical', 65, 100, 15, 0,
    { stat: [{ target: 'foe', stat: 'spe', stages: -1 }], contact: true }, "Lowers the target's Speed one stage.", 'sloshkin'),
];
```

Effect keys must be in `EFFECT_KEYS` (§5.1). `accuracy: null` = never misses; `pp: null` only for Scrap.

### 14.4 Map — `js/data/maps/<map>.js`

```js
export default {
  id: 'town-quay', name: 'The Quay', kind: 'exterior', region: 'town', w: 24, h: 12,
  legend: { '=': 'quay-cobble' },                      // extends DEFAULT_LEGEND (D deep, S shallows, A sand, W wet-sand, E causeway, G grass, T tall-grass, P path, O cobbles, K pier ...)
  ground: [
    'DDDDDDDDDDDDSSSSSSAAAAAA',
    'DDDDDDDDDSSSSSSAAAAAGGGG',
    // ... 12 rows of 24 chars
  ],
  overlay: null,                                       // optional layers may be omitted
  props: [{ art: 'lighthouse', x: 20, y: 0 }],
  entities: [
    { kind: 'npc', id: 'wren', x: 10, y: 6 },          // placement comes from her schedule; this is the fallback
    { kind: 'tree', id: 'pear-1', x: 15, y: 4, fruit: 'pear' },
    { kind: 'sign', id: 'quay-sign', x: 12, y: 7, text: 'Quay. Mind the tide.' },
  ],
  triggers: [{ x: 11, y: 8, kind: 'use', id: 'mailbox', verb: 'mailbox' }],
  warps: [{ x: 9, y: 5, to: { mapId: 'int-cottage', x: 4, y: 7, facing: 'up' }, kind: 'door', sfx: 'doorOpen' }],
  spawns: [{ area: 'grass', table: 'town-grass', rate: 0.08 }],
  regions: { porch: { x: 8, y: 5, w: 4, h: 2 } },
  entry: { x: 10, y: 9, facing: 'up' },
};
```

### 14.5 NPC with schedule, topics and lines — `js/data/npcs/<npc>.js`

```js
export default {
  id: 'wren', name: 'Wren Hearthwright', species: 'beaver', portrait: 'wren', sprite: 'beaver-f', home: 'int-yard',
  threadId: 'wren-tally',
  schedule: [
    { at: 6 * 60,  mapId: 'int-yard',  x: 5, y: 4, pose: 'stand' },
    { at: 9 * 60,  mapId: 'town-quay', x: 10, y: 6, pose: 'sweep', path: 'quay-sweep' },
    { at: { tide: 'low' }, mapId: 'town-flats', x: 3, y: 9, pose: 'wander', wanderR: 3, cond: { weather: ['clear', 'mist'] } },
    { at: 20 * 60, mapId: 'town-quay', x: 9, y: 7, pose: 'sit', days: [0, 1, 2, 3, 4] },
    { at: 23 * 60, mapId: 'int-yard',  x: 2, y: 2, pose: 'sleep' },
  ],
  topics: [
    { id: 'first-loan', cond: { not: { flag: 'sp.loan-explained' } }, script: 'wren-loan-intro', priority: 10, once: true },
    { id: 'pay-reminder', cond: { loan: { paid: false } }, script: 'wren-pay', priority: 2, repeatDays: 1 },
  ],
  lines: {
    generic: [{ id: 'g1', text: 'Tally sticks never lie, Keeper.' }, { id: 'g2', text: 'Dad says the light used to hum. I was three.' }],
    sweep: ['Cobbles grow sand overnight. Nobody knows how.'],
    night: ['Someone is always buying, even now.'],
    porch: ['{player}. Sit a minute?'],
  },
};
```

### 14.6 Script — `js/data/scripts/<chapter>.js`

```js
export default {
  'wren-loan-intro': [
    "Wren: You'll want a roof before the Ebb wind. Interest-free; seven tiers.",
    { op: 'choice', options: [
      { text: 'Show me the ledger.', goto: 'ledger' },
      { text: 'Later.', goto: 'later' },
    ], defaultIndex: 1 },
    { op: 'label', id: 'ledger' },
    { op: 'move', who: 'wren', path: 'LLU', wait: true },
    { op: 'give', item: 'tally-stick', n: 1 },
    { op: 'setFlag', id: 'sp.loan-explained' },
    { op: 'thread', id: 'wren-tally', beat: 1 },
    { op: 'goto', id: 'done' },
    { op: 'label', id: 'later' },
    "Wren: The sticks will wait. The tide won't.",
    { op: 'label', id: 'done' }, { op: 'end' },
  ],
};
```

### 14.7 Life thread — `js/data/threads/<thread>.js`

```js
export default {
  id: 'wren-tally', npcId: 'wren', title: 'Seven Notches',
  beats: [
    { id: 1, cond: { loan: { tier: 2 } }, script: 'wren-tally-1', advance: { dayOfWeek: [0] } },
    { id: 2, cond: { all: [{ thread: { id: 'wren-tally', beat: 1 } }, { letter: { read: 12 } }] }, script: 'wren-tally-2', where: { mapId: 'town-point', x: 6, y: 3 }, reward: { share: true } },
  ],
};
```

### 14.8 Letter — `js/data/letters/<chapter>.js`

```js
export default [
  { n: 1, from: 'Mabry Coil', to: 'The Keeper, Point Cottage', date: 'Ebb 3, thirty years gone', seal: 'wax-blue',
    body: 'The light held through the first gale. I counted eleven boats home. The twelfth was yours.|Write when the causeway dries.',
    relicId: null, unlock: null,                       // default unlock: previous letter read
    reveal: [{ op: 'setFlag', id: 'sp.letter-1-read' }] },
];
```

### 14.9 Shop — `js/data/shops.js`

```js
export const SHOPS = Object.freeze([
  { id: 'chandlery', keeper: 'tam', hours: [7 * 60, 21 * 60],
    stock: [{ item: 'lantern-1' }, { item: 'lantern-2', cond: { badge: 2 } }, { item: 'starsalt', rotate: 'daily', qty: 3 }],
    buys: ['fish', 'fruit', 'relics'], priceMult: 1.0, nightKeeper: 'hesper' },
]);
```

### 14.10 Trainer — `js/data/trainers.js`

```js
export const TRAINERS = Object.freeze([
  { id: 'linnet-1', name: 'Linnet Rask', title: 'Rival', class: 'rival', portrait: 'linnet',
    party: [{ species: 'scrapling', level: 6 }, { species: 'wirewhisk', level: 5, moves: ['arc-ping', 'jolt'] }],
    items: [{ id: 'salve', heal: 20 }], ai: 'trainer', payout: 300, tacticTag: 'rush',
    scripts: { before: 'linnet-1-before', afterWin: 'linnet-1-win', afterLoss: 'linnet-1-loss' } },
]);
```

### 14.11 Encounter table — `js/data/encounters.js`

```js
export const ENCOUNTERS = Object.freeze({
  'town-grass': [
    { species: 'puddlepip', levels: [2, 4], w: 40 },
    { species: 'wirewhisk', levels: [3, 5], w: 25 },
    { species: 'chillnub', levels: [3, 5], w: 20, cond: { phase: ['night', 'evening'] } },
    { species: 'squallcoil', levels: [30, 30], w: 0.1, errant: true, cond: { weather: ['storm'] } },
  ],
});
```

### 14.12 Item and collection rows — `js/data/items.js`, `js/data/collections.js`

```js
{ id: 'lantern-1', name: 'Lantern', pocket: 'catch', price: 250, sell: 125, stack: 20, use: 'capture:1', oneOfAKind: false, text: 'Shows the odds before you commit.' }
{ id: 'pearlfin', name: 'Pearlfin', kind: 'fish', where: ['shallows', 'river'], when: { phase: ['dawn', 'dusk'] }, tide: 'any', shadow: 'small', size: [12, 30], tell: 'two short feints then a long pull', price: 90 }
```

---

