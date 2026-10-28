// Final fix wave (rest lane): regressions for FE-03 / FE-07 (story speakers are met, the Porch Duel
// slate fills in), LF-08 (the visitor is offered under the Commons lamp after the board), and the
// other early / late findings fixed in this lane.
// Run: node --test test/flow.final-fix-rest.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PORCH_DUELS } from '../js/data/town.js';
import * as flags from '../js/systems/flags.js';
import * as dayPage from '../js/systems/dayPage.js';
import * as dayFlow from '../js/systems/flow/dayFlow.js';
import { duelSlipLines, doInteraction } from '../js/systems/flow/interactFlow.js';
import { createSession, resolveTalk } from '../js/scenes/scriptHost.js';
import { t, numberWord } from '../js/data/strings.js';
import { makeGame, runSession } from './fixtures/townDriver.mjs';

const DAY = 1440;
const at = (G, day, h, m = 0) => G.store.tx('test:clock', (w) => { w.clock.total = (day - 1) * DAY + h * 60 + m; });

describe('FE-03 / FE-07: NPCs who speak in story scripts are met', () => {
  it('a story script marks its speakers met and lists them on the Day Page, without counting a talk', () => {
    const G = makeGame('FE03-MET');
    at(G, 1, 15);
    assert.notEqual(G.world.npcs.wren?.met, true);
    runSession(G, createSession(G, { scriptId: 'arrival-causeway' }));
    assert.equal(G.world.npcs.wren.met, true);
    assert.equal(G.world.npcs.wren.talks ?? 0, 0, 'talks counts real conversations only');
    assert.ok(dayPage.summarize(G.world, G.data).talkedTo.includes('wren'));
  });

  it('the first-meeting intro does not replay for someone met in a scene', () => {
    const G = makeGame('FE07-INTRO');
    at(G, 1, 15);
    runSession(G, createSession(G, { scriptId: 'arrival-causeway' }));
    const s = resolveTalk(G, { kind: 'npc', id: 'wren', mapId: 'pellwick' });
    assert.notEqual(s.scriptId, 'talk-wren-first');
  });

  it('an evening posted empty at 06:00 fills in once neighbours are met (the Commons slip lists them)', () => {
    const G = makeGame('FE03-SLATE');
    at(G, 2, 6);
    G.store.tx('post', (w) => dayFlow.postDuelSlate(w, G.data, {}));
    assert.equal(flags.getFlag(G.world, 'sys.duel.day'), 2);
    assert.deepEqual(duelSlipLines(G), [PORCH_DUELS.slip.none || t('duel.none')]);
    // the day-1 story's speakers
    for (const id of ['arrival-causeway', 'wick-keeper', 'tully-nickname', 'wick-errands']) {
      if (G.data.has('scripts', id)) runSession(G, createSession(G, { scriptId: id }));
    }
    at(G, 2, 19, 4);
    G.store.tx('post', (w) => dayFlow.postDuelSlate(w, G.data, {}));
    const lines = duelSlipLines(G);
    assert.equal(lines[0], PORCH_DUELS.slip.header, lines.join(' / '));
    assert.ok(lines.length >= 2);
    // a posted slate with someone on it stays frozen
    const before = JSON.stringify(G.world.flags);
    G.store.tx('post', (w) => dayFlow.postDuelSlate(w, G.data, {}));
    assert.equal(JSON.stringify(G.world.flags), before);
  });
});

describe('LF-08: the visitor Porch Duel is offered under the Commons lamp, after the board', () => {
  it('the slip names the Commons lamp and the prompt counts in words', async () => {
    const G = makeGame('LF08-VISIT');
    const party = await import('../js/systems/party.js');
    G.store.tx('c', (w) => party.giveCreature(w, { species: 'tossup', level: 5 }, G.data, null, {}));
    G.store.tx('badge', (w) => { w.badges.push('turn'); });
    G.store.tx('meet', (w) => { for (const n of PORCH_DUELS.neighbours) { w.npcs[n.npc] = w.npcs[n.npc] ?? { met: true }; w.npcs[n.npc].met = true; } });
    at(G, 6, 20);
    const lines = duelSlipLines(G);
    assert.ok(lines.some((l) => l.includes(t('duel.commonsLamp'))), lines.join(' / '));
    assert.ok(!lines.some((l) => /\b\d creatures?\b/.test(l)), 'number words, not digits');
    // with the board overlay: the board shows first, and closing it offers the duel
    let pushedScene = null;
    let body = null;
    const host = {
      overlays: { createBoardScene: (_G, content) => ({ name: 'board', content }) },
      pushScene: (scene) => { pushedScene = scene; },
      ask: async (spec) => { body = spec.body; return 1; },
      startBattle: () => {},
    };
    const p = doInteraction(G, { verb: 'commons', target: { def: {} } }, host);
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(pushedScene && pushedScene.name === 'board', 'the board is shown');
    assert.equal(body, null, 'no duel prompt before the board closes');
    pushedScene.content.onClose();
    const r = await p;
    assert.equal(r.duel, true);
    assert.match(body, /\b(one|two|three|four|five|six) creatures?\b/);
  });

  it('numberWord', () => {
    assert.equal(numberWord(1), 'one');
    assert.equal(numberWord(3, true), 'Three');
    assert.equal(numberWord(42), '42');
    assert.equal(t('hud.shiftsPending', { n: 1 }), '1 Shift pending');
    assert.equal(t('hud.shiftsPending', { n: 2 }), '2 Shifts pending');
    assert.match(t('ceremony.pickRoom', { n: 3 }), /\.$/);
  });
});

// ---------------------------------------------------------------------------------------------
// the rest of the early / late findings
// ---------------------------------------------------------------------------------------------
import * as shops from '../js/systems/shops.js';
import * as bag from '../js/systems/bag.js';
import * as fieldLogSys from '../js/systems/fieldLog.js';
import * as loans from '../js/systems/loans.js';
import * as rooms from '../js/systems/flow/rooms.js';
import { pageLines, tomorrowLine } from '../js/scenes/dayPage.js';
import { boardContent } from '../js/systems/flow/interactFlow.js';
import { interpolate } from '../js/script/runner.js';
import { cottageRoofArt } from '../js/scenes/overworld.js';
import { verbLabel } from '../js/world/interact.js';
import { evalCond } from '../js/script/cond.js';
import { MAPS_BY_ID } from '../js/data/maps/index.js';
import { SCHEDULES } from '../js/data/schedules.js';

describe('FE-04: nothing parks on the cottage gate', () => {
  it('no NPC post, loop point or scene staging stands on the porch exit (9,25) or the gate (9,24)', () => {
    const m = MAPS_BY_ID.pellwick.markers;
    for (const id of ['hesper-cottage-gate', 'relighting-juniper', 'wick-errands']) {
      assert.ok(!(m[id].x === 9 && (m[id].y === 25 || m[id].y === 24)), id);
    }
    const loop = SCHEDULES.find((r) => r.id === 'wick-errand-run');
    for (const [x, y] of loop.points) assert.ok(y >= 25 || x !== 10 || y !== 23, `loop point ${x},${y} is outside the porch fence`);
    assert.ok(!loop.points.some(([x, y]) => x >= 8 && x <= 10 && y === 23), 'the loop never enters the porch');
  });
});

describe('FE-05: Ludo sells when you talk to him at night', () => {
  it('his talk opens the eave shop between 22:00 and 08:00, and any sale there counts as the first sale', () => {
    const G = makeGame('FE05-LUDO');
    at(G, 1, 22, 30);
    G.store.tx('meet', (w) => { w.npcs.ludo = { met: true, talks: 1, lastTalkDay: 0, lastPorchDay: -1, nickname: null, affinity: 0, favours: [], saidLines: {}, remembered: {} }; });
    const s = resolveTalk(G, { kind: 'npc', id: 'ludo', mapId: 'pellwick' });
    assert.equal(s.scriptId, 'talk-ludo-sell');
    G.store.tx('give', (w) => bag.give(w, 'pear', 3, { data: G.data }));
    const r = G.store.tx('sell', (w) => shops.sell(w, 'ludo-eave', 'pear', 1, { data: G.data, bus: G.bus }));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(flags.getFlag(G.world, 'seen.ludo-first-sale'), true);
    at(G, 2, 12);
    assert.notEqual(resolveTalk(G, { kind: 'npc', id: 'ludo', mapId: 'pellwick' }).scriptId, 'talk-ludo-sell', 'asleep by day');
  });
});

describe('FE-08: the apron errand runs from talking to Wren', () => {
  it('Wren\'s talk is the yard-apron scene while the errand is open', () => {
    const G = makeGame('FE08-APRON');
    at(G, 1, 16);
    G.store.tx('f', (w) => flags.setFlag(w, 'sp.errands-started', true));
    // only in the yard (the scene stages her there and describes it): elsewhere she talks as usual
    G.store.tx('p', (w) => { w.player.mapId = 'pellwick'; w.player.x = 30; w.player.y = 26; });
    assert.notEqual(resolveTalk(G, { kind: 'npc', id: 'wren', mapId: 'pellwick' }).scriptId, 'yard-apron');
    G.store.tx('p', (w) => { w.player.x = 51; w.player.y = 27; });
    assert.equal(resolveTalk(G, { kind: 'npc', id: 'wren', mapId: 'pellwick' }).scriptId, 'yard-apron');
    G.store.tx('f', (w) => flags.setFlag(w, 'sys.errand.apron', true));
    assert.notEqual(resolveTalk(G, { kind: 'npc', id: 'wren', mapId: 'pellwick' }).scriptId, 'yard-apron');
  });
});

describe('FE-10: the Day Page', () => {
  it('each Shift names the form it became, a lost fight is noted, and Corin\'s slip is under Tomorrow', () => {
    const G = makeGame('FE10-PAGE');
    at(G, 2, 12);
    const uid = G.world.party[0]?.uid ?? 'c1';
    G.store.tx('n', (w) => {
      dayPage.noteEvent(w, 'shift:resolved', { uid, from: 'tossup', to: 'puddlepip' });
      dayPage.noteEvent(w, 'shift:resolved', { uid, from: 'puddlepip', to: 'sootling' });
      dayPage.noteEvent(w, 'battle:end', { outcome: 'loss', kind: 'trainer', trainerId: 'osric', porchDuel: false });
      dayPage.noteEvent(w, 'battle:end', { outcome: 'loss', kind: 'trainer', trainerId: 'porch-tully', porchDuel: true });
    });
    assert.deepEqual(G.world.dayPage.notes.filter((n) => n.startsWith('shift:')), [`shift:${uid}>puddlepip`, `shift:${uid}>sootling`]);
    assert.deepEqual(G.world.dayPage.notes.filter((n) => n.startsWith('lost:')), ['lost:osric']);
    G.store.tx('f', (w) => flags.markSeen(w, 'corin-slip'));
    const items = dayPage.tomorrowList(G.world, G.data);
    const meet = items.find((it) => it.kind === 'meet');
    assert.ok(meet, JSON.stringify(items));
    assert.match(tomorrowLine(meet, { data: G.data, world: G.world }), /Corin on the Lowmoor stones/);
    G.store.tx('f', (w) => flags.setFlag(w, 'sp.first-forecast', true));
    assert.ok(!dayPage.tomorrowList(G.world, G.data).some((it) => it.kind === 'meet'));
  });
});

describe('FE-17: the Commons odds roll on once their tide has passed', () => {
  it('names tomorrow\'s tide after today\'s has gone', () => {
    const G = makeGame('FE17-ODDS');
    at(G, 2, 6, 5);
    G.store.tx('w', (w) => { w.weather = { ...w.weather, day: 2, forecast: { kind: 'clear', odds: 10, minute: 305, tide: 'low', part: 'dawn' }, outlook: { kind: 'rain', odds: 7, minute: 355, tide: 'low', part: 'dawn' } }; });
    at(G, 2, 16, 25);
    const line = boardContent(G, 'commons').lines.find((l) => l.startsWith('Augusta'));
    assert.match(line, /tomorrow's dawn tide \(05:55\)/, line);
  });
});

describe('LF-05: {npcNick} is what they call you', () => {
  it('falls back to the player\'s name, never the NPC\'s own', () => {
    const G = makeGame('LF05-NICK');
    G.store.tx('n', (w) => { w.player.name = 'Ada'; });
    assert.equal(interpolate('{npcNick}! Perfect.', { world: G.world, data: G.data, npc: 'tully' }), 'Ada! Perfect.');
    assert.equal(interpolate('{npc}', { world: G.world, data: G.data, npc: 'tully' }), 'Tully');
  });
});

describe('LF-11: the Lamp Room is not a cottage roof', () => {
  it('skips the roof phase for loan 7 and never repaints the cottage', () => {
    assert.equal(loans.hasRoofPhase(7, { data: null }), false);
    assert.equal(loans.hasRoofPhase(3, { data: null }), true);
    const world = { loans: { builds: [{ id: 'gallery', done: true, choice: 'moss' }, { id: 'lamp-room', done: true, choice: 'tar' }] } };
    assert.notEqual(cottageRoofArt(world), cottageRoofArt({ loans: { builds: [{ id: 'x', done: true, choice: 'tar' }] } }));
    assert.equal(cottageRoofArt(world), cottageRoofArt({ loans: { builds: [{ id: 'gallery', done: true, choice: 'moss' }] } }));
  });
});

describe('LF-13: Water-pack beat 1 plays only at your own porch', () => {
  it('its cond holds at the cottage gate, not at the Dorrows\' door', () => {
    const G = makeGame('LF13-WICK');
    const beat = G.data.get('threads', 'water-pack').beats.find((b) => b.id === 1);
    G.store.tx('l', (w) => { w.loans.tier = 2; });
    at(G, 3, 18, 30);
    G.store.tx('p', (w) => { w.player.mapId = 'pellwick'; w.player.x = 12; w.player.y = 34; });
    assert.equal(evalCond(G.world, beat.cond, { data: G.data }), false);
    G.store.tx('p', (w) => { w.player.x = 9; w.player.y = 25; });
    assert.equal(evalCond(G.world, beat.cond, { data: G.data }), true);
  });
});

describe('LF-21 and the cleaned-specimen carry-over', () => {
  it('every verb has a chip word', () => {
    for (const v of ['challenge', 'bed', 'commons', 'open', 'gateBoards', 'someNewVerb']) assert.match(verbLabel(v), /^[A-Z]/, v);
    assert.equal(verbLabel('bed'), 'Sleep');
  });

  it('a cleaned fossil sells at +40% at a shop once, and the Field Log keeps "Cleaned once"', () => {
    const G = makeGame('CLEAN-SELL');
    at(G, 2, 23);
    const fossil = G.data.list('collections').find((r) => r.kind === 'relic' && (r.group === 'fossil' || r.cleanable))?.id;
    assert.ok(fossil, 'a fossil row');
    G.store.tx('g', (w) => { bag.give(w, fossil, 2, { data: G.data }); fieldLogSys.benchClean(w, fossil, { data: G.data }); });
    const plain = shops.sellQuote(G.world, shops.shopRow('ludo-eave', { data: G.data }), fossil, 1, { data: G.data }).unit;
    const r1 = G.store.tx('s', (w) => shops.sell(w, 'ludo-eave', fossil, 1, { data: G.data }));
    assert.equal(r1.ok, true, JSON.stringify(r1));
    assert.equal(r1.earned, plain + Math.round(plain * 0.4));
    assert.equal(fieldLogSys.cleanedOnce(G.world, fossil), true);
    const r2 = G.store.tx('s', (w) => shops.sell(w, 'ludo-eave', fossil, 1, { data: G.data }));
    assert.equal(r2.earned, plain);
  });
});

describe('Greenhouse grafts (carry-over)', () => {
  it('a foreign fruit grafted on the bench becomes an indoor tree after two nights (one with a Moss lead) and bears one fruit a day', () => {
    const G = makeGame('GRAFT');
    at(G, 5, 10);
    G.store.tx('b', (w) => { w.loans.builds.push({ id: 'greenhouse', tier: 3, done: true, readyDay: 0 }); flags.setFlag(w, 'sys.build.greenhouse', true); bag.give(w, 'peach', 1, { data: G.data }); });
    assert.equal(loans.roomBuilt(G.world, 'greenhouse'), true);
    assert.deepEqual(rooms.graftChoices(G.world, G.data).map((c) => c.fruit), ['peach']);
    const r = G.store.tx('g', (w) => rooms.benchGraft(w, G.data, 'peach', {}));
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.readyDay, 4 + 2);
    assert.ok(dayPage.tomorrowList({ ...G.world, clock: { ...G.world.clock, total: G.world.clock.total + DAY } }, G.data).some((it) => it.kind === 'graft'));
    at(G, 7, 6);
    const out = G.store.tx('settle', (w) => rooms.settleBenches(w, G.data, {}));
    assert.deepEqual(out.grafts, ['peach']);
    const before = G.world.bag ? JSON.stringify(G.world.bag).match(/peach/g)?.length ?? 0 : 0;
    assert.deepEqual(G.store.tx('pick', (w) => rooms.pickIndoor(w, G.data, {})), ['peach']);
    assert.deepEqual(G.store.tx('pick', (w) => rooms.pickIndoor(w, G.data, {})), [], 'one a day');
    assert.ok(before >= 0);
  });
});

// ---- verifier follow-ups ---------------------------------------------------------------------------
describe('verify: a lost fight says "home to the porch" only after a real blackout', () => {
  it('a no-blackout loss (story, mentor, Summit) is plain; a blackout loss names the porch', () => {
    const G = makeGame('VER-LOST');
    at(G, 2, 12);
    G.store.tx('n', (w) => dayPage.noteEvent(w, 'battle:end', { outcome: 'loss', kind: 'trainer', trainerId: 'osric', porchDuel: false }));
    let text = pageLines(dayPage.summarize(G.world, G.data), { data: G.data, world: G.world }).lines.map((l) => l.text).join('\n');
    assert.match(text, /Lost to [^\n]+\.$/m);
    assert.doesNotMatch(text, /Home to the porch/);
    // the blackout itself: battleFlow counts it (stat:inc blackouts), which dayFlow forwards
    G.store.tx('n', (w) => dayPage.noteEvent(w, 'stat:inc', { key: 'blackouts', value: 1, prev: 0, by: 1 }));
    text = pageLines(dayPage.summarize(G.world, G.data), { data: G.data, world: G.world }).lines.map((l) => l.text).join('\n');
    assert.match(text, /Home to the porch, a bit lighter in the pocket/);
    // only blackouts make a note; every other stat:inc (a step) is ignored, and dayFlow does not tally it
    assert.equal(G.store.tx('n', (w) => dayPage.noteEvent(w, 'stat:inc', { key: 'steps', value: 9 })), false);
    assert.ok(!dayFlow.TALLY_EVENTS.includes('stat:inc'));
  });
});

describe('verify: Ludo\'s talk opens his eave on the Sell tab', () => {
  it('every openShop in his sell talk and the first-sale scene names mode sell', () => {
    const G = makeGame('VER-LUDO');
    const shopsOf = (ops, out = []) => { for (const o of ops || []) { if (!o || typeof o !== 'object') continue; if (o.op === 'openShop') out.push(o); shopsOf(o.then, out); shopsOf(o.else, out); for (const c of o.options || []) shopsOf(c.then, out); } return out; };
    for (const id of ['talk-ludo-sell', 'ludo-first-sale']) {
      const opens = shopsOf(G.data.get('scripts', id));
      assert.ok(opens.length >= 1, id);
      for (const o of opens) assert.equal(o.mode, 'sell', id);
    }
  });
});
