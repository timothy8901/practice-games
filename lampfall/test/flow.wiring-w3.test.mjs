// Wave 3 wiring regressions: thread pacing in the talk resolver, the resident share through the
// script `beat` op, Porch Duel visitors in the battle flow, the trainer intro said once, the duel
// slate on an early clock, the dock hold-out narrated honestly, and the menus reading the HUD
// chip's objective picker.
// Run: node --test test/flow.wiring-w3.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveScript, threadBeatScripts } from '../js/script/registry.js';
import { scriptSystems, createSession } from '../js/scenes/scriptHost.js';
import * as threads from '../js/systems/threads.js';
import * as loans from '../js/systems/loans.js';
import * as bag from '../js/systems/bag.js';
import * as F from '../js/systems/flow/battleFlow.js';
import * as party from '../js/systems/party.js';
import * as creature from '../js/systems/creature.js';
import { realBattleData } from '../js/scenes/battleData.js';
import { duelSlate, dowOf } from '../js/systems/townCommon.js';
import { PORCH_DUELS } from '../js/data/town.js';
import { TUNING } from '../js/data/tuning.js';
import { makeGame, prepare, runSession } from './fixtures/townDriver.mjs';

const DAY = 1440;
const T = threads.tuningOf(null);

function setClock(G, day, hour, minute = 0) {
  G.store.tx('test:clock', (w) => { w.clock.total = day * DAY + hour * 60 + minute; });
}
function setThread(G, id, beat, lastAdvancedDay) {
  G.store.tx('test:thread', (w) => { w.threads[id] = { ...threads.stateOf(w, id), beat, startedDay: 1, lastAdvancedDay, done: false }; });
}
function place(G, mapId, x, y) {
  G.store.tx('test:place', (w) => { w.player.mapId = mapId; w.player.x = x; w.player.y = y; });
}
const talk = (G, id, extra = {}) => resolveScript(G.world, G.data, { kind: 'npc', id, mapId: G.world.player.mapId, ...extra });
/** A core day >= from that is not the Monday (the Monday waiver lifts spacing) and is not `notDow`. */
function plainDay(from, notDow = -1) {
  for (let d = from; ; d++) { const dow = dowOf(d, T); if (dow !== T.threadMondayDow && dow !== notDow) return d; }
}

describe('talk honours thread pacing (registry step 1 = threads.beatTopics)', () => {
  it('a beat carried by someone else plays from them, not the thread owner (Fence 3 from Ambrose)', () => {
    const G = makeGame('W3-FENCE');
    prepare(G);
    const d = plainDay(5);
    setThread(G, 'the-fence', 2, d - 1);
    G.store.tx('test:timber', (w) => bag.give(w, 'timber', 3, { data: G.data }));
    setClock(G, d, 10);
    place(G, 'pellwick', 40, 15);
    assert.notEqual(talk(G, 'bryony').scriptId, 'th-the-fence-3');
    const r = talk(G, 'ambrose');
    assert.equal(r.scriptId, 'th-the-fence-3');
    assert.equal(r.source, 'thread');
  });

  it('one beat a day: a beat that advanced today keeps the next one (and its topic hook) for tomorrow', () => {
    const G = makeGame('W3-ONEDAY');
    prepare(G);
    const d = plainDay(5);
    setThread(G, 'the-fence', 2, d);
    G.store.tx('test:timber', (w) => bag.give(w, 'timber', 3, { data: G.data }));
    setClock(G, d, 10);
    const r = talk(G, 'ambrose');
    assert.notEqual(r.scriptId, 'th-the-fence-3', `got ${r.scriptId} from ${r.source}`);
    assert.ok(threadBeatScripts(G.data).has('th-the-fence-3'));
  });

  it("Mudlark beat 2 waits its two days; the porch beat plays only at the porch; beat 5 only on Saturday", () => {
    const G = makeGame('W3-MUD');
    prepare(G);
    const d = plainDay(8);
    setThread(G, 'mudlark-mile', 1, d - 1);
    setClock(G, d, 7);
    place(G, 'pellwick', 32, 23);
    assert.equal(threads.beatBlock(G.world, G.data, G.data.get('threads', 'mudlark-mile')), 'spacing');
    assert.notEqual(talk(G, 'tully').scriptId, 'th-mudlark-mile-2');
    setThread(G, 'mudlark-mile', 1, d - 2);
    assert.equal(talk(G, 'tully').scriptId, 'th-mudlark-mile-2');
    // beat 4 is porch talk
    setThread(G, 'mudlark-mile', 3, d - 1);
    setClock(G, d, 20);
    assert.notEqual(talk(G, 'tully').scriptId, 'th-mudlark-mile-4');
    assert.equal(resolveScript(G.world, G.data, { kind: 'porch', id: 'tully', mapId: 'pellwick' }).scriptId, 'th-mudlark-mile-4');
    // beat 5 runs on Saturday (GDD weekday 5) at low tide
    setThread(G, 'mudlark-mile', 4, 0);
    const def = G.data.get('threads', 'mudlark-mile');
    const days = [];
    for (let dd = d + 1; dd < d + 8; dd++) {
      for (let m = 0; m < DAY; m += 30) {
        G.store.tx('test:clock', (w) => { w.clock.total = dd * DAY + m; });
        if (threads.beatBlock(G.world, G.data, def) === null) { days.push(dowOf(dd, T)); break; }
      }
    }
    assert.deepEqual([...new Set(days)], [5]);
  });

  it("oyster-boat beat 2 needs Tamsin's place, the boat in the north creek", () => {
    const G = makeGame('W3-OYSTER');
    prepare(G);
    G.store.tx('test:flag', (w) => { w.flags['sp.tamsin-arrived'] = true; });
    const d = plainDay(6);
    setThread(G, 'oyster-boat', 1, d - 1);
    setClock(G, d, 10);
    place(G, 'pellwick', 9, 30);
    assert.notEqual(talk(G, 'tamsin').scriptId, 'th-oyster-boat-2');
    place(G, 'pellwick', 44, 6);
    assert.equal(talk(G, 'tamsin').scriptId, 'th-oyster-boat-2');
    const beat = G.data.get('threads', 'oyster-boat').beats.find((b) => b.id === 2);
    assert.deepEqual(beat.where, { mapId: 'pellwick', x: 44, y: 5 });
  });
});

describe('the script beat op pays the resident share (scriptHost.setBeat injects loans)', () => {
  it('finishing a lead thread through setBeat credits the share once and toasts once', () => {
    const G = makeGame('W3-SHARE');
    G.store.tx('test:meet', (w) => { w.npcs.bryony = { ...(w.npcs.bryony ?? {}), met: true }; });
    setThread(G, 'the-fence', 3, 1);
    const before = loans.balance(G.world, { data: G.data });
    const sys = scriptSystems(G);
    const r = G.store.tx('test:beat', (w) => sys.setBeat(w, 'the-fence', 4));
    assert.equal(r.ok, true);
    assert.equal(r.done, true);
    assert.ok(r.share && r.share.ok, 'the share came back from the injected collaborator');
    assert.ok(G.world.loans.residentShares.includes('the-fence'));
    assert.ok(loans.balance(G.world, { data: G.data }) < before);
    assert.equal(G.world.loans.residentShares.filter((x) => x === 'the-fence').length, 1);
    assert.equal(G.toastLog.filter((t) => /neighbour/i.test(String(t))).length, 1, G.toastLog.join(' | '));
    assert.equal(typeof sys.restartSummit, 'function');
  });
});

describe('Porch Duel visitors (battleFlow honours setup.porchDuel)', () => {
  const data = realBattleData();
  const tuning = F.tuningFor(data);
  function makeG() {
    const G = makeGame('W3-DUEL');
    G.store.tx('dial', (w) => { w.run.dial = 'flux'; w.badges.push('turn', 'ward'); });
    return G;
  }
  function give(G, speciesId, level) {
    return G.store.tx('give', (w) => party.addCreature(w, creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh(`t:${w.party.length}`), tuning, speciesId, level }, data), data, { tuning, caught: true }));
  }
  function playOut(session) {
    const b = session.battle;
    for (let i = 0; i < 400 && b.phase !== 'ended'; i++) {
      const lg = b.legal(0);
      if (b.phase === 'replace') { if (b.pendingReplace.includes(0)) b.step({ type: 'switch', to: lg.switches.find((s) => s.selectable).index }); else b.step(null); continue; }
      let best = -1; let score = -Infinity;
      lg.moves.forEach((m, k) => { const v = m.selectable ? (m.power || 1) * (m.mult ?? 1) : -Infinity; if (v > score) { score = v; best = k; } });
      b.step(F.prepareAction(session, best >= 0 ? { type: 'move', move: best } : { type: 'scrap' }));
    }
    return b.result();
  }

  it('the shipped table posts visitors', () => { assert.equal(PORCH_DUELS.visitorsLive, true); });

  it('a beaten leader visits scaled to the party median, sized by badges, with none of the Spire rules', () => {
    const G = makeG();
    give(G, 'sloshkin', 50); give(G, 'tossup', 5); give(G, 'scrapling', 5);
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'osric-spire', source: 'duel', porchDuel: true }, data);
    assert.equal(s.porchDuel, true);
    assert.equal(s.startPayload.porchDuel, true);
    assert.equal(s.startPayload.spire, false);
    assert.equal(s.blackoutAllowed, false);
    assert.equal(s.summit, false);
    assert.equal(s.story, false);
    assert.equal(G.world.battleBookmark.kind, 'duel');
    const foes = s.battle.sides[1].party;
    assert.equal(foes.length, PORCH_DUELS.partySizeByBadges[2]);
    assert.deepEqual(foes.map((c) => c.level), [5, 6], 'median 5: the ace one over');
    assert.equal(s.battle.sides[1].trainer.payout, 0);
    assert.ok(foes.every((c) => !c.bossShift && !c.onEntry), 'no posted boss Shift at a porch');
  });

  it('a win sets no defeated flag, pays no trainer payout or badge, runs no script, and heals', () => {
    const G = makeG();
    give(G, 'sloshkin', 50); give(G, 'tossup', 5); give(G, 'scrapling', 5);
    const glint = G.world.wallet.main;
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'maud-spire', source: 'duel', porchDuel: true }, data);
    const r = playOut(s);
    assert.equal(r.outcome, 'win');
    const post = F.applyBattleResult(G, s, { bus: null });
    assert.equal(post.porchDuel, true);
    assert.equal(post.payout, 0);
    assert.equal(post.badge, null);
    assert.equal(post.script, null);
    assert.equal(G.world.flags['sys.trainer.maud-spire'] ?? null, null);
    assert.equal(G.world.wallet.main, glint, 'the purse is storyHooks\' (battle:end porchDuel)');
    assert.deepEqual(G.world.badges, ['turn', 'ward']);
    assert.ok(G.world.party.every((c) => c.hp === c.stats.hp));
    assert.equal(G.world.battleBookmark, null);
  });

  it('a Keeper visiting is not the Summit; a route trainer never blacks you out', () => {
    const G = makeG();
    give(G, 'sloshkin', 12);
    const k = F.buildBattle(G, { kind: 'trainer', trainerId: 'bastien-keeper', source: 'duel', porchDuel: true }, data);
    assert.equal(k.summit, false);
    assert.equal(k.blackoutAllowed, false);
    const r = F.buildBattle(G, { kind: 'trainer', trainerId: 'lowmoor-osier', source: 'duel', porchDuel: true }, data);
    assert.equal(r.blackoutAllowed, false);
    assert.ok(r.battle.sides[1].party.every((c) => c.level >= 11 && c.level <= 13));
  });

  it('a neighbour porch duel no longer flags the trainer beaten (they duel again another evening)', () => {
    const G = makeG();
    give(G, 'sloshkin', 50); give(G, 'tossup', 5); give(G, 'scrapling', 5);
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'porch-wren', source: 'duel' }, data);
    assert.equal(s.porchDuel, true);
    playOut(s);
    F.applyBattleResult(G, s, { bus: null });
    assert.equal(G.world.flags['sys.trainer.porch-wren'] ?? null, null);
  });
});

describe('the trainer intro is spoken once', () => {
  it('interactFlow starts the battle without a pre-battle intro dialogue', () => {
    const src = readFileSync(new URL('../js/systems/flow/interactFlow.js', import.meta.url), 'utf8');
    assert.ok(!/G\.push\('dialogue', \{[^}]*lines\??\.intro/.test(src), 'no dialogue carries lines.intro');
  });
});

describe('the duel slate on an early clock (townCommon.duelSlate)', () => {
  it('before day 0\'s 06:00 post the slate is empty instead of throwing', () => {
    const G = makeGame('W3-SLATE');
    setClock(G, 0, 1);
    const s = duelSlate(G.world, PORCH_DUELS, { data: G.data });
    assert.deepEqual(s.offers, []);
    assert.equal(s.gameDay, 0);
  });
});

describe('the dock hold-out is narrated honestly', () => {
  it('battleFlow records held / fell, and linnet-dock-after says which', () => {
    const data = realBattleData();
    const tuning = F.tuningFor(data);
    const G = makeGame('W3-DOCK');
    G.store.tx('give', (w) => party.addCreature(w, creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh('t'), tuning, speciesId: 'reedkit', level: 5 }, data), data, { tuning, caught: true }));
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'linnet-dock', source: 'story', holdOut: 3 }, data);
    const b = s.battle;
    for (let i = 0; i < 200 && b.phase !== 'ended'; i++) {
      if (b.phase === 'replace') { b.step(null); continue; }
      b.step(F.prepareAction(s, { type: 'move', move: 0 }));
    }
    const post = F.applyBattleResult(G, s, { bus: null });
    const want = b.result().outcome === 'loss' ? 'fell' : 'held';
    assert.equal(G.world.flags[`${F.HOLDOUT_FLAG_PREFIX}linnet-dock`], want);
    assert.equal(post.held, want === 'held');
    for (const flag of ['fell', 'held']) {
      G.store.tx('f', (w) => { w.flags['sys.holdout.linnet-dock'] = flag; });
      const said = [];
      const session = createSession(G, { scriptId: 'linnet-dock-after' });
      let answer;
      for (let k = 0; k < 400; k++) {
        const req = session.next(answer);
        if (!req || req.done) break;
        answer = undefined;
        if (req.op === 'say' || req.text) said.push(String(req.text ?? ''));
        if (req.op === 'choice') answer = 0;
      }
      const all = said.join(' | ') + ' | ' + G.toastLog.join(' | ');
      if (flag === 'fell') { assert.match(all, /You did not hold/); assert.doesNotMatch(said.join(' '), /Keeper, you held/); }
      else assert.match(all, /Keeper, you held/);
    }
  });
});

describe('the pause menu and map name the HUD chip\'s objective', () => {
  it('menu.js and mapScreen.js read objectiveFor', () => {
    for (const f of ['menu.js', 'mapScreen.js']) {
      const src = readFileSync(new URL(`../js/scenes/${f}`, import.meta.url), 'utf8');
      assert.match(src, /import \{ objectiveFor \} from '\.\.\/ui\/objectiveChip\.js'/, f);
      assert.doesNotMatch(src, /currentObjective\(/, f);
    }
  });
});

// keep the runSession import honest for fixtures that use it
void runSession; void TUNING;

describe('the Shift Tide line (lit.shiftTide): pending windows chalked with their three cards', async () => {
  const { boardContent } = await import('../js/systems/flow/interactFlow.js');
  const { shiftTideRows } = await import('../js/systems/flow/shiftTide.js');
  const forecastSys = await import('../js/systems/forecast.js');
  const { tomorrowLine } = await import('../js/scenes/dayPage.js');
  const data2 = realBattleData();
  const tuning2 = F.tuningFor(data2);
  function setup(lit) {
    const G = makeGame('W3-TIDE');
    G.store.tx('give', (w) => {
      const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh('t'), tuning: tuning2, speciesId: 'sloshkin', level: 8, nickname: 'PUDDLE' }, data2);
      party.addCreature(w, c, data2, { tuning: tuning2, caught: true });
      w.pendingShifts = [c.uid];
      if (lit) w.flags['lit.shiftTide'] = true;
    });
    return G;
  }
  it('nothing is chalked before the Relighting', () => {
    const G = setup(false);
    assert.deepEqual(shiftTideRows(G.world, G.data), []);
    assert.ok(!boardContent(G, 'tide').lines.some((l) => l.startsWith('Chalked a tide ahead')));
  });
  it('the Tide Table and the Day Page show one row per pending window with the cards the Forecast draws', () => {
    const G = setup(true);
    const rows = shiftTideRows(G.world, G.data);
    assert.equal(rows.length, 1);
    const [row] = rows;
    assert.equal(row.cards.length, 3);
    assert.deepEqual(row.cards.map((c) => c.dir), ['up', 'side', 'down']);
    const fc = forecastSys.rollForecast(G.world, row.uid, G.data, { tuning: tuning2, dial: G.world.run.dial, steadied: false, rules: null });
    assert.deepEqual(row.cards.map((c) => c.formId), fc.cards.map((c) => c.formId), 'the cards shown are the cards drawn');
    assert.deepEqual(row.cards.map((c) => c.odds), fc.cards.map((c) => c.odds));
    const shiftCount = G.world.party[0].shiftCount;
    shiftTideRows(G.world, G.data);
    assert.equal(G.world.party[0].shiftCount, shiftCount, 'previewing consumes no draw');
    const board = boardContent(G, 'tide');
    assert.ok(board.lines.includes(row.text), board.lines.join(' | '));
    assert.match(row.text, /^Chalked a tide ahead: PUDDLE's window, cards drawn: Up .+ \d+%, Side .+ \d+%, Down .+ \d+%$/);
    assert.deepEqual(board.shiftTide.map((r) => r.uid), [row.uid]);
    const line = tomorrowLine({ kind: 'forecast', id: row.uid, params: { nickname: 'PUDDLE' } }, { data: G.data, world: G.world });
    assert.equal(line, row.text);
  });
});

describe('the Training Yard row in storage (box.js) and the cottage rooms at work (rooms.js)', async () => {
  const { yardAction, yardBuilt } = await import('../js/scenes/box.js');
  const rooms = await import('../js/systems/flow/rooms.js');
  const { doInteraction } = await import('../js/systems/flow/interactFlow.js');
  const dayPageSys = await import('../js/systems/dayPage.js');
  const { itemCount } = await import('../js/state/selectors.js');
  const data3 = realBattleData();
  const tuning3 = F.tuningFor(data3);
  function game(rooms_ = []) {
    const G = makeGame('W3-ROOMS');
    const pushed = [];
    G.push = (...a) => pushed.push(a);
    G.pushed = pushed;
    G.store.tx('rooms', (w) => {
      for (const id of rooms_) w.loans.builds.push({ id, tier: 3, startedDay: 0, readyDay: 1, choice: null, done: true });
      for (const [sp, lv] of [['tossup', 10], ['sloshkin', 10]]) party.addCreature(w, creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh(`r${sp}`), tuning: tuning3, speciesId: sp, level: lv }, data3), data3, { tuning: tuning3, caught: true });
      const c = creature.makeCreature({ uid: party.nextUid(w), rng: G.rngs.fresh('rbox'), tuning: tuning3, speciesId: 'scrapling', level: 6 }, data3);
      w.box.push(c);
    });
    return G;
  }

  it('the Yard row waits for the Yard, then sends a stored creature out and back (party.toYard / fromYard)', async () => {
    const G = game();
    const c = G.world.box[0];
    let a = yardAction(G.world, c);
    assert.equal(a.enabled, false);
    assert.equal(yardBuilt(G.world), false);
    const G2 = game(['training-yard']);
    const c2 = G2.world.box[0];
    a = yardAction(G2.world, c2);
    assert.equal(a.enabled, true);
    assert.equal(a.on, false);
    G2.store.tx('y', (w) => party.toYard(w, c2.uid, {}));
    assert.deepEqual(G2.world.yard, [c2.uid]);
    a = yardAction(G2.world, c2);
    assert.equal(a.on, true);
    assert.equal(a.label, 'Off the Yard');
    const src = readFileSync(new URL('../js/scenes/box.js', import.meta.url), 'utf8');
    assert.match(src, /partySys\.toYard\(/);
    assert.match(src, /partySys\.fromYard\(/);
    // the Commons project on the green counts too
    const G3 = game();
    G3.store.tx('f', (w) => { w.flags['sys.commons.training-yard-green'] = true; });
    assert.equal(yardBuilt(G3.world), true);
  });

  it('Workshop: a fossil comes back cleaned and a skyglass relic becomes the chosen type tilt overnight', async () => {
    const G = game(['workshop']);
    G.store.tx('give', (w) => { bag.give(w, 'ammonite', 1, { data: G.data }); bag.give(w, 'skyglass-shard', 1, { data: G.data }); });
    const host = { ask: async (o) => (o.options.includes('Kiln') ? o.options.indexOf('Kiln') : 1) };
    const r1 = await doInteraction(G, { verb: 'workshop', target: { def: {} } }, host);
    assert.equal(r1.ok, true, JSON.stringify(r1));
    assert.equal(itemCount(G.world, 'ammonite'), 0, 'on the bench');
    const r2 = await doInteraction(G, { verb: 'polish', target: { def: {} } }, host);
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(r2.tilt, 'tilt-kiln');
    assert.equal(itemCount(G.world, 'skyglass-shard'), 0);
    // the overnight bench step runs with the morning (systems/dayPage OVERNIGHT_STEPS)
    assert.ok(dayPageSys.OVERNIGHT_STEPS.includes('bench'));
    const out = G.store.tx('night', (w) => rooms.settleBenches(w, G.data, { bus: G.bus }));
    assert.equal(out.fossil, 'ammonite');
    assert.equal(out.tilt, 'tilt-kiln');
    assert.equal(itemCount(G.world, 'ammonite'), 1);
    assert.equal(G.world.collections.relics.ammonite.cleaned, true);
    assert.equal(itemCount(G.world, 'tilt-kiln'), 1);
    assert.equal(G.world.flags[rooms.BENCH_TILT_FLAG] ?? null, null);
  });

  it('Greenhouse: a creature and its favourite fruit overnight gain +1 Bond, once each', async () => {
    const G = game(['greenhouse']);
    G.store.tx('give', (w) => bag.give(w, 'pear', 2, { data: G.data }));
    const tossup = G.world.party.find((c) => c.speciesId === 'tossup');
    const before = tossup.bond;
    const r = await doInteraction(G, { verb: 'graft', target: { def: {} } }, { ask: async () => 1 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.uid, tossup.uid, 'the pear is the Plain type\'s favourite');
    G.store.tx('night', (w) => rooms.settleBenches(w, G.data, { bus: G.bus }));
    assert.equal(G.world.party.find((c) => c.uid === tossup.uid).bond, before + 1);
    const again = G.store.tx('again', (w) => rooms.benchBond(w, G.data, tossup.uid, {}));
    assert.deepEqual(again, { ok: false, reason: 'spent' });
  });

  it('Porch & Loft: the telescope answers, and an unbuilt room keeps its atmosphere line', async () => {
    const G = game(['porch-loft']);
    const r = await doInteraction(G, { verb: 'loft', target: { def: {} } }, {});
    assert.equal(r.ok, true);
    assert.ok(Array.isArray(r.errants));
    const G2 = game();
    const r2 = await doInteraction(G2, { verb: 'loft', target: { def: {} } }, {});
    assert.equal(r2.errants, undefined);
  });
});

describe('a cleaned fossil sells at the cleaned price once (shop.archiveSell)', async () => {
  const { archiveSell } = await import('../js/scenes/shop.js');
  const fieldLogSys = await import('../js/systems/fieldLog.js');
  it('the first copy sells +40%, the cleaned mark is spent, the next sells plain', () => {
    const G = makeGame('W3-CLEAN');
    G.store.tx('give', (w) => {
      bag.give(w, 'ammonite', 3, { data: G.data });
      w.collections.relics.ammonite = { n: 3, cleaned: false };
      w.collections.donated.push('ammonite');
      fieldLogSys.benchClean(w, 'ammonite', { data: G.data });
    });
    const row = G.data.get('collections', 'ammonite');
    const unit = typeof row.archivePrice === 'number' ? row.archivePrice : row.price;
    const before = G.world.wallet.main;
    const r = archiveSell(G, 'ammonite', 2);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.amount, Math.round(unit * 1.4) + unit);
    assert.equal(G.world.wallet.main - before, r.amount);
    assert.equal(fieldLogSys.hasCleaned(G.world, 'ammonite'), false);
    assert.equal(archiveSell(G, 'ammonite', 1).amount, unit);
  });
});

describe('tools/economy-sim.mjs pays Porch Duels as the game does', () => {
  it('the duel purse is 30 × curve with no Lucky Button multiplier', () => {
    const src = readFileSync(new URL('../tools/economy-sim.mjs', import.meta.url), 'utf8');
    assert.match(src, /earn\(day, 'duels', n \* tuning\.porchDuelPerCurve \* duelCurve\[Math\.min\(badges\.length, duelCurve\.length - 1\)\], /);
    assert.equal(TUNING.porchDuelPerCurve, 30);
  });
});
