/** SHIM for js/state/schema.js [STATE]. Delete at integration. Shape follows ARCHITECTURE-DRAFT §3.1. */
import { decodeSeedCode } from '../../core/rng.js';

/** Version stamped on every world this code creates. */
export const SCHEMA_VERSION = 1;

/** Every top-level world key, in schema order (validateWorld checks presence). */
export const WORLD_KEYS = Object.freeze([
  'v', 'run', 'settings', 'clock', 'weather', 'player', 'party', 'box', 'yard', 'bag', 'wallet', 'loans',
  'flags', 'counters', 'threads', 'letters', 'npcs', 'maps', 'fieldLog', 'collections', 'badges',
  'pendingShifts', 'pendingScript', 'cutscene', 'battleBookmark', 'rng', 'stats', 'log',
]);

/** @returns {object} default settings record */
export function defaultSettings() {
  return {
    volumes: { master: 1, music: 0.8, sfx: 1 },
    muted: false,
    textSpeed: 2,
    minutesPerDay: 24,
    realClock: false,
    scale: 'integer',
    bindings: null,
    reducedMotion: false,
    fps30: false,
    autoAnchor: {},
    skipAnims: false,
  };
}

/**
 * Builds a fresh world for a seed code. Deterministic: same code -> deep-equal world.
 * @param {{seedCode: string, lease?: object, settings?: object}} opts
 * @returns {object} World
 */
export function createNewWorld(opts) {
  if (!opts || typeof opts.seedCode !== 'string') throw new TypeError('createNewWorld: opts.seedCode is required');
  const parts = decodeSeedCode(opts.seedCode);
  if (!parts) throw new RangeError(`createNewWorld: invalid seed code '${opts.seedCode}'`);
  const lease = opts.lease ?? {};
  return {
    v: SCHEMA_VERSION,
    run: {
      seedCode: opts.seedCode.toUpperCase(),
      seed: parts.seed,
      dial: parts.dial.toLowerCase(),
      toggles: [...parts.toggles],
      challenges: [],
      dialChangedMidRun: false,
      gen: {},
    },
    settings: { ...defaultSettings(), ...(opts.settings ?? {}) },
    clock: null,
    weather: { today: 'clear', tomorrow: 'clear', intensity: 0 },
    player: {
      name: 'Keeper', // [GDD] default name
      species: 'player',
      pronouns: 'they',
      look: { fur: 0, marks: 0, outfit: 0 },
      mapId: 'test-map',
      x: 20,
      y: 12,
      facing: 'down',
      tool: null,
      lastTool: null,
      toolRing: [],
      title: '',
      ...lease,
    },
    party: [],
    box: [],
    yard: [],
    bag: { pockets: {}, capacity: {} },
    wallet: { main: 0, starsalt: 0, anchors: 0, purse: 0 },
    loans: { tier: 1, paid: 0, builds: [], scaffold: 0, commissions: [], commons: { jar: 0, built: [] }, residentShares: [] },
    flags: {},
    counters: {},
    threads: {},
    letters: { delivered: 0, read: [], today: null },
    npcs: {},
    maps: {},
    fieldLog: { forms: {}, tells: {} },
    collections: { fish: {}, bugs: {}, relics: {}, donated: [] },
    badges: [],
    pendingShifts: [],
    pendingScript: null,
    cutscene: null,
    battleBookmark: null,
    rng: {},
    stats: {
      playMs: 0, steps: 0, battles: 0, catches: 0, forecasts: 0, rerolls: 0, anchors: 0, wardWalls: 0,
      blackouts: 0, summitAttempts: 0, fishCaught: 0, treesShaken: 0, lettersRead: 0,
    },
    log: [],
  };
}

/**
 * Structural validation. Returns problems; empty means valid.
 * @param {object} world
 * @param {object} [data] registry (unused by the shim)
 * @returns {string[]}
 */
export function validateWorld(world, data) {
  void data;
  const problems = [];
  if (!world || typeof world !== 'object') return ['world: not an object'];
  for (const key of WORLD_KEYS) if (!(key in world)) problems.push(`world.${key}: missing`);
  if (world.v !== SCHEMA_VERSION) problems.push(`world.v: ${world.v} != ${SCHEMA_VERSION}`);
  if (!world.run || typeof world.run.seedCode !== 'string') problems.push('world.run.seedCode: missing');
  if (Array.isArray(world.party) && world.party.length > 6) problems.push('world.party: more than 6');
  if (!world.player || !Number.isInteger(world.player.x) || !Number.isInteger(world.player.y)) problems.push('world.player: x/y not integers');
  return problems;
}
