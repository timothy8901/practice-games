/**
 * Battle flow glue (ARCHITECTURE §5.5). [FLOW]
 *
 * Builds a battle from the world with real data and the GDD-00 tuning, routes captures through
 * `systems/capture` on the `capture:<battleId>:<attempt>` stream, and writes the outcome back:
 * `party.applyOutcome` (EXP on each creature's own curve, windows into `world.pendingShifts`, HP / PP
 * / status by uid, the catch), Field Log Seen / Read / Held, payouts, the blackout cost through
 * `systems/wallet.blackout` (Summit, story and no-blackout trainers cost nothing), Spire seals with
 * the Spire share (`systems/loans.spireShare`), defeated-trainer flags and the trainer's story script.
 *
 * Calls:
 *  - {@link startBattle}(G, setup) pushes the battle scene and resolves with its {@link PostBattle};
 *  - {@link buildBattle}(G, setup, data) is what the scene calls on enter (world writes in one tx:
 *    `stats.battles`, the battle bookmark); it returns a {@link BattleSession};
 *  - {@link applyBattleResult}(G, session, {bus}) once the engine has ended (one tx); the scene passes
 *    a {@link createDeferredBus} so domain events sound in animation order;
 *  - helpers the scene uses between turns: {@link prepareAction}, {@link captureMenu},
 *    {@link bagMenu}, {@link noteEvents}, {@link expDisplay}, {@link applyExpEvent}.
 *
 * Tuning: {@link tuningFor} lays the TUNING RECONCILIATION values (GDD-00) under `data.tuning`, so a
 * data registry that lacks a key still gets the GDD number (mends 3, bench 0.6, payout 50 × highest
 * level, EXP divisor 5, 8 × L² through Lv8 then a cubic on every curve, hold-out 100, capture max 95%, Slim / Fair / Good /
 * Sure bands, windows 8 / 20 / 34) and the Freefall Ward badge waits for the first blocked hit.
 *
 * Pure apart from the `G` it is handed (no DOM); world writes go through `G.store.tx` and the owning
 * systems. Owns `world.badges` and `world.battleBookmark` (tools/lint-owners).
 * @module systems/flow/battleFlow
 */

import { createBattle, TUNING_KEYS as ENGINE_TUNING_KEYS, DIAL_RULES } from '../../battle/engine.js';
import { makeFoeAi, AI_PROFILES } from '../../battle/ai.js';
import * as creature from '../creature.js';
import * as party from '../party.js';
import * as exp from '../exp.js';
import * as capture from '../capture.js';
import * as bag from '../bag.js';
import * as wallet from '../wallet.js';
import * as loans from '../loans.js';
import * as fieldLog from '../fieldLog.js';
import * as flags from '../flags.js';
import * as stats from '../stats.js';
import * as clockSys from '../clockSys.js';
import { curveLevel as selectCurveLevel, minuteOfDay } from '../../state/selectors.js';

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------

/** GDD-00's 8 × L² through Lv8, then (3·L³ − 512) / 2 (data/tuning.js GROWTH_CURVES; MID-06 pacing). */
const L8 = Object.freeze({ num: Object.freeze([0, 8, 0, 0]), den: 1, steps: Object.freeze([Object.freeze({ from: 9, num: Object.freeze([3, 0, 0, -512]), den: 2 })]) });
const BANDS = Object.freeze([Object.freeze([0.25, 'Slim']), Object.freeze([0.5, 'Fair']), Object.freeze([0.8, 'Good']), Object.freeze([Infinity, 'Sure'])]);

/**
 * GDD-00 values from the TUNING RECONCILIATION list (reconcile-notes.md), laid under whatever
 * `data.tuning` provides. Engine (camelCase) and creature-lane (SCREAMING) spellings both.
 */
export const GDD_TUNING = Object.freeze({
  // battle engine
  mendsPerBattle: 3,
  benchShare: 0.6,
  payoutPerLevel: 50,
  expYieldDivisor: 5,
  holdOutExp: 100,
  captureOddsMax: 0.95,
  captureBands: BANDS,
  blackoutCap: 1500,
  // creature / exp / party / capture lanes
  MENDS_PER_BATTLE: 3,
  BENCH_SHARE: 0.6,
  EXP_DIVISOR: 5,
  GROWTH_CURVES: Object.freeze({ fast: L8, 'medium-fast': L8, 'medium-slow': L8, slow: L8 }),
  WINDOW_LEVELS: Object.freeze([8, 20, 34]),
  CAPTURE_ODDS_MAX: 0.95,
  CAPTURE_BANDS: BANDS,
});

/**
 * The flat tuning every system reads: {@link GDD_TUNING} under `data.tuning` (data wins).
 * @param {any} data
 * @returns {Readonly<Record<string, any>>}
 */
export function tuningFor(data) {
  const src = data && typeof data === 'object' && data.tuning && typeof data.tuning === 'object' ? data.tuning : null;
  const hit = src ? TUNING_CACHE.get(src) : NO_SRC_TUNING;
  if (hit) return hit;
  const out = Object.freeze({ ...GDD_TUNING, ...(src || {}) });
  if (src) TUNING_CACHE.set(src, out);
  return out;
}
/** @type {WeakMap<object, Readonly<Record<string, any>>>} */
const TUNING_CACHE = new WeakMap();
const NO_SRC_TUNING = Object.freeze({ ...GDD_TUNING });

/**
 * The engine's tuning subset (createBattle rejects unknown keys).
 * @param {any} data
 * @returns {Record<string, any>}
 */
export function engineTuningFor(data) {
  const t = tuningFor(data);
  const out = {};
  for (const k of ENGINE_TUNING_KEYS) if (Object.prototype.hasOwnProperty.call(t, k)) out[k] = t[k];
  return out;
}

/**
 * Dial rules for the engine: the dial's `data/dials.js` row over the engine defaults, with the
 * reconciliation ruling that Freefall's "Ward ?" badge only shows after the first blocked hit.
 * @param {string} dial
 * @param {any} data
 * @param {{story?: boolean, holdOut?: number|null}} [opts]
 * @returns {Record<string, any>}
 */
export function dialRulesFor(dial, data, opts = {}) {
  let row = null;
  try { row = data && typeof data.tryGet === 'function' ? data.tryGet('dials', dial) : null; } catch { row = null; }
  const base = { ...(DIAL_RULES[dial] || DIAL_RULES.flux) };
  const rules = row && row.rules ? { ...base, ...row.rules } : base;
  if (dial === 'freefall') rules.wardBadge = 'after-block';
  if (opts.story) rules.runAllowed = false;
  delete rules.rerollCostMult;
  delete rules.anchorsAllowed;
  return rules;
}

// ---------------------------------------------------------------------------------------------
// Grades and items
// ---------------------------------------------------------------------------------------------

/** Lantern grade -> the wick item it burns (`sure` = Isolde's Lantern, a Keepsake). */
export const GRADE_ITEMS = Object.freeze({ 1: 'tallow-wick', 2: 'brass-wick', 3: 'skyglass-wick', sure: 'isoldes-lantern' });
/** Medicine the engine can apply in battle (heals the active creature). */
const HEAL_ITEMS = Object.freeze(['salve', 'tonic', 'full-salve']);
const BATTLE_MEDICINE = Object.freeze([...HEAL_ITEMS, 'ether', 'full-ether', 'poultice', 'warm-shawl']);
/** Revives target a fainted party member through the field Satchel. */
const FIELD_ONLY_MEDICINE = Object.freeze(['revive']);
/** Trainer classes whose losses never cost buttons (data/trainers mirrors this as `blackout: false`). */
const NO_BLACKOUT_CLASSES = Object.freeze(['keeper', 'champion', 'porch', 'mentor', 'friend', 'faction']);

/**
 * @param {any} data @param {string} id
 * @returns {any|null}
 */
function row(data, table, id) {
  if (!data || typeof id !== 'string') return null;
  try {
    if (typeof data.tryGet === 'function') {
      try { const found = data.tryGet(table, id); if (found) return found; } catch { /* extra table below */ }
    }
    const t = data[table];
    if (Array.isArray(t)) return t.find((r) => r && r.id === id) ?? null;
    if (t && typeof t === 'object') return t[id] ?? null;
  } catch { /* unknown table */ }
  return null;
}

/** @param {any} world @param {string} itemId @param {any} data @returns {number} */
function held(world, itemId, data) {
  try { return bag.count(world, itemId, undefined, { data }); } catch { return 0; }
}

// ---------------------------------------------------------------------------------------------
// Setup and session
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} BattleSetup   ARCHITECTURE §5.5
 * @property {'wild'|'trainer'} kind
 * @property {string} [trainerId]
 * @property {{speciesId: string, level: number, errant?: boolean, habitat?: 'grass'|'water', scripted?: boolean}} [wild]
 * @property {boolean} [scripted]      a capture the story stages (capture:ok carries `scripted`)
 * @property {boolean} [capture]       false: the Lantern is refused (a Spire sentinel)
 * @property {{id: string, name?: string, lesson?: string}} [sentinel]   a Spire teaching battle (spires.js `order`): a win sets
 *                                      `sys.trainer.<id>` (the sentinel steps aside) and posts the lesson
 * @property {string} [source]          'route' | 'story' | 'spire' | 'rematch' | 'duel'
 * @property {boolean} [summit]
 * @property {{round?: number, used?: string[], picks?: string[]|null, foeItems?: any[]}} [relay]   a Relay round (round 1 when absent;
 *                                      `used` fought earlier rounds, `picks` this round's two, `foeItems` the twins' heals left)
 * @property {number} [holdOut]         story hold-out: end as 'holdout' after this many turns
 * @property {'porch'|'script'} [onLose]
 * @property {string} [loseScript]
 * @property {boolean} [debugParty]     give a debug party when the world has none (debug routes only)
 */

/**
 * @typedef {Object} BattleSession
 * @property {import('../../battle/engine.js').Battle} battle
 * @property {BattleSetup} setup
 * @property {any} data
 * @property {Readonly<Record<string, any>>} tuning     flat system tuning
 * @property {string} battleId
 * @property {any|null} trainer                          the trainer row
 * @property {'wild'|'trainer'} kind
 * @property {string} source
 * @property {boolean} summit  @property {boolean} story  @property {boolean} blackoutAllowed
 * @property {boolean} porchDuel                        a Porch Duel (trainer class 'porch'; the battle:end stamp field)
 * @property {any[]|null} snapshot                       Summit: the player's creatures as this fight began (the Bell restores them)
 * @property {{round: number, of: number, final: boolean, used: string[], picks: string[], name: string, label: string}|null} relay   a Relay round
 * @property {string} dial
 * @property {Record<string, {exp: number, level: number, growth: string}>} expModel   display model of the player's creatures
 * @property {{grade: string|number|null}} pendingCapture
 * @property {PostBattle|null} applied
 * @property {Record<string, any>} startPayload           the `battle:start` payload
 */

/**
 * @typedef {Object} PostBattle   ARCHITECTURE §5.5 plus the flow's extras
 * @property {string|null} outcome
 * @property {Array<{uid: string, from: number, to: number, newMoves: string[], offers: string[]}>} levelUps
 * @property {string[]} windowsOpened
 * @property {{uid: string, where: 'party'|'box', speciesId: string, nickname: string}|null} caught
 * @property {'full'|null} caughtLost
 * @property {{lost: number, refund: number, summit: boolean, free: boolean, wake: 'porch'|'waystone'}|null} blackout
 * @property {number} payout
 * @property {string|null} badge
 * @property {number} starsalt
 * @property {number} spireShare
 * @property {Array<{kind: string, item: string, name: string, line: string}>} rewards   badge gifts put in the bag (spires.js `unlocks`: key items, discs), once
 * @property {string} [lesson]   a Spire sentinel's lesson, after a win
 * @property {number} [ppTopUp]  a Keeper beaten: the PP every move regained before the next Summit fight (SUMMIT.between)
 * @property {{round: number, of: number, next: number, used: string[]}} [relay]   a Relay round won with more to come (MID-05)
 * @property {{holds: boolean, trainerId: string|null, mapId: string, marker: string, restarted?: string[], line?: string}} [summitBell]
 *   a Summit loss (MID-10): `holds` = the Bell kept your place (Drift / Flux) at `marker` on `mapId`; else the climb restarted
 * @property {string|null} script     story script to run after the battle (trainer afterWin / afterLoss, or setup.loseScript)
 * @property {string|null} trainerId
 * @property {string} kind  @property {string} source  @property {boolean} porchDuel
 */

/** @param {any} world @returns {number} */
function battlesSoFar(world) {
  return Number.isInteger(world?.stats?.battles) ? world.stats.battles : 0;
}

/**
 * A level for a party-median scaled trainer (Porch Duels).
 * @param {any} world @param {{min?: number, max?: number}} scale
 * @returns {number}
 */
function medianLevel(world, scale) {
  const lv = world.party.map((c) => c.level).sort((a, b) => a - b);
  const m = lv.length ? lv[Math.floor((lv.length - 1) / 2)] : 5;
  return Math.max(scale.min ?? 1, Math.min(scale.max ?? 100, m));
}

/**
 * Builds the battle (and the session the scene keeps). World writes, in one transaction: a debug
 * party when asked and the party is empty, `stats.battles` + 1, the battle bookmark for trainer
 * kinds. Throws a readable Error when the setup cannot be built (unknown trainer, no healthy
 * creature); nothing is written in that case.
 * @param {any} G      game context (store, rngs, bus, clock)
 * @param {BattleSetup} setup
 * @param {any} data   battle-ready data (Registry with a type chart, or tables)
 * @returns {BattleSession}
 */
export function buildBattle(G, setup, data) {
  if (setup?.wild && !setup.wild.speciesId && setup.wild.species) setup = { ...setup, wild: { ...setup.wild, speciesId: setup.wild.species } };
  if (!setup || (setup.kind !== 'wild' && setup.kind !== 'trainer')) throw new TypeError(`battleFlow: setup.kind must be 'wild' or 'trainer', got ${String(setup && setup.kind)}`);
  const tuning = tuningFor(data);
  const world = G.world;
  const trainer = setup.kind === 'trainer' ? row(data, 'trainers', setup.trainerId) : null;
  if (setup.kind === 'trainer' && !trainer) throw new Error(`battleFlow: no trainer ${JSON.stringify(setup.trainerId)}`);
  if (setup.kind === 'wild' && !(setup.wild && typeof setup.wild.speciesId === 'string')) throw new Error('battleFlow: a wild battle needs setup.wild.speciesId');
  if (setup.kind === 'wild') { if (!row(data, 'species', setup.wild.speciesId)) throw new Error(`battleFlow: no species ${JSON.stringify(setup.wild.speciesId)}`); }

  if (setup.debugParty && world.party.length === 0) {
    G.store.tx('battle.debugParty', (w) => {
      const rng = G.rngs.fresh('debug:party');
      party.giveCreature(w, { speciesId: 'sloshkin', level: Math.max(7, (setup.wild && setup.wild.level) || 9), nickname: 'PUDDLE' }, data, rng, { tuning, bus: G.bus });
      party.giveCreature(w, { speciesId: 'scrapling', level: 8 }, data, rng, { tuning, bus: G.bus });
      bag.give(w, 'tallow-wick', 5, { data, bus: G.bus, source: 'debug' });
      bag.give(w, 'salve', 3, { data, bus: G.bus, source: 'debug' });
    });
  }

  const reading = setup.source === 'reading';
  const story = reading || setup.source === 'story' || !!(trainer && trainer.story);
  const source = setup.source ?? (trainer ? (trainer.expSource ?? 'route') : 'route');
  const summit = !!setup.summit || !!(trainer && (trainer.class === 'keeper' || trainer.class === 'champion'));
  const blackoutAllowed = !summit && !story && setup.onLose !== 'script' && !(trainer && (trainer.blackout === false || NO_BLACKOUT_CLASSES.includes(trainer.class)));
  const dial = world.run.dial || 'flux';
  const oneHeart = Array.isArray(world.run.challenges) && world.run.challenges.includes('one-heart');

  // --- player side --------------------------------------------------------------------------
  let roster = world.party.slice();
  if (oneHeart && roster.length) {
    const first = roster.slice().sort((a, b) => (parseInt(String(a.uid).slice(1), 10) || 0) - (parseInt(String(b.uid).slice(1), 10) || 0))[0];
    roster = [first];
  }
  // the Relay Spire (spires.js theme.rule.rounds): this round's two picks, no repeats across rounds (MID-05)
  const relay = trainer ? relayRule(trainer, data) : null;
  const relayRound = relay ? Math.max(1, Math.min(relay.rounds.length, Number.isInteger(setup.relay?.round) ? setup.relay.round : 1)) : 0;
  const relayUsed = relay && Array.isArray(setup.relay?.used) ? setup.relay.used.filter((u) => typeof u === 'string') : [];
  if (relay && !oneHeart) {
    const choices = relayChoices(world, relay, relayUsed);
    const asked = Array.isArray(setup.relay?.picks) ? [...new Set(setup.relay.picks)] : null;
    const valid = asked && asked.length >= 1 && asked.length <= choices.per && asked.every((u) => choices.rows.some((r) => r.uid === u && r.ok));
    const picks = valid ? asked : relayDefaultPicks(world, relay, relayUsed);
    roster = picks.map((u) => world.party.find((c) => c.uid === u)).filter(Boolean);
  }
  if (!roster.some((c) => c.hp > 0)) throw new Error('battleFlow: no creature in the party can battle');
  const mine = roster.map((c) => creature.serialize(c));
  // the Summit Bell holds your party as this fight began (spires.js SUMMIT_BELL `snapshot`)
  const snapshot = summit ? JSON.parse(JSON.stringify(mine)) : null;
  const playerName = (world.player && (world.player.name || world.player.lease?.name)) || 'You';
  /** @type {Array<{id: string, name: string, heal: number}>} */
  const medicine = [];
  for (const id of BATTLE_MEDICINE) {
    const n = held(world, id, data);
    const it = row(data, 'items', id);
    for (let i = 0; i < n; i++) medicine.push({ id, name: it ? it.name : id,
      ...(it?.use === 'cure' ? { cures: it.cures } : it?.use === 'pp' ? { pp: it.amount ?? Infinity } : { heal: 0.25, mends: true }) });
  }

  // --- foe side ------------------------------------------------------------------------------
  const battleId = String(battlesSoFar(world) + 1);
  // the Reading from data (spires.js THE_READING passed as `wild.reading`, MID-18): phases, posted cards, scaled level
  const readingDial = row(data, 'dials', dial);
  const readingSpec = reading && setup.wild?.reading && typeof setup.wild.reading === 'object' && Array.isArray(setup.wild.reading.phases)
    ? {
      phases: readingPhasesFrom(setup.wild.reading, { from: setup.wild.readingFrom, count: setup.wild.readingCount, offer: setup.wild.readingOffer,
        odds: readingDial?.shift ? readingDial.shift.steadied : null }),
      level: readingLevel(setup.wild.reading, world),
      from: Number.isInteger(setup.wild.readingFrom) ? setup.wild.readingFrom : 1,
      draw: Number.isInteger(setup.wild.readingDraw) ? setup.wild.readingDraw : 0,
      postAt: Number.isInteger(setup.wild.reading.postAtTurn) ? setup.wild.reading.postAtTurn : 1,
    }
    : null;
  /** @type {any[]} */
  let foes;
  /** @type {number[]} trainer party slot of each foe (the boss-Shift stream label) */
  let foeSlots = [];
  if (trainer) {
    const rng = G.rngs.fresh(`trainerTeams:${trainer.id}`);
    // a party-median scaled trainer (Porch Duels) fields `scale.sizeByBadges[badges]` creatures, the last ones
    const sizes = trainer.scale && Array.isArray(trainer.scale.sizeByBadges) ? trainer.scale.sizeByBadges : null;
    const size = sizes && sizes.length ? sizes[Math.min((world.badges || []).length, sizes.length - 1)] : 0;
    const from = size > 0 && size < trainer.party.length ? trainer.party.length - size : 0;
    // party slots in play: a Relay round's posted slots, or the last `size` of a scaled party
    foeSlots = relay ? relay.rounds[relayRound - 1].slots.filter((k) => Number.isInteger(k) && trainer.party[k]) : trainer.party.map((e, k) => k).slice(from);
    const entries = foeSlots.map((k) => trainer.party[k]);
    foes = entries.map((e, i) => {
      const level = trainer.scale ? Math.max(1, medianLevel(world, trainer.scale) + (e.levelOffset ?? 0)) : e.level;
      const c = creature.makeCreature({ uid: `t${battleId}.${i}`, speciesId: e.species, level, moves: e.moves, nickname: e.nick, heldItem: e.held, rng, wild: false, tuning }, data);
      c.wild = false;
      // a posted boss Shift (GDD-04 §1.4) rides on the battle copy; the engine posts and lands it
      return { ...creature.serialize(c), ...(e.onEntry ? { onEntry: { ...e.onEntry } } : {}), ...(e.bossShift ? { bossShift: e.bossShift } : {}) };
    });
  } else {
    const rng = G.rngs.fresh(`wild:${battleId}`);
    const c = creature.makeCreature({ uid: `w${battleId}`, speciesId: setup.wild.speciesId, level: readingSpec ? readingSpec.level : setup.wild.level ?? 5, moves: Array.isArray(setup.wild.moves) ? setup.wild.moves.slice() : undefined, rng, wild: true, tuning }, data);
    c.wild = true;
    foes = [creature.serialize(c)];
  }

  // --- engine --------------------------------------------------------------------------------
  const lanterns = {};
  for (const [grade, itemId] of Object.entries(GRADE_ITEMS)) lanterns[grade] = held(world, itemId, data);
  const seenSet = new Set(Object.entries(world.fieldLog?.forms ?? {}).filter(([, e]) => e && e.seen).map(([id]) => id));
  const readSet = new Set(Object.entries(world.fieldLog?.forms ?? {}).filter(([, e]) => e && e.read).map(([id]) => id));
  const yard = (world.yard || []).map((u) => world.box.find((c) => c.uid === u)).filter(Boolean).map((c) => creature.serialize(c));
  let curve = null;
  try { curve = selectCurveLevel(world, data); } catch { curve = null; }
  const profile = trainer ? (AI_PROFILES.includes(trainer.ai) ? trainer.ai : 'trainer') : 'wild';
  const session = /** @type {BattleSession} */ ({
    battle: /** @type {any} */ (null), setup, data, tuning, battleId, trainer, kind: setup.kind, source, summit, story, blackoutAllowed, dial,
    expModel: {}, pendingCapture: { grade: null }, applied: null, startPayload: {}, porchDuel: trainer?.class === 'porch',
    snapshot, relay: null,
  });
  if (relay) {
    const round = relay.rounds[relayRound - 1];
    session.relay = {
      round: relayRound, of: relay.rounds.length, final: relayRound === relay.rounds.length, used: relayUsed.slice(), picks: roster.map((c) => c.uid),
      name: typeof round.name === 'string' ? round.name : trainer.name,
      label: `Round ${relayRound} of ${relay.rounds.length}: ${typeof round.name === 'string' ? round.name : trainer.name}.`, // str
    };
  }
  // posted boss Shifts roll at the player's dial (steadied once the Relighting has lit the Glass)
  const dialRow = row(data, 'dials', dial);
  const shiftOdds = dialRow?.shift ? (flags.hasFlag(world, 'lit.steadied') ? dialRow.shift.steadied : dialRow.shift.odds) : null;
  // Night hooks belong to this encounter; the shared registry stays frozen and reusable by day.
  const night = minuteOfDay(world) >= 18 * 60 || minuteOfDay(world) < 6 * 60;
  const abilityAtTime = (a) => night && a.nightHook ? { ...a, ...a.nightHook } : a;
  const engineData = night && typeof data.list === 'function' ? { ...data,
    list: (table) => data.list(table).map((r) => table === 'abilities' ? abilityAtTime(r) : r),
    get: (table, id) => table === 'abilities' ? abilityAtTime(data.get(table, id)) : data.get(table, id),
  } : data;
  const spire = trainer?.spire ? row(data, 'spires', trainer.spire) : null;
  const battle = createBattle({
    sides: [
      { party: mine, trainer: { name: playerName, items: medicine }, bag: { crackdust: held(world, 'crackdust', data), lanterns }, glint: world.wallet.main },
      trainer
        ? { party: foes, trainer: { id: trainer.id, name: session.relay ? session.relay.name : trainer.name, title: trainer.title,
          // a Relay's heal items last across its rounds; only the last round pays
          items: (Array.isArray(setup.relay?.foeItems) && relay ? setup.relay.foeItems : (trainer.items || [])).map((x) => ({ ...x })),
          payout: session.relay && !session.relay.final ? 0 : trainer.payout, tacticTag: trainer.tacticTag } }
        : { party: foes },
    ],
    kind: setup.kind,
    data: engineData,
    dial,
    rules: dialRulesFor(dial, data, { story }),
    holdOut: setup.holdOut ?? trainer?.holdOut ?? null,
    readingPhases: reading ? (readingSpec ? readingSpec.phases : setup.wild?.readingPhases) : null,
    readingRng: readingSpec ? (i, d) => G.rngs.fresh(`reading:${readingSpec.from + i}:${readingSpec.draw + d}`) : null,
    readingPostAt: readingSpec ? readingSpec.postAt : undefined,
    weatherKinds: data.weatherKinds ?? null,
    weatherCycle: spire?.theme?.kind === 'weather' ? spire.theme.rule : null,
    bossShiftOdds: shiftOdds && ['up', 'side', 'down'].every((k) => Number.isFinite(shiftOdds[k])) ? shiftOdds : null,
    bossShiftRng: trainer ? (i) => G.rngs.fresh(`bossShift:${trainer.id}:${foeSlots[i] ?? i}`) : null,
    restat: (c) => { creature.recomputeStats(c, data, { tuning }); },
    curveLevel: Number.isFinite(curve) ? curve : null,
    summit,
    source,
    foeAi: makeFoeAi(profile, { tuning: tuning.profiles ? { profiles: tuning.profiles } : undefined }),
    yard,
    fieldLog: { seen: seenSet, read: readSet },
    prism: held(world, 'scouting-prism', data) > 0,
    tuning: engineTuningFor(data),
    gainExp: (c, amount) => creature.gainExp(c, amount, data, { tuning }),
    captureRng: (attempt) => {
      const stream = G.rngs.fresh(`capture:${battleId}:${attempt}`);
      return {
        chance: (raw) => {
          const odds = session.pendingCapture.grade !== null ? shownOddsFor(session, session.pendingCapture.grade) : roundShown(raw, tuning);
          return capture.attemptCapture(stream, odds, { tuning }).success;
        },
      };
    },
    captureBlockReason: setup.capture === false ? 'Stone does not fold into light. This one only teaches.' // str
      : party.hasCaptureRoom(world, { tuning }) ? null : 'Party and storage are full. Make a space at the cottage before raising a Lantern.',
  }, G.rngs.fresh(`battle:${battleId}`));
  session.battle = battle;

  for (const c of roster) session.expModel[c.uid] = { exp: c.exp, level: c.level, growth: creature.growthOf(c, data) };

  // --- world writes ---------------------------------------------------------------------------
  G.store.tx('battle.start', (w) => {
    stats.inc(w, 'battles', 1, { bus: G.bus });
    if (trainer) {
      w.battleBookmark = {
        kind: summit ? 'summit' : trainer.spire ? 'spire' : 'trainer', trainerId: trainer.id,
        mapId: w.player?.mapId ?? '', x: w.player?.x ?? 0, y: w.player?.y ?? 0, battles: battlesSoFar(w),
      };
    }
  });
  const lead = battle.active(0);
  session.startPayload = {
    kind: summit ? 'summit' : trainer?.spire ? 'spire' : story ? 'story' : setup.kind, source, summit, spire: !!trainer?.spire, story,
    trainerId: trainer ? trainer.id : null, battleId, hp: lead.hp, maxHp: lead.stats.hp, porchDuel: session.porchDuel,
  };
  return session;
}

/**
 * Pushes the battle scene and resolves with its PostBattle when it pops.
 * @param {any} G
 * @param {BattleSetup} setup
 * @returns {Promise<PostBattle|null>}
 */
export function startBattle(G, setup) {
  return new Promise((resolve) => {
    G.push('battle', { setup, onDone: resolve });
  });
}

// ---------------------------------------------------------------------------------------------
// The Relay Spire (MID-05): three rounds, two of yours each, no repeats
// ---------------------------------------------------------------------------------------------

/**
 * The Relay rule of a trainer's Spire (spires.js `theme.rule` with `rounds`), or null.
 * @param {any} trainer @param {any} data
 * @returns {{playerPerRound?: number, noRepeat?: boolean, whenDry?: string, rounds: Array<{n: number, trainer: string, name?: string, slots: number[]}>}|null}
 */
export function relayRule(trainer, data) {
  if (!trainer || !trainer.spire) return null;
  const sp = row(data, 'spires', trainer.spire);
  const rule = sp?.theme?.kind === 'relay' ? sp.theme.rule : null;
  return rule && Array.isArray(rule.rounds) && rule.rounds.length ? rule : null;
}

/**
 * Who may fight the next Relay round: the healthy creatures that have not fought a round yet; once
 * fewer fresh ones are left than a round takes (`whenDry: 'reuse-any'`), any healthy creature.
 * @param {any} world @param {NonNullable<ReturnType<typeof relayRule>>} rule @param {string[]} [used]   uids that fought earlier rounds
 * @returns {{per: number, dry: boolean, rows: Array<{uid: string, nickname: string, ok: boolean, fresh: boolean, reason: string|null}>}}
 */
export function relayChoices(world, rule, used = []) {
  const want = Number.isInteger(rule.playerPerRound) && rule.playerPerRound > 0 ? rule.playerPerRound : 2;
  const healthy = world.party.filter((c) => c.hp > 0);
  const fresh = healthy.filter((c) => !rule.noRepeat || !used.includes(c.uid));
  const dry = fresh.length < want && rule.whenDry === 'reuse-any';
  const rows = world.party.map((c) => {
    const fought = used.includes(c.uid);
    const ok = c.hp > 0 && (!rule.noRepeat || !fought || dry);
    return { uid: c.uid, nickname: c.nickname, ok, fresh: !fought, reason: c.hp <= 0 ? 'Resting.' : ok ? null : 'Fought a round already.' }; // str
  });
  return { per: Math.min(want, rows.filter((r) => r.ok).length), dry, rows };
}

/**
 * The picks a Relay round takes when the player chooses none: fresh creatures first, in party order.
 * @param {any} world @param {NonNullable<ReturnType<typeof relayRule>>} rule @param {string[]} [used]
 * @returns {string[]}
 */
export function relayDefaultPicks(world, rule, used = []) {
  const ch = relayChoices(world, rule, used);
  const ok = ch.rows.filter((r) => r.ok);
  return [...ok.filter((r) => r.fresh), ...ok.filter((r) => !r.fresh)].slice(0, ch.per).map((r) => r.uid);
}

/**
 * The setup of the next Relay round after a won one (no healing between rounds: the world party
 * stands as the last round left it; the twins' heal items carry over).
 * @param {BattleSession} session  the round just won
 * @param {string[]} [picks]       the player's two for the next round (default {@link relayDefaultPicks})
 * @returns {BattleSetup|null}     null when there is no next round
 */
export function relayNextSetup(session, picks) {
  const r = session.relay;
  if (!r || r.final) return null;
  const used = [...new Set([...r.used, ...r.picks])];
  return { ...session.setup, relay: { round: r.round + 1, used, picks: Array.isArray(picks) ? picks.slice() : null, foeItems: session.battle.sides[1].items.map((x) => ({ ...x })) } };
}

// ---------------------------------------------------------------------------------------------
// The Reading from data (MID-18, engine side)
// ---------------------------------------------------------------------------------------------

/** An aspect's battle types: its Unfixed queue's first two (Star and the phase's type). @param {any} a @returns {string[]} */
function aspectTypes(a) {
  const q = Array.isArray(a?.typeQueue) ? a.typeQueue : [];
  return q.slice(0, 2).length ? q.slice(0, 2) : ['Star'];
}

/**
 * Engine Reading phases from spires.js `THE_READING`: phase 1 wears the arrival aspect; every later
 * phase rolls one of the three aspects the phase before posted (`next`), at the dial's odds; an
 * aspect's `weather` holds for its phase; a phase `rule.evasion` raises the Vagary's evasion.
 * `offer: true` gives the one-phase night the seventh phase's Anchor / Reroll adds (its rings).
 * @param {any} reading   THE_READING
 * @param {{from?: number, count?: number, offer?: boolean, odds?: {up: number, side: number, down: number}|null}} [opts]
 *   `from` / `count`: the 1-based phase to start at and how many (default all)
 * @returns {Array<{id: string, name: string, types: string[], turns: number, cards: any[]|null, odds: any, rule: any}>}
 */
export function readingPhasesFrom(reading, opts = {}) {
  const phases = Array.isArray(reading?.phases) ? reading.phases : [];
  const turns = Number.isInteger(reading?.phaseTurns) && reading.phaseTurns > 0 ? reading.phaseTurns : 2;
  const cardsOf = (next) => (Array.isArray(next?.cards) ? next.cards.map((k) => ({ dir: k.dir, name: k.aspect.name, types: aspectTypes(k.aspect), ...(k.aspect.weather ? { weather: k.aspect.weather } : {}) })) : null);
  const odds = opts.odds ?? null;
  if (opts.offer) {
    const last = phases[phases.length - 1];
    return [{ id: 'offer', name: last?.name ?? 'The Reading', types: aspectTypes(last?.next?.cards?.[0]?.aspect), turns, cards: cardsOf(last?.next), odds, rule: {} }];
  }
  const out = phases.map((p, i) => ({
    id: `phase-${p.n ?? i + 1}`, name: p.name, turns, rule: p.rule ? { ...p.rule } : {}, odds,
    types: i === 0 ? aspectTypes(reading.arrival) : aspectTypes(phases[i - 1].next?.cards?.[0]?.aspect),
    cards: i === 0 ? null : cardsOf(phases[i - 1].next),
    ...(i === 0 && reading.arrival ? { aspect: reading.arrival.name } : {}),
  }));
  const from = Math.max(1, Math.min(out.length, Number.isInteger(opts.from) ? opts.from : 1));
  const count = Number.isInteger(opts.count) && opts.count > 0 ? opts.count : out.length;
  return out.slice(from - 1, from - 1 + count);
}

/** The Vagary's level at the Reading: party max + offset, within [min, max] (THE_READING `level`). @param {any} reading @param {any} world @returns {number} */
export function readingLevel(reading, world) {
  const l = reading?.level ?? {};
  const top = Math.max(1, ...(world.party || []).map((c) => c.level || 1));
  return Math.max(l.min ?? 1, Math.min(l.max ?? 100, top + (l.offset ?? 0)));
}

// ---------------------------------------------------------------------------------------------
// The Summit Bell (MID-10)
// ---------------------------------------------------------------------------------------------

/**
 * Whether the Summit Bell holds your place on this dial (data/dials.js `shift.summitBellHolds`;
 * GDD-00: Drift and Flux yes, Freefall no).
 * @param {string} dial @param {any} data @returns {boolean}
 */
export function summitBellHolds(dial, data) {
  const d = row(data, 'dials', dial);
  if (d && d.shift && typeof d.shift.summitBellHolds === 'boolean') return d.shift.summitBellHolds;
  return dial !== 'freefall';
}

/**
 * The Summit's between-fights top-up (spires.js SUMMIT.between `ppTopUp`; the balance sim's Summit run):
 * every move of every party creature regains `n` PP (never past its max); HP, faints and status stay.
 * Goes through party.applyOutcome, the party's own writer. Call inside a store tx.
 * @param {any} world @param {number} n @param {{data: any, bus?: any, tuning?: any}} ctx
 * @returns {number} the PP given back in all
 */
export function summitPpTopUp(world, n, ctx) {
  if (!(n > 0)) return 0;
  let given = 0;
  const copies = world.party.map((c) => ({
    uid: c.uid, hp: c.hp, status: c.status ? { ...c.status } : null,
    moves: c.moves.map((m) => {
      const pp = Math.min(m.maxPp, m.pp + n);
      given += Math.max(0, pp - m.pp);
      return { id: m.id, pp };
    }),
  }));
  if (given > 0) party.applyOutcome(world, { party: copies, exp: [] }, ctx.data, null, { tuning: ctx.tuning, bus: ctx.bus });
  return given;
}

/** The Summit's Keepers and Champion (trainer class 'keeper' / 'champion'). @param {any} data @returns {any[]} */
function summitTrainers(data) {
  try { return (typeof data.list === 'function' ? data.list('trainers') : Object.values(data.trainers || {})).filter((t) => t && (t.class === 'keeper' || t.class === 'champion')); } catch { return []; }
}

/**
 * Restarts the Summit climb at the first Keeper: the beaten Keepers stand again (their
 * `sys.trainer.<id>` flags clear). Freefall does this on every loss; on Drift and Flux it is the
 * Bell's "decline" (spires.js SUMMIT_BELL `declineRestartsAt`). Call inside a store tx.
 * @param {any} world @param {{data: any, bus?: any}} ctx
 * @returns {string[]} the trainer ids that stand again
 */
export function restartSummit(world, ctx) {
  const out = [];
  for (const t of summitTrainers(ctx.data)) {
    if (!flags.hasFlag(world, `sys.trainer.${t.id}`)) continue;
    flags.clearFlag(world, `sys.trainer.${t.id}`, { bus: ctx.bus });
    out.push(t.id);
  }
  return out;
}

/**
 * Declining the Summit Bell (Drift / Flux): the climb starts again from the first Keeper.
 * @param {any} G @returns {string[]} the trainer ids that stand again
 */
export function declineSummitBell(G) {
  return G.store.tx('summit.decline', (w) => restartSummit(w, { data: G.data, bus: G.bus }));
}

// ---------------------------------------------------------------------------------------------
// Between turns
// ---------------------------------------------------------------------------------------------

/**
 * Rounds raw odds to the whole percent shown, inside the clamp (mirrors systems/capture).
 * @param {number} raw @param {Record<string, any>} tuning
 * @returns {number}
 */
function roundShown(raw, tuning) {
  if (raw >= 1) return 1;
  const t = capture.tuningOf(tuning);
  const lo = Math.ceil(t.CAPTURE_ODDS_MIN * 100 - 1e-9);
  const hi = Math.floor(t.CAPTURE_ODDS_MAX * 100 + 1e-9);
  return Math.min(hi, Math.max(lo, Math.round(raw * 100))) / 100;
}

/**
 * The capture odds for one grade against the current foe, exactly as rolled.
 * @param {BattleSession} session @param {string|number} grade
 * @returns {import('../capture.js').CaptureOdds}
 */
function captureOddsFor(session, grade) {
  const b = session.battle;
  const foe = b.foeOf(0);
  const st = b.state();
  return capture.captureOdds(foe, {
    grade, fails: b.captureFails.get(foe.uid) || 0, data: session.data, stance: st.captureStance, trapped: st.sides[1].trapped,
  }, { dial: session.dial, tuning: session.tuning, rules: { captureDisplay: b.rules.captureDisplay === 'bands' ? 'band' : 'percent' } });
}

/** @param {BattleSession} session @param {string|number} grade @returns {number} */
function shownOddsFor(session, grade) {
  return captureOddsFor(session, grade).p;
}

/**
 * @typedef {Object} CaptureRow
 * @property {string|number} grade  @property {string} itemId  @property {string} name
 * @property {number} stock  @property {number} mult
 * @property {number} pct  @property {string} band  @property {'percent'|'band'} display  @property {number|string} shown
 * @property {number|string|null} nextShown  odds after one more failed raise (null for the sure catch)
 * @property {boolean} sure  @property {boolean} selectable  @property {string|null} reason
 */

/**
 * The Lantern panel: every wick grade with its stock and the odds shown BEFORE spending (exact % on
 * Drift / Flux, a band on Freefall), plus Isolde's Lantern when it is held.
 * @param {BattleSession} session
 * @returns {{rows: CaptureRow[], fails: number, stance: boolean, available: boolean, reason: string|null}}
 */
export function captureMenu(session) {
  const b = session.battle;
  const legal = b.legal(0);
  if (!legal.lantern || !legal.lantern.available) return { rows: [], fails: 0, stance: false, available: false, reason: legal.lantern ? legal.lantern.reason : null };
  const lantern = session.tuning.lantern || {};
  const rows = [];
  for (const [grade, itemId] of Object.entries(GRADE_ITEMS)) {
    const g = /^\d+$/.test(grade) ? Number(grade) : grade;
    const stock = b.sides[0].bag.lanterns ? (b.sides[0].bag.lanterns[g] || 0) : 0;
    const sure = grade === 'sure';
    if (sure && stock <= 0) continue;
    const o = captureOddsFor(session, g);
    const item = row(session.data, 'items', itemId);
    const name = item ? item.name : (lantern[g] && lantern[g].name) || itemId;
    rows.push({
      grade: g, itemId, name, stock, mult: sure ? Infinity : (lantern[g] ? lantern[g].mult : 1),
      pct: o.pct, band: o.band, display: o.display, shown: o.shown, nextShown: o.next ? o.next.shown : null, sure,
      selectable: stock > 0, reason: stock > 0 ? null : 'none-left',
    });
  }
  return { rows, fails: legal.lantern.fails, stance: !!(legal.captureStance && legal.captureStance.on), available: true, reason: null };
}

/**
 * @typedef {Object} BagRow
 * @property {string} id  @property {string} name  @property {number} count
 * @property {boolean} selectable  @property {string|null} reason   'hp-full' | 'no-ward' | 'field-only' | engine text
 * @property {'heal'|'crackdust'|'wick'|'field'} kind  @property {string|number} [grade]   a wick's Lantern grade
 */

/**
 * The battle Bag: medicine the engine applies (heals), Crackdust (refused, and kept, against a
 * creature with no active Ward) and the field-only medicine with its reason. Wicks live under the
 * Lantern.
 * @param {BattleSession} session
 * @param {any} world
 * @returns {BagRow[]}
 */
export function bagMenu(session, world) {
  const b = session.battle;
  const legal = b.legal(0);
  /** @type {BagRow[]} */
  const out = [];
  for (const id of BATTLE_MEDICINE) {
    const count = b.sides[0].items.filter((it) => it.id === id).length;
    if (!count) continue;
    const e = legal.items.find((it) => it.id === id);
    const it = row(session.data, 'items', id);
    out.push({ id, name: it ? it.name : id, count, kind: it?.use === 'heal' ? 'heal' : it?.use ?? 'heal', selectable: !!(e && e.selectable), reason: e && !e.selectable ? e.reason : null });
  }
  const dust = b.sides[0].bag.crackdust || 0;
  if (dust > 0) {
    const e = legal.items.find((it) => it.id === 'crackdust');
    out.push({ id: 'crackdust', name: row(session.data, 'items', 'crackdust')?.name ?? 'Crackdust', count: dust, kind: 'crackdust', selectable: !!(e && e.selectable), reason: e && !e.selectable ? (e.reason || 'no-ward') : null });
  }
  // wicks burn from the Lantern; listed here so the satchel reads whole (wild battles open the Lantern)
  const lanternOk = !!(legal.lantern && legal.lantern.available);
  for (const [grade, id] of Object.entries(GRADE_ITEMS)) {
    const n = b.sides[0].bag.lanterns ? (b.sides[0].bag.lanterns[/^\d+$/.test(grade) ? Number(grade) : grade] || 0) : held(world, id, session.data);
    if (!n) continue;
    const it = row(session.data, 'items', id);
    out.push({ id, name: it ? it.name : id, count: n, kind: 'wick', grade: /^\d+$/.test(grade) ? Number(grade) : grade, selectable: lanternOk, reason: lanternOk ? null : 'not-wild' });
  }
  for (const id of FIELD_ONLY_MEDICINE) {
    const n = held(world, id, session.data);
    if (!n) continue;
    const it = row(session.data, 'items', id);
    out.push({ id, name: it ? it.name : id, count: n, kind: 'field', selectable: false, reason: 'field-only' });
  }
  return out;
}

/**
 * Readies an action for the engine: the heal fraction of a medicine for the creature now out
 * (items heal a fixed amount; the engine heals a fraction), and the grade the capture roll uses.
 * @param {BattleSession} session
 * @param {any} action
 * @returns {any} the action
 */
export function prepareAction(session, action) {
  const b = session.battle;
  if (action && action.type === 'item' && HEAL_ITEMS.includes(action.id)) {
    const it = row(session.data, 'items', action.id);
    const c = b.active(0);
    const frac = it && Number.isInteger(it.amount) ? Math.min(1, it.amount / Math.max(1, c.stats.hp)) : 1;
    const entry = b.sides[0].items.find((x) => x.id === action.id);
    if (entry) entry.heal = frac;
  }
  session.pendingCapture.grade = action && action.type === 'lantern' ? action.grade : null;
  return action;
}

/**
 * Spends from the world bag what the player's side just used (wicks on a raise, medicine and
 * Crackdust on use), so a later loss never refunds them. Call right after each engine step.
 * @param {any} G
 * @param {BattleSession} session
 * @param {any[]} events
 */
export function noteEvents(G, session, events) {
  const spend = [];
  for (const ev of events || []) {
    if (ev.type === 'capture-shake' && ev.side === 0) spend.push(GRADE_ITEMS[ev.grade]);
    else if (ev.type === 'item' && ev.side === 0) spend.push(ev.item);
  }
  if (!spend.length) return;
  G.store.tx('battle.spend', (w) => {
    for (const id of spend) {
      if (!id) continue;
      try { bag.take(w, id, 1, { data: session.data, bus: G.bus, confirm: true, source: 'battle' }); } catch { /* unknown item: nothing to spend */ }
    }
  });
}

/**
 * EXP bar model of a player creature: level and fill fraction on its own curve.
 * @param {BattleSession} session @param {string} uid
 * @returns {{level: number, exp: number, lo: number, hi: number, frac: number}|null}
 */
export function expDisplay(session, uid) {
  const m = session.expModel[uid];
  if (!m) return null;
  const opts = { tuning: session.tuning };
  let lo;
  let hi;
  try {
    lo = exp.expForLevel(m.growth, m.level, opts);
    hi = exp.expForLevel(m.growth, m.level + 1, opts);
  } catch {
    return { level: m.level, exp: m.exp, lo: 0, hi: 1, frac: 0 };
  }
  const frac = hi > lo ? Math.max(0, Math.min(1, (m.exp - lo) / (hi - lo))) : 1;
  return { level: m.level, exp: m.exp, lo, hi, frac };
}

/**
 * Advances the display model on an `exp` or `levelup` event (the bar fills, wraps on a level).
 * @param {BattleSession} session @param {any} ev
 * @returns {boolean} whether the model changed
 */
export function applyExpEvent(session, ev) {
  const m = ev && session.expModel[ev.uid];
  if (!m) return false;
  if (ev.type === 'exp') { m.exp += ev.amount; return true; }
  if (ev.type === 'levelup') { m.level = ev.to; return true; }
  return false;
}

// ---------------------------------------------------------------------------------------------
// The outcome
// ---------------------------------------------------------------------------------------------

/**
 * A bus that records events instead of emitting them, so the scene can release each domain event
 * at the moment its animation plays (level-up chime with the level-up flash, the warm chord with the
 * fold into light).
 * @returns {{emit: (evt: string, payload: any) => void, take: (pred: (evt: string, payload: any) => boolean) => Array<[string, any]>, list: Array<[string, any]>}}
 */
export function createDeferredBus() {
  /** @type {Array<[string, any]>} */
  const list = [];
  return {
    list,
    emit(evt, payload) { list.push([evt, payload]); },
    take(pred) {
      const out = [];
      for (let i = 0; i < list.length;) {
        if (pred(list[i][0], list[i][1])) out.push(list.splice(i, 1)[0]);
        else i++;
      }
      return out;
    },
  };
}

/**
 * Writes an ended battle into the world, once (a second call returns the first result). One
 * transaction: the outcome through `party.applyOutcome` (engine EXP amounts on each creature's own
 * curve, windows opened into `pendingShifts`, HP / PP / status, the catch with a fresh uid and its
 * Field Log Held), Field Log Seen / Read, then by outcome: payout, defeated-trainer flag, Spire seal
 * + Starsalt + Spire share + anchor grant; or the blackout (cost through `wallet.blackout`, party
 * healed, one game hour later unless Real Clock) when it costs; story / Summit losses cost nothing.
 * @param {any} G
 * @param {BattleSession} session
 * @param {{bus?: {emit: Function}|null}} [opts]   where domain events go (default `G.bus`)
 * @returns {PostBattle}
 */
export function applyBattleResult(G, session, opts = {}) {
  if (session.applied) return session.applied;
  const battle = session.battle;
  const r = battle.result();
  if (!r.ended) throw new Error('battleFlow.applyBattleResult: the battle has not ended');
  const bus = opts.bus === undefined ? G.bus : opts.bus;
  const data = session.data;
  const tuning = session.tuning;
  const trainer = session.trainer;
  /** @type {PostBattle} */
  const post = {
    outcome: r.outcome, levelUps: [], windowsOpened: [], caught: null, caughtLost: null, blackout: null, payout: 0, badge: null,
    starsalt: 0, spireShare: 0, rewards: [], script: null, trainerId: trainer ? trainer.id : null, kind: session.kind, source: session.source,
    porchDuel: !!session.porchDuel,
  };
  G.store.tx('battle.result', (w) => {
    const ctx = { data, bus, tuning };
    const caughtCopy = r.caught ? { ...creature.serialize(r.caught), uid: party.nextUid(w), wild: false } : null;
    const markFieldLog = (world, state, formId) => {
      if (state === 'seen') fieldLog.markSeen(world, formId, ctx);
      else if (state === 'read') fieldLog.markRead(world, formId, null, ctx);
      else fieldLog.markHeld(world, formId, ctx);
    };
    const applied = party.applyOutcome(w, {
      party: battle.sides[0].party,
      exp: r.exp.map((e) => ({ uid: e.uid, amount: e.amount })),
      caught: caughtCopy,
      seen: [...battle.fieldLog.seen].filter((id) => !(w.fieldLog?.forms?.[id]?.seen)),
      read: [...battle.fieldLog.read].filter((id) => !(w.fieldLog?.forms?.[id]?.read)),
    }, data, caughtCopy ? G.rngs.fresh(`heartmark:${caughtCopy.uid}`) : null, { tuning, bus, markFieldLog });
    post.levelUps = applied.levelUps;
    post.windowsOpened = applied.windowsOpened;
    post.caughtLost = applied.caughtLost;
    if (applied.caught && caughtCopy) {
      post.caught = { uid: applied.caught.uid, where: applied.caught.where, speciesId: caughtCopy.speciesId, nickname: caughtCopy.nickname };
      stats.inc(w, 'catches', 1, { bus });
      // `scripted`: a capture the story stages (setup.scripted), which the Journal's first-catch stamp skips
      bus?.emit('capture:ok', { uid: applied.caught.uid, speciesId: caughtCopy.speciesId, where: applied.caught.where, scripted: !!(session.setup.scripted || session.setup.wild?.scripted) });
    }

    const midRelay = !!(session.relay && !session.relay.final);
    if (r.outcome === 'win' && trainer && midRelay) {
      // a Relay round won: nothing is settled until the last round (no flag, payout, badge or script)
      const rl = /** @type {NonNullable<BattleSession['relay']>} */ (session.relay);
      post.relay = { round: rl.round, of: rl.of, next: rl.round + 1, used: [...new Set([...rl.used, ...rl.picks])] };
    } else if (r.outcome === 'win' && trainer) {
      flags.setFlag(w, `sys.trainer.${trainer.id}`, true, { bus });
      if (r.payout > 0) {
        wallet.earn(w, r.payout, { ...ctx, source: 'battle' });
        post.payout = r.payout;
      }
      if (trainer.spire && !w.badges.includes(trainer.spire)) {
        w.badges.push(trainer.spire);
        post.badge = trainer.spire;
        const salt = Number.isInteger(tuning.spireWinStarsalt) ? tuning.spireWinStarsalt : 3;
        wallet.earn(w, salt, { ...ctx, currency: 'starsalt', source: 'spire' });
        post.starsalt = salt;
        try {
          const share = loans.spireShare(w, trainer.spire, ctx);
          if (share.ok) post.spireShare = share.credited;
        } catch { /* no loan state: nothing to credit */ }
        try { wallet.onBadge(w, trainer.spire, ctx); } catch { /* anchor grant rules missing */ }
        post.rewards = grantBadgeRewards(w, row(data, 'spires', trainer.spire), ctx);
        for (const rw of post.rewards) bus?.emit('toast', { text: rw.line, icon: 'star' });
        bus?.emit('badge:won', { spireId: trainer.spire, trainerId: trainer.id });
      }
      if (trainer.class === 'champion') bus?.emit('summit:cleared', { trainerId: trainer.id });
      // the Summit between fights (spires.js SUMMIT.between, GDD-04 §5): no heal, but every move regains 5 PP
      else if (session.summit) post.ppTopUp = summitPpTopUp(w, Number.isInteger(tuning.summitPpTopUp) ? tuning.summitPpTopUp : 5, ctx);
      post.script = trainer.scripts?.afterWin ?? null;
    } else if (r.outcome === 'loss') {
      post.script = session.setup.loseScript ?? trainer?.scripts?.afterLoss ?? null;
      if (session.blackoutAllowed) {
        const res = wallet.blackout(w, ctx);
        party.heal(w, { tuning, bus });
        stats.inc(w, 'blackouts', 1, { bus });
        if (G.clock && !w.settings?.realClock) {
          try { clockSys.setTime(w, G.clock, minuteOfDay(w) + (tuning.blackoutWakeDelayMinutes ?? 60)); } catch { /* clock double without skipTo */ }
        }
        post.blackout = { lost: res.lost, refund: res.refund, summit: false, free: res.lost === 0, wake: w.settings?.wakePoint === 'waystone' ? 'waystone' : 'porch' };
      } else if (session.summit) {
        // Summit losses cost nothing and never send you home (MID-10): on Drift / Flux the Bell holds
        // your place (party as this fight began, nothing refilled) at whoever beat you; on Freefall
        // every loss restarts the climb at the first Keeper.
        const holds = summitBellHolds(session.dial, data);
        const marker = `bell-restart-${trainer?.npc ?? String(trainer?.id ?? '').split('-')[0]}`;
        if (holds) {
          if (Array.isArray(session.snapshot)) party.applyOutcome(w, { party: session.snapshot, exp: [] }, data, null, { tuning, bus });
          post.summitBell = { holds: true, trainerId: trainer ? trainer.id : null, mapId: trainer?.map ?? 'keepers-hall', marker };
        } else {
          party.heal(w, { tuning, bus });
          const standing = restartSummit(w, ctx);
          post.summitBell = { holds: false, trainerId: trainer ? trainer.id : null, mapId: 'keepers-hall', marker: 'from-door', restarted: standing,
            line: 'Freefall: the Bell keeps nothing. The climb starts again at the first Keeper.' }; // str
          post.script = null;
        }
      } else if (session.setup.sentinel) {
        // a Spire sentinel costs nothing (spires.js `costs: 'nothing'`): the stone lets you rest and try again
        party.heal(w, { tuning, bus });
      }
    } else if (r.outcome === 'holdout' && trainer) {
      post.script = trainer.scripts?.afterWin ?? null;
    }
    // GDD-00 §6: story battles cost nothing and never wall progress, so the party leaves them healed
    // (the dock hold-out, the reeds lesson, story trainers). The Summit and the Reading keep their own rules.
    if (session.story && !session.summit && session.source !== 'reading') party.heal(w, { tuning, bus });
    const sentinel = session.setup.sentinel;
    if (r.outcome === 'win' && sentinel && typeof sentinel.id === 'string') {
      flags.setFlag(w, `sys.trainer.${sentinel.id}`, true, { bus });
      post.trainerId = sentinel.id;
      if (sentinel.lesson) {
        post.lesson = sentinel.lesson;
        bus?.emit('toast', { text: sentinel.lesson, ms: 6000 });
      }
    }
    if (session.summit) stats.inc(w, 'summitAttempts', 1, { bus });
    w.battleBookmark = null;
  });
  session.applied = post;
  return post;
}

/**
 * Puts a badge's gifts in the bag (spires.js `unlocks` of kind `key-item` and `disc`: the Scouting Prism
 * at badge 3, the Weatherglass at 5, the Plumbline disc at 6). The other unlock kinds (reader tools,
 * stock, travel, Commons projects, the gate) are read from `world.badges` by their own systems. Called
 * once, when the badge is first won; an item already held is not given again.
 * @param {any} world
 * @param {any} spire   the spires row (null: nothing)
 * @param {{data: any, bus?: any}} ctx
 * @returns {Array<{kind: string, item: string, name: string, line: string}>} what was given, for the seal slip
 */
export function grantBadgeRewards(world, spire, ctx) {
  const out = [];
  for (const u of Array.isArray(spire?.unlocks) ? spire.unlocks : []) {
    if (!u || (u.kind !== 'key-item' && u.kind !== 'disc') || typeof u.item !== 'string') continue;
    if (held(world, u.item, ctx.data) > 0) continue;
    let res;
    try { res = bag.give(world, u.item, 1, { data: ctx.data, bus: ctx.bus, source: 'badge' }); } catch { res = null; }
    if (!res || !res.ok) continue;
    const name = row(ctx.data, 'items', u.item)?.name ?? u.item;
    // a full satchel spills a slotted gift (the disc) into the basket at your feet: say so
    out.push({ kind: u.kind, item: u.item, name, line: res.overflow > 0 ? `Received: ${name} (satchel full: it waits in a basket at your feet)` : `Received: ${name}` }); // str
  }
  return out;
}

/**
 * Applies a learn-move choice to the world creature (after a level-up offer): `replaceIndex` null
 * keeps the current techniques.
 * @param {any} G
 * @param {string} uid
 * @param {string} moveId
 * @param {number|null} replaceIndex
 * @param {any} data
 * @returns {boolean} learned
 */
export function learnOffered(G, uid, moveId, replaceIndex, data) {
  if (replaceIndex === null || replaceIndex === undefined) return false;
  return G.store.tx('battle.learn', (w) => {
    const f = party.findCreature(w, uid);
    if (!f) return false;
    const ok = creature.learnMove(f.c, moveId, data, { tuning: tuningFor(data), replaceIndex });
    if (ok) G.bus?.emit('creature:learned', { uid, move: moveId });
    return ok;
  });
}

/**
 * Names a caught creature (after its confirm).
 * @param {any} G @param {string} uid @param {string} name
 * @returns {{ok: boolean, nickname?: string, reason?: string}}
 */
export function nameCaught(G, uid, name) {
  return G.store.tx('battle.nickname', (w) => party.nickname(w, uid, name, { bus: G.bus }));
}

// ---------------------------------------------------------------------------------------------
// Debug hooks (ARCHITECTURE §11)
// ---------------------------------------------------------------------------------------------

/**
 * Binds `__game.battle(id)`, `__game.wild(species, lv)` and `__game.forceForecast(uid)` onto the
 * debug hook. Idempotent; a no-op without `G.debugHook`.
 * @param {any} G
 * @returns {boolean} whether it bound
 */
export function installBattleDebug(G) {
  const hook = G && G.debugHook;
  if (!hook || typeof hook.bind !== 'function') return false;
  if (typeof hook.isBound === 'function' && hook.isBound('battle') && hook.isBound('wild') && hook.isBound('forceForecast')) return true;
  hook.bind('battle', (trainerId) => startBattle(G, { kind: 'trainer', trainerId: String(trainerId), debugParty: true }));
  hook.bind('wild', (speciesId, level = 5, extra = {}) => startBattle(G, { kind: 'wild', wild: { speciesId: String(speciesId), level: Number(level) || 5, ...extra }, debugParty: true }));
  hook.bind('forceForecast', (uid) => new Promise((resolve) => {
    const target = uid ?? G.world.party[0]?.uid;
    if (!target) throw new Error('__game.forceForecast: no creature');
    G.push('forecast', { uid: target, force: true, onDone: (r) => resolve(r && r.outcome ? r.outcome : 'closed') });
  }));
  return true;
}
