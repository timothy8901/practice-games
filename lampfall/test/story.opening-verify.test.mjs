// Verifier regressions for the first-hour lane (FH-01, FH-04, FH-06 Read card): the Read card's
// matchups come from the type chart, the reeds lesson really loops when driven through the runner,
// and both checkpoints resume on the line after the save.
// Run: node --test test/story.opening-verify.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CONTENT } from '../js/data/content.js';
import { createRegistry } from '../js/data/registry.js';
import { createRunner } from '../js/script/runner.js';
import { createNewWorld } from '../js/state/schema.js';
import { TYPE_CHART } from '../js/data/types.js';
import { pagesFor } from '../js/scenes/dialogue.js';

const reg = createRegistry(DATA_CONTENT);
const STUBS = { give: () => {}, take: () => {}, earn: () => {}, spend: () => {}, addCreature: () => {} };
function world() {
  const w = createNewWorld({ seedCode: 'FLUX-XW5F-EFFA' });
  w.party = [{ uid: 'c1', nickname: 'PUDDLE', speciesId: 'sloshkin' }];
  return w;
}
const runner = (id, w, state = null) => createRunner(reg.get('scripts', id), { world: w, data: reg, scriptId: id, systems: STUBS }, state);

test('the Read card names every type its starter lands Strong on, from the type chart, on one page', () => {
  const w = world();
  for (const [starter, type, name] of [['sloshkin', 'Brine', 'Sloshkin'], ['scrapling', 'Grit', 'Scrapling'], ['reedkit', 'Moss', 'Reedkit']]) {
    w.flags['np.wren.starter'] = starter;
    const r = runner('corin-reading-glass', w);
    let q = r.step(), card = null;
    for (let i = 0; i < 40 && !('done' in q); i++) {
      if (q.op === 'say' && /^READ:/.test(q.text)) { card = q.text; break; }
      q = r.step(q.op === 'choice' ? 0 : q.op === 'startBattle' ? null : undefined);
    }
    assert.ok(card, `${starter}: the Read card shows`);
    assert.match(card, new RegExp(`${name}\\. ${type}\\.`));
    const strong = Object.entries(TYPE_CHART[type]).filter(([, v]) => v > 1).map(([k]) => k);
    const said = /Strong on ([^.]+)\./.exec(card)[1].split(/, | and /);
    assert.deepEqual([...said].sort(), [...strong].sort(), `${starter}: ${card}`);
    assert.equal(pagesFor(card, true).length, 1, `${starter}: the card fits one page`);
  }
});

test('driven through the runner, the reeds lesson offers the Tossup again until Later', () => {
  const w = world();
  const r = runner('corin-capture-stance', w);
  let q = r.step(), battles = 0, choices = 0;
  for (let i = 0; i < 80 && !('done' in q); i++) {
    let a;
    if (q.op === 'startBattle') { battles++; assert.deepEqual(q.wild.moves, ['settle']); a = null; }
    else if (q.op === 'choice') { choices++; assert.match(q.options[0].text, /Again/); a = choices < 3 ? 0 : 1; }
    q = r.step(a);
  }
  assert.ok('done' in q, 'the script ends after Later');
  assert.equal(battles, 3, 'Again twice: three Tossups');
  assert.equal(w.flags['sp.capture-stance'], true, 'Later closes the lesson');
});

test('the lesson is not marked done while the Tossup got away and the player says Again', () => {
  const w = world();
  const r = runner('corin-capture-stance', w);
  let q = r.step();
  while (q.op !== 'startBattle') q = r.step();
  q = r.step(null);
  assert.equal(q.op, 'choice');
  assert.notEqual(w.flags['sp.capture-stance'], true);
});

for (const [id, after] of [['starter-choice', /You say the name out loud/], ['linnet-dock-after', /singed, not hurt/]]) {
  test(`${id}: a save at its checkpoint resumes on the line after it`, () => {
    const w = world();
    w.flags['np.wren.starter'] = 'sloshkin';
    const r = runner(id, w);
    let q = r.step();
    for (let i = 0; i < 60 && q.op !== 'save'; i++) q = r.step(q.op === 'choice' ? (q.defaultIndex ?? 0) : q.op === 'nickname' ? 'PUDDLE' : undefined);
    assert.equal(q.op, 'save');
    const st = JSON.parse(JSON.stringify(r.save()));
    const again = runner(id, w, st);
    const next = again.step();
    assert.notEqual(next.op, 'save', 'the checkpoint does not save again on resume');
    let line = next;
    for (let i = 0; i < 4 && line.op !== 'say'; i++) line = again.step();
    assert.match(line.text, after);
  });
}
