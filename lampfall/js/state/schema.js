/**
 * World schema: the one JSON-serializable `world` object (ARCHITECTURE §3.1).
 *
 * Rules every record follows:
 *  - ids only, never object references; `null` never `undefined`;
 *  - no Map / Set / Date / functions / NaN / Infinity anywhere;
 *  - every key is present from {@link createNewWorld} so no system checks for missing keys.
 *
 * This module is pure (no DOM, no data tables): content ids are opaque strings here and are
 * resolved against the data registry only when one is handed to {@link validateWorld}.
 *
 * Lane: STATE.
 * @module state/schema
 */

import { makeRng, hashString, decodeSeedCode } from '../core/rng.js';
import { CLOCK_STATE_VERSION, DEFAULT_START_MINUTE, MINUTES_PER_DAY, TIDE_PERIOD_MINUTES, scheduleForSeed } from '../core/time.js';

/**
 * Minute of day a new run starts at on game day 1: 17:40, the arrival, the instant the rising tide
 * closes the mainland causeway behind the player (GDD-00 §5 tide model, §12 "0:30 | 17:40 (held)").
 * `systems/clockSys` owns the clock from here on. [GDD]
 */
export const NEW_GAME_START_MINUTE = 17 * 60 + 40;
/** Minute of day of game day 1's (lower) low water, 16:40 (GDD-00 §5 "Day 1 is seeded"). [GDD] */
export const DAY1_LOW_MINUTE = 16 * 60 + 40;
/** Prefix of the clock seeds {@link tideSeedFor} searches. */
export const TIDE_SEED_PREFIX = 'lampfall:tide:';
/** @type {Map<number, string>} */
const TIDE_SEED_CACHE = new Map();

/**
 * The core/time clock seed whose tide schedule (`scheduleForSeed(seed).tideOffset`) puts a low at
 * `day1Low` on game day 1: the first `'lampfall:tide:<i>'` that hashes to the right offset. Every run
 * shares it (the run seed never shapes the tide), so `world.clock.seed`, the live clock and
 * `state/selectors` agree from `createNewWorld` on. Pure and memoized. Lives here, not in
 * `systems/clockSys` (which re-exports it), because state may not import systems (§13.5).
 * @param {number} [day1Low=DAY1_LOW_MINUTE] integer minute of day 0..1439
 * @returns {string}
 * @throws {TypeError} on a bad minute; Error if no seed is found (cannot happen for the core hash)
 */
export function tideSeedFor(day1Low = DAY1_LOW_MINUTE) {
  if (!Number.isInteger(day1Low) || day1Low < 0 || day1Low >= MINUTES_PER_DAY) {
    throw new TypeError(`tideSeedFor: day1Low must be an integer minute 0..1439, got ${day1Low}`);
  }
  const offset = day1Low % TIDE_PERIOD_MINUTES;
  const hit = TIDE_SEED_CACHE.get(offset);
  if (hit !== undefined) return hit;
  for (let i = 0; i < 200_000; i++) {
    const seed = `${TIDE_SEED_PREFIX}${i}`;
    if (scheduleForSeed(seed).tideOffset === offset) {
      TIDE_SEED_CACHE.set(offset, seed);
      return seed;
    }
  }
  throw new Error(`tideSeedFor: no seed found for tide offset ${offset}`);
}

/** Version stamped on `world.v`; bump together with a new entry in `migrate.MIGRATIONS`. */
export const SCHEMA_VERSION = 5;

/** Maximum party size. */
export const PARTY_MAX = 6;
/** Maximum move slots per creature. */
export const MOVE_SLOTS = 4;
/** Maximum trained points per stat. */
export const TRAINED_MAX = 252;
/** Highest creature level. */
export const LEVEL_MAX = 100;
/** Number of Day Page lines kept in `world.log`. */
export const LOG_MAX = 60;
/** Number of notes kept in `world.dayPage.notes`. */
export const DAY_NOTES_MAX = 40;
/** Answers the player can give a neighbor's nickname for them (GDD-00 §12, v4). */
export const NICKNAME_CHOICES = Object.freeze(['accept', 'decline', 'counter']);

/** Stat keys, in canonical order. */
export const STAT_KEYS = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
/** Facing directions. */
export const FACINGS = Object.freeze(['up', 'down', 'left', 'right']);
/** Status ailment kinds a creature may carry between battles. */
export const STATUS_KINDS = Object.freeze(['burn', 'poison', 'chill', 'numb']);
/** Text speeds accepted by `settings.textSpeed`. */
export const TEXT_SPEEDS = Object.freeze(['slow', 'normal', 'fast', 'instant']);
/** Display scale modes accepted by `settings.scale` (see core/canvas). */
export const SCALE_MODES = Object.freeze(['integer', 'fit']);
/** Auto-anchor presets accepted per creature in `settings.autoAnchor`. */
export const AUTO_ANCHOR_MODES = Object.freeze(['auto-anchor', 'auto-up']);
/** Namespaces a flag id must start with (§3.1 / §8.1). */
export const FLAG_NAMESPACES = Object.freeze(['lit.', 'sp.', 'th.', 'np.', 'sys.', 'seen.', 'stamp.']);
/**
 * Bag pockets that exist from day one (GDD-00 §13 Satchel tabs: Wicks, Medicine, Discs, Finds, Held,
 * Keepsakes, plus the untabbed `tools` pocket that holds the tool-ring items). Versions 1-2 used
 * `items/tools/catch/keepsakes/key`; `migrate` step 2 -> 3 folds those into these.
 */
export const POCKET_IDS = Object.freeze(['wicks', 'medicine', 'discs', 'finds', 'held', 'keepsakes', 'tools']);
/** Stat counters tracked in `world.stats`, in display order. */
export const STAT_COUNTERS = Object.freeze([
  'playMs', 'steps', 'battles', 'catches', 'forecasts', 'rerolls', 'anchors', 'wardWalls', 'blackouts',
  'summitAttempts', 'fishCaught', 'treesShaken', 'lettersRead',
]);
/** Dial used when a seed code cannot be decoded and none is given. // [GDD: default dial] */
export const DEFAULT_DIAL = 'drift';
/** Label of the rng fork {@link createNewWorld} consumes (§9). */
export const WORLDGEN_LABEL = 'worldgen';

// ---------------------------------------------------------------------------------------------
// Typedefs
// ---------------------------------------------------------------------------------------------

/** @typedef {{hp: number, atk: number, def: number, spa: number, spd: number, spe: number}} StatBlock */

/**
 * Per-seed generation results, rolled once by {@link createNewWorld} from the `worldgen` fork and
 * never recomputed (§9). The content-specific members are filled by the `worldgen` hook the caller
 * passes (it has the data registry; this module does not); the schema only fixes their shape.
 * @typedef {Object} WorldGen
 * @property {number} version      generator version, so a migration can tell old layouts apart
 * @property {number} salt         one uint32 drawn from the fork; proves it was consumed and seeds cosmetic choices
 * @property {Record<string, string>} wards        Ward ability placement: form id -> ability id  // [GDD]
 * @property {Record<string, string>} abilities    per-seed ability picks: form id -> ability id
 * @property {Record<string, string[]>} discs      disc / cache contents: disc id -> item ids
 * @property {Record<string, string[]>} shuffles   field-item shuffles per dial / map: key -> item ids in order
 */

/**
 * @typedef {Object} RunConfig
 * @property {string} seedCode        `DIAL-XXXX-XXXX` from core/rng.encodeSeedCode (or the raw text the player typed)
 * @property {number} seed            integer master seed; `makeRng(seed)` is the master nobody draws from
 * @property {string} dial            dial id, lower-case
 * @property {string[]} toggles       seed-code toggles, registry order
 * @property {string[]} challenges    challenge ids, e.g. `'no-rewind'`, `'one-heart'`  // [GDD: list]
 * @property {boolean} dialChangedMidRun   set when the dial changes after creation (Seed Card: not race-eligible)
 * @property {WorldGen} gen
 */

/**
 * @typedef {Object} Settings
 * @property {{master: number, music: number, sfx: number}} volumes   0..1 each
 * @property {boolean} muted
 * @property {'slow'|'normal'|'fast'|'instant'} textSpeed
 * @property {number} minutesPerDay   real minutes per in-game day (> 0)
 * @property {boolean} realClock
 * @property {'integer'|'fit'} scale
 * @property {object|null} bindings   core/input `saveBindings()` JSON, or `null` for defaults
 * @property {boolean} reducedMotion
 * @property {boolean} fps30
 * @property {Record<string, 'auto-anchor'|'auto-up'|null>} autoAnchor   per creature uid
 * @property {boolean} skipAnims
 */

/**
 * core/time `serialize()` output, stored verbatim.
 * @typedef {Object} ClockState
 * @property {number} version
 * @property {number} total      in-game minutes since 00:00 of day 0
 * @property {number} speed
 * @property {boolean} paused
 * @property {boolean} realClock
 * @property {string|number|null} seed
 */

/**
 * Today's weather and the posted forecasts. Written only by `systems/weather.js` (v2 added every key
 * but `today`, `tomorrow` and `intensity`). Kind ids come from `systems/weather` KINDS / `data.weather`.
 * @typedef {Object} WeatherState
 * @property {number} day         game day (1-based, GDD numbering) this state was rolled for; 0 = never rolled
 * @property {string} today       the day's main weather kind id (what the day turns into)
 * @property {string} lead        the kind in effect before `onset`
 * @property {string} current     the kind in effect right now (`lead` before `onset`, `today` from it)
 * @property {number} onset       minute of day (integer 0..1439) at which `today` sets in
 * @property {string} tomorrow    tomorrow's POSTED kind (the outlook's kind; the true weather stays unrolled)
 * @property {number} intensity   0..1, today's strength (particles, overlays, effect multipliers)
 * @property {WeatherForecast|null} forecast   today's forecast as Augusta posted it at dawn
 * @property {WeatherForecast|null} outlook    tomorrow's forecast (Day Page "Tomorrow:" line)
 * @property {{day: number, kind: string}|null} pinned   a later day whose weather is set in advance
 *   (Wren's small talk sets tomorrow's weather); cleared once that day has passed
 */

/**
 * One posted forecast, honest at its stated odds (`odds` in 10 times it comes true).
 * @typedef {Object} WeatherForecast
 * @property {string} kind        predicted weather kind id
 * @property {number} odds        integer 1..10: "7 in 10"
 * @property {number} minute      minute of day of the tide the forecast names (integer 0..1439)
 * @property {'low'|'high'} tide  which tide it names
 * @property {string} part        the day-part's tide word for that tide ('dawn' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night')
 */

/**
 * @typedef {Object} PlayerLook
 * @property {number} fur
 * @property {number} marks
 * @property {number} outfit
 */

/**
 * @typedef {Object} PlayerState
 * @property {string} name
 * @property {string} species      player species id (lease card)
 * @property {string} pronouns
 * @property {PlayerLook} look
 * @property {string} mapId        current map id (`''` until the lease card / boot places the player)
 * @property {number} x  @property {number} y   tile coordinates
 * @property {'up'|'down'|'left'|'right'} facing
 * @property {string|null} tool        equipped tool item id
 * @property {string|null} lastTool    for the tap-to-swap gesture
 * @property {string[]} toolRing       up to 8 item ids
 * @property {string} title            earned title shown on the Seed Card
 */

/**
 * @typedef {Object} ItemStack
 * @property {string} id
 * @property {number} n
 */

/**
 * Overflow basket left on the map at the player's feet when the satchel is full (systems/bag).
 * @typedef {Object} Basket
 * @property {string} id          'b' + sequence
 * @property {string} mapId
 * @property {number} x
 * @property {number} y
 * @property {number} day         economy day it was left (systems/bag)
 * @property {ItemStack[]} items
 */

/**
 * @typedef {Object} Bag
 * @property {Record<string, ItemStack[]>} pockets    pocket id -> stacks
 * @property {Record<string, number>} capacity        pocket id -> max stacks in that pocket (0 = only the shared satchel limit)
 * @property {number} extraSlots                     satchel slots added by builds (base and max are tuning: bagSlotsBase / bagSlotsMax)
 * @property {Basket[]} baskets                      overflow baskets lying on maps
 * @property {number} basketSeq                      last basket sequence number used
 */

/**
 * Currencies are `main`, `starsalt`, `anchors`, `purse` (§15.4); the other keys are the wallet's own
 * bookkeeping (systems/wallet, v3).
 * @typedef {Object} Wallet
 * @property {number} main
 * @property {number} starsalt
 * @property {number} anchors
 * @property {number} purse            Keeper's Purse: blackout refund still owed
 * @property {number} purseGlints      Glints left that pay the purse back (equal shares)
 * @property {number} starsaltDay      economy day `starsaltBought` counts for (-1 = never)
 * @property {number} starsaltBought   Starsalt bought on `starsaltDay` (shared daily cap)
 * @property {string[]} anchorGrants   anchor grants already applied ('@start', spire ids)
 */

/**
 * @typedef {Object} Build
 * @property {string} id          build id from data/loans
 * @property {number} tier
 * @property {number} startedDay
 * @property {number} readyDay
 * @property {string|null} choice   roof / variant choice id
 * @property {boolean} done
 */

/**
 * @typedef {Object} LoanState
 * @property {number} tier
 * @property {number} paid          amount paid toward the current tier
 * @property {Build[]} builds
 * @property {number} scaffold      scaffold stage shown in town
 * @property {string[]} commissions chosen commission ids
 * @property {{jar: number, built: string[]}} commons
 * @property {string[]} residentShares   finished lead-thread ids already credited
 * @property {string[]} errands          First Night Errand ids already credited (v3)
 * @property {string[]} spireShares      spire ids whose share was credited (v3)
 * @property {Array<{tier: number, day: number}>} tally   split sticks on the tally wall, in order (v3)
 * @property {Array<{day: number, amount: number, source: string}>} log   recent credits: pace line, today by source (v3)
 */

/**
 * Shop bookkeeping (systems/shops, v3). Day-scoped counters reset lazily when `day` changes.
 * @typedef {Object} ShopsState
 * @property {number} day                        economy day the counters belong to (-1 = never)
 * @property {Record<string, number>} sold       '<shopId>/<itemId>' -> bought today (per-row qty limits)
 * @property {Record<string, number>} wantedSold itemId -> sold today at the Wanted Today rate
 * @property {ItemStack[]} crate                 Consignment Crate contents, sold overnight
 */

/**
 * @typedef {Object} ThreadState
 * @property {number} beat
 * @property {boolean} done
 * @property {number} startedDay
 * @property {number} lastAdvancedDay
 */

/**
 * Letters state (GDD-00 §11: Keeper, family and town channels plus two event letters; written only
 * by systems/letters). Letter numbers `n` are the content's global, contiguous 1..N numbering;
 * arrival order is not `n` order (a family letter can arrive before the next Keeper letter), so
 * `got` (v4) lists what has arrived.
 * @typedef {Object} LettersState
 * @property {number} delivered      count of letters delivered so far (always `got.length`)
 * @property {number[]} read         letter numbers read
 * @property {number|null} today     the Keeper letter that arrived this morning, or `null`
 * @property {number[]} got          letter numbers delivered, in arrival order (v4)
 * @property {number[]} mailbox      delivered to the mailbox and not yet collected (v4)
 * @property {number|null} counter   family letter waiting at Hesper's counter, or `null` (v4)
 * @property {number[]} carrying     family letters in the satchel, not yet taken to their door (v4)
 * @property {number[]} doors        family letters handed in at their door (v4)
 * @property {number[]} awaiting     handed in at a dark porch; the heirloom waits for the porch to light (v4)
 * @property {number[]} returned     family letters whose heirloom has come home (v4)
 * @property {string[]} pinned       find ids pinned on Barnaby's string wall (v4)
 * @property {number} keeperDay      core day of the last Keeper letter delivery, -1 before any (v4)
 * @property {number} familyDay      core day of the last family letter arrival, -1 before any (v4)
 * @property {number} townDay        core day of the last town letter by morning post, -1 before any (v4)
 */

/**
 * @typedef {Object} NpcMemory
 * @property {boolean} met
 * @property {number} talks
 * @property {number} lastTalkDay
 * @property {number} lastPorchDay
 * @property {string|null} nickname
 * @property {number} affinity
 * @property {string[]} favours
 * @property {Record<string, number>} saidLines     line id -> day said
 * @property {Record<string, any>} remembered       script `remember` op values (JSON only)
 * @property {Record<string, {n: number, lastDay: number}>} gifts   item id -> times given and last core day (v4)
 * @property {'accept'|'decline'|'counter'|null} nicknameChoice   how the player answered this neighbor's nickname (v4)
 * @property {string|null} lastLineId               the line said most recently (Linger skips it) (v4)
 * @property {number} lingerDay                     core day the Linger second topic was last used, -1 never (v4)
 * @property {number} lastGiftDay                   core day of the last gift, -1 never (v4)
 */

/**
 * @typedef {Object} MapState
 * @property {boolean} visited
 * @property {Record<string, number>} picked      item key -> day picked
 * @property {Record<string, number>} trees       tree key -> regrow day
 * @property {Record<string, boolean>} cracks     crack key -> opened
 * @property {Record<string, number>} reach       fishing reach id -> health 0..1
 * @property {Record<string, number>} reachAt     fishing reach id -> total minute its health was last set (recovery runs from here; v5)
 * @property {string[]} opened                    one-shot trigger / chest ids
 */

/**
 * @typedef {Object} FieldLogEntry
 * @property {boolean} seen  @property {boolean} read  @property {boolean} held
 * @property {string|null} ability   ability revealed by a Read, or `null`
 */

/**
 * @typedef {Object} FieldLog
 * @property {Record<string, FieldLogEntry>} forms   form id -> entry
 * @property {Record<string, number>} tells          fish id -> tells learned
 */

/**
 * @typedef {Object} Collections
 * @property {Record<string, {n: number, best: number}>} fish
 * @property {Record<string, {n: number}>} bugs
 * @property {Record<string, {n: number, cleaned: boolean}>} relics
 * @property {string[]} donated
 * @property {Record<string, number>} patientBest   fish id -> best size landed in Patient mode (its own record board; v5)
 * @property {number} cleanedDay                    core day of the Kiln lead's clean-on-the-spot, -1 never (v5)
 */

/**
 * Encounter bookkeeping (written only by systems/encounter, v5).
 * @typedef {Object} EncounterState
 * @property {number} steps      steps since the last wild encounter (the "never chain instantly" floor)
 * @property {Record<string, {seen: boolean, downDay: number|null, downBadges: number|null, downPlayMs: number|null}>} errants
 *   Errant species -> seen (shown on the map) and when it was last beaten or caught (null = up)
 */

/**
 * The running Day Page tally (written only by systems/dayPage, v4): a stats snapshot at day start,
 * amounts noted from domain events, and the last summary (for the porch-bench re-read).
 * @typedef {Object} DayPageState
 * @property {number} day                    core day the tally covers, -1 before the first day starts
 * @property {Record<string, number>} base   `world.stats` counters at day start
 * @property {number} earned                 buttons earned today
 * @property {number} paid                   buttons paid toward the loans today
 * @property {string[]} notes                short note ids noted today (max DAY_NOTES_MAX)
 * @property {Record<string, any>|null} last the last Day Page summary, or null
 */

/**
 * Script runner state saved mid-cutscene (script/runner `save()` output).
 * @typedef {{pc: number[], vars: Record<string, any>, callStack: any[]}} RunnerState
 */

/**
 * @typedef {Object} BattleBookmark
 * @property {string} kind          'trainer' | 'spire' | 'summit' | 'wild'
 * @property {string|null} trainerId
 * @property {string} mapId  @property {number} x  @property {number} y
 * @property {number} battles       `stats.battles` when the bookmark was set
 */

/**
 * @typedef {Object} Stats
 * @property {number} playMs  @property {number} steps  @property {number} battles  @property {number} catches
 * @property {number} forecasts  @property {number} rerolls  @property {number} anchors  @property {number} wardWalls
 * @property {number} blackouts  @property {number} summitAttempts  @property {number} fishCaught
 * @property {number} treesShaken  @property {number} lettersRead
 */

/**
 * Creature record. Adopted from proto/battle/creature.js with the fields the merged game needs.
 * @typedef {Object} Creature
 * @property {string} uid               `'c' + sequence` (systems/party.nextUid, counter `sys.uid`); stable; the Shift stream label
 * @property {string} speciesId         current form id
 * @property {string} familyId
 * @property {string} nickname
 * @property {string[]} types           current types (follows the form; Unfixed loops override)
 * @property {string} ability           ability id (follows the form)
 * @property {number} level
 * @property {number} exp
 * @property {StatBlock} base           effective base stats (floor-adjusted after Shifts)
 * @property {StatBlock} trained        0..252 each
 * @property {StatBlock} stats          derived; recomputed by systems/creature
 * @property {number} hp
 * @property {{id: string, pp: number, maxPp: number}[]} moves   max 4
 * @property {string[]} memory          move ids parked by Shifts
 * @property {{kind: 'burn'|'poison'|'chill'|'numb', turns: number}|null} status
 * @property {number} mends             battle budget, reset at battle start
 * @property {number} bond              0..5
 * @property {string|null} heartmark    pinned Heartmark technique id
 * @property {boolean} heartmarkStab
 * @property {{x: number, y: number}} mark   per-individual Heartmark pixel placement (front)
 * @property {string[]} shiftlog        every form held, in order
 * @property {number} shiftCount        draws consumed from the Shift stream (rerolls included)
 * @property {number[]} windowsUsed     curve points already resolved
 * @property {boolean} stillKnot
 * @property {string|null} heldItem
 * @property {boolean} wild             true until bonded (Heartmark unlit)
 * @property {string[]|null} typeQueue  Unfixed loop
 * @property {number} typeIndex
 * @property {number} caughtDay
 * @property {string} caughtMap
 */

/**
 * @typedef {Object} World
 * @property {number} v                          SCHEMA_VERSION this object conforms to
 * @property {RunConfig} run
 * @property {Settings} settings
 * @property {ClockState} clock
 * @property {WeatherState} weather
 * @property {PlayerState} player
 * @property {Creature[]} party                  max 6
 * @property {Creature[]} box
 * @property {string[]} yard                     creature uids in the Training Yard
 * @property {Bag} bag
 * @property {Wallet} wallet
 * @property {LoanState} loans
 * @property {ShopsState} shops
 * @property {Record<string, boolean|number|string>} flags   namespaced: `sp.` `th.<thread>.` `np.<npc>.` `sys.` `seen.<scriptId>`
 * @property {Record<string, number>} counters
 * @property {Record<string, ThreadState>} threads
 * @property {LettersState} letters
 * @property {Record<string, NpcMemory>} npcs
 * @property {Record<string, MapState>} maps
 * @property {FieldLog} fieldLog
 * @property {Collections} collections
 * @property {string[]} badges                   spire ids in order won
 * @property {string[]} pendingShifts            creature uids with an open window (deferred)
 * @property {string|null} pendingScript         script id to run on next overworld enter
 * @property {{scriptId: string, state: RunnerState}|null} cutscene
 * @property {BattleBookmark|null} battleBookmark
 * @property {Record<string, number[]>} rng      saved states of STATEFUL forks only (§9)
 * @property {Stats} stats
 * @property {string[]} log                      last 60 Day Page lines (Archive)
 * @property {DayPageState} dayPage              today's Day Page tally (v4)
 * @property {EncounterState} encounter          step floor and Errant state (v5)
 */

// ---------------------------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------------------------

/** @returns {StatBlock} all-zero block */
export function zeroStats() {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

/** @returns {Stats} */
function zeroCounters() {
  /** @type {any} */
  const out = {};
  for (const k of STAT_COUNTERS) out[k] = 0;
  return out;
}

/**
 * A complete Creature record with neutral values. Systems/party builds real creatures; this exists so
 * migrations and validation agree on what "every key present" means.
 * @returns {Creature}
 */
export function creatureDefaults() {
  return {
    uid: '',
    speciesId: '',
    familyId: '',
    nickname: '',
    types: [],
    ability: '',
    level: 1,
    exp: 0,
    base: zeroStats(),
    trained: zeroStats(),
    stats: zeroStats(),
    hp: 0,
    moves: [],
    memory: [],
    status: null,
    mends: 0,
    bond: 0,
    heartmark: null,
    heartmarkStab: false,
    mark: { x: 0, y: 0 },
    shiftlog: [],
    shiftCount: 0,
    windowsUsed: [],
    stillKnot: false,
    heldItem: null,
    wild: false,
    typeQueue: null,
    typeIndex: 0,
    caughtDay: 0,
    caughtMap: '',
  };
}

/** @returns {NpcMemory} */
export function npcMemoryDefaults() {
  return {
    met: false, talks: 0, lastTalkDay: -1, lastPorchDay: -1, nickname: null, affinity: 0,
    favours: [], saidLines: {}, remembered: {},
    gifts: {}, nicknameChoice: null, lastLineId: null, lingerDay: -1, lastGiftDay: -1,
  };
}

/** @returns {LettersState} */
export function lettersDefaults() {
  return {
    delivered: 0, read: [], today: null,
    got: [], mailbox: [], counter: null, carrying: [], doors: [], awaiting: [], returned: [], pinned: [],
    keeperDay: -1, familyDay: -1, townDay: -1,
  };
}

/** @returns {DayPageState} */
export function dayPageDefaults() {
  return { day: -1, base: {}, earned: 0, paid: 0, notes: [], last: null };
}

/** @returns {MapState} */
export function mapStateDefaults() {
  return { visited: false, picked: {}, trees: {}, cracks: {}, reach: {}, reachAt: {}, opened: [] };
}

/** @returns {ThreadState} */
export function threadStateDefaults() {
  return { beat: 0, done: false, startedDay: -1, lastAdvancedDay: -1 };
}

/** @returns {FieldLogEntry} */
export function fieldLogEntryDefaults() {
  return { seen: false, read: false, held: false, ability: null };
}

/**
 * The never-rolled weather state (`systems/weather.rollDay` fills it on the first day start).
 * @returns {WeatherState}
 */
export function weatherStateDefaults() {
  return { day: 0, today: 'clear', lead: 'clear', current: 'clear', onset: 0, tomorrow: 'clear', intensity: 0, forecast: null, outlook: null, pinned: null };
}

/** @returns {Settings} */
export function settingsDefaults() {
  return {
    volumes: { master: 0.8, music: 0.7, sfx: 0.9 },
    muted: false,
    textSpeed: 'normal',
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

/** @returns {WorldGen} */
export function worldGenDefaults() {
  return { version: 1, salt: 0, wards: {}, abilities: {}, discs: {}, shuffles: {} };
}

/**
 * The complete default world tree with run-neutral values (seed 0, empty seed code). `fillDefaults`
 * in migrate.js merges this under loaded data; {@link createNewWorld} overlays the run-specific parts.
 * @returns {World}
 */
export function worldDefaults() {
  /** @type {Record<string, ItemStack[]>} */
  const pockets = {};
  /** @type {Record<string, number>} */
  const capacity = {};
  for (const p of POCKET_IDS) {
    pockets[p] = [];
    capacity[p] = 0;
  }
  return {
    v: SCHEMA_VERSION,
    run: {
      seedCode: '',
      seed: 0,
      dial: DEFAULT_DIAL,
      toggles: [],
      challenges: [],
      dialChangedMidRun: false,
      gen: worldGenDefaults(),
    },
    settings: settingsDefaults(),
    clock: {
      version: CLOCK_STATE_VERSION,
      total: DEFAULT_START_MINUTE,
      speed: 1,
      paused: false,
      realClock: false,
      seed: null,
    },
    weather: weatherStateDefaults(),
    player: {
      name: '',
      species: '',
      pronouns: 'they',
      look: { fur: 0, marks: 0, outfit: 0 },
      mapId: '',
      x: 0,
      y: 0,
      facing: 'down',
      tool: null,
      lastTool: null,
      toolRing: [],
      title: '',
    },
    party: [],
    box: [],
    yard: [],
    bag: { pockets, capacity, extraSlots: 0, baskets: [], basketSeq: 0 },
    wallet: { main: 0, starsalt: 0, anchors: 0, purse: 0, purseGlints: 0, starsaltDay: -1, starsaltBought: 0, anchorGrants: [] },
    loans: {
      tier: 1,
      paid: 0,
      builds: [],
      scaffold: 0,
      commissions: [],
      commons: { jar: 0, built: [] },
      residentShares: [],
      errands: [],
      spireShares: [],
      tally: [],
      log: [],
    },
    shops: { day: -1, sold: {}, wantedSold: {}, crate: [] },
    flags: {},
    counters: {},
    threads: {},
    letters: lettersDefaults(),
    npcs: {},
    maps: {},
    fieldLog: { forms: {}, tells: {} },
    collections: { fish: {}, bugs: {}, relics: {}, donated: [], patientBest: {}, cleanedDay: -1 },
    badges: [],
    pendingShifts: [],
    pendingScript: null,
    cutscene: null,
    battleBookmark: null,
    rng: {},
    stats: zeroCounters(),
    log: [],
    dayPage: { ...dayPageDefaults(), day: 0 },   // the arrival day's page is open from the start (systems/dayPage)
    encounter: { steps: 0, errants: {} },
  };
}

// ---------------------------------------------------------------------------------------------
// createNewWorld
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} NewWorldOptions
 * @property {string} seedCode          a `DIAL-XXXX-XXXX` code, or any text (hashed when it does not decode)
 * @property {string} [dial]            dial id when the code carries none (defaults to {@link DEFAULT_DIAL})
 * @property {string[]} [challenges]    challenge ids
 * @property {Partial<PlayerState>} [lease]       lease-card answers (name, species, pronouns, look, map placement)
 * @property {Partial<Settings>} [settings]       settings carried over from the title screen / localStorage mirror
 * @property {(rng: import('../core/rng.js').Rng, run: Omit<RunConfig, 'gen'>) => Partial<WorldGen>} [worldgen]
 *   content-aware generator; receives the already-positioned `worldgen` fork and may draw from it freely.
 *   Called exactly once. Its result is merged over {@link worldGenDefaults}.
 */

/**
 * Builds a brand-new world for one run. Deterministic: the same options produce a deep-equal world
 * (no wall clock, no `Math.random`). The `worldgen` fork is consumed exactly once here and its results
 * live in `run.gen`, so saves never re-roll them (§9).
 *
 * @param {NewWorldOptions} opts
 * @returns {World}
 * @throws {TypeError} when `seedCode` is not a non-empty string or an option has the wrong type
 */
export function createNewWorld(opts) {
  if (opts === null || typeof opts !== 'object') {
    throw new TypeError('createNewWorld: opts must be an object');
  }
  const { seedCode, lease, settings, worldgen, challenges } = opts;
  if (typeof seedCode !== 'string' || seedCode.length === 0) {
    throw new TypeError('createNewWorld: seedCode must be a non-empty string');
  }
  if (lease != null && typeof lease !== 'object') throw new TypeError('createNewWorld: lease must be an object');
  if (settings != null && typeof settings !== 'object') throw new TypeError('createNewWorld: settings must be an object');
  if (worldgen != null && typeof worldgen !== 'function') throw new TypeError('createNewWorld: worldgen must be a function');
  if (challenges != null && !Array.isArray(challenges)) throw new TypeError('createNewWorld: challenges must be an array');

  const world = worldDefaults();

  // --- run config ---
  const decoded = decodeSeedCode(seedCode);
  const dial = String(opts.dial ?? decoded?.dial ?? DEFAULT_DIAL).toLowerCase();
  const seed = decoded ? decoded.seed : hashString(seedCode);
  /** @type {Omit<RunConfig, 'gen'>} */
  const run = {
    seedCode: decoded ? seedCode.toUpperCase() : seedCode,
    seed,
    dial,
    toggles: decoded ? decoded.toggles.slice() : [],
    challenges: (challenges ?? []).map(String),
    dialChangedMidRun: false,
  };

  // --- worldgen: the only draws createNewWorld makes ---
  const fork = makeRng(seed).fork(WORLDGEN_LABEL);
  const gen = worldGenDefaults();
  gen.salt = fork.nextUint32();
  const extra = worldgen ? worldgen(fork, Object.freeze({ ...run, toggles: run.toggles.slice(), challenges: run.challenges.slice() })) : null;
  if (extra != null) {
    if (typeof extra !== 'object') throw new TypeError('createNewWorld: worldgen must return an object');
    for (const k of Object.keys(gen)) {
      if (extra[k] !== undefined && k !== 'salt' && k !== 'version') gen[k] = extra[k];
    }
  }
  world.run = { ...run, gen };

  // --- settings and lease overlays ---
  if (settings) {
    for (const k of Object.keys(world.settings)) {
      if (settings[k] === undefined) continue;
      const cur = world.settings[k];
      world.settings[k] = isPlainObject(cur) && isPlainObject(settings[k]) ? { ...cur, ...settings[k] } : settings[k];
    }
  }
  if (lease) {
    for (const k of Object.keys(world.player)) {
      if (lease[k] === undefined) continue;
      world.player[k] = k === 'look' && isPlainObject(lease.look) ? { ...world.player.look, ...lease.look } : lease[k];
    }
  }

  // --- clock mirrors settings so clockSys.optionsFrom(world) is self-contained ---
  world.clock.realClock = world.settings.realClock === true;
  // The GDD tide (day 1's low at 16:40) for every run, and the arrival at 17:40: the run seed feeds
  // every other stream but never the tide (systems/clockSys notes). Selectors read this seed directly.
  world.clock.seed = tideSeedFor();
  world.clock.total = NEW_GAME_START_MINUTE;

  return world;
}

// ---------------------------------------------------------------------------------------------
// validateWorld
// ---------------------------------------------------------------------------------------------

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
export function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string';
const isBool = (v) => typeof v === 'boolean';
const isNullOr = (pred) => (v) => v === null || pred(v);
const oneOf = (list) => (v) => list.includes(v);
const nonNeg = (v) => isNum(v) && v >= 0;
const nonNegInt = (v) => isInt(v) && v >= 0;
const unit = (v) => isNum(v) && v >= 0 && v <= 1;
const strArray = (v) => Array.isArray(v) && v.every(isStr);
const intArray = (v) => Array.isArray(v) && v.every(isInt);
const isStackList = (v) => Array.isArray(v) && v.every((s) => isPlainObject(s) && isStr(s.id) && isInt(s.n) && s.n >= 1);
/** A posted forecast (see the WeatherForecast typedef); exact keys, nothing extra. */
const FORECAST_KEYS = Object.freeze(['kind', 'minute', 'odds', 'part', 'tide']);
const isWeatherForecast = (f) => isPlainObject(f)
  && Object.keys(f).sort().join() === FORECAST_KEYS.join()
  && isStr(f.kind) && isInt(f.odds) && f.odds >= 1 && f.odds <= 10
  && isInt(f.minute) && f.minute >= 0 && f.minute < 1440
  && (f.tide === 'low' || f.tide === 'high') && isStr(f.part);

/**
 * Field spec table: `[predicate, description]`. Nested plain objects are specs themselves.
 * `$record` describes every value of a string-keyed record.
 */
const STAT_BLOCK = Object.fromEntries(STAT_KEYS.map((k) => [k, [isNum, 'number']]));
const TRAINED_BLOCK = Object.fromEntries(STAT_KEYS.map((k) => [k, [(v) => isInt(v) && v >= 0 && v <= TRAINED_MAX, `integer 0..${TRAINED_MAX}`]]));

const CREATURE_SPEC = {
  uid: [(v) => isStr(v) && v.length > 0, 'non-empty string'],
  speciesId: [isStr, 'string'],
  familyId: [isStr, 'string'],
  nickname: [isStr, 'string'],
  types: [strArray, 'string[]'],
  ability: [isStr, 'string'],
  level: [(v) => isInt(v) && v >= 1 && v <= LEVEL_MAX, `integer 1..${LEVEL_MAX}`],
  exp: [nonNegInt, 'non-negative integer'],
  base: STAT_BLOCK,
  trained: TRAINED_BLOCK,
  stats: STAT_BLOCK,
  hp: [nonNegInt, 'non-negative integer'],
  moves: [(v) => Array.isArray(v) && v.length <= MOVE_SLOTS
    && v.every((m) => isPlainObject(m) && isStr(m.id) && nonNegInt(m.pp) && nonNegInt(m.maxPp) && m.pp <= m.maxPp),
  `array of {id, pp, maxPp} (max ${MOVE_SLOTS}, pp <= maxPp)`],
  memory: [strArray, 'string[]'],
  status: [isNullOr((s) => isPlainObject(s) && STATUS_KINDS.includes(s.kind) && nonNegInt(s.turns)), `null or {kind: ${STATUS_KINDS.join('|')}, turns}`],
  mends: [nonNegInt, 'non-negative integer'],
  bond: [(v) => isInt(v) && v >= 0 && v <= 5, 'integer 0..5'],
  heartmark: [isNullOr(isStr), 'string|null'],
  heartmarkStab: [isBool, 'boolean'],
  mark: { x: [isInt, 'integer'], y: [isInt, 'integer'] },
  shiftlog: [strArray, 'string[]'],
  shiftCount: [nonNegInt, 'non-negative integer'],
  windowsUsed: [intArray, 'integer[]'],
  stillKnot: [isBool, 'boolean'],
  heldItem: [isNullOr(isStr), 'string|null'],
  wild: [isBool, 'boolean'],
  typeQueue: [isNullOr(strArray), 'string[]|null'],
  typeIndex: [nonNegInt, 'non-negative integer'],
  caughtDay: [isInt, 'integer'],
  caughtMap: [isStr, 'string'],
};

const WORLD_SPEC = {
  v: [(v) => isInt(v) && v >= 1 && v <= SCHEMA_VERSION, `integer 1..${SCHEMA_VERSION}`],
  run: {
    seedCode: [isStr, 'string'],
    seed: [nonNegInt, 'non-negative integer'],
    dial: [(v) => isStr(v) && v.length > 0, 'non-empty string'],
    toggles: [strArray, 'string[]'],
    challenges: [strArray, 'string[]'],
    dialChangedMidRun: [isBool, 'boolean'],
    gen: {
      version: [nonNegInt, 'non-negative integer'],
      salt: [nonNegInt, 'non-negative integer'],
      wards: { $record: [isStr, 'string'] },
      abilities: { $record: [isStr, 'string'] },
      discs: { $record: [strArray, 'string[]'] },
      shuffles: { $record: [strArray, 'string[]'] },
    },
  },
  settings: {
    volumes: { master: [unit, '0..1'], music: [unit, '0..1'], sfx: [unit, '0..1'] },
    muted: [isBool, 'boolean'],
    textSpeed: [oneOf(TEXT_SPEEDS), TEXT_SPEEDS.join('|')],
    minutesPerDay: [(v) => isNum(v) && v > 0, 'number > 0'],
    realClock: [isBool, 'boolean'],
    scale: [oneOf(SCALE_MODES), SCALE_MODES.join('|')],
    bindings: [isNullOr(isPlainObject), 'object|null'],
    reducedMotion: [isBool, 'boolean'],
    fps30: [isBool, 'boolean'],
    autoAnchor: { $record: [isNullOr(oneOf(AUTO_ANCHOR_MODES)), `${AUTO_ANCHOR_MODES.join('|')}|null`] },
    skipAnims: [isBool, 'boolean'],
  },
  clock: {
    version: [(v) => v === CLOCK_STATE_VERSION, `= ${CLOCK_STATE_VERSION}`],
    total: [nonNeg, 'number >= 0'],
    speed: [nonNeg, 'number >= 0'],
    paused: [isBool, 'boolean'],
    realClock: [isBool, 'boolean'],
    seed: [(v) => v === null || isStr(v) || isNum(v), 'string|number|null'],
  },
  weather: {
    day: [nonNegInt, 'non-negative integer'],
    today: [isStr, 'string'],
    lead: [isStr, 'string'],
    current: [isStr, 'string'],
    onset: [(v) => isInt(v) && v >= 0 && v < 1440, 'integer 0..1439'],
    tomorrow: [isStr, 'string'],
    intensity: [unit, '0..1'],
    forecast: [isNullOr(isWeatherForecast), 'null or {kind, odds 1..10, minute 0..1439, tide low|high, part}'],
    outlook: [isNullOr(isWeatherForecast), 'null or {kind, odds 1..10, minute 0..1439, tide low|high, part}'],
    pinned: [isNullOr((p) => isPlainObject(p) && Object.keys(p).sort().join() === 'day,kind' && isInt(p.day) && p.day >= 1 && isStr(p.kind) && p.kind !== ''), 'null or {day >= 1, kind}'],
  },
  player: {
    name: [isStr, 'string'],
    species: [isStr, 'string'],
    pronouns: [isStr, 'string'],
    look: { fur: [nonNegInt, 'non-negative integer'], marks: [nonNegInt, 'non-negative integer'], outfit: [nonNegInt, 'non-negative integer'] },
    mapId: [isStr, 'string'],
    x: [isInt, 'integer'],
    y: [isInt, 'integer'],
    facing: [oneOf(FACINGS), FACINGS.join('|')],
    tool: [isNullOr(isStr), 'string|null'],
    lastTool: [isNullOr(isStr), 'string|null'],
    toolRing: [(v) => strArray(v) && v.length <= 8, 'string[] (max 8)'],
    title: [isStr, 'string'],
  },
  party: [(v) => Array.isArray(v) && v.length <= PARTY_MAX, `array (max ${PARTY_MAX})`],
  box: [Array.isArray, 'array'],
  yard: [strArray, 'string[]'],
  bag: {
    pockets: { $record: [isStackList, 'ItemStack[] with n >= 1'] },
    capacity: { $record: [nonNegInt, 'non-negative integer'] },
    extraSlots: [nonNegInt, 'non-negative integer'],
    baskets: [(v) => Array.isArray(v) && v.every((b) => isPlainObject(b) && isStr(b.id) && b.id.length > 0 && isStr(b.mapId) && isInt(b.x) && isInt(b.y) && isInt(b.day) && isStackList(b.items)), 'Basket[]'],
    basketSeq: [nonNegInt, 'non-negative integer'],
  },
  wallet: {
    main: [nonNegInt, 'non-negative integer'], starsalt: [nonNegInt, 'non-negative integer'], anchors: [nonNegInt, 'non-negative integer'], purse: [nonNegInt, 'non-negative integer'],
    purseGlints: [nonNegInt, 'non-negative integer'], starsaltDay: [(v) => isInt(v) && v >= -1, 'integer >= -1'], starsaltBought: [nonNegInt, 'non-negative integer'], anchorGrants: [strArray, 'string[]'],
  },
  loans: {
    tier: [(v) => isInt(v) && v >= 1, 'integer >= 1'],
    paid: [nonNegInt, 'non-negative integer'],
    builds: [(v) => Array.isArray(v) && v.every((b) => isPlainObject(b) && isStr(b.id) && isInt(b.tier) && isInt(b.startedDay) && isInt(b.readyDay) && (b.choice === null || isStr(b.choice)) && isBool(b.done)), 'Build[]'],
    scaffold: [nonNegInt, 'non-negative integer'],
    commissions: [strArray, 'string[]'],
    commons: { jar: [nonNegInt, 'non-negative integer'], built: [strArray, 'string[]'] },
    residentShares: [strArray, 'string[]'],
    errands: [strArray, 'string[]'],
    spireShares: [strArray, 'string[]'],
    tally: [(v) => Array.isArray(v) && v.every((t) => isPlainObject(t) && isInt(t.tier) && t.tier >= 1 && isInt(t.day)), 'Array<{tier, day}>'],
    log: [(v) => Array.isArray(v) && v.every((e) => isPlainObject(e) && isInt(e.day) && nonNegInt(e.amount) && isStr(e.source)), 'Array<{day, amount, source}>'],
  },
  shops: {
    day: [(v) => isInt(v) && v >= -1, 'integer >= -1'],
    sold: { $record: [nonNegInt, 'non-negative integer'] },
    wantedSold: { $record: [nonNegInt, 'non-negative integer'] },
    crate: [isStackList, 'ItemStack[] with n >= 1'],
  },
  flags: { $record: [(v) => isBool(v) || isNum(v) || isStr(v), 'boolean|number|string'] },
  counters: { $record: [isNum, 'number'] },
  threads: { $record: { beat: [nonNegInt, 'non-negative integer'], done: [isBool, 'boolean'], startedDay: [isInt, 'integer'], lastAdvancedDay: [isInt, 'integer'] } },
  letters: {
    delivered: [nonNegInt, 'non-negative integer'], read: [intArray, 'integer[]'], today: [isNullOr(isInt), 'integer|null'],
    got: [intArray, 'integer[]'], mailbox: [intArray, 'integer[]'], counter: [isNullOr(isInt), 'integer|null'],
    carrying: [intArray, 'integer[]'], doors: [intArray, 'integer[]'], awaiting: [intArray, 'integer[]'], returned: [intArray, 'integer[]'],
    pinned: [strArray, 'string[]'], keeperDay: [isInt, 'integer'], familyDay: [isInt, 'integer'], townDay: [isInt, 'integer'],
  },
  npcs: {
    $record: {
      met: [isBool, 'boolean'], talks: [nonNegInt, 'non-negative integer'], lastTalkDay: [isInt, 'integer'], lastPorchDay: [isInt, 'integer'],
      nickname: [isNullOr(isStr), 'string|null'], affinity: [isNum, 'number'], favours: [strArray, 'string[]'],
      saidLines: { $record: [isInt, 'integer'] }, remembered: { $record: [() => true, 'any'] },
      gifts: { $record: { n: [nonNegInt, 'non-negative integer'], lastDay: [isInt, 'integer'] } },
      nicknameChoice: [isNullOr(oneOf(NICKNAME_CHOICES)), `${NICKNAME_CHOICES.join('|')}|null`],
      lastLineId: [isNullOr(isStr), 'string|null'], lingerDay: [isInt, 'integer'], lastGiftDay: [isInt, 'integer'],
    },
  },
  maps: {
    $record: {
      visited: [isBool, 'boolean'], picked: { $record: [isInt, 'integer'] }, trees: { $record: [isInt, 'integer'] },
      cracks: { $record: [isBool, 'boolean'] }, reach: { $record: [isNum, 'number'] }, reachAt: { $record: [isNum, 'number'] }, opened: [strArray, 'string[]'],
    },
  },
  fieldLog: {
    forms: { $record: { seen: [isBool, 'boolean'], read: [isBool, 'boolean'], held: [isBool, 'boolean'], ability: [isNullOr(isStr), 'string|null'] } },
    tells: { $record: [nonNegInt, 'non-negative integer'] },
  },
  collections: {
    fish: { $record: { n: [nonNegInt, 'non-negative integer'], best: [nonNeg, 'number >= 0'] } },
    bugs: { $record: { n: [nonNegInt, 'non-negative integer'] } },
    relics: { $record: { n: [nonNegInt, 'non-negative integer'], cleaned: [isBool, 'boolean'] } },
    donated: [strArray, 'string[]'],
    patientBest: { $record: [nonNeg, 'number >= 0'] },
    cleanedDay: [isInt, 'integer'],
  },
  badges: [strArray, 'string[]'],
  pendingShifts: [strArray, 'string[]'],
  pendingScript: [isNullOr(isStr), 'string|null'],
  cutscene: [isNullOr((c) => isPlainObject(c) && isStr(c.scriptId) && isPlainObject(c.state)), 'null or {scriptId, state}'],
  battleBookmark: [isNullOr((b) => isPlainObject(b) && isStr(b.kind) && (b.trainerId === null || isStr(b.trainerId)) && isStr(b.mapId) && isInt(b.x) && isInt(b.y) && nonNegInt(b.battles)), 'null or BattleBookmark'],
  rng: { $record: [(v) => Array.isArray(v) && v.length === 4 && v.every((n) => isInt(n) && n >= 0 && n < 2 ** 32) && v.some((n) => n !== 0), '4 uint32 (not all zero)'] },
  stats: Object.fromEntries(STAT_COUNTERS.map((k) => [k, [nonNeg, 'number >= 0']])),
  log: [(v) => strArray(v) && v.length <= LOG_MAX, `string[] (max ${LOG_MAX})`],
  dayPage: {
    day: [isInt, 'integer'], base: { $record: [isNum, 'number'] }, earned: [nonNegInt, 'non-negative integer'],
    paid: [nonNegInt, 'non-negative integer'], notes: [(v) => strArray(v) && v.length <= DAY_NOTES_MAX, `string[] (max ${DAY_NOTES_MAX})`],
    last: [isNullOr(isPlainObject), 'object|null'],
  },
  encounter: {
    steps: [nonNegInt, 'non-negative integer'],
    errants: {
      $record: {
        seen: [isBool, 'boolean'], downDay: [isNullOr(isInt), 'integer|null'],
        downBadges: [isNullOr(nonNegInt), 'non-negative integer|null'], downPlayMs: [isNullOr(nonNeg), 'number >= 0|null'],
      },
    },
  },
};

/**
 * Checks `value` against a spec node, appending `path: message` strings to `out`.
 * @param {string} path
 * @param {unknown} value
 * @param {any} spec
 * @param {string[]} out
 */
function checkSpec(path, value, spec, out) {
  if (Array.isArray(spec)) {
    const [pred, desc] = spec;
    if (!pred(value)) out.push(`${path}: expected ${desc}, got ${describe(value)}`);
    return;
  }
  if (!isPlainObject(value)) {
    out.push(`${path}: expected object, got ${describe(value)}`);
    return;
  }
  if (spec.$record) {
    for (const key of Object.keys(value)) checkSpec(`${path}.${key}`, value[key], spec.$record, out);
    return;
  }
  for (const key of Object.keys(spec)) {
    if (!(key in value)) {
      out.push(`${path}.${key}: missing`);
      continue;
    }
    checkSpec(`${path}.${key}`, value[key], spec[key], out);
  }
  for (const key of Object.keys(value)) {
    if (!(key in spec)) out.push(`${path}.${key}: unexpected key`);
  }
}

/**
 * Short, safe description of a value for problem strings.
 * @param {unknown} v
 * @returns {string}
 */
function describe(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return `array(${v.length})`;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : `non-finite ${String(v)}`;
  if (typeof v === 'string') return JSON.stringify(v.length > 40 ? `${v.slice(0, 37)}...` : v);
  if (typeof v === 'object') return Object.prototype.toString.call(v).slice(8, -1);
  return typeof v;
}

/**
 * Walks `value` and reports anything JSON cannot carry faithfully: `undefined`, functions, symbols,
 * bigint, NaN/Infinity, Map/Set/Date/class instances, cycles.
 * @param {string} path
 * @param {unknown} value
 * @param {string[]} out
 * @param {Set<object>} seen
 * @param {number} depth
 */
function checkJsonSafe(path, value, out, seen, depth) {
  if (depth > 64) {
    out.push(`${path}: nesting deeper than 64 levels`);
    return;
  }
  switch (typeof value) {
    case 'undefined': out.push(`${path}: undefined (use null)`); return;
    case 'function': out.push(`${path}: function value`); return;
    case 'symbol': out.push(`${path}: symbol value`); return;
    case 'bigint': out.push(`${path}: bigint value`); return;
    case 'number': if (!Number.isFinite(value)) out.push(`${path}: non-finite number`); return;
    case 'object': break;
    default: return;
  }
  if (value === null) return;
  if (seen.has(value)) {
    out.push(`${path}: cyclic reference`);
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) checkJsonSafe(`${path}[${i}]`, value[i], out, seen, depth + 1);
  } else if (isPlainObject(value)) {
    for (const key of Object.keys(value)) checkJsonSafe(`${path}.${key}`, value[key], out, seen, depth + 1);
  } else {
    out.push(`${path}: ${describe(value)} is not a plain object`);
  }
  seen.delete(value);
}

/**
 * Data registry subset the validator uses (`js/data/registry.js`); any object with `has(table, id)`.
 * @typedef {{has: (table: string, id: string) => boolean}} RegistryLike
 */

/**
 * Validates a world against the schema. Structural checks always run (shape, types, ranges, JSON
 * safety, uid uniqueness, cross-references inside the world); id resolution against content runs
 * only when a registry is given and that registry knows the table.
 *
 * Never throws; a non-object input yields a single problem.
 *
 * @param {unknown} world
 * @param {RegistryLike|null} [data]
 * @returns {string[]} problems; empty = valid
 */
export function validateWorld(world, data) {
  /** @type {string[]} */
  const out = [];
  if (!isPlainObject(world)) {
    out.push(`world: expected object, got ${describe(world)}`);
    return out;
  }
  checkJsonSafe('world', world, out, new Set(), 0);
  if (out.length) return out; // the spec walk assumes JSON-safe input
  checkSpec('world', world, WORLD_SPEC, out);

  const w = /** @type {World} */ (world);

  // --- creatures ---
  const uids = new Set();
  const creatures = [];
  for (const [where, list] of [['party', w.party], ['box', w.box]]) {
    if (!Array.isArray(list)) continue;
    list.forEach((c, i) => {
      const path = `world.${where}[${i}]`;
      checkSpec(path, c, CREATURE_SPEC, out);
      if (!isPlainObject(c)) return;
      creatures.push(c);
      if (isStr(c.uid)) {
        if (uids.has(c.uid)) out.push(`${path}.uid: duplicate uid ${JSON.stringify(c.uid)}`);
        uids.add(c.uid);
      }
      if (isInt(c.hp) && isPlainObject(c.stats) && isInt(c.stats.hp) && c.hp > c.stats.hp) {
        out.push(`${path}.hp: ${c.hp} exceeds stats.hp ${c.stats.hp}`);
      }
      if (Array.isArray(c.typeQueue) && isInt(c.typeIndex) && c.typeIndex >= c.typeQueue.length && c.typeQueue.length > 0) {
        out.push(`${path}.typeIndex: ${c.typeIndex} outside typeQueue`);
      }
    });
  }
  const requireUid = (path, uid) => {
    if (isStr(uid) && !uids.has(uid)) out.push(`${path}: unknown creature uid ${JSON.stringify(uid)}`);
  };
  if (Array.isArray(w.yard)) w.yard.forEach((uid, i) => requireUid(`world.yard[${i}]`, uid));
  if (Array.isArray(w.pendingShifts)) w.pendingShifts.forEach((uid, i) => requireUid(`world.pendingShifts[${i}]`, uid));
  if (isPlainObject(w.settings) && isPlainObject(w.settings.autoAnchor)) {
    for (const uid of Object.keys(w.settings.autoAnchor)) requireUid(`world.settings.autoAnchor.${uid}`, uid);
  }

  // --- internal consistency ---
  if (isPlainObject(w.letters)) {
    const L = w.letters;
    // `got` (v4) lists delivered letters; a record without it falls back to the v1 rule (1..delivered).
    /** @type {(n: number) => boolean} */
    let wasDelivered = () => true;
    if (Array.isArray(L.got)) {
      const got = new Set(L.got);
      wasDelivered = (n) => got.has(n);
      if (got.size !== L.got.length) out.push('world.letters.got: duplicate entries');
      if (isInt(L.delivered) && L.delivered !== L.got.length) out.push(`world.letters.delivered: ${L.delivered} does not match got.length ${L.got.length}`);
      if (L.got.some((n) => isInt(n) && n < 1)) out.push('world.letters.got: letter numbers start at 1');
    } else if (isInt(L.delivered)) {
      wasDelivered = (n) => n >= 1 && n <= L.delivered;
    }
    if (Array.isArray(L.read)) {
      for (const n of L.read) {
        if (isInt(n) && !wasDelivered(n)) out.push(`world.letters.read: letter ${n} was never delivered`);
      }
      if (new Set(L.read).size !== L.read.length) out.push('world.letters.read: duplicate entries');
    }
    if (isInt(L.today) && !wasDelivered(L.today)) out.push(`world.letters.today: letter ${L.today} was never delivered`);
    if (isInt(L.counter) && !wasDelivered(L.counter)) out.push(`world.letters.counter: letter ${L.counter} was never delivered`);
    for (const key of ['mailbox', 'carrying', 'doors']) {
      if (!Array.isArray(L[key])) continue;
      for (const n of L[key]) if (isInt(n) && !wasDelivered(n)) out.push(`world.letters.${key}: letter ${n} was never delivered`);
      if (new Set(L[key]).size !== L[key].length) out.push(`world.letters.${key}: duplicate entries`);
    }
    for (const key of ['awaiting', 'returned']) {
      if (!Array.isArray(L[key]) || !Array.isArray(L.doors)) continue;
      for (const n of L[key]) if (isInt(n) && !L.doors.includes(n)) out.push(`world.letters.${key}: letter ${n} was never handed in at a door`);
      if (new Set(L[key]).size !== L[key].length) out.push(`world.letters.${key}: duplicate entries`);
    }
    if (Array.isArray(L.carrying) && Array.isArray(L.doors)) {
      for (const n of L.carrying) if (L.doors.includes(n)) out.push(`world.letters.carrying: letter ${n} was already handed in`);
    }
  }
  if (isPlainObject(w.flags)) {
    for (const id of Object.keys(w.flags)) {
      if (!FLAG_NAMESPACES.some((ns) => id.startsWith(ns))) out.push(`world.flags.${id}: flag id lacks a namespace (${FLAG_NAMESPACES.join(' ')})`);
    }
  }
  if (Array.isArray(w.badges) && new Set(w.badges).size !== w.badges.length) out.push('world.badges: duplicate entries');
  if (isPlainObject(w.player) && isStr(w.player.tool) && Array.isArray(w.player.toolRing) && w.player.toolRing.length && !w.player.toolRing.includes(w.player.tool)) {
    out.push(`world.player.tool: ${JSON.stringify(w.player.tool)} is not on the tool ring`);
  }

  // --- content ids, when a registry is available ---
  if (data && typeof data.has === 'function') {
    const has = (table, id) => {
      try { return data.has(table, id); } catch { return true; }
    };
    const ref = (path, table, id) => {
      if (isStr(id) && id !== '' && !has(table, id)) out.push(`${path}: unknown ${table} id ${JSON.stringify(id)}`);
    };
    // Carried things are `items` rows or gathered `collections` rows (fish, bugs, finds, fruit; systems/econ.itemOf).
    const itemRef = (path, id) => {
      if (isStr(id) && id !== '' && !has('items', id) && !has('collections', id)) out.push(`${path}: unknown items id ${JSON.stringify(id)}`);
    };
    creatures.forEach((c) => {
      const where = w.party.includes(c) ? `party[${w.party.indexOf(c)}]` : `box[${w.box.indexOf(c)}]`;
      ref(`world.${where}.speciesId`, 'species', c.speciesId);
      ref(`world.${where}.familyId`, 'families', c.familyId);
      ref(`world.${where}.ability`, 'abilities', c.ability);
      if (c.heartmark) ref(`world.${where}.heartmark`, 'moves', c.heartmark);
      if (c.heldItem) ref(`world.${where}.heldItem`, 'items', c.heldItem);
      if (Array.isArray(c.moves)) c.moves.forEach((m, i) => isPlainObject(m) && ref(`world.${where}.moves[${i}].id`, 'moves', m.id));
      if (Array.isArray(c.memory)) c.memory.forEach((id, i) => ref(`world.${where}.memory[${i}]`, 'moves', id));
      if (Array.isArray(c.shiftlog)) c.shiftlog.forEach((id, i) => ref(`world.${where}.shiftlog[${i}]`, 'species', id));
    });
    if (isPlainObject(w.player)) {
      ref('world.player.mapId', 'maps', w.player.mapId);
      if (w.player.tool) ref('world.player.tool', 'items', w.player.tool);
      if (Array.isArray(w.player.toolRing)) w.player.toolRing.forEach((id, i) => ref(`world.player.toolRing[${i}]`, 'items', id));
    }
    if (isPlainObject(w.bag) && isPlainObject(w.bag.pockets)) {
      for (const [pocket, stacks] of Object.entries(w.bag.pockets)) {
        if (Array.isArray(stacks)) stacks.forEach((s, i) => isPlainObject(s) && itemRef(`world.bag.pockets.${pocket}[${i}].id`, s.id));
      }
    }
    if (isPlainObject(w.bag) && Array.isArray(w.bag.baskets)) {
      w.bag.baskets.forEach((b, bi) => isPlainObject(b) && Array.isArray(b.items) && b.items.forEach((s, i) => isPlainObject(s) && itemRef(`world.bag.baskets[${bi}].items[${i}].id`, s.id)));
    }
    if (isPlainObject(w.shops) && Array.isArray(w.shops.crate)) {
      w.shops.crate.forEach((s, i) => isPlainObject(s) && itemRef(`world.shops.crate[${i}].id`, s.id));
    }
    if (isPlainObject(w.npcs)) for (const id of Object.keys(w.npcs)) ref(`world.npcs.${id}`, 'npcs', id);
    if (isPlainObject(w.maps)) for (const id of Object.keys(w.maps)) ref(`world.maps.${id}`, 'maps', id);
    if (isPlainObject(w.threads)) for (const id of Object.keys(w.threads)) ref(`world.threads.${id}`, 'threads', id);
    if (isPlainObject(w.fieldLog) && isPlainObject(w.fieldLog.forms)) for (const id of Object.keys(w.fieldLog.forms)) ref(`world.fieldLog.forms.${id}`, 'species', id);
    if (Array.isArray(w.badges)) w.badges.forEach((id, i) => ref(`world.badges[${i}]`, 'trainers', id));
    if (isStr(w.pendingScript)) ref('world.pendingScript', 'scripts', w.pendingScript);
    if (isPlainObject(w.cutscene)) ref('world.cutscene.scriptId', 'scripts', w.cutscene.scriptId);
  }

  return out;
}
