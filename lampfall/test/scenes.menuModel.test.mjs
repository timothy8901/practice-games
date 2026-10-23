// SCN-MENU pure helpers: pause rows, Coverage, curve gap, Heartmark spot, presets, box capacity,
// disc learners, item actions, save-slot summaries and rows, settings rows, remap rules, field effects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/scenes/menuModel.js';
import { TYPES } from '../js/data/types.js';
import { MOVES } from '../js/data/moves/index.js';
import { ABILITIES } from '../js/data/abilities.js';
import { SPECIES, FAMILIES } from '../js/data/species/index.js';
import { ITEMS } from '../js/data/items.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';
import { makeCreature } from '../js/systems/creature.js';

const data = createRegistry({ ...DATA, types: TYPES, moves: MOVES, abilities: ABILITIES, species: SPECIES, families: FAMILIES, items: ITEMS });
const mk = (uid, speciesId, level, extra = {}) => ({ ...makeCreature({ uid, speciesId, level }, data), ...extra });
const moveOf = (type) => MOVES.find((m) => m.type === type && m.category !== 'status' && m.power > 0);

test('pause: GDD-00 order, Save always last, every row focusable', () => {
  assert.deepEqual(M.MENU_ITEMS.map((m) => m.id), ['party', 'satchel', 'ledger', 'map', 'fieldLog', 'journal', 'settings', 'save']);
  assert.equal(M.MENU_ITEMS.at(-1).scene, 'saveLoad');
  const rows = M.pauseRows({ run: { challenges: [] } });
  assert.equal(rows.at(-1).label, 'Save');
  assert.ok(rows.every((r) => !r.locked));
  assert.equal(rows[1].label, 'Satchel');
});

test('pause: No Rewind greys Save (still last, still focusable) with the locked words', () => {
  const rows = M.pauseRows({ run: { challenges: ['no-rewind'] } });
  const save = rows.at(-1);
  assert.equal(save.id, 'save');
  assert.equal(save.locked, true);
  assert.match(save.note, /No Rewind/);
  assert.equal(save.params.noRewind, true);
  assert.equal(M.isNoRewind({ run: { challenges: ['no-rewind'] } }), true);
  assert.equal(M.isNoRewind(null), false);
});

test('curve gap: over / under / on, in words', () => {
  assert.deepEqual(M.curveGap(10, 12), { kind: 'under', n: 2 });
  assert.deepEqual(M.curveGap(14, 12), { kind: 'over', n: 2 });
  assert.deepEqual(M.curveGap(12, 12), { kind: 'on', n: 0 });
  assert.equal(M.curveGapText({ kind: 'under', n: 3 }), '3 under curve');
  assert.equal(M.curveGapText({ kind: 'on', n: 0 }), 'on curve');
});

test('PP summary counts left / max and empty moves', () => {
  const s = M.ppSummary({ moves: [{ pp: 0, maxPp: 10 }, { pp: 5, maxPp: 20 }, { pp: 15, maxPp: 15 }] });
  assert.deepEqual(s, { pp: 20, max: 45, empty: 1 });
  assert.deepEqual(M.ppSummary({}), { pp: 0, max: 0, empty: 0 });
});

test('coverage: only Plain and Grit moves leave Hollow as a Gap (immunity), in words', () => {
  const plain = moveOf('Plain'), grit = moveOf('Grit');
  const c = { uid: 'c1', nickname: 'A', hp: 10, moves: [{ id: plain.id, pp: 1, maxPp: 1 }, { id: grit.id, pp: 1, maxPp: 1 }] };
  const cov = M.coverage([c], data);
  const hollow = cov.rows.find((r) => r.type === 'Hollow');
  assert.equal(hollow.best, 0);
  assert.equal(hollow.grade, 'blocked');
  assert.ok(cov.gaps.includes('Hollow'));
  assert.ok(cov.blocked.includes('Hollow'));
  assert.match(M.gapText(cov), /^Gap: .*Hollow/);
  // Grit is Strong against Brine
  const brine = cov.rows.find((r) => r.type === 'Brine');
  assert.equal(brine.grade, 'strong');
  assert.equal(brine.strong[0].nick, 'A');
});

test('coverage: a Kiln move answers Hollow; status moves never count; no moves says so', () => {
  const kiln = moveOf('Kiln');
  const status = MOVES.find((m) => m.category === 'status');
  const c = { uid: 'c1', nickname: 'K', hp: 10, moves: [{ id: kiln.id, pp: 1, maxPp: 1 }, { id: status.id, pp: 1, maxPp: 1 }] };
  const cov = M.coverage([c], data);
  assert.equal(cov.rows.find((r) => r.type === 'Hollow').grade, 'strong');
  assert.equal(cov.moves, 1);
  const none = M.coverage([{ uid: 'c2', nickname: 'S', hp: 1, moves: [{ id: status.id, pp: 1, maxPp: 1 }] }], data);
  assert.equal(none.moves, 0);
  assert.ok(none.rows.every((r) => r.grade === 'none'));
  assert.match(M.gapText(none), /No damaging/);
});

test('coverage: a full spread has no gap and says party.noGap', () => {
  const types = ['Kiln', 'Brine', 'Moss', 'Grit', 'Glass', 'Rime', 'Bolt', 'Stone'];
  const party = types.map((ty, i) => ({ uid: `c${i}`, nickname: ty, hp: 5, moves: [{ id: moveOf(ty).id, pp: 1, maxPp: 1 }] }));
  const cov = M.coverage(party, data);
  assert.equal(cov.gaps.length, 0);
  assert.equal(M.gapText(cov), 'No gap. Every type has an answer.');
});

test('listWords joins in plain English', () => {
  assert.equal(M.listWords(['Hollow']), 'Hollow');
  assert.equal(M.listWords(['Hollow', 'Stone']), 'Hollow and Stone');
  assert.equal(M.listWords(['a', 'b', 'c']), 'a, b and c');
});

test('chart: registry without a chart falls back to the authoritative data/types chart', () => {
  const { chart, ordinary } = M.chartOf(data);
  assert.equal(chart.Plain.Hollow, 0);
  assert.equal(ordinary.length, 12);
  assert.ok(!ordinary.includes('Star'));
  const custom = M.chartOf({ typeChart: { chart: { A: { A: 2 } }, ordinary: ['A'] } });
  assert.deepEqual(custom.ordinary, ['A']);
});

test('Heartmark spot: stable per uid, the same in every form, stored spot wins', () => {
  const a = M.heartmarkSpot({ uid: 'c7', mark: { x: 1, y: 0 } });
  assert.ok(M.MARK_SPOTS.includes(a));
  assert.equal(M.heartmarkSpot({ uid: 'c7', mark: { x: -2, y: 2 } }), a);
  assert.equal(M.heartmarkSpot({ uid: 'c7', mark: { x: 0, y: 0, spot: 'tail' } }), 'tail');
  assert.equal(M.heartmarkSpot({ uid: 'c7', mark: { x: 0, y: 0, anchor: 1 } }), 'chest');
  const spots = new Set(Array.from({ length: 40 }, (_, i) => M.heartmarkSpot({ uid: `c${i}` })));
  assert.equal(spots.size, 4, 'uids spread over all four anchors');
});

test('mark pixel: the form anchor for the spot plus the clamped offset, inside the sprite', () => {
  const sp = SPECIES.find((s) => s.id === 'sloshkin');
  const c = { uid: 'c1', mark: { x: 9, y: -9, spot: 'head' } };
  const p = M.markPixel(c, sp);
  assert.equal(p.spot, 'head');
  assert.equal(p.x, sp.flags.heartmarkAnchors.head.x + 2);
  assert.equal(p.y, sp.flags.heartmarkAnchors.head.y - 2);
  const q = M.markPixel({ uid: 'c1', mark: { x: 0, y: 0, spot: 'tail' } }, null);
  assert.ok(q.x >= 1 && q.x <= 30 && q.y >= 1 && q.y <= 30);
});

test('presets cycle ask -> auto-Anchor -> auto-accept Up -> ask', () => {
  assert.equal(M.nextPreset(null), 'auto-anchor');
  assert.equal(M.nextPreset('auto-anchor'), 'auto-up');
  assert.equal(M.nextPreset('auto-up'), null);
  assert.equal(M.nextPreset(null, -1), 'auto-up');
  assert.equal(M.presetLabel('auto-up'), 'Auto-accept Up');
  assert.equal(M.presetLabel(undefined), 'Always ask');
});

test('box capacity: 20, 40 with the Cellar commission, never below what is stored', () => {
  assert.equal(M.boxCapacity({ loans: { commissions: [] }, box: [] }), 20);
  assert.equal(M.boxCapacity({ loans: { commissions: ['cellar'] }, box: [] }), 40);
  assert.equal(M.boxCapacity({ loans: { commissions: [] }, box: new Array(23).fill({}) }), 23);
  assert.equal(M.boxCapacity({ loans: { commissions: [] }, box: [] }, { BOX_CAPACITY: 20, boxCapacityCellar: 40 }), 20);
});

test('disc: move facts and the learner strip (can / knows / cannot)', () => {
  const disc = ITEMS.find((i) => i.id === 'disc-drowned-bell');
  const mv = M.discMove(disc, data);
  assert.equal(mv.id, 'drowned-bell');
  assert.equal(mv.type, 'Hollow');
  assert.ok(mv.power > 0);
  const slosh = mk('c1', 'sloshkin', 10);
  const knows = { ...mk('c2', 'sloshkin', 10), moves: [{ id: 'drowned-bell', pp: 5, maxPp: 5 }] };
  const toss = mk('c3', 'scrapling', 5);
  const strip = M.learnerStrip([slosh, knows, toss], 'drowned-bell', data);
  assert.deepEqual(strip.map((s) => s.state), ['can', 'knows', 'cannot']);
});

test('item actions: field medicine Use, held Give, discs Teach, keepsakes never Toss', () => {
  const party = [mk('c1', 'sloshkin', 5)];
  const salve = M.itemActions(ITEMS.find((i) => i.id === 'salve'), { pocket: 'medicine', party });
  assert.deepEqual(salve.map((a) => a.id), ['use', 'toss']);
  assert.ok(salve.every((a) => a.enabled));
  const wick = M.itemActions(ITEMS.find((i) => i.id === 'tallow-wick'), { pocket: 'wicks', party });
  assert.equal(wick[0].enabled, false);
  assert.match(wick[0].reason, /battle/);
  const disc = M.itemActions(ITEMS.find((i) => i.id === 'disc-flashover'), { pocket: 'discs', party });
  assert.equal(disc[0].id, 'teach');
  const knot = M.itemActions(ITEMS.find((i) => i.id === 'still-knot'), { pocket: 'held', party });
  assert.equal(knot[0].id, 'hold');
  const kettle = M.itemActions(ITEMS.find((i) => i.id === 'dorrow-kettle'), { pocket: 'keepsakes', party });
  const toss = kettle.find((a) => a.id === 'toss');
  assert.equal(toss.enabled, false);
  assert.match(toss.reason, /Keepsakes/);
  assert.equal(M.itemActions(ITEMS.find((i) => i.id === 'salve'), { pocket: 'medicine', party: [] })[0].enabled, false);
});

test('holders maps held item ids to nicknames', () => {
  const w = { party: [{ nickname: 'A', heldItem: 'oilskin' }], box: [{ nickname: 'B', heldItem: 'oilskin' }, { nickname: 'C', heldItem: null }] };
  assert.deepEqual(M.holders(w), { oilskin: ['A', 'B'] });
});

test('play time, place names, slot labels and ages', () => {
  assert.equal(M.formatPlayTime(0), '0m');
  assert.equal(M.formatPlayTime(12 * 60e3), '12m');
  assert.equal(M.formatPlayTime(65 * 60e3), '1h 05m');
  assert.equal(M.placeName('the-bar'), 'The Bar');
  assert.equal(M.placeName('lowmoor', { has: () => true, get: () => ({ name: 'Lowmoor Flats' }) }), 'Lowmoor Flats');
  assert.match(M.placeName(''), /shore/);
  assert.equal(M.slotLabel({ kind: 'manual', index: 2 }), 'Slot 2');
  assert.equal(M.slotLabel({ slot: 'auto:3' }), 'Autosave 3');
  assert.equal(M.ageText(1000, 1000 + 30e3), 'just now');
  assert.equal(M.ageText(0, 5 * 60e3), '5 minutes ago');
  assert.equal(M.ageText(0, 60e3), '1 minute ago');
});

test('slot summary: header fields, 1-based day, party icons from the loaded world', () => {
  const entry = { slot: 'manual:1', kind: 'manual', index: 1, state: 'ok', time: 0, seq: 3, summary: { name: 'Wren', place: 'lowmoor', day: 2, time: '14:20', playMs: 3 * 3600e3 + 60e3, seedCode: 'FLUX-1', dial: 'flux' } };
  const world = { party: [{ uid: 'c1', speciesId: 'sloshkin', nickname: 'PUDDLE', level: 9, mark: { x: 0, y: 0 } }], player: { name: 'Wren', mapId: 'lowmoor' }, stats: { playMs: 0 }, run: {} };
  const s = M.slotSummary(entry, world, null, 120e3);
  assert.equal(s.label, 'Slot 1');
  assert.equal(s.day, 3);
  assert.equal(s.time, '14:20');
  assert.equal(s.place, 'Lowmoor');
  assert.equal(s.playTime, '3h 01m');
  assert.equal(s.party.length, 1);
  assert.equal(s.party[0].nick, 'PUDDLE');
  assert.equal(s.age, '2 minutes ago');
  const empty = M.slotSummary({ slot: 'auto:2', kind: 'auto', index: 2, state: 'empty' });
  assert.equal(empty.state, 'empty');
  assert.equal(empty.label, 'Autosave 2');
  const bad = M.slotSummary({ slot: 'manual:3', kind: 'manual', index: 3, state: 'corrupt', error: { code: 'corrupt' } });
  assert.equal(bad.error, 'corrupt');
});

test('slot rows: save lists manual slots; load adds a crash-resume row and the autosaves; No Rewind keeps one autosave', () => {
  const E = (slot, state, seq = 0) => ({ slot, kind: slot.split(':')[0], index: Number(slot.split(':')[1]), state, seq });
  const entries = [E('manual:1', 'ok', 4), E('manual:2', 'empty'), E('manual:3', 'ok', 2), E('auto:1', 'ok', 5), E('auto:2', 'ok', 6), E('auto:3', 'empty')];
  const save = M.slotRows(entries, { tab: 'save' });
  assert.deepEqual(save.map((r) => r.entry.slot), ['manual:1', 'manual:2', 'manual:3']);
  const load = M.slotRows(entries, { tab: 'load', crashed: true });
  assert.equal(load[0].kind, 'resume');
  assert.equal(load[0].entry.slot, 'auto:2');
  assert.deepEqual(load.slice(1).map((r) => r.entry.slot), ['manual:1', 'manual:2', 'manual:3', 'auto:1', 'auto:2', 'auto:3']);
  assert.equal(load.find((r) => r.latest).entry.slot, 'auto:2');
  assert.deepEqual(M.slotRows(entries, { tab: 'save', noRewind: true }), []);
  const nr = M.slotRows(entries, { tab: 'load', noRewind: true });
  assert.deepEqual(nr.map((r) => r.entry.slot), ['auto:1']);
  assert.equal(M.newestAuto(entries).slot, 'auto:2');
});

test('save error words', () => {
  assert.match(M.saveErrorText({ code: 'quota' }), /Storage is full/);
  assert.match(M.saveErrorText({ code: 'version' }), /newer/);
  assert.match(M.saveErrorText({ code: 'weird' }), /Save failed: weird/);
});

test('settings: every GDD-00 §15 setting has a row', () => {
  const ids = M.settingRows().map((r) => r.id);
  for (const id of ['dayLength', 'textSpeed', 'battleSpeed', 'fishingMode', 'reducedMotion', 'largeText', 'highContrast', 'clearVisuals', 'pathView', 'remap', 'music', 'sfx', 'ambience', 'muted', 'touchLayout', 'wakePoint']) {
    assert.ok(ids.includes(id), id);
  }
  const day = M.settingRows().find((r) => r.id === 'dayLength');
  assert.deepEqual(day.options.map((o) => o.value), ['12', '24', '48', 'real']);
  assert.equal(M.settingRows().find((r) => r.id === 'textSpeed').options.length, 4);
  for (const r of M.settingRows()) assert.ok(M.SETTING_SECTIONS.includes(r.section), r.id);
});

test('settings: values, steps and world patches', () => {
  const rows = Object.fromEntries(M.settingRows().map((r) => [r.id, r]));
  const s = { minutesPerDay: 24, realClock: false, textSpeed: 'normal', volumes: { master: 0.8, music: 0.7, sfx: 0.9 }, muted: false, reducedMotion: false };
  const ext = M.normalizeExt({});
  assert.equal(M.rowValue(rows.dayLength, s, ext), '24');
  assert.equal(M.rowValue(rows.dayLength, { ...s, realClock: true }, ext), 'real');
  assert.equal(M.rowValue(rows.music, s, ext), 70);
  assert.equal(M.rowValue(rows.battleSpeed, s, ext), 2);
  assert.equal(M.stepValue(rows.dayLength, '24', 1), '48');
  assert.equal(M.stepValue(rows.dayLength, 'real', 1), 'real', 'choices clamp at the end');
  assert.equal(M.stepValue(rows.music, 70, 1), 80);
  assert.equal(M.stepValue(rows.music, 100, 1), 100);
  assert.equal(M.stepValue(rows.music, 0, -1), 0);
  assert.equal(M.stepValue(rows.muted, false, 1), true);
  assert.deepEqual(M.worldPatch(rows.dayLength, 'real', s), { realClock: true });
  assert.deepEqual(M.worldPatch(rows.dayLength, '12', s), { realClock: false, minutesPerDay: 12 });
  assert.deepEqual(M.worldPatch(rows.music, 50, s), { volumes: { master: 0.8, music: 0.5, sfx: 0.9 } });
  assert.equal(M.worldPatch(rows.battleSpeed, 4, s), null);
  assert.equal(M.valueLabel(rows.music, 50), '50%');
  assert.equal(M.valueLabel(rows.dayLength, 'real'), 'Real Clock');
});

test('extension settings normalize to GDD-09 defaults', () => {
  assert.deepEqual(M.normalizeExt(null), { ...M.EXT_DEFAULTS });
  const n = M.normalizeExt({ battleSpeed: 3, fishingMode: 'gentle', ambience: 4, largeText: 'yes', highContrast: true });
  assert.equal(n.battleSpeed, 2);
  assert.equal(n.fishingMode, 'gentle');
  assert.equal(n.ambience, 1);
  assert.equal(n.largeText, false);
  assert.equal(n.highContrast, true);
});

test('remap: conflicts honour the by-design shares; swap gives the other action the old key', () => {
  const b = { confirm: ['KeyZ', 'Enter', 'gp:b0'], cancel: ['KeyX', 'Escape', 'gp:b1'], menu: ['Enter', 'Escape', 'gp:b9'], tool: ['KeyC', 'gp:b2'] };
  assert.deepEqual(M.remapConflicts(b, 'confirm', 'KeyX'), ['cancel']);
  assert.deepEqual(M.remapConflicts(b, 'cancel', 'Escape'), [], 'Escape is shared with menu by design');
  assert.deepEqual(M.remapConflicts(b, 'tool', 'KeyQ'), []);
  // refused without swap
  assert.deepEqual(M.remapped(b, 'confirm', 'KeyX'), b);
  const s = M.remapped(b, 'confirm', 'KeyX', { swap: true });
  assert.deepEqual(s.confirm, ['KeyX', 'Enter', 'gp:b0']);
  assert.deepEqual(s.cancel, ['KeyZ', 'Escape', 'gp:b1']);
  // a free key replaces the primary of its device only
  const f = M.remapped(b, 'tool', 'KeyQ');
  assert.deepEqual(f.tool, ['KeyQ', 'gp:b2']);
  const g = M.remapped(b, 'tool', 'gp:b3');
  assert.deepEqual(g.tool, ['KeyC', 'gp:b3']);
  assert.equal(M.primaryToken(b, 'cancel', 'gamepad'), 'gp:b1');
  assert.equal(M.deviceOf('gp:b3'), 'gamepad');
  assert.equal(M.deviceOf('touch:a'), 'touch');
  assert.equal(M.deviceOf('KeyQ'), 'keyboard');
  assert.ok(Object.isFrozen(b) === false && b.confirm[0] === 'KeyZ', 'input table untouched');
});

test('field effects: fit checks and application', () => {
  const c = { hp: 10, stats: { hp: 40 }, status: { kind: 'burn', turns: 0 }, moves: [{ id: 'a', pp: 2, maxPp: 10 }, { id: 'b', pp: 5, maxPp: 5 }] };
  assert.equal(M.effectFits(c, { kind: 'heal', amount: 25 }).ok, true);
  assert.deepEqual(M.applyFieldEffect(c, { kind: 'heal', amount: 25 }), { ok: true, healed: 25 });
  assert.equal(c.hp, 35);
  assert.deepEqual(M.applyFieldEffect(c, { kind: 'heal', amount: null }), { ok: true, healed: 5 });
  assert.equal(M.effectFits(c, { kind: 'heal', amount: 25 }).reason, 'full');
  assert.equal(M.applyFieldEffect(c, { kind: 'revive' }).ok, false, 'awake creatures are not revived');
  assert.deepEqual(M.applyFieldEffect(c, { kind: 'cure', statuses: ['burn', 'poison'] }), { ok: true, cured: 'burn' });
  assert.equal(c.status, null);
  assert.deepEqual(M.applyFieldEffect(c, { kind: 'pp', amount: 10 }), { ok: true, pp: 8 });
  const down = { hp: 0, stats: { hp: 41 }, status: { kind: 'poison' }, moves: [] };
  assert.equal(M.effectFits(down, { kind: 'heal', amount: 10 }).reason, 'resting');
  assert.deepEqual(M.applyFieldEffect(down, { kind: 'revive', fraction: 0.5 }), { ok: true, revived: true, healed: 20 });
  assert.equal(down.status, null);
});

test('settings: the GDD-09 §6 extras are rows too (captions, screen scale, battery saver, skip animations)', () => {
  const rows = Object.fromEntries(M.settingRows().map((r) => [r.id, r]));
  assert.equal(rows.captions.target, 'ext');
  assert.equal(rows.scale.target, 'world');
  assert.deepEqual(rows.scale.options.map((o) => o.value), ['integer', 'fit']);
  assert.equal(rows.fps30.kind, 'toggle');
  assert.equal(rows.skipAnims.kind, 'toggle');
  assert.deepEqual(M.worldPatch(rows.scale, 'fit', {}), { scale: 'fit' });
  assert.equal(M.rowValue(rows.captions, {}, M.normalizeExt(null)), true);
});

test('theName: never "the The"', () => {
  assert.equal(M.theName('Salve'), 'the Salve');
  assert.equal(M.theName("The Bracks' Still Knot"), "the Bracks' Still Knot");
  assert.equal(M.theName('Theodora\'s Cup'), 'the Theodora\'s Cup');
});
