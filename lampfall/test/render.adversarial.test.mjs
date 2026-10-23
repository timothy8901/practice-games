// Adversarial tests for js/render/* (the verifier's pass): the grade warm-up state machine, light caps
// through a whole frame, the Lantern's pool size, y-sort against trees, wading, emote bubbles above
// everything, the animated-frame atlas overflow, chunk-cache bounds over a day sweep, the Skyband's
// comet / moon / sun separation, stars under cloud, the needle and moon phase, weather particle caps,
// and the light selector's stable arrays.
// Run: node --test test/render.adversarial.test.mjs
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeCanvas, createFakeCanvas } from './fixtures/render.fakeCanvas.mjs';
import { lutKey, createMapRenderer } from '../js/render/mapRenderer.js';
import { createTileRenderer, chunkKey, gradeIndex, CHUNK_TILES, TIDE_INDEX, TIDE_CANON } from '../js/render/tileRenderer.js';
import { createEntityRenderer, WADE_CUT } from '../js/render/entityRenderer.js';
import { selectLights, createWeather, MAX_LIGHTS, MAX_LIGHTS_LOW_POWER, WEATHER_PARTICLE_CAP } from '../js/render/lightPass.js';
import { drawSkyband, sunPos, moonPos, cometLayout, moonPhase, skyLayout, SKYBAND_H, TIDE_DIAL_RECT } from '../js/render/sky.js';
import { gradeFor, shadowFor } from '../js/world/lighting.js';
import { loadMap } from '../js/world/tilemap.js';
import { createEntities, createEntity } from '../js/world/entities.js';
import { createCamera } from '../js/world/camera.js';
import { createFX } from '../js/core/fx.js';
import { getSprite, artDef } from '../js/art/atlas.js';
import { UI } from '../js/art/palette.js';
import { TILES, DEFAULT_LEGEND } from '../js/data/tilesets.js';
import '../js/art/chars/index.js';
import { HARBOR_RENDER, EXTRA_TILES } from './fixtures/maps/harbor-render.js';

before(() => installFakeCanvas());

const harbor = (def = HARBOR_RENDER) => loadMap(def, { ...TILES, ...EXTRA_TILES }, { legend: DEFAULT_LEGEND });

function scene(minute, extra = {}, def) {
  const map = harbor(def);
  const ents = createEntities(map);
  const player = ents.add(createEntity({ id: 'player', kind: 'player', x: 12, y: 14, artId: 'char-player' }));
  const camera = createCamera({ w: 480, h: 230 });
  camera.bounds(map);
  camera.follow(player, { snap: true });
  const ctx = createFakeCanvas(480, 270).getContext('2d');
  return { map, ents, player, camera, ctx, view: { ctx, map, entities: ents, camera, minute, weather: 'clear', tide: 0.05, time: 1000, player, flags: {}, ...extra } };
}

/** A copy of the harbor MapDef with rows of one layer edited. */
function editDef(layer, edits) {
  const rows = HARBOR_RENDER[layer].map((r) => r.split(''));
  for (const [x, y, ch] of edits) rows[y][x] = ch;
  return { ...HARBOR_RENDER, [layer]: rows.map((r) => r.join('')) };
}

describe('grade warm-up state machine', () => {
  it('a grade whose warm-up finished, then was abandoned, warms again after a flags change (no crash)', () => {
    // budget large enough that a pump bakes every queued chunk and a warm-up finishes in one call
    const s = scene(12 * 60);
    const r = createMapRenderer({ budgetMs: 1e6 });
    const A = 12 * 60, B = 22 * 60;
    const frame = () => { s.view.time += 16; return r.drawFrame(null, s.view); };
    assert.equal(frame().grade, lutKey(A).id);
    s.view.minute = B;
    frame(); // queues + bakes B
    frame(); // B ready: warm-up runs to the end (still showing A)
    s.view.minute = A; // abandon B before the switch
    frame();
    s.view.flags = { porch: true }; // a new flags object: every bake is dropped (a porch lit)
    frame(); // A baked synchronously after the flags change
    s.view.minute = B;
    let g = '';
    for (let i = 0; i < 20 && g !== lutKey(B).id; i++) g = frame().grade;
    assert.equal(g, lutKey(B).id, 'switches to B again');
  });
  it('flipping between two grades every frame never shows a patchwork and settles on the last', () => {
    const s = scene(12 * 60);
    const r = createMapRenderer({ budgetMs: 0.5 });
    const ids = new Set([lutKey(720).id, lutKey(1320).id]);
    for (let i = 0; i < 60; i++) {
      s.view.minute = i % 2 ? 1320 : 720;
      s.view.time += 16;
      assert.ok(ids.has(r.drawFrame(null, s.view).grade));
    }
    s.view.minute = 1320;
    let g = '';
    for (let i = 0; i < 400 && g !== lutKey(1320).id; i++) { s.view.time += 16; g = r.drawFrame(null, s.view).grade; }
    assert.equal(g, lutKey(1320).id);
  });
  it('a grade change spreads its bakes over frames (no frame bakes the whole new set)', () => {
    const s = scene(12 * 60);
    const r = createMapRenderer({ budgetMs: 0.001 });
    for (let i = 0; i < 30; i++) { s.view.time += 16; r.drawFrame(null, s.view); }
    s.view.minute = 22 * 60;
    let maxBakes = 0, frames = 0, g = '';
    while (g !== lutKey(1320).id && frames++ < 500) { s.view.time += 16; const st = r.drawFrame(null, s.view); maxBakes = Math.max(maxBakes, st.bakes); g = st.grade; }
    assert.equal(g, lutKey(1320).id);
    assert.ok(maxBakes <= 2, `at most a bake or two per frame at a tiny budget (saw ${maxBakes})`);
    assert.ok(frames > 5, 'spread over frames');
  });
});

describe('light pools through a whole frame', () => {
  // forty lamp posts across the visible street at night
  const lamps = [];
  for (let y = 15; y <= 17; y++) for (let x = 1; x <= 27; x += 2) lamps.push([x, y, 'L']);
  const def = editDef('detail', lamps);
  it('never draws more than 16 pools (8 in low power)', () => {
    const s = scene(22 * 60, {}, def);
    const r = createMapRenderer();
    const st = r.drawFrame(null, s.view);
    assert.equal(st.lights, MAX_LIGHTS);
    s.view.lowPower = true;
    assert.equal(r.drawFrame(null, s.view).lights, MAX_LIGHTS_LOW_POWER);
  });
  it('a tint disc and an additive disc per pool: pool draws stay bounded', () => {
    const s = scene(22 * 60, {}, def);
    const r = createMapRenderer();
    r.drawFrame(null, s.view);
    s.ctx.calls.length = 0;
    let mode = 'source-over', multiply = 0;
    const orig = s.ctx.drawImage;
    s.ctx.drawImage = function (...a) { if (this.globalCompositeOperation === 'multiply') multiply++; return orig.apply(this, a); };
    r.drawFrame(null, s.view);
    void mode;
    assert.ok(multiply <= MAX_LIGHTS, `${multiply} tint draws`);
  });
  it('the Lantern keeps its full pool even when cell (0, 0) holds string lights (scaled 0.35)', () => {
    const def2 = editDef('overlay', [[0, 0, 'd']]);
    const s = scene(23 * 60, { lantern: true }, def2);
    const r = createMapRenderer();
    r.drawFrame(null, s.view);
    s.ctx.calls.length = 0;
    r.drawFrame(null, s.view);
    // the Lantern: radius 44, pool scale [1, 0.62] -> an 89 px wide disc
    assert.ok(s.ctx.calls.some((c) => c[0] === 'drawImage' && c[1] && c[1].width === 89), 'an 89 px Lantern disc');
  });
});

describe('sprites', () => {
  const findTree = (r) => r.tiles.objects.find((o) => o.x === 21 && o.y === 13);
  function drawWith(entities, minute = 12 * 60, tide = 0.05) {
    const s = scene(minute, { tide });
    s.view.entities = entities;
    const r = createMapRenderer();
    r.drawFrame(null, s.view);
    s.ctx.calls.length = 0;
    s.view.time += 16;
    r.drawFrame(null, s.view);
    return { s, r };
  }
  const npc = (x, y, extra = {}) => createEntity({ id: `n${x}-${y}`, kind: 'npc', x, y, artId: 'char-wren', npcId: 'wren', ...extra });
  const indexOfCanvas = (calls, canvases) => calls.findIndex((c) => c[0] === 'drawImage' && canvases.includes(c[1]));
  const framesOf = (art, g) => artDef(art).frames.map((_, f) => getSprite(art, { frame: f, grade: g }).canvas);

  it('an entity north of a tree draws before it (hidden by the canopy); south of it, after', () => {
    for (const [y, before] of [[12, true], [14, false]]) {
      const e = npc(21, y);
      const { s, r } = drawWith([e]);
      const tree = findTree(r);
      assert.ok(tree, 'the alder at 21,13');
      const g = gradeFor(12 * 60);
      // the alder sways (any of its frames); the idle character faces down (frame 0)
      const ti = indexOfCanvas(s.ctx.calls, framesOf(tree.art, g)), ci = indexOfCanvas(s.ctx.calls, framesOf('char-wren', g));
      assert.ok(ti >= 0 && ci >= 0, 'both drawn');
      assert.equal(ci < ti, before, `entity at row ${y}`);
    }
  });
  it('a wader is cut at the feet (anchor row) with a ripple, even without step state', () => {
    // the flats flood at high tide; a bare entity record with no fromX / t still wades
    const bare = { id: 'bare', kind: 'npc', x: 30, y: 8, px: 30 * 16, py: 8 * 16, facing: 'down', artId: 'char-wren', npcId: 'wren' };
    const { s } = drawWith([bare], 12 * 60, 0.95);
    const def = artDef('char-wren');
    const cut = s.ctx.calls.find((c) => c[0] === 'drawImage' && c.length === 10 && c[4] === def.w && c[5] === def.anchor.y + 1 - WADE_CUT);
    assert.ok(cut, 'a 9-argument source-rect draw of the wading sprite');
  });
  it('emote bubbles draw after every sprite, pool and fog band (HUD, never behind a tree)', () => {
    const e = npc(21, 12, { emote: '!' });
    const { s } = drawWith([e], 22 * 60);
    const draws = s.ctx.calls.filter((c) => c[0] === 'drawImage');
    const bubble = draws.findIndex((c) => c[1] && c[1].width === 13 && c[1].height === 13);
    assert.ok(bubble >= 0, 'the bubble is drawn');
    // everything after the bubble belongs to the Skyband (top 40 px)
    for (const c of draws.slice(bubble + 1)) {
      const y = c.length >= 10 ? c[7] : c[3];
      assert.ok(y < SKYBAND_H, `draw after the bubble at y ${y}`);
    }
  });
  it('the entity renderer queues no bubble for an entity without an emote and resets per draw', () => {
    const er = createEntityRenderer();
    const ctx = createFakeCanvas(480, 270).getContext('2d');
    const g = gradeFor(720);
    const opt = { grade: g, ms: 0, tide: 'mid', shadow: shadowFor(720, g), analysis: null, flags: null, lighthouse: {}, cond: null };
    const e = { id: 'a', kind: 'npc', x: 2, y: 2, px: 32, py: 32, facing: 'down', artId: 'char-wren', emote: 'heart' };
    er.draw(ctx, [], [e], { x: 0, y: 40, w: 480, h: 230 }, 0, 0, opt);
    assert.equal(er.drawEmotes(ctx), 1);
    e.emote = null;
    er.draw(ctx, [], [e], { x: 0, y: 40, w: 480, h: 230 }, 0, 0, opt);
    assert.equal(er.drawEmotes(ctx), 0);
  });
});

describe('animated-frame atlas overflow', () => {
  it('a full atlas rolls over instead of clearing slots that baked chunks still point at', () => {
    const map = harbor();
    // a 16 px tall atlas holds 32 frames: the harbor's water forces several roll-overs
    const t = createTileRenderer({ atlasH: 16 });
    t.setMap(map);
    const g = gradeFor(720);
    const rect = { x: 0, y: 0, w: map.w * 16, h: map.h * 16 };
    t.bakeNow(rect, 0, 0, 'mid', g);
    const A = t.analysis();
    let entries = 0;
    for (let cy = 0; cy < A.chunksY; cy++) for (let cx = 0; cx < A.chunksX; cx++) {
      const c = cy * A.chunksX + cx;
      const ch = t.cache.peek(chunkKey(c, 0, A.tideSensitive[c] ? TIDE_INDEX.mid : TIDE_CANON, gradeIndex(g)));
      if (!ch) continue;
      const valid = new Set(ch.atlas.slots.values());
      for (const e of ch.anim) {
        for (const fr of [e.base, ...e.edges.map((x) => x.frames)]) {
          if (!fr) continue;
          for (const s of fr) { entries++; assert.ok(valid.has(s), `slot ${s} lives in the chunk's own atlas`); }
        }
        assert.ok(ch.atlas.n <= 32, 'never past capacity');
      }
    }
    assert.ok(entries > 32, `enough animated frames to overflow one atlas (${entries})`);
    const atlases = new Set();
    for (let c = 0; c < A.chunksX * A.chunksY; c++) {
      const ch = t.cache.peek(chunkKey(c, 0, A.tideSensitive[c] ? TIDE_INDEX.mid : TIDE_CANON, gradeIndex(g)));
      if (ch && ch.anim.length) atlases.add(ch.atlas);
    }
    assert.ok(atlases.size > 1, `rolled over (${atlases.size} atlases)`);
  });
});

describe('chunk cache bounds over a day sweep', () => {
  it('chunks and (grade, tide) combinations stay capped and the shown grade keeps up', () => {
    const s = scene(0);
    // an unbounded bake budget makes the lag deterministic (machine speed out of the picture): it then
    // measures only the state machine (request -> bake -> warm -> switch); spreading is tested above
    const r = createMapRenderer({ budgetMs: 1e6 });
    const W = ['clear', 'rain', 'fog', 'snow', 'storm', 'overcast'];
    let maxLag = 0, lag = 0;
    const target = { px: 0, py: 0 };
    for (let f = 0; f < 1440 * 2; f++) {
      s.view.minute = (f / 2) % 1440; // a day in 2880 frames
      s.view.weather = W[Math.floor(f / 480) % W.length];
      s.view.tide = [0.05, 0.5, 0.95][Math.floor(f / 300) % 3];
      // walk the camera east and back across the map
      target.px = Math.round((Math.sin(f / 300) * 0.5 + 0.5) * (s.map.w * 16 - 1));
      target.py = Math.round((Math.cos(f / 410) * 0.5 + 0.5) * (s.map.h * 16 - 1));
      s.camera.follow(target, { snap: true });
      s.view.time += 16;
      const st = r.drawFrame(null, s.view);
      const ts = r.tiles.stats();
      assert.ok(ts.size <= 240, `chunks ${ts.size}`);
      assert.ok(ts.combos <= 8, `combos ${ts.combos}`);
      assert.ok(ts.atlases <= 6, `atlases ${ts.atlases}`);
      if (st.grade !== lutKey(s.view.minute, s.view.weather).id) maxLag = Math.max(maxLag, ++lag); else lag = 0;
    }
    assert.ok(maxLag <= 3, `the shown grade lagged ${maxLag} frames at most`);
  });
});

describe('the Skyband', () => {
  const BAND = { x: 0, y: 0, w: 480, h: SKYBAND_H };
  const L = skyLayout(BAND);
  const sky = { x: 0, y: 0, w: 480, h: L.skyRows };
  const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  it('the comet (sprite and tail) never overlaps the sun or the moon, at any minute or season', () => {
    for (const p of [0.05, 0.35, 0.7, 1]) {
      const C = cometLayout(p, sky);
      // the 24x8 sprite at (x - 17, y), and the dithered tail from the head up-left: x - k, y + 3 - k/5 (+-1)
      const comet = { x0: Math.min(C.x - 17, C.x - C.tail), x1: C.x + 8, y0: C.y + 2 - Math.floor(C.tail / 5), y1: C.y + 8 };
      assert.ok(comet.x1 <= TIDE_DIAL_RECT.x, 'left of the tide dial');
      for (let m = 0; m < 1440; m += 5) {
        for (const pos of [sunPos(m, sky), moonPos(m, sky)]) {
          if (!pos.visible) continue;
          const disc = { x0: pos.x - 5, x1: pos.x + 6, y0: pos.y - 5, y1: pos.y + 6 };
          assert.ok(!overlap(comet, disc), `minute ${m}, progress ${p}: comet ${JSON.stringify(comet)} vs ${JSON.stringify(disc)}`);
        }
      }
    }
  });
  function sky1(o) {
    const ctx = createFakeCanvas(480, 40).getContext('2d');
    drawSkyband(ctx, BAND, { minute: 22 * 60, ms: 5000, day: 9, comet: 0.5, ...o });
    return ctx.calls;
  }
  it('no stars or comet through rain, storm, fog or snow cloud; a few stars through overcast', () => {
    const stars = (calls) => calls.filter((c) => c[0] === 'fillRect' && (c[1] === UI.skyHaze || c[1] === UI.cream) && c[5] === 1 && c[6] === 1).length;
    const clear = stars(sky1({ weather: 'clear' }));
    assert.ok(clear > 20, `${clear} stars on a clear night`);
    for (const w of ['rain', 'storm', 'fog', 'snow']) assert.equal(stars(sky1({ weather: w })), 0, w);
    const comet = getSprite('sky-comet').canvas;
    assert.ok(sky1({ weather: 'clear' }).some((c) => c[0] === 'drawImage' && c[1] === comet), 'the comet on a clear night');
    for (const w of ['rain', 'storm', 'fog', 'snow']) assert.ok(!sky1({ weather: w }).some((c) => c[0] === 'drawImage' && c[1] === comet), `no comet through ${w}`);
    const over = stars(sky1({ weather: 'overcast' }));
    assert.ok(over > 0 && over < clear, `overcast ${over}`);
  });
  it('the needle reads the tide (0 low .. 8 high) and the moon shows the day\'s phase', () => {
    for (const [tide, step] of [[0, 0], [0.5, 4], [1, 8], [2, 8], [-1, 0]]) {
      const calls = sky1({ tide });
      const needle = getSprite('sky-tide-needle', step).canvas;
      assert.ok(calls.some((c) => c[0] === 'drawImage' && c[1] === needle), `tide ${tide} -> needle ${step}`);
    }
    for (const day of [1, 8, 15, 23]) {
      const calls = sky1({ day, weather: 'clear', minute: 23 * 60 });
      const moon = getSprite('sky-moon', moonPhase(day)).canvas;
      assert.ok(calls.some((c) => c[0] === 'drawImage' && c[1] === moon), `day ${day}`);
    }
    assert.equal(moonPhase(14.75), 4, 'full moon mid-cycle');
    assert.ok(!sky1({ tideDial: false, tide: 0.5 }).some((c) => c[0] === 'drawImage' && c[1] === getSprite('sky-tide-dial').canvas), 'tideDial: false hides it');
  });
});

describe('weather particle caps (§12: <= 200 on screen)', () => {
  for (const w of ['rain', 'storm', 'snow']) {
    it(`${w} stays under the cap at steady state`, () => {
      const fx = createFX({ seed: 'cap', width: 480, height: 270, maxParticles: 600 });
      const weather = createWeather(fx);
      const g = gradeFor(22 * 60, w);
      const o = { weather: w, grade: g, zones: [], view: { x: 0, y: 0, w: 480, h: 230 }, rect: { x: 0, y: 40, w: 480, h: 230 } };
      let max = 0;
      for (let i = 0; i < 60 * 15; i++) { weather.update(o); fx.update(1000 / 60); if (i > 600) max = Math.max(max, fx.particleCount); }
      assert.ok(max > 0 && max <= WEATHER_PARTICLE_CAP, `${w}: ${max} particles`);
    });
  }
});

describe('selectLights arrays', () => {
  it('sorts hundreds of candidates by class then distance and keeps `out` at a stable length', () => {
    const lights = [];
    for (let i = 0; i < 300; i++) lights.push({ kind: i % 7 === 0 ? 'fire' : 'window', px: (i * 37) % 480, py: (i * 53) % 230, radius: 20, intensity: 1 });
    const out = [];
    const view = { x: 0, y: 0, w: 480, h: 230 };
    selectLights(lights, view, { out });
    assert.equal(out.length, MAX_LIGHTS);
    const fires = lights.filter((l) => l.kind === 'fire').length;
    assert.ok(out.every((l, i) => i >= Math.min(fires, MAX_LIGHTS) || l.kind === 'fire'), 'fires first');
    const d = (l) => (l.px - 240) ** 2 + (l.py - 115) ** 2;
    for (let i = 1; i < out.length; i++) if (out[i].kind === out[i - 1].kind) assert.ok(d(out[i - 1]) <= d(out[i]), 'nearest first within a class');
    const first = out[0];
    selectLights(lights, view, { out });
    assert.equal(out.length, MAX_LIGHTS);
    assert.equal(out[0], first, 'deterministic');
    selectLights([], view, { out });
    assert.equal(out.length, 0);
  });
});

void CHUNK_TILES;
