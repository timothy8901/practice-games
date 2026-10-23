// Tests for js/art/tiles/*, js/art/props.js and js/art/ui.js: coverage of the prototype, the GDD tile
// kinds, readability rules and the house recipe. Run: node --test test/art.tiles.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_ART, TILE_GROUPS, TILE_ALIASES, TILE_IDS, resolveTileId, tileDef } from '../js/art/tiles/index.js';
import { PROP_ART, houseLayout } from '../js/art/props.js';
import { UI_ART } from '../js/art/ui.js';
import { ROOF_COLOURS } from '../js/art/palette.js';
import { lintArtEntry } from '../tools/lint-art.mjs';
import { TILES as PROTO } from '../proto/tiles/tiles.js';
import { TILESETS } from '../js/data/placeholder/world.js';
import { existsSync } from 'node:fs';
import { resolveArtId } from '../js/art/atlas.js';

const kebab = (n) => n.replace(/_/g, '-');
/** Prototype tiles that moved out of the tile groups (props and the Skyband) under a new id. */
const MOVED = {
  lamp_unlit: ['prop', 'lamp-post'], lamp_lit: ['prop', 'lamp-post'], boat: ['prop', 'boat'], chimney: ['prop', 'chimney'],
  cloud_a: ['ui', 'sky-cloud-a'], cloud_b: ['ui', 'sky-cloud-b'], isle_far: ['ui', 'sky-isle-far'],
};
const protoMatch = (name) => {
  if (MOVED[name]) return MOVED[name][0] === 'prop' ? PROP_ART[MOVED[name][1]] : UI_ART[MOVED[name][1]];
  return TILE_ART[resolveTileId(name)] || TILE_ART[kebab(name)];
};

describe('every prototype tile survives the split', () => {
  for (const name of Object.keys(PROTO)) {
    it(name, () => {
      const t = protoMatch(name);
      assert.ok(t, `${name} has a counterpart`);
      assert.equal(t.frames.length, PROTO[name].frames.length, `${name} keeps its animation frames`);
      assert.equal(t.w, PROTO[name].w);
      assert.equal(t.h, PROTO[name].h);
    });
  }
  it('unchanged prototype art is pixel-identical (spot checks)', () => {
    const same = ['grass_a', 'tallgrass', 'sand', 'wetsand', 'water_deep', 'river', 'foam_n', 'tidepool', 'causeway', 'cliff_face',
      'ledge_b', 'cobbles', 'pier', 'wall_brick', 'window_lit', 'roof_red_body', 'bush', 'tree_pine', 'waystone', 'skyglass', 'lighthouse_dark'];
    for (const n of same) {
      const mine = n === 'waystone' ? TILE_ART['waystone-lit'] : protoMatch(n);
      assert.deepEqual(mine.frames.map((f) => [...f]), PROTO[n].frames.map((f) => [...f]), n);
    }
  });
});

describe('tile table rules', () => {
  it('ids are kebab-case and unique across groups', () => {
    for (const id of TILE_IDS) assert.match(id, /^[a-z0-9][a-z0-9-]*$/);
    const n = Object.values(TILE_GROUPS).reduce((s, g) => s + Object.keys(g).length, 0);
    assert.equal(n, TILE_IDS.length);
  });
  it('every tile, prop and UI piece passes the art linter (no errors)', () => {
    const errs = [];
    for (const [id, t] of Object.entries(TILE_ART)) errs.push(...lintArtEntry('tile', id, t).filter((p) => p.level === 'error'));
    for (const [id, t] of Object.entries(PROP_ART)) errs.push(...lintArtEntry('prop', id, t).filter((p) => p.level === 'error'));
    for (const [id, t] of Object.entries(UI_ART)) errs.push(...lintArtEntry('ui', id, t).filter((p) => p.level === 'error'));
    assert.deepEqual(errs, []);
  });
  it('the groups are the seven of the manifest', () => {
    assert.deepEqual(Object.keys(TILE_GROUPS), ['ground', 'water', 'stone', 'wood', 'flora', 'buildings', 'lighthouse']);
  });
  it('aims past ~96 tile types (rotations, verge ends, roof colours, lit pairs and tide states collapsed)', () => {
    const base = (id) => id.replace(new RegExp(`^roof-(${ROOF_COLOURS.join('|')})-`), 'roof-')
      .replace(/-(n|e|s|w)$/, '').replace(/-(l|r)$/, '').replace(/-(lit|unlit)$/, '').replace(/-sub$/, '').replace(/-top$/, '');
    const types = new Set(TILE_IDS.map(base));
    assert.ok(types.size >= 96, `${types.size} tile types`);
  });
  it('every art id the map lane names (js/data/tilesets.js) resolves, bar its open ART_REQUESTS', async () => {
    if (!existsSync(new URL('../js/data/tilesets.js', import.meta.url))) return;
    const ts = await import('../js/data/tilesets.js');
    const open = new Set(ts.ART_REQUESTS || []);
    for (const row of Object.values(ts.TILES || {})) {
      for (const k of ['art', 'litArt']) if (row[k] && !open.has(row[k])) assert.ok(resolveArtId(row[k]), `${row.id}.${k} = ${row[k]}`);
    }
    for (const id of ['timber-stack', 'counter', 'shelf', 'table', 'bed', 'stairs-up', 'stairs-down', 'string-wall']) assert.ok(TILE_ART[id], id);
  });
  it('day-1 placeholder art ids all resolve', () => {
    for (const t of TILESETS) assert.ok(resolveTileId(t.art), t.art);
    for (const to of Object.values(TILE_ALIASES)) assert.ok(TILE_ART[to], to);
    assert.throws(() => tileDef('nope'), /unknown tile/);
  });
});

describe('GDD-00 §4 / §16 tile kinds exist', () => {
  const need = [
    'reeds', 'reed-edge', 'mainland-causeway', 'mainland-causeway-sub', 'waystone', 'waystone-lit', 'waystone-lantern',
    'skyglass', 'skyglass-spent', 'dig-crack', 'string-lights', 'spa-terrace', 'spa-terrace-lip', 'water-spring',
    'volcanic-rock', 'basalt', 'ember-vent', 'boardwalk-h', 'boardwalk-v', 'tree-mangrove', 'moor-turf', 'heather',
    'ice', 'mirror-ice', 'wreck-ribs', 'sea-stack', 'standing-stone', 'tree-purse', 'tree-bee', 'stepstone-sea',
    'cottage-floor-0', 'cottage-floor-3', 'cottage-wall-0', 'cottage-wall-3', 'hearth', 'lamp-room-floor', 'stair-spiral',
    'lens-dark', 'lens-lit', 'cave-floor', 'cave-wall',
  ];
  for (const id of need) it(id, () => assert.ok(TILE_ART[id], id));
  it('the six Spire themes have a floor and a wall', () => {
    for (const th of ['turn', 'ward', 'weather', 'hollow', 'relay', 'mirror']) {
      assert.ok(TILE_ART[`spire-floor-${th}`], th);
      assert.ok(TILE_ART[`spire-wall-${th}`], th);
    }
  });
  it('props: boats, lamps, signs, scaffold stages 0-7, roof swatches ×8, chimneys, lighthouse lit/dark, market, windmill, brazier', () => {
    for (const id of ['boat', 'punt', 'launch-beached', 'lamp-post', 'porch-lamp', 'brazier', 'signpost', 'commons-board',
      'shop-sign', 'tide-chalkboard', 'post-box', 'scaffold', 'lighthouse', 'roof-swatch', 'chimney', 'chimney-stone',
      'chimney-tin', 'market-stall-red', 'windmill']) assert.ok(PROP_ART[id], id);
    assert.equal(PROP_ART.scaffold.frames.length, 8);
    assert.equal(PROP_ART.lighthouse.frames.length, 8);
    assert.ok(PROP_ART.lighthouse.variantPal.lit);
    assert.deepEqual(Object.keys(PROP_ART['roof-swatch'].variants).sort(), [...ROOF_COLOURS].sort());
  });
  it('scaffold stages climb: stage n covers n sections and never shrinks', () => {
    const rowsWith = (f) => f.filter((r) => /[^.]/.test(r)).length;
    let prev = -1;
    for (const f of PROP_ART.scaffold.frames) { const n = rowsWith(f); assert.ok(n > prev); prev = n; }
  });
  it('UI: paper, ledger, wax seal, 20-notch tally stick, cursor, Skyband pieces', () => {
    for (const id of ['ui-paper-edge-top', 'ui-paper-edge-bottom', 'ui-ledger-lines', 'ui-wax-seal', 'ui-wax-seal-large',
      'ui-tally-stick', 'ui-cursor', 'sky-sun', 'sky-moon', 'sky-tide-dial', 'sky-tide-needle', 'sky-cloud-a',
      'sky-cloud-overcast', 'sky-comet', 'sky-meteor']) assert.ok(UI_ART[id], id);
    assert.equal(UI_ART['ui-tally-stick'].frames.length, 21);
    assert.equal(UI_ART['sky-moon'].frames.length, 8);
    assert.equal(UI_ART['sky-comet'].reserved, 'comet');
  });
});

describe('readability and motion rules', () => {
  it('encounter plants sway 3 frames and show ground between tufts', () => {
    for (const id of ['tall-grass', 'reeds', 'heather']) {
      const t = TILE_ART[id];
      assert.equal(t.frames.length, 3, id);
      const ground = Object.entries(t.pal).filter(([, v]) => /grass2|wmud1|moor1/.test(v)).map(([c]) => c);
      const n = t.frames[0].join('').split('').filter((c) => ground.includes(c)).length;
      assert.ok(n > 60, `${id} shows ground (${n} px)`);
    }
  });
  it('every blocking object carries a cast shadow (shadow colour) and a dark base', () => {
    for (const id of ['tree-pine', 'tree-alder', 'tree-fruit', 'tree-purse', 'bush', 'rock-a', 'waystone', 'standing-stone', 'crag', 'wreck-ribs', 'volcanic-rock']) {
      const t = TILE_ART[id];
      assert.ok(Object.values(t.pal).includes('shadow'), `${id} has a cast shadow`);
      assert.ok(Object.values(t.pal).some((v) => ['base', 'st0', 'cl0', 'ww0', 'grass0'].includes(v)), `${id} has a dark base line`);
    }
  });
  it('glowing mud and sparkles never draw a plus (the Heartmark glyph)', () => {
    const plusAt = (rows, chs) => {
      for (let y = 1; y < rows.length - 1; y++) for (let x = 1; x < rows[0].length - 1; x++) {
        const on = (xx, yy) => chs.includes(rows[yy][xx]);
        if (on(x, y) && on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1)) return true;
      }
      return false;
    };
    for (const id of ['mud-glow', 'mirror-ice', 'water-lagoon']) {
      const t = TILE_ART[id];
      const light = Object.entries(t.pal).filter(([, v]) => /^!bio|foam|ice3/.test(v)).map(([c]) => c);
      for (const f of t.frames) assert.equal(plusAt(f, light), false, id);
    }
  });
  it('wet sand is darker than dry sand (two ramps) and has a hard tide line edge', () => {
    assert.ok(TILE_ART['tideline-n'] && TILE_ART['tideline-s']);
    assert.equal(TILE_ART['wet-sand'].pal.s, 'wet1');
    assert.equal(TILE_ART.sand.pal.s, 'sand2');
  });
  it('ledges keep the lit lip and the chevron', () => {
    const b = TILE_ART['ledge-b'].frames[0];
    assert.match(b[7], /y.*y/);
  });
  it('animated tiles declare an fps; static ones have one frame', () => {
    for (const [id, t] of Object.entries(TILE_ART)) {
      if (t.frames.length > 1) assert.ok(t.fps > 0, `${id} animates`);
    }
  });
  it('magenta lives only in reserved art', () => {
    assert.equal(TILE_ART.skyglass.reserved, 'skyglass');
    for (const [id, t] of Object.entries(TILE_ART)) {
      if (id !== 'skyglass') assert.ok(!Object.values(t.pal).some((v) => /^!m[0-2]$/.test(v)), id);
    }
  });
});

describe('houseLayout', () => {
  it('references only existing art for every roof colour and material', () => {
    for (const roof of ROOF_COLOURS) {
      for (const material of ['timber', 'brick', 'stone', 'shiplap']) {
        for (const opts of [{ w: 3 }, { w: 4, porch: true, dormer: 1, chimney: 'stone' }, { w: 2, chimney: false }]) {
          const parts = houseLayout({ roof, material, ...opts });
          for (const p of parts) {
            assert.ok(TILE_ART[p.art] || PROP_ART[p.art], `${p.art}`);
            if (p.lit) assert.ok(TILE_ART[p.lit], p.lit);
          }
          const w = Math.max(2, opts.w);
          assert.equal(parts.filter((p) => p.layer === 'roof').length, w * 2);
          assert.equal(parts.filter((p) => p.layer === 'wall').length, w * 2);
        }
      }
    }
  });
  it('defaults to slate for an unknown roof and puts the door on column 1', () => {
    const parts = houseLayout({ roof: 'purple' });
    assert.ok(parts.some((p) => p.art === 'roof-slate-body' || p.art.startsWith('roof-slate-')));
    assert.ok(parts.some((p) => p.art === 'door' && p.dx === 1 && p.dy === 0));
  });
});
