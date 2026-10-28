// Regression tests for the first-hour fixes (FH-01, FH-02, FH-04, FH-05, FH-06, FH-07, FH-08, FH-10,
// FH-11, FH-15): a shorter, interactive opening with checkpoints; an honest, safe and repeatable
// capture lesson; the dock Shift on turn 2; Pip as a real first fight; starter cards; empty states.
// Run: node --test test/story.opening-firsthour.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import OPENING from '../js/data/scripts/story-opening.js';
import { normalizeOp, walkOps } from '../js/script/ops.js';
import { pagesFor, starterCardsFor, STARTER_PANEL_W, SLIP } from '../js/scenes/dialogue.js';
import { errandLine } from '../js/scenes/ledger.js';
import { emptyServiceText } from '../js/scenes/archive.js';
import { TRAINER_BY_ID } from '../js/data/trainers.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { createRegistry } from '../js/data/registry.js';
import { captureOdds } from '../js/systems/capture.js';
import * as F from '../js/systems/flow/battleFlow.js';
import { createStore } from '../js/state/store.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRngs } from '../js/state/rngs.js';
import { realBattleData } from '../js/scenes/battleData.js';
import * as party from '../js/systems/party.js';
import { TUNING } from '../js/data/tuning.js';

const reg = createRegistry(DATA_CONTENT);
const data = realBattleData();
const ops = (id) => OPENING[id].map((o) => normalizeOp(o));
const flat = (id) => { const out = []; walkOps(OPENING[id], (op) => out.push(op)); return out; };
const sayText = (id) => flat(id).filter((o) => o.op === 'say').map((o) => o.text).join('\n');

/**
 * Text boxes (dialogue pages, as the slip paginates them) on the default path from the arrival to
 * the first battle input: say lines, choice prompts, each choice and the nickname entry count.
 */
function boxesToFirstBattle() {
  let boxes = 0;
  const run = (id) => {
    const walk = (list) => {
      for (const raw of list) {
        const o = normalizeOp(raw);
        if (o.op === 'say') boxes += pagesFor(o.text, !o.who).length;
        else if (o.op === 'choice') {
          if (o.prompt) boxes += pagesFor(o.prompt, false).length;
          boxes += 1;
          const opt = o.options[o.defaultIndex ?? 0];
          if (opt.goto) continue;
          if (opt.then && walk(opt.then) === 'stop') return 'stop';
        } else if (o.op === 'branch') { if (walk(o.cases.default ?? Object.values(o.cases)[0]) === 'stop') return 'stop'; }
        else if (o.op === 'call') { if (run(o.script) === 'stop') return 'stop'; }
        else if (o.op === 'nickname') boxes += 1;
        else if (o.op === 'startBattle') return 'stop';
        else if (o.op === 'end') return undefined;
      }
      return undefined;
    };
    return walk(OPENING[id]);
  };
  run('arrival-causeway');
  run('wick-keeper');
  return boxes;
}

function makeG(seedCode = 'FLUX-XW5F-EFFA') {
  const store = createStore(createNewWorld({ seedCode }));
  store.tx('dial', (w) => { w.run.dial = 'flux'; });
  return { store, get world() { return store.world; }, bus: store.bus, rngs: createRngs(store), push: () => {} };
}
function starter(G, speciesId, level, k = 0) {
  G.store.tx('give', (w) => party.giveCreature(w, { speciesId, level, nickname: 'PUDDLE' }, data, G.rngs.fresh(`t${k}`), { tuning: TUNING }));
}
/** Strongest move by power × shown effectiveness (what a reader picks after a Read). */
function bestMove(b) {
  const lg = b.legal(0);
  let best = 0, score = -Infinity;
  lg.moves.forEach((m, j) => { if (!m.selectable) return; const v = (m.power || 1) * (m.mult ?? 1); if (v > score) { score = v; best = j; } });
  return best;
}

// --- FH-04 / FH-05: a shorter opening, nothing asked twice -----------------------------------------

test('the opening reaches the first battle input in at most 45 text boxes (was about 80)', () => {
  const n = boxesToFirstBattle();
  assert.ok(n <= 45, `${n} boxes before the dock battle`);
});

test('Wren no longer asks the lease card questions again, and the lighthouse is described once', () => {
  const lease = flat('wren-lease-card');
  assert.ok(!lease.some((o) => o.op === 'choice' && /favourite hour|sun, rain or fog/i.test(o.prompt ?? '')), 'no repeated Favourite hour? / Tomorrow?');
  assert.ok(!lease.some((o) => o.op === 'setFlag' && ['np.wren.windowsill', 'sys.weather.tomorrow'].includes(o.id)), 'the card owns the plant and the weather');
  assert.ok(lease.some((o) => o.op === 'branch' && o.on === 'sys.lease.plant'), 'Wren reads the signed card back');
  const lighthouse = `${sayText('arrival-causeway')}\n${sayText('wren-lease-card')}`.split('\n').filter((l) => /lighthouse (stands|is a black)/.test(l));
  assert.equal(lighthouse.length, 1);
  assert.ok(!/ten in ten/.test(sayText('wren-lease-card')));
});

test('autosave checkpoints follow the naming and the hold-out', () => {
  const sc = ops('starter-choice');
  const named = sc.findIndex((o) => o.op === 'branch' && Object.values(o.cases).every((b) => b.some((x) => x.op === 'nickname')));
  const save = sc.findIndex((o) => o.op === 'save');
  assert.ok(named >= 0 && save > named, 'a save op right after the starter is named');
  assert.ok(sc.findIndex((o) => o.op === 'setFlag' && o.id === 'sp.starter-chosen') < save, 'the checkpoint already holds sp.starter-chosen');
  const after = ops('linnet-dock-after');
  const dock = after.findIndex((o) => o.op === 'setFlag' && o.id === 'sp.dock-battle');
  assert.ok(after.findIndex((o) => o.op === 'save') > dock, 'a save op after the hold-out');
});

test('Corin hands the Read to the player: a choice to Read the starter, not narration', () => {
  const c = flat('corin-reading-glass');
  const pick = c.find((o) => o.op === 'choice' && o.options.some((x) => /^Read \{nick:c1\}/.test(x.text)));
  assert.ok(pick, 'Read {nick:c1} is an input');
  assert.ok(!/Through the loupe, \{nick:c1\} sharpens/.test(sayText('corin-reading-glass')), 'the old narrated Read is gone');
  const read = c.find((o) => o.op === 'branch' && o.on === 'np.wren.starter');
  assert.ok(read && ['scrapling', 'reedkit', 'default'].every((k) => read.cases[k]), 'the Read card names each starter\'s type');
});

// --- FH-01 / FH-02: the capture lesson is honest, safe and repeatable ------------------------------

test("Corin quotes the Lantern's real odds: a third while fresh, nearly sure at a sliver", () => {
  const text = sayText('corin-capture-stance') + flat('corin-capture-stance').filter((o) => o.op === 'choice').map((o) => o.prompt).join('\n');
  assert.ok(!/sixty-two|62\s*%/i.test(text), 'no 62%');
  assert.match(text, /a third/);
  assert.match(text, /sliver/);
  const tossup = { speciesId: 'tossup', hp: 18, stats: { hp: 18 } };
  for (const dial of ['drift', 'flux', 'freefall']) {
    const fresh = captureOdds(tossup, { grade: 1, data: reg }, { dial });
    assert.ok(Math.abs(fresh.p - 1 / 3) < 0.04, `${dial}: ${fresh.pct}% at full HP is about a third`);
    const sliver = captureOdds({ ...tossup, hp: 1 }, { grade: 1, data: reg, stance: true }, { dial });
    assert.ok(sliver.p >= 0.9, `${dial}: ${sliver.pct}% at 1 HP is nearly sure`);
    assert.ok(fresh.next.p > fresh.p, 'every miss raises the next try');
  }
});

test('the reeds Tossup cannot hurt the party, and the lesson loops until one is held', () => {
  const all = flat('corin-capture-stance');
  const battle = all.find((o) => o.op === 'startBattle');
  assert.deepEqual(battle.wild.moves, ['settle']);
  for (const id of battle.wild.moves) assert.equal(reg.get('moves', id).power, 0, `${id} does no damage`);
  assert.equal(reg.get('species', 'tossup').heartmark ?? null, null, 'no Heartmark move is pinned in beside it');
  // a starter on 1 HP survives twenty turns of it
  const G = makeG();
  starter(G, 'reedkit', 5);
  G.store.tx('hurt', (w) => { w.party[0].hp = 1; });
  const s = F.buildBattle(G, { kind: 'wild', wild: battle.wild, source: 'story' }, data);
  s.battle.setCaptureStance(true);
  for (let i = 0; i < 20 && s.battle.phase !== 'ended'; i++) s.battle.step(F.prepareAction(s, { type: 'move', move: 0 }));
  assert.ok(s.battle.active(0).hp >= 1, 'still standing');
  assert.equal(s.battle.active(1).hp, 1, 'under the Stance the hits stop at a sliver: the Tossup waits at 1 HP for the Lantern');
  assert.match(sayText('corin-capture-stance'), /hits stop at a sliver/, 'Corin describes the Stance the engine runs');
  const labels = all.filter((o) => o.op === 'label').map((o) => o.id);
  assert.ok(labels.includes('reeds'));
  const held = all.find((o) => o.op === 'if' && o.cond?.fieldLog?.form === 'tossup');
  assert.ok(held.then.some((x) => normalizeOp(x).op === 'setFlag' && normalizeOp(x).id === 'sp.capture-stance'), 'held: the lesson is done');
  const again = held.else.map((x) => normalizeOp(x)).find((x) => x.op === 'choice');
  assert.ok(again.options[0].then.some((x) => normalizeOp(x).op === 'goto' && normalizeOp(x).id === 'reeds'), 'Again loops back to the reeds');
  assert.ok(all.some((o) => o.op === 'give' && o.item === 'tallow-wick'), 'Corin tops up wicks when you run out');
});

test('the orchard narration no longer drops fruit it never gives', () => {
  const text = sayText('first-orchard');
  assert.ok(!/Three fruit thump/.test(text));
  assert.match(text, /press/);
});

// --- FH-07: the dock shows the Shift ----------------------------------------------------------------

test("Linnet's hold-out shows the posted strip and the Shift in its intro, for every starter", () => {
  const bs = TRAINER_BY_ID['linnet-dock'].party[0].bossShift;
  assert.deepEqual([bs.postAt, bs.shiftAt], [0, 0], 'posted and landed as Cinder enters: no starter can KO the Sootling first');
  assert.match(sayText('linnet-dock-before'), /the moment she sends it out/, 'Corin says when it lands');
  for (const sp of ['sloshkin', 'scrapling', 'reedkit']) {
    const G = makeG();
    starter(G, sp, 5);
    const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'linnet-dock', source: 'story', holdOut: 3 }, data);
    const types = s.battle.intro.map((e) => e.type);
    assert.ok(types.indexOf('shift-posted') >= 0 && types.indexOf('shift-posted') < types.indexOf('boss-shift'), `${sp}: strip first, then the Shift`);
    assert.equal(s.battle.active(1).speciesId, 'caldermaw', `${sp}: the hold is against the Caldermaw`);
  }
});

// --- FH-10: no line spoken twice -----------------------------------------------------------------

test("the battle intros of Linnet and Pip do not repeat what their story scripts just said", () => {
  const norm = (x) => x.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  for (const [id, script] of [['linnet-dock', 'linnet-dock-before'], ['pip', 'pip-before']]) {
    const said = norm(sayText(script));
    const lines = TRAINER_BY_ID[id].lines;
    for (const k of ['intro', 'win', 'lose']) {
      const words = norm(lines[k]).split(' ');
      // no run of five words from the trainer line appears in the script
      for (let i = 0; i + 5 <= words.length; i++) assert.ok(!said.includes(words.slice(i, i + 5).join(' ')), `${id} lines.${k} repeats the script: ${lines[k]}`);
    }
    assert.ok(!/\b(You are|do not|Let us|It is)\b/.test(lines.intro), `${id} intro is in the character's own voice`);
  }
  assert.equal(TRAINER_BY_ID.pip.scripts.afterWin, undefined, 'the win line shows once, in battle');
});

// --- FH-15: Pip is a real first fight --------------------------------------------------------------

test('Pip takes three to four turns with good play, and good play wins, for every starter at Lv6', () => {
  const pip = TRAINER_BY_ID.pip;
  assert.equal(pip.party.length, 2);
  assert.equal(pip.payout, 200, 'still two hundred buttons');
  for (const sp of ['sloshkin', 'scrapling', 'reedkit']) {
    let turns = 0, wins = 0;
    const seeds = ['FLUX-XW5F-EFFA', 'FLUX-K7Q2-MD7F', 'FLUX-4KNZ-CH4G', 'FLUX-AAAA-BBBB'];
    for (const [k, seed] of seeds.entries()) {
      const G = makeG(seed);
      starter(G, sp, 6, k);
      const s = F.buildBattle(G, { kind: 'trainer', trainerId: 'pip' }, data);
      let n = 0;
      for (let i = 0; i < 40 && s.battle.phase !== 'ended'; i++) {
        if (s.battle.phase === 'replace') { s.battle.step(null); continue; }
        s.battle.step(F.prepareAction(s, { type: 'move', move: bestMove(s.battle) }));
        n++;
      }
      turns += n;
      if (s.battle.result().outcome === 'win') wins++;
    }
    const avg = turns / seeds.length;
    assert.ok(avg >= 2.75 && avg <= 4.5, `${sp}: ${avg} turns on average (about three to four; it was 1-2)`);
    assert.equal(wins, seeds.length, `${sp}: reading and hitting hard wins`);
  }
});

// --- FH-06: the starter choice shows the creatures -------------------------------------------------

test('starter cards: sprite, type chip and temperament for the three on the stones; nothing for other choices', () => {
  const cards = starterCardsFor(['The Sloshkin.', 'The Scrapling.', 'The Reedkit.'], reg);
  assert.deepEqual(cards.map((c) => [c.speciesId, c.types[0]]), [['sloshkin', 'Brine'], ['scrapling', 'Grit'], ['reedkit', 'Moss']]);
  for (const c of cards) assert.ok(c.temper.length > 10, c.speciesId);
  assert.equal(starterCardsFor(['Stay.', 'Kneel by another.'], reg), null);
  assert.equal(starterCardsFor(['The Tossup.'], reg), null, 'only creatures with a starter line');
  const kneel = flat('starter-choice').find((o) => o.op === 'choice' && /Kneel beside/.test(o.prompt ?? ''));
  assert.ok(starterCardsFor(kneel.options.map((o) => o.text), reg), 'the authored options grow cards');
  assert.ok(SLIP.x + 4 + STARTER_PANEL_W <= 330, 'the card panel docks left, clear of the stones at the right edge');
});

// --- FH-11: empty states point forward -------------------------------------------------------------

test('the Ledger shows errand credit and errands left during loan 1', () => {
  const w = createNewWorld({ seedCode: 'FLUX-XW5F-EFFA' });
  assert.equal(errandLine(w, reg), null, 'nothing before the clipboard');
  w.flags['sp.errands-started'] = true;
  w.loans.errands = ['apron', 'notice', 'orchard'];
  assert.equal(errandLine(w, reg), 'Errand credit: 1,500 of 3,000. Errands left: 3.');
  w.loans.errands = ['apron', 'notice', 'orchard', 'mail-sack', 'shell', 'fish'];
  assert.equal(errandLine(w, reg), null, 'all six done');
  w.loans.errands = [];
  w.loans.tier = 2;
  assert.equal(errandLine(w, reg), null, 'loan 1 is behind you');
});

test('the Archive Memory and Recall empty states say when moves and forms arrive', () => {
  assert.notEqual(emptyServiceText('memory'), 'No eligible Memory moves yet.');
  assert.match(emptyServiceText('memory'), /levels/);
  assert.match(emptyServiceText('recall'), /Shift/);
});
