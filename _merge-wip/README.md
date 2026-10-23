# GAME (working title) — merged WILDSHIFT × PORCHLIGHT

<!-- [GDD] title, folder name and save prefix come from the design panel; see config.js -->

A browser game: creature-collecting RPG with random, odds-visible form Shifts, inside a cozy harbor
town with a tide, loans and morning letters. Vanilla JS ES modules, Canvas 2D, WebAudio, no build
step, no dependencies. The authoritative design is `ARCHITECTURE-DRAFT.md` (scratchpad) and the core
contract is `docs-core-contract.md`.

## Run

    python3 serve.py 8000        # then open http://127.0.0.1:8000/

Any static server works (ES modules need http://, not file://).

## Controls

| Action  | Keyboard                    | Gamepad | Touch  |
| ------- | --------------------------- | ------- | ------ |
| move    | Arrows / WASD               | d-pad / left stick | d-pad |
| confirm | Z / Enter / Space           | A       | A      |
| cancel  | X / Esc / Backspace         | B       | B      |
| menu    | Esc / Enter (in the field)  | Start   | menu   |
| run     | Shift                       | RT      |        |
| tool    | C (hold opens the ring)     | X       |        |
| map     | M                           | Y       |        |
| log     | Tab                         | LT      |        |

The touch overlay appears on touch devices or with `?touch=1`.

## Debug flags (URL query)

`debug=1 seed=CODE skipTitle=1 speed=8 touch=1|0 scale=integer|fit slot=auto:1 mute=1 noanim=1
strict=1 scene=<name>&trainer=<id>`

With `?debug=1` (or on localhost) `window.__game` is installed (`js/debug/hook.js`, draft §11):
`state() warp() give() earn() setTime() setTide() flag() flags() speed() skipAnims() press() tap()
idle() scene() stack() text() save() load() step() pause() resume() marker() errors perf() validate()
rng() push()`. Every mutating hook runs through `store.tx`, so events and autosave behave as in play.
`give` and `earn` run a day-1 fallback until RULES-ECON rebinds them; the other lane hooks
(`addCreature heal battle wild forceForecast deliverLetter sleep runScript`) throw a readable
"not wired" error until that lane calls `__game.bind(name, fn)`. `setTide` needs
`core/time.freezeTide` (draft §13.6, owner CORE). The perf overlay (top right) shows fps, update and
draw ms, drawImage count, the scene stack and `validateWorld` problems.

## Tests

    tools/check.sh                    # validate-data + lint-owners + smoke-import + every unit test (per-file summary)
    node --test test/*.test.mjs       # every unit test in one run (Node 22 does not accept a bare directory)
    node tools/smoke-import.mjs       # imports every js/**/*.js under Node (rule 2 of the draft)

Headless browser check (Playwright, not a dependency of the game):
`node tools/pw-harness.mjs 'http://127.0.0.1:8777/_merge-wip/?debug=1&skipTitle=1' out/ script.json`
(reports console errors and writes screenshots; `?strict=1` adds the store write guard).

## Layout

`index.html css/ js/main.js js/config.js js/core/ (frozen engine) js/state/ js/data/ js/systems/
js/battle/ js/world/ js/render/ js/ui/ js/scenes/ js/art/ js/audio/ js/debug/ tools/ test/`.
`proto/` holds the prototypes being adopted (draft §8.4). Checkpoint 0 status, how each Tier-1 lane
plugs in, and open deviations: `docs-checkpoint0.md`.

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

