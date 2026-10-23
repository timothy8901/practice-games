// Unit tests for tools/lint-art.mjs. Run: node --test test/tools.lintArt.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintArtEntry, lintArt, collectArt, splitAdvisory, SIZE_RULES, KEY_CAPS } from '../tools/lint-art.mjs';
import { pal, MASTER } from '../js/art/palette.js';
import { SPRITES } from '../proto/creatures/sprites.js';

const errors = (cat, id, def) => lintArtEntry(cat, id, def).filter((p) => p.level === 'error').map((p) => p.message);
const tile16 = (fill = 'g') => Array.from({ length: 16 }, () => fill.repeat(16));
const okTile = { w: 16, h: 16, kind: 'ground', frames: [tile16()], pal: { g: 'grass2' }, fps: 0 };

describe('accepts good art', () => {
  it('a plain ground tile', () => assert.deepEqual(errors('tile', 'ok-tile', okTile), []));
  it('every prototype creature (adoption readiness)', () => {
    for (const [name, s] of Object.entries(SPRITES)) {
      assert.deepEqual(errors('creature', name, { ...s, reserved: name === 'Vagary' ? 'vagary' : undefined }), [], name);
    }
  });
});

describe('rejects', () => {
  it('off-size tiles (declared and per frame)', () => {
    assert.ok(errors('tile', 'big', { ...okTile, w: 17 }).some((m) => /off-size/.test(m)));
    const ragged = { ...okTile, frames: [[...tile16().slice(0, 15), 'g'.repeat(15)]] };
    assert.ok(errors('tile', 'ragged', ragged).some((m) => /off-size: frame 0 row 15/.test(m)));
    const short = { ...okTile, frames: [tile16().slice(0, 14)] };
    assert.ok(errors('tile', 'short', short).some((m) => /14 rows/.test(m)));
  });
  it('off-size creatures and people', () => {
    const rows = Array.from({ length: 30 }, () => '.'.repeat(30));
    assert.ok(errors('creature', 'c30', { rows, palette: pal('k') }).some((m) => /off-size 30×30/.test(m)));
    assert.ok(errors('char', 'tall', { w: 16, h: 40, frames: [Array.from({ length: 40 }, () => '.'.repeat(16))], pal: {} }).some((m) => /off-size/.test(m)));
    assert.equal(SIZE_RULES.char(16, 24), null);
    assert.equal(SIZE_RULES.char(16, 32), null);
  });
  it('over the key cap', () => {
    const keys = 'abcdefghijklm';
    const names = ['grass0', 'grass1', 'grass2', 'grass3', 'grass4', 'sand0', 'sand1', 'sand2', 'sand3', 'wet0', 'wet1', 'mud0', 'mud1'];
    const p = Object.fromEntries([...keys].map((k, i) => [k, names[i]]));
    const rows = tile16().map((r, y) => (y < keys.length ? keys[y].repeat(16) : r.replace(/g/g, 'a')));
    const msgs = errors('tile', 'busy', { ...okTile, frames: [rows], pal: p });
    assert.ok(msgs.some((m) => /over the key cap: 13 colours/.test(m)), msgs.join('|'));
    assert.equal(KEY_CAPS.creature, 10);
  });
  it('colours outside palette.js', () => {
    assert.ok(errors('tile', 'offpal', { ...okTile, pal: { g: '#123457' } }).some((m) => /not in js\/art\/palette\.js/.test(m)));
    assert.ok(errors('tile', 'unknown', { ...okTile, pal: { g: 'chartreuse' } }).some((m) => /unknown colour name/.test(m)));
    assert.ok(errors('tile', 'missing', { ...okTile, pal: {} }).some((m) => /missing from palette/.test(m)));
  });
  it('pure black or white', () => {
    const msgs = errors('ui', 'blackwhite', { w: 16, h: 16, frames: [tile16()], pal: { g: '#000000' } });
    assert.ok(msgs.some((m) => /pure black \/ white/.test(m)));
    assert.ok(errors('ui', 'white', { w: 16, h: 16, frames: [tile16()], pal: { g: '#FFF' } }).some((m) => /pure black \/ white/.test(m)));
  });
  it('magenta outside its reserved uses, and bogus reserved names', () => {
    const magenta = { ...okTile, pal: { g: '!m1' } };
    assert.ok(errors('tile', 'pinkgrass', magenta).some((m) => /magenta .* outside its reserved uses/.test(m)));
    assert.deepEqual(errors('tile', 'skyglass-ok', { ...magenta, reserved: 'skyglass' }), []);
    assert.ok(errors('tile', 'bad-reserve', { ...okTile, reserved: 'party' }).some((m) => /not one of/.test(m)));
    const rows = SPRITES.Sloshkin.rows.map((r, y) => (y === 10 ? r.replace('b', 'm') : r));
    assert.ok(errors('creature', 'pinkslosh', { ...SPRITES.Sloshkin, rows, palette: { ...SPRITES.Sloshkin.palette, m: MASTER.m } })
      .some((m) => /magenta/.test(m)));
  });
  it('a Heartmark anchor outside the sprite pixels', () => {
    const s = SPRITES.Sloshkin;
    assert.ok(errors('creature', 'anchor0', { ...s, heartmark: { x: 1, y: 1 } }).some((m) => /outside the sprite's pixels/.test(m)));
    assert.ok(errors('creature', 'anchorEdge', { ...s, heartmark: { x: 0, y: 5 } }).some((m) => /would leave/.test(m)));
    assert.ok(errors('creature', 'anchorBack', { ...s, heartmarkBack: { x: 1, y: 1 } }).some((m) => /heartmarkBack/.test(m)));
    const four = { head: s.heartmark, chest: s.heartmark, back: { x: 2, y: 2 }, tail: s.heartmark };
    assert.ok(errors('creature', 'anchors4', { ...s, heartmarks: four }).some((m) => /heartmarks\.back/.test(m)));
    assert.ok(errors('creature', 'anchorFloat', { ...s, heartmark: { x: 1.5, y: 3 } }).some((m) => /integer/.test(m)));
  });
  it('non-kebab ids and duplicate ids across registries', () => {
    assert.ok(errors('tile', 'Bad_Id', okTile).some((m) => /kebab-case/.test(m)));
    const r = lintArt([{ category: 'tile', table: { same: okTile } }, { category: 'prop', table: { same: { ...okTile, kind: undefined } } }]);
    assert.ok(r.errors.some((e) => /also used by a tile/.test(e.message)));
  });
  it('character framesets are sized per frame (fishing frames are wider)', () => {
    const f = (w, h) => Array.from({ length: h }, () => 'k'.repeat(w));
    const body = { w: 16, h: 24, down: [f(16, 24), f(16, 24), f(16, 24), f(16, 24)], fishFrames: [f(24, 24)], sit: f(16, 24) };
    assert.deepEqual(errors('char', 'hero', { body, palette: { k: MASTER.k } }), []);
    const bad = { ...body, sit: f(20, 24) };
    assert.ok(errors('char', 'hero2', { body: bad, palette: { k: MASTER.k } }).some((m) => /off-size: frame/.test(m)));
  });
});

describe('collection, advisory split and CLI', () => {
  it('collectArt finds tiles, props and UI; the shipped art has no gating errors', async () => {
    const sources = await collectArt();
    const cats = sources.map((s) => s.category);
    for (const c of ['tile', 'prop', 'ui']) assert.ok(cats.includes(c), c);
    const { errors: errs } = lintArt(sources.filter((s) => ['tile', 'prop', 'ui'].includes(s.category)));
    assert.deepEqual(errs, []);
  });
  it('splitAdvisory keeps named categories out of the gate', () => {
    const e = [{ where: 'char:x', message: 'm' }, { where: 'tile:y', message: 'n' }];
    const r = splitAdvisory(e, ['char']);
    assert.equal(r.gate.length, 1);
    assert.equal(r.advisory.length, 1);
  });
  it('the CLI exits 0 on the shipped art (as check.sh runs it)', () => {
    const cli = fileURLToPath(new URL('../tools/lint-art.mjs', import.meta.url));
    const r = spawnSync(process.execPath, [cli, '--quiet', '--advisory=char,portrait'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
});
