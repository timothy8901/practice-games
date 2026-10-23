import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerRows } from '../js/scenes/ledger.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA_CONTENT } from '../js/data/content.js';
import * as loans from '../js/systems/loans.js';
const data = createRegistry(DATA_CONTENT);
test('ledger never offers an unaffordable payment; final payment is capped at remaining balance', () => {
  const world = createNewWorld({seedCode:'LEDGER'});
  world.wallet.main = 1000;
  assert.deepEqual(ledgerRows(world,data).map(r=>r.amount), [500,1000]);
  world.loans.paid = 5800;
  assert.deepEqual(ledgerRows(world,data).map(r=>r.amount), [200]);
});
test('room selection removes chosen rooms and Commons labels resolve real project names', () => {
  const world = createNewWorld({seedCode:'LEDGER'});
  world.loans.tier = 3;
  assert.equal(ledgerRows(world,data,1).length,6);
  assert.equal(loans.chooseCommission(world,'cellar',{data}).ok,true);
  assert.equal(ledgerRows(world,data,1).length,5);
  assert.ok(!ledgerRows(world,data,1).some(r=>r.id==='cellar'));
  const rows = ledgerRows(world,data,2);
  assert.equal(rows.length,6);
  assert.ok(rows.every(r=>!r.label.includes('-')));
});
