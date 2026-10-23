// A determinism digest of the SYS-GATHER / SYS-WORLD lane for one seed: placement (cracks, the
// Glint, sparkles, skyglass), the stateful streams (fish shadows and a cast plan, step encounters,
// bugs, cockles) and a few days of verbs. test/sysGatherWorld.adversarial.test.mjs computes it in
// process and in a child `node` process and compares the two JSON strings.
import { makeRng } from '../../js/core/rng.js';
import * as G from '../../js/systems/gather.js';
import * as F from '../../js/systems/fishing.js';
import * as E from '../../js/systems/encounter.js';
import { DATA, TOWN, ISLE, makeWorld, at } from './gatherLane.fixture.mjs';

/**
 * @param {string} seedCode
 * @returns {object} plain JSON-able digest
 */
export function digest(seedCode) {
  const w = makeWorld({ seed: seedCode, total: at(1, 6) });
  const base = (extra = {}) => ({ data: DATA, lead: null, tideOffset: 0, ...extra });
  const master = G.planRng(w);
  const out = { cracks: [], glints: [], sparkles: [], skyglass: [], shadows: null, cast: null, steps: [], bugs: [], cockles: [], digs: [] };
  for (let d = 0; d < 4; d++) {
    out.cracks.push(G.cracksFor(w, TOWN, master, base({ day: d })).map((c) => [c.x, c.y, c.findId]));
    const g = G.glintFor(w, TOWN, master, base({ day: d }));
    out.glints.push([g.x, g.y, g.amount]);
  }
  for (let k = 0; k < 6; k++) {
    out.sparkles.push(G.sparklesFor(w, TOWN, master, k, base()).map((s) => [s.x, s.y, s.findId]));
    out.skyglass.push(G.skyglassFor(w, TOWN, master, k, base()).map((s) => [s.x, s.y, s.findId]));
  }
  const fish = makeRng(w.run.seed).fork(F.streamLabel('r-river'));
  const view = F.reachShadows(w, TOWN, 'r-river', fish, base({ total: at(1, 12) }));
  out.shadows = view.shadows.map((s) => [s.fishId, s.size, s.x, s.y, s.silhouette]);
  const s = F.cast(w, TOWN, 'r-river', view.shadows, null, fish, base({ total: at(1, 12) }));
  out.cast = [s.shadow.id, s.plan.arrive, s.plan.feints, s.plan.biteAt, s.plan.biteWindow];
  const enc = makeRng(w.run.seed).fork(E.streamLabel('isle-map'));
  for (let i = 0; i < 400; i++) {
    const r = E.rollStep(w, ISLE, enc, base({ x: 1, y: 1, total: at(1, 12) + i * 7, tideState: 'rising' }));
    if (r) out.steps.push([i, r.speciesId, r.level, r.errant]);
  }
  const loot = makeRng(w.run.seed).fork('loot');
  const spots = Array.from({ length: 20 }, (_, i) => ({ x: i, y: 3, lit: i % 3 === 0 }));
  out.bugs = G.rollBugs(w, TOWN, spots, loot, base({ total: at(1, 23) })).map((b) => [b.id, b.x, b.lit]);
  const li = G.lowInfo(w, base({ total: 4 * 745 }));
  for (let x = 0; x < 6; x++) {
    const r = G.rakeCockles(w, TOWN, x, 20, loot, base({ total: li.lowTotal }));
    out.cockles.push(r.ok ? r.n : r.reason);
  }
  for (const c of G.cracksFor(w, TOWN, master, base({ total: at(2, 9) }))) {
    out.digs.push(G.dig(w, TOWN, c.x, c.y, master, base({ total: at(2, 9) })).findId);
  }
  out.state = [fish.state(), enc.state(), loot.state(), w.encounter.steps];
  return out;
}
