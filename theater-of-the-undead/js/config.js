// ============ balance data tables ============

// ---- zombie health / round scaling (classic BO formula) ----
export function zombieHealth(round) {
  if (round <= 1) return 150;
  if (round <= 9) return 150 + (round - 1) * 100;          // +100/round up to 950
  return Math.round(950 * Math.pow(1.1, round - 9));        // *1.1 each round after
}
// total zombies spawned in a round (solo curve), and max concurrently alive
export function zombieCount(round) {
  return Math.round(6 + round * 4 + round * round * 0.18);
}
export const MAX_ALIVE = 24;          // hard cap on simultaneous zombies
export const MAX_ZOMBIES = 28;        // instanced-mesh pool size (>= MAX_ALIVE)
export const MAX_DOGS = 12;

// zombie movement speed ramps up with rounds (walk -> sprint)
export function zombieSpeed(round) {
  return Math.min(4.6, 1.5 + round * 0.12);
}
export function isDogRound(round) {
  // hellhounds on round 5, then roughly every 4th round
  return round === 5 || (round > 5 && round % 4 === 0);
}

// ---- points economy ----
export const PTS = {
  hit: 10, kill: 60, headshotKill: 100, meleeKill: 130, repairBoard: 10, dogKill: 50,
};

// ---- power-up drops ----
export const POWERUPS = {
  maxammo:   { label: 'MAX AMMO',     color: 0x3fa0ff, dur: 0 },
  instakill: { label: 'INSTA-KILL',   color: 0xff4444, dur: 30 },
  nuke:      { label: 'NUKE',         color: 0xffd23f, dur: 0 },
  double:    { label: 'DOUBLE POINTS',color: 0xffd23f, dur: 30 },
  carpenter: { label: 'CARPENTER',    color: 0x9b6b3a, dur: 0 },
};
export const DROP_CHANCE = 0.03;       // per normal-zombie kill

// ---- perks ----
export const PERKS = {
  juggernog:   { name: 'JUGGERNOG',    cost: 2500, color: 0xb33636, needsPower: true },
  speedcola:   { name: 'SPEED COLA',   cost: 3000, color: 0x2f9b3a, needsPower: true },
  doubletap:   { name: 'DOUBLE TAP',   cost: 2000, color: 0xc89a2f, needsPower: true },
  quickrevive: { name: 'QUICK REVIVE', cost: 500,  color: 0x3a7bbf, needsPower: false },
};
export const MAX_HP = 100;
export const JUG_HP = 250;

export const PAP_COST = 5000;

// ---- characters (cosmetic) ----
export const CHARACTERS = [
  { id: 'dempsey',   name: 'TANK DEMPSEY',     skin: 0xd9b48a, cloth: 0x44502f, accent: 0x2a3320 },
  { id: 'nikolai',   name: 'NIKOLAI BELINSKI', skin: 0xd8b090, cloth: 0x5a4632, accent: 0x3a2d20 },
  { id: 'takeo',     name: 'TAKEO MASAKI',     skin: 0xe0c098, cloth: 0x6a5a2a, accent: 0x44401c },
  { id: 'richtofen', name: 'EDWARD RICHTOFEN', skin: 0xe8d0b0, cloth: 0x394048, accent: 0x232a30 },
];

// ---- weapons ----
// type: 'hitscan' | 'projectile' | 'melee' | 'launcher'
// rof = rounds/sec, mag = magazine, reserve = spare ammo, reload seconds
// pap = Pack-a-Punched variant overrides (merged onto base)
export const WEAPONS = {
  knife: { name: 'KNIFE', type: 'melee', dmg: 150, rof: 2.2, mag: 0, reserve: 0, reload: 0,
    range: 1.7, color: 0xbfc4cc, melee: true },
  m1911: { name: 'M1911', type: 'hitscan', dmg: 40, rof: 5.5, mag: 8, reserve: 80, reload: 1.6,
    auto: false, range: 55, color: 0x8a8a8a, start: true,
    pap: { name: 'MUSTANG & SALLY', type: 'launcher', dmg: 900, splash: 3.2, mag: 12, reserve: 120, projSpeed: 34 } },
  m14: { name: 'M14', type: 'hitscan', dmg: 90, rof: 4.5, mag: 8, reserve: 120, reload: 2.1,
    auto: false, range: 80, color: 0x6b5536, wall: 500,
    pap: { name: 'MNESIA', dmg: 200, mag: 14, reserve: 180 } },
  olympia: { name: 'OLYMPIA', type: 'hitscan', dmg: 90, rof: 1.4, mag: 2, reserve: 60, reload: 2.4,
    auto: false, range: 18, pellets: 8, spread: 0.22, color: 0x4a3a28, wall: 500,
    pap: { name: 'HADES', dmg: 220, pellets: 10, mag: 2, reserve: 90, fire: true } },
  mp5k: { name: 'MP5K', type: 'hitscan', dmg: 50, rof: 12, mag: 30, reserve: 240, reload: 2.3,
    auto: true, range: 50, color: 0x33373c, wall: 1000,
    pap: { name: 'MP115 KOLLIDER', dmg: 110, mag: 40, reserve: 320 } },
  ak74u: { name: 'AK74u', type: 'hitscan', dmg: 70, rof: 10, mag: 30, reserve: 270, reload: 2.4,
    auto: true, range: 65, color: 0x3a3026, wall: 1200,
    pap: { name: 'AK74fu2', dmg: 150, mag: 40, reserve: 360 } },
  mpl: { name: 'MPL', type: 'hitscan', dmg: 45, rof: 13, mag: 32, reserve: 256, reload: 2.2,
    auto: true, range: 45, color: 0x2e3236, wall: 1000,
    pap: { name: 'MPL-LF', dmg: 100, mag: 42, reserve: 336 } },
  stakeout: { name: 'STAKEOUT', type: 'hitscan', dmg: 130, rof: 1.8, mag: 6, reserve: 60, reload: 3.2,
    auto: false, range: 16, pellets: 7, spread: 0.2, color: 0x5a4630, wall: 1500,
    pap: { name: 'RAID', dmg: 320, pellets: 8, mag: 8, reserve: 90 } },
  m16: { name: 'M16', type: 'hitscan', dmg: 80, rof: 13, mag: 30, reserve: 270, reload: 2.6,
    auto: true, burst: 3, range: 75, color: 0x33352e, wall: 1200,
    pap: { name: 'SKULLCRUSHER', dmg: 170, mag: 40, reserve: 360 } },
  // box-only
  commando: { name: 'COMMANDO', type: 'hitscan', dmg: 100, rof: 10, mag: 30, reserve: 300, reload: 2.6,
    auto: true, range: 80, color: 0x2b2f26, box: 8,
    pap: { name: 'PREDATOR', dmg: 200, mag: 40, reserve: 400 } },
  galil: { name: 'GALIL', type: 'hitscan', dmg: 110, rof: 11, mag: 35, reserve: 315, reload: 3.0,
    auto: true, range: 80, color: 0x4a4030, box: 8,
    pap: { name: 'LAMENTATION', dmg: 230, mag: 50, reserve: 450 } },
  famas: { name: 'FAMAS', type: 'hitscan', dmg: 85, rof: 14, mag: 30, reserve: 270, reload: 2.6,
    auto: true, range: 70, color: 0x35392f, box: 7,
    pap: { name: 'G16-GL35', dmg: 180, mag: 40, reserve: 360 } },
  hk21: { name: 'HK21', type: 'hitscan', dmg: 120, rof: 11, mag: 125, reserve: 375, reload: 4.0,
    auto: true, range: 85, color: 0x2c2e30, box: 6,
    pap: { name: 'H115 OSCILLATOR', dmg: 250, mag: 150, reserve: 600 } },
  raygun: { name: 'RAY GUN', type: 'projectile', dmg: 1000, rof: 4, mag: 20, reserve: 160, reload: 2.4,
    auto: false, range: 60, splash: 2.4, projSpeed: 40, color: 0x6cff5a, box: 6,
    pap: { name: 'PORTER\'S X2', dmg: 2000, mag: 40, reserve: 240, splash: 3.0 } },
  thundergun: { name: 'THUNDERGUN', type: 'cone', dmg: 100000, rof: 1.2, mag: 2, reserve: 12, reload: 3.5,
    auto: false, range: 16, cone: 0.6, knock: 22, color: 0x9fdcff, box: 1.5,
    pap: { name: 'ZEUS CANNON', mag: 3, reserve: 18 } },
  china: { name: 'CHINA LAKE', type: 'launcher', dmg: 1500, rof: 0.9, mag: 2, reserve: 30, reload: 3.0,
    auto: false, range: 60, splash: 3.6, projSpeed: 30, color: 0x3a3a2c, box: 4,
    pap: { name: 'CHINA BEACH', dmg: 3000, mag: 4, reserve: 40, splash: 4.2 } },
  monkey: { name: 'MONKEY BOMB', type: 'tactical', count: 4, color: 0xc0392b, box: 3,
    lure: 14, dur: 6 },
};

// weighted mystery box pool (weight = box field)
export const BOX_POOL = Object.entries(WEAPONS)
  .filter(([, w]) => w.box)
  .map(([id, w]) => ({ id, weight: w.box }));

export function papStats(weapon) {
  if (!weapon.pap) return weapon;
  return Object.assign({}, weapon, weapon.pap, { papped: true, baseId: weapon.id });
}
