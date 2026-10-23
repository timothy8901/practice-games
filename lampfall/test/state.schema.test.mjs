// Unit tests for js/state/schema.js. Run: node --test test/state.schema.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, PARTY_MAX, MOVE_SLOTS, STAT_COUNTERS, POCKET_IDS, DEFAULT_DIAL, WORLDGEN_LABEL,
  createNewWorld, validateWorld, worldDefaults, creatureDefaults, settingsDefaults, isPlainObject, NEW_GAME_START_MINUTE, tideSeedFor,
} from '../js/state/schema.js';
import { encodeSeedCode, makeRng } from '../js/core/rng.js';
import { CLOCK_STATE_VERSION } from '../js/core/time.js';

const CODE = encodeSeedCode({ dial: 'FLUX', seed: 12345, toggles: [] });

/** A valid creature record with the given uid. */
function creature(uid, extra = {}) {
  return { ...creatureDefaults(), uid, speciesId: 'sloshkin', familyId: 'slosh', nickname: uid, stats: { hp: 20, atk: 5, def: 5, spa: 5, spd: 5, spe: 5 }, hp: 20, ...extra };
}

describe('createNewWorld', () => {
  it('is deterministic per seed code and diverges across seeds', () => {
    const a = createNewWorld({ seedCode: CODE });
    const b = createNewWorld({ seedCode: CODE });
    assert.deepEqual(a, b);
    assert.notEqual(a, b, 'distinct objects');
    const c = createNewWorld({ seedCode: encodeSeedCode({ dial: 'FLUX', seed: 54321, toggles: [] }) });
    assert.notEqual(c.run.seed, a.run.seed);
    assert.notEqual(c.run.gen.salt, a.run.gen.salt);
  });

  it('decodes a seed code into run config', () => {
    const w = createNewWorld({ seedCode: CODE.toLowerCase() });
    assert.equal(w.run.seedCode, CODE, 'normalized to upper case');
    assert.equal(w.run.seed, 12345);
    assert.equal(w.run.dial, 'flux');
    assert.deepEqual(w.run.toggles, []);
    assert.equal(w.run.dialChangedMidRun, false);
  });

  it('hashes free text that is not a seed code and falls back to the default dial', () => {
    const w = createNewWorld({ seedCode: 'porchlight forever' });
    assert.equal(w.run.seedCode, 'porchlight forever');
    assert.ok(Number.isInteger(w.run.seed) && w.run.seed >= 0);
    assert.equal(w.run.dial, DEFAULT_DIAL);
    assert.equal(createNewWorld({ seedCode: 'porchlight forever', dial: 'FLUX' }).run.dial, 'flux');
    assert.deepEqual(w, createNewWorld({ seedCode: 'porchlight forever' }));
  });

  it('stamps the schema version and mirrors the seed into the clock', () => {
    const w = createNewWorld({ seedCode: CODE });
    assert.equal(w.v, SCHEMA_VERSION);
    assert.equal(w.clock.version, CLOCK_STATE_VERSION);
    assert.equal(w.clock.total, NEW_GAME_START_MINUTE, 'the arrival, 17:40 on day 1 (GDD-00 §12)');
    assert.equal(w.clock.seed, tideSeedFor(), 'the GDD tide seed, not the run seed');
    assert.equal(w.clock.realClock, false);
  });

  it('consumes the worldgen fork exactly once and stores results in run.gen', () => {
    const calls = [];
    const w = createNewWorld({
      seedCode: CODE,
      worldgen(rng, run) {
        calls.push({ seed: rng.seed, run });
        return { wards: { sloshkin: 'tidewall' }, discs: { 'disc-1': [rng.pick(['a', 'b', 'c'])] }, ignored: 1 };
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].seed, makeRng(12345).fork(WORLDGEN_LABEL).seed, 'the hook receives the worldgen fork');
    assert.equal(calls[0].run.gen, undefined, 'the hook sees run config without gen');
    assert.throws(() => { calls[0].run.dial = 'x'; }, 'run handed to the hook is frozen');
    assert.deepEqual(w.run.gen.wards, { sloshkin: 'tidewall' });
    assert.equal(w.run.gen.discs['disc-1'].length, 1);
    assert.equal('ignored' in w.run.gen, false, 'unknown gen keys are dropped');
    // The salt is drawn before the hook, so it is the same with or without a hook.
    assert.equal(w.run.gen.salt, createNewWorld({ seedCode: CODE }).run.gen.salt);
    // The hook's draws are deterministic too.
    assert.deepEqual(w, createNewWorld({ seedCode: CODE, worldgen: (rng) => ({ wards: { sloshkin: 'tidewall' }, discs: { 'disc-1': [rng.pick(['a', 'b', 'c'])] } }) }));
    assert.deepEqual(validateWorld(w), []);
  });

  it('overlays lease and settings without admitting unknown keys', () => {
    const w = createNewWorld({
      seedCode: CODE,
      lease: { name: 'Pell', species: 'otter', look: { fur: 2 }, mapId: 'harbor', x: 3, y: 4, bogus: true },
      settings: { volumes: { music: 0.1 }, textSpeed: 'fast', realClock: true, nope: 1 },
      challenges: ['no-rewind'],
    });
    assert.equal(w.player.name, 'Pell');
    assert.deepEqual(w.player.look, { fur: 2, marks: 0, outfit: 0 });
    assert.equal(w.player.mapId, 'harbor');
    assert.equal('bogus' in w.player, false);
    assert.deepEqual(w.settings.volumes, { master: 0.8, music: 0.1, sfx: 0.9 });
    assert.equal(w.settings.textSpeed, 'fast');
    assert.equal(w.clock.realClock, true, 'clock mirrors settings.realClock');
    assert.equal('nope' in w.settings, false);
    assert.deepEqual(w.run.challenges, ['no-rewind']);
    assert.deepEqual(validateWorld(w), []);
  });

  it('has every key with a default and survives a JSON round trip unchanged', () => {
    const w = createNewWorld({ seedCode: CODE });
    assert.deepEqual(Object.keys(w).sort(), Object.keys(worldDefaults()).sort());
    assert.deepEqual(JSON.parse(JSON.stringify(w)), w);
    for (const p of POCKET_IDS) assert.deepEqual(w.bag.pockets[p], []);
    for (const k of STAT_COUNTERS) assert.equal(w.stats[k], 0);
    assert.equal(w.party.length, 0);
    assert.equal(w.pendingScript, null);
  });

  it('rejects bad options', () => {
    assert.throws(() => createNewWorld(), TypeError);
    assert.throws(() => createNewWorld({}), TypeError);
    assert.throws(() => createNewWorld({ seedCode: '' }), TypeError);
    assert.throws(() => createNewWorld({ seedCode: 42 }), TypeError);
    assert.throws(() => createNewWorld({ seedCode: CODE, worldgen: 'x' }), TypeError);
    assert.throws(() => createNewWorld({ seedCode: CODE, lease: 3 }), TypeError);
    assert.throws(() => createNewWorld({ seedCode: CODE, worldgen: () => 5 }), TypeError);
  });

  it('exposes fresh default records each call', () => {
    const a = worldDefaults();
    const b = worldDefaults();
    a.bag.pockets.medicine.push({ id: 'x', n: 1 });
    assert.equal(b.bag.pockets.medicine.length, 0);
    assert.notEqual(settingsDefaults(), settingsDefaults());
    assert.equal(creatureDefaults().level, 1);
  });
});

describe('validateWorld', () => {
  it('accepts a new world, with and without a registry', () => {
    const w = createNewWorld({ seedCode: CODE });
    assert.deepEqual(validateWorld(w), []);
    assert.deepEqual(validateWorld(w, { has: () => false }), [], 'empty ids are not looked up');
  });

  it('accepts a populated world', () => {
    const w = createNewWorld({ seedCode: CODE, lease: { mapId: 'harbor' } });
    w.party.push(creature('c1'), creature('c2', { status: { kind: 'burn', turns: 2 }, heldItem: 'berry' }));
    w.box.push(creature('c3'));
    w.yard.push('c3');
    w.pendingShifts.push('c1');
    w.settings.autoAnchor.c1 = 'auto-up';
    w.flags['sp.arrived'] = true;
    w.flags['np.wren.met'] = 1;
    w.counters['sys.uid'] = 3;
    w.letters = { ...w.letters, delivered: 4, read: [1, 3], today: 3, got: [1, 21, 3, 22], mailbox: [3], counter: 22, carrying: [21], pinned: ['ph-shell'], keeperDay: 1, familyDay: 1 };
    w.npcs.wren = { met: true, talks: 2, lastTalkDay: 1, lastPorchDay: -1, nickname: null, affinity: 1, favours: [], saidLines: { hi: 1 }, remembered: { roof: 'red' }, gifts: { pear: { n: 1, lastDay: 1 } }, nicknameChoice: 'decline', lastLineId: 'hi', lingerDay: 1, lastGiftDay: 1 };
    w.dayPage = { day: 1, base: { catches: 0 }, earned: 300, paid: 100, notes: ['k1'], last: { day: 0 } };
    w.maps.harbor = { visited: true, picked: { 'a:1': 0 }, trees: {}, cracks: { c1: true }, reach: { r1: 0.5 }, reachAt: { r1: 1200 }, opened: ['chest-1'] };
    w.threads['wren-roof'] = { beat: 1, done: false, startedDay: 0, lastAdvancedDay: 1 };
    w.fieldLog.forms.sloshkin = { seen: true, read: false, held: true, ability: null };
    w.loans.builds.push({ id: 'roof', tier: 1, startedDay: 0, readyDay: 1, choice: null, done: false });
    w.rng.loot = [1, 2, 3, 4];
    w.cutscene = { scriptId: 'arrival', state: { pc: [0], vars: {}, callStack: [] } };
    w.battleBookmark = { kind: 'trainer', trainerId: 't1', mapId: 'harbor', x: 1, y: 1, battles: 0 };
    assert.deepEqual(validateWorld(w), []);
  });

  it('reports a corrupted world precisely', () => {
    const w = createNewWorld({ seedCode: CODE });
    w.v = SCHEMA_VERSION + 1;
    w.wallet.main = -5;
    w.player.facing = 'sideways';
    w.flags.arrived = true; // no namespace
    w.letters = { delivered: 1, read: [1, 1, 4], today: 9 };
    w.badges = ['a', 'a'];
    w.rng.bad = [0, 0, 0, 0];
    w.extra = 1;
    delete w.weather;
    for (let i = 0; i < PARTY_MAX + 1; i++) w.party.push(creature(`c${i}`));
    w.party[0].level = 0;
    w.party[1].moves = Array.from({ length: MOVE_SLOTS + 1 }, () => ({ id: 'm', pp: 1, maxPp: 1 }));
    w.party[2].uid = 'c1'; // duplicate
    w.party[3].hp = 999; // > stats.hp
    w.party[4].status = { kind: 'sleepy', turns: 1 };
    w.party[5].trained.atk = 300;
    w.yard.push('ghost');
    const problems = validateWorld(w);
    const expect = (re) => assert.ok(problems.some((p) => re.test(p)), `expected a problem matching ${re}, got:\n${problems.join('\n')}`);
    expect(new RegExp(`^world\\.v: expected integer 1\\.\\.${SCHEMA_VERSION}\\b`));
    expect(/^world\.wallet\.main: expected non-negative integer/);
    expect(/^world\.player\.facing: expected up\|down\|left\|right/);
    expect(/^world\.flags\.arrived: flag id lacks a namespace/);
    expect(/^world\.letters\.read: letter 4 was never delivered/);
    expect(/^world\.letters\.read: duplicate/);
    expect(/^world\.letters\.today: letter 9 was never delivered/);
    expect(/^world\.badges: duplicate/);
    expect(/^world\.rng\.bad: expected 4 uint32/);
    expect(/^world\.extra: unexpected key/);
    expect(/^world\.weather: missing/);
    expect(/^world\.party: expected array \(max 6\)/);
    expect(/^world\.party\[0\]\.level: expected integer 1\.\.100/);
    expect(/^world\.party\[1\]\.moves: expected array of \{id, pp, maxPp\}/);
    expect(/^world\.party\[2\]\.uid: duplicate uid "c1"/);
    expect(/^world\.party\[3\]\.hp: 999 exceeds stats\.hp 20/);
    expect(/^world\.party\[4\]\.status/);
    expect(/^world\.party\[5\]\.trained\.atk: expected integer 0\.\.252/);
    expect(/^world\.yard\[0\]: unknown creature uid "ghost"/);
  });

  it('checks the v4 letter channels against what arrived', () => {
    const w = createNewWorld({ seedCode: CODE });
    w.letters = {
      ...w.letters, delivered: 3, got: [1, 21, 1], read: [5], today: 7, counter: 30, mailbox: [9, 9], carrying: [21, 40],
      doors: [21], awaiting: [22], returned: [21, 21],
    };
    const problems = validateWorld(w);
    const expect = (re) => assert.ok(problems.some((p) => re.test(p)), `expected a problem matching ${re}, got:\n${problems.join('\n')}`);
    expect(/^world\.letters\.got: duplicate entries/);
    expect(/^world\.letters\.read: letter 5 was never delivered/);
    expect(/^world\.letters\.today: letter 7 was never delivered/);
    expect(/^world\.letters\.counter: letter 30 was never delivered/);
    expect(/^world\.letters\.mailbox: letter 9 was never delivered/);
    expect(/^world\.letters\.mailbox: duplicate entries/);
    expect(/^world\.letters\.carrying: letter 40 was never delivered/);
    expect(/^world\.letters\.carrying: letter 21 was already handed in/);
    expect(/^world\.letters\.awaiting: letter 22 was never handed in at a door/);
    expect(/^world\.letters\.returned: duplicate entries/);
    w.letters = { ...w.letters, got: [1, 2], delivered: 5, read: [], today: null, counter: null, mailbox: [], carrying: [], doors: [], awaiting: [], returned: [] };
    assert.deepEqual(validateWorld(w), ['world.letters.delivered: 5 does not match got.length 2']);
    w.letters = { ...w.letters, got: [0], delivered: 1 };
    assert.deepEqual(validateWorld(w), ['world.letters.got: letter numbers start at 1']);
    w.npcs.wren = { ...w.npcs.wren, nicknameChoice: 'maybe' };
    w.dayPage = { ...w.dayPage, notes: Array.from({ length: 41 }, () => 'x'), earned: -1 };
    w.letters = { ...w.letters, got: [], delivered: 0 };
    const more = validateWorld(w);
    assert.ok(more.some((p) => p.startsWith('world.dayPage.notes: expected string[] (max 40)')), more.join('\n'));
    assert.ok(more.some((p) => p.startsWith('world.dayPage.earned: expected non-negative integer')), more.join('\n'));
  });

  it('rejects values JSON cannot carry before shape checking', () => {
    const w = createNewWorld({ seedCode: CODE });
    w.wallet.main = NaN;
    w.player.title = undefined;
    w.flags['sp.fn'] = () => 1;
    w.maps.harbor = new Map();
    w.weather.when = new Date(0);
    w.loop = w.player;
    w.player.self = w.player;
    const problems = validateWorld(w);
    assert.ok(problems.some((p) => p.startsWith('world.wallet.main: non-finite number')), problems.join('\n'));
    assert.ok(problems.some((p) => p.startsWith('world.player.title: undefined')), problems.join('\n'));
    assert.ok(problems.some((p) => p.startsWith('world.flags.sp.fn: function value')), problems.join('\n'));
    assert.ok(problems.some((p) => p === 'world.maps.harbor: Map is not a plain object'), problems.join('\n'));
    assert.ok(problems.some((p) => p === 'world.weather.when: Date is not a plain object'), problems.join('\n'));
    assert.ok(problems.some((p) => p.endsWith('cyclic reference')), problems.join('\n'));
    assert.ok(!problems.some((p) => p.includes('missing')), 'shape checks wait until the input is JSON-safe');
  });

  it('never throws on garbage input', () => {
    assert.deepEqual(validateWorld(null), ['world: expected object, got null']);
    assert.equal(validateWorld(undefined).length, 1);
    assert.equal(validateWorld([]).length, 1);
    assert.equal(validateWorld('world').length, 1);
    assert.ok(validateWorld({}).length > 20, 'every top-level key is reported missing');
  });

  it('resolves ids against a registry when one is given', () => {
    const w = createNewWorld({ seedCode: CODE, lease: { mapId: 'harbor', tool: 'rod', toolRing: ['rod'] } });
    w.party.push(creature('c1', { moves: [{ id: 'splash', pp: 1, maxPp: 1 }], heldItem: 'berry', shiftlog: ['sloshkin'] }));
    w.bag.pockets.medicine.push({ id: 'berry', n: 2 });
    w.npcs.wren = { met: false, talks: 0, lastTalkDay: -1, lastPorchDay: -1, nickname: null, affinity: 0, favours: [], saidLines: {}, remembered: {}, gifts: {}, nicknameChoice: null, lastLineId: null, lingerDay: -1, lastGiftDay: -1 };
    w.badges.push('spire-1');
    w.pendingScript = 'arrival';
    const known = {
      species: ['sloshkin'], families: ['slosh'], abilities: [''], moves: ['splash'], items: ['berry', 'rod'],
      maps: ['harbor'], npcs: ['wren'], trainers: ['spire-1'], scripts: ['arrival'], threads: [],
    };
    const registry = { has: (table, id) => (known[table] ?? []).includes(id) };
    assert.deepEqual(validateWorld(w, registry), []);
    w.player.mapId = 'nowhere';
    w.party[0].speciesId = 'dragon';
    w.bag.pockets.medicine[0].id = 'rock';
    w.badges.push('spire-9');
    const problems = validateWorld(w, registry);
    assert.ok(problems.includes('world.player.mapId: unknown maps id "nowhere"'), problems.join('\n'));
    assert.ok(problems.includes('world.party[0].speciesId: unknown species id "dragon"'), problems.join('\n'));
    assert.ok(problems.includes('world.bag.pockets.medicine[0].id: unknown items id "rock"'), problems.join('\n'));
    assert.ok(problems.includes('world.badges[1]: unknown trainers id "spire-9"'), problems.join('\n'));
    assert.deepEqual(validateWorld(w, { has: () => { throw new Error('boom'); } }), [], 'a throwing registry is treated as knowing everything');
  });

  it('isPlainObject distinguishes records from everything else', () => {
    assert.equal(isPlainObject({}), true);
    assert.equal(isPlainObject(Object.create(null)), true);
    assert.equal(isPlainObject([]), false);
    assert.equal(isPlainObject(null), false);
    assert.equal(isPlainObject(new Map()), false);
    assert.equal(isPlainObject(new Date()), false);
  });
});
