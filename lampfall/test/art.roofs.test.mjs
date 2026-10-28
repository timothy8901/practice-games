// Roof massing (js/art/tiles/buildings.js; polish backlog "houses have one massing so streets repeat"):
// every roof colour has its full autotile set, the ends are not the plain verge of the old single
// massing, hipped ends cut the silhouette back from the ridge, the cross-gable colours carry a
// plastered gable, and the colours between them show at least four distinct end treatments.
// Run: node --test test/art.roofs.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_ART } from '../js/art/tiles/index.js';
import { ROOF_COLOURS } from '../js/art/palette.js';
import { lintArtEntry } from '../tools/lint-art.mjs';

const rows = (id) => TILE_ART[id].frames[0];
const PARTS = ['ridge', 'ridge-l', 'ridge-r', 'body', 'eave', 'eave-l', 'eave-r', 'dormer', 'dormer-lit'];
/** Opaque-pixel signature of a tile (shape only, colour-blind). */
const shape = (id) => rows(id).map((r) => r.replace(/[^.]/g, '#')).join('/');

describe('roof massing', () => {
  it('every colour has the full 16x16 roof set and passes lint-art', () => {
    for (const c of ROOF_COLOURS) {
      for (const p of PARTS) {
        const id = `roof-${c}-${p}`;
        assert.ok(TILE_ART[id], `${id} missing`);
        const r = rows(id);
        assert.equal(r.length, 16, id);
        for (const row of r) assert.equal(row.length, 16, id);
        assert.deepEqual(lintArtEntry('tile', id, TILE_ART[id]).filter((e) => e.level === 'error'), [], id);
      }
    }
  });

  it('hipped colours cut the ridge corner back (transparent top-left on -l, top-right on -r)', () => {
    for (const c of ['slate', 'moss', 'teal']) {
      const l = rows(`roof-${c}-ridge-l`), r = rows(`roof-${c}-ridge-r`);
      assert.equal(l[4][0], '.', `${c} ridge-l corner`);
      assert.equal(r[4][15], '.', `${c} ridge-r corner`);
      assert.notEqual(rows(`roof-${c}-ridge`)[4][0], '.', `${c} ridge middle stays full`);
    }
  });

  it('the cross-gable sits at the left end on red and the right end on blue (plaster in the gable)', () => {
    const plasterIn = (id) => rows(id).join('').match(/[hpq]/g)?.length ?? 0;
    assert.ok(plasterIn('roof-red-eave-l') > 20, 'red eave-l gable');
    assert.equal(plasterIn('roof-red-eave-r'), 0, 'red right end is a verge');
    assert.ok(plasterIn('roof-blue-eave-r') > 20, 'blue eave-r gable');
    assert.equal(plasterIn('roof-blue-eave-l'), 0, 'blue left end is a verge');
    assert.equal(TILE_ART['roof-red-eave-l'].pal.h, 'pl3');
    // the whole gable lives in the eave cell, so taller roofs (ridge / body / eave) never split it
    assert.equal(plasterIn('roof-red-ridge-l'), 0, 'red ridge-l carries no gable fragment');
    assert.equal(plasterIn('roof-blue-ridge-r'), 0, 'blue ridge-r carries no gable fragment');
  });

  it('body ends exist for every colour and continue the end treatment (verge board / hip line)', () => {
    for (const c of ROOF_COLOURS) for (const side of ['l', 'r']) {
      const id = `roof-${c}-body-${side}`;
      assert.ok(TILE_ART[id], `${id} missing`);
      assert.deepEqual(lintArtEntry('tile', id, TILE_ART[id]).filter((e) => e.level === 'error'), [], id);
    }
    assert.ok(rows('roof-ochre-body-l').every((r) => r[1] === 'w'), 'ochre verge board runs down the body');
    for (const c of ['slate', 'moss', 'teal']) assert.ok(rows(`roof-${c}-body-l`).every((r) => r[4] === 'l' && r[1] !== 'w'), `${c} hip line at x 4, no verge board`);
    assert.ok(rows('roof-moss-body').join('').includes('g'), 'moss tufts on the body too');
  });

  it('streets do not repeat one massing: at least four distinct end silhouettes / treatments', () => {
    const sigs = new Set(ROOF_COLOURS.map((c) => [`roof-${c}-ridge-l`, `roof-${c}-eave-l`, `roof-${c}-ridge-r`, `roof-${c}-eave-r`].map((id) => rows(id).join('')).join('|')));
    assert.ok(sigs.size >= 6, `${sigs.size} end treatments`);
    const silhouettes = new Set(ROOF_COLOURS.map((c) => shape(`roof-${c}-ridge-l`)));
    assert.ok(silhouettes.size >= 3, `${silhouettes.size} ridge-end silhouettes`);
  });
});
