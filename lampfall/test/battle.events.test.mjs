// js/battle/events.js: the event contract the battle scene animates. Every event a long
// simulated run emits must match it, and every listed type must actually be emittable.
// Run: node --test test/battle.events.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_TYPES, EVENT_FIELDS, OUTCOMES, BLOCK_REASONS, isEventType, checkEvent } from '../js/battle/events.js';
import { simulate } from './fixtures/battle/sim.mjs';
import { mk, duel, ofType, constRng, DATA } from './fixtures/battle/helpers.mjs';
import { createBattle } from '../js/battle/engine.js';

describe('the contract', () => {
  it('lists unique types, each with a field spec', () => {
    assert.equal(new Set(EVENT_TYPES).size, EVENT_TYPES.length);
    assert.ok(EVENT_TYPES.length >= 40);
    for (const t of EVENT_TYPES) assert.ok(isEventType(t) && typeof EVENT_FIELDS[t] === 'object', t);
    assert.equal(isEventType('explode'), false);
    assert.equal(isEventType('toString'), false, 'no prototype leaks');
    assert.deepEqual(OUTCOMES, ['win', 'loss', 'capture', 'run', 'holdout', 'draw']);
    assert.ok(BLOCK_REASONS.includes('ward') && BLOCK_REASONS.includes('sodden'));
  });

  it('checkEvent accepts a valid event and names each problem of a bad one', () => {
    assert.deepEqual(checkEvent({ type: 'turn', n: 3 }), []);
    assert.deepEqual(checkEvent({ type: 'end', outcome: 'win', winner: null, text: 'x' }), []);
    assert.deepEqual(checkEvent(null), ['event is not an object']);
    assert.deepEqual(checkEvent({ type: 'boom' }), ['unknown event type "boom"']);
    assert.deepEqual(checkEvent({ type: 'turn' }), ['turn: missing n']);
    assert.deepEqual(checkEvent({ type: 'turn', n: NaN }), ['turn.n should be number, got null']);
    assert.deepEqual(checkEvent({ type: 'run', side: 2, success: true, text: 'x' }), ['run.side should be side, got 2']);
    assert.deepEqual(checkEvent({ type: 'stance', on: true, text: null }), ['stance.text is null']);
    assert.deepEqual(checkEvent({ type: 'end', outcome: 'tie', winner: 0, text: 'x' }), ['end.outcome: unknown value "tie"']);
    assert.deepEqual(checkEvent({ type: 'blocked', side: 0, target: 'a', reason: 'luck', text: 'x' }), ['blocked.reason: unknown value "luck"']);
    assert.deepEqual(checkEvent({ type: 'reveal', side: 0, target: 'a', source: 's', moves: 'tap', text: 'x' }), ['reveal.moves should be array, got "tap"']);
  });
});

describe('the engine honours the contract', () => {
  const report = simulate({ n: 600, seed: 'events-contract' });

  it('600 simulated battles: every event matches (the simulator checks each one) and nothing unknown is emitted', () => {
    assert.deepEqual(report.violations, [], report.violations.slice(0, 10).join('\n'));
    for (const t of report.eventTypes) assert.ok(isEventType(t), t);
  });

  it('every listed type is emitted somewhere: the run above plus targeted battles for the rare ones', () => {
    const seen = new Set(report.eventTypes);
    const add = (evs) => evs.forEach((e) => { assert.deepEqual(checkEvent(e), [], JSON.stringify(e)); seen.add(e.type); });
    const wild = duel(mk('sloshkin', 20, ['tap']), mk('tossup', 20, ['tap']), { kind: 'wild', foeAi: () => ({ type: 'move', move: 0 }) });
    add(wild.setCaptureStance(true));
    add(wild.read(0));
    const run = duel(mk('wirewhisk', 50, ['tap']), mk('tossup', 5, ['tap']), { kind: 'wild', foeAi: () => ({ type: 'move', move: 0 }) });
    add(run.submit([{ type: 'run' }]));
    const learn = duel([mk('caldermaw', 60, ['kiln-maw']), mk('sloshkin', 8, ['tap', 'salt-spray', 'undertow', 'shell-rattle'], { nickname: 'KID' })], mk('stillox', 60, ['settle']), { kind: 'wild', rng: constRng(0.5), foeAi: () => ({ type: 'move', move: 0 }) });
    for (let i = 0; i < 20 && learn.phase === 'choose'; i++) add(learn.submit([{ type: 'move', move: 0 }]));
    const charge = duel(mk('stillox', 40, ['bedrock-charge']), mk('tossup', 40, ['settle']), { foeAi: () => ({ type: 'move', move: 0 }) });
    add(charge.submit([{ type: 'move', move: 0 }]));
    const reveal = duel(mk('wirewhisk', 30, ['arc-ping']), mk('tossup', 30, ['tap']), { foeAi: () => ({ type: 'move', move: 0 }) });
    add(reveal.intro);
    add(reveal.submit([{ type: 'move', move: 0 }]));
    const draw = duel(mk('sloshkin', 40, ['settle']), mk('tossup', 40, ['settle']), { foeAi: () => ({ type: 'move', move: 0 }) });
    draw.turn = 199;
    add(draw.submit([{ type: 'move', move: 0 }]));
    const hold = duel(mk('sloshkin', 5, ['tap']), mk('caldermaw', 5, ['settle']), { holdOut: 1, foeAi: () => ({ type: 'move', move: 0 }) });
    add(hold.submit([{ type: 'move', move: 0 }]));
    // arena weather (start, tick, end) and a held item (start stages, a consumable threshold heal)
    const items = [
      { id: 'test-berry', name: 'Test Berry', held: { healAt: { below: 0.5, fraction: 0.25 }, consumable: true } },
      { id: 'test-ballast', name: 'Test Ballast', held: { startStages: { def: 1 } } },
    ];
    const weatherKinds = [{ id: 'gale', name: 'Gale', text: 'Gale: everything takes a little chip.', power: {}, accuracy: 1, chip: { fraction: 1 / 16, chipImmune: [] }, evasion: null }];
    const low = mk('sloshkin', 30, ['settle'], { heldItem: 'test-berry' });
    low.hp = Math.floor(low.stats.hp * 0.4);
    const weather = createBattle({
      data: { ...DATA, items }, weatherKinds, weather: { kind: 'gale', turns: 1 }, kind: 'trainer', rng: constRng(0.5),
      sides: [{ party: [low] }, { party: [mk('tossup', 30, ['settle'], { heldItem: 'test-ballast' })], trainer: { name: 'Rival' } }],
      foeAi: () => ({ type: 'move', move: 0 }),
    });
    add(weather.intro);
    add(weather.submit([{ type: 'move', move: 0 }]));
    assert.ok(ofType(weather.log, 'held-item').some((e) => e.consumed), 'the berry is used up');
    assert.ok(ofType(learn.log, 'learn-offer').length >= 1);
    const missing = EVENT_TYPES.filter((t) => !seen.has(t));
    assert.deepEqual(missing, [], `never emitted: ${missing.join(', ')}`);
  });
});
