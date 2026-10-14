/*
 * UNDERBYTE — test/world.cjs
 * World data test: (a) a STATIC validator that loads js/world.js in Node (no browser) and
 * proves the room graph, (b) a Playwright pass that warps to every exit of every room.
 *
 * Run:  node underbyte/test/world.cjs            (static + Playwright; exit code 0 = all PASS)
 *       node underbyte/test/world.cjs --static   (static checks only)
 *
 * Static: every tilemap row has `w` chars and matches DESIGN.md §6 byte for byte; the three
 * debug rooms are unchanged (SHA-1); every exit's target room+exit exists, sits on the
 * opposite edge with an equal opening, points back, and its arrival spawn hugs the opening;
 * every room has an exit; every placement (enemy, exit spawn, node, vendor, core, bit, boss
 * start/pickup, start) is on a non-solid tile; restore nodes stand on solid ground; top exits
 * have a launch pad; and a BFS over the room graph from the start room proves boss 1 is
 * reachable with no abilities, boss 2 with Echo Jump (double jump), boss 3 with + Burst Line
 * (dash), the final boss with + Grip Protocol (wall jump) and all three cores with every
 * ability — printing the critical path and the DESIGN §10.5 tier room sets.
 *
 * Playwright: warps to EVERY exit of EVERY real room (bosses pre-defeated so the pass does not
 * depend on the boss module), steps 60 frames, asserts the player is not embedded in solid
 * tiles and lands on ground within 120 more frames, checks movers/crumbles/pools/vendor/nodes/
 * cores/placed bits/boss trigger/locked hatch/backgrounds/props, screenshots six rooms (one per
 * zone + a boss arena) to test/shots/room-<id>.png and asserts no console errors.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const STATIC_ONLY = process.argv.indexOf('--static') >= 0;

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info) : ''));
}
function finish() {
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed' + (failed.length ? ' — FAILED: ' + failed.map(f => f.name).join(' | ') : ''));
  process.exit(failed.length ? 1 : 0);
}

// ============================================================================================
// (a) STATIC VALIDATOR
// ============================================================================================
function loadWorld() {
  const win = { UB: {} };
  global.window = win;
  new Function('window', fs.readFileSync(path.join(ROOT, 'js/util.js'), 'utf8'))(win);
  new Function('window', fs.readFileSync(path.join(ROOT, 'js/world.js'), 'utf8'))(win);
  return win.UB;
}
const DEBUG_SHA = {   // tilemaps of the engine skeleton's debug rooms (smoke.cjs depends on them)
  debug_room: 'cbde5654d5accd51a1967438515067ae466b02de',
  debug_room2: 'c81c7fc636bb1772d9ed02937b355101478b87cc',
  debug_boss: '6c4f582f9c2052ef48629217c98d435b6e4ab203',
};
const TIER_ROOMS = {   // DESIGN §10.5 machine-check table
  0: ['dc_wake', 'dc_fall', 'dc_cross', 'dc_shrine', 'dc_sentinel'],
  1: ['dc_loft', 'lw_hoist', 'lw_belts', 'lw_shaft', 'lw_rest', 'lw_weftyr', 'bv_sluice', 'bv_catwalk'],
  2: ['bv_cistern', 'bv_rest', 'bv_corrosant', 'ns_base'],
  3: ['ns_climb', 'ns_rest', 'ns_plunge', 'rw_gate', 'rw_rest', 'rw_throne'],
};

function staticChecks() {
  const UB = loadWorld();
  const W = UB.World, IDS = UB.IDS;
  const real = Object.keys(W.rooms).filter(id => !W.rooms[id].debug);
  const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  const solid = ch => ch === '#' || ch === 'c';
  const at = (r, x, y) => W.tileAt(r, x, y);

  // --- validate() + counts ---
  const errs = W.validate();
  check('static: UB.World.validate() returns []', errs.length === 0, errs);
  check('static: 23 real rooms (BRIEF: 20–24) in World.order', real.length === 23 && W.order.length === 23 && W.order.every(id => W.rooms[id] && !W.rooms[id].debug), { real: real.length, order: W.order.length });
  check('static: the five pinned zones exist with their own song, palette, lore and blurb', IDS.zones.every(z => W.zones[z] && W.zones[z].song === z && W.zones[z].palette && W.zones[z].lore.length > 40 && W.zones[z].blurb.length > 10 && W.zones[z].index === IDS.zones.indexOf(z) + 1));
  check('static: brinevault pools are acid, every other zone static', W.zones.brinevault.poolKind === 'acid' && IDS.zones.filter(z => z !== 'brinevault').every(z => W.zones[z].poolKind === 'static'));
  check('static: start is dc_wake (3,12) at node_dc_wake', W.start.room === 'dc_wake' && W.start.x === 3 && W.start.y === 12 && W.start.nodeId === 'node_dc_wake');
  for (const id in DEBUG_SHA) {
    const r = W.rooms[id];
    const sha = r ? crypto.createHash('sha1').update(r.tiles.join('\n')).digest('hex') : null;
    check('static: ' + id + ' kept (debug flag, tilemap byte-identical to the engine skeleton)', r && r.debug && sha === DEBUG_SHA[id], sha);
  }
  check('static: no real room links to a debug room', real.every(id => W.rooms[id].exits.every(e => !W.rooms[e.to.room].debug)));

  // --- tilemaps: row lengths + verbatim against DESIGN.md §6 ---
  let rowsOk = true, verbatimOk = true, verbatimInfo = [];
  for (const id of real) {
    const r = W.rooms[id];
    if (r.tiles.length !== r.h || r.tiles.some(row => row.length !== r.w)) rowsOk = false;
    const m = design.match(new RegExp('^### 6\\.\\d+ `' + id + '`[\\s\\S]*?```\\n([\\s\\S]*?)```', 'm'));
    const want = m ? m[1].replace(/\n$/, '').split('\n') : null;
    if (!want || want.join('\n') !== r.tiles.join('\n')) { verbatimOk = false; verbatimInfo.push(id); }
  }
  check('static: every row of every real room is exactly w chars and there are h rows', rowsOk);
  check('static: every real tilemap is byte-identical to its DESIGN.md §6 block', verbatimOk, verbatimInfo);
  check('static: the outer ring of every room is solid except at exit openings', real.every(id => {
    const r = W.rooms[id];
    const open = (x, y) => r.exits.some(e => x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h);
    for (let x = 0; x < r.w; x++) for (const y of [0, r.h - 1]) if (at(r, x, y) !== '#' && !open(x, y)) return false;
    for (let y = 0; y < r.h; y++) for (const x of [0, r.w - 1]) if (at(r, x, y) !== '#' && !open(x, y)) return false;
    return true;
  }));

  // --- exits ---
  const OPP = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
  let exitProblems = [], nExits = 0;
  for (const id of real) {
    const r = W.rooms[id];
    if (!r.exits.length) exitProblems.push(id + ': no exits');
    for (const e of r.exits) {
      nExits++;
      const tag = id + '.' + e.id;
      const t = W.rooms[e.to.room], te = t && W.exit(t, e.to.exit);
      if (!t || !te) { exitProblems.push(tag + ': target missing'); continue; }
      if (te.side !== OPP[e.side]) exitProblems.push(tag + ': target not on the opposite edge');
      if (te.w !== e.w || te.h !== e.h) exitProblems.push(tag + ': opening size differs');
      if (te.to.room !== id || te.to.exit !== e.id) exitProblems.push(tag + ': not reciprocal');
      if (e.side === 'left' && e.x !== 0) exitProblems.push(tag + ': left exit not at x=0');
      if (e.side === 'right' && e.x !== r.w - 1) exitProblems.push(tag + ': right exit not at x=w-1');
      if (e.side === 'top' && e.y !== 0) exitProblems.push(tag + ': top exit not at y=0');
      if (e.side === 'bottom' && e.y !== r.h - 1) exitProblems.push(tag + ': bottom exit not at y=h-1');
      // compatible arrival: the spawn hugs the opening (same rows / columns, 1–3 tiles in)
      const s = e.spawn;
      if (e.side === 'left' || e.side === 'right') {
        const dist = e.side === 'left' ? s.x : r.w - 1 - s.x;
        if (!(s.y >= e.y && s.y < e.y + e.h) || dist < 1 || dist > 3) exitProblems.push(tag + ': spawn ' + s.x + ',' + s.y + ' does not hug the opening');
        if (!solid(at(r, s.x, s.y + 1)) && at(r, s.x, s.y + 1) !== '-') exitProblems.push(tag + ': no footing under the arrival spawn');
      } else {
        if (!(s.x >= e.x && s.x < e.x + e.w) || (e.side === 'top' ? s.y !== 1 : s.y !== r.h - 1)) exitProblems.push(tag + ': spawn ' + s.x + ',' + s.y + ' does not sit in the opening');
      }
      if (e.side === 'top') { // DESIGN §5.5: a launch pad at row ≤ 4 inside the opening columns
        let pad = false;
        for (let x = e.x; x < e.x + e.w && !pad; x++) for (let y = 1; y <= 4 && !pad; y++) if (!solid(at(r, x, y)) && (solid(at(r, x, y + 1)) || at(r, x, y + 1) === '-')) pad = true;
        if (!pad) exitProblems.push(tag + ': no launch pad under the top exit');
      }
      for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) if (at(r, x, y) !== '.') exitProblems.push(tag + ': opening tile not air');
    }
  }
  check('static: every exit targets an existing exit on the opposite edge, reciprocal, equal opening, spawn hugging the opening', exitProblems.length === 0, exitProblems);
  check('static: 25 reciprocal exit pairs (50 exits), every room has at least one', nExits === 50 && real.every(id => W.rooms[id].exits.length > 0), nExits);

  // --- placements on empty tiles / footing ---
  const placeProblems = [];
  for (const id of real) {
    const r = W.rooms[id];
    const air = (x, y, what) => { if (x < 0 || y < 0 || x >= r.w || y >= r.h) placeProblems.push(id + ' ' + what + ' outside'); else if (solid(at(r, x, y))) placeProblems.push(id + ' ' + what + ' on a solid tile ' + x + ',' + y); };
    r.spawns.forEach((s, i) => { air(s.x, s.y, 'enemy ' + i + ' ' + s.type); if (IDS.groundEnemies.indexOf(s.type) >= 0 && !solid(at(r, s.x, s.y + 1)) && at(r, s.x, s.y + 1) !== '-') placeProblems.push(id + ' ' + s.type + ' has no footing at ' + s.x + ',' + s.y); });
    r.exits.forEach(e => air(e.spawn.x, e.spawn.y, 'exit ' + e.id + ' spawn'));
    r.nodes.forEach(n => { air(n.x, n.y, 'node ' + n.id); if (at(r, n.x, n.y + 1) !== '#') placeProblems.push(id + ' node ' + n.id + ' does not stand on solid ground'); });
    r.cores.forEach(c => air(c.x, c.y, 'core ' + c.id));
    r.bits.forEach(b => air(b.x, b.y, 'bit ' + b.x + ',' + b.y));
    if (r.vendor) { air(r.vendor.x, r.vendor.y, 'vendor'); if (at(r, r.vendor.x, r.vendor.y + 1) !== '#') placeProblems.push(id + ' vendor has no solid ground'); }
    if (r.start) air(r.start.x, r.start.y, 'start');
    if (r.boss) {
      air(r.boss.spawn.x, r.boss.spawn.y, 'boss spawn');
      if (r.boss.pickup) { air(r.boss.pickup.x, r.boss.pickup.y, 'boss pickup'); if (at(r, r.boss.pickup.x, r.boss.pickup.y + 1) !== '#') placeProblems.push(id + ' boss pickup has no solid ground'); }
      if (r.boss.spawn.x < r.boss.bounds[0] || r.boss.spawn.x > r.boss.bounds[1]) placeProblems.push(id + ' boss spawn outside the fight bounds');
      if (r.boss.id !== IDS.bossRooms[id]) placeProblems.push(id + ' boss id ' + r.boss.id + ' is not the pinned ' + IDS.bossRooms[id]);
    }
    r.platforms.forEach(p => { for (let k = 0; k < p.w; k++) { air(p.from.x + k, p.from.y, 'platform ' + p.id + ' from'); air(p.to.x + k, p.to.y, 'platform ' + p.id + ' to'); } });
  }
  check('static: every enemy/exit/node/vendor/core/bit/boss/start/platform placement is on an empty tile with the footing it needs', placeProblems.length === 0, placeProblems);
  const nodes = real.flatMap(id => W.rooms[id].nodes.map(n => id + ':' + n.id));
  check('static: 6 restore nodes, every zone has at least one', nodes.length === 6 && IDS.zones.every(z => real.some(id => W.rooms[id].zone === z && W.rooms[id].nodes.length)), nodes);
  check('static: the vendor stands in dc_shrine and rw_rest at (21,14)', ['dc_shrine', 'rw_rest'].every(id => W.rooms[id].vendor && W.rooms[id].vendor.x === 21 && W.rooms[id].vendor.y === 14) && real.filter(id => W.rooms[id].vendor).length === 2);
  const cores = real.flatMap(id => W.rooms[id].cores.map(c => c.id));
  check('static: three hidden cores (dc_loft, lw_belts, dc_fall)', cores.length === 3 && ['core_dc_loft', 'core_lw_belts', 'core_dc_fall'].every(c => cores.includes(c)), cores);
  let bitsTotal = 0;
  for (const id of real) for (const b of W.rooms[id].bits) bitsTotal += b.size === 'small' ? 1 : b.size === 'medium' ? 5 : 20;
  check('static: placed bits total 331 (DESIGN §9.4)', bitsTotal === 331, bitsTotal);
  const arenas = Object.keys(IDS.bossRooms);
  check('static: four arenas with pinned bosses, final flag only on rw_throne, pickups on the other three', arenas.every(id => W.rooms[id].boss && W.rooms[id].boss.id === IDS.bossRooms[id] && W.rooms[id].boss.final === (id === 'rw_throne') && (W.rooms[id].boss.final || !!W.rooms[id].boss.pickup)));
  check('static: bv_corrosant.B is the locked brine-crust hatch; every arena seals its entrance', W.rooms.bv_corrosant.boss.locked.indexOf('B') >= 0 && arenas.every(id => W.rooms[id].boss.seal.indexOf('L') >= 0));
  check('static: movers in lw_hoist (2), lw_belts (2), lw_shaft (1), ns_climb (1), nowhere else', ['lw_hoist', 'lw_belts'].every(id => W.rooms[id].platforms.length === 2) && W.rooms.lw_shaft.platforms.length === 1 && W.rooms.ns_climb.platforms.length === 1 && real.every(id => W.rooms[id].platforms.length === 0 || ['lw_hoist', 'lw_belts', 'lw_shaft', 'ns_climb'].includes(id)));
  const hazardChars = id => { const s = {}; for (const row of W.rooms[id].tiles) for (const ch of row) if ('^v~c-'.includes(ch)) s[ch] = (s[ch] || 0) + 1; return s; };
  const bySize = (id, ch) => hazardChars(id)[ch] || 0;
  check('static: hazard counts match DESIGN §6 (dc_fall 9^ 5v 6c · lw_hoist 7v 18~ · bv_cistern 27~ 4c · ns_climb 2^ 12~ 14c · ns_plunge 20v 23~ 6c)',
    bySize('dc_fall', '^') === 9 && bySize('dc_fall', 'v') === 5 && bySize('dc_fall', 'c') === 6 && bySize('lw_hoist', 'v') === 7 && bySize('lw_hoist', '~') === 18 &&
    bySize('bv_cistern', '~') === 27 && bySize('bv_cistern', 'c') === 4 && bySize('ns_climb', '^') === 2 && bySize('ns_climb', '~') === 12 && bySize('ns_climb', 'c') === 14 &&
    bySize('ns_plunge', 'v') === 20 && bySize('ns_plunge', '~') === 23 && bySize('ns_plunge', 'c') === 6,
    { dc_fall: hazardChars('dc_fall'), lw_hoist: hazardChars('lw_hoist'), bv_cistern: hazardChars('bv_cistern'), ns_climb: hazardChars('ns_climb'), ns_plunge: hazardChars('ns_plunge') });
  check('static: no map-grid rectangle overlaps between real rooms', (() => {
    for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
      const a = W.rooms[real[i]], b = W.rooms[real[j]], E = 0.01;
      if (a.gx + E < b.gx + b.gw && a.gx + a.gw > b.gx + E && a.gy + E < b.gy + b.gh && a.gy + a.gh > b.gy + E) return false;
    }
    return true;
  })());

  // --- BFS progression proof (DESIGN §10): an exit needs its `ability`; a `locked` exit needs
  // its boss beaten (reaching the arena with the tier's abilities counts as beating it); a core
  // needs its room plus the core's `ability`.
  const ABIL = ['echoJump', 'burstLine', 'gripProtocol'];
  const ARENA_FOR = { tallock: 'dc_sentinel', weftyr: 'lw_weftyr', corrosant: 'bv_corrosant', kernauth: 'rw_throne' };
  function bfs(abilities) {
    const has = a => !a || abilities.indexOf(a) >= 0;
    const parent = { [W.start.room]: null }, queue = [W.start.room], defeated = {};
    while (queue.length) {
      const id = queue.shift(), r = W.rooms[id];
      if (r.boss) defeated[r.boss.id] = true;
      for (const e of r.exits) {
        if (!has(e.ability)) continue;
        if (r.boss && r.boss.locked.indexOf(e.id) >= 0 && !defeated[r.boss.id]) continue;
        if (!(e.to.room in parent)) { parent[e.to.room] = id + '.' + e.id; queue.push(e.to.room); }
      }
    }
    return { reached: Object.keys(parent), parent, defeated };
  }
  function pathTo(parent, room) {
    const out = [];
    for (let cur = room; cur;) { const p = parent[cur]; out.unshift(p ? p.split('.')[0] + ' -' + p.split('.')[1] + '-> ' + cur : cur); cur = p ? p.split('.')[0] : null; }
    return out;
  }
  const tiers = [
    { n: 0, abilities: [], boss: 'tallock', label: 'no abilities' },
    { n: 1, abilities: ['echoJump'], boss: 'weftyr', label: 'Echo Jump (double jump)' },
    { n: 2, abilities: ['echoJump', 'burstLine'], boss: 'corrosant', label: '+ Burst Line (dash)' },
    { n: 3, abilities: ABIL, boss: 'kernauth', label: '+ Grip Protocol (wall jump)' },
  ];
  let expected = [];
  console.log('\n--- progression proof (BFS over the room graph from ' + W.start.room + ') ---');
  for (const t of tiers) {
    expected = expected.concat(TIER_ROOMS[t.n]);
    const res = bfs(t.abilities), arena = ARENA_FOR[t.boss];
    const reachedSorted = res.reached.slice().sort(), expSorted = expected.slice().sort();
    check('static: tier ' + t.n + ' (' + t.label + ') reaches exactly the DESIGN §10.5 room set (' + expected.length + ' rooms)', JSON.stringify(reachedSorted) === JSON.stringify(expSorted), { extra: reachedSorted.filter(x => !expSorted.includes(x)), missing: expSorted.filter(x => !reachedSorted.includes(x)) });
    check('static: tier ' + t.n + ' reaches boss ' + t.boss + ' (' + arena + ')' + (t.n < 3 ? ' and NOT the next arena' : ''), res.reached.includes(arena) && (t.n === 3 || !res.reached.includes(ARENA_FOR[tiers[t.n + 1].boss])));
    console.log('tier ' + t.n + ' [' + t.label + '] → ' + t.boss + ': ' + pathTo(res.parent, arena).join('\n    '));
    const coresNow = real.flatMap(id => W.rooms[id].cores.filter(c => res.reached.includes(id) && (!c.ability || t.abilities.includes(c.ability))).map(c => c.id));
    const wantCores = [[], ['core_dc_loft'], ['core_dc_loft', 'core_lw_belts'], ['core_dc_loft', 'core_lw_belts', 'core_dc_fall']][t.n];
    check('static: tier ' + t.n + ' cores reachable = ' + JSON.stringify(wantCores), JSON.stringify(coresNow.slice().sort()) === JSON.stringify(wantCores.slice().sort()), coresNow);
    if (t.n === 3) for (const id of real) for (const c of W.rooms[id].cores) console.log('core ' + c.id + ' (needs ' + c.ability + '): ' + pathTo(res.parent, id).join(' → '));
  }
  // Staged critical path (DESIGN §10.3): abilities are earned in order, so the route runs from each
  // arena to the next with only the abilities owned at that point (the loop shortcuts A/B/C are
  // what a BFS with every ability would take instead).
  function bfsFrom(start, abilities) {
    const has = a => !a || abilities.indexOf(a) >= 0;
    const parent = { [start]: null }, queue = [start], defeated = {};
    while (queue.length) {
      const id = queue.shift(), r = W.rooms[id];
      if (r.boss) defeated[r.boss.id] = true;
      for (const e of r.exits) {
        if (!has(e.ability) || (r.boss && r.boss.locked.indexOf(e.id) >= 0 && !defeated[r.boss.id])) continue;
        if (!(e.to.room in parent)) { parent[e.to.room] = id + '.' + e.id; queue.push(e.to.room); }
      }
    }
    return parent;
  }
  const stages = [[W.start.room, [], 'dc_sentinel'], ['dc_sentinel', ['echoJump'], 'lw_weftyr'], ['lw_weftyr', ['echoJump', 'burstLine'], 'bv_corrosant'], ['bv_corrosant', ABIL, 'rw_throne']];
  let critical = [];
  for (const [from, abil, to] of stages) {
    const seg = pathTo(bfsFrom(from, abil), to).map(s => s.indexOf('-> ') >= 0 ? s.split('-> ')[1] : s);
    critical = critical.concat(critical.length ? seg.slice(1) : seg);
  }
  const WANT_CRITICAL = ['dc_wake', 'dc_fall', 'dc_cross', 'dc_shrine', 'dc_sentinel', 'lw_hoist', 'lw_belts', 'lw_rest', 'lw_weftyr',
    'bv_sluice', 'bv_cistern', 'bv_rest', 'bv_corrosant', 'ns_base', 'ns_climb', 'ns_plunge', 'rw_gate', 'rw_rest', 'rw_throne'];
  console.log('critical path (staged, abilities in acquisition order): ' + critical.join(' → '));
  console.log('--- end proof ---\n');
  check('static: the staged critical path is DESIGN §10.3\'s room order (19 rooms; ns_rest is the optional node detour)', JSON.stringify(critical) === JSON.stringify(WANT_CRITICAL), critical);
  return W;
}

// ============================================================================================
// (b) PLAYWRIGHT PASS
// ============================================================================================
async function browserChecks() {
  const { launch } = require('./harness.cjs');
  const t = await launch();
  const page = t.page;
  const D = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('d', 'args', 'return (' + src + ')(d, ...args)'); return f(window.UB.debug, args); }, { src: fn.toString(), args });
  const G = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('g', 'UB', 'args', 'return (' + src + ')(g, UB, ...args)'); return f(window.UB.game, window.UB, args); }, { src: fn.toString(), args });
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = n => page.evaluate(n => window.UB.debug.step(n), n);
  const shotsDir = path.join(__dirname, 'shots');
  if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir);
  const shot = file => page.screenshot({ path: path.join(shotsDir, file) });
  const embedded = () => G(g => { const p = g.player, b = p.box({}); return UB.Entity.overlapsSolid(g.level, b.x, b.y, b.w, b.h); });
  // Playthrough-neutral setup: no pending lore card freezing the world, every zone seen.
  const quiet = () => G(g => { g.loreTimer = 0; g.loreZone = null; for (const z of UB.IDS.zones) if (g.save.loreSeen.indexOf(z) < 0) g.save.loreSeen.push(z); return true; });
  async function stepUntil(pred, max, chunk = 5) { let s = await state(); for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); } return s; }

  try {
    await page.evaluate(() => localStorage.removeItem('underbyte.save'));
    await page.reload(); await page.waitForTimeout(250);
    await D(d => d.pauseLogic(true));
    const boot = await page.evaluate(() => ({ errs: window.UB.debug.worldErrors(), rooms: window.UB.debug.rooms().length }));
    check('browser: world validates at boot, 26 rooms registered (23 + 3 debug)', boot.errs.length === 0 && boot.rooms === 26, boot);
    const hooks = await page.evaluate(() => ({ bg: !!(window.UB.Render.buildBackground && window.UB.Render.buildBackground.worldAware), tiles: !!(window.UB.Render.redrawTiles && window.UB.Render.redrawTiles.worldAware) }));
    check('browser: world background + prop painters are hooked into UB.Render', hooks.bg && hooks.tiles, hooks);

    // --- new game lands in dc_wake on the dais beside the node ---
    await D(d => d.newGame('tessik'));
    let s = await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    await quiet();
    await step(3); s = await state();
    check('browser: NEW GAME starts in dc_wake (driftcache) at (3,12), grounded', s.screen === 'play' && s.roomId === 'dc_wake' && s.zoneId === 'driftcache' && s.x === 105 && s.y === 390 && s.grounded, s);
    // the node stands two tiles right of the dais start: one step toward it shows ▲ REST
    await page.evaluate(() => { window.UB.debug.pressed('right', 15); window.UB.debug.step(20); }); s = await state();
    check('browser: one step right of the start tile reaches node_dc_wake (REST prompt)', s.nearNode === 'node_dc_wake' && s.prompt === 'REST' && s.roomId === 'dc_wake', { nearNode: s.nearNode, prompt: s.prompt, x: s.x });
    check('browser: dc_wake spawns its tutorial scuttlebit and three placed bits', s.enemies === 1 && s.pickups === 3, { enemies: s.enemies, pickups: s.pickups });

    // --- backgrounds: three 1280×720 layers per zone in the zone palette ---
    const bg = await page.evaluate(() => {
      const out = {};
      for (const z of window.UB.IDS.zones) {
        const b = window.UB.World.background(window.UB.World.zones[z]);
        const px = b.bg0.getContext('2d').getImageData(5, 5, 1, 1).data;
        const c1 = b.bg1.getContext('2d').getImageData(0, 0, 1280, 720).data; let n1 = 0; for (let i = 3; i < c1.length; i += 4 * 97) if (c1[i]) n1++;
        const c2 = b.bg2.getContext('2d').getImageData(0, 0, 1280, 720).data; let n2 = 0; for (let i = 3; i < c2.length; i += 4 * 97) if (c2[i]) n2++;
        out[z] = { size: [b.bg0.width, b.bg0.height, b.bg1.width, b.bg1.height, b.bg2.width, b.bg2.height], top: '#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join(''), want: window.UB.World.zones[z].palette.bg0, painted1: n1, painted2: n2 };
      }
      return out;
    });
    check('browser: every zone background is 3 × 1280×720, bg0 starts in palette.bg0, bg1/bg2 carry silhouettes', Object.keys(bg).every(z => bg[z].size.every((v, i) => v === (i & 1 ? 720 : 1280)) && bg[z].top === bg[z].want && bg[z].painted1 > 200 && bg[z].painted2 > 200), bg);
    // --- props: the B tile at dc_wake (14,13) has a drawn prop (opaque pixels) in the tile cache ---
    const prop = await G(g => { const c = g.level.tileCache.getContext('2d'), s = g.level.cacheScale; const d = c.getImageData(14 * 30 * s + 15 * s, 13 * 30 * s + 15 * s, 1, 1).data; return d[3]; });
    check('browser: zone props are drawn into the static tile layer (dc_wake rack at (14,13))', prop > 0, prop);

    // --- screenshots (one per zone + a boss arena), bosses alive ---
    const SHOTS = [['dc_cross', 'L', 40], ['lw_belts', 'L', 40], ['bv_cistern', 'R', 40], ['ns_climb', 'L', 40], ['rw_gate', 'T', 60]];
    for (const [room, exit, frames] of SHOTS) {
      await D((d, r, e) => d.warp(r, e), room, exit); await quiet(); await step(frames);
      await page.evaluate(() => window.UB.game.render(1));
      await shot('room-' + room + '.png');
      s = await state();
      check('browser: screenshot room-' + room + '.png (in ' + room + ', ' + s.zoneId + ')', s.roomId === room, s.roomId);
    }
    // boss arena with Tallock alive: crossing the threshold on arrival seals L and starts the intro
    await D(d => d.warp('dc_sentinel', 'L')); await quiet(); await step(2); s = await state();
    const sealed = await G(g => g.level.openings.find(o => o.id === 'L').sealed);
    check('browser: dc_sentinel holds Tallock; arriving inside the bounds seals L and starts the intro', s.boss && s.boss.id === 'tallock' && s.bossFight === 'intro' && sealed, { boss: s.boss, fight: s.bossFight, sealed });
    await step(180); await page.evaluate(() => window.UB.game.render(1)); await shot('room-dc_sentinel.png');
    s = await state();
    check('browser: screenshot room-dc_sentinel.png (fight running after the 150 f card)', s.bossFight === 'fight', s.bossFight);
    // locked hatch: bv_corrosant.B is solid from room entry while Corrosant lives, open after defeat
    await D(d => d.warp('bv_corrosant', 'B')); await quiet(); await step(1);
    // the engine seals the 1-tall opening row (row 23, x 42–44); the chute above it stays open air
    const crust = await G(g => ({ sealed: g.level.openings.find(o => o.id === 'B').sealed, mask: g.level.sealedMask[23 * g.level.w + 43], boss: g.boss ? g.boss.id : null }));
    await D(d => d.defeatBoss('corrosant')); await step(1);
    const crustAfter = await G(g => ({ sealed: g.level.openings.find(o => o.id === 'B').sealed, mask: g.level.sealedMask[23 * g.level.w + 43] }));
    check('browser: bv_corrosant.B brine crust is sealed on entry while Corrosant lives and unsealed on defeat', crust.sealed && crust.mask === 1 && crust.boss === 'corrosant' && !crustAfter.sealed && crustAfter.mask === 0, { crust, crustAfter });

    // --- pre-defeat every boss (abilities granted) so the exit sweep is independent of bosses.js ---
    for (const b of ['tallock', 'weftyr', 'corrosant', 'kernauth']) await D((d, id) => d.defeatBoss(id), b);
    await D(d => d.god(true));
    s = await state();
    check('browser: all four bosses recorded, three abilities granted for the sweep', s.bossesDefeated.length === 4 && s.abilities.echoJump && s.abilities.burstLine && s.abilities.gripProtocol, s.bossesDefeated);

    // --- the exit sweep: every exit of every real room ---
    const rooms = await page.evaluate(() => window.UB.World.order.map(id => { const r = window.UB.World.rooms[id]; return { id, exits: r.exits.map(e => ({ id: e.id, side: e.side, to: e.to })) }; }));
    const sweep = [];
    for (const room of rooms) {
      for (const e of room.exits) {
        let launched = true, padOk = true, emb0 = false;
        if (e.side === 'bottom') {
          // A bottom exit is only ever entered by leaving the room below through its top exit
          // (UB.debug.warp carries no `side`, so it cannot stage the chute launch itself). Do it
          // the real way: warp to the lower room's top-exit spawn, land on its launch pad (DESIGN
          // §5.5: footing at row ≤ 4), jump out through the opening, arrive here launched upward,
          // then steer left + Echo Jump out of the chute.
          await D((d, r, x) => d.warp(r, x), e.to.room, e.to.exit); await quiet();
          const pad = await stepUntil(x => x.grounded, 120, 2);
          padOk = pad.grounded && pad.roomId === e.to.room;
          await page.evaluate(() => window.UB.debug.pressed('jump', 20));
          const arr = await stepUntil(x => x.roomId === room.id && x.mode === 'normal' && !x.transition, 150, 1);
          launched = arr.roomId === room.id && arr.vy < 0;
          emb0 = await embedded();
          await page.evaluate(() => { window.UB.debug.pressed('left', 70); window.UB.debug.step(24); window.UB.debug.pressed('jump', 4); window.UB.debug.step(36); });
        } else {
          await D((d, r, x) => d.warp(r, x), room.id, e.id); await quiet();
          emb0 = await embedded();
          await step(60);
        }
        const emb60 = await embedded();
        const at60 = await state();
        const landed = await stepUntil(x => x.grounded, 120, 4);
        const emb = await embedded();
        const rec = { exit: room.id + '.' + e.id, side: e.side, embedded: emb0 || emb60 || emb, launched, padOk, grounded: landed.grounded, endRoom: landed.roomId, stayed: at60.roomId === room.id, y: landed.y };
        sweep.push(rec);
        check('sweep: ' + rec.exit + ' (' + e.side + ') → not embedded, grounded within 120 f' + (e.side === 'bottom' ? ' [entered from ' + e.to.room + '.' + e.to.exit + ' via its launch pad, chute launch]' : '') + (rec.endRoom !== room.id ? ' [fell through to ' + rec.endRoom + ']' : ''), !rec.embedded && rec.grounded && rec.launched && rec.padOk, rec);
      }
    }
    check('sweep: every side/top arrival stays in its room; every top exit has a working launch pad; every bottom arrival launches upward', sweep.filter(r => r.side !== 'bottom').every(r => r.stayed) && sweep.filter(r => r.side === 'bottom').every(r => r.launched && r.padOk), sweep.filter(r => (r.side !== 'bottom' && !r.stayed) || (r.side === 'bottom' && !(r.launched && r.padOk))));
    check('sweep: 50 exits visited', sweep.length === 50, sweep.length);

    // --- movers: present and moving in the four mover rooms ---
    for (const [room, n] of [['lw_hoist', 2], ['lw_belts', 2], ['lw_shaft', 1], ['ns_climb', 1]]) {
      await D((d, r) => d.warp(r, null), room); await quiet();
      const p0 = await G(g => g.level.platforms.map(p => [p.id, p.x, p.y]));
      await step(90);
      const p1 = await G(g => g.level.platforms.map(p => [p.id, p.x, p.y]));
      const moved = p0.every((p, i) => p[1] !== p1[i][1] || p[2] !== p1[i][2]);
      check('browser: ' + room + ' has ' + n + ' moving platform(s) that move', p0.length === n && moved, { p0, p1 });
    }
    // --- crumble: standing on dc_fall's (8..10, 31) planks shakes then drops them ---
    await D(d => d.warp('dc_fall', { x: 9 * 30 + 15, y: 31 * 30 })); await quiet(); await step(4);
    const cr0 = await G(g => ({ states: g.level.crumble.map(c => c.state), y: g.player.y, grounded: g.player.onGround }));
    await step(40);
    const cr1 = await G(g => ({ gone: g.level.gone[31 * g.level.w + 9], y: g.player.y }));
    check('browser: dc_fall crumble planks shake under the player, vanish, and the player falls', cr0.grounded && cr0.states.length >= 1 && cr1.gone === 1 && cr1.y > cr0.y, { cr0, cr1 });
    // --- pools: lw_hoist static pool costs a heart and respawns at the room entry ---
    await D(d => d.god(false)); await D(d => d.warp('lw_hoist', 'L')); await quiet(); await step(2);
    const entry = await state();
    await D(d => d.teleport(6 * 30 + 15, 34 * 30)); await step(3);
    const hz = await state();
    const back = await stepUntil(x => !x.hazardFreeze, 90, 2);
    check('browser: a static pool (lw_hoist) costs 1 heart, freezes, and respawns at the entry spawn', hz.hp === entry.hp - 1 && hz.hazardFreeze && back.x === entry.x && back.y === entry.y, { entry: [entry.x, entry.y, entry.hp], hz: [hz.hp, hz.hazardFreeze], back: [back.x, back.y] });
    await D(d => d.god(true));
    // --- vendor + nodes + cores + bits ---
    for (const room of ['dc_shrine', 'rw_rest']) {
      await D((d, r) => d.warp(r, { x: 21 * 30 + 15, y: 15 * 30 }), room); await quiet(); await step(2); s = await state();
      check('browser: Scrivvet trades in ' + room + ' at (21,14)', s.nearVendor && s.prompt === 'TRADE', { nearVendor: s.nearVendor, prompt: s.prompt });
    }
    for (const [room, node, x, y] of [['dc_shrine', 'node_dc_shrine', 9, 14], ['lw_rest', 'node_lw_rest', 15, 14], ['bv_rest', 'node_bv_rest', 15, 13], ['ns_rest', 'node_ns_rest', 15, 14], ['rw_rest', 'node_rw_rest', 9, 14]]) {
      await D((d, r, tx, ty) => d.warp(r, { x: tx * 30 + 15, y: (ty + 1) * 30 }), room, x, y); await quiet(); await step(2); s = await state();
      check('browser: ' + room + ' restore node ' + node + ' offers REST', s.nearNode === node && s.prompt === 'REST', { nearNode: s.nearNode, prompt: s.prompt });
    }
    for (const [room, exit] of [['dc_loft', 'B'], ['lw_belts', 'R'], ['dc_fall', 'L']]) {
      await D((d, r, e) => d.warp(r, e), room, exit); await quiet(); await step(1);
      const pk = await D(d => d.pickups());
      // placed bits are one-time: those the sweep already magnetised are in save.bitsCollected
      const want = await G((g, UB, r) => g.level.room.bits.filter(b => g.save.bitsCollected.indexOf(r + ':' + b.x + ',' + b.y) < 0).length, room);
      check('browser: ' + room + ' spawns its hidden core and its ' + want + ' uncollected placed bits', pk.filter(p => p.type === 'core').length === 1 && pk.filter(p => p.type === 'bit').length === want, pk);
    }
    // --- map: fractional grid positions render without error; zone change fires the toast ---
    await D(d => d.warp('ns_rest', 'R')); await quiet(); await step(2);
    await D(d => d.skipTo('map')); await step(2); await page.evaluate(() => window.UB.game.render(1)); s = await state();
    check('browser: the map overlay opens from a zone-4 room (fractional grid coords)', s.screen === 'map', s.screen);
    await D(d => d.skipTo('play')); await step(1);

    check('browser: no console errors or page errors', t.errors.length === 0, t.errors.slice(0, 10));
  } catch (e) {
    check('browser: test script threw', false, String(e && e.stack || e));
  } finally {
    await t.close();
  }
}

(async () => {
  staticChecks();
  if (!STATIC_ONLY) await browserChecks();
  finish();
})();
