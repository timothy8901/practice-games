// Unit tests for js/world/player.js. Run: node --test test/world.player.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, dirFromAxes, TURN_DELAY_MS, BUMP_COOLDOWN_MS, PLAYER_ID } from '../js/world/player.js';
import { createEntities, createEntity, WALK_MS, RUN_MS } from '../js/world/entities.js';
import { buildRuntimeMap, createWorldStub } from './fixtures/worldEnt.mjs';

const TICK = 1000 / 60;
const map = buildRuntimeMap();

function setup(x = 2, y = 4, facing = 'down') {
  const ents = createEntities(map);
  const player = createPlayer({ x, y, facing });
  ents.add(player.ent);
  const ctx = { ents, map, tideState: 'low' };
  /** Runs n ticks holding `dir`, collecting event types. */
  const run = (n, dir, runHeld = false) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      player.intend(dir, runHeld);
      for (const ev of player.update(TICK, ctx)) out.push(`${ev.type}:${ev.dir}`);
    }
    return out;
  };
  return { ents, player, ctx, run };
}

describe('dirFromAxes', () => {
  it('reduces axes to one direction and keeps the held axis', () => {
    assert.equal(dirFromAxes(0, 0), null);
    assert.equal(dirFromAxes(1, 0), 'right'); assert.equal(dirFromAxes(0, -1), 'up');
    assert.equal(dirFromAxes(1, 1, null), 'right', 'horizontal wins a fresh diagonal');
    assert.equal(dirFromAxes(1, 1, 'down'), 'down', 'keeps the axis already in use');
    assert.equal(dirFromAxes(-1, 1, 'right'), 'left', 'prev axis released: pick afresh');
    assert.equal(dirFromAxes(0, 1, 'up'), 'down');
  });
});

describe('turn then step', () => {
  it('pressing the facing direction steps at once', () => {
    const { player, run } = setup(2, 4, 'down');
    const evs = run(1, 'down');
    assert.deepEqual(evs, []);
    assert.ok(player.ent.moving); assert.equal(player.ent.y, 5);
    assert.equal(player.ent.speedMs, WALK_MS);
  });

  it('a tap in another direction turns in place without stepping', () => {
    const { player, run } = setup(2, 4, 'down');
    assert.deepEqual(run(1, 'left'), ['turn:left']);
    assert.equal(player.ent.facing, 'left');
    assert.ok(!player.ent.moving);
    assert.deepEqual(run(10, null), []);
    assert.deepEqual([player.ent.x, player.ent.y], [2, 4]);
    assert.deepEqual(player.facingTile(), { x: 1, y: 4 });
  });

  it('holding another direction turns, waits TURN_DELAY_MS, then steps', () => {
    const { player, run } = setup(2, 4, 'down');
    const ticksToStep = Math.ceil(TURN_DELAY_MS / TICK);
    assert.deepEqual(run(1, 'left'), ['turn:left']);
    for (let i = 1; i < ticksToStep; i++) {
      run(1, 'left');
      assert.ok(!player.ent.moving, `still turned in place after ${i + 1} ticks`);
    }
    run(1, 'left');
    assert.ok(player.ent.moving, 'step begins once the hold passes the gate');
    assert.equal(player.ent.x, 1);
  });

  it('a direction pressed mid-step is queued and turns on arrival (not lost, not diagonal)', () => {
    const { player, run } = setup(2, 4, 'down');
    run(1, 'down');                      // step to (2,5)
    run(1, 'right');                     // tap right during the step
    const evs = run(12, null);          // release; let the step land
    assert.ok(evs.includes('step:down'));
    assert.ok(evs.includes('turn:right'), 'queued tap resolves as a turn on arrival');
    assert.deepEqual([player.ent.x, player.ent.y, player.ent.facing], [2, 5, 'right']);
    assert.ok(!player.ent.moving);
  });

  it('continuous walking carries spill into the next step and emits one step per tile', () => {
    const { player, run } = setup(0, 3, 'right');   // row 3 is open all the way at low tide
    const evs = run(60, 'right');       // 1 second: 1000 / 160 = 6.25 tiles
    assert.equal(evs.filter((e) => e === 'step:right').length, 6);
    assert.equal(player.ent.x, 7);
    const tilesWithSpill = player.ent.x + player.ent.t - 1; // whole tiles + progress on current
    // The press tick starts the step without advancing it: at most one tick of latency, never cumulative.
    assert.ok(60 * TICK / WALK_MS - tilesWithSpill <= TICK / WALK_MS + 1e-6, `spill keeps walking continuous (${tilesWithSpill})`);
  });

  it('runs at RUN_MS and reports run on the step event', () => {
    const { player, ctx } = setup(1, 4, 'right');
    player.intend('right', true);
    player.update(TICK, ctx);
    assert.equal(player.ent.speedMs, RUN_MS);
    let stepEv = null;
    for (let i = 0; i < 10 && !stepEv; i++) for (const ev of player.update(TICK, ctx)) if (ev.type === 'step') stepEv = { ...ev };
    assert.ok(stepEv);
    assert.deepEqual([stepEv.fromX, stepEv.fromY, stepEv.x, stepEv.y, stepEv.run], [1, 4, 2, 4, true]);
  });

  it('bumps into walls and entities with a cooldown, still turning', () => {
    const { player, run, ents } = setup(1, 1, 'down');
    let evs = run(3, 'up');                       // (1,0) is a wall
    assert.deepEqual(evs, ['turn:up']);
    evs = run(Math.ceil(TURN_DELAY_MS / TICK) + 2, 'up');
    assert.deepEqual(evs.filter((e) => e.startsWith('bump')), ['bump:up'], 'one bump within the cooldown');
    assert.deepEqual([player.ent.x, player.ent.y, player.ent.facing], [1, 1, 'up']);
    const later = run(Math.ceil(BUMP_COOLDOWN_MS / TICK) + 1, 'up');
    assert.ok(later.includes('bump:up'), 'bumps again after the cooldown');
    ents.add(createEntity({ id: 'wren', kind: 'npc', x: 1, y: 4 }));
    ents.teleport(player.ent, 1, 3, 'down');
    run(Math.ceil(BUMP_COOLDOWN_MS / TICK) + 1, null);   // let the bump cooldown lapse
    assert.deepEqual(run(1, 'down'), ['bump:down'], 'entity blocks, facing direction steps at once');
    assert.deepEqual([player.ent.x, player.ent.y], [1, 3]);
  });

  it('is deterministic for the same input sequence', () => {
    const script = ['down', 'down', 'left', null, 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'up', 'up', 'up', null, null, 'right'];
    const trace = () => {
      const { player, run } = setup(3, 4, 'down');
      const out = [];
      for (const d of script) out.push(run(1, d).join(','), player.ent.x, player.ent.y, player.ent.facing, +player.ent.t.toFixed(6));
      return out;
    };
    assert.deepEqual(trace(), trace());
  });
});

describe('lock and tools and state sync', () => {
  it('locked ignores intents but finishes the step in flight', () => {
    const { player, run } = setup(2, 4, 'down');
    run(1, 'down');
    player.setLocked(true);
    assert.ok(player.isLocked());
    const evs = run(12, 'left');
    assert.deepEqual(evs, ['step:down']);
    assert.deepEqual([player.ent.x, player.ent.y, player.ent.facing], [2, 5, 'down']);
    player.setLocked(false);
    assert.deepEqual(run(1, 'left'), ['turn:left']);
  });

  it('tool state: setTool tracks lastTool and swapTool toggles', () => {
    const { player } = setup();
    assert.equal(player.tool, null);
    player.setTool('rod'); player.setTool('shovel');
    assert.deepEqual([player.tool, player.lastTool], ['shovel', 'rod']);
    player.setTool('shovel');
    assert.deepEqual([player.tool, player.lastTool], ['shovel', 'rod'], 'no-op when unchanged');
    player.swapTool();
    assert.deepEqual([player.tool, player.lastTool], ['rod', 'shovel']);
    player.setTool(null);
    assert.deepEqual([player.tool, player.lastTool], [null, 'rod']);
  });

  it('readFrom / writeTo round-trip the PlayerState fields', () => {
    const { player } = setup();
    const world = createWorldStub({ x: 9, y: 1, facing: 'left', tool: 'net' });
    player.readFrom(world.player);
    assert.deepEqual([player.ent.x, player.ent.y, player.ent.facing, player.tool], [9, 1, 'left', 'net']);
    player.setTool('rod');
    const out = player.writeTo({ ...world.player });
    assert.deepEqual([out.x, out.y, out.facing, out.tool, out.lastTool], [9, 1, 'left', 'rod', 'net']);
    assert.equal(player.ent.id, PLAYER_ID);
  });
});
