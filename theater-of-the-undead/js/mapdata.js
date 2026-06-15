// ============ Kino der Toten — authored layout (world units, +Z = up-screen) ============
// Collision model: an entity is valid if inside any OPEN room rect or OPEN door
// connector rect. Doors gate room access; opening one widens nav + spawns.

export const WALL_H = 4.2;

export const MAP = {
  cellSize: 1.0,
  bounds: { minX: -30, maxX: 30, minZ: -22, maxZ: 48 },

  rooms: {
    theater:  { rect: [-8, -6, 8, 14],   floor: 'wood',   open: true },
    alley:    { rect: [-24, 0, -10, 14],  floor: 'cobble', open: false },
    dressing: { rect: [10, 0, 24, 14],    floor: 'plank',  open: false },
    power:    { rect: [10, -16, 24, -2],  floor: 'cobble', open: false },
    lobby:    { rect: [-8, 16, 8, 28],    floor: 'cobble', open: false },
    upstairs: { rect: [-8, 30, 8, 42],    floor: 'plank',  open: false },
  },

  // door connectors: small bridging rects; opening makes them walkable + joins rooms
  doors: [
    { id: 'door_alley',    a: 'theater',  b: 'alley',    rect: [-10, 4, -8, 10],   cost: 1000 },
    { id: 'door_dressing', a: 'theater',  b: 'dressing', rect: [8, 4, 10, 10],     cost: 1000 },
    { id: 'door_power',    a: 'dressing', b: 'power',    rect: [14, -2, 20, 0],    cost: 1250 },
    { id: 'door_lobby',    a: 'theater',  b: 'lobby',    rect: [-3, 14, 3, 16],    cost: 750 },
    { id: 'door_upstairs', a: 'lobby',    b: 'upstairs', rect: [-3, 28, 3, 30],    cost: 1250 },
  ],

  // barrier windows: zombies spawn at `out`, break boards at `at`, climb to `in`
  windows: [
    { id: 't_s1', room: 'theater', at: [-4, -6], out: [-4, -9.5], in: [-4, -3], boards: 6 },
    { id: 't_s2', room: 'theater', at: [4, -6],  out: [4, -9.5],  in: [4, -3],  boards: 6 },
    { id: 't_w',  room: 'theater', at: [-8, 12], out: [-11.5, 12],in: [-6, 12], boards: 6 },
    { id: 't_e',  room: 'theater', at: [8, 12],  out: [11.5, 12], in: [6, 12],  boards: 6 },
    { id: 'a_w1', room: 'alley',   at: [-24, 4], out: [-27, 4],   in: [-22, 4], boards: 6 },
    { id: 'a_w2', room: 'alley',   at: [-24, 10],out: [-27, 10],  in: [-22, 10],boards: 6 },
    { id: 'a_n',  room: 'alley',   at: [-17, 14],out: [-17, 17],  in: [-17, 12],boards: 6 },
    { id: 'd_e1', room: 'dressing',at: [24, 4],  out: [27, 4],    in: [22, 4],  boards: 6 },
    { id: 'd_n',  room: 'dressing',at: [17, 14], out: [17, 17],   in: [17, 12], boards: 6 },
    { id: 'p_s',  room: 'power',   at: [17, -16],out: [17, -19],  in: [17, -14],boards: 6 },
    { id: 'p_e',  room: 'power',   at: [24, -9], out: [27, -9],   in: [22, -9], boards: 6 },
    { id: 'l_w',  room: 'lobby',   at: [-8, 22], out: [-11.5, 22],in: [-6, 22], boards: 6 },
    { id: 'l_e',  room: 'lobby',   at: [8, 22],  out: [11.5, 22], in: [6, 22],  boards: 6 },
    { id: 'u_n',  room: 'upstairs',at: [-4, 42], out: [-4, 45],   in: [-4, 40], boards: 6 },
    { id: 'u_e',  room: 'upstairs',at: [8, 36],  out: [11.5, 36], in: [6, 36],  boards: 6 },
  ],

  perks: [
    { id: 'quickrevive', perk: 'quickrevive', at: [-6, -3] },
    { id: 'juggernog',   perk: 'juggernog',   at: [-6, 18] },
    { id: 'doubletap',   perk: 'doubletap',   at: [-21, 12] },
    { id: 'speedcola',   perk: 'speedcola',   at: [21, 12] },
  ],

  wallbuys: [
    { id: 'w_m14',   weapon: 'm14',      at: [0, -5.5],  face: [0, 1] },
    { id: 'w_olym',  weapon: 'olympia',  at: [7.5, 2],   face: [-1, 0] },
    { id: 'w_mp5',   weapon: 'mp5k',     at: [6, 18],    face: [0, -1] },
    { id: 'w_ak',    weapon: 'ak74u',    at: [-22, 6],   face: [1, 0] },
    { id: 'w_mpl',   weapon: 'mpl',      at: [22, 6],    face: [-1, 0] },
    { id: 'w_stake', weapon: 'stakeout', at: [12, -14],  face: [0, 1] },
    { id: 'w_m16',   weapon: 'm16',      at: [-7, 36],   face: [1, 0] },
  ],

  traps: [
    { id: 'trap_alley',    at: [-17, 7], cost: 1000, room: 'alley',    r: 4.5 },
    { id: 'trap_dressing', at: [17, 7],  cost: 1000, room: 'dressing', r: 4.5 },
  ],

  boxSpawns: [
    { id: 'bx_theater',  at: [5, 4] },
    { id: 'bx_alley',    at: [-20, 8] },
    { id: 'bx_dressing', at: [20, 8] },
    { id: 'bx_lobby',    at: [0, 24] },
    { id: 'bx_power',    at: [16, -10] },
  ],
  boxStart: 'bx_theater',
  boxCost: 950,

  power: { at: [17, -14], room: 'power' },
  pap: { at: [0, 40], room: 'upstairs', cost: 5000 },
  teleporter: { pad: [0, -4], mainframe: [5, 40] },

  spawn: [0, 5],   // player start
};

// capture authored state so a new game can restore it
const _initOpen = {};
for (const id in MAP.rooms) _initOpen[id] = MAP.rooms[id].open;
const _initBoards = {};
for (const w of MAP.windows) _initBoards[w.id] = w.boards;

export function resetMap() {
  for (const id in MAP.rooms) MAP.rooms[id].open = _initOpen[id];
  for (const d of MAP.doors) d.open = false;
  for (const w of MAP.windows) { w.boards = _initBoards[w.id]; delete w._boardMeshes; }
}
