/**
 * The field. [SCN-WORLD] — GDD-00 §4, §5, §9, §12, §13, §14; GDD-09 §3.4; ARCHITECTURE §4.
 *
 * Loads the current map from data (`world/tilemap.loadMap`, layout variants resolved), draws it
 * with `render/mapRenderer` (Skyband, the hour's grade, weather, light pools, porch lamps lit by
 * world state, the lighthouse scaffold stage from the loans, the beam after `lit.calls`), places
 * the map's entities (trees with fruit state, signs, props, porches, boats, today's dig cracks) and
 * the neighbours `systems/schedule.whereIs` puts here (driven by `world/npc`), and runs the player
 * (`world/player`: grid steps, run, turn-in-place, the tile's footstep sfx on `player:step`).
 *
 * Tide gates are per tile way: a `tide: 'low'` tile with `way: 'stones'` is walkable while
 * `clockSys.gateTide(world, 'stones')` says the window is open (spring-only tiles also need a spring
 * low; `openFlag` tiles open for good once the flag is set). Bumping a closed way says why and when
 * it opens; a player the sea comes up under wades to `world/tide.nearestDry` ("The sea came up. You
 * waded."). Warps resolve through `world/warps` with the same gate; map changes fade inside this
 * scene and emit `map:enter` (an autosave trigger).
 *
 * The clock runs only here (and in fishing): `clockSys.tick` every update, `weather.update` after
 * it. `day:start` / `clock:anchor` reach `systems/flow/dayFlow` on the bus.
 *
 * Interaction: `world/interact.resolveFacing` (plus the field's own bug and Glint probes) feeds the
 * HUD context chip; confirm hands a copy to `systems/flow/interactFlow.doInteraction(G, action,
 * host)`, the only place verbs push scenes. Wild encounters roll on reed steps
 * (`systems/encounter.rollStep`) and open the battle through `systems/flow/battleFlow` behind an
 * iris. Esc / P: pause menu; M: map screen; V (or Select): the Read / path view; hold C: tool ring,
 * tap C: swap tools.
 * @module scenes/overworld
 */
import { drawText, measureText } from '../core/font.js';
import { TILE, NATIVE_W, NATIVE_H, TRANSITION_MS } from '../config.js';
import { makeRng } from '../core/rng.js';
import { MINUTES_PER_DAY } from '../core/time.js';
import { loadMap, LAYER } from '../world/tilemap.js';
import { createEntities, createEntity, DIR_INDEX, DX, DY, OPPOSITE, dirTo } from '../world/entities.js';
import { createPlayer, dirFromAxes } from '../world/player.js';
import { createCamera } from '../world/camera.js';
import { resolveFacing } from '../world/interact.js';
import { resolveWarp, firesOnStep, markTrigger } from '../world/warps.js';
import { nearestDry, TIDE_MASK } from '../world/tide.js';
import { createNpcDriver, arrivalPoint } from '../world/npc.js';
import { createPathCache } from '../world/pathing.js';
import { createRoamerField, toEntity as roamerEntity, toEncounter as roamerEncounter } from '../world/roamer.js';
import { gradeFor, lampsLit } from '../world/lighting.js';
import { createMapRenderer, MAP_RECT, FULL_RECT } from '../render/mapRenderer.js';
import { getSprite, artDef, resolveArtId } from '../art/atlas.js';
import { drawHud } from '../ui/hud.js';
import { createObjectiveChip, drawObjectiveChip, objectiveFor, CHIP_POLL_MS } from '../ui/objectiveChip.js';
import { createToolRing } from '../ui/toolRing.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { TILES, DEFAULT_LEGEND } from '../data/tilesets.js';
import { TUNING } from '../data/tuning.js';
import { t, has as hasString } from '../data/strings.js';
import { evalCond } from '../script/cond.js';
import * as clockSys from '../systems/clockSys.js';
import * as weather from '../systems/weather.js';
import * as stats from '../systems/stats.js';
import * as encounter from '../systems/encounter.js';
import * as gather from '../systems/gather.js';
import * as schedule from '../systems/schedule.js';
import * as bag from '../systems/bag.js';
import * as party from '../systems/party.js';
import * as letters from '../systems/letters.js';
import { isPorchLit, porchFlag } from '../systems/townCommon.js';
import * as eventScripts from '../systems/flow/eventScripts.js';
import * as dayFlow from '../systems/flow/dayFlow.js';
import { startBattle } from '../systems/flow/battleFlow.js';
import { doInteraction, snapshotAction, laneCtx, ringHas, signText } from '../systems/flow/interactFlow.js';
import { createBoardScene, createCeremonyScene, createFerryScene, ROOF_ART } from './fieldOverlays.js';
import { hasAliveParty, minuteOfDay, tideState as selTideState } from '../state/selectors.js';
import { arrivalScriptOf } from './boot.js';

// ---------------------------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------------------------

/** Map the arrival starts on, and the marker it starts at (GDD-00 §12: 17:40 on the causeway end). */
export const ARRIVAL = Object.freeze({ mapId: 'pellwick', marker: 'arrival-start', x: 63, y: 30, facing: 'left', walk: 4 });
/** Script the arrival plays when the story chapter has written it. */
export const ARRIVAL_SCRIPT = 'arrival';
/** Where a blackout wakes you (the porch step) when the lease card says porch. */
export const HOME = Object.freeze({ mapId: 'pellwick', x: 9, y: 23, facing: 'down' });
/** The starter kit Wren hands over when no arrival script exists yet (GDD-00 §3). */
export const STARTER_KIT = Object.freeze({ tools: ['rod', 'net', 'shovel', 'reading-glass', 'keepers-lantern'], wicks: 5 });
/** Tool ring socket order (GDD-09 §3.6, 12 o'clock clockwise). */
export const RING_ORDER = Object.freeze(['rod', 'net', 'shovel', 'reading-glass', 'keepers-lantern', 'grafting-knife', 'string-lights', 'weatherglass']);
/** Icon per tool (ui/icons). */
export const TOOL_ICONS = Object.freeze({ rod: 'fish', net: 'wiggle', shovel: 'dig', 'reading-glass': 'read', 'keepers-lantern': 'lantern', 'grafting-knife': 'strike', 'string-lights': 'glint', weatherglass: 'wave' });
/** Tide-way kinds clockSys knows. */
export const WAYS = Object.freeze(['causeway', 'stones', 'flats', 'bar', 'spur', 'mainland']);
/** Human names of the ways (for the bump toast). */
export const WAY_NAMES = Object.freeze({ causeway: 'The causeway', stones: 'The stones', flats: 'The flats', bar: 'The Bar road', spur: 'The Bar road', mainland: 'The mainland causeway' }); // str
/** Synthetic glow tile per porch (lit when `sys.porch.<id>` is truthy in the lit-world view). */
const PORCH_GLOW = Object.freeze({ kind: 'porch', color: '#F9C46B', radius: 36, when: 'night', ox: 0, oy: 4 });

const WALLET_SHOW_MS = 2000;
const NPC_REPLAN_MS = 500;
const BUG_REROLL_MIN = 60;
const TOAST_GATE_MS = 2500;

/** Fade length honouring `?noanim=1`. */
function fadeMs(G, ms = TRANSITION_MS) {
  return G.flags && G.flags.noanim ? 0 : ms;
}

/**
 * The Keeper's Cottage roof art colour (MID-13): the latest landed build's roof `choice` (the colour
 * picked at its THWAP; landed builds without one take the default), through the ceremony's art map.
 * @param {any} world
 * @returns {string} art colour (palette ROOF_COLOURS)
 */
export function cottageRoofArt(world) {
  const builds = world && world.loans && Array.isArray(world.loans.builds) ? world.loans.builds : [];
  const done = builds.filter((x) => x && x.done && (typeof x.choice === 'string' || typeof x.roof === 'string'));
  const last = done.length ? done[done.length - 1] : null;
  const c = last ? (last.choice ?? last.roof) : null;
  return c ? (ROOF_ART[c] || c) : 'slate';
}

/**
 * What the Keeper's Cottage shows outside (MID-13, pillar 7 "progress you can see from the
 * porch"): one feature per landed build, in landing order (bedsit, cottage, the four rooms…).
 * @param {any} world
 * @returns {string[]} build ids
 */
export function cottageGrowth(world) {
  const builds = world && world.loans && Array.isArray(world.loans.builds) ? world.loans.builds : [];
  const out = [];
  for (const b of builds) if (b && b.done && typeof b.id === 'string' && !out.includes(b.id)) out.push(b.id);
  return out;
}

/** 12-hour clock text through strings (`hud.time.am/pm`). */
export function clockText(minute) {
  const m = ((Math.floor(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(m / 60), mm = m % 60;
  const hh = ((h + 11) % 12) + 1;
  return t(h < 12 ? 'hud.time.am' : 'hud.time.pm', { time: `${hh}:${String(mm).padStart(2, '0')}` });
}

/**
 * The MapDef with its layout variant applied (GDD-01 §1.14: the LAST variant whose cond holds
 * replaces whole layers and lists).
 * @param {any} base
 * @param {any} world
 * @param {any} data
 * @returns {any}
 */
export function resolveVariant(base, world, data) {
  const vs = Array.isArray(base && base.variants) ? base.variants : [];
  let pick = null;
  for (const v of vs) {
    let ok = false;
    try { ok = v.cond == null ? true : Boolean(evalCond(world, v.cond, { data, mapId: base.id })); } catch { ok = false; }
    if (ok) pick = v;
  }
  if (!pick) return base;
  const { id: _id, cond: _cond, tier: _tier, ...over } = pick;
  return { ...base, ...over, variantId: pick.id, artTier: pick.artTier ?? base.artTier };
}

/**
 * The tide state a tile's way reads now: `'low'` while its window is open, the closed state
 * otherwise. Tiles without a way read the clock's own tide state.
 * @param {any} tileDef
 * @param {Record<string, string>} gates  way -> gate state for this tick
 * @param {string} base    the clock's tide state
 * @param {any} world
 * @param {boolean} spring today is a spring tide
 */
export function gateOfTile(tileDef, gates, base, world, spring) {
  if (!tileDef || !tileDef.way) return base;
  if (tileDef.openFlag && world && world.flags && world.flags[tileDef.openFlag]) return 'low';
  if (tileDef.spring && !spring) return 'high';
  return gates[tileDef.way] || base;
}

// ---------------------------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------------------------

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, isBusy: () => boolean, field: () => any}}
 */
export function createOverworldScene(G) {
  const renderer = createMapRenderer();
  const pathCache = createPathCache();
  let camera = createCamera({ w: MAP_RECT.w, h: MAP_RECT.h });
  const camTarget = { px: 0, py: 0 };

  /** @type {any} */ let mapDef = null;
  /** @type {any} */ let map = null;
  /** @type {any} */ let ents = null;
  /** @type {any} */ let player = null;
  let mapId = '';
  let loadedWorld = null;
  let tiles = TILES;
  let porchEnts = [];
  /** npcId -> {ent, driver, placement, rng} */
  const npcs = new Map();
  let npcTimer = 0;
  let roamers = createRoamerField();
  let roamTimer = 0;
  /** bugs: {key, bugId, x, y, phase, fleeing} */
  let bugs = [];
  let bugHour = -1;
  let glint = null;       // {x, y} when shown
  let sparkles = [];      // [{x, y, sky}]
  let senseTimer = 0;
  let gates = {};
  let gatesAt = -1;
  let spring = false;
  let baseTide = 'mid';
  let action = null;      // current context action (copy)
  let actionKey = '';
  let busy = 0;
  let sceneMs = 0;
  /** scene-time timers: [{at, fn}] */
  let timers = [];
  let floats = [];
  const wobbles = new Map();
  let sitting = null;     // {kind}
  let autoWalk = 0;       // arrival steps left
  let autoDir = 'left';
  let changing = false;
  let readView = false;
  let vLatch = false;
  let toolRing = null;
  let flashTool = null;   // {id, until}
  let captionText = '';
  let captionUntil = 0;
  let wallet = { shown: 0, target: 0, until: 0, slide: 0 };
  // the HUD's "Next:" chip (FH-09): shows for a few seconds after the objective changes or a menu closes
  const nextChip = createObjectiveChip();
  let nextPollMs = 0;
  const CHIP_MENUS = new Set(['menu', 'mapScreen', 'party', 'bag', 'box', 'fieldLog', 'ledger', 'settings', 'saveLoad', 'letter', 'dayPage']);
  let lastGateToast = { key: '', at: -1e9 };
  let litWorld = null;
  let litKey = '';
  let flagsVersion = 0;
  let litVersion = -1;
  let relitAt = null;
  let lastStep = { x: -1, y: -1 };
  let baseRng = null;
  let baseRngSeed = null;
  let wadeCheckMs = 0;
  let entitiesDirty = false;
  let toolsDirty = false;
  let enteredOnce = false;
  const offs = [];
  // Cutscenes own these walks until they land; schedule drivers yield to them.
  const scriptWalks = new Map();
  const stageExtras = new Set();

  const ctx = () => laneCtx(G);
  const world = () => G.world;
  const indoor = () => Boolean(map && map.indoor);
  const rect = () => (indoor() ? FULL_RECT : MAP_RECT);

  function planRng() {
    const seed = G.world.run.seed;
    if (!baseRng || baseRngSeed !== seed) { baseRng = gather.planRng(G.world); baseRngSeed = seed; }
    return baseRng;
  }

  // ---- tide gates ------------------------------------------------------------------------------
  function refreshGates() {
    const w = G.world;
    const total = w.clock && Number.isFinite(w.clock.total) ? Math.floor(w.clock.total) : 0;
    const frozen = G.clock && typeof G.clock.isTideFrozen === 'function' ? G.clock.isTideFrozen() : false;
    if (total === gatesAt && !frozen) return;
    gatesAt = total;
    const opts = { data: G.data, clock: G.clock };
    for (const way of WAYS) {
      try { gates[way] = clockSys.gateTide(w, way, opts); } catch { gates[way] = 'high'; }
    }
    spring = clockSys.isSpringTide(w, G.data);
    baseTide = G.clock && G.clock.tideState ? G.clock.tideState : selTideState(w);
  }

  function tileDefAt(x, y) {
    if (!map || !map.inBounds(x, y)) return null;
    const d = map.layerDef(LAYER.DETAIL, x, y);
    if (d && d.way) return d;
    return map.layerDef(LAYER.GROUND, x, y);
  }

  /** Tide state for one tile (its way's gate). */
  function gateAt(x, y) {
    return gateOfTile(tileDefAt(x, y), gates, baseTide, G.world, spring);
  }

  /** Passability with per-tile gates (what every mover uses). */
  function passable(x, y, _tide, mover) {
    if (!map) return false;
    return map.passable(x, y, gateAt(x, y), mover || 'walk');
  }

  /** Why a tile is closed by the tide, or null. */
  function tideBlock(x, y) {
    const d = tileDefAt(x, y);
    if (!d || !d.way) return null;
    if (map.passable(x, y, gateAt(x, y), 'walk')) return null;
    if (!map.passable(x, y, 'low', 'walk')) return null; // a wall at any tide
    return d;
  }

  // ---- map loading -----------------------------------------------------------------------------
  function porchProps(def) {
    const out = [];
    for (const e of def.entities || []) {
      if (!e || !e.porch) continue;
      out.push({ art: `porch-glow:${e.id}`, x: e.x, y: e.y });
    }
    return out;
  }

  function tilesFor(def) {
    const extra = {};
    for (const p of porchProps(def)) {
      const id = p.art.slice('porch-glow:'.length);
      extra[p.art] = { id: p.art, art: null, glow: { ...PORCH_GLOW, flag: porchFlag(id) } };
    }
    return Object.keys(extra).length ? { ...TILES, ...extra } : TILES;
  }

  function loadCurrent(id) {
    const base = G.data.get('maps', id);
    mapDef = resolveVariant(base, G.world, G.data);
    const extraProps = porchProps(mapDef);
    const def = extraProps.length ? { ...mapDef, props: [...(mapDef.props || []), ...extraProps] } : mapDef;
    tiles = tilesFor(mapDef);
    map = loadMap(def, tiles, { legend: DEFAULT_LEGEND });
    mapId = id;
    ents = createEntities(map);
    scriptWalks.clear();
    stageExtras.clear();
    syncOwnedTools();
    const p = G.world.player;
    player = createPlayer({ x: p.x, y: p.y, facing: p.facing, tool: p.tool, lastTool: p.lastTool, artId: 'char-player' });
    ents.add(player.ent);
    npcs.clear();
    roamers.clear();
    roamers = createRoamerField();
    bugs = [];
    bugHour = -1;
    glint = null;
    sparkles = [];
    pathCache.clear && pathCache.clear();
    const R = rect();
    camera = createCamera({ w: R.w, h: R.h });
    camera.bounds(map);
    gatesAt = -1;
    refreshGates();
    rebuildEntities();
    placeNpcs(true);
    placeTrainers();
    rollBugs(true);
    sense();
    syncCamTarget();
    camera.follow(camTarget, { snap: true });
    loadedWorld = G.world;
    litVersion = -1;
    action = null;
  }

  function rebuildEntities() {
    if (!ents) return;
    ents.rebuildFromDefs(G.world, G.data, baseTide, { placeNpc: () => null });
    porchEnts = ents.list.filter((e) => e.def && e.def.porch);
    // trees: bare art when stripped
    for (const e of ents.list) {
      if (e.kind === 'tree' && e.def) treeArt(e);
      if (e.kind === 'prop' && e.def && e.def.waystone) e.artId = waystoneVisited(e.def.id) ? 'waystone-lit' : 'waystone';
    }
    // today's cracks (dynamic)
    for (const e of ents.list.slice()) if (e.def && e.def.crackKey) ents.remove(e.id);
    if (mapDef.dig) {
      let list = [];
      try { list = gather.cracksFor(G.world, mapDef, planRng(), ctx()); } catch { list = []; }
      for (const c of list) {
        if (c.opened || !map.inBounds(c.x, c.y) || ents.solidAt(c.x, c.y)) continue;
        const id = `crack:${c.key}`;
        if (ents.find(id)) continue;
        ents.add(createEntity({ id, kind: 'crack', x: c.x, y: c.y, artId: 'dig-crack', solid: false, def: { kind: 'crack', id, x: c.x, y: c.y, dynamic: true, crackKey: c.key } }));
      }
    }
    entitiesDirty = false;
  }

  function treeArt(e) {
    const d = e.def;
    if (!d.fruitFrom && !d.fruit) return;
    let st = null;
    try { st = gather.treeState(G.world, mapDef, d, ctx()); } catch { st = null; }
    const art = d.art || 'tree-fruit';
    e.artId = st && st.fruitLeft === 0 && /^tree-fruit/.test(art) ? 'tree-fruit-bare' : art;
  }

  function waystoneVisited(id) {
    return G.world.flags && G.world.flags[`sys.waystone.${id}`] != null;
  }

  // ---- NPCs ------------------------------------------------------------------------------------
  function npcIds() {
    try { return G.data.ids('npcs'); } catch { return []; }
  }

  function placeNpcs(entering) {
    if (!ents) return;
    const minute = minuteOfDay(G.world);
    const seen = new Set();
    for (const id of npcIds()) {
      let pl = null;
      try { pl = schedule.whereIs(id, G.world, G.data, { tuning: TUNING }); } catch { pl = null; }
      const here = pl && pl.mapId === mapId && map.inBounds(pl.x, pl.y);
      const rec = npcs.get(id);
      if (!here) {
        if (rec) { ents.remove(rec.ent.id); npcs.delete(id); }
        continue;
      }
      seen.add(id);
      if (!rec) {
        const ap = arrivalPoint(pl, map, entering ? minute : minute, {});
        if (!ap) continue;
        let x = ap.x, y = ap.y;
        if (ents.solidAt(x, y) || !passable(x, y, null, 'npc')) {
          const free = freeNear(x, y, 'npc');
          if (!free) continue;
          x = free.x; y = free.y;
        }
        const ent = createEntity({ id, kind: 'npc', x, y, facing: ap.facing, npcId: id, artId: `char-${id}`, def: { kind: 'npc', id, dynamic: true } });
        ents.add(ent);
        const driver = createNpcDriver(ent, { tuning: { catchUpTiles: TUNING.npcCatchUpTiles ?? 12 } });
        driver.setPlacement(pl);
        npcs.set(id, { ent, driver, placement: pl, rng: makeRng(`npc:${id}:${G.world.run.seed}`) });
      } else {
        rec.placement = pl;
        rec.driver.setPlacement(pl);
      }
    }
  }

  function freeNear(x, y, mover) {
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx, ny = y + dy;
        if (map.inBounds(nx, ny) && passable(nx, ny, null, mover) && !ents.solidAt(nx, ny)) return { x: nx, y: ny };
      }
    }
    return null;
  }

  function tickNpcs(dt) {
    if (G.scenes.top()?.name === 'cutscene' || G.world.cutscene) return;
    npcTimer += dt;
    if (npcTimer >= NPC_REPLAN_MS) { npcTimer = 0; placeNpcs(false); placeTrainers(); }
    for (const [id, rec] of npcs) {
      if (scriptWalks.has(id) || G.scenes.top()?.name === 'cutscene' || G.world.cutscene) continue;
      const route = rec.placement && rec.placement.pathId ? schedule.routeFor(rec.placement, G.data) : null;
      const st = rec.driver.tick(dt, { map: { id: map.id, w: map.w, h: map.h, passable }, ents, tideState: baseTide, cache: pathCache, rng: rec.rng, route: route || undefined });
      const pose = rec.driver.pose;
      rec.ent.pose = pose === 'porch' || pose === 'sit' ? 'sit' : pose === 'fish' ? 'fish' : null;
      if (st === 'offmap') { ents.remove(rec.ent.id); npcs.delete(id); }
    }
  }

  /** Trainer rosters name authored map posts; story opponents keep their scripted entrances. */
  function placeTrainers() {
    const classes = ['route', 'leader', 'long-road', 'keeper', 'champion'];
    const wanted = new Set();
    let rows = [];
    try { rows = G.data.list('trainers'); } catch { return; }
    for (const t of rows) {
      if (t.map !== mapId || !classes.includes(t.class)) continue;
      if (t.available && !evalCond(G.world, t.available, { data: G.data, mapId })) continue;
      const post = mapDef.markers?.[t.post] ?? mapDef.markers?.[`trainer-${t.id}`];
      if (!post || !map.inBounds(post.x, post.y)) continue;
      const scheduled = t.npc ? npcs.get(t.npc)?.ent : null;
      if (scheduled) { scheduled.def = { ...scheduled.def, trainerId: t.id, name: t.name }; continue; }
      const id = `trainer:${t.id}`;
      wanted.add(id);
      if (ents.find(id)) continue;
      let at = { x: post.x, y: post.y };
      if (!passable(at.x, at.y, null, 'npc') || ents.solidAt(at.x, at.y)) at = freeNear(at.x, at.y, 'npc');
      if (!at) continue;
      const artId = `char-${t.sprite || t.npc || 'trainerVest'}`;
      ents.add(createEntity({ id, kind: 'npc', npcId: t.npc, ...at, facing: post.facing || 'down', artId,
        def: { id, kind: 'npc', dynamic: true, trainerId: t.id, name: t.name } }));
    }
    for (const e of ents.list.slice()) if (e.id.startsWith('trainer:') && !wanted.has(e.id)) ents.remove(e.id);
  }

  // ---- bugs, the Glint, sparkles -----------------------------------------------------------------
  function rollBugs(force) {
    const spots = Array.isArray(mapDef && mapDef.bugSpots) ? mapDef.bugSpots : [];
    const hour = Math.floor(minuteOfDay(G.world) / BUG_REROLL_MIN);
    if (!force && hour === bugHour) return;
    bugHour = hour;
    if (!spots.length) { bugs = []; return; }
    const night = lampsLit(gradeFor(minuteOfDay(G.world), weatherKind(), indoor()));
    const withLight = spots.map((s) => ({ ...s, lit: Boolean(s.porch && night && isPorchLit(G.world, G.data, s.porch, { tuning: TUNING })) }));
    let list = [];
    try { list = gather.rollBugs(G.world, mapDef, withLight, G.rngs.fresh(`bugs:${mapId}:${clockSys.gameDay(G.world)}:${hour}`), ctx()); } catch { list = []; }
    bugs = list.slice(0, 10).map((b, i) => ({ key: `bug:${i}`, bugId: b.id, x: b.x, y: b.y, phase: (b.x * 7 + b.y * 3) % 10, fleeing: 0, fx: 0, fy: 0 }));
  }

  function sense() {
    glint = null;
    sparkles = [];
    if (!mapDef || !mapDef.flats || !player) return;
    try {
      const s = gather.senses(G.world, mapDef, { x: player.ent.x, y: player.ent.y }, planRng(), ctx());
      if (s && s.glint) glint = { x: s.glint.x, y: s.glint.y };
      if (s && Array.isArray(s.skyglass)) for (const k of s.skyglass) sparkles.push({ x: k.x, y: k.y, sky: true, dim: k.dim });
      const low = gather.lowInfo(G.world, ctx());
      if (low.inWindow) {
        for (const sp of gather.sparklesFor(G.world, mapDef, planRng(), low.lowIndex, ctx())) if (!sp.taken) sparkles.push({ x: sp.x, y: sp.y, sky: false });
      }
    } catch { /* the flats keep their secrets */ }
  }

  // ---- lit world (porches) -------------------------------------------------------------------------
  function litView() {
    const w = G.world;
    if (litWorld && litVersion === flagsVersion && Object.getPrototypeOf(litWorld) === w && (sceneMs % 1000) > 17) return litWorld;
    const lit = [];
    for (const e of porchEnts) if (isPorchLit(w, G.data, e.def.id, { tuning: TUNING })) lit.push(e.def.id);
    const key = lit.join(',') + '|' + Object.keys(w.flags).length;
    if (!litWorld || key !== litKey || Object.getPrototypeOf(litWorld) !== w || litVersion !== flagsVersion) {
      const flags = { ...w.flags };
      for (const id of lit) flags[porchFlag(id)] = true;
      litWorld = Object.create(w);
      Object.defineProperty(litWorld, 'flags', { value: flags, enumerable: true });
      litKey = key;
    }
    litVersion = flagsVersion;
    return litWorld;
  }

  // ---- field helpers lent to interactFlow ---------------------------------------------------------
  function toast(text, opts) {
    if (!text) return;
    if (G.toasts && typeof G.toasts.show === 'function') G.toasts.show(String(text), opts || {});
  }
  function after(ms, fn) { timers.push({ at: sceneMs + ms, fn }); }
  function wait(ms) {
    busy++;
    return new Promise((resolve) => after(ms, () => { busy = Math.max(0, busy - 1); resolve(); }));
  }
  function caption(key, vars) {
    captionText = hasString(key) ? t(key, vars) : key;
    captionUntil = sceneMs + 1800;
  }
  function sfx(name, opts) {
    try { if (G.audio && typeof G.audio.sfx === 'function') G.audio.sfx(name, opts || {}); } catch { /* audio is optional */ }
  }

  const host = {
    get mapId() { return mapId; },
    get mapDef() { return mapDef; },
    get map() { return map; },
    get ents() { return ents; },
    get player() { return player; },
    toast,
    wait,
    caption,
    sfx,
    wobble(id, ms, amp = 1) { wobbles.set(id, { until: sceneMs + ms, amp }); },
    float(text, x, y, opts = {}) { floats.push({ text, x: x * TILE + 8, y: y * TILE, t0: sceneMs, color: opts.color === 'brass' ? PALETTE.porchAmber : COLORS.paper.light }); },
    warp: (w) => takeWarp(w, { confirm: true }),
    travel: (to, opts) => travel(to, opts),
    sit: (kind, at) => sit(kind, at),
    refresh: () => { rebuildEntities(); sense(); },
    removeEntity(id) {
      if (ents && ents.find(id)) ents.remove(id);
      const bi = bugs.findIndex((b) => b.key === id);
      if (bi >= 0) bugs.splice(bi, 1);
    },
    faceToward(id) {
      const e = ents && ents.find(id);
      if (!e || !player) return;
      const d = dirTo(player.ent.x - e.x, player.ent.y - e.y);
      if (d) e.facing = d;
    },
    npcPose(id) { const r = npcs.get(id); return r && r.placement ? r.placement.pose || null : null; },
    flashTool(id) { flashTool = { id, until: sceneMs + 900 }; },
    gait() { return player && player.isMoving() ? (player.ent.speedMs < 160 ? 'run' : 'walk') : 'still'; },
    overlays: { createBoardScene, createCeremonyScene, createFerryScene },
    startBattle: (setup) => beginBattle(setup),
  };

  // ---- sitting -----------------------------------------------------------------------------------
  function sit(kind, at) {
    sitting = { kind };
    if (player) player.ent.pose = kind === 'bed' ? null : 'sit';
    void at;
  }
  function standUp() {
    if (!sitting) return;
    if (sitting.kind === 'porch') dayFlow.stand(G);
    sitting = null;
    if (player) player.ent.pose = null;
  }

  // ---- warps and travel ------------------------------------------------------------------------------
  function warpGate(warp) {
    if (warp.openFlag && G.world.flags[warp.openFlag]) return 'low';
    if (warp.way) return gates[warp.way] || baseTide;
    return gateAt(warp.x, warp.y);
  }

  function takeWarp(warp, { confirm = false } = {}) {
    if (!warp || changing) return { ok: false, reason: 'busy' };
    const tide = warpGate(warp);
    let destMap = null;
    if (warp.way && tide !== 'low') return refuseWarp({ ok: false, reason: 'tide', message: t('warp.tide') }, warp);
    let res;
    try {
      res = resolveWarp(G.world, warp, G.data, tide, { mapId, facing: player.ent.facing, destMap });
    } catch (e) {
      res = { ok: false, reason: 'blocked', message: String(e && e.message) };
    }
    if (!res.ok) return refuseWarp(res, warp);
    sfx(warp.kind === 'door' ? 'doorOpen' : 'step');
    G.bus.emit('warp', { from: mapId, to: res.mapId, kind: res.kind, sfx: res.sfx });
    changeMap({ mapId: res.mapId, x: res.x, y: res.y, facing: res.facing }, { kind: warp.kind, confirm });
    return res;
  }

  function refuseWarp(res, warp) {
    const msg = res.reason === 'tide' ? tideMessage(warp.way) : (hasString(`warp.${res.reason}`) ? t(`warp.${res.reason}`) : res.message);
    gateToast(`warp:${warp.x},${warp.y}`, msg);
    G.bus.emit('player:bump', { reason: res.reason });
    return res;
  }

  function tideMessage(way) {
    if (!way) return t('warp.tide');
    let win = null;
    try { win = clockSys.tideWindow(G.world, way, { data: G.data, clock: G.clock }); } catch { win = null; }
    const name = WAY_NAMES[way] || 'The way'; // str
    if (win && !win.open && Number.isFinite(win.minutesUntilChange)) {
      const at = clockText(minuteOfDay(G.world) + Math.ceil(win.minutesUntilChange));
      return `${name} ${way === 'stones' ? 'are' : 'is'} under. Dry again at ${at}.`; // str
    }
    return `${name} ${way === 'stones' ? 'are' : 'is'} under water. ${t('warp.tide')}`; // str
  }

  function gateToast(key, msg) {
    if (lastGateToast.key === key && sceneMs - lastGateToast.at < TOAST_GATE_MS) return;
    lastGateToast = { key, at: sceneMs };
    toast(msg);
  }

  function travel(to, opts = {}) {
    changeMap({ mapId: to.mapId, x: to.x, y: to.y, facing: to.facing || 'down', near: Boolean(to.near) }, opts);
  }

  /** Changes map inside this scene under a fade, then emits `map:enter` (autosave trigger). */
  function changeMap(to, opts = {}) {
    if (changing) return;
    changing = true;
    standUp();
    const swap = () => {
      const from = mapId;
      G.bus.emit('map:exit', { mapId: from });
      G.store.tx('player:warp', (w) => { w.player.mapId = to.mapId; w.player.x = to.x; w.player.y = to.y; w.player.facing = to.facing || w.player.facing; });
      loadCurrent(to.mapId);
      if (to.near) landNear(to.x, to.y);
      changing = false;
      G.bus.emit('map:enter', { mapId: to.mapId, from, kind: opts.kind || 'warp' });
      enterTriggers();
      runPendingSoon();
    };
    const ms = opts.instant ? 0 : fadeMs(G);
    if (ms > 0 && G.scenes && typeof G.scenes.transition === 'function' && G.scenes.transition('fade', ms, swap)) return;
    swap();
  }

  function landNear(x, y) {
    const occupied = ents.near(x, y, 0).some((e) => e !== player.ent && e.solid);
    const spot = passable(x, y, null, 'walk') && !occupied ? { x, y } : freeNear(x, y, 'walk');
    if (!spot) return;
    ents.teleport(player.ent, spot.x, spot.y);
    writePlayer();
    syncCamTarget();
    camera.follow(camTarget, { snap: true });
  }

  function writePlayer() {
    if (!player) return;
    G.store.tx('player:sync', (w) => { player.writeTo(w.player); });
  }

  // ---- encounters ---------------------------------------------------------------------------------
  function beginBattle(setup) {
    busy++;
    const go = () => {
      startBattle(G, setup).then((post) => { busy = Math.max(0, busy - 1); afterBattle(post); }, (e) => {
        busy = Math.max(0, busy - 1);
        toast(e?.message || 'Your companions need a rest before this reading.');
      });
    };
    const ms = fadeMs(G);
    if (ms > 0 && G.scenes.transition('iris', ms, go)) return;
    go();
  }

  function afterBattle(post) {
    if (!post) return;
    if (post.summitBell) {
      // a Summit loss never sends you home (MID-10): the Bell holds your place at whoever beat you
      // (Drift / Flux), or Freefall starts the climb again at the hall door
      const sb = post.summitBell;
      let def = null;
      try { def = G.data.get('maps', sb.mapId); } catch { def = null; }
      const m = def?.markers?.[sb.marker] ?? def?.markers?.['from-door'] ?? null;
      if (m) travel({ mapId: sb.mapId, x: m.x, y: m.y, facing: m.facing || 'up', near: true }, { kind: 'summit-bell' });
      if (sb.line) toast(sb.line);
    }
    if (post.blackout) {
      // battleFlow already healed the party and advanced the blackout hour.
      toast('"You came home carried. I kept your place."'); // str
      if (mapId !== HOME.mapId || player.ent.x !== HOME.x || player.ent.y !== HOME.y) travel({ ...HOME }, { kind: 'blackout' });
    }
    if (post.script) G.store.tx('battle:script', (w) => eventScripts.queue(w, post.script));
    runPendingSoon();
  }

  function onStep(ev) {
    const w = G.world;
    const x = ev.x, y = ev.y;
    lastStep = { x, y };
    const info = map.tileAt(x, y);
    G.store.tx('player:step', (ww) => { player.writeTo(ww.player); stats.inc(ww, 'steps', 1); });
    G.bus.emit('player:step', { x, y, facing: ev.dir, run: ev.run, mapId, sfx: info && info.sfx ? info.sfx : null, terrain: info && info.sfx === 'stepWater' ? 'wet' : (info && info.id) || null });
    // Staged walks still make footsteps, but must not start encounters or take a door mid-scene.
    if (G.scenes.top() !== scene) return;
    // bugs spook on approach
    for (const b of bugs) {
      if (b.fleeing) continue;
      try { if (gather.isSpooked(b.bugId ? { id: b.bugId, x: b.x, y: b.y } : b, { x, y, gait: ev.run ? 'run' : 'walk' }, ctx())) b.fleeing = 1; } catch { /* row missing */ }
    }
    // warps on step
    const warp = map.warpAt(x, y);
    if (warp && firesOnStep(warp)) { takeWarp(warp); return; }
    // step triggers (story)
    for (const trg of map.triggersAt(x, y)) {
      if (trg.kind !== 'step' && trg.kind !== 'enter') continue;
      if (queueTrigger(trg, x, y)) { runPendingSoon(); return; }
    }
    // roamers touched
    const r = roamers.touchingAt(x, y);
    if (r && hasAliveParty(w)) {
      const enc = roamerEncounter(r);
      roamers.remove(r.id, 'caught');
      if (ents.find(r.id)) ents.remove(r.id);
      G.store.tx('encounter:roamer', (ww) => encounter.noteEncounter(ww, { ...enc, mapId }, ctx()));
      beginBattle({ kind: 'wild', wild: { speciesId: enc.speciesId, level: enc.level, errant: enc.errant, habitat: 'grass' }, source: 'route' });
      return;
    }
    // wild encounter roll on encounter tiles
    if (!hasAliveParty(w)) {
      G.store.tx('encounter:count', (ww) => { if (ww.encounter) ww.encounter.steps = Math.min(encounter.STEPS_CAP, (ww.encounter.steps || 0) + 1); });
      return;
    }
    const res = G.store.tx('encounter:step', (ww) => encounter.rollStep(ww, map, G.rngs.stream(encounter.streamLabel(mapId)), { x, y, data: G.data, tuning: TUNING, bus: G.bus, tideState: gateAt(x, y) }));
    if (res) beginBattle({ kind: 'wild', wild: { speciesId: res.speciesId, level: res.level, errant: res.errant, habitat: 'grass' }, source: 'route' });
  }

  function queueTrigger(trg, x, y) {
    const w = G.world;
    if (trg.once && w.maps[mapId]?.opened?.includes(trg.id)) return false;
    if (trg.cond != null && !evalCond(w, trg.cond, { data: G.data, mapId, x, y })) return false;
    if (!trg.script || !G.data.has('scripts', trg.script) || w.cutscene?.scriptId === trg.script) return false;
    G.store.tx('trigger:queue', (ww) => {
      eventScripts.queue(ww, trg.script);
      if (trg.once) markTrigger(ww, mapId, trg.id);
    });
    return true;
  }

  function enterTriggers() {
    for (const trg of map.triggersAt(player.ent.x, player.ent.y)) {
      if (trg.kind === 'enter' && queueTrigger(trg, player.ent.x, player.ent.y)) break;
    }
  }

  function onBump(ev) {
    const fx = ev.x + DX[DIR_INDEX[ev.dir]], fy = ev.y + DY[DIR_INDEX[ev.dir]];
    G.bus.emit('player:bump', { x: fx, y: fy, dir: ev.dir });
    const d = map && map.inBounds(fx, fy) ? tideBlock(fx, fy) : null;
    if (d) gateToast(`way:${d.way}`, tideMessage(d.way));
  }

  /** The sea came up under you: wade to the nearest dry tile. */
  function wadeCheck() {
    if (!player || player.isMoving() || changing || autoWalk > 0) return;
    const { x, y } = player.ent;
    if (passable(x, y, null, 'walk')) return;
    const g = gateAt(x, y);
    let spot = null;
    try { spot = nearestDry(map, x, y, g === 'low' ? 'high' : g, { maxDist: 64 }); } catch { spot = null; }
    if (!spot || !passable(spot.x, spot.y, null, 'walk') || ents.solidAt(spot.x, spot.y)) spot = freeNear(x, y, 'walk');
    if (!spot) return;
    ents.teleport(player.ent, spot.x, spot.y);
    writePlayer();
    sfx('splash');
    toast(t('tide.wade'));
    G.bus.emit('player:wade', { from: { x, y }, to: { x: spot.x, y: spot.y } });
  }

  // ---- context action -----------------------------------------------------------------------------
  function bugAt(x, y) {
    return bugs.find((b) => !b.fleeing && b.x === x && b.y === y) || null;
  }

  function computeAction() {
    if (!player || player.isMoving() || changing) return null;
    // Story staging often names the keeper's standing marker, rather than the board's tile.
    // A use beat can therefore be read from that marker as well as from the facing tile.
    for (const trg of map.triggersAt(player.ent.x, player.ent.y)) {
      if (trg.kind !== 'use' || !trg.script || !G.data.has('scripts', trg.script)) continue;
      if (trg.once && G.world.maps[mapId]?.opened?.includes(trg.id)) continue;
      if (trg.cond != null && !evalCond(G.world, trg.cond, { data: G.data, mapId, x: player.ent.x, y: player.ent.y })) continue;
      return { verb: 'use', label: 'Use', prompt: 'Use', icon: 'read', kind: 'trigger', targetKind: 'trigger', targetId: trg.id, target: trg, disabled: null,
        payload: { x: player.ent.x, y: player.ent.y, script: trg.script } };
    }
    const ft = player.facingTile();
    const b = bugAt(ft.x, ft.y);
    if (b) {
      const canNet = ringHas(G.world, 'net');
      const row = G.data.has('collections', b.bugId) ? G.data.get('collections', b.bugId) : null;
      return { verb: canNet ? 'catch' : 'read', label: canNet ? t('verb.net') : t('verb.read'), prompt: row ? row.name : 'Bug', icon: canNet ? 'wiggle' : 'read', kind: 'roamer', targetKind: 'roamer', targetId: b.key, target: { id: b.key, x: b.x, y: b.y, kind: 'roamer', def: { bug: true, bugId: b.bugId, catchable: true } }, disabled: null, payload: { x: ft.x, y: ft.y } };
    }
    const a = resolveFacing(player.ent, map, ents, G.world, G.data, { tideState: map.inBounds(ft.x, ft.y) ? gateAt(ft.x, ft.y) : baseTide });
    if (a) {
      const snap = snapshotAction(a);
      if (snap.target?.def?.trainerId) {
        snap.verb = 'challenge'; snap.label = 'Challenge'; snap.icon = 'strike';
        snap.payload.trainerId = snap.target.def.trainerId;
      }
      if (snap.verb === 'board' && snap.target && snap.target.def && snap.target.def.verb) {
        const v = snap.target.def.verb;
        snap.verb = v; snap.label = hasString(`verb.${v}`) ? t(`verb.${v}`) : v[0].toUpperCase() + v.slice(1);
      }
      if (snap.verb === 'enter') snap.icon = 'door';
      return snap;
    }
    if (glint && glint.x === ft.x && glint.y === ft.y) {
      const canDig = ringHas(G.world, 'shovel') || toolUse() === 'dig';
      return { verb: 'dig', label: t('verb.dig'), prompt: 'The Glint', icon: 'dig', kind: 'mud', targetKind: 'mud', targetId: 'glint', target: null, disabled: canDig ? null : t('verb.needsTool', { tool: 'shovel' }), payload: { x: ft.x, y: ft.y } }; // str
    }
    return null;
  }

  function toolUse() {
    const id = G.world.player.tool;
    const row = id && G.data.has('items', id) ? G.data.get('items', id) : null;
    return row && row.use ? row.use : null;
  }

  /** Whether a dig/fish/catch verb is allowed because its tool is on the ring (the ring auto-offers it). */
  function relaxTool(a) {
    if (!a || !a.disabled) return a;
    const need = { fish: 'rod', dig: 'shovel', catch: 'net' }[a.verb];
    if (need && ringHas(G.world, need)) return { ...a, disabled: null };
    return a;
  }

  function perform(a) {
    if (!a || busy > 0) return;
    const act = relaxTool(a);
    let res;
    try {
      res = doInteraction(G, act, host);
    } catch (e) {
      console.error('overworld: interaction failed', e);
      return;
    }
    if (res && typeof res.then === 'function') {
      busy++;
      res.then(() => { busy = Math.max(0, busy - 1); }, (e) => { busy = Math.max(0, busy - 1); console.error('overworld: interaction failed', e); });
    }
  }

  // ---- tool ring --------------------------------------------------------------------------------------
  function ringTools() {
    const owned = Array.isArray(G.world.player.toolRing) ? G.world.player.toolRing : [];
    return RING_ORDER.map((id) => (owned.includes(id) ? { id, name: itemName(id), icon: TOOL_ICONS[id] || 'strike' } : null));
  }
  function itemName(id) {
    return id && G.data.has('items', id) ? G.data.get('items', id).name : id;
  }
  function ensureRing() {
    if (toolRing) return toolRing;
    toolRing = createToolRing({
      tools: ringTools(),
      current: G.world.player.tool,
      last: G.world.player.lastTool,
      center: { x: 240, y: 135 },
      onEquip: (id) => equip(id),
      onSwap: (cur) => equip(cur, true),
    });
    return toolRing;
  }
  function equip(id, swapped) {
    if (!player) return;
    if (swapped) player.swapTool(); else player.setTool(id);
    writePlayer();
    if (id) toast(t('toolRing.swapped', { tool: itemName(player.tool) }));
  }

  // ---- arrival -----------------------------------------------------------------------------------------
  function arrive() {
    const arrival = arrivalScriptOf(G.data);
    let start = { x: ARRIVAL.x, y: ARRIVAL.y, facing: ARRIVAL.facing };
    try {
      const m = G.data.get('maps', ARRIVAL.mapId).markers && G.data.get('maps', ARRIVAL.mapId).markers[ARRIVAL.marker];
      if (m) start = { x: m.x, y: m.y, facing: m.facing || ARRIVAL.facing };
    } catch { /* default */ }
    G.store.tx('arrival:place', (w) => {
      w.player.mapId = ARRIVAL.mapId; w.player.x = start.x; w.player.y = start.y; w.player.facing = start.facing;
      if (arrival) eventScripts.queue(w, arrival);
      else giveStarterKit(w);
    });
    if (!arrival) { autoWalk = ARRIVAL.walk; autoDir = start.facing; }
  }

  function giveStarterKit(w) {
    const c = laneCtx(G, { source: 'starter-kit' });
    for (const id of STARTER_KIT.tools) if (G.data.has('items', id) && !bag.has(w, id, 1, undefined, c)) bag.give(w, id, 1, c);
    if (G.data.has('items', 'tallow-wick')) bag.give(w, 'tallow-wick', STARTER_KIT.wicks, c);
    const ring = RING_ORDER.filter((id) => STARTER_KIT.tools.includes(id) && G.data.has('items', id));
    w.player.toolRing = ring;
    if (!w.player.tool) { w.player.tool = ring[0] || null; w.player.lastTool = ring[1] || null; }
  }

  /** Story and shop grants enter the satchel first; owned tools are always ready on the ring. */
  function syncOwnedTools() {
    const owned = RING_ORDER.filter((id) => G.data.has('items', id) && bag.has(G.world, id, 1, undefined, ctx()));
    const p = G.world.player;
    const same = owned.length === p.toolRing.length && owned.every((id, i) => id === p.toolRing[i]);
    if (!same || (!p.tool && owned.length)) {
      G.store.tx('tools:ring', (w) => {
        w.player.toolRing = owned;
        if (!w.player.tool || !owned.includes(w.player.tool)) { w.player.tool = owned[0] ?? null; w.player.lastTool = owned[1] ?? null; }
      });
    }
    toolsDirty = false;
  }

  function runPendingSoon() {
    after(1, () => {
      if (G.scenes.top() !== scene || changing) return;
      try { eventScripts.runPending(G); } catch (e) { console.error('overworld: pending script failed', e); }
    });
  }

  /** The cutscene host's concrete stage: every story walk, spawn, pan and warp acts on the field. */
  const stage = {
    entity: (who) => ents?.find(who) ?? null,
    get camera() { return camera; },
    walk(who, dirs, opts = {}) {
      const e = ents?.find(who);
      if (!e) return false;
      scriptWalks.set(who, { dirs: dirs.slice(), run: Boolean(opts.run) });
      return true;
    },
    isMoving: (who) => Boolean(scriptWalks.has(who) || ents?.find(who)?.moving),
    face(who, dir) {
      const e = ents?.find(who);
      if (e && Object.hasOwn(DIR_INDEX, dir)) { e.facing = dir; if (e === player.ent) writePlayer(); }
    },
    teleport(who, x, y, toMap = null) {
      scriptWalks.delete(who);
      if (who === 'player' && toMap && toMap !== mapId) {
        changeMap({ mapId: toMap, x, y, facing: G.world.player.facing }, { kind: 'script', instant: true });
        return;
      }
      let e = ents?.find(who);
      if (!map.inBounds(x, y)) return;
      if (!e && G.data.has('npcs', who)) {
        stage.spawn(who, `char-${who}`, x, y);
        e = ents.find(who);
      }
      if (!e) return;
      ents.teleport(e, x, y);
      if (e === player.ent) { player.intend(null); writePlayer(); syncCamTarget(); camera.follow(camTarget, { snap: true }); }
    },
    spawn(who, artId, x, y) {
      if (!map?.inBounds(x, y)) return;
      if (ents.find(who)) { stage.teleport(who, x, y); ents.find(who).artId = artId; return; }
      ents.add(createEntity({ id: who, kind: 'npc', npcId: G.data.has('npcs', who) ? who : null, x, y, artId, def: { id: who, kind: 'npc', dynamic: true } }));
      stageExtras.add(who);
    },
    despawn(who) { if (who !== 'player') { scriptWalks.delete(who); npcs.delete(who); ents?.remove(who); } },
    warp: (toMap, x, y, facing = 'down') => changeMap({ mapId: toMap, x, y, facing }, { kind: 'script', instant: true }),
  };

  function advanceScriptWalks() {
    for (const [who, walk] of scriptWalks) {
      const e = ents.find(who);
      if (!e) { scriptWalks.delete(who); continue; }
      if (e.moving) continue;
      if (!walk.dirs.length) { scriptWalks.delete(who); continue; }
      const dir = walk.dirs.shift();
      if (!ents.tryMove(e, dir, { passable, tideState: baseTide, run: walk.run })) {
        // A blocked staged path ends here; the script's next line can still progress.
        scriptWalks.delete(who);
      }
    }
  }

  // ---- camera --------------------------------------------------------------------------------------------
  function syncCamTarget() {
    if (!player) return;
    const e = player.ent;
    const di = DIR_INDEX[e.facing];
    const look = e.moving ? 10 : 0;
    camTarget.px = e.px + DX[di] * look;
    camTarget.py = e.py + DY[di] * look + shoreEase();
  }

  /** At the shore the camera eases down toward the horizon (GDD-00 §14). */
  let shore = 0;
  function shoreEase() {
    if (!map || indoor()) return 0;
    const { x, y } = player.ent;
    let water = 0;
    for (let k = 1; k <= 4; k++) {
      const info = map.tileAt(x, y + k);
      if (info && info.water) { water = 5 - k; break; }
    }
    const want = Math.min(24, water * 6);
    shore += (want - shore) * 0.05;
    return Math.round(shore);
  }

  // ---- bus ------------------------------------------------------------------------------------------------
  function listen() {
    if (offs.length) return;
    const on = (evt, fn) => offs.push(G.bus.on(evt, fn));
    on('flag:set', () => { flagsVersion++; entitiesDirty = true; });
    on('loan:built', () => { flagsVersion++; entitiesDirty = true; });
    on('loan:paid', () => { flagsVersion++; });
    on('day:start', () => { entitiesDirty = true; flagsVersion++; });
    on('world:replaced', () => { loadedWorld = null; });
    on('gather:shake', () => { entitiesDirty = true; });
    on('bag:changed', () => { toolsDirty = true; });
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('keydown', vListener);
      offs.push(() => globalThis.removeEventListener('keydown', vListener));
    }
  }

  // ---- update -----------------------------------------------------------------------------------------------
  function ensureMap() {
    const w = G.world;
    if (!w.player.mapId) arrive();
    if (!G.data.has('maps', w.player.mapId)) {
      console.warn(`overworld: unknown map '${w.player.mapId}', going to ${ARRIVAL.mapId}`);
      G.store.tx('player:rescue', (ww) => { ww.player.mapId = ARRIVAL.mapId; ww.player.x = ARRIVAL.x; ww.player.y = ARRIVAL.y; });
    }
    if (!map || mapId !== w.player.mapId || loadedWorld !== w) {
      loadCurrent(w.player.mapId);
      G.bus.emit('map:enter', { mapId, kind: enteredOnce ? 'load' : 'enter' });
      enterTriggers();
      enteredOnce = true;
      return true;
    }
    // a debug warp on the same map
    if (!player.isMoving() && (player.ent.x !== w.player.x || player.ent.y !== w.player.y)) {
      if (map.inBounds(w.player.x, w.player.y)) {
        ents.teleport(player.ent, w.player.x, w.player.y, w.player.facing);
        syncCamTarget();
        camera.follow(camTarget, { snap: true });
      }
    }
    return false;
  }

  function tickClock(dt) {
    G.store.tx('clock:tick', (w) => {
      clockSys.tick(w, G.clock, dt, { bus: G.bus, data: G.data }); // the world clock advances only here and in fishing
      stats.addPlayMs(w, dt);
      weather.update(w, G.data, planRng(), { bus: G.bus });
    });
  }

  function weatherKind() {
    try { return weather.current(G.world, G.data).kind || 'clear'; } catch { return 'clear'; }
  }

  const scene = {
    name: 'overworld',
    opaque: true,
    enter(params) {
      listen();
      sceneMs = 0;
      timers = [];
      busy = 0;
      changing = false;
      const fresh = params && params.fresh;
      if (fresh || !G.world.player.mapId) {
        if (!G.world.player.mapId) arrive();
      }
      ensureMap();
      runPendingSoon();
    },
    exit() {
      for (const off of offs.splice(0)) { try { off(); } catch { /* gone */ } }
      standUp();
    },
    pause() {
      if (player) player.intend(null, false);
      try { if (CHIP_MENUS.has(G.scenes.top()?.name)) nextChip.arm(); } catch { /* no stack */ }
    },
    resume(result) {
      if (G.input && typeof G.input.flush === 'function') G.input.flush();
      ensureMap();
      if (!G.world.cutscene) {
        for (const id of stageExtras) if (!npcs.has(id)) ents.remove(id);
        stageExtras.clear(); scriptWalks.clear();
      }
      rebuildEntities();
      sense();
      syncOwnedTools();
      player.readFrom(G.world.player, ents);
      if (toolRing) toolRing.setTools(ringTools());
      camera.follow(camTarget);
      void result;
      if (nextChip.resumed(sceneMs)) nextPollMs = CHIP_POLL_MS; // re-read now; the chip shows again
      runPendingSoon();
    },
    update(dt) {
      sceneMs += dt;
      // timers
      if (timers.length) {
        const due = timers.filter((tm) => tm.at <= sceneMs);
        if (due.length) { timers = timers.filter((tm) => tm.at > sceneMs); for (const tm of due) tm.fn(); }
      }
      if (ensureMap()) return;
      if (G.scenes.top() === scene && !changing) tickClock(dt);
      if (G.scenes.top() === scene && busy === 0 && !changing && eventScripts.peekPending(G.world)) {
        if (eventScripts.runPending(G)) return;
      }
      refreshGates();
      if (toolsDirty && !player.isMoving()) { syncOwnedTools(); player.readFrom(G.world.player, ents); if (toolRing) toolRing.setTools(ringTools()); }
      if (entitiesDirty) { rebuildEntities(); sense(); }
      senseTimer += dt;
      if (senseTimer >= 500) { senseTimer = 0; sense(); rollBugs(false); }
      // player
      const locked = busy > 0 || changing || G.scenes.top() !== scene || (toolRing && toolRing.open);
      player.setLocked(locked && autoWalk <= 0);
      advanceScriptWalks();
      if (autoWalk > 0 && !player.isMoving() && !changing) {
        const ok = ents.tryMove(player.ent, autoDir, { passable, tideState: baseTide, speedMs: 220 });
        if (ok) autoWalk--; else autoWalk = 0;
      }
      const events = player.update(dt, { ents, map, passable, tideState: baseTide });
      for (const ev of events) {
        if (ev.type === 'step') onStep(ev);
        else if (ev.type === 'turn') writePlayer();
        else if (ev.type === 'bump') onBump(ev);
        if (changing) break;
      }
      if (player.ent.moving && autoWalk >= 0) {
        // the auto-walk arrival writes position when it lands (no encounters)
      }
      if (!player.ent.moving && (G.world.player.x !== player.ent.x || G.world.player.y !== player.ent.y) && !changing) writePlayer();
      // other entities
      // The player controller already advanced its entity and produced the landing event.
      // Advancing it here too can land between controller ticks, losing warps and encounters.
      for (const e of ents.list) if (e !== player.ent && e.moving) ents.tickMovement(e, dt);
      tickNpcs(dt);
      tickRoamers(dt);
      tickBugs(dt);
      // the sea came up
      wadeCheckMs += dt;
      if (wadeCheckMs >= 250) { wadeCheckMs = 0; wadeCheck(); }
      // context action
      action = locked ? null : computeAction();
      // camera
      syncCamTarget();
      camera.update(dt);
      // wallet slide
      const main = G.world.wallet ? G.world.wallet.main : 0;
      if (main !== wallet.target) { wallet.target = main; wallet.until = sceneMs + WALLET_SHOW_MS; if (!wallet.shown) wallet.shown = main; }
      if (wallet.shown !== wallet.target) {
        const d = wallet.target - wallet.shown;
        wallet.shown += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) / 8));
      }
      const showing = sceneMs < wallet.until;
      wallet.slide += ((showing ? 1 : 0) - wallet.slide) * (showing ? 0.3 : 0.2);
      if (toolRing) toolRing.update(dt);
      // the objective, re-read about once a second while the field is in charge
      nextPollMs += dt;
      if (nextPollMs >= CHIP_POLL_MS && G.scenes.top() === scene && busy === 0 && !changing && !G.world.cutscene) {
        nextPollMs = 0;
        let line = '';
        try { line = objectiveFor(G.world, G.data)?.text ?? ''; } catch { line = ''; }
        nextChip.observe(line, sceneMs);
      }
      floats = floats.filter((f) => sceneMs - f.t0 < 1200);
      if (G.flags && G.flags.debug && G.debugOverlay == null) { /* nothing */ }
      // lighthouse relit moment
      if (G.world.flags['lit.calls'] && relitAt === null) relitAt = sceneMs;
    },
    handleInput(input) {
      if (!player || changing) return;
      // the tool ring owns input while held / open
      const ring = ensureRing();
      if (busy === 0) {
        ring.handle(input);
        if (ring.open) { player.intend(null, false); return; }
      }
      if (busy > 0) return;
      if (input.pressed('map')) {
        if (G.sceneFactories && G.sceneFactories.mapScreen) { G.push('mapScreen', { from: 'field', mapId }); return; }
      }
      if (input.pressed('select') || takeV()) { readView = !readView; sfx('blip'); }
      const axis = input.axis();
      const dir = dirFromAxes(axis.x, axis.y, player.ent.facing);
      if (sitting && (dir || input.pressed('cancel') || input.pressed('confirm'))) {
        standUp();
        toast(t('rest.stand'));
        player.intend(null, false);
        return;
      }
      if (input.pressed('confirm') && action && !player.isMoving()) {
        player.intend(null, false);
        perform(action);
        return;
      }
      if (input.pressed('menu') || input.pressed('start')) { player.intend(null, false); G.push('menu'); return; }
      if (input.pressed('cancel') && readView) { readView = false; return; }
      player.intend(dir, input.held('run'));
    },
    draw(c) {
      if (!map) {
        c.fillStyle = PALETTE.nightInk; c.fillRect(0, 0, NATIVE_W, NATIVE_H);
        return;
      }
      const w = G.world;
      const minute = minuteOfDay(w);
      const R = rect();
      const lit = litView();
      const relit = Boolean(w.flags['lit.calls']);
      const shakeE = applyWobbles();
      const stats0 = renderer.drawFrame(G, {
        ctx: c, map, entities: ents, camera, minute, weather: weatherKind(), tide: G.clock ? G.clock.tide : 0.5,
        time: sceneMs, day: clockSys.gameDay(w), flags: lit.flags, world: lit,
        lighthouse: { stage: (w.loans && w.loans.scaffold) || 0, relit, relitAt: relitAt ?? -Infinity },
        player: player.ent, lantern: ringHas(w, 'keepers-lantern') && !indoor(), skyband: !indoor(), rect: R,
        comet: Math.min(1, clockSys.gameDay(w) / 14), tier: mapDef.artTier ?? (w.loans ? Math.max(0, w.loans.tier - 1) : 0), roof: roofColour(),
        cond: (cd) => { try { return Boolean(evalCond(w, cd, { data: G.data, mapId })); } catch { return false; } },
        reducedMotion: Boolean(w.settings && w.settings.reducedMotion), lowPower: G.lowPower, tideDial: false,
      });
      restoreWobbles(shakeE);
      if (G.perf) { G.perf.chunks = stats0.chunks; G.perf.entities = stats0.sprites; }
      c.save();
      c.beginPath(); c.rect(R.x, R.y, R.w, R.h); c.clip();
      drawCottageGrowth(c, R);
      drawPorchLamps(c, R, minute);
      drawSignLabels(c, R);
      drawGlintAndSparkles(c, R);
      drawBugs(c, R);
      if (readView) drawReadView(c, R);
      drawFloats(c, R);
      c.restore();
      drawHudLayer(c, minute);
      if (toolRing) {
        const sx = player.ent.px + 8 - camera.x + R.x, sy = player.ent.py + 8 - camera.y + R.y;
        toolRing.center.x = Math.max(60, Math.min(420, sx));
        toolRing.center.y = Math.max(70, Math.min(200, sy));
        toolRing.draw(c);
      }
    },
    debugText: () => {
      const offered = relaxTool(action);
      const a = offered ? `${offered.label}${offered.disabled ? ` (${offered.disabled})` : ''}` : '-';
      return `${mapId} ${player ? `${player.ent.x},${player.ent.y} ${player.ent.facing}` : ''} ${clockText(minuteOfDay(G.world))} tide ${baseTide} verb ${a}${captionText && sceneMs < captionUntil ? `\n${captionText}` : ''}`;
    },
    isBusy: () => busy > 0 || changing || autoWalk > 0 || Boolean(player && player.isMoving()),
    stage,
    /** Test / debug view of the field. */
    field: () => ({ mapId, map, mapDef, ents, player, npcs, bugs, glint, sparkles, gates: { ...gates }, baseTide, action, sitting, readView, busy, host, gateAt, passable, camera }),
    /** Test / debug view of the HUD's Next chip (FH-09). */
    nextChip: () => ({ text: nextChip.text, alpha: nextChip.alpha(sceneMs) }),
  };

  // ---- V latch (no input action exists for the Read view yet; GDD-09 §4.2 request) ---------------------
  const vListener = (ev) => { if (ev && ev.code === 'KeyV' && !ev.repeat) vLatch = true; };
  function takeV() { const v = vLatch; vLatch = false; return v; }

  // ---- roamers --------------------------------------------------------------------------------------------
  function tickRoamers(dt) {
    const spawns = (mapDef.spawns || []).filter((s) => s && s.roamers);
    if (!spawns.length && !roamers.list.length) return;
    roamTimer += dt;
    const rng = G.rngs.stream(encounter.streamLabel(mapId));
    const occupied = (x, y) => ents.solidAt(x, y);
    if (spawns.length && roamers.spawnDue(dt)) {
      const sp = spawns[0];
      const table = G.data.has('encounters', sp.table) ? G.data.get('encounters', sp.table) : null;
      if (table) {
        const r = roamers.spawn(rng, table, { id: map.id, w: map.w, h: map.h, passable, spawnAt: map.spawnAt }, baseTide, { tableId: sp.table, spawnDef: sp, player: { x: player.ent.x, y: player.ent.y }, occupied, world: G.world, data: G.data });
        if (r && !ents.find(r.id)) { try { ents.add(roamerEntity(r)); } catch { roamers.remove(r.id); } }
      }
    }
    const res = roamers.tick(rng, dt, {
      player: { x: player.ent.x, y: player.ent.y }, passable, tideState: baseTide, occupied,
      tryStep: (r, d) => { const e = ents.find(r.id); return e ? ents.tryMove(e, d, { passable, tideState: baseTide }) : false; },
    });
    for (const r of res.despawned) if (ents.find(r.id)) ents.remove(r.id);
  }

  // ---- bugs -------------------------------------------------------------------------------------------------
  function tickBugs(dt) {
    for (const b of bugs) {
      if (b.fleeing) {
        b.fleeing += dt;
        b.fy -= dt * 0.03; b.fx += dt * 0.02;
      }
    }
    bugs = bugs.filter((b) => !b.fleeing || b.fleeing < 900);
  }

  // ---- wobble ------------------------------------------------------------------------------------------------
  function applyWobbles() {
    const moved = [];
    for (const [id, wb] of wobbles) {
      if (sceneMs > wb.until) { wobbles.delete(id); continue; }
      const e = ents.find(id);
      if (!e) continue;
      const off = ((Math.floor(sceneMs / 50) & 1) ? 1 : -1) * wb.amp;
      e.px += off;
      moved.push([e, off]);
    }
    return moved;
  }
  function restoreWobbles(moved) {
    for (const [e, off] of moved) e.px -= off;
  }

  // ---- draw helpers --------------------------------------------------------------------------------------------
  function roofColour() {
    return cottageRoofArt(G.world);
  }

  /**
   * The cottage's exterior growth over the seven loans (MID-13), drawn over the baked tiles on
   * Pellwick: the bedsit's patched gable, the cottage's chimney and second window, and one
   * visible addition per commissioned room.
   */
  function drawCottageGrowth(c, R) {
    if (mapId !== 'pellwick') return;
    const grown = cottageGrowth(G.world);
    if (!grown.length) return;
    const reg = mapDef && mapDef.regions && mapDef.regions['keepers-cottage'];
    const ox = R.x + ((reg ? reg.x : 6) + 1) * TILE - camera.x; // roof left edge (x 7)
    const oy = R.y + (reg ? reg.y : 19) * TILE - camera.y;      // roof top (y 19)
    if (ox > R.x + R.w + 32 || oy > R.y + R.h + 32 || ox < R.x - 128 || oy < R.y - 96) return;
    const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(ox + x), Math.round(oy + y), w, h); };
    const glow = lampsLit(gradeFor(minuteOfDay(G.world), weatherKind(), false)) ? PALETTE.porchAmber : '#3B4A6B';
    for (const id of grown) {
      switch (id) {
        case 'bedsit': // new boards on the gable, a tidy door frame
          px(2, 33, 2, 30, '#8A5A30'); px(76, 33, 2, 30, '#8A5A30'); break;
        case 'cottage': { // chimney with a curl of smoke, and the second window
          px(60, -10, 8, 14, '#6B4F3A'); px(59, -11, 10, 2, '#4C3826');
          const k = Math.floor(sceneMs / 400) % 3;
          px(62 + k, -16 - k * 2, 3, 3, 'rgba(232,225,210,0.7)');
          px(12, 40, 10, 8, glow); px(12, 44, 10, 1, '#4C3826'); px(16, 40, 1, 8, '#4C3826');
          break;
        }
        case 'greenhouse': // a glass lean-to on the west wall
          px(-14, 34, 14, 30, '#9FD4C8'); px(-14, 34, 14, 1, '#E8F6F0');
          for (let i = 0; i < 3; i++) px(-13 + i * 5, 35, 1, 29, '#5E8C80');
          px(-12, 56, 10, 6, '#5A8F3C'); break;
        case 'workshop': // a plank lean-to on the east wall with a little vice sign
          px(80, 38, 14, 26, '#7A5230'); px(78, 34, 18, 4, '#4C3826'); px(84, 44, 6, 4, '#C9C2B0'); break;
        case 'training-yard': // chalk ring and a straw dummy beside the porch
          px(86, 66, 20, 1, '#F6F1E3'); px(86, 74, 20, 1, '#F6F1E3'); px(94, 56, 4, 12, '#D9B45A'); px(91, 60, 10, 2, '#D9B45A'); break;
        case 'cellar': // the cellar hatch at the foot of the wall
          px(56, 60, 16, 6, '#5A3A22'); px(64, 60, 1, 6, '#3B2A1E'); break;
        case 'porch-loft': // a dormer with the telescope poking out
          px(30, 6, 18, 14, '#6B4F3A'); px(34, 10, 10, 8, glow); px(46, 8, 8, 2, '#C8A04A'); break;
        case 'gallery': // a long picture window
          px(44, 40, 26, 8, glow); px(44, 44, 26, 1, '#4C3826'); px(57, 40, 1, 8, '#4C3826'); break;
        default: break;
      }
    }
  }

  /**
   * Hanging shop signs (art `hanging-sign-*`, FH-09) say their name on a small paper strip over
   * the board while the player is within three tiles, so a door can be found without knocking.
   */
  function drawSignLabels(c, R) {
    if (!player || busy > 0) return;
    const px = player.ent.x, py = player.ent.y;
    for (const e of ents.list) {
      const d = e.def;
      if (!d || typeof d.art !== 'string' || !d.art.startsWith('hanging-sign-') || typeof d.name !== 'string' || !d.name) continue;
      if (Math.max(Math.abs(e.x - px), Math.abs(e.y - py)) > 3) continue;
      const label = signText(G, d.name);
      const tw = measureText(label, { font: 'small' }).w;
      const sx = Math.round(R.x + e.px + 6 - camera.x - tw / 2);
      const sy = Math.round(R.y + e.py - 8 - camera.y); // above the board: the player stands below it
      c.fillStyle = 'rgba(20, 27, 51, 0.35)'; c.fillRect(sx - 2, sy - 1, tw + 5, 9);
      c.fillStyle = '#F6F1E3'; c.fillRect(sx - 3, sy - 2, tw + 5, 9);
      c.fillStyle = '#2A2433'; c.fillRect(sx - 3, sy + 6, tw + 5, 1);
      drawText(c, label, sx, sy, { font: 'small', color: '#2A2433' });
    }
  }

  function drawPorchLamps(c, R, minute) {
    const grade = gradeFor(minute, weatherKind(), indoor());
    if (!lampsLit(grade)) return;
    let art = null;
    try { art = resolveArtId('porch-lamp'); } catch { art = null; }
    if (!art) return;
    const def = artDef(art);
    for (const e of porchEnts) {
      if (!isPorchLit(G.world, G.data, e.def.id, { tuning: TUNING })) continue;
      const sx = R.x + e.px - camera.x, sy = R.y + e.py + 16 - def.h - camera.y;
      if (sx < -16 || sy < -32 || sx > R.x + R.w || sy > R.y + R.h) continue;
      const img = getSprite(art, { name: 'lit', grade });
      c.drawImage(img.canvas, sx, sy);
    }
  }

  function drawGlintAndSparkles(c, R) {
    const twinkle = (x, y, color, phase) => {
      const sx = R.x + x * TILE + 8 - camera.x, sy = R.y + y * TILE + 8 - camera.y;
      const k = ((sceneMs + phase * 137) % 900) / 900;
      const s = k < 0.5 ? 1 : 2;
      c.fillStyle = color;
      c.fillRect(sx - s, sy, s * 2 + 1, 1);
      c.fillRect(sx, sy - s, 1, s * 2 + 1);
    };
    if (glint) twinkle(glint.x, glint.y, PALETTE.porchAmber, 0);
    for (const s of sparkles) twinkle(s.x, s.y, s.sky ? (s.dim ? '#8A5A9E' : '#FF5BD6') : '#F6F1E3', s.x + s.y);
  }

  function drawBugs(c, R) {
    for (const b of bugs) {
      const bob = Math.sin((sceneMs / 180) + b.phase) * 3;
      const sx = Math.round(R.x + b.x * TILE + 8 - camera.x + b.fx + Math.cos(sceneMs / 300 + b.phase) * 3);
      const sy = Math.round(R.y + b.y * TILE + 4 - camera.y + b.fy + bob);
      const flap = (Math.floor(sceneMs / 90) + b.phase) & 1;
      c.fillStyle = '#141B33';
      c.fillRect(sx, sy, 1, 2);
      c.fillStyle = b.fleeing ? '#F6F1E3' : '#F9C46B';
      if (flap) { c.fillRect(sx - 2, sy - 1, 2, 1); c.fillRect(sx + 1, sy - 1, 2, 1); }
      else { c.fillRect(sx - 1, sy, 1, 1); c.fillRect(sx + 1, sy, 1, 1); }
    }
  }

  function drawFloats(c, R) {
    for (const f of floats) {
      const k = (sceneMs - f.t0) / 1200;
      const sx = R.x + f.x - camera.x, sy = R.y + f.y - camera.y - 4 - Math.round(k * 14);
      drawText(c, f.text, sx, sy, { align: 'center', color: f.color, shadow: true, font: 'small' });
    }
  }

  /** Read / path view: tide-gated ways open (dotted) or under (crossed) with when they change. */
  function drawReadView(c, R) {
    c.fillStyle = 'rgba(20, 27, 51, 0.35)';
    c.fillRect(R.x, R.y, R.w, R.h);
    const x0 = Math.max(0, Math.floor(camera.x / TILE)), y0 = Math.max(0, Math.floor(camera.y / TILE));
    const x1 = Math.min(map.w - 1, x0 + Math.ceil(R.w / TILE) + 1), y1 = Math.min(map.h - 1, y0 + Math.ceil(R.h / TILE) + 1);
    const labels = new Map();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = tileDefAt(x, y);
      if (!d || !d.way) continue;
      const open = map.passable(x, y, gateAt(x, y), 'walk');
      const sx = R.x + x * TILE - camera.x, sy = R.y + y * TILE - camera.y;
      c.fillStyle = open ? '#3FF2E0' : '#A8323A';
      if (open) { for (let i = 0; i < 16; i += 4) { c.fillRect(sx + i, sy + 7, 2, 2); } }
      else { for (let i = 2; i < 14; i++) { c.fillRect(sx + i, sy + i, 1, 1); c.fillRect(sx + 15 - i, sy + i, 1, 1); } }
      if (!labels.has(d.way)) labels.set(d.way, { x: sx, y: sy, open });
    }
    for (const [way, l] of labels) {
      let win = null;
      try { win = clockSys.tideWindow(G.world, way, { data: G.data, clock: G.clock }); } catch { win = null; }
      const mins = win && Number.isFinite(win.minutesUntilChange) ? Math.round(win.minutesUntilChange) : null;
      const txt = `${WAY_NAMES[way] || way}: ${l.open ? 'open' : 'under'}${mins != null ? `, ${l.open ? 'closes' : 'opens'} ${clockText(minuteOfDay(G.world) + mins)}` : ''}`; // str
      const tw = measureText(txt, { font: 'small' }).w;
      const lx = Math.max(R.x + 4, Math.min(R.x + R.w - tw - 8, l.x - tw / 2));
      const ly = Math.max(R.y + 4, l.y - 12);
      c.fillStyle = 'rgba(20, 27, 51, 0.8)'; c.fillRect(lx - 2, ly - 2, tw + 4, 9);
      drawText(c, txt, lx, ly, { font: 'small', color: l.open ? '#3FF2E0' : '#F6F1E3' });
    }
    // interactables
    for (const e of ents.list) {
      if (e === player.ent || !(e.kind === 'npc' || e.kind === 'sign' || (e.def && e.def.verb))) continue;
      const sx = R.x + e.px + 6 - camera.x, sy = R.y + e.py - 6 - camera.y;
      c.fillStyle = '#F9C46B'; c.fillRect(sx, sy, 3, 3);
    }
    drawText(c, 'Read view (V)', R.x + R.w - 6, R.y + R.h - 20, { align: 'right', font: 'small', color: '#F6F1E3', shadow: true }); // str
  }

  function drawHudLayer(c, minute) {
    const w = G.world;
    const device = G.input && G.input.lastDevice ? G.input.lastDevice : 'keyboard';
    const tool = player.tool ? { id: player.tool, name: itemName(player.tool), icon: TOOL_ICONS[player.tool] || 'strike' } : null;
    const flash = flashTool && sceneMs < flashTool.until ? { id: flashTool.id, name: itemName(flashTool.id), icon: TOOL_ICONS[flashTool.id] || 'strike' } : null;
    const a = action ? relaxTool(action) : null;
    const verb = a ? { verb: a.verb, label: hasString(`verb.${a.verb}`) ? t(`verb.${a.verb}`) : a.label, icon: a.icon, enabled: !a.disabled, reason: a.disabled || '' } : null;
    const night = clockSys.isNight(w, G.data);
    const tideDir = baseTide === 'falling' || baseTide === 'low' ? 'falling' : 'rising';
    drawHud(c, {
      clockText: clockText(minute), night, showClock: true,
      tide: G.clock ? G.clock.tide : 0.5, tideDir, tideHint: tideHint(),
      tool: flash || tool, contextVerb: busy > 0 ? null : verb,
      pendingShift: (w.pendingShifts || []).length, device,
    });
    if (wallet.slide > 0.02) {
      c.save();
      c.translate(Math.round((1 - wallet.slide) * 90), 0);
      drawHud(c, { wallet: wallet.shown });
      c.restore();
    }
    if (G.scenes.top() === scene && busy === 0 && !G.world.cutscene) {
      const a = nextChip.alpha(sceneMs);
      if (a > 0) drawObjectiveChip(c, nextChip.text, { x: 4, y: 21, maxW: 300, alpha: a });
    }
    if (sitting && sitting.kind === 'porch') drawText(c, t('rest.sitting'), 240, 236, { align: 'center', font: 'small', color: '#F6F1E3', shadow: true });
    if (captionText && sceneMs < captionUntil) {
      const tw = measureText(captionText, { font: 'small' }).w;
      c.fillStyle = 'rgba(20, 27, 51, 0.85)'; c.fillRect(240 - tw / 2 - 4, 224, tw + 8, 11);
      drawText(c, captionText, 240, 226, { align: 'center', font: 'small', color: '#F6F1E3' });
    }
  }

  function tideHint() {
    try {
      const now = G.world.clock.total;
      const day = clockSys.gameDay(G.world);
      const ext = [...clockSys.tidesForDay(day, G.data), ...clockSys.tidesForDay(day + 1, G.data)].filter((e) => e.total > now).sort((a, b) => a.total - b.total)[0];
      if (!ext) return '';
      const n = Math.max(1, Math.round(ext.total - now));
      const span = n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}` : ''}` : `${n}`;
      return ext.kind === 'low' ? t('tide.lowIn', { n: span }) : t('tide.highIn', { n: span });
    } catch { return ''; }
  }

  return scene;
}

/**
 * Debug hook bindings that live with the field (draft §11): `deliverLetter`, `addCreature`,
 * `heal`, and wrappers that refresh the music after `setTime` / `setTide`. `warp` writes the
 * player record and the overworld follows it on its next update; `sleep`, `battle`, `wild` and
 * `runScript` are bound by their flow modules. Idempotent; a no-op without a hook.
 * @param {any} G
 */
export function installFieldDebug(G) {
  const hook = G && G.debugHook;
  if (!hook || hook.__fieldDebug) return false;
  hook.__fieldDebug = true;
  hook.bind('deliverLetter', (n = 1) => G.store.tx('debug:deliverLetter', (w) => {
    const out = [];
    const base = Math.floor(w.clock.total / MINUTES_PER_DAY);
    for (let i = 0; i < Math.max(1, Math.floor(Number(n) || 1)); i++) out.push(letters.deliverMorning(w, G.data, { bus: G.bus, tuning: TUNING, day: base + i }));
    return out;
  }));
  if (!hook.isBound('addCreature')) {
    hook.bind('addCreature', (speciesId, level = 5, opts = {}) => G.store.tx('debug:addCreature', (w) => party.giveCreature(w, { speciesId, level, ...opts }, G.data, G.rngs.fresh(`debug:creature:${speciesId}:${w.party.length}`), { bus: G.bus, tuning: TUNING })));
  }
  if (!hook.isBound('heal')) hook.bind('heal', () => G.store.tx('debug:heal', (w) => party.heal(w, { data: G.data, bus: G.bus })));
  const setTime = hook.setTime;
  hook.setTime = (h, m = 0) => {
    const r = setTime(h, m);
    G.store.tx('debug:weather', (w) => weather.update(w, G.data, gather.planRng(w), { bus: G.bus }));
    if (G.music && typeof G.music.refresh === 'function') G.music.refresh();
    return r;
  };
  const setTide = hook.setTide;
  hook.setTide = (x) => {
    const r = setTide(x);
    if (G.music && typeof G.music.refresh === 'function') G.music.refresh();
    return r;
  };
  hook.field = () => {
    const s = G.scenes.find ? G.scenes.find('overworld') : null;
    return s && typeof s.field === 'function' ? s.field() : null;
  };
  return true;
}

// re-exported for tests
export { OPPOSITE, TIDE_MASK };
