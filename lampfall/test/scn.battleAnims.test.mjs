// Unit tests for the pure parts of js/scenes/battleAnims.js (the battle animation queue, the motion
// tables and the flip / Lantern timelines). Run: node --test test/scn.battleAnims.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/scenes/battleAnims.js';
import { EVENT_FIELDS, EVENT_TYPES } from '../js/battle/events.js';
import { WORDS } from '../js/battle/effects.js';

/** A recording fake of the scene's BattleView. */
function fakeView(overrides = {}) {
  const calls = [];
  const hit = { mult: null, crit: false, effEv: null, critEv: null };
  const numberFns = new Set(['say', 'hpTo', 'lantern', 'expTo']);
  const view = new Proxy({ hit, reducedMotion: false, ...overrides }, {
    get(target, key) {
      if (key in target) return target[key];
      if (typeof key !== 'string') return undefined;
      return (...args) => {
        calls.push([key, ...args]);
        if (numberFns.has(key)) return key === 'say' ? (args[0] ? 100 : 0) : 50;
        if (key === 'learnPrompt') return () => true;
        return undefined;
      };
    },
  });
  return { view, calls };
}

/** A minimal valid event of each type, from the contract's field kinds. */
function sampleEvent(type) {
  const ev = { type };
  for (const [field, spec] of Object.entries(EVENT_FIELDS[type])) {
    const kind = spec.replace('?', '');
    ev[field] = kind === 'number' ? 1 : kind === 'string' ? 'X' : kind === 'boolean' ? false : kind === 'side' ? 0 : kind === 'array' ? [] : kind === 'object' ? {} : 'X';
  }
  if (type === 'read') ev.info = { ability: { name: 'Glasshide', text: 'Only Strong hits land.' } };
  if (type === 'damage') ev.source = 'party';
  if (type === 'end') ev.outcome = 'loss';
  if (type === 'stat') { ev.result = 'raised'; ev.stat = 'atk'; }
  if (type === 'status') { ev.action = 'inflict'; ev.kind = 'burn'; }
  if (type === 'exp') ev.share = 'battler';
  if (type === 'blocked') ev.reason = 'ward';
  return ev;
}

/** Runs an anim to completion through a queue in instant mode, answering gates. */
function runAll(anims) {
  const q = A.createAnimQueue({ instant: true });
  for (const a of anims) q.push(a);
  for (let i = 0; i < 1000 && !q.idle(); i++) {
    q.update(16);
    if (q.gated()) q.confirm();
  }
  return q;
}

describe('motion tables', () => {
  it('hit-stop is 0 / 2 / 4 / 6 / 8 frames by effectiveness (GDD-00 §14)', () => {
    assert.equal(A.hitStopFrames(0), 0);
    assert.equal(A.hitStopFrames(0, true), 0, 'a blocked hit never stops, crit or not');
    assert.equal(A.hitStopFrames(0.25), 2);
    assert.equal(A.hitStopFrames(0.5), 4);
    assert.equal(A.hitStopFrames(1), 4);
    assert.equal(A.hitStopFrames(2), 6);
    assert.equal(A.hitStopFrames(4), 8);
    assert.equal(A.hitStopFrames(1, true), 8, 'a crit is the full 8 frames');
  });

  it('effectiveness tiers and words match battle/effects WORDS, always with a glyph', () => {
    assert.equal(A.effTier(0), 'blocked');
    assert.equal(A.effTier(0.5), 'weak');
    assert.equal(A.effTier(1), 'neutral');
    assert.equal(A.effTier(2), 'strong');
    assert.equal(A.effWord('strong'), WORDS.STRONG);
    assert.equal(A.effWord('neutral'), WORDS.NEUTRAL);
    assert.equal(A.effWord('weak'), WORDS.WEAK);
    assert.equal(A.effWord('blocked'), WORDS.BLOCKED);
    assert.equal(A.effWord('blocked', { ward: true }), 'Blocked by Ward');
    for (const tier of ['strong', 'neutral', 'weak', 'blocked']) assert.ok(A.EFF_GLYPH[tier], `${tier} has a glyph`);
    assert.equal(new Set(Object.values(A.EFF_GLYPH)).size, 4, 'four distinct shapes');
  });

  it('frames() converts at 60 fps', () => {
    assert.ok(Math.abs(A.frames(60) - 1000) < 1e-9);
    assert.ok(Math.abs(A.frames(6) - 100) < 1e-9);
  });

  it('typewriter reveals by characters per second and holds by length', () => {
    assert.equal(A.typedChars(0, 45, 20), 0);
    assert.equal(A.typedChars(1000, 45, 100), 45);
    assert.equal(A.typedChars(10_000, 45, 20), 20);
    assert.equal(A.typedChars(5, Infinity, 20), 20);
    assert.equal(A.typedChars(100, 45, 0), 0);
    assert.equal(A.lineMs('', 45), 0);
    assert.ok(A.lineMs('A wild Tossup came out of the grass.', 45) > A.lineMs('Hi.', 45));
    assert.ok(A.lineMs('Hi.', Infinity) > 0, 'instant text still holds long enough to read');
  });
});

describe('lineFor (battle log through the glossary)', () => {
  it('speaks every event type without throwing and never returns a placeholder key', () => {
    for (const type of EVENT_TYPES) {
      const line = A.lineFor(sampleEvent(type));
      assert.ok(line === null || typeof line === 'string', type);
      if (line) assert.ok(!/^\[.*\]$/.test(line), `${type} renders a real line, got ${line}`);
    }
  });

  it('uses the battle.msg templates with the event fields', () => {
    assert.equal(A.lineFor({ type: 'move', user: 'PUDDLE', moveName: 'Undertow' }), 'PUDDLE used Undertow.');
    assert.equal(A.lineFor({ type: 'faint', target: 'Tossup' }), 'Tossup fainted.');
    assert.equal(A.lineFor({ type: 'payout', amount: 1200 }), 'You won 1,200◉.');
    assert.equal(A.lineFor({ type: 'levelup', creature: 'PUDDLE', to: 8 }), 'PUDDLE grew to Lv8.');
    assert.equal(A.lineFor({ type: 'exp', creature: 'Peg', amount: 24, share: 'bench' }), 'Peg gained 24 EXP (bench).');
    assert.equal(A.lineFor({ type: 'damage' }), null, 'damage never speaks; the bar does');
  });
});

describe('createAnimQueue', () => {
  it('waits the yielded milliseconds, divided by the battle speed', () => {
    for (const speed of A.SPEEDS) {
      const q = A.createAnimQueue({ speed });
      let done = false;
      q.push({ name: 't', skippable: true, run: function* () { yield 400; done = true; } });
      q.update(400 / speed - 1);
      assert.equal(done, false, `speed ${speed}: not yet`);
      q.update(2);
      assert.equal(done, true, `speed ${speed}: done after 400/${speed} ms`);
      assert.ok(q.idle());
    }
  });

  it('defaults to 2× (GDD-09 §6) and runs anims in order', () => {
    const q = A.createAnimQueue();
    assert.equal(q.speed, 2);
    const order = [];
    q.push({ name: 'a', skippable: true, run: function* () { order.push('a1'); yield 100; order.push('a2'); } });
    q.push({ name: 'b', skippable: true, run: function* () { order.push('b'); } });
    q.update(1000);
    assert.deepEqual(order, ['a1', 'a2', 'b']);
  });

  it('a gate holds until confirm; skip never passes a gate', () => {
    const q = A.createAnimQueue({ instant: true });
    let after = false;
    q.push({ name: 'g', skippable: false, run: function* () { yield A.GATE; after = true; } });
    q.update(16);
    assert.ok(q.gated());
    q.skip();
    q.update(10_000);
    assert.equal(after, false);
    assert.equal(q.confirm(), true);
    q.update(16);
    assert.equal(after, true);
    assert.equal(q.confirm(), false, 'nothing left to confirm');
  });

  it('{until} waits for its condition', () => {
    const q = A.createAnimQueue();
    let open = true;
    let after = false;
    q.push({ name: 'u', skippable: false, run: function* () { yield { until: () => !open }; after = true; } });
    q.update(5000);
    assert.equal(after, false);
    open = false;
    q.update(16);
    assert.equal(after, true);
  });

  it('skip fast-forwards the current anim and asks the view to settle', () => {
    let settled = 0;
    const q = A.createAnimQueue({ speed: 1, onSettle: () => { settled++; } });
    const seen = [];
    q.push({ name: 's', skippable: true, run: function* () { seen.push(1); yield 5000; seen.push(2); yield 5000; seen.push(3); } });
    q.push({ name: 'next', skippable: true, run: function* () { seen.push('next'); yield 5000; } });
    q.update(16);
    q.skip();
    q.update(16);
    assert.deepEqual(seen, [1, 2, 3, 'next']);
    assert.equal(settled, 1);
    assert.equal(q.current(), 'next', 'the next anim is not skipped by the same press');
  });

  it('instant mode collapses every timed wait', () => {
    const q = A.createAnimQueue({ instant: true });
    let n = 0;
    for (let i = 0; i < 20; i++) q.push({ name: 'i', skippable: true, run: function* () { yield 10_000; n++; } });
    q.update(16);
    assert.equal(n, 20);
    assert.ok(q.idle());
  });

  it('an anim that throws is reported and the queue moves on', () => {
    const errs = [];
    const q = A.createAnimQueue({ instant: true, onError: (e, a) => errs.push(a.name) });
    let ran = false;
    q.push({ name: 'boom', skippable: true, run: function* () { yield 1; throw new Error('x'); } });
    q.push({ name: 'ok', skippable: true, run: function* () { ran = true; } });
    q.update(16);
    assert.deepEqual(errs, ['boom']);
    assert.equal(ran, true);
  });

  it('ignores junk pushes', () => {
    const q = A.createAnimQueue();
    q.push(null);
    q.push({ name: 'x' });
    assert.ok(q.idle());
    assert.equal(q.size(), 0);
  });
});

describe('BATTLE_ANIMS', () => {
  it('has an animation for every engine event type', () => {
    for (const type of EVENT_TYPES) assert.equal(typeof A.BATTLE_ANIMS[type], 'function', type);
  });

  it('every animation runs to completion against the view contract', () => {
    for (const type of EVENT_TYPES) {
      const { view } = fakeView();
      const q = runAll([A.animFor(sampleEvent(type), view)]);
      assert.ok(q.idle(), `${type} finished`);
    }
  });

  it('unknown event types fall back to speaking their text', () => {
    const { view, calls } = fakeView();
    runAll([A.animFor({ type: 'brand-new', text: 'Something new happened.' }, view)]);
    assert.ok(calls.some(([k, t]) => k === 'say' && t === 'Something new happened.'));
  });

  it('a hit: effectiveness and crit sound at the impact, in order, with hit-stop, nudge and shake on the crit', () => {
    const { view, calls } = fakeView();
    const evs = [
      { type: 'effectiveness', side: 0, target: 'Tossup', word: 'Strong', mult: 2 },
      { type: 'crit', side: 0, target: 'Tossup', text: 'A critical hit!' },
      { type: 'damage', side: 1, target: 'Tossup', amount: 9, hp: 3, maxHp: 18, source: 'party', stanceFloor: false },
    ];
    runAll(evs.map((ev) => A.animFor(ev, view)));
    const sfx = calls.filter(([k]) => k === 'sfx').map(([, ev]) => ev.type);
    assert.deepEqual(sfx, ['effectiveness', 'crit', 'damage']);
    assert.ok(calls.some(([k, n]) => k === 'hitStop' && n === 8), 'crit = 8 frames');
    assert.ok(calls.some(([k, side, px]) => k === 'nudge' && side === 1 && px === 2), '2 px nudge on the target');
    assert.ok(calls.some(([k]) => k === 'shake'), 'shake only on the crit');
    assert.ok(calls.some(([k, side, hp]) => k === 'hpTo' && side === 1 && hp === 3));
    assert.ok(calls.some(([k, side]) => k === 'emitHp' && side === 1), 'battle:hp after the HP change');
  });

  it('a neutral hit stops 4 frames and never shakes', () => {
    const { view, calls } = fakeView();
    runAll([
      A.animFor({ type: 'effectiveness', side: 0, target: 'T', word: 'Neutral', mult: 1 }, view),
      A.animFor({ type: 'damage', side: 1, target: 'T', amount: 3, hp: 10, maxHp: 18, source: 'party', stanceFloor: false }, view),
    ]);
    assert.ok(calls.some(([k, n]) => k === 'hitStop' && n === 4));
    assert.ok(!calls.some(([k]) => k === 'shake'));
  });

  it('status chip damage flickers without hit-stop', () => {
    const { view, calls } = fakeView();
    runAll([A.animFor({ type: 'damage', side: 0, target: 'P', amount: 1, hp: 9, maxHp: 10, source: 'status', stanceFloor: false }, view)]);
    assert.ok(!calls.some(([k]) => k === 'hitStop'));
    assert.ok(calls.some(([k]) => k === 'flash'));
  });

  it('a switch recalls, sends out and emits battle:hp for the new creature', () => {
    const { view, calls } = fakeView();
    runAll([A.animFor({ type: 'switch', side: 0, from: 'PUDDLE', to: 'Peg', text: '' }, view)]);
    const keys = calls.map(([k]) => k);
    assert.ok(keys.indexOf('recall') < keys.indexOf('sendOut'));
    assert.ok(keys.includes('emitHp'));
    assert.ok(keys.includes('glint'), 'the Heartmark glints on send-out');
  });

  it('the Ward readout and a player Read wait for confirm; an ability Read does not', () => {
    const readout = A.animFor({ ...sampleEvent('ward-readout'), side: 0 }, fakeView().view);
    const q = A.createAnimQueue({ instant: true });
    q.push(readout);
    q.update(16);
    assert.ok(q.gated(), 'readout gates');
    const auto = A.animFor({ ...sampleEvent('read'), source: 'Shoresense' }, fakeView().view);
    const q2 = A.createAnimQueue({ instant: true });
    q2.push(auto);
    q2.update(16);
    assert.ok(!q2.gated() && q2.idle(), 'an ability Read folds away by itself');
    const mine = A.animFor({ ...sampleEvent('read'), source: 'Read' }, fakeView().view);
    const q3 = A.createAnimQueue({ instant: true });
    q3.push(mine);
    q3.update(16);
    assert.ok(q3.gated(), 'the Read the player asked for waits');
  });

  it('capture plays lift, unfold, meter, then fold; failure gutters and says the next odds', () => {
    const { view, calls } = fakeView();
    runAll([
      A.animFor({ type: 'capture-shake', side: 0, target: 'Tossup', grade: 1, odds: 0.33, band: 'Fair', segments: 3, success: true, text: '' }, view),
      A.animFor({ type: 'capture', side: 0, speciesId: 'tossup', name: 'Tossup', text: '' }, view),
    ]);
    const phases = calls.filter(([k]) => k === 'lantern').map(([, p]) => p);
    assert.deepEqual(phases, ['lift', 'unfold', 'meter', 'fold']);
    assert.ok(calls.some(([k, ev]) => k === 'release' && ev.type === 'capture'), 'capture:ok is released with the chord');
    const f = fakeView();
    runAll([A.animFor({ type: 'capture-fail', side: 0, target: 'Tossup', fails: 1, nextOdds: 0.36, nextBand: 'Fair', text: '' }, f.view)]);
    assert.ok(f.calls.some(([k, p]) => k === 'lantern' && p === 'gutter'));
    assert.ok(f.calls.some(([k, t]) => k === 'say' && t === 'Next raise: 36%'), '+3% per failed try is shown');
  });

  it('a learn offer waits on the prompt', () => {
    let open = true;
    const { view } = fakeView({ learnPrompt: () => () => !open });
    const q = A.createAnimQueue({ instant: true });
    q.push(A.animFor({ type: 'learn-offer', creature: 'PUDDLE', uid: 'c1', move: 'settle', text: '' }, view));
    q.update(16);
    assert.ok(!q.idle());
    open = false;
    q.update(16);
    assert.ok(q.idle());
  });

  it('the engine end event reaches the view (battle:end, victory sting) before the EXP lines', () => {
    const { view, calls } = fakeView();
    runAll([A.animFor({ type: 'end', outcome: 'win', winner: 0, text: '' }, view), A.animFor({ type: 'exp', creature: 'P', uid: 'c1', amount: 40, share: 'battler', text: '' }, view)]);
    const keys = calls.map(([k]) => k);
    assert.ok(keys.indexOf('ended') < keys.indexOf('expTo'));
  });
});

describe('Lantern and meter timelines', () => {
  it('unfold goes square, strip, outline over 12 frames', () => {
    assert.equal(A.LANTERN_FRAMES.lift, 6);
    assert.equal(A.LANTERN_FRAMES.unfold, 12);
    assert.deepEqual([0, 3, 4, 7, 8, 11].map(A.unfoldShape), ['square', 'square', 'strip', 'strip', 'outline', 'outline']);
  });

  it('the meter is one 48 f sweep across three segments, cut where a miss stops', () => {
    assert.equal(A.LANTERN_FRAMES.sweep, 48);
    assert.equal(A.meterFill(0, 3), 0);
    assert.equal(A.meterFill(16, 3), 1);
    assert.equal(A.meterFill(48, 3), 3);
    assert.equal(A.meterFill(48, 1), 1, 'a miss stops at its segment');
    assert.equal(A.meterFrames(3), 48);
    assert.ok(A.meterFrames(1) < A.meterFrames(2));
  });
});

describe('Shift flip timeline', () => {
  it('down 12, slide 60, turn 18, scramble 90 (GDD-00 §14)', () => {
    assert.equal(A.flipTotal(), 180);
    assert.equal(A.flipPhase(0).phase, 'down');
    assert.equal(A.flipPhase(11).phase, 'down');
    assert.equal(A.flipPhase(12).phase, 'slide');
    assert.equal(A.flipPhase(71).phase, 'slide');
    assert.equal(A.flipPhase(72).phase, 'turn');
    assert.equal(A.flipPhase(90).phase, 'scramble');
    assert.equal(A.flipPhase(179).phase, 'scramble');
    assert.equal(A.flipPhase(180).phase, 'done');
  });

  it('reduced motion swaps it for a 30 f dither fade', () => {
    assert.equal(A.flipTotal(true), 30);
    assert.equal(A.flipPhase(10, true).phase, 'dither');
    assert.equal(A.flipPhase(30, true).phase, 'done');
  });

  it('the scramble resolves in rings outward from the mark', () => {
    const mark = { x: 10, y: 6 };
    const rings = scrambleGrid(mark);
    const mx = Math.floor(mark.x / 4);
    const my = Math.floor(mark.y / 4);
    assert.equal(rings[my][mx], 0, 'the mark is ring 0');
    let maxRing = 0;
    for (const row of rings) for (const r of row) maxRing = Math.max(maxRing, r);
    assert.equal(maxRing, 3, 'four rings');
    // rings never shrink with distance from the mark
    for (let by = 0; by < rings.length; by++) {
      for (let bx = 0; bx < rings[by].length; bx++) {
        const d = Math.max(Math.abs(bx - mx), Math.abs(by - my));
        for (let by2 = 0; by2 < rings.length; by2++) {
          for (let bx2 = 0; bx2 < rings[by2].length; bx2++) {
            const d2 = Math.max(Math.abs(bx2 - mx), Math.abs(by2 - my));
            if (d2 > d) assert.ok(rings[by2][bx2] >= rings[by][bx]);
          }
        }
      }
    }
    // inner rings settle first; everything shows the new form at the end
    const settleT = (ring) => { for (let s = 0; s <= 6; s++) { const t = s / 6; if ([0, 1, 2, 3, 4, 5, 6, 7].every((k) => A.scrambleShowsNew(ring, t, { bx: k, by: 0 }))) return t; } return 2; };
    assert.ok(settleT(0) < settleT(3));
    for (let ring = 0; ring < 4; ring++) assert.ok(A.scrambleShowsNew(ring, 1, { bx: 0, by: 0 }));
  });
});

/** @param {{x: number, y: number}} mark */
function scrambleGrid(mark) {
  return A.scrambleRings(32, 32, mark, { block: 4, rings: 4 });
}
