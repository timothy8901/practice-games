// 500 simulated battles with engine invariants (section 20 of the rules doc:
// any hang or soft-lock fails the build).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, simulateBattle } from '../sim.js';
import { MAX_TURNS } from '../engine.js';

describe('headless simulator', () => {
  const report = simulate({ n: 500, seed: 'wildshift-ci' });

  it('500 battles run with no invariant violations', () => {
    assert.equal(report.n, 500);
    assert.deepEqual(report.violations, [], report.violations.slice(0, 10).join('\n'));
  });

  it('every battle terminates well under 200 turns', () => {
    assert.ok(report.longest < MAX_TURNS, `longest ${report.longest}`);
    assert.ok(report.longest < 150, `longest ${report.longest}`);
    assert.ok(report.avgTurns < 30, `avg ${report.avgTurns}`);
    const total = Object.values(report.outcomes).reduce((a, b) => a + b, 0);
    assert.equal(total, 500);
    assert.equal(report.outcomes.draw || 0, 0, 'no battle hit the turn cap');
  });

  it('covers wins, losses and captures, and exercises the Ward readout, Scrap, Mends, Plumbline and capture events', () => {
    assert.ok(report.outcomes.win > 50);
    assert.ok(report.outcomes.loss > 50);
    assert.ok(report.outcomes.capture > 5);
    for (const t of ['ward-readout', 'blocked', 'scrap-cost', 'mend-spent', 'capture', 'capture-fail', 'capture-shake', 'decoy-pop', 'levelup', 'exp', 'payout', 'blackout', 'replace-needed', 'switch', 'status', 'crit', 'type-shift', 'read', 'charge']) {
      assert.ok(report.eventTypes.includes(t), `no ${t} event in 500 battles`);
    }
  });

  it('a battle is reproducible from its seed', () => {
    const a = simulateBattle({ seed: 'replay-7' });
    const b = simulateBattle({ seed: 'replay-7' });
    assert.equal(JSON.stringify(a.events), JSON.stringify(b.events));
    assert.equal(a.turns, b.turns);
    assert.equal(a.outcome, b.outcome);
    assert.deepEqual(a.violations, []);
    assert.ok(a.result.ended);
  });

  it('HP, PP and stats stay finite and in bounds in a long, forced-stall battle (two Ward walls)', () => {
    let worst = 0;
    for (let i = 0; i < 20; i++) {
      const r = simulateBattle({ seed: `stall-${i}`, kind: 'trainer' });
      worst = Math.max(worst, r.turns);
      assert.deepEqual(r.violations, []);
      assert.ok(r.turns < MAX_TURNS);
    }
    assert.ok(worst < MAX_TURNS);
  });
});
