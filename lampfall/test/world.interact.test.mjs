// Unit tests for js/world/interact.js. Run: node --test test/world.interact.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFacing, underWater, INTERACTION_PRIORITY, KIND_VERBS, VERB_LABELS, DISABLED, lookup, toolUse } from '../js/world/interact.js';
import { loadMap } from '../js/world/tilemap.js';
import { TILES, LEGEND } from './fixtures/worldEnt.mjs';
import { createEntities, createEntity } from '../js/world/entities.js';
import { buildRuntimeMap, createWorldStub, createDataStub, ITEMS, MAP_DEF } from './fixtures/worldEnt.mjs';

const map = buildRuntimeMap();
const data = createDataStub({ items: ITEMS, npcs: { wren: { id: 'wren', name: 'Wren' } }, species: { puddlepip: { id: 'puddlepip', name: 'Puddlepip' } } });

/** Player at (x,y) facing `facing`, with the map's def entities spawned. */
function setup(x, y, facing, o = {}) {
  const ents = createEntities(map);
  const player = ents.add(createEntity({ id: 'player', kind: 'player', x, y, facing }));
  const world = createWorldStub({ x, y, facing, tool: o.tool ?? null, tide: o.tide ?? 'low' });
  ents.rebuildFromDefs(world, data, 'low', { evalCond: () => false });
  const act = () => resolveFacing(player, map, ents, world, data);
  return { ents, player, world, act };
}
const pick = (a) => (a ? { verb: a.verb, kind: a.kind, targetId: a.targetId, disabled: a.disabled } : null);

describe('tables', () => {
  it('priority list is ordered as specified and every kind has a verb', () => {
    const idx = (k) => INTERACTION_PRIORITY.indexOf(k);
    assert.ok(idx('npc') < idx('item') && idx('item') < idx('sign') && idx('sign') < idx('trigger') && idx('trigger') < idx('tree'));
    assert.ok(idx('tree') < idx('water') && idx('water') < idx('crack') && idx('crack') < idx('door') && idx('door') < idx('tile'));
    assert.ok(idx('boat') < idx('water'), 'a boat sits on water');
    for (const k of INTERACTION_PRIORITY) if (k !== 'trigger') assert.ok(KIND_VERBS[k], k);
    for (const v of Object.values(KIND_VERBS)) assert.ok(VERB_LABELS[v], v);
  });

  it('lookup works with a registry, object tables and arrays', () => {
    assert.equal(lookup(data, 'items', 'rod').use, 'fish');
    assert.equal(lookup(data, 'items', 'nope'), null);
    assert.equal(lookup({ items: ITEMS }, 'items', 'net').use, 'catch');
    assert.equal(lookup({ items: [{ id: 'a', use: 'x' }] }, 'items', 'a').use, 'x');
    assert.equal(lookup(null, 'items', 'a'), null);
    assert.equal(toolUse(createWorldStub({ tool: 'shovel' }), data), 'dig');
    assert.equal(toolUse(createWorldStub({ tool: null }), data), null);
  });
});

describe('resolveFacing', () => {
  it('returns null facing nothing or off the map', () => {
    assert.equal(setup(6, 2, 'up').act(), null, 'plain grass');
    assert.equal(setup(11, 0, 'right').act(), null, 'off map');
  });

  it('npc beats a use trigger on the same tile (overlapping candidates)', () => {
    const { act, ents } = setup(2, 4, 'down');     // wren stands on the bench trigger at (2,5)
    const a = act();
    assert.deepEqual(pick(a), { verb: 'talk', kind: 'npc', targetId: 'wren', disabled: null });
    assert.equal(a.targetKind, 'npc', 'targetKind mirrors kind');
    assert.equal(a.prompt, 'Talk to Wren'); assert.equal(a.label, 'Talk'); assert.equal(a.icon, 'talk');
    assert.deepEqual([a.payload.x, a.payload.y], [2, 5]);
    ents.remove('wren');
    assert.deepEqual(pick(act()), { verb: 'sit', kind: 'trigger', targetId: 'bench', disabled: null });
  });

  it('item, sign, tree, crack and trigger each resolve with their verb', () => {
    assert.deepEqual(pick(setup(1, 5, 'down').act()), { verb: 'pickUp', kind: 'item', targetId: 'quay-potion', disabled: null });
    assert.equal(setup(1, 5, 'down').act().prompt, 'Pick up Potion');
    const sign = setup(3, 5, 'down').act();
    assert.deepEqual(pick(sign), { verb: 'read', kind: 'sign', targetId: 'isle-sign', disabled: null });
    assert.equal(sign.payload.text, 'Mind the tide.');
    assert.deepEqual(pick(setup(9, 2, 'up').act()), { verb: 'shake', kind: 'tree', targetId: 'pear-1', disabled: null });
    assert.deepEqual(pick(setup(10, 5, 'up').act()), { verb: 'dig', kind: 'crack', targetId: 'crack-1', disabled: DISABLED.needsTool.dig });
    assert.deepEqual(pick(setup(10, 5, 'up', { tool: 'shovel' }).act()), { verb: 'dig', kind: 'crack', targetId: 'crack-1', disabled: null });
    assert.deepEqual(pick(setup(3, 3, 'down').act()), { verb: 'mailbox', kind: 'trigger', targetId: 'mailbox', disabled: null });
    assert.equal(setup(1, 3, 'left').act(), null, 'step triggers are not use actions');
  });

  it('a use trigger outranks a tree on the same tile, a tree outranks water behind it', () => {
    const def = { ...MAP_DEF, triggers: [...MAP_DEF.triggers, { x: 9, y: 1, kind: 'use', id: 'shrine', verb: 'use' }] };
    const m = buildRuntimeMap(def);
    const ents = createEntities(m);
    const player = ents.add(createEntity({ id: 'player', kind: 'player', x: 9, y: 2, facing: 'up' }));
    const world = createWorldStub({ x: 9, y: 2, facing: 'up' });
    ents.rebuildFromDefs(world, data, 'low', { evalCond: () => false });
    assert.deepEqual(pick(resolveFacing(player, m, ents, world, data)), { verb: 'use', kind: 'trigger', targetId: 'shrine', disabled: null });
    // tree placed on a water tile still wins over 'fish'
    ents.add(createEntity({ id: 'drift', kind: 'tree', x: 5, y: 4 }));
    ents.teleport(player, 4, 4, 'right');
    assert.deepEqual(pick(resolveFacing(player, m, ents, world, data)), { verb: 'shake', kind: 'tree', targetId: 'drift', disabled: null });
  });

  it('water needs a rod; the verb is shown disabled without one', () => {
    assert.deepEqual(pick(setup(4, 5, 'right').act()), { verb: 'fish', kind: 'water', targetId: 'deep', disabled: DISABLED.needsTool.fish });
    assert.deepEqual(pick(setup(4, 5, 'right', { tool: 'rod' }).act()), { verb: 'fish', kind: 'water', targetId: 'deep', disabled: null });
    assert.deepEqual(pick(setup(4, 5, 'right', { tool: 'shovel' }).act()), { verb: 'fish', kind: 'water', targetId: 'deep', disabled: DISABLED.needsTool.fish });
  });

  it('mud flats: dig at low tide, fish when flooded; a flooded causeway is water too', () => {
    assert.deepEqual(pick(setup(9, 7, 'right', { tool: 'shovel', tide: 'low' }).act()), { verb: 'dig', kind: 'mud', targetId: 'mud', disabled: null });
    assert.deepEqual(pick(setup(9, 7, 'right', { tide: 'low' }).act()), { verb: 'dig', kind: 'mud', targetId: 'mud', disabled: DISABLED.needsTool.dig });
    const flooded = setup(9, 7, 'right', { tool: 'rod', tide: 'high' }).act();
    assert.deepEqual(pick(flooded), { verb: 'fish', kind: 'water', targetId: 'mud', disabled: null });
    assert.equal(flooded.payload.tideState, 'high');
    assert.deepEqual(pick(setup(4, 3, 'right', { tide: 'high' }).act()), { verb: 'fish', kind: 'water', targetId: 'causeway', disabled: DISABLED.needsTool.fish });
    assert.equal(setup(4, 3, 'right', { tide: 'low' }).act(), null, 'dry causeway is plain ground');
  });

  it('doors resolve to enter with the warp target; walls expose their tile verb', () => {
    const door = setup(2, 3, 'up').act();
    assert.deepEqual(pick(door), { verb: 'enter', kind: 'door', targetId: 'int-hut', disabled: null });
    assert.deepEqual(door.payload.to, { mapId: 'int-hut', x: 2, y: 4, facing: 'up' });
    assert.deepEqual(pick(setup(1, 1, 'up').act()), { verb: 'look', kind: 'tile', targetId: 'wall', disabled: null });
  });

  it('roamers read by default and catch with a net when catchable; opened once-triggers vanish', () => {
    const { act, ents, world } = setup(6, 1, 'right');
    ents.add(createEntity({ id: 'r1', kind: 'roamer', x: 7, y: 1, speciesId: 'puddlepip', def: { catchable: true } }));
    assert.deepEqual(pick(act()), { verb: 'read', kind: 'roamer', targetId: 'r1', disabled: null });
    assert.equal(act().prompt, 'Read Puddlepip');
    world.player.tool = 'net';
    assert.deepEqual(pick(act()), { verb: 'catch', kind: 'roamer', targetId: 'r1', disabled: null });
    const def = { ...MAP_DEF, triggers: [{ x: 7, y: 1, kind: 'use', id: 'chest', verb: 'use', once: true }] };
    const m = buildRuntimeMap(def);
    const e2 = createEntities(m);
    const p = e2.add(createEntity({ id: 'player', kind: 'player', x: 6, y: 1, facing: 'right' }));
    const w2 = createWorldStub({ x: 6, y: 1, facing: 'right' });
    assert.equal(resolveFacing(p, m, e2, w2, data).targetId, 'chest');
    w2.maps[MAP_DEF.id].opened.push('chest');
    assert.equal(resolveFacing(p, m, e2, w2, data), null);
  });

  it('honours cond on use triggers and door warps through opts.evalCond', () => {
    const def = {
      ...MAP_DEF,
      triggers: [{ x: 7, y: 1, kind: 'use', id: 'shrine', verb: 'use', cond: { flag: 'sp.shrine' } }],
      warps: [{ x: 7, y: 1, to: { mapId: 'int-shrine', x: 1, y: 1 }, kind: 'door', cond: { flag: 'sp.door' } }],
    };
    const m = buildRuntimeMap(def);
    const ents = createEntities(m);
    const p = ents.add(createEntity({ id: 'player', kind: 'player', x: 6, y: 1, facing: 'right' }));
    const world = createWorldStub({ x: 6, y: 1, facing: 'right' });
    const seen = [];
    const evalCond = (w, cond, ctx) => { seen.push([ctx.mapId, ctx.x, ctx.y]); return Boolean(w.flags[cond.flag]); };
    assert.equal(resolveFacing(p, m, ents, world, data, { evalCond }), null, 'both gated shut');
    assert.deepEqual(seen[0], [MAP_DEF.id, 7, 1]);
    world.flags['sp.door'] = true;
    assert.deepEqual(pick(resolveFacing(p, m, ents, world, data, { evalCond })), { verb: 'enter', kind: 'door', targetId: 'int-shrine', disabled: null });
    world.flags['sp.shrine'] = true;
    assert.deepEqual(pick(resolveFacing(p, m, ents, world, data, { evalCond })), { verb: 'use', kind: 'trigger', targetId: 'shrine', disabled: null });
    assert.equal(resolveFacing(p, m, ents, world, data).targetId, 'shrine', 'no evaluator: the DSL reads the flags');
    world.flags = {};
    assert.equal(resolveFacing(p, m, ents, world, data), null, 'no evaluator: DSL conds fail with the flags unset');
  });

  it('underWater reads string and numeric tide classes and collision overrides', () => {
    assert.ok(underWater({ water: true, tide: null }, 'low'));
    assert.ok(!underWater({ water: false, tide: 'low' }, 'low'));
    assert.ok(underWater({ water: false, tide: 'low' }, 'rising'));
    assert.ok(underWater({ water: false, tide: 1 }, 'high'), 'numeric LOW_ONLY code');
    assert.ok(underWater({ water: false, tide: 'glow' }, 'falling'));
    assert.ok(!underWater({ water: false, tide: 'floods' }, 'high'), 'wet sand stays walkable');
    assert.ok(!underWater({ water: true, tide: null, collision: 2 }, 'high'), "'.' override is a ford");
    assert.ok(underWater({ water: false, tide: null, collision: 3 }, 'high'), "'L' override floods at high");
    assert.ok(!underWater({ water: false, solid: true, tide: 'low' }, 'high'), 'walls are never water');
  });

  it('resolves the same verbs on the real tilemap.loadMap runtime map', () => {
    const real = loadMap({ ...MAP_DEF, legend: LEGEND }, TILES);
    const ents = createEntities(real);
    const p = ents.add(createEntity({ id: 'player', kind: 'player', x: 9, y: 7, facing: 'right' }));
    const at = (tool, tide) => pick(resolveFacing(p, real, ents, createWorldStub({ tool }), data, { tideState: tide }));
    assert.deepEqual(at('shovel', 'low'), { verb: 'dig', kind: 'mud', targetId: 'mud', disabled: null });
    assert.deepEqual(at('rod', 'high'), { verb: 'fish', kind: 'water', targetId: 'mud', disabled: null }, 'flooded flats fish');
    assert.deepEqual(at('rod', 'rising'), { verb: 'fish', kind: 'water', targetId: 'mud', disabled: null });
    ents.teleport(p, 4, 5, 'right');
    assert.deepEqual(at(null, 'low'), { verb: 'fish', kind: 'water', targetId: 'deep', disabled: DISABLED.needsTool.fish });
    ents.teleport(p, 2, 3, 'up');
    assert.equal(at(null, 'low').verb, 'enter');
  });

  it('accepts a tide override and reuses its result record', () => {
    const { player, ents, world } = setup(9, 7, 'right', { tool: 'rod', tide: 'low' });
    const a = resolveFacing(player, map, ents, world, data, { tideState: 'high' });
    assert.equal(a.verb, 'fish');
    const b = resolveFacing(player, map, ents, world, data, { tideState: 'low' });
    assert.equal(a, b, 'same record');
    assert.equal(b.verb, 'dig');
  });
});
