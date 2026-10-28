// Every resident thread can be finished in play (MID-03, MID-02, LG-RN35/RN62): each of the ten
// threads is driven from beat 1 to done through the real systems (see test/fixtures/townDriver.mjs):
// neighbour talk resolves the beat topic (scriptHost.resolveTalk -> script/registry), the beat script
// runs in the real runner with the production bindings (scriptHost.scriptSystems), family letters
// reach Hesper's counter at 18:00 (dayFlow.eveningLetter), are carried, read and handed in at their
// door (interactFlow.deliverCarriedTo), Keeper letters come at 06:00, and a finished lead thread pays
// its resident share (storyHooks).
// Run: node --test test/flow.threads-complete.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CONTENT } from '../js/data/content.js';
import * as threads from '../js/systems/threads.js';
import * as loans from '../js/systems/loans.js';
import * as shops from '../js/systems/shops.js';
import * as bag from '../js/systems/bag.js';
import { makeGame, prepare, driveThread } from './fixtures/townDriver.mjs';

const LEAD = ['mudlark-mile', 'twelve-lights', 'oyster-boat', 'the-fence', 'heirlooms-going-home', 'the-bell'];

describe('every thread can be finished', () => {
  for (const def of DATA_CONTENT.threads ? Object.values(DATA_CONTENT.threads) : []) {
    it(`${def.id}: beat 1 to done through talk, scripts and letters`, () => {
      const G = makeGame(`T-${def.id}`.slice(0, 12).toUpperCase());
      prepare(G);
      const setup = (g, nextBeat) => {
        // the fence's timber: bought at Pell's like a player would
        if (def.id === 'the-fence' && nextBeat === 3 && bag.count(g.world, 'timber') < 3) {
          g.store.tx('test:timber', (w) => shops.buy(w, 'pells-sundries', 'timber', 3, { data: g.data, bus: g.bus, anyHour: true }));
        }
        // Tamsin's nameboard beat is read on Drownwood
        if (def.id === 'oyster-boat' && nextBeat === 3) g.store.tx('test:map', (w) => { w.player.mapId = 'drownwood'; });
      };
      const before = loans.balance(G.world, { data: G.data });
      const jar = G.world.loans.commons.jar;
      const seen = driveThread(G, def.id, { setup });
      const last = def.beats[def.beats.length - 1].id;
      assert.deepEqual(seen.map((s) => s.beat), def.beats.map((b) => b.id), `${def.id} ran every beat in order`);
      assert.equal(threads.stateOf(G.world, def.id).done, true);
      assert.equal(seen[seen.length - 1].beat, last);
      if (LEAD.includes(def.id)) {
        assert.ok(G.world.loans.residentShares.includes(def.id), `${def.id} paid its resident share`);
        const paid = before - loans.balance(G.world, { data: G.data }) + (G.world.loans.commons.jar - jar);
        assert.ok(paid > 0, `${def.id}: the loan dropped or the jar rose`);
      } else {
        assert.ok(!G.world.loans.residentShares.includes(def.id), `${def.id} is not a lead thread`);
      }
    });
  }
});
