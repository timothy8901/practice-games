// Game-feel lane (wave 2): FH-03 name entry, FH-09 the HUD's Next chip + hanging signs, top10 #8
// creature cries + indoor music, top10 #9 battle log lines / sprite fit / backdrops, and the wave-1
// follow-ups (battle:end porchDuel, seal-slip reward lines, the Forecast's lit.steadied read).
// Run: node --test test/scn.feel.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../js/scenes/battleAnims.js';
import { createNameEntry, OPEN_GUARD_MS } from '../js/scenes/nameEntry.js';
import { litSteadied } from '../js/scenes/forecast.js';
import { battleEndPayload, sealRewardLines } from '../js/scenes/battle.js';
import { backdropFor, drawBackdrop, rustleColour, THEMES, partOfHour, grade, mix } from '../js/art/backdrops.js';
import { cryParams, STAGE_BASE, TYPE_SLIDE, TYPE_WAVE, VAGARY_MOTIF } from '../js/audio/cries.js';
import { cryPlan, createAudio, CRY_WAVES } from '../js/core/audio.js';
import { DEFAULTS as DIR_DEFAULTS, decide, initialState, createMusicDirector } from '../js/audio/director.js';
import { rankBeats, isOptionalBeat, objectiveFor, createObjectiveChip, drawObjectiveChip, CHIP_SHOW_MS, CHIP_FADE_MS } from '../js/ui/objectiveChip.js';
import { currentObjective, readyBeats } from '../js/scenes/menuModel.js';
import { PROP_ART } from '../js/art/props.js';
import { creatureArt } from '../js/art/creatures/index.js';
import { createNewWorld } from '../js/state/schema.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { createBus } from '../js/core/events.js';
import { createFakeAudio, createFakeTimers, createFakeClock, makeWorld, makeData } from './fixtures/audio.fixture.mjs';
import { fakeCtx, installFakeCanvas } from './ui.fakes.mjs';
import * as pixelart from '../js/core/pixelart.js';

installFakeCanvas(pixelart);

const data = createRegistry(DATA_CONTENT);

// ---------------------------------------------------------------------------------------------
// FH-03: name entry
// ---------------------------------------------------------------------------------------------

/** A tiny key target + a controllable clock for the open guard. */
function rig(opts = {}) {
  const target = { fns: [], addEventListener(_e, f) { this.fns.push(f); }, removeEventListener(_e, f) { this.fns = this.fns.filter((x) => x !== f); } };
  const key = (k) => target.fns.forEach((f) => f({ key: k, preventDefault() {} }));
  const clock = { now: 0 };
  const pressed = new Set();
  const input = { lastDevice: opts.device ?? 'keyboard', pressed: (a) => pressed.has(a), repeat: (d) => pressed.has(d), pointer: null };
  const out = { done: null, cancelled: 0 };
  const e = createNameEntry({
    input, keyTarget: target, suggest: 'PUDDLE', now: () => clock.now, ...opts.entry,
    onDone: (n) => { out.done = n; }, onCancel: () => { out.cancelled++; },
  });
  e.attach();
  clock.now = OPEN_GUARD_MS + 1; // past the guard unless a test rewinds it
  return { e, key, clock, input, pressed, out };
}

describe('FH-03 name entry', () => {
  it('opens with the suggestion filled in and selected; Enter keeps it', () => {
    const { e, key, out } = rig();
    assert.equal(e.name, 'PUDDLE');
    assert.equal(e.selected, true);
    key('Enter'); e.handle();
    assert.equal(out.done, 'PUDDLE');
  });

  it('typing replaces the selected suggestion; Backspace on it clears the whole field', () => {
    const a = rig();
    for (const k of ['M', 'u', 'd']) a.key(k);
    a.e.handle();
    assert.equal(a.e.name, 'Mud');
    assert.equal(a.e.selected, false);
    const b = rig();
    b.key('Backspace'); b.e.handle();
    assert.equal(b.e.name, '');
  });

  it('a lowercase z / Space on the untouched suggestion accepts it (no "zzzz" names)', () => {
    const { e, key, out } = rig();
    key('z'); e.handle();
    assert.equal(out.done, 'PUDDLE');
    const s = rig();
    s.key(' '); s.e.handle();
    assert.equal(s.out.done, 'PUDDLE');
    // Shift+Z still types a capital
    const c = rig();
    c.key('Z'); c.e.handle();
    assert.equal(c.e.name, 'Z');
  });

  it('after the arrows walk the grid, z and Space press the focused key instead of typing', () => {
    const { e, key, out } = rig({ entry: { suggest: null } });
    key('ArrowRight'); key('z'); e.handle();
    assert.equal(e.gridNav, true);
    assert.equal(e.name, 'B', 'the focused key (B), not a literal z');
    key(' '); e.handle();
    assert.equal(e.name, 'Bb', 'Space presses too (lower case after the first capital)');
    assert.equal(out.done, null);
    // a typed letter goes back to typing
    key('q'); e.handle();
    assert.equal(e.name, 'Bbq');
    key('z'); e.handle();
    assert.equal(e.name, 'Bbqz', 'typing again: z is a letter');
  });

  it('ignores keys and buttons for the first 250 ms (Z mashed through the dialogue does not carry over)', () => {
    const { e, key, clock, out, pressed } = rig({ device: 'gamepad' });
    clock.now = 0; e.attach(); // re-open at t = 0
    key('z'); key('z'); key('Enter');
    pressed.add('confirm');
    e.handle();
    assert.equal(out.done, null);
    assert.equal(e.name, 'PUDDLE');
    pressed.clear();
    clock.now = OPEN_GUARD_MS - 1; key('z'); e.handle();
    assert.equal(out.done, null, 'still inside the guard');
    clock.now = OPEN_GUARD_MS + 5; e.handle();
    assert.equal(out.done, null, 'keys pressed during the guard were dropped, not queued');
    assert.equal(OPEN_GUARD_MS, 250);
  });

  it('a gamepad A keeps the suggestion until the cursor moves; then A presses keys; B clears', () => {
    const a = rig({ device: 'gamepad' });
    a.pressed.add('confirm'); a.e.handle(); a.pressed.clear();
    assert.equal(a.out.done, 'PUDDLE');
    const b = rig({ device: 'gamepad' });
    b.pressed.add('right'); b.e.handle(); b.pressed.clear();
    b.pressed.add('confirm'); b.e.handle(); b.pressed.clear();
    assert.equal(b.out.done, null);
    assert.equal(b.e.name, 'B', 'the moved cursor presses B over the suggestion');
    const c = rig({ device: 'gamepad' });
    c.pressed.add('cancel'); c.e.handle(); c.pressed.clear();
    assert.equal(c.e.name, '');
    assert.equal(c.out.cancelled, 0, 'B clears the suggestion first, backs out only when empty');
  });

  it('an initial text (re-editing a name) is not selected; prefill can be turned off', () => {
    const { e } = rig({ entry: { initial: 'Mud' } });
    assert.equal(e.selected, false);
    assert.equal(e.name, 'Mud');
    const off = rig({ entry: { prefill: false } });
    assert.equal(off.e.name, '');
  });

  it('draws the selection band and the keep hint', () => {
    const { e } = rig();
    const ctx = fakeCtx();
    assert.doesNotThrow(() => e.draw(ctx));
  });
});

// ---------------------------------------------------------------------------------------------
// FH-09: the Next chip and the hanging signs
// ---------------------------------------------------------------------------------------------

describe('FH-09 Next chip', () => {
  const beats = [{ id: 'meet-odile' }, { id: 'meet-bryony' }, { id: 'mail-sack-pickup' }, { id: 'barnaby-field-log' }];

  it('rankBeats puts unfinished errands before optional neighbour meets, stable within each group', () => {
    assert.equal(isOptionalBeat({ id: 'meet-thessaly' }), true);
    assert.equal(isOptionalBeat({ id: 'yard-apron' }), false);
    assert.deepEqual(rankBeats(beats).map((b) => b.id), ['mail-sack-pickup', 'barnaby-field-log', 'meet-odile', 'meet-bryony']);
    assert.deepEqual(rankBeats(null), []);
  });

  it('objectiveFor: the errand, not "Meet the neighbours", once the first three errands are done (repro)', () => {
    const w = createNewWorld({ seedCode: 'FLUX-TEST-0000', challenges: [] });
    Object.assign(w.flags, {
      'sp.arrived': true, 'sp.starter-chosen': true, 'seen.wick-keeper': true, 'sp.reading-glass': true, 'sp.dock-battle': true,
      'sp.errands-started': true, 'sys.errand.apron': true, 'sys.errand.notice': true, 'sys.errand.orchard': true,
    });
    w.player.mapId = 'pellwick';
    assert.match(currentObjective(w, data).text, /Meet the neighbours/, 'the pause menu picker before the ranking fix');
    const o = objectiveFor(w, data);
    assert.match(o.text, /^Errand: /);
    assert.equal(o.mapId, 'pellwick');
    assert.ok(Number.isInteger(o.x) && Number.isInteger(o.y));
    // the invariant as errands get done: never a meet while another beat is ready
    for (const f of ['sp.mail-sack', 'sp.field-log', 'sys.errand.fish', 'sp.capture-stance']) {
      w.flags[f] = true;
      const other = readyBeats(w, data).some((b) => !isOptionalBeat(b));
      const o2 = objectiveFor(w, data);
      if (other) assert.doesNotMatch(o2.text, /Meet the neighbours/, f);
    }
  });

  it('objectiveFor passes every non-story objective through unchanged', () => {
    const w = createNewWorld({ seedCode: 'FLUX-TEST-0000', challenges: [] });
    assert.deepEqual(objectiveFor(w, data), currentObjective(w, data));
  });

  it('the chip shows for six seconds after a change and after a menu, fading in and out', () => {
    const chip = createObjectiveChip();
    assert.equal(chip.alpha(0), 0, 'nothing to say yet');
    assert.equal(chip.observe('Errand: fetch the sack.', 1000), true);
    assert.equal(chip.alpha(1000 + CHIP_FADE_MS / 2), 0.5);
    assert.equal(chip.alpha(3000), 1);
    assert.equal(chip.alpha(1000 + CHIP_SHOW_MS + 1), 0);
    assert.equal(chip.observe('Errand: fetch the sack.', 9000), false, 'the same line does not re-show');
    assert.equal(chip.alpha(9100), 0);
    chip.arm();
    assert.equal(chip.resumed(20000), true);
    assert.equal(chip.alpha(21000), 1, 'back from a menu: shown again');
    assert.equal(chip.resumed(40000), false, 'a resume without a menu (a dialogue) does not bump');
    assert.equal(chip.alpha(40100), 0);
    chip.hide();
    assert.equal(chip.alpha(21000), 0);
  });

  it('draws a slim chip under the clock, clipped to its width', () => {
    const ctx = fakeCtx();
    const r = drawObjectiveChip(ctx, 'Errand: take the mail sack back to the post office, and then a very long tail', { maxW: 200 });
    assert.ok(r && r.w <= 210 && r.h === 13);
    assert.equal(drawObjectiveChip(ctx, 'x', { alpha: 0 }), null);
    assert.equal(drawObjectiveChip(ctx, '', {}), null);
  });

  it('Pellwick has a hanging sign with a name and Look text by Pell\'s, the Archive, the post office, the yard and the cottage', () => {
    const map = data.get('maps', 'pellwick');
    const signs = map.entities.filter((e) => typeof e.art === 'string' && e.art.startsWith('hanging-sign-'));
    const want = { pells: [24, 19], archive: [32, 19], post: [48, 19], yard: [56, 25], cottage: [9, 22] };
    for (const [k, [dx, dy]] of Object.entries(want)) {
      const s = signs.find((e) => e.art === `hanging-sign-${k}`);
      assert.ok(s, k);
      assert.ok(PROP_ART[s.art], `${s.art} is registered art`);
      assert.equal(s.verb, 'look');
      assert.ok(s.name && s.text, `${k} has a name and Look text`);
      assert.ok(Math.abs(s.x - dx) <= 2 && s.y === dy, `${k} hangs beside its door`);
      const door = map.warps.find((w) => w.x === dx && w.y === dy && w.kind === 'door');
      assert.ok(door, `${k} door at ${dx},${dy}`);
      assert.notDeepEqual([s.x, s.y], [door.x, door.y], 'never on the door cell');
    }
  });
});

// ---------------------------------------------------------------------------------------------
// top10 #8: cries and indoor music
// ---------------------------------------------------------------------------------------------

describe('top10 #8 creature cries', () => {
  it('cryParams follows GDD-09 §10.5: base by stage + hash, slide and wave by primary type', () => {
    const sp = data.get('species', 'sootling'); // stage 1, Kiln
    const c = cryParams(sp);
    assert.ok(Math.abs(c.base - STAGE_BASE[1]) <= 2);
    assert.equal(c.slide, TYPE_SLIDE.kiln);
    assert.equal(c.wave, 'saw');
    assert.equal(c.tail, false);
    assert.deepEqual(cryParams(sp), c, 'deterministic');
    const pip = cryParams(data.get('species', 'puddlepip'), { bonded: true }); // stage 0, Brine
    assert.ok(Math.abs(pip.base - 76) <= 2);
    assert.equal(pip.wave, 'sine');
    assert.equal(pip.slide, -3);
    assert.equal(pip.tail, true, 'bonded creatures end on the shared tail');
    const bolt = cryParams(data.get('species', 'wirewhisk'));
    assert.equal(bolt.snap, true, 'Bolt slides up and snaps back');
    for (const [type, w] of Object.entries(TYPE_WAVE)) assert.ok(CRY_WAVES.includes(w), type);
    const v = cryParams(data.get('species', 'vagary'));
    assert.deepEqual(v.motif, [...VAGARY_MOTIF]);
    assert.ok(cryParams(data.get('species', 'vagary')).base < STAGE_BASE[4], 'a 96-cell form sits lower');
    assert.equal(cryParams(null, { speciesId: 'mystery', types: ['Rust'] }).wave, 'sawNoise');
  });

  it('every species gets a playable voice; different species do not all sound the same', () => {
    const set = new Set();
    for (const sp of data.list('species')) {
      const p = cryPlan(cryParams(sp, { bonded: true, star: true }));
      assert.ok(p.end > 0.3 && p.end < 1, sp.id);
      assert.ok(p.notes.every((n) => Number.isFinite(n.midi) && Number.isFinite(n.t)), sp.id);
      set.add(`${p.base}|${p.slide}|${p.wave}`);
    }
    assert.ok(set.size >= 15, `${set.size} distinct voices`);
  });

  it('cryPlan: ≈21 f voice, the A5/D6 tail, the snap, the shimmer', () => {
    const p = cryPlan({ base: 60, slide: 12, wave: 'square', snap: true, tail: true, shimmer: true });
    assert.ok(Math.abs(p.dur - 21 / 60) < 1e-9);
    const tail = p.notes.filter((n) => n.midi === 81 || n.midi === 86);
    assert.deepEqual(tail.map((n) => n.midi), [81, 86]);
    assert.ok(tail.every((n) => n.wave === 'sine' && n.gain === 0.5));
    assert.equal(p.notes[1].to, 60, 'the snap comes back to base');
    assert.ok(p.notes.some((n) => n.midi === 72 && n.wave === 'sine' && n.gain === 0.3), 'octave shimmer');
    assert.equal(cryPlan({ wave: 'kazoo' }).wave, 'triangle');
  });

  it('audio.cry is part of the engine and is silent (null) while locked', () => {
    const a = createAudio();
    assert.equal(typeof a.cry, 'function');
    assert.equal(a.cry({ base: 60, slide: 2, wave: 'sine' }), null);
  });
});

describe('top10 #8 indoor music', () => {
  it('decide(): indoors the world theme is low-passed with the perc / tide / rain stems off', () => {
    const out = decide(initialState({ hour: 12, season: 'spring', tide: 0.9, weather: 'rain', weatherStems: ['rain'] }));
    const ins = decide(initialState({ hour: 12, season: 'spring', tide: 0.9, weather: 'rain', weatherStems: ['rain'], indoor: true }));
    assert.equal(ins.track, out.track, 'the same day-part theme');
    assert.equal(ins.intensity, DIR_DEFAULTS.INDOOR_INTENSITY);
    assert.ok(ins.intensity < out.intensity);
    for (const k of DIR_DEFAULTS.INDOOR_STEMS_OFF) if (k in ins.stems) assert.equal(ins.stems[k], false, k);
    // a map with its own music (a Spire) is not filtered
    const spire = decide(initialState({ hour: 12, mapMusic: 'battle_spire', indoor: true }));
    assert.equal(spire.source, 'map');
    assert.equal(spire.intensity, 1);
  });

  it('the director reads the map kind on map:enter (not the arrival kind) and filters interiors', () => {
    const bus = createBus();
    const audio = createFakeAudio({ ready: true });
    const timers = createFakeTimers();
    const clock = createFakeClock({ hour: 12, tide: 0.3, season: 'spring' });
    const maps = { 'int-cottage': { id: 'int-cottage', region: 'pellwick', kind: 'interior', music: null }, pellwick: { id: 'pellwick', region: 'pellwick', kind: 'exterior', music: null } };
    const G = { bus, audio, clock, world: makeWorld(), data: makeData(maps) };
    const music = createMusicDirector(G, { timers, sfx: false });
    bus.emit('map:enter', { mapId: 'int-cottage', kind: 'warp' });
    const last = () => audio.of('setMusicParam').at(-1)[1].intensity;
    assert.equal(last(), DIR_DEFAULTS.INDOOR_INTENSITY);
    bus.emit('map:enter', { mapId: 'pellwick', kind: 'warp' });
    assert.equal(last(), 1);
    music.destroy();
  });
});

// ---------------------------------------------------------------------------------------------
// top10 #9: battle feel
// ---------------------------------------------------------------------------------------------

describe('top10 #9 battle log lines', () => {
  const dmg = (amount, extra = {}) => ({ type: 'damage', side: 1, target: 'Wirewhisk', amount, hp: 5, maxHp: 18, source: 'party', stanceFloor: false, ...extra });

  it('damageLine: effectiveness and damage in one line', () => {
    assert.equal(A.damageLine(dmg(13), 2), "It's strong! Wirewhisk took 13.");
    assert.equal(A.damageLine(dmg(3), 0.5), "It's weak… Wirewhisk took 3.");
    assert.equal(A.damageLine(dmg(7), 1), 'Wirewhisk took 7.');
    assert.equal(A.damageLine(dmg(20), 2, true), "A critical hit! It's strong! Wirewhisk took 20.");
    assert.equal(A.damageLine(dmg(0), 1), 'Wirewhisk barely felt it.');
    assert.equal(A.damageLine(dmg(4, { source: 'status' }), 1), null, 'status ticks speak through their own event');
    assert.equal(A.lineFor(dmg(4)), null, 'lineFor(damage) still never speaks; the damage anim does');
  });

  /** A recording fake view. */
  function fakeView() {
    const calls = [];
    const view = new Proxy({ hit: { mult: null, crit: false, effEv: null, critEv: null } }, {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => { calls.push([key, ...args]); return key === 'say' ? (args[0] ? 100 : 0) : key === 'hpTo' ? 50 : undefined; };
      },
    });
    return { view, calls };
  }

  it('a landed hit puts the line in the log and holds long enough to read it', () => {
    const { view, calls } = fakeView();
    const q = A.createAnimQueue({ instant: true });
    q.push(A.animFor({ type: 'effectiveness', side: 0, target: 'Wirewhisk', word: 'Strong', mult: 2 }, view));
    q.push(A.animFor(dmg(13), view));
    for (let i = 0; i < 50 && !q.idle(); i++) q.update(16);
    assert.ok(calls.some(([k, text]) => k === 'say' && text === "It's strong! Wirewhisk took 13."));
    assert.equal(calls.filter(([k]) => k === 'say').length, 1, 'one line, not a crit line plus another');
  });
});

describe('top10 #9 sprite fit', () => {
  it('opaqueBounds measures the drawn cells', () => {
    assert.deepEqual(A.opaqueBounds(['....', '.ab.', '..c.', '....']), { x0: 1, y0: 1, x1: 2, y1: 2, w: 2, h: 2 });
    assert.equal(A.opaqueBounds(['...']), null);
  });

  it('the Sootling (20×11 cells) draws a step larger and stands on its stand; full-size forms do not change', () => {
    const soot = creatureArt('sootling');
    const f = A.spriteFit(soot.rows, 2, soot.w);
    assert.equal(f.scale, 3);
    const b = A.opaqueBounds(soot.rows);
    const foot = f.dy + (b.y1 + 1) * f.scale;
    assert.equal(foot, 64 - 4, 'foot 4 px above the bottom of the 64 px box');
    const centre = f.dx + ((b.x0 + b.x1 + 1) / 2) * f.scale;
    assert.ok(Math.abs(centre - ((b.x0 + b.x1 + 1) / 2) * 2) <= 1, 'same centre line');
    assert.ok(b.w * f.scale >= 60, 'no longer a 40 px speck');
    for (const id of ['puddlepip', 'caldermaw', 'wirewhisk']) {
      const art = creatureArt(id);
      assert.deepEqual(A.spriteFit(art.rows, 2, art.w), { scale: 2, dx: 0, dy: 0 }, id);
    }
    const v = creatureArt('vagary');
    assert.equal(A.spriteFit(v.rows, 2, v.w).scale, 2, 'the 96-cell Vagary never grows');
  });
});

describe('top10 #9 backdrops', () => {
  it('backdropFor picks a theme per place; the Reading and the Lantern Stack are always night', () => {
    const at = (mapId, hour = 12, extra = {}) => backdropFor({ mapId, hour, ...extra });
    assert.equal(at('pellwick').theme, 'shore');
    assert.equal(at('lowmoor').theme, 'marsh');
    assert.equal(at('drownwood').theme, 'drowned');
    assert.equal(at('cairnhold').theme, 'stone');
    assert.equal(at('emberstep').theme, 'ember');
    assert.equal(at('thistlewind').theme, 'moor');
    assert.equal(at('rimeholt').theme, 'ice');
    assert.equal(at('the-bar').theme, 'flats');
    assert.equal(at('hollis-gate').theme, 'summit');
    assert.equal(at('spire-turn').theme, 'spire');
    assert.equal(at('keepers-hall').theme, 'spire');
    assert.equal(at('int-cottage').theme, 'room');
    assert.equal(at('lantern-stack').theme, 'reading');
    assert.equal(at('lantern-stack', 12).part, 'night');
    assert.equal(at('pellwick', 12, { source: 'reading' }).part, 'night');
    assert.equal(at('pellwick', 22).part, 'night');
    assert.equal(at('pellwick', 18).part, 'dusk');
    assert.notEqual(at('spire-turn').accent, at('spire-weather').accent, 'each Spire its own rune colour');
    assert.equal(at('pellwick', 12, { theme: 'ice' }).theme, 'ice', 'a setup may force one');
    assert.equal(at('nowhere').theme, 'shore');
    assert.equal(partOfHour(NaN), 'day');
    // every map in the registry resolves to a real theme
    for (const m of data.list('maps')) assert.ok(THEMES.includes(backdropFor({ mapId: m.id, hour: 12 }).theme), m.id);
  });

  it('every theme paints the whole arena with valid colours and differs from the flat bands; night differs from day', () => {
    const paint = (pick) => {
      const ops = [];
      const ctx = { fillStyle: '', fillRect(x, y, w, h) { ops.push([this.fillStyle, x, y, w, h]); } };
      drawBackdrop(ctx, pick);
      return ops;
    };
    for (const theme of THEMES) {
      const day = paint({ theme, part: 'day' });
      const night = paint({ theme, part: 'night' });
      assert.ok(day.length > 200, `${theme}: more than flat bands (${day.length} ops)`);
      for (const [c, x, y, w, h] of day) {
        assert.match(c, /^#[0-9A-F]{6}$/i, theme);
        assert.ok([x, y, w, h].every(Number.isFinite), theme);
      }
      assert.ok(day.some(([, x, y, w]) => x <= 0 && y <= 0 && w >= 480), `${theme} covers the top-left`);
      const colours = (ops) => new Set(ops.map((o) => o[0].toUpperCase()));
      if (theme !== 'reading') assert.notDeepEqual([...colours(day)].sort(), [...colours(night)].sort(), `${theme}: night variant`);
      assert.ok(colours(day).size >= 6, `${theme} uses a real palette`);
    }
    assert.ok(/^#[0-9A-F]{6}$/.test(rustleColour({ theme: 'marsh', part: 'dusk' })));
    assert.equal(grade('#38B764', 'day'), '#38B764');
    assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');
  });
});

// ---------------------------------------------------------------------------------------------
// wave-1 follow-ups
// ---------------------------------------------------------------------------------------------

describe('wave-1 follow-ups', () => {
  it('battle:end carries porchDuel', () => {
    const p = battleEndPayload({ kind: 'trainer', trainer: { id: 'pip' }, summit: false, porchDuel: true }, { outcome: 'win' });
    assert.deepEqual(p, { outcome: 'win', kind: 'trainer', trainerId: 'pip', summit: false, porchDuel: true });
    assert.equal(battleEndPayload({ kind: 'wild', trainer: null }, { outcome: 'run' }).porchDuel, false);
  });

  it('the seal slip lists each badge gift line', () => {
    assert.deepEqual(sealRewardLines({ rewards: [{ line: 'Received: Scouting Prism.' }, { line: '' }, null, { line: 'Received: Weatherglass.' }] }), ['Received: Scouting Prism.', 'Received: Weatherglass.']);
    assert.deepEqual(sealRewardLines({}), []);
  });

  it("the Forecast reads lit.steadied as a flag (flags.get read counters, so it was always off)", () => {
    const w = createNewWorld({ seedCode: 'FLUX-TEST-0000', challenges: [] });
    assert.equal(litSteadied(w), false);
    w.flags['lit.steadied'] = true;
    assert.equal(litSteadied(w), true);
    w.counters['lit.steadied'] = 0;
    assert.equal(litSteadied(w), true, 'the flag decides, not a counter');
  });
});
