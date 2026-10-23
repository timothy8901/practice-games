// Adversarial checks for arena weather and held items (engine.js, weather.js, heldItems.js, ai.js),
// written by the extension's verifier: weather set twice, weather ending or changing mid-turn,
// weather chip under Capture Stance (the floor holds), held items on a fainting hit, item
// consumption across a switch, deterministic replays across separate Node processes, and the
// AI never choosing a move the weather nullifies while another option exists.
// Run: node --test test/battle.weather-items.adversarial.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { createBattle, DEFAULTS } from '../js/battle/engine.js';
import { checkEvent } from '../js/battle/events.js';
import { chooseAction, chooseReplacement, chooseWildAction } from '../js/battle/ai.js';
import { damageFormula } from '../js/battle/effects.js';
import { BATTLE_DATA, mon } from '../tools/balance-sim.mjs';
import { MOVES } from '../js/data/moves/index.js';
import { ITEMS } from '../js/data/items.js';
import { WEATHER_KINDS } from '../js/data/spires.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** An rng stub: `next()` is always `v` (chance(p) is v < p), `int()` the low bound. */
function constRng(v = 0.5) {
  return { next: () => v, int: (a) => a, chance: (p) => v < p, pick: (a) => a[0], weighted: (e) => e.find((x) => x.w > 0)?.v, fork() { return this; } };
}

const mv = (id, type, category, power, accuracy, effect = {}, extra = {}) => ({ id, name: id, type, category, power, accuracy, pp: 10, priority: 0, effect, ...extra });
const ADV_MOVES = Object.freeze([
  mv('adv-kiln', 'Kiln', 'special', 90, 100),
  mv('adv-plain', 'Plain', 'special', 40, 100),
  mv('adv-plain-big', 'Plain', 'special', 250, 100),
  mv('adv-twice', 'Plain', 'special', 250, 100, { multiHit: [2, 2] }),
  mv('adv-steam2', 'Kiln', 'status', 0, null, { weather: { kind: 'steam', turns: 2 } }),
  mv('adv-squall2', 'Gust', 'status', 0, null, { weather: { kind: 'squall', turns: 2 } }),
  mv('adv-squall4', 'Gust', 'status', 0, null, { weather: { kind: 'squall', turns: 4 } }),
  mv('adv-ash1', 'Stone', 'status', 0, null, { weather: { kind: 'ash', turns: 1 } }),
  mv('adv-ash-fast', 'Stone', 'status', 0, null, { weather: { kind: 'ash', turns: 3 } }, { priority: 1 }),
  mv('adv-poison', 'Rust', 'status', 0, null, { status: { kind: 'poison', chance: 1 } }),
  mv('adv-wait', 'Plain', 'status', 0, null, { stat: [{ stat: 'def', stages: 1, target: 'self' }] }),
]);
const ADV_ITEMS = Object.freeze([
  { id: 'adv-berry', name: 'Adv Berry', pocket: 'held', held: { healAt: { below: 0.5, fraction: 0.25 }, consumable: true } },
  { id: 'adv-cork', name: 'Adv Cork', pocket: 'held', held: { endureFromFull: true, consumable: true } },
]);
/** A weather that smothers Kiln moves entirely (no shipped kind does; the engine must still honour it). */
const SMOTHER = Object.freeze({ id: 'smother', name: 'Smother', text: 'Smother: Kiln moves do nothing.', power: { Kiln: 0 }, accuracy: 1, chip: null, evasion: null });
const KINDS = Object.freeze([...WEATHER_KINDS, SMOTHER]);
const XDATA = Object.freeze({ ...BATTLE_DATA, moves: [...MOVES, ...ADV_MOVES], items: [...ITEMS, ...ADV_ITEMS], weatherKinds: KINDS });

function mk(speciesId, level, moves, extra = {}) {
  const c = mon(speciesId, level, null);
  c.moves = moves.map((id) => ({ id, pp: 20, maxPp: 20 }));
  c.heartmark = null;
  return Object.assign(c, extra);
}
function fight(p0, p1, opts = {}) {
  return createBattle({
    sides: [{ party: Array.isArray(p0) ? p0 : [p0] }, { party: Array.isArray(p1) ? p1 : [p1], trainer: opts.kind === 'wild' ? undefined : { name: 'Foe' } }],
    kind: opts.kind || 'trainer', data: XDATA, rng: opts.rng || constRng(0.5), dial: 'flux',
    weather: opts.weather, weatherCycle: opts.weatherCycle, captureStance: opts.captureStance, tuning: opts.tuning,
  });
}
const ofType = (evs, type) => evs.filter((e) => e.type === type);
const use = (i = 0) => ({ type: 'move', move: i });
const allValid = (evs) => { for (const e of evs) assert.deepEqual(checkEvent(e), [], `${e.type}: ${JSON.stringify(e)}`); };

// --- weather set twice ----------------------------------------------------------------------------

describe('weather set twice', () => {
  it('the same kind again renews its turns, says so once, and grants no second evasion', () => {
    const me = mk('skirl', 30, ['adv-squall2', 'adv-wait']);
    const bt = fight(me, mk('stillox', 30, ['adv-wait']));
    const e1 = bt.step([use(0), use(0)]);
    allValid(e1);
    assert.equal(ofType(e1, 'weather-start').length, 1);
    assert.equal(bt.sides[0].vol.stages.eva, 1, 'Gust +1 as the squall blows in');
    assert.equal(bt.state().weather.turnsLeft, 1, 'two turns from turn 1: one left');
    const e2 = bt.step([use(0), use(0)]);
    allValid(e2);
    const starts = ofType(e2, 'weather-start');
    assert.equal(starts.length, 1);
    assert.match(starts[0].text, /picks up again/);
    assert.equal(ofType(e2, 'weather-end').length, 0, 'a renewal is not an end');
    assert.equal(bt.sides[0].vol.stages.eva, 1, 'no second evasion grant for a renewal');
    assert.equal(bt.state().weather.kind, 'squall');
    assert.equal(bt.state().weather.turnsLeft, 1, 'turns reset from the renewal');
  });

  it('a second, different timed weather replaces the first; when it runs out the standing kind returns, not the first', () => {
    const me = mk('stillox', 30, ['adv-steam2', 'adv-ash1', 'adv-wait']);
    const bt = fight(me, mk('stillox', 30, ['adv-wait']), { weather: 'clear' });
    bt.step([use(0), use(0)]);
    assert.equal(bt.state().weather.kind, 'steam');
    const e = bt.step([use(1), use(0)]);
    allValid(e);
    const order = e.filter((x) => x.type.startsWith('weather')).map((x) => `${x.type}:${x.kind}`);
    assert.deepEqual(order.slice(0, 2), ['weather-end:steam', 'weather-start:ash'], 'the old one ends before the new one starts');
    assert.ok(order.includes('weather-end:ash'), 'one-turn ash ends at this turn\'s end');
    assert.equal(order[order.length - 1], 'weather-start:clear', 'the standing kind comes back');
    assert.equal(bt.state().weather.kind, 'clear');
    assert.equal(bt.state().weather.turnsLeft, null);
  });

  it('both leads bring weather in: the second entry wins and the strip agrees with the state', () => {
    const a = mk('coilcrest', 40, ['adv-wait'], { onEntry: { weather: 'squall', turns: 3 } });
    const b = mk('sootling', 40, ['adv-wait'], { onEntry: { weather: 'steam', turns: 2 } });
    const bt = fight(a, b);
    allValid(bt.intro);
    const w = bt.state().weather;
    assert.equal(w.kind, 'steam');
    assert.equal(w.turnsLeft, 2);
    assert.deepEqual(w.posted.map((p) => p.kind), ['steam', 'steam', null]);
    assert.deepEqual(bt.intro.filter((x) => x.type.startsWith('weather')).map((x) => `${x.type}:${x.kind}`), ['weather-start:squall', 'weather-end:squall', 'weather-start:steam']);
  });

  it('setWeather twice with the same standing kind is silent the second time', () => {
    const bt = fight(mk('stillox', 30, ['adv-wait']), mk('stillox', 30, ['adv-wait']));
    assert.equal(ofType(bt.setWeather('ash'), 'weather-start').length, 1);
    assert.deepEqual(bt.setWeather('ash'), []);
    assert.equal(ofType(bt.setWeather(null), 'weather-end').length, 1);
    assert.equal(bt.state().weather.kind, null);
  });
});

// --- weather ending or changing mid-turn -------------------------------------------------------------

describe('weather ending or changing mid-turn', () => {
  it('a faster weather move changes the power of the slower creature\'s hit in the same turn', () => {
    const run = (fastMove) => {
      const fast = mk('skirl', 40, [fastMove]);
      const slow = mk('sootling', 30, ['adv-kiln']);
      const bt = fight(slow, fast);
      const evs = bt.step([use(0), use(0)]);
      return ofType(evs, 'damage').find((d) => d.side === 1 && d.source === 'party').amount;
    };
    const plain = run('adv-wait');
    const steamed = run('adv-steam2');
    const squalled = run('adv-squall2');
    assert.ok(steamed > plain, `steam boosts Kiln (${steamed} > ${plain})`);
    assert.ok(squalled < plain, `squall weakens Kiln (${squalled} < ${plain})`);
  });

  it('a weather on its last turn still chips at that turn\'s end, then ends; the next turn has none', () => {
    const me = mk('stillox', 30, ['adv-ash1', 'adv-wait']);
    const foe = mk('tossup', 30, ['adv-wait']);
    const bt = fight(me, foe);
    const evs = bt.step([use(0), use(0)]);
    allValid(evs);
    const chip = ofType(evs, 'damage').filter((d) => d.source === 'weather');
    assert.equal(chip.length, 1, 'only the Plain foe is chipped (Stone is immune)');
    assert.equal(chip[0].side, 1);
    const types = evs.map((x) => x.type);
    assert.ok(types.indexOf('weather-tick') < types.indexOf('weather-end'), 'tick (and chip) before the end');
    assert.equal(bt.state().weather.kind, null);
    const next = bt.step([use(1), use(0)]);
    assert.equal(ofType(next, 'damage').filter((d) => d.source === 'weather').length, 0);
    assert.equal(ofType(next, 'weather-tick').length, 0);
  });

  it('a weather replaced mid-turn chips with the new kind at the end of that turn', () => {
    // posted cycle: steam on turn 1 (no chip); a priority ash move replaces it mid-turn
    const me = mk('stillox', 30, ['adv-ash-fast']);
    const foe = mk('tossup', 30, ['adv-wait']);
    const bt = fight(me, foe, { weatherCycle: { cycle: ['steam', 'squall'], turnsEach: 3 } });
    assert.equal(bt.state().weather.kind, 'steam');
    const evs = bt.step([use(0), use(0)]);
    allValid(evs);
    assert.equal(ofType(evs, 'weather-tick')[0].kind, 'ash');
    assert.equal(ofType(evs, 'damage').filter((d) => d.source === 'weather').length, 1);
    assert.equal(bt.state().weather.turnsLeft, 2, 'set mid-turn 1: that end was its first tick');
    // ash (3 turns) runs out at the end of turn 3; the cycle's turn 4 is squall (turnsEach 3)
    bt.sides[0].party[0].moves = [{ id: 'adv-wait', pp: 20, maxPp: 20 }];
    bt.step([use(0), use(0)]);
    const e3 = bt.step([use(0), use(0)]);
    allValid(e3);
    assert.deepEqual(e3.filter((x) => x.type === 'weather-end' || x.type === 'weather-start').map((x) => `${x.type}:${x.kind}`), ['weather-end:ash', 'weather-start:squall']);
    assert.equal(bt.state().weather.source, 'cycle');
    assert.equal(bt.state().weather.turnsLeft, 3);
  });

  it('a timed weather that runs out under a cycle hands back to the cycle\'s kind for that turn (no stale kind)', () => {
    const me = mk('stillox', 30, ['adv-squall2', 'adv-wait']);
    const bt = fight(me, mk('stillox', 30, ['adv-wait']), { weatherCycle: { cycle: ['steam', 'ash', 'clear'], turnsEach: 1 } });
    bt.step([use(0), use(0)]); // squall for turns 1-2
    assert.equal(bt.state().weather.kind, 'squall');
    const e = bt.step([use(1), use(0)]); // turn 2 ends: squall out, cycle turn 3 = clear
    allValid(e);
    assert.equal(bt.state().weather.kind, 'clear');
    assert.equal(bt.state().weather.source, 'cycle');
    assert.deepEqual(bt.state().weather.posted.map((p) => p.kind), ['clear', 'steam', 'ash']);
  });

  it('a weather move from a user that faints to recoil-free damage before acting sets nothing', () => {
    const slow = mk('stillox', 5, ['adv-steam2']);
    const fast = mk('emberjaw', 60, ['adv-plain-big']);
    const bt = fight(slow, fast);
    const evs = bt.step([use(0), use(0)]);
    assert.equal(ofType(evs, 'weather-start').length, 0);
    assert.equal(bt.state().weather.kind, null);
  });
});

// --- Capture Stance floor against weather chip ------------------------------------------------------------

describe('weather chip under Capture Stance', () => {
  it('ash chip that would knock the wild creature out stops at 1 HP (floor holds), and says so', () => {
    const me = mk('stillox', 30, ['adv-ash1']);
    const wild = mk('tossup', 10, ['adv-wait']);
    wild.hp = 1;
    const bt = fight(me, wild, { kind: 'wild', captureStance: true });
    const evs = bt.step([use(0), use(0)]);
    allValid(evs);
    assert.equal(wild.hp, 1);
    assert.equal(ofType(evs, 'faint').length, 0);
    assert.equal(bt.phase, 'choose');
    const chip = ofType(evs, 'damage').find((d) => d.source === 'weather');
    assert.equal(chip.amount, 0);
  });

  it('a wild creature at 2 HP drops to exactly 1 with stanceFloor set', () => {
    const me = mk('stillox', 30, ['adv-ash1']);
    const wild = mk('tossup', 30, ['adv-wait']);
    wild.hp = 2;
    const bt = fight(me, wild, { kind: 'wild', captureStance: true });
    const evs = bt.step([use(0), use(0)]);
    const chip = ofType(evs, 'damage').find((d) => d.source === 'weather');
    assert.equal(wild.hp, 1);
    assert.equal(chip.stanceFloor, true);
  });

  it('the floor is the wild side\'s only: the player\'s creature can still be chipped out', () => {
    const me = mk('tossup', 10, ['adv-wait']);
    me.hp = 1;
    const bench = mk('stillox', 10, ['adv-wait']);
    const wild = mk('stillox', 30, ['adv-ash1']);
    const bt = fight([me, bench], wild, { kind: 'wild', captureStance: true });
    const evs = bt.step([use(0), use(0)]);
    assert.equal(me.hp, 0);
    assert.equal(ofType(evs, 'faint').length, 1);
  });

  it('with the stance off, weather chip knocks the wild creature out', () => {
    const me = mk('stillox', 30, ['adv-ash1']);
    const wild = mk('tossup', 10, ['adv-wait']);
    wild.hp = 1;
    const bt = fight(me, wild, { kind: 'wild', captureStance: false });
    bt.step([use(0), use(0)]);
    assert.equal(wild.hp, 0);
    assert.equal(bt.phase, 'ended');
  });
});

// --- held items on a fainting hit ---------------------------------------------------------------------------

describe('held items on a fainting hit', () => {
  it('a threshold heal does not fire on the hit that knocks its holder out (and is not used up)', () => {
    const me = mk('tossup', 10, ['adv-wait'], { heldItem: 'adv-berry' });
    const bt = fight([me, mk('stillox', 10, ['adv-wait'])], mk('emberjaw', 60, ['adv-plain-big']));
    const evs = bt.step([use(0), use(0)]);
    allValid(evs);
    assert.equal(me.hp, 0);
    assert.equal(ofType(evs, 'held-item').length, 0);
    assert.equal(ofType(evs, 'heal').length, 0);
    assert.equal(me.heldItem, 'adv-berry');
    assert.deepEqual(bt.result().consumedItems, []);
  });

  it('Cork Float endures the first hit of a multi-hit from full; the second hit knocks it out', () => {
    const me = mk('tossup', 10, ['adv-wait'], { heldItem: 'cork-float' });
    const bt = fight([me, mk('stillox', 10, ['adv-wait'])], mk('emberjaw', 60, ['adv-twice']));
    const evs = bt.step([use(0), use(0)]);
    allValid(evs);
    const hits = ofType(evs, 'damage').filter((d) => d.side === 0 && d.source === 'party');
    assert.equal(hits.length, 2);
    assert.equal(hits[0].hp, 1, 'first hit: bobs up at 1');
    assert.equal(hits[1].hp, 0, 'second hit: not from full, so it goes under');
    assert.deepEqual(ofType(evs, 'held-item').map((e) => e.effect), ['endure']);
    const types = evs.map((x) => x.type);
    assert.ok(types.indexOf('held-item') > types.indexOf('damage'), 'announced after the damage it changed');
  });

  it('Cork Float never fires on weather or status chip, nor when the hit would not knock it out', () => {
    const me = mk('tossup', 10, ['adv-wait'], { heldItem: 'cork-float' });
    me.hp = 1;
    me.stats = { ...me.stats, hp: 1 };
    const bt = fight([me, mk('stillox', 10, ['adv-wait'])], mk('stillox', 30, ['adv-ash1']));
    const evs = bt.step([use(0), use(0)]);
    assert.equal(ofType(evs, 'held-item').length, 0, 'max HP 1: nothing to endure with');
    const me2 = mk('tossup', 30, ['adv-wait'], { heldItem: 'cork-float' });
    const bt2 = fight([me2, mk('stillox', 10, ['adv-wait'])], mk('tossup', 5, ['adv-plain']));
    const e2 = bt2.step([use(0), use(0)]);
    assert.equal(ofType(e2, 'held-item').length, 0, 'a hit that leaves HP is not endured');
  });

  it('a wild Cork Float holder under Capture Stance: the floor already holds, so the item is not spent', () => {
    const me = mk('emberjaw', 60, ['adv-plain-big']);
    const wild = mk('tossup', 10, ['adv-wait'], { heldItem: 'cork-float' });
    const bt = fight(me, wild, { kind: 'wild', captureStance: true });
    const evs = bt.step([use(0), use(0)]);
    assert.equal(wild.hp, 1);
    assert.equal(ofType(evs, 'held-item').length, 0);
  });

  it('a consumable endure item is used up by the hit it saves; the result lists it once', () => {
    const me = mk('tossup', 10, ['adv-wait'], { heldItem: 'adv-cork' });
    const bt = fight([me, mk('stillox', 10, ['adv-wait'])], mk('emberjaw', 60, ['adv-plain-big']));
    const evs = bt.step([use(0), use(0)]);
    allValid(evs);
    assert.equal(me.hp, 1);
    assert.equal(me.heldItem, null);
    assert.deepEqual(ofType(evs, 'held-item').map((e) => [e.effect, e.consumed]), [['endure', true]]);
    me.hp = me.stats.hp;
    bt.step([use(0), use(0)]);
    assert.equal(me.hp, 0, 'used up: the next knock-out hit lands');
    assert.deepEqual(bt.result().consumedItems, [{ side: 0, uid: me.uid, item: 'adv-cork' }]);
  });
});

// --- consumption across a switch -------------------------------------------------------------------------

describe('held items across a switch', () => {
  it('a consumed item stays consumed after switching out and back; the result lists it once', () => {
    const a = mk('stillox', 40, ['adv-wait'], { heldItem: 'adv-berry' });
    const b = mk('stillox', 40, ['adv-wait']);
    const bt = fight([a, b], mk('tossup', 40, ['adv-plain']));
    a.hp = Math.ceil(a.stats.hp / 2) + 1;
    bt.step([use(0), use(0)]);
    assert.equal(a.heldItem, null);
    bt.step([{ type: 'switch', to: 1 }, use(0)]);
    bt.step([{ type: 'switch', to: 0 }, use(0)]);
    a.hp = Math.ceil(a.stats.hp / 2) + 1;
    const evs = bt.step([use(0), use(0)]);
    assert.equal(ofType(evs, 'held-item').length, 0);
    assert.deepEqual(bt.result().consumedItems, [{ side: 0, uid: a.uid, item: 'adv-berry' }]);
    assert.equal(bt.state().sides[0].party[0].heldItem, null);
  });

  it('Cork Float\'s once-a-battle use follows the creature through a switch', () => {
    const a = mk('tossup', 10, ['adv-wait'], { heldItem: 'cork-float' });
    const b = mk('stillox', 60, ['adv-wait']);
    const bt = fight([a, b], mk('emberjaw', 60, ['adv-plain-big']));
    bt.step([use(0), use(0)]);
    assert.equal(a.hp, 1);
    bt.step([{ type: 'switch', to: 1 }, use(0)]);
    a.hp = a.stats.hp;
    bt.step([{ type: 'switch', to: 0 }, use(0)]);
    assert.equal(a.hp, 0, 'second knock-out hit from full in the same battle is not endured');
  });

  it('a teammate holding the same consumable keeps its own use after the first is spent', () => {
    const a = mk('stillox', 40, ['adv-wait'], { heldItem: 'adv-berry' });
    const b = mk('stillox', 40, ['adv-wait'], { heldItem: 'adv-berry' });
    const bt = fight([a, b], mk('tossup', 40, ['adv-plain']));
    a.hp = Math.ceil(a.stats.hp / 2) + 1;
    bt.step([use(0), use(0)]);
    bt.step([{ type: 'switch', to: 1 }, use(0)]);
    b.hp = Math.ceil(b.stats.hp / 2) + 1;
    const evs = bt.step([use(0), use(0)]);
    assert.deepEqual(ofType(evs, 'held-item').map((e) => [e.uid, e.consumed]), [[b.uid, true]]);
    assert.deepEqual(bt.result().consumedItems.map((x) => x.uid), [a.uid, b.uid]);
  });

  it('Ballast Stone re-applies on each entry without stacking (stages reset on the switch)', () => {
    const a = mk('stillox', 40, ['adv-wait'], { heldItem: 'ballast-stone' });
    const b = mk('stillox', 40, ['adv-wait']);
    const bt = fight([a, b], mk('tossup', 40, ['adv-wait']));
    assert.deepEqual([bt.sides[0].vol.stages.def, bt.sides[0].vol.stages.spd, bt.sides[0].vol.stages.spe], [1, 1, -1]);
    bt.step([{ type: 'switch', to: 1 }, use(0)]);
    bt.step([{ type: 'switch', to: 0 }, use(0)]);
    // adv-wait was not used by a since it came back; def stays +1 from the stone, not +2
    assert.deepEqual([bt.sides[0].vol.stages.def, bt.sides[0].vol.stages.spd, bt.sides[0].vol.stages.spe], [1, 1, -1]);
  });
});

// --- determinism across processes ------------------------------------------------------------------------------

describe('deterministic replays across processes', () => {
  const script = `
    import { createHash } from 'node:crypto';
    import { playBattle, buildParty, itemRows, trainerParty, PARTIES } from './tools/balance-sim.mjs';
    import { TRAINER_BY_ID } from './js/data/trainers.js';
    import { SPIRE_BY_ID } from './js/data/spires.js';
    import { makeRng } from './js/core/rng.js';
    const out = [];
    for (const [key, trId, cyc] of [['weather', 'ines-spire', true], ['mirror', 'seraphine-spire', false], ['summit', 'cass-keeper', false], ['summit', 'idris-champion', false]]) {
      for (const st of ['sloshkin', 'reedkit']) {
        const party = buildParty(key, st);
        const tr = TRAINER_BY_ID[trId];
        const r = playBattle(party, trainerParty(tr), { rng: makeRng('xproc:' + trId + ':' + st), trainer: tr, source: 'spire', items: itemRows(key, party), weatherCycle: cyc ? SPIRE_BY_ID.weather.theme.rule : null });
        out.push([trId, st, r.outcome, r.turns, createHash('sha256').update(JSON.stringify(r.events)).digest('hex')]);
      }
    }
    process.stdout.write(JSON.stringify(out));
  `;
  const runOnce = () => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: ROOT, encoding: 'utf8' }));

  it('two fresh Node processes replay Weather, Mirror, Cass and Idris fights event for event', () => {
    const a = runOnce();
    const b = runOnce();
    assert.equal(a.length, 8);
    assert.deepEqual(a, b);
  });
});

// --- AI and nullified moves -------------------------------------------------------------------------------------

describe('AI never picks a move the weather nullifies while another option exists', () => {
  it('a smothered type deals no damage and the menu shows a 0 multiplier', () => {
    assert.equal(damageFormula({ level: 50, power: 90, attack: 100, defense: 100, typeMult: 1, stab: true, crit: false, rand: 1, extra: 0 }, DEFAULTS), 0);
    const me = mk('sootling', 40, ['adv-kiln', 'adv-plain']);
    const foe = mk('tossup', 40, ['adv-wait']);
    const bt = fight(me, foe, { weather: 'smother' });
    const menu = bt.legal(0).moves;
    assert.equal(menu[0].weatherMult, 0);
    assert.equal(bt.estimateDamage(0, 0).max, 0);
    const hp = foe.hp;
    bt.step([use(0), use(0)]);
    assert.equal(foe.hp, hp, 'a smothered hit removes nothing');
  });

  it('trainer AI picks the weaker unsmothered hit, even with the finisher in reach', () => {
    for (const profile of ['trainer', 'spire', 'summit']) {
      const me = mk('emberjaw', 50, ['adv-kiln', 'adv-plain']);
      const foe = mk('tossup', 30, ['adv-wait']);
      const bt = fight(foe, me, { weather: 'smother' });
      assert.equal(chooseAction(bt, 1, { profile }).move, 1, `${profile}: plain over smothered Kiln`);
      foe.hp = 1;
      assert.equal(chooseAction(bt, 1, { profile }).move, 1, `${profile}: the finisher does not reach for the smothered move`);
    }
  });

  it('the last-resort fallback skips a smothered move when a status move is the only alternative', () => {
    const me = mk('emberjaw', 50, ['adv-kiln', 'adv-poison']);
    const foe = mk('tossup', 30, ['adv-wait']);
    foe.status = { kind: 'burn', turns: 0 }; // poison cannot take, so the status step passes over it
    const bt = fight(foe, me, { weather: 'smother' });
    const a = chooseAction(bt, 1, { profile: 'trainer' });
    assert.notEqual(a.move, 0, 'not the smothered Kiln move');
  });

  it('the wild brain never draws a smothered move while another is selectable', () => {
    const me = mk('emberjaw', 50, ['adv-kiln', 'adv-wait']);
    const foe = mk('tossup', 30, ['adv-wait']);
    const bt = fight(foe, me, { kind: 'wild', weather: 'smother' });
    for (const v of [0, 0.3, 0.6, 0.99]) {
      bt.rng = constRng(v);
      bt.rng.pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(v * arr.length))];
      assert.notEqual(chooseWildAction(bt, 1).move, 0);
    }
  });

  it('when the smothered move is the only selectable move, the AI still acts legally (it uses it)', () => {
    const me = mk('emberjaw', 50, ['adv-kiln']);
    const bt = fight(mk('tossup', 30, ['adv-wait']), me, { weather: 'smother' });
    assert.deepEqual(chooseAction(bt, 1, { profile: 'trainer' }), { type: 'move', move: 0 });
  });

  it('replacements avoid a creature whose only hits are smothered', () => {
    const lead = mk('tossup', 5, ['adv-wait']);
    const kiln = mk('emberjaw', 50, ['adv-kiln']);
    const plain = mk('tossup', 45, ['adv-plain']);
    const bt = fight(mk('stillox', 60, ['adv-plain-big']), [lead, kiln, plain], { weather: 'smother' });
    bt.step([use(0), use(0)]);
    assert.equal(bt.phase, 'replace');
    assert.deepEqual(chooseReplacement(bt, 1), { type: 'switch', to: 2 });
  });
});

// --- the Ward readout names weather chip ------------------------------------------------------------------------

describe('the Ward readout lists weather chip as indirect damage (wildshift-rules 8.3)', () => {
  const readout = (opts) => {
    const bt = fight(mk('tossup', 30, ['adv-plain']), mk('prismoth', 30, ['adv-wait']), opts);
    const evs = bt.step([use(0), use(0)]);
    allValid(evs);
    return ofType(evs, 'ward-readout')[0];
  };
  it('ash in force: "weather chip (Ash)" beside poison, burn and trap', () => {
    const r = readout({ weather: 'ash' });
    assert.ok(r.indirect.includes('weather chip (Ash)'), r.indirect.join(', '));
    assert.match(r.text, /weather chip \(Ash\)/);
  });
  it('ash posted on the strip: named as posted; no chipping weather: not named', () => {
    const r = readout({ weatherCycle: { cycle: ['steam', 'ash'], turnsEach: 2 } });
    assert.ok(r.indirect.includes('weather chip (Ash, posted)'), r.indirect.join(', '));
    const none = readout({ weather: 'steam' });
    assert.ok(!none.indirect.some((x) => x.startsWith('weather chip')));
  });
  it('a chip-immune Ward creature (Stone) is not told weather chip works', () => {
    const bt = fight(mk('tossup', 30, ['adv-plain']), mk('cairnward', 30, ['adv-wait']), { weather: 'ash' });
    const r = ofType(bt.step([use(0), use(0)]), 'ward-readout')[0];
    assert.ok(r, 'Stillcoat blocks a 40-power hit');
    assert.ok(!r.indirect.some((x) => x.startsWith('weather chip')));
  });
});
