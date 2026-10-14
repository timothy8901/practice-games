/*
 * UNDERBYTE — js/world.js
 * Owner: WORLD implementer (this file is a STUB written by the engine architect).
 * Contract: CONTRACT.md §4.3 (UB.World). Design: DESIGN.md §5 (zones, tile legend), §6 (rooms).
 *
 * The WORLD implementer replaces `zones` and `rooms` with the 5 zones / 23 rooms
 * of DESIGN.md §6 (copy the tilemaps verbatim as arrays of strings) and sets
 * UB.World.start to dc_wake. KEEP the three `debug_*` rooms and the `debug`
 * zone: the automated smoke test depends on them. They are unreachable from
 * the real map (no real room links to them) and carry `debug: true` so the map
 * screen and the room counter skip them.
 *
 * Coordinates: tile = 30 px, +y down, row 0 is the top row. A tile (tx, ty)
 * covers pixels [tx*30, tx*30+30) × [ty*30, ty*30+30). "Feet on tile (x,y)"
 * means the body's bottom-centre is at (x*30+15, (y+1)*30).
 */
'use strict';
(function (UB) {
  const TILE = 30;

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
    zones: {},
    rooms: {},
    /** Where NEW GAME begins: feet on tile (x, y+1) of `room`; `nodeId` is the first respawn point. */
    start: { room: 'debug_room', x: 3, y: 14, nodeId: 'node_debug' },
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
  /** The zone spec of a room. */
  World.zoneOf = function (room) { return World.zones[room.zone]; };
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
      }
    }
  };
  /** Validate the data; returns an array of error strings (empty = OK). Used by tests. */
  World.validate = function () {
    const errs = [];
    for (const id in World.rooms) {
      const r = World.rooms[id];
      if (!World.zones[r.zone]) errs.push(id + ': unknown zone ' + r.zone);
      if (r.tiles.length !== r.h) errs.push(id + ': ' + r.tiles.length + ' rows, expected ' + r.h);
      for (let y = 0; y < r.tiles.length; y++) {
        if (r.tiles[y].length !== r.w) errs.push(id + ': row ' + y + ' has ' + r.tiles[y].length + ' chars, expected ' + r.w);
        for (let x = 0; x < r.tiles[y].length; x++) if (!(r.tiles[y][x] in LEGEND)) errs.push(id + ': bad tile "' + r.tiles[y][x] + '" at ' + x + ',' + y);
      }
      for (let i = 0; i < r.exits.length; i++) {
        const e = r.exits[i];
        const t = World.rooms[e.to.room];
        if (!t) { errs.push(id + '.' + e.id + ': target room ' + e.to.room + ' missing'); continue; }
        if (!World.exit(t, e.to.exit)) errs.push(id + '.' + e.id + ': target exit ' + e.to.room + '.' + e.to.exit + ' missing');
        for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) {
          if (World.tileAt(r, x, y) !== '.') errs.push(id + '.' + e.id + ': opening tile ' + x + ',' + y + ' is not air');
        }
        if (!e.spawn || !World.isSolid(World.tileAt(r, e.spawn.x, e.spawn.y + 1)) && e.side !== 'top' && e.side !== 'bottom') {
          errs.push(id + '.' + e.id + ': no footing under spawn tile');
        }
      }
    }
    return errs;
  };

  // ==========================================================================
  // STUB DATA — replaced by the WORLD implementer (keep the debug zone/rooms).
  // ==========================================================================
  World.zones.debug = {
    id: 'debug', index: 0, name: 'DEBUG CELL', blurb: 'a test chamber outside the kingdom',
    lore: '', song: 'driftcache', debug: true,
    palette: { bg0: '#0b1220', bg1: '#15213a', bg2: '#1e2f4e', tileFill: '#2a3a5c', tileShade: '#1b2740',
      tileEdge: '#6c86b8', fog: 'rgba(60,80,140,0.18)', glow: '#8fd3ff', hazard: '#8fd3ff', accent: '#8fb6e8' },
  };

  World.rooms.debug_room = {
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

  World.rooms.debug_room2 = {
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

  World.rooms.debug_boss = {
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
    boss: { id: 'proto_warden', bounds: [8, 38], pickup: { x: 20, y: 14 }, seal: ['L'], final: false },
  };

  World.normalize();
  UB.World = World;
})(window.UB);
