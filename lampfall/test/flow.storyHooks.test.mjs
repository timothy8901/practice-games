import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installStoryHooks } from '../js/systems/flow/storyHooks.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { setFlag } from '../js/systems/flags.js';
import * as loans from '../js/systems/loans.js';

test('story errands credit loan exactly once and event letters enter the mailbox', () => {
  const store = createStore(createNewWorld({ seedCode: 'HOOKS' }), { strict: true });
  const G = { store, get world() { return store.world; }, bus: store.bus, data: createRegistry(DATA_CONTENT) };
  const off = installStoryHooks(G);
  assert.equal(installStoryHooks(G), off, 'one listener across scene resumes');
  const before = loans.balance(store.world, { data: G.data });
  store.tx('script', w => setFlag(w, 'sys.errand.crate', true, { bus: G.bus }));
  assert.equal(loans.balance(store.world, { data: G.data }), before - 500);
  store.tx('script', w => setFlag(w, 'sys.errand.crate', true, { bus: G.bus }));
  assert.equal(store.world.loans.errands.filter(x => x === 'crate').length, 1);
  store.tx('script', w => setFlag(w, 'sys.deliver.saw-the-light', true, { bus: G.bus }));
  assert.ok(store.world.letters.got.includes(58));
  assert.ok(store.world.letters.mailbox.includes(58));
  off();
});
