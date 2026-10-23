/**
 * Designer-tuned numbers, by name (GDD-02 Economy, from GDD-00 §5-§9 and §15). [DATA-ECON]
 *
 * ONE flat table read by every system: each system's `tuningOf(...)` picks the keys of its own
 * `DEFAULTS` from here and ignores the rest, so every key below is named exactly as the system that
 * reads it names it (SCREAMING keys are the creature lane's, camelCase keys the town/econ lane's and
 * the battle engine's). Every value is the GDD-00 value; the comment after it gives the GDD-00 rule
 * and, in [brackets], the range a chapter may tune inside without editing GDD-00. "fixed" means
 * GDD-00 states the number outright and only an edit to GDD-00 may move it.
 *
 * Keys under "Reference" are read by no system yet; they are the binding numbers for scripts, the
 * economy sim and the content chapters, kept here so that no number lives anywhere else.
 *
 * Collisions are resolved on purpose: `blackoutCap` (wallet + engine) is 1,500 for both; the world
 * modules' wander pauses live in the nested `npcFeel` / `roamerFeel` tables because `world/npc` and
 * `world/roamer` take a per-call `opts.tuning` and mean different things by `pauseMin`.
 *
 * Pure data: no imports, deep-frozen. Day / minute conventions: minutes of day 0..1440; "GDD day"
 * is 1-based (arrival = day 1, a Sunday); weekday 0 = Monday.
 * @module data/tuning
 */

const H = 60; // minutes per game hour

/** @template T @param {T} o @returns {T} */
function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freeze(v);
  }
  return o;
}

/** @type {Readonly<Record<string, any>>} */
export const TUNING = freeze({
  // ===== Clock and tide (systems/clockSys; GDD-00 §5) ============================================
  CLOCK_DEFAULT_MINUTES_PER_DAY: 24,   // one game day = 24 real minutes [settings 12 / 24 / 48 / Real Clock; fixed]
  CLOCK_DAY_LENGTHS: [12, 24, 48],     // the three Settings day lengths, real minutes [fixed]
  CLOCK_NIGHT_START: 18 * H,           // night rules from 18:00 [fixed: night is exactly half]
  CLOCK_NIGHT_END: 6 * H,              // ... to 06:00 [fixed]
  CLOCK_DAY_PARTS: [                   // the one day-part table music and the LUT read [fixed: 8 parts of 3 h]
    { id: 'deep-night', start: 0, track: 'h_night_deep', name: 'Deep night', tideWord: 'night' },
    { id: 'pre-dawn', start: 3 * H, track: 'h_predawn', name: 'Pre-dawn', tideWord: 'dawn' },
    { id: 'morning', start: 6 * H, track: 'h_morning', name: 'Morning', tideWord: 'morning' },
    { id: 'late-morning', start: 9 * H, track: 'h_late_morning', name: 'Late morning', tideWord: 'morning' },
    { id: 'midday', start: 12 * H, track: 'h_midday', name: 'Midday', tideWord: 'midday' },
    { id: 'afternoon', start: 15 * H, track: 'h_afternoon', name: 'Afternoon', tideWord: 'afternoon' },
    { id: 'dusk', start: 18 * H, track: 'h_dusk', name: 'Dusk', tideWord: 'evening' },
    { id: 'night', start: 21 * H, track: 'h_night', name: 'Night', tideWord: 'night' },
  ],
  CLOCK_ANCHORS: [                     // clock anchors the clock itself fires [fixed: §5 anchors]
    { id: 'builds', minute: 5 * H + 40 },   // 05:40 the Thatch tie off any overnight build
    { id: 'morning', minute: 6 * H },       // 06:00 mailbox, boards, Tide Table, Commons slip, Crate
  ],
  CLOCK_DAY1_WEEKDAY: 6,               // day 1 is a Sunday (0 = Monday) [fixed: Saturdays are days 7, 14, 21]
  TIDE_DAY1_LOW: 16 * H + 40,          // THE DAY-1 SEED: a low at 16:40, so the mainland causeway (±1 h) shuts at 17:40 behind you [fixed]
  TIDE_SPRING_EVERY_DAYS: 7,           // a spring tide every 7 days bares the Old Quay [fixed]
  TIDE_SPRING_FIRST_DAY: 7,            // days 7, 14, 21 ... (falls with the Lantern Market) [fixed]
  TIDE_WINDOWS: {                      // half-widths around a low, game minutes [fixed]
    causeway: 150,   // ±2.5 h (5 real minutes, twice a day)
    stones: 120,     // stepping stones ±2 h
    flats: 90,       // flats and sparkles ±1.5 h
    bar: 90,         // the Bar ±1.5 h of the day's LOWER low, until the Relighting
    spur: 90,        // the Lantern Stack spur ±1.5 h of every low
    mainland: 60,    // the mainland causeway ±1 h (arrival only)
  },
  TIDE_BAR_LIT_FLAG: 'lit.bar',        // the Relighting flag that makes the Bar walkable at any tide [fixed]
  REST_LIE_MINUTES: 10,                // bed: Lie down heals and takes 10 game minutes, any time [5-20]
  REST_LIE_HEAL: 1,                    // fraction healed by Lie down [fixed: full heal]
  REST_NAP_FROM: 12 * H,               // Nap till dusk from 12:00 [fixed]
  REST_NAP_WAKE: 18 * H,               // ... wakes at 18:00 [fixed]
  REST_NAP_HEAL: 1,                    // [fixed: full heal]
  REST_SLEEP_FROM: 21 * H,             // Sleep till dawn from 21:00 ("Too early. Someone's always buying.") [fixed: keeps the first Porchlight hour]
  REST_SLEEP_WAKE: 6 * H,              // wake at 06:00 for the letter [fixed]
  REST_SLEEP_HEAL: 1,                  // [fixed: full heal]
  REST_SIT_SPEED: 6,                   // porch bench Sit runs the clock ×6 while you sit [4-8]

  // ===== Calendar (systems/townCommon; read by dayPage, letters, schedule, threads) ==============
  calendarDayOffset: 1,                // GDD day = core day + 1 (arrival = day 1) [fixed]
  calendarFirstDow: 6,                 // core day 0 is a Sunday (0 = Monday) [fixed]
  homePorchId: 'porch-keepers-cottage',// your porch's manifest id (lit when loan 1 is paid) [fixed id]
  homePorchLitTier: 2,                 // lit once world.loans.tier reaches 2 (loan 1 paid; Dimity moves in) [fixed]
  porchesLitAtStart: [                 // 7 porches lit at arrival [fixed]
    'porch-coop-yard', 'porch-pells', 'porch-post-office', 'porch-archive', 'porch-wardens-house', 'porch-tully', 'porch-linnet',
  ],
  econDayStartMinute: 6 * H,           // the economy day turns at 06:00 (Crate settles, Wanted Today, shop rotation) [fixed]

  // ===== Day Page (systems/dayPage) =============================================================
  buildLandMinute: 5 * H + 40,         // builds land at 05:40 whether you sleep or not (also systems/loans) [fixed]
  dayStartMinute: 6 * H,               // the morning the overnight leads into [fixed]
  dayPageLogLines: 60,                 // Day Page lines kept (≤ schema LOG_MAX 60) [30-60]
  tomorrowMax: 8,                      // *Tomorrow:* lists at most 8 items [5-8]

  // ===== Letters (systems/letters; GDD-00 §5, §11) ==============================================
  letterHour: 6,                       // the Keeper letter at 06:00 [fixed]
  familyLetterHour: 18,                // one family letter at Hesper's counter from 18:00 [fixed]
  hesperCounterHours: [18 * H, 2 * H], // Hesper's counter 18:00-02:00 [fixed]
  keeperFirstDay: 2,                   // K1 on day 2 ... K20 on day 21 [fixed]
  familyFirstDay: 2,                   // F1 from day 2 [fixed]
  keeperNeedsLitPorch: true,           // Hesper delivers only to a lit porch (yours lights at loan 1) [fixed]
  mailboxHoldsOne: true,               // one per date, no accrual [fixed]
  counterHoursEnforced: true,          // the counter letter is collected in Hesper's hours [fixed]
  townPostFromDay: 22,                 // town letters still locked after K20 arrive by morning post from day 22 [fixed]
  townPostPerMorning: 1,               // one per morning post [1-2]

  // ===== Schedules, memory, threads (systems/schedule, memory, threads) =========================
  porchWindow: [19 * H, 1 * H],        // porch talk 19:00-01:00, wraps midnight [fixed]
  festivals: [                         // timed festival windows; the others are story / tide triggered (GDD-05 owns the table)
    { id: 'lantern-market', dow: [5], fromDay: 7, from: 20 * H, to: 2 * H }, // Saturdays 20:00-02:00 from day 7 [fixed]
  ],
  porchSupperHosts: [],                // empty: every lit neighbour porch in id order
  scheduleLookbackDays: 2,             // history the schedule resolver searches [1-3]
  noRepeatDays: 5,                     // 5-day no-repeat lines [fixed]
  nightWindow: [18 * H, 6 * H],        // the `night` line tag follows the night rules [fixed]
  affinityPerTalkDay: 1,               // affinity for the first talk of a day [1-2]
  affinityPorchBonus: 1,               // extra when that talk is porch talk [0-2]
  affinityGift: { love: 3, like: 2, neutral: 1, dislike: -1 }, // per gift reaction [±1 each]
  giftsPerDay: 1,                      // gifts that count per neighbour per day [fixed]
  nicknameMaxLength: 12,               // Tully's counter-offered nickname length [10-12]
  lingerPerDay: 1,                     // Linger second topics per neighbour per day [1-2]
  lineTagWeights: { porch: 8, shift: 6, lead: 5, gift: 4, weather: 4, pose: 3, nickname: 2, night: 2, known: 1, day: 1, generic: 0 },
  strictNoRepeat: false,               // false: when everything was said, the least recent line returns
  threadShareKinds: ['lead'],          // the six lead threads pay the resident share [fixed]
  threadDailyCapKinds: ['lead', 'template', 'cast'], // one beat a day at most [fixed]
  threadMondayDow: 0,                  // Monday beats (0 = Monday) [fixed]
  threadMondayWaivesSpacing: true,     // Monday beats for threads you are in [fixed]
  threadStartNeedsMet: true,           // beat 1 needs the neighbour met
  threadTopicPriority: 1000,           // above every authored topic

  // ===== Wallet (systems/wallet; GDD-00 §6, §7) =================================================
  blackoutCostFraction: 0.1,           // blackout: 10% of buttons on hand [fixed]
  blackoutCap: 1500,                   // ... capped at 1,500 (also the battle engine's key) [fixed]
  blackoutFloor: 500,                  // ... nothing if you hold under 500 [fixed]
  purseRefundFraction: 0.5,            // half the dropped amount goes into the Keeper's Purse [fixed]
  purseGlints: 3,                      // ... back in equal thirds over the next three Glints [fixed]
  glintBase: 500,                      // the Glint = 500 + 60 × day, exactly one a day (also systems/gather) [fixed]
  glintPerDay: 60,                     // [fixed]
  starsaltPrice: 800,                  // Starsalt 800 at the Raft and Ludo [fixed]
  starsaltDailyCap: 3,                 // max 3 a day, shared between the Raft and Ludo [fixed]
  anchorPrice: 500,                    // anchor stone 500 on Flux [fixed]
  anchorRules: {                       // per dial: stones at start, refill per badge, stones per badge, buyable [fixed]
    drift: { start: 3, refillTo: 3, perBadge: 0, buyable: true },    // 3 free, refilled to 3 per badge
    flux: { start: 2, refillTo: 0, perBadge: 0, buyable: true },     // Corin's 2 on your step, then 500 each
    freefall: { start: 0, refillTo: 0, perBadge: 1, buyable: false }, // 1 per badge, never sold
  },
  anchorRulesFallback: 'flux',

  // ===== Loans, builds, commissions, Commons (systems/loans; GDD-00 §7, §9) =====================
  loanLadder: [                        // fallback ladder only; data/loans.js LOANS is the source [fixed: 278,000]
    { tier: 1, amount: 6000, build: 'bedsit' },
    { tier: 2, amount: 15000, build: 'cottage' },
    { tier: 3, amount: 25000, commission: true },
    { tier: 4, amount: 36000, commission: true },
    { tier: 5, amount: 50000, commission: true },
    { tier: 6, amount: 66000, commission: true },
    { tier: 7, amount: 80000, build: 'lamp-room' },
  ],
  notchesPerStick: 20,                 // every stick has twenty notches whatever the loan (one per 5%) [fixed]
  beadValue: 1000,                     // Wren flicks one abacus bead per 1,000 [fixed]
  beadSpeedUpAfter: 10,                // ... speeding up after ten [8-12]
  spireShareFraction: 0.1,             // Spire share: 10% of the open loan, once per badge [fixed]
  residentShareFraction: 0.05,         // resident share: 5% (one notch) per finished lead thread [fixed]
  residentShareAfterPayoff: 4000,      // after payoff, 4,000 to the Commons Jar instead [fixed]
  errandCredit: 500,                   // First Night Errands: 6 × 500 off loan 1 [fixed]
  errandCount: 6,                      // [fixed]
  errandTier: 1,                       // loan 1 only [fixed]
  commissionTiers: [3, 4, 5, 6],       // pick 4 of 6 rooms at loans 3-6 [fixed]
  commissionRooms: ['training-yard', 'workshop', 'greenhouse', 'cellar', 'porch-loft', 'gallery'],
  leftoverCommissionPrice: 20000,      // the two rooms left over cost 20,000 each after the Relighting [fixed]
  buildSatchel: { cottage: 10, cellar: 10 }, // satchel 20 -> 30 (cottage) -> 40 (Cellar) [fixed]
  roofColours: ['slate-blue', 'ochre', 'harbor-red', 'moss', 'sea-blue', 'straw', 'tar', 'heather'], // 8 colours [fixed]
  roofDefault: 'slate-blue',           // slate blue is the cursor default [fixed]
  buildsPerNight: 1,                   // one build a night: the 7-night hard floor [fixed]
  relightMinute: 18 * H,               // the Relighting fires at the next dusk after the Lamp Room lands [fixed]
  relightFlag: 'sys.relighting-due',   // holds the clock day whose dusk fires it
  relitFlag: 'sp.relighting',          // manifest story flag: the lamp is lit
  firstPaymentFlag: 'sp.first-payment',// manifest story flag: the first THWAP (loan 1 clears)
  lampRoomBuiltFlag: 'sp.lamp-room-built', // manifest story flag: the Lamp Room lands (loan 7's build)
  clearedFlag: 'sys.loan.cleared',     // highest tier cleared
  paceWindowDays: 3,                   // Ledger pace line averages the last 3 economy days [2-5]
  ledgerLogMax: 60,                    // credits kept for the Ledger's "today by source"
  yardHours: [6 * H, 24 * H],          // Wren's yard 06:00-24:00 [fixed]
  commonsNeighborShare: 0.2,           // neighbours add 10-30% of a project (per-project values in data/loans.js) [0.1-0.3]
  commonsProjects: [                   // fallback only; data/loans.js COMMONS is the source [fixed costs]
    { id: 'dark-house-1', cost: 3000, neighborShare: 0.3 },
    { id: 'quay-lamps', cost: 4000, neighborShare: 0.2 },
    { id: 'mudlark-mile-flags', cost: 5000, neighborShare: 0.3 },
    { id: 'north-creek-footbridge', cost: 6000, neighborShare: 0.2 },
    { id: 'training-yard-green', cost: 10000, neighborShare: 0.1, cond: { badge: 5 } },
    { id: 'third-stall', cost: 12000, neighborShare: 0.2 },
  ],

  // ===== Shops (systems/shops; GDD-00 §7, §9) ===================================================
  wantedTodayMult: 1.5,                // Wanted Today +50% [fixed]
  wantedTodayCount: 3,                 // ... on 3 items [fixed]
  wantedStacksPerDay: 1,               // ... one stack each a day [fixed]
  crateRate: 0.9,                      // Consignment Crate pays 90% overnight [fixed]
  spareSellRate: 0.5,                  // spare items sold back at 50% [fixed]
  fullPriceKinds: ['fish', 'bug', 'fruit', 'relic', 'fossil', 'find', 'shell', 'honey', 'timber', 'silk'], // goods sold at full value
  rotatePickDefault: 2,                // rows drawn per rotating pool: "two discs a day" [fixed]
  freefallDiscConfirmAbove: 2500,      // Freefall asks to confirm a disc above 2,500 [fixed]
  freefallDial: 'freefall',
  discPocket: 'discs',

  // ===== Satchel (systems/bag; GDD-00 §13) ======================================================
  bagSlotsBase: 20,                    // satchel 20 slots [fixed]
  bagSlotsMax: 40,                     // -> 40 (cottage +10, Cellar +10) [fixed]
  bagUnslottedPockets: ['keepsakes', 'tools'], // one-of-a-kind things can never spill
  stackByKind: { fruit: 10, shell: 10 },  // fruit and shells stack to 10 [8-12]
  stackByGroup: { shore: 10 },         // collections' shore finds (cockles, whelks...) are the shells [8-12]
  stackMax: 99,                        // stack limit for a row without `stack`
  bagDefaultPocket: 'finds',

  // ===== Gathering (systems/gather; GDD-00 §7 income, §9) =======================================
  regrowDaysDefault: 2,                // trees regrow in 2 days [fixed]
  fruitRipeDays: 3,                    // ripe after 3 [fixed]
  fruitPerTree: 3,                     // a press shakes one fruit, three a tree [fixed]
  fruitRipeMult: 1.25,                 // ripe 150 / 120 and 600 / 480 [fixed]
  purseRange: [200, 600],              // purses in trees 200-600, one per purse tree a day [fixed]
  purseStep: 50,                       // purse values come in 50s
  hiveHumMs: 1000,                     // the bee hum warns 1 s before a nest drops [fixed]
  shellChance: 0.15,                   // a shake that drops a shell instead of nothing [0.1-0.2]
  cracksPerDay: 4,                     // ~4 cracks a day (a Grit or Stone lead opens a fifth) [fixed]
  glintRevealRadius: 1,                // tiles; a Grit/Stone lead raises it to 3
  sparklesPerLow: 3,                   // 3 sparkles per low [fixed]
  skyglassPerNightLow: [1, 3],         // skyglass relics per night low, max 3 [fixed max]
  skyglassRevealRadius: 2,             // tiles; a Glass/Hollow lead raises it to 5
  flatsWindowMinutes: 90,              // flats ±1.5 h of low [fixed]
  nightStartMinute: 18 * H,            // night for gather and encounter (night rules) [fixed]
  nightEndMinute: 6 * H,               // [fixed]
  cockleRakesPerLow: 4,                // cockle rakes per low [3-5]
  cockleRange: [1, 3],                 // cockles per rake
  bugSpookRadius: { still: 0, creep: 0, walk: 2, run: 4 },
  netReach: 1,
  bugSpawnChance: 0.25,
  bugLightMult: 2,                     // more bugs at lit porches and string lights [1.5-3]
  bugRainMult: 1.5,                    // rain brings bugs [1.25-2]

  // ===== Field Log, crossovers (systems/fieldLog; GDD-00 §9 Crossovers; GDD-05 may refine) =======
  creatureBonuses: {                   // the party lead's type; bonuses, never locks [fixed rules]
    brine: { fishNameSpecies: true, tellCatches: 1, biteWindowMult: 1.5 },
    gust: { shakeAllFruit: true, hiveBlowClear: true },
    grit: { markCracks: true, extraCracks: 1, glintSeeRadius: 3 },
    stone: { markCracks: true, extraCracks: 1, glintSeeRadius: 3 },
    glass: { skyglassSeeRadius: 5, skyglassByDay: true },
    hollow: { skyglassSeeRadius: 5, skyglassByDay: true },
    bolt: { humRadius: 4, mothLightMult: 2 },
    moss: { graftNightsSooner: 1 },
    rime: { extraShadows: 1 },
    kiln: { cleanFindsPerDay: 1 },
  },
  fishTellCatches: 3,                  // a species' tell is learned after 3 catches [fixed]
  findCleanMult: 1.4,                  // cleaned fossils +40% [fixed]

  // ===== Fishing (systems/fishing; GDD-00 §7, §9) ===============================================
  fishShadowsPerReach: [4, 8],         // 4-8 shadows per reach [fixed]
  fishReachFloor: 0.4,                 // reach health dips when fished hard, floor 40% [fixed]
  fishReachRecoverMinutes: 1440,       // recovers in a day [fixed]
  fishReachCatchCost: 0.1,             // health lost per catch [0.05-0.15]
  fishReleaseNudge: 0.05,              // health a release gives back
  fishReachBusyAt: 0.75,               // "the reach is busy" line below this
  fishFeints: [1, 3],                  // cast, feint, feint, bite
  fishBiteFrames: [7, 31],             // bite window 7-31 frames by species [fixed]
  fishBiteFramesDefault: 18,
  fishGentleFrames: [36, 54],          // Gentle 36-54 frames [fixed]
  fishPatientReelFrames: 60,           // Patient: hold to reel, no window
  fishApproachFrames: [45, 120],
  fishFeintGapFrames: [30, 75],
  fishCreatureChance: 0.05,            // any reach can hook a wild Bilgebob, Creelwight or Rushling [0.03-0.08]

  // ===== Encounters and Errants (systems/encounter; GDD-00 §4, §5, §8) ==========================
  encounterRateDefault: 0.08,          // per-step chance in grass when a spawn gives none [0.06-0.10]
  encounterMinLevel: 1,
  encounterMaxLevel: 100,
  encounterMinSteps: 8,                // steps of grace after a battle [6-10]
  encounterNightLevelBonus: 2,         // night wild levels +2 [fixed]
  errantRouteChance: 1 / 300,          // an Errant on its current route, per encounter [1/400-1/200]
  errantLitChance: 1 / 120,            // after the Relighting, 1 in 120 night encounters on the lit point [fixed]
  errantRoamMinutes: 60,               // Skyroam: moves one route per game hour [fixed]
  errantReturnNextDay: true,           // beaten or caught, each returns the next day [fixed]
  errantReturnOnBadge: true,
  errantReturnPlayMs: 2 * 60 * 60 * 1000,

  // ===== EXP and windows (systems/exp; GDD-00 §8 EXP) ===========================================
  MAX_LEVEL: 100,
  GROWTH_CURVES: {                     // cumulative EXP to reach level L = 8 × L² on every curve [fixed formula]
    fast: { num: [0, 8, 0, 0], den: 1 },
    'medium-fast': { num: [0, 8, 0, 0], den: 1 },
    'medium-slow': { num: [0, 8, 0, 0], den: 1 },
    slow: { num: [0, 8, 0, 0], den: 1 },
  },
  EXP_DIVISOR: 5,                      // KO EXP = yield × foe level ÷ 5 [fixed]
  TRAINER_EXP_MULT: 1.5,               // trainer battles ×1.5 [fixed]
  PARTICIPANT_SHARE: 1,                // battlers 100% [fixed]
  BENCH_SHARE: 0.6,                    // bench 60% [fixed]
  FAINTED_EXP_SHARE: 0,
  SIBLING_SHARE: 0.3,                  // Big Sibling +30% to the lowest party member [fixed]
  YARD_SHARE: 0.25,                    // Training Yard: 25% of party EXP [fixed]
  YARD_CAP: 3,                         // ... to 3 stored creatures [fixed]
  CATCH_UP_STEP_LEVELS: 5,             // catch-up +50% per 5 levels under the posted curve [fixed]
  CATCH_UP_STEP: 0.5,                  // [fixed]
  CATCH_UP_CAP: 3,                     // cap ×3 [fixed]
  DAMP_START: 10,                      // Porch Duel EXP ×0.5 past curve + 10 [fixed]
  DAMP_FACTOR: 0.5,                    // [fixed]
  DAMP_SOURCES: ['rematch', 'duel'],   // the Rematch board (Porch Duels) only
  WINDOW_LEVELS: [8, 20, 34],          // windows at Lv8 / 20 / 34; families offset ±2 in data [fixed]
  USE_FAMILY_WINDOWS: true,            // a family's own windows (the ±2 offsets) win
  SKIP_WINDOW_AT_CATCH_LEVEL: true,
  HOLD_WINDOWS_IN_BOX: true,
  STILL_KNOT_MODE: 'consume',          // a Still Knot spends windows unused while held [fixed]
  PIP_LEAD_LEVELS: 1,                  // the pip shows one level before [fixed]

  // ===== Creatures and party (systems/creature, systems/party) ==================================
  MOVE_SLOTS: 4,                       // [fixed]
  MENDS_PER_BATTLE: 3,                 // Mends: 3 heals per creature per battle [fixed]
  MAX_BOND: 5,                         // Bond: 5 pips [fixed]
  TRAINED_MAX: 252,
  TRAINED_DIVISOR: 4,
  HP_FLAT: 10,
  STAT_FLAT: 5,
  STAT_FLOOR: { drift: 0.1, flux: 0.2, freefall: null }, // stat floor per Shift: 10% / 20% / none [fixed]
  MARK_SPREAD: { x: 2, y: 2 },
  UNFIXED_PICKS: 3,
  FALLBACK_MOVE: null,
  DEFAULT_LEVEL: 5,                    // the starter is Lv5 [fixed]
  PP_RESTORE_DEFAULT: 10,
  PARTY_MAX: 6,                        // [fixed: singles, six rows]
  BOX_CAPACITY: 20,                    // storage base 20 (the Cellar makes it 40: boxCapacityCellar) [fixed]
  NICKNAME_MAX: 12,
  LIGHT_ON_CATCH: true,

  // ===== Capture (systems/capture; GDD-00 §8 Capture) ===========================================
  CAPTURE_FAIL_BONUS: 0.03,            // +3% per failed attempt on the same creature [fixed]
  CAPTURE_FAIL_CAP: 0.15,              // ... capped at +15% [fixed]
  CAPTURE_ODDS_MIN: 0.01,              // displayed odds clamp to 1-95% [fixed]
  CAPTURE_ODDS_MAX: 0.95,              // (scripted captures and Isolde's Lantern are 100%) [fixed]
  CAPTURE_STATUS_MULT: { chill: 1.5, numb: 1.5, trap: 1.5, burn: 1.25, poison: 1.25 }, // prototype values, accepted
  CAPTURE_BANDS: [[0.25, 'Slim'], [0.5, 'Fair'], [0.8, 'Good'], [Infinity, 'Sure']], // Freefall bands [fixed words]
  CAPTURE_DISPLAY: { drift: 'percent', flux: 'percent', freefall: 'band' }, // exact % / exact % / bands [fixed]
  LANTERNS: { 1: { mult: 1 }, 2: { mult: 1.5 }, 3: { mult: 2 }, sure: { mult: 1, sure: true } }, // wick grades [fixed]
  CAPTURE_SEGMENTS: 3,                 // the three-segment meter [fixed]
  ROUND_TO_SHOWN: true,                // odds shown = odds rolled [fixed]
  lanternGrades: { 'capture:1': 1, 'capture:2': 1.5, 'capture:3': 2 }, // item use key -> odds multiplier (Tallow / Brass / Skyglass) [fixed]

  // ===== Shift Forecast (systems/forecast; GDD-00 §8 Shift windows and odds) ====================
  CARD_ODDS: {                         // Up / Side / Down base odds [fixed]
    drift: { up: 50, side: 40, down: 10 },
    flux: { up: 40, side: 35, down: 25 },
    freefall: { up: 30, side: 30, down: 40 },
  },
  BOND_STEP: 5,                        // +5 pts Down -> Up per Bond pip [fixed]
  BOND_CAP: { drift: 5, flux: 15, freefall: 10 }, // Bond cap per dial [fixed]
  DOWN_FLOOR: { drift: 5, flux: 0, freefall: 0 },  // Drift's Down never drops under 5 (50/45/5 when lit)
  STEADY_POINTS: 5,                    // lit.steadied: after Bond, 5 pts Down -> Side [fixed]
  STAR_CHANCE: 0.02,                   // Star-touched in the Side slot on 2% of Forecasts [fixed]
  STAR_CARD: 'side',                   // [fixed]
  SHIFTLOG_PULL: 5,                    // +5 weight per form already in this creature's Shiftlog [fixed]
  PULL_REVIVES_ZERO: false,
  ERRANT_FLAG: 'errant',
  ERRANT_ZERO_DOWN: { drift: true, flux: true, freefall: false }, // Errant Down card never a hatchling on Drift/Flux [fixed]
  TILT_GUARANTEE: true,
  TILT_WEIGHT_MULT: 2,                 // a held type tilt: that type's forms weigh ×2 on every card [fixed]
  SILHOUETTE_DIALS: ['freefall'],      // unseen forms show as silhouettes on Freefall only [fixed]
  POOL_FLAT_DIALS: ['freefall'],       // pool weights inside a card: source on Drift/Flux, flattened on Freefall [fixed]
  SILHOUETTE_MARKS_SEEN: false,
  REROLL_BASE: 1,                      // Reroll costs 1 / 2 / 4 / 8 ... Starsalt [fixed]
  REROLL_GROWTH: 2,                    // doubling within one window, no cap [fixed]
  REROLL_COST_MULT: { drift: 1, flux: 1, freefall: 1 },
  REROLL_UNLOCK_BADGES: 1,             // Maud teaches Reroll; badge 1 unlocks it [fixed]
  ANCHOR_COST: 1,                      // Anchor spends one stone and uses the window [fixed]
  ANCHOR_CHALLENGE_COST: {},           // no shipped challenge raises it
  ANCHOR_DISABLED_CHALLENGES: ['ride-the-dice'], // Ride the Dice: Anchor disabled [fixed]
  AUTO_UP_STRICT: true,

  // ===== Weather (systems/weather; GDD-00 §9) ===================================================
  WEATHER_WEIGHTS: { clear: 34, overcast: 26, rain: 20, fog: 12, storm: 8, snow: 0 }, // the five kinds; no snow in a harbor summer
  WEATHER_USE_SEASONS: false,          // one season
  WEATHER_DAYS_PER_SEASON: 28,
  WEATHER_SEASON_WEIGHTS: { summer: { clear: 44, storm: 10 } },
  WEATHER_ODDS_WEIGHTS: [[5, 1], [6, 2], [7, 3], [8, 3], [9, 1]], // Augusta's "n in 10" odds
  WEATHER_ONSET_LEAD: [0, 120],
  WEATHER_INTENSITY: { clear: [0, 0], overcast: [0.2, 0.5], rain: [0.3, 0.9], fog: [0.4, 1], storm: [0.7, 1], snow: [0, 0] },
  WEATHER_EFFECTS: {
    clear: [],
    overcast: [],
    rain: [{ target: 'bug', tag: '*', mult: 1.5 }, { target: 'encounter', tag: 'brine', mult: 1.25 }],   // rain brings bugs
    fog: [{ target: 'fish', tag: 'silver', mult: 2 }, { target: 'encounter', tag: 'hollow', mult: 1.25 }], // fog pulls silver schools in
    storm: [{ target: 'errant', tag: 'lightning', mult: 2 }, { target: 'find', tag: 'shore', mult: 2 }, { target: 'fish', tag: 'storm', mult: 1.5 }], // Errant lightning on the sea
    snow: [],
  },
  WEATHER_OVERLAY_CAP: 0.35,           // weather overlays cap at 35% [fixed]
  WEATHER_FIXED: { 1: 'clear' },       // arrival evening is clear

  // ===== Battle engine (battle/*; GDD-00 §8 Battle rules kept, Rulings for proto/battle) =========
  softenMult: 0.5,
  lowHpThreshold: 0.25,
  lowHpBoost: 1.3,
  typeBoostMult: 1.2,
  critBoostStages: 2,
  revealCount: 1,
  categoryReductionMult: 0.75,
  healOnKoFraction: 1 / 8,
  expShareToLowest: 0.3,               // Big Sibling +30% [fixed]
  profiles: {                          // AI profiles (prototype, accepted)
    wild: { brain: 'wild', finisher: false, healThreshold: 0, healItems: false, switchOnBlocked: false, crackdust: false, guard: false, maxEvasionUses: 0, evasionMinHp: 1, chip: false, clearBoosts: false },
    trainer: { brain: 'tactical', finisher: false, healThreshold: 0.35, healItems: true, switchOnBlocked: true, crackdust: true, guard: true, maxEvasionUses: 2, evasionMinHp: 0.5, chip: true, clearBoosts: true },
    spire: { brain: 'tactical', finisher: true, healThreshold: 0.35, healItems: true, switchOnBlocked: true, crackdust: true, guard: true, maxEvasionUses: 2, evasionMinHp: 0.5, chip: true, clearBoosts: true },
    summit: { brain: 'tactical', finisher: true, healThreshold: 0.4, healItems: true, switchOnBlocked: true, crackdust: true, guard: true, maxEvasionUses: 2, evasionMinHp: 0.5, chip: true, clearBoosts: true },
  },
  mendsPerBattle: 3,                   // Mends 3 [fixed]
  maxLevel: 100,
  moveSlots: 4,
  scrapPower: 50,                      // Scrap: 50 power, typeless, sure hit [fixed]
  stab: 1.5,
  critMult: 1.5,
  critRates: [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2],
  burnAttackMult: 0.5,
  damageRollMin: 0.85,                 // the 0.85-1.0 roll (accepted) [fixed]
  captureFailBonus: 0.03,              // = CAPTURE_FAIL_BONUS [fixed]
  captureFailCap: 0.15,                // = CAPTURE_FAIL_CAP [fixed]
  captureOddsMin: 0.01,                // = CAPTURE_ODDS_MIN [fixed]
  captureOddsMax: 0.95,                // = CAPTURE_ODDS_MAX [fixed]
  captureStatusMult: { chill: 1.5, numb: 1.5, trap: 1.5, burn: 1.25, poison: 1.25 },
  captureBands: [[0.25, 'Slim'], [0.5, 'Fair'], [0.8, 'Good'], [Infinity, 'Sure']], // = CAPTURE_BANDS
  lantern: {                           // wick grades as the engine reads them (prices = data/items.js) [fixed]
    1: { mult: 1, price: 100, name: 'Tallow Wick' },
    2: { mult: 1.5, price: 300, name: 'Brass Wick' },
    3: { mult: 2, price: 600, name: 'Skyglass Wick' },
    sure: { mult: Infinity, price: null, name: "Isolde's Lantern" },
  },
  catchUpStep: 0.5,                    // = CATCH_UP_STEP [fixed]
  catchUpEvery: 5,                     // = CATCH_UP_STEP_LEVELS [fixed]
  catchUpCap: 3,                       // = CATCH_UP_CAP [fixed]
  evasionMult: [1, 0.83, 0.67],        // evasion cap +2: accuracy ×0.83 / ×0.67 [fixed]
  evasionCap: 2,                       // [fixed]
  stageCap: 6,
  scrapCost: 1 / 8,                    // Scrap recoil 1/8 max HP [fixed]
  chip: { burn: 1 / 16, poison: 1 / 8, trap: 1 / 8 },
  trapTurns: 4,
  crackdustTurns: 3,                   // Crackdust: 3 full turns after the throw turn [fixed]
  plumblineBlockTurns: 2,              // Plumbline blocks boosting 2 turns [fixed]
  plumblineIgnoresWards: true,         // Plumbline ignores Wards and Mirrorveil (ruling) [fixed]
  numbSpeedMult: 0.5,
  numbSkipChance: 0.25,
  chillSkipChance: 0.5,
  chillTurnsMin: 1,
  chillTurnsMax: 2,
  benchShare: 0.6,                     // = BENCH_SHARE [fixed]
  yardShare: 0.25,                     // = YARD_SHARE [fixed]
  yardMax: 3,                          // = YARD_CAP [fixed]
  dampStart: 10,                       // = DAMP_START [fixed]
  dampFactor: 0.5,                     // = DAMP_FACTOR [fixed]
  blackoutRate: 0.1,                   // = blackoutCostFraction [fixed]
  trainerExpMult: 1.5,                 // = TRAINER_EXP_MULT [fixed]
  expYieldDivisor: 5,                  // = EXP_DIVISOR [fixed]
  payoutPerLevel: 50,                  // route trainer payout = 50 × highest level, once each [fixed]
  runSpeedScale: 128,
  runAttemptBonus: 30,
  runAutoThreshold: 256,
  maxTurns: 200,
  actionPriority: { run: 7, switch: 6, item: 6, lantern: 6, read: 5, scrap: 0 },

  // ===== World feel (world/npc, world/roamer take these as their per-call opts.tuning) ===========
  npcCatchUpTiles: 12,                 // a schedule path longer than this jumps (world/npc catchUpTiles)
  npcsPerMap: 16,                      // simulated NPC cap per map
  npcFeel: { catchUpTiles: 12, wanderR: 2, pauseMin: 1200, pauseMax: 4000, repathMs: 600, giveUpMs: 1500, maxLen: 96 },
  roamerFeel: { cap: 8, fleeR: 3, approachR: 4, ttlMs: 90_000, leash: 4, stepMs: 220, pauseMin: 400, pauseMax: 1600, wanderChance: 0.7, minPlayerDist: 6, despawnR: 24, spawnTries: 24, spawnEveryMs: 2000 },
  toolRingHoldMs: 220,                 // hold `tool` this long to open the ring
  routeAutosaveMs: 90_000,             // route autosave while dirty (state/persist)
  animatedTileCap: 400,                // validator warns above this
  wardCount: 3,                        // Ward abilities: Glasshide, Mirrorveil, Stillcoat (on four forms) [fixed]

  // ===== Reference: payouts (GDD-00 §7 Income) ==================================================
  spireWinPerAce: 200,                 // Spire win = 200 × ace level, once [fixed]
  spireAceLevels: [10, 16, 22, 29, 36, 43], // Turn, Ward, Weather, Hollow, Relay, Mirror aces [fixed]
  spireWinStarsalt: 3,                 // + 3 Starsalt per Spire win [fixed]
  porchDuelPerCurve: 30,               // Porch Duel = 30 × curve level; the first lever if loans 5-6 stall [25-45]
  porchDuelsPerDay: 3,                 // three offers a day on the slate [fixed]
  errantButtons: 1500,                 // Errant beaten or caught: 1,500 [fixed]
  errantStarsalt: 2,                   // ... + 2 Starsalt [fixed]
  championPrize: 10000,                // beating Idris: 10,000 [fixed]
  holdOutExp: 100,                     // the dock hold-out grants a flat 100 EXP [fixed]
  galleryFrameButtons: 1000,           // Gallery: 1,000 per 6 Held forms framed [fixed]
  galleryFrameForms: 6,                // [fixed]
  skyglassNodeStarsalt: [1, 2],        // skyglass node 1-2 Starsalt, refills per badge [fixed]
  relicStarsaltRate: 1,                // a skyglass relic refines 1:1 at the Raft [fixed]
  relicBarnabyPrice: 900,              // ... or 900 to Barnaby [fixed]
  skyglassRelicsMaxPerNightLow: 3,     // max 3 per night low [fixed]

  // ===== Reference: sinks and services (GDD-00 §7 Price list, §4 Fast travel, §8) ===============
  ferryFare: 200,                      // Maud's ferry 200 until badge 2 [fixed]
  ferryFreeFromBadge: 2,               // then free [fixed]
  ferryHours: [5 * H, 1 * H],          // 05:00-01:00 [fixed]
  recallStarsalt: 6,                   // Recall: 6 Starsalt, Corin at the Archive [fixed]
  recallFromBadge: 4,                  // from badge 4 [fixed]
  memoryRelearnPrice: 0,               // Memory relearn is free at the Archive [fixed]
  boxCapacityCellar: 40,               // the Cellar commission: storage 20 -> 40 [fixed]
  keepersAnchorPerNight: 1,            // lit.keepersAnchor: one free Anchor at home per night [fixed]
  commonsNeighborShareRange: [0.1, 0.3], // neighbours add 10-30% [fixed range]
  discPriceRange: [1500, 4000],        // technique discs 1,500-4,000 [fixed range]
  decorPriceRange: [200, 6000],        // furniture, clothes, string lights 200-6,000 [fixed range]
  blackoutWakeDelayMinutes: 60,        // you wake one game hour later, party healed [fixed]

  // ===== Reference: pacing targets (GDD-00 §5, §6, §7; the economy sim checks these) ============
  loanTargetDays: [1, 3, 5, 7, 9, 11, 13], // target day each loan clears [±1 day]
  relightingDayRange: [11, 16],        // the headless economy sim lands the Relighting here at defaults [fixed]
  grindCapRealMinutes: 30,             // no tier ever needs more than 30 real minutes of grind [fixed]
  hardFloorNights: 7,                  // one build a night: never sooner than 7 nights [fixed]
  sinkShare: 0.25,                     // about a quarter of gross income goes to sinks [0.2-0.3]
  dailyIncomeTargets: [                // daily wallet targets before sinks (the sim's model) [fixed]
    { from: 1, to: 1, gross: 3000, errands: 3000 },
    { from: 2, to: 3, gross: 8000 },
    { from: 4, to: 6, gross: 15000 },
    { from: 7, to: 9, gross: 25000 },
    { from: 10, to: 12, gross: 35000 },
    { from: 13, to: 15, gross: 45000 },
  ],
  forecastsPerRun: 18,                 // ≈ 18 Forecasts per run [15-21]
  forecastMinGapRealMinutes: 20,       // at most one per 20 real minutes on average [fixed]
});

// Named exports: the same values, for direct import.
export const wardCount = TUNING.wardCount;
export const benchShare = TUNING.benchShare;
export const noRepeatDays = TUNING.noRepeatDays;
export const porchWindow = TUNING.porchWindow;
export const letterHour = TUNING.letterHour;
export const npcCatchUpTiles = TUNING.npcCatchUpTiles;
export const toolRingHoldMs = TUNING.toolRingHoldMs;
export const routeAutosaveMs = TUNING.routeAutosaveMs;
export const animatedTileCap = TUNING.animatedTileCap;
export const encounterMinLevel = TUNING.encounterMinLevel;
export const encounterMaxLevel = TUNING.encounterMaxLevel;
export const stackMax = TUNING.stackMax;
export const npcFeel = TUNING.npcFeel;
export const roamerFeel = TUNING.roamerFeel;

export default TUNING;
