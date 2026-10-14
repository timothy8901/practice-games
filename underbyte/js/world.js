/*
 * UNDERBYTE — js/world.js
 * Owner: WORLD implementer.
 * Contract: CONTRACT.md §4.3 (UB.World). Design: DESIGN.md §5 (zones, tile legend, props),
 * §6 (rooms — the tilemaps are embedded verbatim, never retyped), §9 (placed bits, vendor
 * tiles), §10 (progression: exit `ability` and core `ability` annotations), §11.1.5 (parallax
 * background recipes), §5.4 (zone prop catalogue).
 *
 * What lives here
 *   • The five zones: ids/index/name/blurb/lore/song/poolKind + the 10-key palette (§5.1).
 *   • The 23 real rooms (RoomSpec, CONTRACT §4.3) plus the three debug_* rooms the other
 *     modules' tests depend on (their tilemaps are byte-identical to the engine skeleton's;
 *     no real room links to them; they carry `debug: true`).
 *   • Pure data helpers (tileAt/exit/tilePx/spawnPx/findNode/zoneOf), normalize() and the deep
 *     validate() that main.js runs at boot.
 *   • Presentation data that is zone knowledge rather than engine knowledge, exposed as pure
 *     painters any renderer may call: UB.World.paintBackground / background(zone) (the three
 *     1280×720 parallax layers of §11.1.5, cached per zone) and UB.World.drawProp / drawProps
 *     (the §5.4 zone props drawn into the static tile layer). js/render.js owns the actual
 *     background cache and tile cache; it currently paints one generic silhouette set for
 *     every zone and a stub for `B` tiles, so installRenderHooks() wraps
 *     UB.Render.buildBackground / redrawTiles at boot (before main.js runs) to route them
 *     through these painters. The hooks are idempotent, keep every signature, and step aside
 *     the moment render.js grows its own `drawProps` or marks its functions `worldAware`.
 *
 * Coordinates: tile = 30 px, +y down, row 0 is the top row. A tile (tx, ty) covers pixels
 * [tx*30, tx*30+30) × [ty*30, ty*30+30). "Feet on tile (x,y)" means the body's bottom-centre
 * is at (x*30+15, (y+1)*30). Nothing here allocates per frame: the painters run once per zone
 * (backgrounds) or once per room load / partial tile redraw (props).
 */
'use strict';
(function (UB) {
  const TILE = 30;
  const U = UB.Util;
  const P = UB.Palette;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const BG_W = 1280, BG_H = 720;                   // layer size render.js tiles with (DESIGN §11.1.5)
  const hasDoc = typeof document !== 'undefined';   // the static validator loads this file in Node

  // --- tile legend (DESIGN.md §5.5) -----------------------------------------------
  const LEGEND = {
    '#': 'solid',      // solid on all four sides; clingable with Grip Protocol
    '-': 'oneway',     // solid from above only; Down+Jump drops through
    'c': 'crumble',    // solid until stood on: shake 20 f → gone 180 f → back
    '^': 'spike',      // floor spike hazard (pogo-able)
    'v': 'cspike',     // ceiling spike hazard (not pogo-able)
    '~': 'pool',       // hazard pool (acid in Brinevault, static elsewhere)
    '.': 'air',
    'B': 'prop',       // non-solid air with a zone prop drawn on it
  };

  const World = {
    TILE: TILE,
    LEGEND: LEGEND,
    BG_W: BG_W,
    BG_H: BG_H,
    zones: {},
    rooms: {},
    /** Where NEW GAME begins: feet on tile (x, y+1) of `room`; `nodeId` is the first respawn point. */
    start: { room: 'dc_wake', x: 3, y: 12, nodeId: 'node_dc_wake' },
    /** Real rooms in critical-path order (DESIGN §6 / DESIGN-SUMMARY) — for tests and the map. */
    order: ['dc_wake', 'dc_fall', 'dc_cross', 'dc_loft', 'dc_shrine', 'dc_sentinel',
      'lw_hoist', 'lw_belts', 'lw_shaft', 'lw_rest', 'lw_weftyr',
      'bv_sluice', 'bv_cistern', 'bv_catwalk', 'bv_rest', 'bv_corrosant',
      'ns_base', 'ns_climb', 'ns_rest', 'ns_plunge',
      'rw_gate', 'rw_rest', 'rw_throne'],
  };

  World.isSolid = function (ch) { return ch === '#' || ch === 'c'; };
  World.isOneWay = function (ch) { return ch === '-'; };
  World.isCrumble = function (ch) { return ch === 'c'; };
  World.isSpike = function (ch) { return ch === '^' || ch === 'v'; };
  World.isPool = function (ch) { return ch === '~'; };
  World.isHazard = function (ch) { return ch === '^' || ch === 'v' || ch === '~'; };
  World.isProp = function (ch) { return ch === 'B'; };

  /** Raw tile char of a room spec; '#' outside the map. (Runtime state such as
   *  vanished crumble tiles is handled by UB.Entity.tileAt(level, tx, ty).) */
  World.tileAt = function (room, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return '#';
    return room.tiles[ty][tx];
  };
  /** Exit spec by id, or null. */
  World.exit = function (room, id) {
    for (let i = 0; i < room.exits.length; i++) if (room.exits[i].id === id) return room.exits[i];
    return null;
  };
  /** Pixel bottom-centre for feet standing on top of tile row ty+1, i.e. "feet on tile (tx,ty)". */
  World.tilePx = function (tx, ty, out) {
    out = out || { x: 0, y: 0 };
    out.x = tx * TILE + TILE / 2; out.y = (ty + 1) * TILE;
    return out;
  };
  /** Node spec by id across all rooms → {room, node} or null. */
  World.findNode = function (nodeId) {
    for (const rid in World.rooms) {
      const r = World.rooms[rid];
      for (let i = 0; i < r.nodes.length; i++) if (r.nodes[i].id === nodeId) return { room: r, node: r.nodes[i] };
    }
    return null;
  };
  /**
   * Arrival position (pixel bottom-centre) for a room: exitId → that exit's
   * spawn tile; null → the room's `start`, else its first node, else its first
   * exit's spawn, else the room centre.
   */
  World.spawnPx = function (room, exitId, out) {
    out = out || { x: 0, y: 0 };
    if (exitId) {
      const ex = World.exit(room, exitId);
      if (ex) return World.tilePx(ex.spawn.x, ex.spawn.y, out);
    }
    if (room.start) return World.tilePx(room.start.x, room.start.y, out);
    if (room.nodes.length) return World.tilePx(room.nodes[0].x, room.nodes[0].y, out);
    if (room.exits.length) return World.tilePx(room.exits[0].spawn.x, room.exits[0].spawn.y, out);
    out.x = room.w * TILE / 2; out.y = room.h * TILE / 2;
    return out;
  };
  /** The zone spec of a room. (Also the earliest per-room-load call the engine makes into this
   *  module, so it doubles as the fallback moment to install the render hooks — once.) */
  World.zoneOf = function (room) {
    if (!hooksInstalled && hasDoc && UB.Render) World.installRenderHooks();
    return World.zones[room.zone];
  };
  /** Fill defaults so every room has every list (call after defining rooms). */
  World.normalize = function () {
    for (const id in World.rooms) {
      const r = World.rooms[id];
      r.id = id;
      r.w = r.w || r.tiles[0].length; r.h = r.h || r.tiles.length;
      r.exits = r.exits || []; r.spawns = r.spawns || []; r.platforms = r.platforms || [];
      r.nodes = r.nodes || []; r.cores = r.cores || []; r.bits = r.bits || [];
      r.vendor = r.vendor || null; r.boss = r.boss || null;
      r.name = r.name || id; r.intro = r.intro || '';
      if (r.gx === undefined) r.gx = 0; if (r.gy === undefined) r.gy = 0;
      r.gw = r.gw || r.w / 32; r.gh = r.gh || r.h / 18;
      for (let i = 0; i < r.exits.length; i++) {
        const e = r.exits[i];
        if (e.w === undefined) e.w = (e.side === 'left' || e.side === 'right') ? 1 : e.h;
        if (e.h === undefined) e.h = (e.side === 'top' || e.side === 'bottom') ? 1 : e.w;
        if (e.ability === undefined) e.ability = null;
      }
      // cores carry an informational `ability` (DESIGN §10.4: the ability the alcove needs) for the
      // progression proof in test/world.cjs; the engine ignores it.
      for (let i = 0; i < r.cores.length; i++) if (r.cores[i].ability === undefined) r.cores[i].ability = null;
      if (r.boss) {
        const b = r.boss;
        b.seal = b.seal || []; b.locked = b.locked || []; b.final = !!b.final;
        if (!b.bounds) b.bounds = [0, r.w - 1];
        // Fallback start tile: the middle of the fight bounds, feet on the first solid row
        // below the room's top. Real arenas pin `spawn` explicitly (CONTRACT §4.3).
        if (!b.spawn) {
          const tx = Math.floor((b.bounds[0] + b.bounds[1]) / 2);
          let ty = r.h - 2;
          for (let y = 1; y < r.h; y++) if (World.isSolid(World.tileAt(r, tx, y))) { ty = y - 1; break; }
          b.spawn = { x: tx, y: ty };
        }
      }
    }
  };

  /**
   * Validate the world data; returns an array of error strings (empty = OK). main.js runs
   * it at boot and console.warn()s every line; tests assert it returns []. Checks: zone
   * records, tile rows/chars, exits (edge placement, air openings, reciprocity, equal
   * openings, spawn footing, no real→debug links), spawns (known types/variants, inside,
   * footing for ground types), platforms, nodes, cores, bits, vendor, boss (pinned id per
   * arena, bounds, spawn/pickup footing, seal ids), start, unique ids and map-grid overlaps.
   */
  World.validate = function () {
    const errs = [];
    const IDS = UB.IDS;
    const OPP = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
    const nodeIds = Object.create(null), coreIds = Object.create(null);
    function inside(r, x, y) { return x >= 0 && y >= 0 && x < r.w && y < r.h; }
    function footing(r, x, y) { const ch = World.tileAt(r, x, y + 1); return ch === '#' || ch === 'c' || ch === '-'; }
    function air(r, x, y) { return !World.isSolid(World.tileAt(r, x, y)); }
    function listOf(arr, name, id) { return Array.isArray(arr) ? arr : (errs.push(id + ': ' + name + ' is not an array'), []); }

    for (const zid in World.zones) {
      const z = World.zones[zid];
      if (z.id !== zid) errs.push('zone ' + zid + ': id field is ' + z.id);
      if (!z.debug && IDS.zones.indexOf(zid) < 0) errs.push('zone ' + zid + ': not a pinned zone id');
      if (IDS.songs.indexOf(z.song) < 0) errs.push('zone ' + zid + ': unknown song ' + z.song);
      if (!z.palette) errs.push('zone ' + zid + ': no palette');
      else {
        const keys = ['bg0', 'bg1', 'bg2', 'tileFill', 'tileShade', 'tileEdge', 'fog', 'glow', 'hazard', 'accent'];
        for (let i = 0; i < keys.length; i++) if (typeof z.palette[keys[i]] !== 'string') errs.push('zone ' + zid + ': palette.' + keys[i] + ' missing');
      }
      if (typeof z.name !== 'string' || typeof z.blurb !== 'string') errs.push('zone ' + zid + ': name/blurb must be strings');
      if (typeof z.lore !== 'string') errs.push('zone ' + zid + ': lore must be a string');
      if (z.poolKind !== 'acid' && z.poolKind !== 'static') errs.push('zone ' + zid + ': poolKind must be acid|static');
      if (!(z.index >= 0 && z.index <= 5)) errs.push('zone ' + zid + ': bad index ' + z.index);
    }
    for (const zid of IDS.zones) if (!World.zones[zid] && Object.keys(World.rooms).some(function (k) { return !World.rooms[k].debug; })) errs.push('zone ' + zid + ': pinned zone missing');

    const ids = Object.keys(World.rooms);
    for (let ri = 0; ri < ids.length; ri++) {
      const id = ids[ri], r = World.rooms[id];
      const zone = World.zones[r.zone];
      if (!zone) errs.push(id + ': unknown zone ' + r.zone);
      else if (!r.debug && zone.debug) errs.push(id + ': real room in the debug zone');
      if (!Array.isArray(r.tiles) || r.tiles.length !== r.h) { errs.push(id + ': ' + (r.tiles ? r.tiles.length : 0) + ' rows, expected ' + r.h); continue; }
      for (let y = 0; y < r.tiles.length; y++) {
        if (r.tiles[y].length !== r.w) errs.push(id + ': row ' + y + ' has ' + r.tiles[y].length + ' chars, expected ' + r.w);
        for (let x = 0; x < r.tiles[y].length; x++) if (!(r.tiles[y][x] in LEGEND)) errs.push(id + ': bad tile "' + r.tiles[y][x] + '" at ' + x + ',' + y);
      }
      if (!(r.gw > 0 && r.gh > 0) || !isFinite(r.gx) || !isFinite(r.gy)) errs.push(id + ': bad map grid ' + r.gx + ',' + r.gy + ' ' + r.gw + 'x' + r.gh);
      // --- exits ---
      const exits = listOf(r.exits, 'exits', id), seenExit = Object.create(null);
      if (!r.debug && exits.length === 0) errs.push(id + ': no exits');
      for (let i = 0; i < exits.length; i++) {
        const e = exits[i], tag = id + '.' + e.id;
        if (seenExit[e.id]) errs.push(tag + ': duplicate exit id'); seenExit[e.id] = true;
        if (!OPP[e.side]) { errs.push(tag + ': bad side ' + e.side); continue; }
        if (e.ability !== null && IDS.abilities.indexOf(e.ability) < 0) errs.push(tag + ': unknown ability ' + e.ability);
        if (!(e.w >= 1 && e.h >= 1)) errs.push(tag + ': opening size ' + e.w + 'x' + e.h);
        if ((e.side === 'left' && e.x !== 0) || (e.side === 'right' && e.x !== r.w - 1) || (e.side === 'top' && e.y !== 0) || (e.side === 'bottom' && e.y !== r.h - 1)) {
          errs.push(tag + ': opening is not on the ' + e.side + ' edge (x ' + e.x + ', y ' + e.y + ')');
        }
        if ((e.side === 'left' || e.side === 'right') && e.w !== 1) errs.push(tag + ': side opening must be 1 tile wide');
        if ((e.side === 'top' || e.side === 'bottom') && e.h !== 1) errs.push(tag + ': top/bottom opening must be 1 tile tall');
        for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) {
          if (!inside(r, x, y)) errs.push(tag + ': opening tile ' + x + ',' + y + ' outside the room');
          else if (World.tileAt(r, x, y) !== '.') errs.push(tag + ': opening tile ' + x + ',' + y + ' is not air');
        }
        if (!e.spawn || !inside(r, e.spawn.x, e.spawn.y)) errs.push(tag + ': spawn tile missing or outside the room');
        else {
          if (!air(r, e.spawn.x, e.spawn.y)) errs.push(tag + ': spawn tile ' + e.spawn.x + ',' + e.spawn.y + ' is solid');
          if ((e.side === 'left' || e.side === 'right') && !footing(r, e.spawn.x, e.spawn.y)) errs.push(tag + ': no footing under spawn tile');
        }
        if (!e.to || !e.to.room) { errs.push(tag + ': no target'); continue; }
        const t = World.rooms[e.to.room];
        if (!t) { errs.push(tag + ': target room ' + e.to.room + ' missing'); continue; }
        if (!r.debug && t.debug) errs.push(tag + ': a real room links to the debug room ' + e.to.room);
        const te = World.exit(t, e.to.exit);
        if (!te) { errs.push(tag + ': target exit ' + e.to.room + '.' + e.to.exit + ' missing'); continue; }
        if (!te.to || te.to.room !== id || te.to.exit !== e.id) errs.push(tag + ': not reciprocal (' + e.to.room + '.' + e.to.exit + ' points to ' + (te.to ? te.to.room + '.' + te.to.exit : '?') + ')');
        if (te.side !== OPP[e.side]) errs.push(tag + ': target side ' + te.side + ' is not opposite ' + e.side);
        if (te.w !== e.w || te.h !== e.h) errs.push(tag + ': opening ' + e.w + 'x' + e.h + ' differs from the target opening ' + te.w + 'x' + te.h);
      }
      // --- enemy spawns ---
      const spawns = listOf(r.spawns, 'spawns', id);
      for (let i = 0; i < spawns.length; i++) {
        const s = spawns[i], tag = id + ' spawn ' + i + ' (' + s.type + ')';
        if (typeof s.type !== 'string') { errs.push(tag + ': type is not a string'); continue; }
        if (!r.debug && IDS.enemies.indexOf(s.type) < 0) errs.push(tag + ': unknown enemy type');
        if (!r.debug && (s.type === 'walker' || s.type === 'bossSegment' || s.type === 'mote')) errs.push(tag + ': placeholder/runtime-only enemy type in a real room');
        if (s.variant !== undefined && IDS.enemyVariants.indexOf(s.variant) < 0) errs.push(tag + ': unknown variant ' + s.variant);
        if (!inside(r, s.x, s.y)) { errs.push(tag + ': outside the room'); continue; }
        if (!air(r, s.x, s.y)) errs.push(tag + ': spawn tile ' + s.x + ',' + s.y + ' is solid');
        if (IDS.groundEnemies.indexOf(s.type) >= 0 && !footing(r, s.x, s.y)) errs.push(tag + ': no footing under ' + s.x + ',' + s.y);
        if (s.patrol && !(s.patrol.length === 2 && s.patrol[0] <= s.x && s.patrol[1] >= s.x && s.patrol[0] >= 0 && s.patrol[1] < r.w)) errs.push(tag + ': patrol ' + s.patrol + ' does not bracket x inside the room');
      }
      // --- moving platforms ---
      const plats = listOf(r.platforms, 'platforms', id);
      for (let i = 0; i < plats.length; i++) {
        const p = plats[i], tag = id + ' platform ' + (p.id || i);
        if (!p.from || !p.to || !(p.w >= 1) || !(p.speed > 0)) { errs.push(tag + ': needs from, to, w ≥ 1, speed > 0'); continue; }
        if (p.from.x < 0 || p.from.y < 0 || p.from.x + p.w > r.w || p.from.y >= r.h) errs.push(tag + ': from ' + p.from.x + ',' + p.from.y + ' leaves the room');
        if (p.to.x < 0 || p.to.y < 0 || p.to.x + p.w > r.w || p.to.y >= r.h) errs.push(tag + ': to ' + p.to.x + ',' + p.to.y + ' leaves the room');
        for (let k = 0; k < p.w; k++) {
          if (!air(r, p.from.x + k, p.from.y)) errs.push(tag + ': from-tile ' + (p.from.x + k) + ',' + p.from.y + ' is solid');
          if (!air(r, p.to.x + k, p.to.y)) errs.push(tag + ': to-tile ' + (p.to.x + k) + ',' + p.to.y + ' is solid');
        }
      }
      // --- nodes, cores, bits, vendor ---
      const nodes = listOf(r.nodes, 'nodes', id);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i], tag = id + ' node ' + n.id;
        if (typeof n.id !== 'string') errs.push(tag + ': id must be a string');
        else if (nodeIds[n.id]) errs.push(tag + ': duplicate node id (also in ' + nodeIds[n.id] + ')'); else nodeIds[n.id] = id;
        if (!inside(r, n.x, n.y)) errs.push(tag + ': outside the room');
        else { if (!air(r, n.x, n.y)) errs.push(tag + ': tile is solid'); if (!footing(r, n.x, n.y)) errs.push(tag + ': no footing'); }
      }
      const cores = listOf(r.cores, 'cores', id);
      for (let i = 0; i < cores.length; i++) {
        const c = cores[i], tag = id + ' core ' + c.id;
        if (typeof c.id !== 'string') errs.push(tag + ': id must be a string');
        else if (coreIds[c.id]) errs.push(tag + ': duplicate core id (also in ' + coreIds[c.id] + ')'); else coreIds[c.id] = id;
        if (!inside(r, c.x, c.y)) errs.push(tag + ': outside the room'); else if (!air(r, c.x, c.y)) errs.push(tag + ': tile is solid');
        if (c.ability !== null && c.ability !== undefined && IDS.abilities.indexOf(c.ability) < 0) errs.push(tag + ': unknown ability ' + c.ability);
      }
      const bits = listOf(r.bits, 'bits', id), seenBit = Object.create(null);
      for (let i = 0; i < bits.length; i++) {
        const b = bits[i], key = b.x + ',' + b.y, tag = id + ' bit ' + key;
        if (!inside(r, b.x, b.y)) errs.push(tag + ': outside the room'); else if (!air(r, b.x, b.y)) errs.push(tag + ': tile is solid');
        if (b.size !== 'small' && b.size !== 'medium' && b.size !== 'large') errs.push(tag + ': bad size ' + b.size);
        if (seenBit[key]) errs.push(tag + ': duplicate placed bit'); seenBit[key] = true;
      }
      if (r.vendor) {
        if (!inside(r, r.vendor.x, r.vendor.y)) errs.push(id + ' vendor: outside the room');
        else { if (!air(r, r.vendor.x, r.vendor.y)) errs.push(id + ' vendor: tile is solid'); if (!footing(r, r.vendor.x, r.vendor.y)) errs.push(id + ' vendor: no footing'); }
      }
      if (r.start) {
        if (!inside(r, r.start.x, r.start.y)) errs.push(id + ' start: outside the room');
        else { if (!air(r, r.start.x, r.start.y)) errs.push(id + ' start: tile is solid'); if (!footing(r, r.start.x, r.start.y)) errs.push(id + ' start: no footing'); }
      }
      // --- boss ---
      if (r.boss) {
        const b = r.boss, tag = id + ' boss';
        if (typeof b.id !== 'string') errs.push(tag + ': id must be a string');
        else if (!r.debug) {
          if (IDS.bosses.indexOf(b.id) < 0) errs.push(tag + ': ' + b.id + ' is not a pinned boss id (' + IDS.bosses.join('|') + ')');
          if (!IDS.bossRooms[id]) errs.push(tag + ': ' + id + ' is not a pinned arena (' + Object.keys(IDS.bossRooms).join('|') + ')');
          else if (IDS.bossRooms[id] !== b.id) errs.push(tag + ': arena ' + id + ' must hold ' + IDS.bossRooms[id] + ', not ' + b.id);
          if (b.final !== (IDS.bossAbility[b.id] === null)) errs.push(tag + ': final flag disagrees with the pinned boss table');
        }
        if (!b.bounds || b.bounds.length !== 2 || !(b.bounds[0] >= 0 && b.bounds[0] <= b.bounds[1] && b.bounds[1] <= r.w - 1)) errs.push(tag + ': bounds ' + b.bounds + ' must be [tx0 ≤ tx1] inside the room');
        // spawn: inside + air (flying / ceiling bosses need no footing; ground bosses fall to the floor themselves)
        if (!b.spawn || !inside(r, b.spawn.x, b.spawn.y)) errs.push(tag + ': spawn tile missing or outside the room');
        else if (!air(r, b.spawn.x, b.spawn.y)) errs.push(tag + ': spawn tile is solid');
        if (b.spawn && b.bounds && (b.spawn.x < b.bounds[0] || b.spawn.x > b.bounds[1])) errs.push(tag + ': spawn x is outside the fight bounds');
        if (!b.final) {
          if (!b.pickup || !inside(r, b.pickup.x, b.pickup.y)) errs.push(tag + ': pickup tile missing or outside the room');
          else { if (!air(r, b.pickup.x, b.pickup.y)) errs.push(tag + ': pickup tile is solid'); if (!footing(r, b.pickup.x, b.pickup.y)) errs.push(tag + ': no footing under the pickup tile'); }
        }
        const lists = [b.seal, b.locked];
        for (let li = 0; li < 2; li++) for (let i = 0; i < lists[li].length; i++) if (!World.exit(r, lists[li][i])) errs.push(tag + ': ' + (li ? 'locked' : 'seal') + ' exit ' + lists[li][i] + ' does not exist');
      } else if (!r.debug && IDS.bossRooms[id]) errs.push(id + ': arena is missing its boss (' + IDS.bossRooms[id] + ')');
      // --- map grid overlaps (real rooms only) ---
      if (!r.debug) for (let rj = ri + 1; rj < ids.length; rj++) {
        const o = World.rooms[ids[rj]]; if (o.debug) continue;
        const EPS = 0.01;
        if (r.gx + EPS < o.gx + o.gw && r.gx + r.gw > o.gx + EPS && r.gy + EPS < o.gy + o.gh && r.gy + r.gh > o.gy + EPS) errs.push(id + ' and ' + o.id + ': map grid rectangles overlap');
      }
    }
    // --- start + pinned arenas present ---
    const st = World.start, sr = World.rooms[st.room];
    if (!sr) errs.push('start: room ' + st.room + ' missing');
    else {
      if (!inside(sr, st.x, st.y)) errs.push('start: tile outside ' + st.room);
      else if (!footing(sr, st.x, st.y) || !air(sr, st.x, st.y)) errs.push('start: no footing / solid at ' + st.x + ',' + st.y);
      const n = World.findNode(st.nodeId);
      if (!n) errs.push('start: nodeId ' + st.nodeId + ' not found'); else if (n.room !== sr) errs.push('start: node ' + st.nodeId + ' is not in ' + st.room);
      if (!sr.start || sr.start.x !== st.x || sr.start.y !== st.y) errs.push('start: ' + st.room + '.start must equal World.start');
    }
    if (!sr || !sr.debug) for (const rid in IDS.bossRooms) if (!World.rooms[rid]) errs.push('arena ' + rid + ' (' + IDS.bossRooms[rid] + ') missing');
    return errs;
  };

  // ==========================================================================================
  // ZONES — DESIGN §5.1 (palette, theme), §5.2 (pools, song), §5.3 (lore card), §15.4 (blurb)
  // ==========================================================================================
  function defZone(id, index, name, blurb, lore, poolKind, pal) {
    World.zones[id] = { id: id, index: index, name: name, blurb: blurb, lore: lore, song: id, poolKind: poolKind, palette: pal };
  }
  defZone('driftcache', 1, 'DRIFTCACHE', 'Where the kingdom kept what it meant to forget.',
    'Everything the kingdom ever remembered and chose not to keep came here to settle. The racks have fallen into one another like old friends. Something still walks the aisles, counting what was lost.',
    'static',
    { bg0: '#0b1220', bg1: '#15213a', bg2: '#1e2f4e', tileFill: '#2a3a5c', tileShade: '#1b2740', tileEdge: '#6c86b8',
      fog: 'rgba(60,80,140,0.18)', glow: '#8fd3ff', hazard: '#8fd3ff', accent: '#8fb6e8' });
  defZone('loomworks', 2, 'LOOMWORKS', 'The looms still run with nothing left to carry.',
    'Here the kingdom wove its own nerves, cable by cable, and never stopped. The looms still run with nothing left to carry. Stand on a belt and it will take you somewhere; whether you wanted to go is not the belt\'s concern.',
    'static',
    { bg0: '#1a0f08', bg1: '#2e1a0e', bg2: '#3f2512', tileFill: '#5a3519', tileShade: '#3a2210', tileEdge: '#b8733a',
      fog: 'rgba(200,120,60,0.14)', glow: '#ffb24a', hazard: '#ffd27a', accent: '#b8733a' });
  defZone('brinevault', 3, 'BRINEVAULT', 'The coolant stayed. The heart did not.',
    'The kingdom ran hot and bled coolant into these vaults to keep its heart from cooking. The coolant stayed; the heart did not. What sleeps in the brine now has learned to climb.',
    'acid',
    { bg0: '#06140f', bg1: '#0d2a20', bg2: '#143a2c', tileFill: '#1d4d3a', tileShade: '#123326', tileEdge: '#4fae84',
      fog: 'rgba(60,160,110,0.16)', glow: '#a8ffcf', hazard: '#5ee89a', accent: '#4fae84' });
  defZone('nullspire', 4, 'NULLSPIRE', 'Addresses that point at nothing all point here.',
    'Addresses that point at nothing all point here. The spire grew downward out of the void, one unanswered call at a time. Climb it and you will be the first thing to arrive.',
    'static',
    { bg0: '#0a0612', bg1: '#170d26', bg2: '#211238', tileFill: '#2b1848', tileShade: '#1c0f30', tileEdge: '#7a4fb8',
      fog: 'rgba(140,90,200,0.16)', glow: '#e8e0ff', hazard: '#e8e0ff', accent: '#7a4fb8' });
  defZone('rootwell', 5, 'ROOTWELL', 'It has never once let go of a child.',
    'Every process in the kingdom was a child of the one that sits here, and it has never once let go of a child. It will not let go of you either. Make it.',
    'static',
    { bg0: '#140406', bg1: '#2a080c', bg2: '#3a0c12', tileFill: '#4d1018', tileShade: '#330a10', tileEdge: '#b32a2a',
      fog: 'rgba(200,40,60,0.14)', glow: '#ffcf5a', hazard: '#ff6a3a', accent: '#b32a2a' });
  // The debug zone (engine skeleton): outside the kingdom, excluded from counts and the map.
  World.zones.debug = {
    id: 'debug', index: 0, name: 'DEBUG CELL', blurb: 'a test chamber outside the kingdom',
    lore: '', song: 'driftcache', poolKind: 'static', debug: true,
    palette: { bg0: '#0b1220', bg1: '#15213a', bg2: '#1e2f4e', tileFill: '#2a3a5c', tileShade: '#1b2740',
      tileEdge: '#6c86b8', fog: 'rgba(60,80,140,0.18)', glow: '#8fd3ff', hazard: '#8fd3ff', accent: '#8fb6e8' },
  };

  // ==========================================================================================
  // BACKGROUND LAYERS — DESIGN §11.1.5. Three 1280×720 layers per zone, seeded by
  // zone.index*1000 + layer, painted once and cached. bg0 = void + dust, bg1 = far silhouettes
  // in `bg1`, bg2 = the same recipe at 0.5 scale / 1.5× count in `bg2` with `tileEdge`
  // highlights and the zone's powered details. Every element that crosses the right edge is
  // drawn again one width to the left so the horizontal wrap is seamless; a thin girder along
  // the top and bottom edges turns the vertical seam into a beam in tall rooms.
  // ==========================================================================================
  const bgCache = Object.create(null);
  let hooksInstalled = false;

  function mkCanvas(w, h) {
    if (UB.Render && UB.Render.makeCanvas) return UB.Render.makeCanvas(w, h);
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function rr(c, x, y, w, h, r) {
    if (r > w / 2) r = w / 2; if (r > h / 2) r = h / 2;
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  /** Draw fn(x) and, when the element [x, x+extent] crosses either edge, once more wrapped. */
  function wrapX(w, x, extent, fn) {
    fn(x);
    if (x + extent > w) fn(x - w);
    if (x - extent < 0) fn(x + w);
  }
  function girders(c, col, w, h, s) { c.fillStyle = col; c.fillRect(0, 0, w, 6 * s); c.fillRect(0, h - 6 * s, w, 6 * s); }

  // --- driftcache: hanging cables with drip beads, toppled racks rising from the floor ---
  function bgDriftcache(c, pal, rng, w, h, s, m, col, hi, mid) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    const nc = Math.round(12 * m);
    for (let i = 0; i < nc; i++) {
      const x0 = rng() * w, len = (120 + rng() * 300) * s, sag = (80 + rng() * 120) * s, lw = (4 + rng() * 4) * s;
      const beads = 3 + Math.floor(rng() * 3);
      wrapX(w, x0, len, function (x) {
        c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw;
        c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + len * 0.3, sag, x + len * 0.7, sag, x + len, 0); c.stroke();
        for (let b = 0; b < beads; b++) {
          const t = 0.15 + (b + 0.5) / beads * 0.7, u = 1 - t;
          const bx = u * u * u * x + 3 * u * u * t * (x + len * 0.3) + 3 * u * t * t * (x + len * 0.7) + t * t * t * (x + len);
          const by = 3 * u * u * t * sag + 3 * u * t * t * sag;
          c.beginPath(); c.arc(bx, by + lw * 0.6, 2 * s + 1.5, 0, TAU); c.fill();
        }
      });
    }
    const nr = Math.round(7 * m);
    for (let i = 0; i < nr; i++) {
      const rw = (40 + rng() * 50) * s, rh = (120 + rng() * 140) * s, x = rng() * w, lean = (rng() - 0.5) * 16 * DEG;
      wrapX(w, x, rw, function (xx) {
        c.save(); c.translate(xx, h); c.rotate(lean);
        c.fillStyle = col; rr(c, -rw / 2, -rh, rw, rh, 6 * s); c.fill();
        c.strokeStyle = hi; c.lineWidth = 1.5; c.globalAlpha = 0.35;
        for (let k = 1; k <= 4; k++) { const yy = -rh + k * rh / 5; c.beginPath(); c.moveTo(-rw / 2 + 6 * s, yy); c.lineTo(rw / 2 - 6 * s, yy); c.stroke(); }
        c.globalAlpha = 1; c.restore();
      });
    }
    if (mid) { // rack status lamps
      c.save(); c.fillStyle = pal.glow; c.shadowColor = pal.glow; c.shadowBlur = 12; c.globalAlpha = 0.5;
      for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(rng() * w, h - 40 - rng() * 220, 4, 0, TAU); c.fill(); }
      c.restore();
    }
  }
  // --- loomworks: pipes with elbow collars and drops, spools, hanging chains ---
  function bgLoomworks(c, pal, rng, w, h, s, m, col, hi, mid) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    const np = Math.round(10 * m), elbows = [];
    for (let i = 0; i < np; i++) {
      const y = rng() * h, th = (24 + rng() * 16) * s, x0 = rng() * w, len = (300 + rng() * 500) * s;
      elbows.length = 0;
      for (let e = (200 + rng() * 200) * s; e < len; e += (200 + rng() * 200) * s) elbows.push(e);
      wrapX(w, x0, len, function (x) {
        c.fillStyle = col; rr(c, x, y, len, th, th / 2); c.fill();
        for (let k = 0; k < elbows.length; k++) { rr(c, x + elbows[k] - th * 0.6, y - 3 * s, th * 1.2, th + 6 * s, 3 * s); c.fill(); }
        c.strokeStyle = hi; c.lineWidth = 2 * s; c.globalAlpha = 0.3;
        c.beginPath(); c.moveTo(x + th / 2, y + 5 * s); c.lineTo(x + len - th / 2, y + 5 * s); c.stroke(); c.globalAlpha = 1;
      });
    }
    const nd = Math.round(6 * m);
    for (let i = 0; i < nd; i++) {
      const x = rng() * w, y = rng() * h * 0.6, dh = (60 + rng() * 140) * s, dw = (18 + rng() * 12) * s;
      c.fillStyle = col; rr(c, x - dw / 2, y, dw, dh, dw / 2); c.fill();
    }
    const ns = Math.round(8 * m);
    for (let i = 0; i < ns; i++) {
      const dw = (60 + rng() * 60) * s, x = rng() * w, y = h * (0.15 + rng() * 0.6), cl = 40 * s, cw = dw * 0.55;
      wrapX(w, x, dw / 2, function (xx) {
        c.fillStyle = col; rr(c, xx - cw / 2, y, cw, cl, 4 * s); c.fill();
        c.strokeStyle = hi; c.lineWidth = 1.5; c.globalAlpha = 0.35;
        for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(xx - cw / 2 + 2, y + 4 + k * (cl - 8) / 5); c.lineTo(xx + cw / 2 - 2, y + 10 + k * (cl - 8) / 5); c.stroke(); }
        c.globalAlpha = 1; c.fillStyle = col;
        c.beginPath(); c.ellipse(xx, y, dw / 2, dw * 0.12, 0, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(xx, y + cl, dw / 2, dw * 0.12, 0, 0, TAU); c.fill();
      });
    }
    const nch = Math.round(5 * m);
    c.strokeStyle = col; c.lineWidth = 3 * s;
    for (let i = 0; i < nch; i++) {
      const x = rng() * w, links = 6 + Math.floor(rng() * 7), pitch = 14 * s;
      c.beginPath(); c.moveTo(x, 0);
      for (let k = 1; k <= links; k++) c.lineTo(x + (k & 1 ? 4 : -4) * s, k * pitch);
      c.stroke();
    }
    if (mid) { // amber warning lamps and belt rollers
      c.fillStyle = pal.glow; c.globalAlpha = 0.6;
      for (let i = 0; i < 10; i++) { c.beginPath(); c.arc(rng() * w, rng() * h, 3, 0, TAU); c.fill(); }
      c.globalAlpha = 1; c.strokeStyle = hi; c.fillStyle = col; c.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const x = rng() * w, y = rng() * h, r = 6 + rng() * 5, gap = 40 + rng() * 40;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + gap, y); c.stroke();
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.arc(x + gap, y, r, 0, TAU); c.fill(); c.stroke();
      }
    }
  }
  function crystal(c, x, y, wd, hg, col, rim) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - wd / 2, y); c.lineTo(x, y + hg); c.lineTo(x + wd / 2, y); c.closePath(); c.fill();
    if (rim) { c.strokeStyle = rim; c.lineWidth = 1.5; c.globalAlpha = 0.6; c.beginPath(); c.moveTo(x - wd / 2, y); c.lineTo(x, y + hg); c.stroke(); c.globalAlpha = 1; }
  }
  // --- brinevault: rock pillars in a lake, crystal clusters, dripping pipe stubs ---
  function bgBrinevault(c, pal, rng, w, h, s, m, col, hi, mid) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    const band = 90 * s, rim = mid ? pal.glow : hi;
    c.fillStyle = col; c.fillRect(0, h - band, w, band);
    c.strokeStyle = pal.hazard; c.lineWidth = 2; c.globalAlpha = 0.25;
    c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, h - band + Math.sin(x / 40) * 2); c.stroke(); c.globalAlpha = 1;
    const np = Math.round(12 * m), ncl = Math.round(6 * m), cw = [], chh = [];
    for (let i = 0; i < np; i++) {
      const bw = (30 + rng() * 40) * s, top = h - (200 + rng() * 220) * s, x = rng() * w, tw = bw * (0.55 + rng() * 0.25);
      const n = i < ncl ? 3 + Math.floor(rng() * 3) : 0;
      cw.length = 0; chh.length = 0;
      for (let k = 0; k < n; k++) { cw.push((10 + rng() * 20) * s); chh.push((40 + rng() * 80) * s); }
      wrapX(w, x, bw, function (xx) {
        c.fillStyle = col; c.beginPath(); c.moveTo(xx - bw / 2, h); c.lineTo(xx - tw / 2, top); c.quadraticCurveTo(xx, top - 8 * s, xx + tw / 2, top); c.lineTo(xx + bw / 2, h); c.closePath(); c.fill();
        for (let k = 0; k < n; k++) crystal(c, xx - tw / 2 + tw * (k + 0.5) / n, top, cw[k], -chh[k], col, rim);
      });
    }
    const nceil = Math.round(4 * m);
    for (let i = 0; i < nceil; i++) {
      const x = rng() * w, n = 3 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) crystal(c, x + (k - (n - 1) / 2) * 14 * s, 0, (10 + rng() * 20) * s, (40 + rng() * 80) * s, col, rim);
    }
    const nst = Math.round(6 * m);
    for (let i = 0; i < nst; i++) {
      const x = rng() * w, sh = (30 + rng() * 30) * s, sw = 16 * s;
      c.fillStyle = col; rr(c, x - sw / 2, 0, sw, sh, sw / 3); c.fill();
      c.fillStyle = pal.hazard; c.globalAlpha = 0.6; c.beginPath(); c.arc(x, sh + 6 * s + rng() * 30, 2, 0, TAU); c.fill(); c.globalAlpha = 1;
    }
  }
  // --- nullspire: inverted glass spires with static ticks, void ribs ---
  function bgNullspire(c, pal, rng, w, h, s, m, col, hi, mid) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    const nrib = 4;
    c.strokeStyle = col; c.lineWidth = 6; c.globalAlpha = mid ? 0.5 : 0.8;
    for (let i = 0; i < nrib; i++) {
      const r = (400 + rng() * 200) * (mid ? 0.6 : 1), cx = rng() * w, cy = h + r * (0.3 + rng() * 0.5), a0 = Math.PI + rng() * 0.5;
      c.beginPath(); c.arc(cx, cy, r, a0, a0 + 1.2); c.stroke();
    }
    c.globalAlpha = 1;
    const nsp = Math.round(18 * m);
    for (let i = 0; i < nsp; i++) {
      const sw = (20 + rng() * 30) * s, sh = (120 + rng() * 180) * s, x = rng() * w, tilt = rng() < 0.3 ? (rng() - 0.5) * 24 * DEG : 0;
      wrapX(w, x, sw, function (xx) {
        c.save(); c.translate(xx, 0); c.rotate(tilt);
        c.fillStyle = col; c.beginPath(); c.moveTo(-sw / 2, 0); c.lineTo(0, sh); c.lineTo(sw / 2, 0); c.closePath(); c.fill();
        c.strokeStyle = pal.glow; c.lineWidth = 1; c.globalAlpha = mid ? 0.6 : 0.35;
        for (let k = 0; k < 3; k++) {          // static ticks on both edges
          const t = 0.15 + k * 0.3, ex = -sw / 2 * (1 - t), ey = sh * t;
          c.beginPath(); c.moveTo(ex - 3, ey); c.lineTo(ex + 3, ey + 2); c.stroke();
          c.beginPath(); c.moveTo(-ex - 3, ey + 6); c.lineTo(-ex + 3, ey + 4); c.stroke();
        }
        c.globalAlpha = 1; c.restore();
      });
    }
  }
  // --- rootwell: veins radiating from a buried centre, giant ribs, cable-root columns ---
  function bgRootwell(c, pal, rng, w, h, s, m, col, hi, mid) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    const cx = w / 2, cy = h + 120 * s;
    c.strokeStyle = col; c.lineWidth = 10 * (mid ? 0.6 : 1); c.globalAlpha = mid ? 0.5 : 0.75;
    for (let i = 0; i < 4; i++) { const r = (300 + rng() * 200) * (mid ? 0.6 : 1); c.beginPath(); c.arc(cx, cy, r, Math.PI + 0.2, TAU - 0.2); c.stroke(); }
    c.globalAlpha = 1;
    const nv = Math.round(16 * m);
    for (let i = 0; i < nv; i++) {
      const a = Math.PI + 0.15 + rng() * (Math.PI - 0.3), segs = 6 + Math.floor(rng() * 5);
      c.lineWidth = (3 + rng() * 3) * s; c.strokeStyle = col;
      let x = cx, y = cy; c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < segs; k++) {
        const len = (50 + rng() * 50) * s, side = (rng() - 0.5) * 30 * s;
        x += Math.cos(a) * len - Math.sin(a) * side; y += Math.sin(a) * len + Math.cos(a) * side;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    const nr = Math.round(6 * m);
    for (let i = 0; i < nr; i++) {
      const x = rng() * w, amp = (14 + rng() * 14) * s, ph = rng() * TAU;
      c.strokeStyle = col; c.lineWidth = 14 * s;
      c.beginPath(); c.moveTo(x, 0);
      for (let y = 0; y <= h; y += 24) c.lineTo(x + Math.sin(y / h * TAU * 1.5 + ph) * amp, y);
      c.stroke();
      c.fillStyle = col;
      for (let k = 1; k <= 3; k++) { const y = h * k / 4; c.beginPath(); c.arc(x + Math.sin(y / h * TAU * 1.5 + ph) * amp, y, 10 * s, 0, TAU); c.fill(); }
      c.strokeStyle = hi; c.lineWidth = 1.5; c.globalAlpha = 0.35;
      c.beginPath(); c.moveTo(x, 0); for (let y = 0; y <= h; y += 24) c.lineTo(x + Math.sin(y / h * TAU * 1.5 + ph) * amp, y); c.stroke();
      c.globalAlpha = 1;
    }
    if (mid) { // pulsing nodes (static in the cache; the ambient layer carries the live pulse)
      c.fillStyle = pal.glow; c.globalAlpha = 0.45;
      for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(rng() * w, h * 0.3 + rng() * h * 0.7, 6, 0, TAU); c.fill(); }
      c.globalAlpha = 1;
    }
  }
  const BG = { driftcache: bgDriftcache, loomworks: bgLoomworks, brinevault: bgBrinevault, nullspire: bgNullspire, rootwell: bgRootwell };

  /**
   * Paint one parallax layer (0, 1 or 2) of a zone into ctx (w×h, normally 1280×720).
   * Deterministic: seeded by zone.index*1000 + layer. Safe to call for any zone record.
   */
  World.paintBackground = function (zone, layer, ctx, w, h) {
    const pal = zone.palette;
    const rng = U.rng((zone.index | 0) * 1000 + layer);
    const paint = BG[zone.id] || BG.driftcache;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    if (layer === 0) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, pal.bg0); g.addColorStop(0.6, pal.bg0); g.addColorStop(1, pal.bg1);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = P.PAPER;
      for (let i = 0; i < 40; i++) {
        ctx.globalAlpha = 0.06 + rng() * 0.06;
        ctx.beginPath(); ctx.arc(rng() * w, rng() * h, 1 + rng(), 0, TAU); ctx.fill();
      }
    } else if (layer === 1) {
      girders(ctx, pal.bg1, w, h, 1);
      paint(ctx, pal, rng, w, h, 1, 1, pal.bg1, pal.bg0, false);
    } else {
      girders(ctx, pal.bg2, w, h, 0.5);
      paint(ctx, pal, rng, w, h, 0.5, 1.5, pal.bg2, pal.tileEdge, true);
    }
    ctx.restore();
  };
  /**
   * The zone's three cached layers {bg0, bg1, bg2}: 1280×720 logical px painted at `scale` (the canvas
   * backing scale, default 1) so the renderer blits them 1:1 at any devicePixelRatio. Built on first use;
   * only the two most recent zone/scale combinations stay cached (a layer set is 44 MB at scale 2).
   */
  const bgOrder = [];
  World.background = function (zone, scale) {
    const s = scale > 0 ? scale : 1, key = zone.id + '@' + s;
    let b = bgCache[key];
    if (b) return b;
    const mk = function (layer) {
      const c = mkCanvas(Math.round(BG_W * s), Math.round(BG_H * s)), g = c.getContext('2d');
      g.setTransform(s, 0, 0, s, 0, 0);
      World.paintBackground(zone, layer, g, BG_W, BG_H);
      return c;
    };
    b = bgCache[key] = { bg0: mk(0), bg1: mk(1), bg2: mk(2), scale: s, w: BG_W, h: BG_H };
    bgOrder.push(key);
    while (bgOrder.length > 2) { const old = bgOrder.shift(); delete bgCache[old]; }
    return b;
  };

  // ==========================================================================================
  // ZONE PROPS — DESIGN §5.4. A vertical run of `B` tiles is one tall prop, a lone `B` a small
  // prop; both are drawn in `accent` with ink outlines and one `glow` detail, into the static
  // tile layer. Outlines carry the ±1 px seeded vertex jitter of §11.1.1. (x, y) is the
  // top-left pixel of the run's top tile; `rows` its length; `j(i)` a stable jitter.
  // ==========================================================================================
  function ink(c, w) { c.strokeStyle = P.INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; }
  function glowDot(c, pal, x, y, r, blur) {
    c.save(); c.fillStyle = pal.glow; if (blur) { c.shadowColor = pal.glow; c.shadowBlur = blur; }
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  // driftcache: toppled server rack (tall) / cable stump (small)
  function propRack(c, pal, x, y, rows, j, hang) {
    // leans 6° about its footing: the floor under the run, or the ceiling it hangs from
    const hgt = rows * TILE - 6, cx = x + 15, base = hang ? y : y + rows * TILE, dir = hang ? 1 : -1;
    c.save(); c.translate(cx, base); c.rotate((j(0) >= 0 ? 6 : -6) * DEG);
    c.fillStyle = pal.accent; ink(c, 3);
    c.beginPath(); c.moveTo(-12 + j(1), 0); c.lineTo(12 + j(2), 0); c.lineTo(12 + j(3), dir * hgt); c.lineTo(-12 + j(4), dir * hgt); c.closePath(); c.fill(); c.stroke();
    ink(c, 1.5); c.globalAlpha = 0.6;
    for (let k = 0; k < rows * 4; k++) { const yy = dir * (hgt - 6 - k * 7); c.beginPath(); c.moveTo(-8, yy); c.lineTo(8, yy); c.stroke(); }
    c.globalAlpha = 1; c.restore();
    glowDot(c, pal, cx + (j(0) >= 0 ? -4 : 4), hang ? y + rows * TILE - 8 : y + 8, 2.5, 10);
  }
  function propStump(c, pal, x, y, rows, j) {
    const cx = x + 15;
    c.fillStyle = pal.accent; ink(c, 2);
    rr(c, cx - 7 + j(1) * 0.5, y + 14, 14, 16, 3); c.fill(); c.stroke();
    for (let k = 0; k < 3; k++) {
      const a = (-110 + k * 20) * DEG, x1 = cx - 4 + k * 4, y1 = y + 14, x2 = x1 + Math.cos(a) * 10, y2 = y1 + Math.sin(a) * 10 + j(k + 2);
      ink(c, 4); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = pal.accent; c.lineWidth = 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    glowDot(c, pal, cx + 4 + Math.cos(-70 * DEG) * 10, y + 14 + Math.sin(-70 * DEG) * 10, 1.8, 0);
  }
  // loomworks: thread spool on a chain (tall) / chain stub with a hook (small)
  function chainOvals(c, pal, cx, y0, n) {
    c.fillStyle = pal.accent; ink(c, 1.5);
    for (let k = 0; k < n; k++) { c.beginPath(); c.ellipse(cx, y0 + k * 4 + 2, 2.5, 2, 0, 0, TAU); c.fill(); c.stroke(); }
  }
  function propSpool(c, pal, x, y, rows, j) {
    const cx = x + 15, top = y + 28, bot = y + rows * TILE - 8;
    chainOvals(c, pal, cx, y + 2, 6);
    c.fillStyle = pal.accent; ink(c, 3);
    rr(c, cx - 10 + j(1) * 0.5, top, 20, bot - top, 3); c.fill(); c.stroke();
    c.strokeStyle = pal.tileShade; c.lineWidth = 1.5; c.globalAlpha = 0.8;
    for (let k = 0; k < 5; k++) { const yy = top + 4 + (bot - top - 8) * k / 4; c.beginPath(); c.moveTo(cx - 8, yy + 3); c.lineTo(cx + 8, yy - 3); c.stroke(); }
    c.globalAlpha = 1;
    c.strokeStyle = pal.glow; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - 8, top + 10); c.lineTo(cx + 8, top + 6); c.stroke();
    c.fillStyle = pal.accent; ink(c, 3);
    c.beginPath(); c.ellipse(cx + j(2) * 0.5, top, 13, 4, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(cx + j(3) * 0.5, bot, 13, 4, 0, 0, TAU); c.fill(); c.stroke();
  }
  function propChainStub(c, pal, x, y, rows, j) {
    const cx = x + 15 + j(1) * 0.5;
    chainOvals(c, pal, cx, y + 4, 3);
    c.strokeStyle = pal.accent; c.lineWidth = 3; ink(c, 5);
    c.beginPath(); c.arc(cx, y + 22, 5, -Math.PI / 2, Math.PI * 0.9); c.stroke();
    c.strokeStyle = pal.accent; c.lineWidth = 2.5; c.beginPath(); c.arc(cx, y + 22, 5, -Math.PI / 2, Math.PI * 0.9); c.stroke();
    glowDot(c, pal, cx - 4, y + 25, 1.5, 0);
  }
  // brinevault: pipe elbow running the column (tall) / pipe stub (small), both dripping
  function propPipe(c, pal, x, y, rows, j) {
    const cx = x + 15, side = j(0) >= 0 ? 1 : -1, bot = y + rows * TILE - 10;
    c.fillStyle = pal.accent; ink(c, 3);
    rr(c, cx + (side > 0 ? -8 : -15), y + 6, 23, 16, 6); c.fill(); c.stroke();     // elbow arm toward the wall
    rr(c, cx - 8 + j(1) * 0.5, y + 6, 16, bot - y - 6, 6); c.fill(); c.stroke();     // down pipe
    c.fillStyle = pal.tileShade; ink(c, 2);
    c.beginPath(); c.ellipse(cx, bot, 6, 2.5, 0, 0, TAU); c.fill(); c.stroke();      // mouth
    c.strokeStyle = pal.tileEdge; c.lineWidth = 1.5; c.globalAlpha = 0.5;
    c.beginPath(); c.moveTo(cx - 5, y + 14); c.lineTo(cx - 5, bot - 6); c.stroke(); c.globalAlpha = 1;
    glowDot(c, pal, cx, bot + 4 + (j(2) + 1) * 2, 2, 8);                             // drip bead
  }
  function propPipeStub(c, pal, x, y, rows, j) {
    const cx = x + 15 + j(1) * 0.5;
    c.fillStyle = pal.accent; ink(c, 2);
    rr(c, cx - 7, y + 6, 14, 16, 4); c.fill(); c.stroke();
    rr(c, cx - 9, y + 8, 18, 4, 2); c.fill(); c.stroke();                            // flange
    c.fillStyle = pal.tileShade; c.beginPath(); c.ellipse(cx, y + 22, 5, 2, 0, 0, TAU); c.fill(); c.stroke();
    glowDot(c, pal, cx, y + 27, 1.8, 6);
  }
  // nullspire: antenna spire (tall) / short spire (small)
  function propSpire(c, pal, x, y, rows, j, hang) {
    // rises from its footing; hanging from a ceiling it points down like the zone's inverted spires
    const cx = x + 15, base = hang ? y : y + rows * TILE, tip = hang ? y + rows * TILE - 5 : y + 5;
    c.fillStyle = pal.accent; ink(c, 2);
    c.beginPath(); c.moveTo(cx - 7 + j(1) * 0.5, base); c.lineTo(cx + j(2) * 0.3, tip); c.lineTo(cx + 7 + j(3) * 0.5, base); c.closePath(); c.fill(); c.stroke();
    for (let k = 1; k <= 2; k++) { const yy = tip + (base - tip) * k / 3; ink(c, 3); c.beginPath(); c.moveTo(cx - 5, yy); c.lineTo(cx + 5, yy); c.stroke(); c.strokeStyle = pal.accent; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - 5, yy); c.lineTo(cx + 5, yy); c.stroke(); }
    glowDot(c, pal, cx, tip, 3, 12);
  }
  function propSpireSmall(c, pal, x, y, rows, j) {
    const cx = x + 15 + j(1) * 0.5;
    c.fillStyle = pal.accent; ink(c, 2);
    c.beginPath(); c.moveTo(cx - 5, y + 30); c.lineTo(cx, y + 10); c.lineTo(cx + 5, y + 30); c.closePath(); c.fill(); c.stroke();
    ink(c, 3); c.beginPath(); c.moveTo(cx - 4, y + 20); c.lineTo(cx + 4, y + 20); c.stroke();
    c.strokeStyle = pal.accent; c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - 4, y + 20); c.lineTo(cx + 4, y + 20); c.stroke();
    glowDot(c, pal, cx, y + 10, 2, 8);
  }
  // rootwell: cable-root (tall) / root knot (small)
  function rootPath(c, cx, y0, y1, amp, ph) {
    c.beginPath(); c.moveTo(cx + Math.sin(ph) * amp, y0);
    for (let yy = y0; yy <= y1; yy += 6) c.lineTo(cx + Math.sin((yy - y0) / (y1 - y0) * TAU * 1.5 + ph) * amp, yy);
    c.lineTo(cx + Math.sin(TAU * 1.5 + ph) * amp, y1);
  }
  function propRoot(c, pal, x, y, rows, j) {
    const cx = x + 15, y0 = y, y1 = y + rows * TILE, amp = 5, ph = j(0) * 1.5;
    ink(c, 14); rootPath(c, cx, y0, y1, amp, ph); c.stroke();
    c.strokeStyle = pal.accent; c.lineWidth = 10; rootPath(c, cx, y0, y1, amp, ph); c.stroke();
    c.fillStyle = pal.accent; ink(c, 2);
    for (let k = 1; k <= 3; k++) {
      const yy = y0 + (y1 - y0) * k / 4, kx = cx + Math.sin((yy - y0) / (y1 - y0) * TAU * 1.5 + ph) * amp;
      c.beginPath(); c.arc(kx + j(k) * 0.5, yy, 6, 0, TAU); c.fill(); c.stroke();
    }
    c.strokeStyle = pal.glow; c.lineWidth = 1.5; c.globalAlpha = 0.8; rootPath(c, cx, y0 + 4, y1 - 4, amp, ph); c.stroke(); c.globalAlpha = 1;
  }
  function propKnot(c, pal, x, y, rows, j) {
    const cx = x + 15 + j(1) * 0.5, cy = y + 20;
    for (let k = 0; k < 2; k++) {
      const a = (115 + k * 50 - 25 + j(k + 2) * 4) * DEG, x2 = cx + Math.cos(a) * 11, y2 = cy + Math.sin(a) * 11;
      ink(c, 6); c.beginPath(); c.moveTo(cx, cy); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = pal.accent; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy); c.lineTo(x2, y2); c.stroke();
    }
    c.fillStyle = pal.accent; ink(c, 2.5); c.beginPath(); c.arc(cx, cy, 8, 0, TAU); c.fill(); c.stroke();
    glowDot(c, pal, cx, cy, 2.5, 8);
  }
  const PROPS = {
    driftcache: { tall: propRack, small: propStump },
    loomworks: { tall: propSpool, small: propChainStub },
    brinevault: { tall: propPipe, small: propPipeStub },
    nullspire: { tall: propSpire, small: propSpireSmall },
    rootwell: { tall: propRoot, small: propKnot },
  };
  // Composite props: blocks of B tiles that form one set piece (DESIGN §5.4, rw_throne).
  function propCanopy(c, pal, x, y, w, h, j) {   // hanging crown canopy over the well
    const cx = x + w / 2;
    c.fillStyle = pal.accent; ink(c, 3);
    c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + w - 4, y); c.quadraticCurveTo(x + w - 4, y + h - 10, cx, y + h - 6 + j(1)); c.quadraticCurveTo(x + 4, y + h - 10, x + 4, y); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = pal.glow; c.lineWidth = 1.5; c.globalAlpha = 0.9;
    for (let k = 0; k < 7; k++) { const fx = x + 12 + k * (w - 24) / 6, fy = y + h - 14 - Math.abs(k - 3) * 6; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + j(k + 2), fy + 10 + (k % 2) * 8); c.stroke(); }
    c.globalAlpha = 1;
    glowDot(c, pal, cx, y + 14, 4, 14);
  }
  function propThrone(c, pal, x, y, w, h, j) {   // the seat of the Root Process: back rest, two root legs, a dark seat
    c.fillStyle = pal.accent; ink(c, 3);
    rr(c, x + 2 + j(1) * 0.5, y + 2, w - 4, 26, 6); c.fill(); c.stroke();                  // back rest (row 17)
    rr(c, x + 3, y + 28, 24, h - 28, 5); c.fill(); c.stroke();                               // left root leg
    rr(c, x + w - 27, y + 28, 24, h - 28, 5); c.fill(); c.stroke();                          // right root leg
    c.fillStyle = pal.tileShade; rr(c, x + 27, y + 28, w - 54, 18, 4); c.fill(); c.stroke();   // seat
    c.strokeStyle = pal.glow; c.lineWidth = 1.5; c.globalAlpha = 0.8;
    c.beginPath(); c.moveTo(x + 15, y + 34); c.lineTo(x + 15 + j(2), y + h - 6); c.moveTo(x + w - 15, y + 34); c.lineTo(x + w - 15 + j(3), y + h - 6); c.stroke();
    c.globalAlpha = 1;
    glowDot(c, pal, x + w / 2, y + 15, 3, 10);
  }
  const COMPOSITES = {
    rw_throne: [{ draw: propCanopy, x: 30, y: 8, w: 4, h: 2, tag: 'canopy' }, { draw: propThrone, x: 30, y: 17, w: 4, h: 4, tag: 'throne' }],
  };
  /**
   * Hide the composite prop(s) tagged `tag` for the rest of this room visit (the level's hiddenProps set;
   * DESIGN §8.4: the throne bursts into particles at Kernauth's phase change). Returns the tile rect
   * covering them (for the caller's tile-cache repaint) or null when the room has no such prop.
   */
  World.hideProp = function (level, tag) {
    const comps = level && level.room ? COMPOSITES[level.room.id] : null;
    if (!comps) return null;
    if (!level.hiddenProps) level.hiddenProps = [];
    let rect = null;
    for (let i = 0; i < comps.length; i++) {
      const k = comps[i];
      if (k.tag !== tag) continue;
      if (level.hiddenProps.indexOf(i) < 0) level.hiddenProps.push(i);
      if (!rect) rect = { x: k.x, y: k.y, w: k.w, h: k.h };
      else { const x1 = Math.max(rect.x + rect.w, k.x + k.w), y1 = Math.max(rect.y + rect.h, k.y + k.h); rect.x = Math.min(rect.x, k.x); rect.y = Math.min(rect.y, k.y); rect.w = x1 - rect.x; rect.h = y1 - rect.y; }
    }
    return rect;
  };
  const jitterOf = (function () {
    let seed = 0;
    const f = function (i) { return U.jitter(seed, i, 1); };
    f.seed = function (s) { seed = s; return f; };
    return f;
  })();
  /**
   * Draw the prop for the run of `rows` B tiles whose top tile is (tx, ty) into a world-space ctx.
   * Pure painter; the engine's tile cache (or anything else) may call it.
   */
  World.drawProp = function (ctx, zone, tx, ty, rows, seed, hang) {
    const set = PROPS[zone.id] || PROPS.driftcache, pal = zone.palette;
    const j = jitterOf.seed(seed | 0);
    ctx.save();
    (rows >= 2 ? set.tall : set.small)(ctx, pal, tx * TILE, ty * TILE, rows, j, !!hang);
    ctx.restore();
  };
  /** True when a run of B tiles has a solid ceiling above it and no footing below (a hanging prop). */
  function hangs(tiles, tx, ty, rows, h) {
    const below = ty + rows < h ? tiles[ty + rows][tx] : '#';
    return ty > 0 && tiles[ty - 1][tx] === '#' && below !== '#' && below !== 'c' && below !== '-';
  }
  // Clears the generic `B` stub render.js draws (a 14×20 rounded rect at +8,+10) without touching
  // the tile's borders, so neighbouring outlines stay intact.
  function clearStub(c, tx, ty) { c.clearRect(tx * TILE + 6, ty * TILE + 8, 18, 20); }
  /**
   * Draw every zone prop whose tiles touch the tile rectangle [tx0..tx1]×[ty0..ty1] into the
   * level's static tile cache (clipped to that rectangle, so partial redraws stay consistent).
   * Called by the render hook after UB.Render.redrawTiles; safe to call on its own.
   */
  World.drawProps = function (level, tx0, ty0, tx1, ty1) {
    if (!level || !level.tileCache) return;
    const room = level.room, zone = level.zone, s = level.cacheScale || 1, tiles = room.tiles;
    const c = level.tileCache.getContext('2d');
    tx0 = Math.max(0, tx0); ty0 = Math.max(0, ty0); tx1 = Math.min(room.w - 1, tx1); ty1 = Math.min(room.h - 1, ty1);
    if (tx1 < tx0 || ty1 < ty0) return;
    c.save();
    c.setTransform(s, 0, 0, s, 0, 0);
    c.beginPath(); c.rect(tx0 * TILE, ty0 * TILE, (tx1 - tx0 + 1) * TILE, (ty1 - ty0 + 1) * TILE); c.clip();
    const comps = COMPOSITES[room.id] || null;
    if (comps) {
      for (let i = 0; i < comps.length; i++) {
        const k = comps[i];
        if (k.x + k.w <= tx0 - 1 || k.x > tx1 + 1 || k.y + k.h <= ty0 - 1 || k.y > ty1 + 1) continue;
        for (let yy = k.y; yy < k.y + k.h; yy++) for (let xx = k.x; xx < k.x + k.w; xx++) if (tiles[yy][xx] === 'B') clearStub(c, xx, yy);
        if (level.hiddenProps && level.hiddenProps.indexOf(i) >= 0) continue;   // burst away this visit
        c.save(); k.draw(c, zone.palette, k.x * TILE, k.y * TILE, k.w * TILE, k.h * TILE, jitterOf.seed(U.hash(k.x, k.y, i, 5))); c.restore();
      }
    }
    const cx0 = Math.max(0, tx0 - 1), cx1 = Math.min(room.w - 1, tx1 + 1);
    for (let tx = cx0; tx <= cx1; tx++) {
      for (let ty = 0; ty < room.h; ty++) {
        if (tiles[ty][tx] !== 'B' || (ty > 0 && tiles[ty - 1][tx] === 'B')) continue;
        let rows = 1; while (ty + rows < room.h && tiles[ty + rows][tx] === 'B') rows++;
        if (comps && coveredBy(comps, tx, ty)) { ty += rows - 1; continue; }
        if (ty + rows > ty0 - 1 && ty <= ty1 + 1) {
          for (let k = 0; k < rows; k++) clearStub(c, tx, ty + k);
          World.drawProp(c, zone, tx, ty, rows, U.hash(tx, ty, room.w, room.h), hangs(tiles, tx, ty, rows, room.h));
        }
        ty += rows - 1;
      }
    }
    c.restore();
  };
  function coveredBy(comps, tx, ty) {
    for (let i = 0; i < comps.length; i++) { const k = comps[i]; if (tx >= k.x && tx < k.x + k.w && ty >= k.y && ty < k.y + k.h) return true; }
    return false;
  }

  // ==========================================================================================
  // ROOMS — DESIGN §6. Tilemaps are the §6 blocks verbatim (test/world.cjs diffs them against
  // DESIGN.md). Exits list the ability a player is expected to own to reach them (§6, §10.2);
  // the engine never blocks traversal — geometry does. Cores carry the ability their alcove
  // needs (§10.4). Boss records: pinned ids (UB.IDS.bossRooms), fight bounds, start tile,
  // pickup tile, exits sealed for the fight (`seal`) and from room entry (`locked`).
  // ==========================================================================================
  const R = World.rooms;

  // ---- DRIFTCACHE (zone 1, DESIGN §6.1–6.6) ------------------------------------------------

  R.dc_wake = {
    id: 'dc_wake', zone: 'driftcache', name: 'Wake Cell',
    w: 32, h: 18, gx: 0, gy: 0, gw: 1, gh: 1,
    intro: 'A low, dusty chamber. You lie on a raised dais of dead cache slabs; a restore node hums beside you. One patroller scrapes along the floor to the right; a single one-way shelf hangs over it with three bits.',
    start: { x: 3, y: 12 },
    tiles: [
      '################################',
      '#.........###.......##.....#####',
      '#.........###.......##.....#####',
      '#...................##.....#####',
      '#..........................#####',
      '#..........................#####',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.................-----........#',
      '#.............B.................',
      '########......B........B.....B..',
      '##########....B........B.....B..',
      '################################',
      '################################',
      '################################',
    ],
    exits: [
      { id: 'R', side: 'right', x: 31, y: 12, w: 1, h: 3, to: { room: 'dc_fall', exit: 'L' }, spawn: { x: 29, y: 14 }, ability: null },
    ],
    spawns: [
      { type: 'scuttlebit', x: 20, y: 14, patrol: [16, 26] },
    ],
    platforms: [],
    nodes: [
      { id: 'node_dc_wake', x: 5, y: 12 },
    ],
    cores: [],
    bits: [
      { x: 19, y: 10, size: 'small' },
      { x: 20, y: 10, size: 'small' },
      { x: 21, y: 10, size: 'small' },
    ],
    vendor: null,
    boss: null,
  };

  R.dc_fall = {
    id: 'dc_fall', zone: 'driftcache', name: 'The Long Drop',
    w: 32, h: 54, gx: 1, gy: 0, gw: 1, gh: 3,
    intro: 'A tall shaft of stacked, sagging cache racks. Ledges alternate left and right down into dark. High on the right a sealed pocket glows faintly above a smooth shaft.',
    tiles: [
      '################################',
      '#.....................##########',
      '......................#.......##',
      '......................#.......##',
      '......................#.......##',
      '###########...........#####...##',
      '###########...........#####...##',
      '###########...........#####...##',
      '#............----.....#####...##',
      '#.....................#####...##',
      '#.....................#####...##',
      '#.....................#####...##',
      '#.............................##',
      '#.............................##',
      '#..................#############',
      '#..................#############',
      '#..................###.........#',
      '#..................###.........#',
      '#....B.............###.........#',
      '#....B.............###.........#',
      '###########....................#',
      '###########....................#',
      '#..............................#',
      '#..............................#',
      '#...........----...............#',
      '#............................B.#',
      '#.......................^^^^.B.#',
      '#.................##############',
      '#.................##############',
      '#..............................#',
      '#..............................#',
      '#.......ccc....................#',
      '#..............................#',
      '#..............................#',
      '#.......B.....ccc..............#',
      '#.......B......................#',
      '#############..................#',
      '#############..................#',
      '#.vvvvv........................#',
      '#..............................#',
      '#...............----...........#',
      '#..........................B...#',
      '#..........................B...#',
      '#.....................##########',
      '#.....................##########',
      '#..............................#',
      '#.........----.................#',
      '#...............................',
      '#...............................',
      '#...........^^^^^...............',
      '################################',
      '################################',
      '################################',
      '################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 2, w: 1, h: 3, to: { room: 'dc_wake', exit: 'R' }, spawn: { x: 2, y: 4 }, ability: null },
      { id: 'R', side: 'right', x: 31, y: 47, w: 1, h: 3, to: { room: 'dc_cross', exit: 'L' }, spawn: { x: 29, y: 49 }, ability: null },
    ],
    spawns: [
      { type: 'scuttlebit', x: 5, y: 19, patrol: [2, 9] },
      { type: 'driftmoth', x: 16, y: 18 },
      { type: 'driftmoth', x: 14, y: 30 },
      { type: 'hopnode', x: 22, y: 49, patrol: [19, 28] },
      { type: 'scuttlebit', x: 26, y: 42, patrol: [23, 29] },
    ],
    platforms: [],
    nodes: [],
    cores: [
      { id: 'core_dc_fall', x: 24, y: 4, ability: 'gripProtocol' },
    ],
    bits: [
      { x: 14, y: 7, size: 'small' },
      { x: 15, y: 7, size: 'small' },
      { x: 13, y: 23, size: 'medium' },
      { x: 2, y: 35, size: 'small' },
      { x: 3, y: 35, size: 'small' },
      { x: 28, y: 3, size: 'large' },
    ],
    vendor: null,
    boss: null,
  };

  R.dc_cross = {
    id: 'dc_cross', zone: 'driftcache', name: 'Crossrack Hall',
    w: 64, h: 18, gx: 2, gy: 2, gw: 2, gh: 1,
    intro: 'A wide hall of toppled server racks. Two spike pits break the floor; a mound of slabs rises mid-room. Up-left, a shelf six tiles high leads to an opening you cannot reach yet. Far right, a hanging slab with a turret guards two one-way shelves climbing to a hole in the ceiling.',
    tiles: [
      '########################################################...#####',
      '#...................###.....................#######............#',
      '#...................###.....................#######....-----...#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '.......................................................-----...#',
      '...............................................................#',
      '..............................----.............................#',
      '#########.............................................#######..#',
      '#########.............................................#######..#',
      '#.....................----.....................................#',
      '..........B....---..................B...........B.............B.',
      '..........B...............#########.B...........B.............B.',
      '..........B...............#########.B...........B.............B.',
      '##############.....#####################....####################',
      '##############^^^^^#####################^^^^####################',
      '################################################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'dc_fall', exit: 'R' }, spawn: { x: 2, y: 14 }, ability: null },
      { id: 'L2', side: 'left', x: 0, y: 6, w: 1, h: 3, to: { room: 'lw_shaft', exit: 'R2' }, spawn: { x: 2, y: 8 }, ability: 'echoJump' },
      { id: 'R', side: 'right', x: 63, y: 12, w: 1, h: 3, to: { room: 'dc_shrine', exit: 'L' }, spawn: { x: 61, y: 14 }, ability: null },
      { id: 'T', side: 'top', x: 56, y: 0, w: 3, h: 1, to: { room: 'dc_loft', exit: 'B' }, spawn: { x: 57, y: 1 }, ability: 'echoJump' },
    ],
    spawns: [
      { type: 'scuttlebit', x: 8, y: 14, patrol: [2, 12] },
      { type: 'scuttlebit', x: 29, y: 12, patrol: [26, 34] },
      { type: 'hopnode', x: 47, y: 14, patrol: [44, 52] },
      { type: 'spitvalve', x: 57, y: 8, facing: -1 },
      { type: 'driftmoth', x: 37, y: 6 },
    ],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [
      { x: 23, y: 10, size: 'small' },
      { x: 24, y: 10, size: 'small' },
      { x: 31, y: 7, size: 'medium' },
      { x: 32, y: 7, size: 'small' },
      { x: 4, y: 8, size: 'medium' },
      { x: 57, y: 5, size: 'small' },
    ],
    vendor: null,
    boss: null,
  };

  R.dc_loft = {
    id: 'dc_loft', zone: 'driftcache', name: 'The Loft',
    w: 32, h: 18, gx: 3.75, gy: 1, gw: 1, gh: 1,
    intro: 'A cramped attic of racks, warm and silent. A pedestal on the right holds a pulsing core; between you and it a bed of spikes under two crumbling planks and a dropper clinging to the ceiling.',
    tiles: [
      '################################',
      '################################',
      '################################',
      '################################',
      '#....................B.........#',
      '#....................B.........#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#...........................####',
      '#...........................####',
      '#..................cc..cc...####',
      '#...B....B.....................#',
      '#...B....B................###..#',
      '#...B....B........^^^^^^^.###..#',
      '#####...########################',
      '#####...########################',
      '#####...########################',
    ],
    exits: [
      { id: 'B', side: 'bottom', x: 5, y: 17, w: 3, h: 1, to: { room: 'dc_cross', exit: 'T' }, spawn: { x: 6, y: 17 }, ability: null },
    ],
    spawns: [
      { type: 'droplatch', x: 21, y: 4 },
      { type: 'spitvalve', x: 29, y: 8, facing: -1 },
    ],
    platforms: [],
    nodes: [],
    cores: [
      { id: 'core_dc_loft', x: 27, y: 12, ability: 'echoJump' },
    ],
    bits: [
      { x: 19, y: 10, size: 'small' },
      { x: 23, y: 10, size: 'small' },
      { x: 2, y: 14, size: 'medium' },
    ],
    vendor: null,
    boss: null,
  };

  R.dc_shrine = {
    id: 'dc_shrine', zone: 'driftcache', name: 'Rackside Shrine',
    w: 32, h: 18, gx: 4, gy: 2, gw: 1, gh: 1,
    intro: 'A hushed alcove lit by a restore node. Scrivvet the broker crouches by a toppled rack with wares spread on a cloth of cable. No enemies ever spawn here.',
    tiles: [
      '################################',
      '################################',
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............B...............#',
      '#..............B...............#',
      '#...........-------............#',
      '#....B...................B.....#',
      '.....B...................B......',
      '.....B...................B......',
      '.....B...................B......',
      '################################',
      '################################',
      '################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'dc_cross', exit: 'R' }, spawn: { x: 2, y: 14 }, ability: null },
      { id: 'R', side: 'right', x: 31, y: 12, w: 1, h: 3, to: { room: 'dc_sentinel', exit: 'L' }, spawn: { x: 29, y: 14 }, ability: null },
    ],
    spawns: [],
    platforms: [],
    nodes: [
      { id: 'node_dc_shrine', x: 9, y: 14 },
    ],
    cores: [],
    bits: [
      { x: 14, y: 9, size: 'small' },
      { x: 16, y: 9, size: 'small' },
    ],
    vendor: { x: 21, y: 14 },
    boss: null,
  };

  R.dc_sentinel = {
    id: 'dc_sentinel', zone: 'driftcache', name: 'Sentinel Stack',
    w: 48, h: 18, gx: 5, gy: 2, gw: 1.5, gh: 1,
    intro: 'A long gallery floored with fused slabs; two one-way shelves hang at mid-height. At the far right a five-tile block rises to a dark doorway. The moment you cross the threshold the entrance seals and the stack of discs in the centre stands up.',
    tiles: [
      '################################################',
      '################################################',
      '################################################',
      '#...................B..........................#',
      '#...................B..........................#',
      '#..............................................#',
      '#..............................................#',
      '#...............................................',
      '#...............................................',
      '#...............................................',
      '#.......................................########',
      '#.......................................########',
      '........----................----........########',
      '......B...........................B.....########',
      '......B...........................B.....########',
      '################################################',
      '################################################',
      '################################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'dc_shrine', exit: 'R' }, spawn: { x: 3, y: 14 }, ability: null },
      { id: 'R2', side: 'right', x: 47, y: 7, w: 1, h: 3, to: { room: 'lw_hoist', exit: 'L' }, spawn: { x: 44, y: 9 }, ability: 'echoJump' },
    ],
    spawns: [],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [],
    vendor: null,
    boss: { id: 'tallock', bounds: [1, 39], spawn: { x: 25, y: 14 }, pickup: { x: 20, y: 14 }, seal: ['L'], locked: [], final: false },
  };

  // ---- LOOMWORKS (zone 2, DESIGN §6.7–6.11) ------------------------------------------------

  R.lw_hoist = {
    id: 'lw_hoist', zone: 'loomworks', name: 'Hoist Gallery',
    w: 32, h: 36, gx: 6.5, gy: 2, gw: 1, gh: 2,
    intro: 'Rust-orange machinery towers above a floor of crackling static. Two chain hoists ride slowly up and down; moths drift between them. A single pillar with a chute in its crown is the only dry footing at the bottom.',
    tiles: [
      '################################',
      '#.......................########',
      '#.......................########',
      '#.......................########',
      '............B..................#',
      '............B..................#',
      '............B..................#',
      '##########.....................#',
      '##########.....................#',
      '#.vvvvvvv......................#',
      '#...................B..........#',
      '#...................B..........#',
      '#..............................#',
      '#..............................#',
      '#.......................-----..#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#######........................#',
      '#######........................#',
      '#..............................#',
      '#..............................#',
      '#.....................##########',
      '#.....................##########',
      '#..............................#',
      '#...B..........................#',
      '#...B..........................#',
      '#...B..........................#',
      '#...........................B..#',
      '#...........................B..#',
      '#......------#...#------.......#',
      '#............#...#.............#',
      '#............#...#.............#',
      '#~~~~~~~~~~~~#...#~~~~~~~~~#####',
      '##############...###############',
      '##############...###############',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 4, w: 1, h: 3, to: { room: 'dc_sentinel', exit: 'R2' }, spawn: { x: 2, y: 6 }, ability: null },
      { id: 'B', side: 'bottom', x: 14, y: 35, w: 3, h: 1, to: { room: 'lw_belts', exit: 'T' }, spawn: { x: 15, y: 35 }, ability: null },
    ],
    spawns: [
      { type: 'driftmoth', x: 16, y: 13 },
      { type: 'driftmoth', x: 9, y: 27 },
      { type: 'droplatch', x: 27, y: 4 },
    ],
    platforms: [
      { id: 'H1', w: 3, from: { x: 11, y: 9 }, to: { x: 11, y: 20 }, speed: 1, wait: 40 },
      { id: 'H2', w: 3, from: { x: 19, y: 16 }, to: { x: 19, y: 28 }, speed: 1, wait: 40 },
    ],
    nodes: [],
    cores: [],
    bits: [
      { x: 2, y: 17, size: 'medium' },
      { x: 3, y: 17, size: 'small' },
      { x: 26, y: 13, size: 'small' },
      { x: 27, y: 13, size: 'small' },
      { x: 25, y: 21, size: 'medium' },
    ],
    vendor: null,
    boss: null,
  };

  R.lw_belts = {
    id: 'lw_belts', zone: 'loomworks', name: 'Belt Floor',
    w: 96, h: 18, gx: 6.5, gy: 4, gw: 3, gh: 1,
    intro: 'The widest hall in the kingdom: a factory floor three screens long. Two static pools are crossed on sliding belt-platforms. Plated walkers hold the middle mound, a ram-beast paces the far end, and high on the right a two-tile crawlspace with a gap in its floor hides a glowing pedestal.',
    tiles: [
      '##########...###################################################################################',
      '#...............###.................#####...............###....................................#',
      '#...............###.................#####...............###....................................#',
      '#..............................................................................................#',
      '#.......-------.............................................................####################',
      '#..............................................................................................#',
      '#..............................................................................................#',
      '#.........................................................................----######......######',
      '#.........................................................................................######',
      '#...............................................---.......................................######',
      '#........................................................................----.............######',
      '#.........................................................................................######',
      '......B...........................B.......................B...........................B.........',
      '......B...........................B.......................B.###########.B.............B.........',
      '......B...........................B.......................B.###########.B.............B.........',
      '####################~~~~~~~~~~~~############~~~~~~~~~~~~########################################',
      '################################################################################################',
      '################################################################################################',
    ],
    exits: [
      { id: 'T', side: 'top', x: 10, y: 0, w: 3, h: 1, to: { room: 'lw_hoist', exit: 'B' }, spawn: { x: 11, y: 1 }, ability: null },
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'lw_shaft', exit: 'R' }, spawn: { x: 2, y: 14 }, ability: null },
      { id: 'R', side: 'right', x: 95, y: 12, w: 1, h: 3, to: { room: 'lw_rest', exit: 'L' }, spawn: { x: 93, y: 14 }, ability: null },
    ],
    spawns: [
      { type: 'platewalker', x: 38, y: 14, patrol: [33, 42] },
      { type: 'platewalker', x: 65, y: 12, patrol: [60, 70] },
      { type: 'rambyte', x: 82, y: 14, patrol: [72, 93] },
      { type: 'droplatch', x: 17, y: 3 },
      { type: 'droplatch', x: 57, y: 3 },
      { type: 'spitvalve', x: 49, y: 8, facing: -1 },
    ],
    platforms: [
      { id: 'M1', w: 3, from: { x: 21, y: 12 }, to: { x: 28, y: 12 }, speed: 1.5, wait: 20 },
      { id: 'M2', w: 3, from: { x: 45, y: 12 }, to: { x: 52, y: 12 }, speed: 2, wait: 20 },
    ],
    nodes: [],
    cores: [
      { id: 'core_lw_belts', x: 93, y: 6, ability: 'burstLine' },
    ],
    bits: [
      { x: 10, y: 3, size: 'small' },
      { x: 12, y: 3, size: 'small' },
      { x: 49, y: 8, size: 'medium' },
      { x: 75, y: 6, size: 'medium' },
      { x: 88, y: 3, size: 'small' },
    ],
    vendor: null,
    boss: null,
  };

  R.lw_shaft = {
    id: 'lw_shaft', zone: 'loomworks', name: 'Spindle Shaft',
    w: 32, h: 36, gx: 5.5, gy: 3, gw: 1, gh: 2,
    intro: 'A vertical service shaft of hanging spools and one-way grates climbing out of sight. A slow hoist runs the left wall. At the very top a ledge leads left into the dark, back toward the Driftcache.',
    tiles: [
      '################################',
      '#.....................##########',
      '#...............................',
      '#...............................',
      '#...............................',
      '#...................############',
      '#...................############',
      '#..............................#',
      '#........................B.....#',
      '#.............-----......B.....#',
      '#........................B.....#',
      '#..............................#',
      '#.............------...........#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#...------.....................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.....................-------..#',
      '#..............................#',
      '#..B...........................#',
      '#..B...........................#',
      '#...........------.............#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#...................-------....#',
      '#..............................#',
      '#...............B..............#',
      '#...............B...............',
      '#...............B...............',
      '#...........^^^^^^^.............',
      '################################',
      '################################',
    ],
    exits: [
      { id: 'R', side: 'right', x: 31, y: 31, w: 1, h: 3, to: { room: 'lw_belts', exit: 'L' }, spawn: { x: 28, y: 33 }, ability: null },
      { id: 'R2', side: 'right', x: 31, y: 2, w: 1, h: 3, to: { room: 'dc_cross', exit: 'L2' }, spawn: { x: 28, y: 4 }, ability: 'echoJump' },
    ],
    spawns: [
      { type: 'hopnode', x: 6, y: 33, patrol: [2, 10] },
      { type: 'droplatch', x: 16, y: 1 },
      { type: 'driftmoth', x: 18, y: 18 },
      { type: 'hopnode', x: 24, y: 4, patrol: [21, 25] },
    ],
    platforms: [
      { id: 'S1', w: 3, from: { x: 8, y: 30 }, to: { x: 8, y: 10 }, speed: 1.2, wait: 30 },
    ],
    nodes: [],
    cores: [],
    bits: [
      { x: 23, y: 27, size: 'small' },
      { x: 14, y: 23, size: 'small' },
      { x: 6, y: 15, size: 'medium' },
      { x: 16, y: 11, size: 'small' },
      { x: 28, y: 4, size: 'large' },
    ],
    vendor: null,
    boss: null,
  };

  R.lw_rest = {
    id: 'lw_rest', zone: 'loomworks', name: 'Spool Rest',
    w: 32, h: 18, gx: 9.5, gy: 4, gw: 1, gh: 1,
    intro: 'A quiet mezzanine of stacked spools around a restore node. A grated hatch in the floor at the left (one-way grate: press Down + Jump to drop through) leads down into green-lit dark.',
    tiles: [
      '################################',
      '################################',
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..........................B...#',
      '#..........................B...#',
      '#.........B....................#',
      '..........B...........B.........',
      '..........B...........B.........',
      '..........B...........B.........',
      '####---#########################',
      '####...#########################',
      '####...#########################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'lw_belts', exit: 'R' }, spawn: { x: 2, y: 14 }, ability: null },
      { id: 'R', side: 'right', x: 31, y: 12, w: 1, h: 3, to: { room: 'lw_weftyr', exit: 'L' }, spawn: { x: 29, y: 14 }, ability: null },
      { id: 'B', side: 'bottom', x: 4, y: 17, w: 3, h: 1, to: { room: 'bv_catwalk', exit: 'T' }, spawn: { x: 5, y: 17 }, ability: null },
    ],
    spawns: [],
    platforms: [],
    nodes: [
      { id: 'node_lw_rest', x: 15, y: 14 },
    ],
    cores: [],
    bits: [],
    vendor: null,
    boss: null,
  };

  R.lw_weftyr = {
    id: 'lw_weftyr', zone: 'loomworks', name: 'The Great Loom',
    w: 48, h: 18, gx: 10.5, gy: 4, gw: 1.5, gh: 1,
    intro: 'A cathedral of threads strung wall to wall. Three one-way shelves hang at the same height. A one-tile wall at the right screens a hatch in the floor. The loom shuttle overhead begins to spin as the entrance seals.',
    tiles: [
      '################################################',
      '################################################',
      '################################################',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#.....----.........----.........----....#......#',
      '#.......................................#......#',
      '............B...........B...........B...#......#',
      '............B...........B...........B...#......#',
      '............B...........B...........B...#......#',
      '##########################################...###',
      '##########################################...###',
      '##########################################...###',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'lw_rest', exit: 'R' }, spawn: { x: 3, y: 14 }, ability: null },
      { id: 'B', side: 'bottom', x: 42, y: 17, w: 3, h: 1, to: { room: 'bv_sluice', exit: 'T' }, spawn: { x: 43, y: 17 }, ability: null },
    ],
    spawns: [],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [],
    vendor: null,
    boss: { id: 'weftyr', bounds: [1, 39], spawn: { x: 24, y: 8 }, pickup: { x: 20, y: 14 }, seal: ['L', 'B'], locked: [], final: false },
  };

  // ---- BRINEVAULT (zone 3, DESIGN §6.12–6.16) ----------------------------------------------

  R.bv_sluice = {
    id: 'bv_sluice', zone: 'brinevault', name: 'Sluice Run',
    w: 64, h: 18, gx: 11.75, gy: 5, gw: 2, gh: 1,
    intro: 'Pale green coolant drips from every pipe. You land on a high shelf above a two-tile crawlspace; its floor is missing for six tiles above an acid channel. Beyond, the run drops to a flooded floor patrolled by hoppers under a spiked slab, and a spitter on a raised pipe.',
    tiles: [
      '##...###########################################################',
      '##...###########################################################',
      '##...###########################################################',
      '#........######################................................#',
      '#.----...######################................................#',
      '#........######################................................#',
      '#.................................................-------......#',
      '#..............................................................#',
      '###############......##########...###########..................#',
      '###############......##########...###########..................#',
      '#########............####..........vvvvvvvvv...................#',
      '#########............####.......................#####..........#',
      '#########............####...B.................B.............B...',
      '#########............####...B.................B.............B...',
      '#########............####...B.................B.............B...',
      '#########~~~~~~~~~~~~~~~~#######################################',
      '################################################################',
      '################################################################',
    ],
    exits: [
      { id: 'T', side: 'top', x: 2, y: 0, w: 3, h: 1, to: { room: 'lw_weftyr', exit: 'B' }, spawn: { x: 3, y: 1 }, ability: null },
      { id: 'R', side: 'right', x: 63, y: 12, w: 1, h: 3, to: { room: 'bv_cistern', exit: 'L' }, spawn: { x: 61, y: 14 }, ability: 'burstLine' },
    ],
    spawns: [
      { type: 'brinejelly', x: 40, y: 13 },
      { type: 'brinejelly', x: 56, y: 9 },
      { type: 'hopnode', x: 38, y: 14, variant: 'dripnode', patrol: [31, 46] },
      { type: 'spitvalve', x: 50, y: 10, variant: 'acidvalve', facing: -1 },
    ],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [
      { x: 10, y: 7, size: 'small' },
      { x: 12, y: 7, size: 'small' },
      { x: 23, y: 7, size: 'medium' },
      { x: 53, y: 5, size: 'medium' },
      { x: 54, y: 5, size: 'small' },
    ],
    vendor: null,
    boss: null,
  };

  R.bv_cistern = {
    id: 'bv_cistern', zone: 'brinevault', name: 'The Cistern',
    w: 64, h: 36, gx: 13.75, gy: 5, gw: 2, gh: 2,
    intro: 'A cavern two screens tall, its floor an acid lake broken by five rock pillars. An upper gallery of one-way grates and a plated walker on a slab leads to a grate in the ceiling; the right bank holds a brood-cell and a rolling wheel. A high right ledge hides a cache.',
    tiles: [
      '##################################################...###########',
      '##################################################...###########',
      '##################################################...###########',
      '#...................#####.......................-------........#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#...............B..............................................#',
      '#...............B.............................------...........#',
      '#...............B..............................................#',
      '#.........................----.........B................########',
      '#......................................B................########',
      '#.................................###########..................#',
      '..................----............###########..................#',
      '...............................................................#',
      '...............................................................#',
      '###############................................................#',
      '###############................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#.........-------..........cc..................................#',
      '#..............................................................#',
      '#....................cc........................................#',
      '#..............................................................#',
      '#...................................##.........................#',
      '#.......................##..........##.........................#',
      '#.....B...........##....##..........##......B.............B.....',
      '#.....B...........##....##....##....##......B.............B.....',
      '#.....B...........##....##....##....##......B.............B.....',
      '##############~~~~~~~~~~~~~~~~~~~~~~~~~~~#######################',
      '################################################################',
      '################################################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 13, w: 1, h: 3, to: { room: 'bv_sluice', exit: 'R' }, spawn: { x: 2, y: 15 }, ability: null },
      { id: 'T', side: 'top', x: 50, y: 0, w: 3, h: 1, to: { room: 'bv_catwalk', exit: 'B' }, spawn: { x: 51, y: 1 }, ability: null },
      { id: 'R', side: 'right', x: 63, y: 30, w: 1, h: 3, to: { room: 'bv_rest', exit: 'L' }, spawn: { x: 61, y: 32 }, ability: null },
    ],
    spawns: [
      { type: 'brinejelly', x: 20, y: 24 },
      { type: 'brinejelly', x: 28, y: 22 },
      { type: 'brinejelly', x: 34, y: 26 },
      { type: 'platewalker', x: 39, y: 11, patrol: [34, 44] },
      { type: 'scuttlebit', x: 50, y: 32, variant: 'brinecrab', patrol: [42, 60] },
      { type: 'voltwheel', x: 56, y: 32, patrol: [42, 61] },
      { type: 'broodcell', x: 47, y: 32 },
      { type: 'droplatch', x: 22, y: 4 },
    ],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [
      { x: 19, y: 12, size: 'small' },
      { x: 27, y: 9, size: 'small' },
      { x: 21, y: 25, size: 'medium' },
      { x: 27, y: 23, size: 'medium' },
      { x: 58, y: 9, size: 'large' },
      { x: 60, y: 9, size: 'medium' },
      { x: 5, y: 32, size: 'small' },
    ],
    vendor: null,
    boss: null,
  };

  R.bv_catwalk = {
    id: 'bv_catwalk', zone: 'brinevault', name: 'Drip Catwalk',
    w: 32, h: 36, gx: 14.5, gy: 3, gw: 1, gh: 2,
    intro: 'From a hatch above you land on a short ledge; a step down leads into a two-tile crawlspace whose floor breaks over an acid trough. Past it a shaft drops into a lower hall where spikes line the ceiling, jellies drift, and a grate in the floor leads down to the Cistern.',
    tiles: [
      '####...#########################',
      '#..............................#',
      '#..............#################',
      '#..............................#',
      '#########......................#',
      '###############......######....#',
      '###############......######....#',
      '###############~~~~~~######....#',
      '###########################....#',
      '###########################---.#',
      '###########################....#',
      '###########################....#',
      '###########################....#',
      '#.vvvvvvvvvvv..............---.#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.................-----........#',
      '#..............................#',
      '#..............................#',
      '#...B..........................#',
      '#...B...................-----..#',
      '#...B..........................#',
      '#..............................#',
      '#..............................#',
      '#.................-----........#',
      '#..............................#',
      '#..............................#',
      '#...........B..................#',
      '#...........B...........-----..#',
      '#...........B..........B.......#',
      '#...............---....B.......#',
      '#......................B.......#',
      '########~~~~~~~~~~~#######...###',
      '##########################...###',
      '##########################...###',
    ],
    exits: [
      { id: 'T', side: 'top', x: 4, y: 0, w: 3, h: 1, to: { room: 'lw_rest', exit: 'B' }, spawn: { x: 5, y: 1 }, ability: null },
      { id: 'B', side: 'bottom', x: 26, y: 35, w: 3, h: 1, to: { room: 'bv_cistern', exit: 'T' }, spawn: { x: 27, y: 35 }, ability: 'burstLine' },
    ],
    spawns: [
      { type: 'brinejelly', x: 10, y: 20 },
      { type: 'brinejelly', x: 20, y: 27 },
      { type: 'droplatch', x: 18, y: 13 },
      { type: 'hopnode', x: 25, y: 32, variant: 'dripnode', patrol: [23, 30] },
    ],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [
      { x: 11, y: 4, size: 'small' },
      { x: 13, y: 4, size: 'small' },
      { x: 28, y: 8, size: 'medium' },
      { x: 20, y: 16, size: 'small' },
      { x: 26, y: 20, size: 'small' },
      { x: 3, y: 32, size: 'large' },
    ],
    vendor: null,
    boss: null,
  };

  R.bv_rest = {
    id: 'bv_rest', zone: 'brinevault', name: 'Still Basin',
    w: 32, h: 18, gx: 15.75, gy: 6, gw: 1, gh: 1,
    intro: 'A dry basin above the acid line. A restore node glows green on a plinth. Pipes groan to the right where something heavy drags itself along the walls.',
    tiles: [
      '################################',
      '################################',
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............B...............#',
      '#..............B...............#',
      '#....B..................B......#',
      '.....B..................B.......',
      '.....B..................B.......',
      '.....B......#######.....B.......',
      '################################',
      '################################',
      '################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'bv_cistern', exit: 'R' }, spawn: { x: 2, y: 14 }, ability: null },
      { id: 'R', side: 'right', x: 31, y: 12, w: 1, h: 3, to: { room: 'bv_corrosant', exit: 'L' }, spawn: { x: 29, y: 14 }, ability: null },
    ],
    spawns: [],
    platforms: [],
    nodes: [
      { id: 'node_bv_rest', x: 15, y: 13 },
    ],
    cores: [],
    bits: [],
    vendor: null,
    boss: null,
  };

  R.bv_corrosant = {
    id: 'bv_corrosant', zone: 'brinevault', name: 'Brine Keep',
    w: 48, h: 24, gx: 16.75, gy: 5.67, gw: 1.5, gh: 1.33,
    intro: 'A tall vault whose walls weep acid. Five one-way grates hang at two heights; a hatch in the floor at the far right is sealed by a crust of brine. The Keeper uncoils from the ceiling as the door shuts.',
    tiles: [
      '################################################',
      '################################################',
      '################################################',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#.............------........------.............#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#..............................................#',
      '#.......------......--------......------.......#',
      '#..............................................#',
      '......B................B.................B.....#',
      '......B................B.................B.....#',
      '......B................B.................B.....#',
      '##########################################...###',
      '##########################################...###',
      '##########################################...###',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 18, w: 1, h: 3, to: { room: 'bv_rest', exit: 'R' }, spawn: { x: 3, y: 20 }, ability: null },
      { id: 'B', side: 'bottom', x: 42, y: 23, w: 3, h: 1, to: { room: 'ns_base', exit: 'T' }, spawn: { x: 43, y: 23 }, ability: null },
    ],
    spawns: [],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [],
    vendor: null,
    boss: { id: 'corrosant', bounds: [1, 41], spawn: { x: 24, y: 3 }, pickup: { x: 22, y: 20 }, seal: ['L', 'B'], locked: ['B'], final: false },
  };

  // ---- NULLSPIRE (zone 4, DESIGN §6.17–6.20) -----------------------------------------------

  R.ns_base = {
    id: 'ns_base', zone: 'nullspire', name: 'Spire Foot',
    w: 32, h: 36, gx: 18, gy: 7, gw: 1, gh: 2,
    intro: 'Violet dark, white static crawling on every edge. You land on a ledge; a hole at its right end drops into a sheer left-hand well where one-way grates zigzag back up. At the bottom a three-tile tunnel runs under a huge black block; in its ceiling a smooth ten-tile shaft rises to a sealed upper gallery.',
    tiles: [
      '##...###########################',
      '#........#######################',
      '#........###...................#',
      '#........###...................#',
      '######...###...................#',
      '######...###...................#',
      '#........###...................#',
      '#........###...................#',
      '#........###................B..#',
      '#.-----..###................B..#',
      '#........###....B...........B..#',
      '#........###....B..............#',
      '#........###....B..............#',
      '#..-----.###....B..............#',
      '#........###...................#',
      '#........###...................#',
      '#........###...................#',
      '#.-----..###....................',
      '#........###....................',
      '#........###....................',
      '#........###############....####',
      '#..-----.###############....####',
      '#........###############....####',
      '#........###############....####',
      '#........###############....####',
      '#.-----..###############....####',
      '#........###############....####',
      '#........###############....####',
      '#........###############....####',
      '#..-----.###############....####',
      '#..............................#',
      '#....B.........................#',
      '#....B........~~~~.............#',
      '################################',
      '################################',
      '################################',
    ],
    exits: [
      { id: 'T', side: 'top', x: 2, y: 0, w: 3, h: 1, to: { room: 'bv_corrosant', exit: 'B' }, spawn: { x: 3, y: 1 }, ability: null },
      { id: 'R', side: 'right', x: 31, y: 17, w: 1, h: 3, to: { room: 'ns_climb', exit: 'L' }, spawn: { x: 29, y: 19 }, ability: 'gripProtocol' },
    ],
    spawns: [
      { type: 'glarewisp', x: 5, y: 14 },
      { type: 'glarewisp', x: 5, y: 24 },
      { type: 'droplatch', x: 20, y: 30 },
      { type: 'scuttlebit', x: 18, y: 19, variant: 'staticshot', patrol: [13, 23] },
    ],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [
      { x: 4, y: 12, size: 'small' },
      { x: 4, y: 20, size: 'small' },
      { x: 22, y: 31, size: 'medium' },
      { x: 14, y: 18, size: 'medium' },
      { x: 29, y: 18, size: 'small' },
    ],
    vendor: null,
    boss: null,
  };

  R.ns_climb = {
    id: 'ns_climb', zone: 'nullspire', name: 'The Null Spire',
    w: 48, h: 72, gx: 19, gy: 4.22, gw: 1.5, gh: 4,
    intro: 'The empty interior of an inverted spire, four screens tall. A black spine splits it: the left face is crumbling grates and a slow lift; the right face is three sheer shafts stacked over a pit of static. Wisps hunt in the dark. Both faces meet at a crown of one-way grates under a hole in the sky.',
    tiles: [
      '########################################...#####',
      '#..............................................#',
      '#..............................................#',
      '#.....................................-------..#',
      '#..............................................#',
      '#.............................------...........#',
      '#...................--------...................#',
      '#.......................................##.....#',
      '#.......................................##.....#',
      '#.............-----.....................##.....#',
      '#.....................####....B.........##.....#',
      '#.....................####....B.........##.....#',
      '#......#-----.........####....B.........##.....#',
      '#......##.............####..............##.....#',
      '#......##.............####..............##.....#',
      '#......##.............####..............##.....#',
      '####...##.............####............^^##.....#',
      '####...##.............####............####..####',
      '#......##.............####............####..####',
      '#......##.............####.....................#',
      '#......##.............####.....................#',
      '#......##.............####................-----#',
      '#......##.............####.....................#',
      '#......##.............####.....................#',
      '#.....................####.....................#',
      '#.....................####..........ccc........#',
      '#.....................####.....................#',
      '#########.............####.....................#',
      '#########.............####.....................#',
      '#.....................####................-----#',
      '#................ccc..####.....................#',
      '#.....................####.....................#',
      '#.....................####.....................#',
      '#.....................####..........-----......#',
      '#...........ccc.......####......................',
      '#.....................####......................',
      '#.....................####......................',
      '#.....................####....######....########',
      '#########.............####....######....########',
      '#########.............####........##....##.....#',
      '#.....................####........##....##.....#',
      '#.....................####........##....##.....#',
      '#.....................####........##....##.....#',
      '#.....................####........##....##.....#',
      '#.....................####........##....##..B..#',
      '#...B.................####........##....##..B..#',
      '#...B.................####........##....##.....#',
      '#.....................####........##....##.....#',
      '#.....................####........##....##.....#',
      '#.....................####..............##.....#',
      '#.............B.......####..............##.....#',
      '#.............B.......####......############cc##',
      '#.............B.......######....############..##',
      '#.....................######....##.............#',
      '#.....................######....##.............#',
      '#.....................######....##.............#',
      '#.....................######....##.............#',
      '#.....................######....##.............#',
      '#..----...............######....##.............#',
      '#.....................######....##.............#',
      '#.....................######....##.............#',
      '#.........................##....##.............#',
      '#...........ccc...........##..B.##.............#',
      '#.........................##..B.##.............#',
      '#.........................##....##.............#',
      '#.........................##....##.............#',
      '#...-----.................##....##.............#',
      '........................................##.....#',
      '........................................##.....#',
      '........................................##.....#',
      '##################################~~~~~~~~~~~~##',
      '################################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 67, w: 1, h: 3, to: { room: 'ns_base', exit: 'R' }, spawn: { x: 2, y: 69 }, ability: null },
      { id: 'R', side: 'right', x: 47, y: 34, w: 1, h: 3, to: { room: 'ns_plunge', exit: 'L2' }, spawn: { x: 45, y: 36 }, ability: 'gripProtocol' },
      { id: 'T', side: 'top', x: 40, y: 0, w: 3, h: 1, to: { room: 'ns_rest', exit: 'B' }, spawn: { x: 41, y: 1 }, ability: 'gripProtocol' },
    ],
    spawns: [
      { type: 'voltwheel', x: 12, y: 69, patrol: [1, 25] },
      { type: 'glarewisp', x: 14, y: 45 },
      { type: 'glarewisp', x: 36, y: 30 },
      { type: 'glarewisp', x: 30, y: 8 },
      { type: 'droplatch', x: 38, y: 53 },
      { type: 'spitvalve', x: 4, y: 26, facing: 1 },
      { type: 'droplatch', x: 44, y: 19 },
    ],
    platforms: [
      { id: 'L1', w: 3, from: { x: 9, y: 56 }, to: { x: 9, y: 40 }, speed: 1.5, wait: 30 },
    ],
    nodes: [],
    cores: [],
    bits: [
      { x: 40, y: 66, size: 'large' },
      { x: 41, y: 66, size: 'medium' },
      { x: 5, y: 65, size: 'small' },
      { x: 13, y: 61, size: 'medium' },
      { x: 4, y: 37, size: 'small' },
      { x: 3, y: 15, size: 'medium' },
      { x: 38, y: 50, size: 'small' },
      { x: 37, y: 24, size: 'medium' },
      { x: 44, y: 20, size: 'small' },
      { x: 23, y: 5, size: 'large' },
    ],
    vendor: null,
    boss: null,
  };

  R.ns_rest = {
    id: 'ns_rest', zone: 'nullspire', name: 'Crown Rest',
    w: 32, h: 18, gx: 20.1, gy: 3.22, gw: 1, gh: 1,
    intro: 'The open crown of the spire under a sky of static. A restore node sits among broken antenna-spires. The grate you climbed through is at the left; the far wall opens on a long plunge.',
    tiles: [
      '################################',
      '################################',
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.........................B....#',
      '#.........................B....#',
      '#.........B...............B....#',
      '#.........B....................#',
      '#.........B.........B...........',
      '#.........B.........B...........',
      '#.........B.........B...........',
      '####---#########################',
      '####...#########################',
      '####...#########################',
    ],
    exits: [
      { id: 'B', side: 'bottom', x: 4, y: 17, w: 3, h: 1, to: { room: 'ns_climb', exit: 'T' }, spawn: { x: 5, y: 17 }, ability: null },
      { id: 'R', side: 'right', x: 31, y: 12, w: 1, h: 3, to: { room: 'ns_plunge', exit: 'L' }, spawn: { x: 29, y: 14 }, ability: null },
    ],
    spawns: [],
    platforms: [],
    nodes: [
      { id: 'node_ns_rest', x: 15, y: 14 },
    ],
    cores: [],
    bits: [],
    vendor: null,
    boss: null,
  };

  R.ns_plunge = {
    id: 'ns_plunge', zone: 'nullspire', name: 'The Plunge',
    w: 32, h: 54, gx: 21.1, gy: 3.77, gw: 1, gh: 3,
    intro: 'A sheer drop down the outside of the spire. Ledges hold shallow static pools; droppers cling under every overhang; wisps rise to meet you. A side door mid-way leads back into the spire. The floor at the bottom funnels into a hatch lit red from below.',
    tiles: [
      '################################',
      '#...........####################',
      '............####################',
      '...............................#',
      '...............................#',
      '###########....................#',
      '###########....................#',
      '#..............................#',
      '#..............................#',
      '#.............----.............#',
      '#.........................B....#',
      '#.........................B....#',
      '#...................ccc........#',
      '#..............................#',
      '#.....................~~~~~....#',
      '#.................##############',
      '#.................##############',
      '#...................vvvvvvvvv..#',
      '#..............................#',
      '#..............................#',
      '.....B.........................#',
      '.....B.........................#',
      '...............................#',
      '#########......................#',
      '#########......................#',
      '#..............................#',
      '#..........................B...#',
      '#...........----...........B...#',
      '#..............................#',
      '#...................~~~~~......#',
      '#.................##############',
      '#.................##############',
      '#..................vvvvvvvvvvv.#',
      '#..............................#',
      '#..............................#',
      '#...-----......................#',
      '#..............................#',
      '#..............................#',
      '#..B........ccc................#',
      '#..B...........................#',
      '#...~~~~.......................#',
      '###########....................#',
      '###########....................#',
      '#..............................#',
      '#..............................#',
      '#...............-----..........#',
      '#...........................B..#',
      '#...........................B..#',
      '#..............................#',
      '#.......................~~~~~..#',
      '##############...###############',
      '##############...###############',
      '##############...###############',
      '##############...###############',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 2, w: 1, h: 3, to: { room: 'ns_rest', exit: 'R' }, spawn: { x: 2, y: 4 }, ability: null },
      { id: 'L2', side: 'left', x: 0, y: 20, w: 1, h: 3, to: { room: 'ns_climb', exit: 'R' }, spawn: { x: 2, y: 22 }, ability: null },
      { id: 'B', side: 'bottom', x: 14, y: 53, w: 3, h: 1, to: { room: 'rw_gate', exit: 'T' }, spawn: { x: 15, y: 53 }, ability: null },
    ],
    spawns: [
      { type: 'droplatch', x: 19, y: 17 },
      { type: 'droplatch', x: 18, y: 32 },
      { type: 'glarewisp', x: 8, y: 14 },
      { type: 'glarewisp', x: 16, y: 36 },
      { type: 'broodcell', x: 10, y: 49 },
      { type: 'hopnode', x: 28, y: 29, variant: 'nullnode', patrol: [19, 30] },
    ],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [
      { x: 15, y: 8, size: 'small' },
      { x: 16, y: 8, size: 'small' },
      { x: 14, y: 26, size: 'medium' },
      { x: 6, y: 34, size: 'small' },
      { x: 18, y: 44, size: 'medium' },
      { x: 3, y: 49, size: 'large' },
    ],
    vendor: null,
    boss: null,
  };

  // ---- ROOTWELL (zone 5, DESIGN §6.21–6.23) ------------------------------------------------

  R.rw_gate = {
    id: 'rw_gate', zone: 'rootwell', name: 'Root Gate',
    w: 48, h: 18, gx: 21.1, gy: 6.77, gw: 1.5, gh: 1,
    intro: 'Crimson dark and gold filament. Great cable-roots thick as pillars hang from the ceiling. Every corrupted form of the kingdom stands guard here: plated walkers, a ram-beast, spitters on a pedestal and a hanging grate, a brood-cell by the wall, a root-bound patroller under the pedestal and a wisp hunting the dark.',
    tiles: [
      '##############...###############################',
      '##############...###############################',
      '#.....B.....................B.............B....#',
      '#.....B.....................B.............B....#',
      '#.....B.....-------.........B.............B....#',
      '#.....B.....................B.............B....#',
      '#.....B...................................B....#',
      '#.........................................B....#',
      '#.............................-------..........#',
      '#..............................................#',
      '#..............................................#',
      '#...................#######....................#',
      '#...................#######.....................',
      '#...............................................',
      '#...............................................',
      '################################################',
      '################################################',
      '################################################',
    ],
    exits: [
      { id: 'T', side: 'top', x: 14, y: 0, w: 3, h: 1, to: { room: 'ns_plunge', exit: 'B' }, spawn: { x: 15, y: 1 }, ability: null },
      { id: 'R', side: 'right', x: 47, y: 12, w: 1, h: 3, to: { room: 'rw_rest', exit: 'L' }, spawn: { x: 45, y: 14 }, ability: null },
    ],
    spawns: [
      { type: 'platewalker', x: 10, y: 14, variant: 'rootplate', patrol: [4, 18] },
      { type: 'platewalker', x: 32, y: 14, variant: 'rootplate', patrol: [28, 38] },
      { type: 'rambyte', x: 40, y: 14, variant: 'rootram', patrol: [28, 45] },
      { type: 'spitvalve', x: 23, y: 10, variant: 'twinvalve', facing: -1 },
      { type: 'spitvalve', x: 33, y: 7, variant: 'twinvalve', facing: 1 },
      { type: 'broodcell', x: 3, y: 14 },
      { type: 'droplatch', x: 40, y: 2 },
      { type: 'scuttlebit', x: 23, y: 14, variant: 'rootbound', patrol: [19, 27] },
      { type: 'glarewisp', x: 38, y: 9, variant: 'rootwisp' },
    ],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [
      { x: 14, y: 2, size: 'small' },
      { x: 16, y: 2, size: 'small' },
      { x: 23, y: 10, size: 'medium' },
      { x: 33, y: 7, size: 'medium' },
      { x: 44, y: 14, size: 'large' },
    ],
    vendor: null,
    boss: null,
  };

  R.rw_rest = {
    id: 'rw_rest', zone: 'rootwell', name: 'Last Light',
    w: 32, h: 18, gx: 22.6, gy: 6.77, gw: 1, gh: 1,
    intro: 'A pocket of calm in the root-mass. The restore node here burns gold. Scrivvet has followed you all the way down and will not say how. Beyond the far door the floor thrums.',
    tiles: [
      '################################',
      '################################',
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............B...............#',
      '#..............B...............#',
      '#...........-------............#',
      '#....B...................B.....#',
      '.....B...................B......',
      '.....B...................B......',
      '.....B...................B......',
      '################################',
      '################################',
      '################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'rw_gate', exit: 'R' }, spawn: { x: 2, y: 14 }, ability: null },
      { id: 'R', side: 'right', x: 31, y: 12, w: 1, h: 3, to: { room: 'rw_throne', exit: 'L' }, spawn: { x: 29, y: 14 }, ability: null },
    ],
    spawns: [],
    platforms: [],
    nodes: [
      { id: 'node_rw_rest', x: 9, y: 14 },
    ],
    cores: [],
    bits: [],
    vendor: { x: 21, y: 14 },
    boss: null,
  };

  R.rw_throne = {
    id: 'rw_throne', zone: 'rootwell', name: 'The Rootwell',
    w: 64, h: 24, gx: 23.6, gy: 6.44, gw: 2, gh: 1.33,
    intro: 'A vast chamber around a sunken well of light. Cable-roots converge on a throne at the back wall where a crowned, seated mass waits. Two low grates flank the floor and one high grate hangs over the well. The door seals behind you.',
    tiles: [
      '################################################################',
      '################################################################',
      '################################################################',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#.............................BBBB.............................#',
      '#.............................BBBB.............................#',
      '#...........................--------...........................#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#..............................................................#',
      '#.........------................................------.........#',
      '#..............................................................#',
      '#.............................BBBB.............................#',
      '..............................B..B.............................#',
      '........B.....................B..B.....................B.......#',
      '........B.....................B..B.....................B.......#',
      '################################################################',
      '################################################################',
      '################################################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 18, w: 1, h: 3, to: { room: 'rw_rest', exit: 'R' }, spawn: { x: 3, y: 20 }, ability: null },
    ],
    spawns: [],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [],
    vendor: null,
    boss: { id: 'kernauth', bounds: [1, 62], spawn: { x: 32, y: 20 }, pickup: null, seal: ['L'], locked: [], final: true },
  };

  // ---- DEBUG ZONE (engine skeleton) ----------------------------------------------------------
  // Unreachable from the real map; `debug: true` keeps them out of counts and the map screen.
  // Their tilemaps must stay byte-identical: test/smoke.cjs depends on their geometry
  // (test/world.cjs asserts the SHA-1 of each tilemap).
  R.debug_room = {
    id: 'debug_room', zone: 'debug', name: 'Debug Cell A', intro: 'A bare test chamber.',
    w: 32, h: 18, gx: 0, gy: 0, gw: 1, gh: 1, debug: true,
    start: { x: 3, y: 14 },
    tiles: [
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#.........----.................#',
      '#..............................#',
      '#..............................#',
      '#....................-----.....#',
      '#.......................###.....',
      '#.......................###.....',
      '#.........^^............###.....',
      '################################',
      '################################',
      '################################',
    ],
    exits: [
      { id: 'R', side: 'right', x: 31, y: 12, w: 1, h: 3, to: { room: 'debug_room2', exit: 'L' }, spawn: { x: 29, y: 14 }, ability: null },
    ],
    spawns: [
      { type: 'walker', x: 19, y: 14, patrol: [17, 22] },
    ],
    platforms: [],
    nodes: [{ id: 'node_debug', x: 5, y: 14 }],
    cores: [],
    bits: [{ x: 11, y: 7, size: 'small' }, { x: 12, y: 7, size: 'small' }, { x: 14, y: 14, size: 'small' }],
    vendor: null,
    boss: null,
  };

  R.debug_room2 = {
    id: 'debug_room2', zone: 'debug', name: 'Debug Cell B', intro: 'A second chamber with a mover, a crumble ledge and a pool.',
    w: 32, h: 18, gx: 1, gy: 0, gw: 1, gh: 1, debug: true,
    tiles: [
      '################################',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#..........ccc.................#',
      '#..............................#',
      '#..............................#',
      '................................',
      '................................',
      '................~~..............',
      '################################',
      '################################',
      '################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'debug_room', exit: 'R' }, spawn: { x: 2, y: 14 }, ability: null },
      { id: 'R', side: 'right', x: 31, y: 12, w: 1, h: 3, to: { room: 'debug_boss', exit: 'L' }, spawn: { x: 29, y: 14 }, ability: null },
    ],
    spawns: [],
    platforms: [{ id: 'M1', w: 3, from: { x: 5, y: 6 }, to: { x: 14, y: 6 }, speed: 1, wait: 30 }],
    nodes: [],
    cores: [{ id: 'core_debug', x: 25, y: 10 }],
    bits: [{ x: 8, y: 14, size: 'medium' }],
    vendor: null,
    boss: null,
  };

  R.debug_boss = {
    id: 'debug_boss', zone: 'debug', name: 'Debug Arena', intro: 'A sealed arena for the placeholder boss.',
    w: 40, h: 18, gx: 2, gy: 0, gw: 1.25, gh: 1, debug: true,
    tiles: [
      '########################################',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '#......................................#',
      '.......................................#',
      '.......................................#',
      '.......................................#',
      '########################################',
      '########################################',
      '########################################',
    ],
    exits: [
      { id: 'L', side: 'left', x: 0, y: 12, w: 1, h: 3, to: { room: 'debug_room2', exit: 'R' }, spawn: { x: 2, y: 14 }, ability: null },
    ],
    spawns: [],
    platforms: [],
    nodes: [],
    cores: [],
    bits: [],
    vendor: null,
    boss: { id: 'proto_warden', bounds: [8, 38], spawn: { x: 24, y: 14 }, pickup: { x: 20, y: 14 }, seal: ['L'], locked: [], final: false },
  };

  World.normalize();

  // ==========================================================================================
  // RENDER HOOKS. js/render.js (engine-owned) builds one generic background per zone and draws
  // a stub for `B` tiles. Until it calls these painters itself, route it through them: wrap
  // UB.Render.buildBackground → World.background(zone) (same {bg0,bg1,bg2} shape, same 1280×720
  // size) and UB.Render.redrawTiles → original + World.drawProps(...). Idempotent; never
  // installs over a render.js that already marks these `worldAware` or owns `drawProps`.
  // Runs at DOMContentLoaded (registered before main.js's own listener, so before boot) and,
  // as a fallback, on the first World.zoneOf() call the engine makes while loading a room.
  // ==========================================================================================
  World.installRenderHooks = function () {
    const Rd = UB.Render;
    if (!Rd || !hasDoc) return false;
    if (typeof Rd.buildBackground === 'function' && !Rd.buildBackground.worldAware) {
      const build = function (zone) { return World.background(zone); };
      build.worldAware = true;
      Rd.buildBackground = build;
    }
    if (typeof Rd.redrawTiles === 'function' && !Rd.redrawTiles.worldAware && typeof Rd.drawProps !== 'function') {
      const orig = Rd.redrawTiles;
      const redraw = function (level, tx0, ty0, tx1, ty1) {
        // The engine seals a boss's `locked` exits in loadRoom before it has built the room's
        // tile cache; the whole room is drawn (sealed slats included) by buildTileCache right
        // after, so a redraw request with no cache yet is simply skipped instead of throwing.
        if (!level || !level.tileCache) return;
        orig.call(Rd, level, tx0, ty0, tx1, ty1);
        World.drawProps(level, tx0, ty0, tx1, ty1);
      };
      redraw.worldAware = true;
      Rd.redrawTiles = redraw;
    }
    hooksInstalled = true;
    return true;
  };
  if (hasDoc) {
    if (UB.Render) World.installRenderHooks();
    else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { World.installRenderHooks(); });
  }

  UB.World = World;
})(window.UB);
