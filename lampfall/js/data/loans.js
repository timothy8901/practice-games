/**
 * The loan ladder, the six room commissions and the six Commons projects (GDD-02 Economy, from
 * GDD-00 §7 and §9). [DATA-ECON]
 *
 * LOANS — Hearthwright & Daughter, interest-free, no deadline, one build a night (hard floor seven
 * nights). 6,000 + 15,000 + 25,000 + 36,000 + 50,000 + 66,000 + 80,000 = 278,000. Row ids are
 * `tier-N` because the cond DSL (`{loan: {tier}}`), `systems/loans` and the validator look loans up
 * by tier; `manifestId` carries the GDD-ids name (`loan-N`) of the same row. `notch` is the 5% one
 * finished thread is worth on that stick; `scaffoldStage` is the lighthouse section that climbs when
 * the loan clears; `commissionSlot` marks the four tiers whose build is a room you pick.
 *
 * COMMISSIONS — pick four of six at loans 3-6 (`systems/loans.chooseCommission`); the two left over
 * cost 20,000 each after the Relighting. Each room has a town effect and a creature effect; the
 * systems that honour them read the `effects` keys (GDD-05 town life, GDD-03 creatures).
 *
 * COMMONS — the Commons Jar on the green funds six projects; `neighborShare` is the part the
 * neighbours put in (10-30%), so the player's share is `cost - round(cost × neighborShare)`.
 *
 * Pure data; deep-frozen.
 * @module data/loans
 */

/** @template T @param {T} o @returns {T} */
function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freeze(v);
  }
  return o;
}

/** The eight roof colours; slate blue first (the cursor default). */
const ROOFS = ['slate-blue', 'ochre', 'harbor-red', 'moss', 'sea-blue', 'straw', 'tar', 'heather'];

/**
 * @typedef {Object} LoanDef
 * @property {string} id            'tier-N'
 * @property {string} manifestId    'loan-N' (GDD-ids)
 * @property {number} tier  @property {number} amount  @property {number} notch   5% of amount
 * @property {string|null} build    fixed build id, null on commission tiers
 * @property {boolean} commissionSlot  @property {boolean} commission   (both spellings systems/loans reads)
 * @property {number} commissionNo  1-4 on commission tiers, else 0
 * @property {string[]} roofChoices @property {number} scaffoldStage  1-7
 * @property {number} targetDay     GDD-00 target day  @property {number} satchel  slots the build adds
 * @property {string[]} clearFlags  @property {string[]} buildFlags
 * @property {string} name  @property {string} text   ledger card text
 * @property {string} wren          Wren's line when she offers it
 */

/** @type {ReadonlyArray<LoanDef>} */
export const LOANS = freeze([
  {
    id: 'tier-1', manifestId: 'loan-1', tier: 1, amount: 6000, notch: 300,
    build: 'bedsit', commissionSlot: false, commission: false, commissionNo: 0,
    roofChoices: ROOFS, scaffoldStage: 1, targetDay: 1, satchel: 0,
    clearFlags: [], buildFlags: [],
    name: 'The Bedsit',
    text: 'Porch lamp lit the moment it clears; a sound roof over the bedsit by morning. Wick\'s errands cover half.',
    wren: 'Six thousand buttons, no interest. Pay it when you can. We build while you sleep.',
  },
  {
    id: 'tier-2', manifestId: 'loan-2', tier: 2, amount: 15000, notch: 750,
    build: 'cottage', commissionSlot: false, commission: false, commissionNo: 0,
    roofChoices: ROOFS, scaffoldStage: 2, targetDay: 3, satchel: 10,
    clearFlags: [], buildFlags: [],
    name: 'The Cottage',
    text: 'Two rooms, a mirror for the lease card, and a satchel ten slots deeper.',
    wren: 'Two rooms. A mirror, so you can change your mind about your ears. Ambrose says alder.',
  },
  {
    id: 'tier-3', manifestId: 'loan-3', tier: 3, amount: 25000, notch: 1250,
    build: null, commissionSlot: true, commission: true, commissionNo: 1,
    roofChoices: ROOFS, scaffoldStage: 3, targetDay: 5, satchel: 0,
    clearFlags: [], buildFlags: [],
    name: 'Commission One',
    text: 'Pick a room. Wren\'s first design of her own, drawn on the back of a feed bill.',
    wren: 'This one\'s mine. Not Dad\'s plans, mine. Pick a room and I\'ll draw it tonight.',
  },
  {
    id: 'tier-4', manifestId: 'loan-4', tier: 4, amount: 36000, notch: 1800,
    build: null, commissionSlot: true, commission: true, commissionNo: 2,
    roofChoices: ROOFS, scaffoldStage: 4, targetDay: 7, satchel: 0,
    clearFlags: [], buildFlags: [],
    name: 'Commission Two',
    text: 'A second room off the cottage. The scaffold reaches the gallery rail.',
    wren: 'Another room. The scaffold\'s past the gallery rail now; you can see it from the quay.',
  },
  {
    id: 'tier-5', manifestId: 'loan-5', tier: 5, amount: 50000, notch: 2500,
    build: null, commissionSlot: true, commission: true, commissionNo: 3,
    roofChoices: ROOFS, scaffoldStage: 5, targetDay: 9, satchel: 0,
    clearFlags: [], buildFlags: [],
    name: 'Commission Three',
    text: 'A third room. Ambrose walks the frame by touch and pronounces it square.',
    wren: 'Dad walked the frame twice last night. He says it\'s square. He says that about everything I build now.',
  },
  {
    id: 'tier-6', manifestId: 'loan-6', tier: 6, amount: 66000, notch: 3300,
    build: null, commissionSlot: true, commission: true, commissionNo: 4,
    roofChoices: ROOFS, scaffoldStage: 6, targetDay: 11, satchel: 0,
    clearFlags: [], buildFlags: [],
    name: 'Commission Four',
    text: 'The last room. When it clears, Wren unrolls the drawing she has been keeping: the Lamp Room.',
    wren: 'Last room. And then... I have one more drawing. I\'ve had it a while.',
  },
  {
    id: 'tier-7', manifestId: 'loan-7', tier: 7, amount: 80000, notch: 4000,
    build: 'lamp-room', commissionSlot: false, commission: false, commissionNo: 0,
    roofChoices: ROOFS, scaffoldStage: 7, targetDay: 13, satchel: 0,
    clearFlags: [], buildFlags: [],
    name: 'The Lamp Room',
    text: 'Glass, brass and a new wick-stand at the top of the stair. The Relighting at the next dusk.',
    wren: 'The Lamp Room. Thirty years dark. I\'d like to be the one who builds it, if you\'ll let me.',
  },
]);

/** Sum of the ladder (GDD-00 §7). */
export const LADDER_TOTAL = LOANS.reduce((s, l) => s + l.amount, 0);

/**
 * @typedef {Object} CommissionDef
 * @property {string} id  @property {string} name
 * @property {string} town      the town effect (GDD-00 §7)
 * @property {string} creature  the creature effect (GDD-00 §7)
 * @property {Record<string, any>} effects   machine keys the owning systems read
 * @property {number} satchel   satchel slots the room adds  @property {string[]} flags   set when it lands
 * @property {string} text      Wren's pitch on the commission card
 */

/** @type {ReadonlyArray<CommissionDef>} */
export const COMMISSIONS = freeze([
  {
    id: 'training-yard', name: 'Training Yard',
    town: 'A chalked yard behind the cottage; Tully does his laps and his push-ups there.',
    creature: 'Three stored creatures earn 25% of party EXP.',
    effects: { yardSlots: 3, yardShare: 0.25, tullyTrains: true },
    satchel: 0, flags: [],
    text: 'Chalk lines, a straw dummy, a bench for the ones waiting their turn. Tully has already asked.',
  },
  {
    id: 'workshop', name: 'Workshop',
    town: 'A fossil cleaning bench: leave a fossil overnight and it is worth 40% more.',
    creature: 'Polish a skyglass relic overnight into a type tilt (held: that type\'s forms weigh ×2 on every Forecast card).',
    effects: { cleanBench: true, cleanMult: 1.4, cleanPerNight: 1, tiltBench: true, tiltsFrom: ['skyglass-shard', 'skyglass-bead', 'skyglass-knot'], tiltIds: ['tilt-brine', 'tilt-stone', 'tilt-glass', 'tilt-gust', 'tilt-hollow', 'tilt-kiln'] },
    satchel: 0, flags: [],
    text: 'A vice, a brush, a jeweller\'s wheel. Ambrose donated the vice and won\'t say where it came from.',
  },
  {
    id: 'greenhouse', name: 'Greenhouse',
    town: 'A grafting bench for foreign fruit, and fruit trees that grow indoors.',
    creature: 'A creature left overnight with its favourite fruit gains +1 Bond, once each; a Moss lead ripens a graft a day sooner.',
    effects: { graftBench: true, indoorTrees: 4, bondNight: 1, bondNightOncePerCreature: true, mossGraftNightsSooner: 1 },
    satchel: 0, flags: [],
    text: 'South-facing glass and a grafting bench. Bring a knife and a little patience.',
  },
  {
    id: 'cellar', name: 'Cellar',
    town: 'Cold storage under the floor; Keepsakes are safe down there; the satchel grows by ten.',
    creature: 'Creature storage grows from 20 to 40.',
    effects: { coldStorage: true, keepsakesSafe: true, boxCapacity: 40 },
    satchel: 10, flags: [],
    text: 'Stone steps, a cool shelf, a door that shuts properly. Twice the room for everything.',
  },
  {
    id: 'porch-loft', name: 'Porch & Loft',
    town: 'A second porch seat, so two neighbours visit a night; Porch Duels can be hosted at home.',
    creature: 'A loft telescope shows Errants on the map.',
    effects: { porchSeats: 2, hostDuels: true, telescopeErrants: true },
    satchel: 0, flags: [],
    text: 'A wider porch, a second chair, and a loft with a brass telescope pointed at the sky.',
  },
  {
    id: 'gallery', name: 'Gallery',
    town: 'The tally wall on display, Odile\'s canvases and the Field Log plates.',
    creature: 'Hanging a Shiftlog strip gives +1 Bond once; 1,000 buttons per 6 Held forms framed.',
    effects: { tallyWall: true, shiftlogStripBond: 1, frameButtons: 1000, framePerForms: 6 },
    satchel: 0, flags: [],
    text: 'Picture rails, good light, and a wall long enough for every split stick you will ever earn.',
  },
]);

/**
 * @typedef {Object} CommonsDef
 * @property {string} id  @property {string} name  @property {number} cost
 * @property {number} neighborShare   fraction the neighbours add (0.1-0.3)
 * @property {any} [cond]             cond DSL gate
 * @property {string} effect          what funding it does
 * @property {string[]} flags         set (true) when it is built, beside `sys.commons.<id>`
 * @property {string} text            the Commons board slip
 */

/** @type {ReadonlyArray<CommonsDef>} */
export const COMMONS = freeze([
  {
    id: 'dark-house-1', name: 'Dark House 1', cost: 3000, neighborShare: 0.3,
    effect: 'The first dark house reopens and Tamsin Brack moves in; her porch is lit.',
    flags: [],
    text: 'New glass, a swept chimney, a lamp for the step. Someone has written to ask if it\'s still to let.',
  },
  {
    id: 'quay-lamps', name: 'Quay Lamps', cost: 4000, neighborShare: 0.2,
    effect: 'Lamps along the quay: one more shoal of night shadows on the quay reaches.',
    flags: [],
    text: 'Six iron posts and six lamps along the quay. The fish like the light; so do the anglers.',
  },
  {
    id: 'mudlark-mile-flags', name: 'Mudlark Mile Flags', cost: 5000, neighborShare: 0.3,
    effect: 'Bunting and course flags for Tully\'s race across the flats at the spring low.',
    flags: [],
    text: 'Bunting, course flags and a finish line that is not just Tully\'s scarf on a stick.',
  },
  {
    id: 'north-creek-footbridge', name: 'North Creek Footbridge', cost: 6000, neighborShare: 0.2,
    effect: 'A footbridge over the empty north creek: a short way to Ansel\'s launch and the weir.',
    flags: [],
    text: 'A plank bridge over the north creek, so nobody has to wade to the weir. Ansel says it\'s a waste of good timber. Ansel crosses it daily.',
  },
  {
    id: 'training-yard-green', name: 'Training Yard on the Green', cost: 10000, neighborShare: 0.1,
    cond: { badge: 5 },
    effect: 'A public Training Yard on the green: three stored creatures earn 25% of party EXP, for anyone who skipped the room.',
    flags: [],
    text: 'Chalk on the green and a bench for the ones waiting their turn. Open to everyone, especially the impatient.',
  },
  {
    id: 'third-stall', name: 'Lantern Market Third Stall', cost: 12000, neighborShare: 0.2,
    effect: 'A third stall at the Lantern Market: a second furniture and clothes table on market nights.',
    flags: [],
    text: 'A striped awning and a trestle for the Lantern Market. Dov says three stalls is a market; two is a disagreement.',
  },
]);

export default LOANS;
