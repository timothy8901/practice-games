/**
 * DATA.trainers: all 65 trainer rosters (ARCHITECTURE §14.10, GDD-ids §11). [GDD-04 BATTLE]
 *
 * Row fields beyond the §14.10 core (`id, name, title, class, portrait, party, items, ai, payout,
 * tacticTag, scripts`):
 * - `npc`        npc id for named characters (portrait + speaker), null for route trainers
 * - `sprite`     body id in art/chars (route trainers use the generic trainerVest / trainerCoat)
 * - `kind`       animal species, for the art lane (route trainers are invented isle folk)
 * - `map`, `post`, `postName`  where they stand: a marker id GDD-01 places on that map, and its display
 * - `region`     curve region; `band` 'day' | 'night' (mandatory route trainers sit in the isle's day
 *                wild band, optional ones in its night band, +2 levels)
 * - `declinable` optional route trainers offer Fight / Decline (Decline forfeits payout and EXP)
 * - `story`      story battle: continues on any result and never costs money (`blackout: false`)
 * - `holdOut`    the battle ends as a hold-out after this many turns (the dock)
 * - `expSource`  engine EXP source ('route' | 'story' | 'spire' | 'rematch')
 * - `payoutRule` how `payout` was computed: highest x50 (route, rival, Long Road), ace x200 (Spires,
 *                Summit), curve x30 (Porch Duels, computed by the flow at battle start), none
 * - `lines`      {intro, win, lose} text; `scripts` names the script ids those lines live in
 * - party entries: `{species, level, moves?, held?, nick?, bossShift?, onEntry?, levelOffset?, before?}`
 *   - `bossShift`  a posted scripted Shift on the trainer's own side (GDD-00 §8: the player's creatures
 *                  never Shift in battle; scripted boss Shifts get a posted strip). `postAt`/`shiftAt`
 *                  count that creature's turns on the field (0 = as it enters); `cards` are the three
 *                  (or one) Forecast cards; `odds: 'dial'` uses the Chaos dial's base card odds,
 *                  a number is the same percentage on every dial. Rolled on `bossShift:<trainerId>:<slot>`.
 *                  The Shifted form keeps level, HP fraction, moves, nickname and held item.
 *   - `onEntry`    `{weather, turns}`: posts arena weather for `turns` turns as it enters (see
 *                  spires.WEATHER_KINDS)
 * - Porch Duels: `scale` (party-median scaling, size by badges), party `levelOffset`, `level` is the
 *   reference level at party median 5; `available` (a cond) and `requires.visited` gate the offer.
 *
 * Ward placement (GDD-00 §8): no Ward form (prismoth, cairnward, chillnub, lumenveil) on any trainer
 * before Cairnhold, and at most one per trainer, counting boss-Shift cards. Heal items: route
 * trainers at most 1, everyone else at most 2 (the Keeper cap), shown as pips with the Scouting Prism.
 *
 * `TRAINER_SCRIPTS` holds the before scripts this chapter owns (`<id>-before`); story trainers point
 * at GDD-07's script ids from the manifest instead. A trainer without a story after-battle script has
 * no `scripts.afterWin` / `scripts.afterLoss`: the battle scene shows `lines.win` / `lines.lose`
 * itself, and a generated script saying them again printed every parting line twice (FH-10).
 * @module data/trainers
 */

// --- helpers --------------------------------------------------------------------------------------

const HEAL = Object.freeze({ salve: 0.3, tonic: 0.6, 'full-salve': 1 });
const ITEM_NAME = Object.freeze({ salve: 'Salve', tonic: 'Tonic', 'full-salve': 'Full Salve' });
/** Trainer heal items as engine rows `{id, name, heal}` (heal = fraction of max HP). */
const heal = (...ids) => ids.map((id) => Object.freeze({ id, name: ITEM_NAME[id], heal: HEAL[id] }));

/** One party entry. */
const mon = (species, level, moves, extra = {}) => Object.freeze({ species, level, ...(moves ? { moves: Object.freeze(moves) } : {}), ...extra });

/** A posted three-card boss Shift at the Chaos dial's base odds. */
const dialShift = (postAt, shiftAt, up, side, down) => Object.freeze({
  postAt, shiftAt, odds: 'dial',
  cards: Object.freeze([{ dir: 'up', form: up }, { dir: 'side', form: side }, { dir: 'down', form: down }].map(Object.freeze)),
});
/** A posted one-card boss Shift that lands on every dial (the strip reads 100%). */
const sureShift = (postAt, shiftAt, dir, form) => Object.freeze({ postAt, shiftAt, odds: 100, cards: Object.freeze([Object.freeze({ dir, form })]) });

export const PAYOUT_RULES = Object.freeze({
  highest: Object.freeze({ kind: 'highest', perLevel: 50 }),   // route trainers, rivals, the Long Road (GDD-00 §8 ruling)
  ace: Object.freeze({ kind: 'ace', perLevel: 200 }),          // Spire leaders, Keepers, the Champion (GDD-00 §7)
  curve: Object.freeze({ kind: 'curve', perLevel: 30 }),       // Porch Duels: 30 x the posted curve, set by the flow
  none: Object.freeze({ kind: 'none', perLevel: 0 }),          // story set pieces, friends, exhibitions
});

/** Heal-item caps (GDD-00 §8 / Summit rule: at most 2, shown as pips). */
export const HEAL_CAP = Object.freeze({ route: 1, default: 2 });
/** The four Ward forms (GDD-00 §8). */
export const WARD_FORMS = Object.freeze(['prismoth', 'cairnward', 'chillnub', 'lumenveil']);

const highestLevel = (party) => Math.max(...party.map((c) => c.level));

/** Trainer classes whose losses never cost buttons. */
const NO_BLACKOUT_CLASSES = Object.freeze(['keeper', 'champion', 'porch', 'mentor', 'friend', 'faction']);

/** Story-owned script ids (GDD-07, in the manifest's SCRIPT_IDS); never generated here. */
const OWN = Symbol('own');

/** @type {Record<string, any[]>} */
const scripts = {};

/**
 * Builds one frozen trainer row, computes its payout and registers its own scripts.
 * @param {Record<string, any>} d
 */
function trainer(d) {
  const rule = PAYOUT_RULES[d.payoutRule ?? 'highest'];
  const party = Object.freeze(d.party);
  const ace = d.aceLevel ?? highestLevel(party);
  const payout = rule.kind === 'highest' ? rule.perLevel * highestLevel(party) : rule.kind === 'ace' ? rule.perLevel * ace : 0;
  const ids = {
    before: d.scripts?.before ?? OWN,
    afterWin: d.scripts?.afterWin ?? OWN,
    afterLoss: d.scripts?.afterLoss ?? OWN,
  };
  const who = d.npc ?? d.name;
  const own = { before: [`${d.id}-before`, d.lines.intro] };
  const out = {};
  for (const k of ['before', 'afterWin', 'afterLoss']) {
    if (ids[k] !== OWN) out[k] = ids[k];
    else if (own[k]) {
      const [sid, text] = own[k];
      scripts[sid] = Object.freeze([Object.freeze({ op: 'say', who, text }), Object.freeze({ op: 'end' })]);
      out[k] = sid;
    }
    // no generated after-battle script: the battle scene already shows `lines.win` / `lines.lose` as
    // the trainer steps back in, and a script repeating it printed the parting line twice (FH-10)
  }
  const row = {
    id: d.id,
    name: d.name,
    title: d.title,
    class: d.class,
    npc: d.npc ?? null,
    portrait: d.portrait ?? d.npc ?? d.sprite,
    sprite: d.sprite ?? d.npc,
    kind: d.kind,
    map: d.map,
    post: d.post,
    postName: d.postName,
    region: d.region,
    band: d.band ?? null,
    declinable: d.declinable ?? false,
    story: d.story ?? false,
    // Blackout rule (GDD-00 §6): route, Spire and Long Road losses only. Story battles, the Summit,
    // Porch Duels and exhibitions cost nothing.
    blackout: !(d.story ?? false) && !NO_BLACKOUT_CLASSES.includes(d.class),
    party,
    items: Object.freeze(d.items ?? []),
    ai: d.ai ?? 'trainer',
    payout,
    payoutRule: rule,
    expSource: d.expSource ?? 'route',
    tacticTag: d.tacticTag,
    lines: Object.freeze({ ...d.lines }),
    scripts: Object.freeze(out),
  };
  for (const k of ['holdOut', 'spire', 'scale', 'available', 'requires', 'rules', 'stage', 'npcs']) if (d[k] !== undefined) row[k] = d[k];
  return Object.freeze(row);
}

// --- shared party fragments -------------------------------------------------------------------

const PORCH_SCALE = Object.freeze({ by: 'party-median', sizeByBadges: Object.freeze([1, 1, 2, 2, 3, 3, 3]), min: 3, max: 50 });

// --- the 65 rosters -----------------------------------------------------------------------------

/** @type {ReadonlyArray<Readonly<import('./index.js').Trainer>>} */
export const TRAINERS = Object.freeze([
  // ===== Lowmoor (curve 7; day wilds 3-8, night 5-10). No Wards. =====
  trainer({
    id: 'lowmoor-osier', name: 'Osier', title: 'Reed Cutter', class: 'route', sprite: 'trainerVest', kind: 'harvest mouse',
    map: 'lowmoor', post: 'lowmoor-reed-beds', postName: 'the reed beds below the stepping stones', region: 'lowmoor', band: 'day',
    party: [mon('tossup', 5, ['tap', 'sure-pinch']), mon('reedkit', 6, ['tap', 'reed-whip'])],
    tacticTag: 'Plain lead, Moss ace',
    lines: {
      intro: 'Mind the cut ends. Reeds bite back, and so does my Reedkit.',
      win: 'Fair cut. I will sharpen the sickle and my excuses.',
      lose: 'Back to the stones with you. The tide waits for nobody, and neither do I.',
    },
  }),
  trainer({
    id: 'lowmoor-dunlin', name: 'Dunlin', title: 'Mudlarker', class: 'route', sprite: 'trainerVest', kind: 'water vole',
    map: 'lowmoor', post: 'lowmoor-mud-bank', postName: 'the mud bank by the old ferry pavilion', region: 'lowmoor', band: 'day',
    party: [mon('puddlepip', 6, ['tap', 'salt-spray', 'settle']), mon('mudfist', 7, ['tap', 'knuckle'])],
    tacticTag: 'Brine lead, Grit ace',
    lines: {
      intro: 'Found a button in the mud this morning. Found you this afternoon. Let us see which is shinier.',
      win: 'Muddy fair and square. Here, you have earned the clean half of my wallet.',
      lose: 'Go and rinse off at the Waystone. You look how I feel most days.',
    },
  }),
  trainer({
    id: 'lowmoor-colm', name: 'Colm', title: 'Ferry Hand', class: 'route', sprite: 'trainerCoat', kind: 'shrew',
    map: 'lowmoor', post: 'lowmoor-pavilion-steps', postName: 'the ferry pavilion steps', region: 'lowmoor', band: 'night', declinable: true,
    party: [mon('bilgebob', 6, ['tap', 'salt-spray']), mon('puddlepip', 7, ['tap', 'salt-spray', 'settle'])],
    tacticTag: 'two Brine, slow and sturdy',
    lines: {
      intro: 'Maud lets me coil the ropes. Nobody lets me battle. Will you? You can say no; Maud does.',
      win: 'That is the most exciting thing to happen on these steps since the gull stole my sandwich.',
      lose: 'Ha! Wait till I tell Maud. She will say "Good. Coil the ropes."',
    },
  }),
  trainer({
    id: 'lowmoor-perrin', name: 'Perrin', title: 'Marsh Walker', class: 'route', sprite: 'trainerCoat', kind: 'heron',
    map: 'lowmoor', post: 'lowmoor-boardwalk-bend', postName: 'the bend in the marsh boardwalk', region: 'lowmoor', band: 'day',
    party: [mon('reedkit', 7, ['tap', 'reed-whip']), mon('sloshkin', 8, ['tap', 'salt-spray', 'undertow'])],
    tacticTag: 'Moss lead, Undertow slows you',
    lines: {
      intro: 'My Sloshkin has a pip coming. Want to see it before it changes its mind about everything?',
      win: 'Same mark, whatever shape. You read that well, walker.',
      lose: 'Slow and steady wins the marsh. Mostly slow.',
    },
  }),
  trainer({
    id: 'lowmoor-tibby', name: 'Tibby', title: 'Pavilion Regular', class: 'route', sprite: 'trainerVest', kind: 'dormouse',
    map: 'lowmoor', post: 'lowmoor-pavilion-bench', postName: 'the bench inside the old ferry pavilion', region: 'lowmoor', band: 'night', declinable: true,
    party: [mon('tossup', 7, ['tap', 'sure-pinch', 'settle']), mon('scrapling', 8, ['tap', 'knuckle', 'shadowbox']), mon('wirewhisk', 8, ['arc-ping', 'fizz', 'tap'])],
    tacticTag: 'three-deep; Wirewhisk pings your moves first',
    lines: {
      intro: 'I have sat on this bench every evening for eleven years. Three creatures. No waiting. Unless you would rather not.',
      win: 'Eleven years and I still fold on the third. Sit a while; the bench is warm.',
      lose: 'Bench wins again. Do not tell the bench; it gets ideas.',
    },
  }),

  // ===== Cairnhold (curve 13; day 9-14, night 11-16). First Wards here. =====
  trainer({
    id: 'cairnhold-ruddock', name: 'Ruddock', title: 'Quarryman', class: 'route', sprite: 'trainerVest', kind: 'badger',
    map: 'cairnhold', post: 'cairnhold-quarry-road', postName: 'the quarry road, by the cart ruts', region: 'cairnhold', band: 'day',
    party: [mon('mudfist', 11, ['tap', 'knuckle', 'sand-smother']), mon('knuckleback', 12, ['knuckle', 'shadowbox', 'sand-smother', 'tap'])],
    tacticTag: 'two Grit punchers; lowers your Attack',
    lines: {
      intro: 'Granite does not move for anybody. Neither do we.',
      win: 'Huh. You moved granite. Osric will want to hear about this.',
      lose: 'Stone stays. You go. That is how quarries work.',
    },
  }),
  trainer({
    id: 'cairnhold-prudence', name: 'Prudence', title: 'Mooring Clerk', class: 'route', sprite: 'trainerCoat', kind: 'dormouse',
    map: 'cairnhold', post: 'cairnhold-clinic-gate', postName: 'the clinic gate (Crackdust is sold inside)', region: 'cairnhold', band: 'day',
    party: [mon('mothling', 11, ['tap', 'dust-veil', 'dazzle']), mon('chillnub', 12, ['tap', 'frost-nip', 'settle'])],
    items: heal('salve'),
    tacticTag: 'Ward: Stillcoat (hits under 50 power do nothing)',
    lines: {
      intro: 'Licence check. Kidding. Mostly. My Chillnub wears a Ward; please read before you swing. It is in the regulations.',
      win: 'Stillcoat breached, noted, filed. You read the shimmer. Good.',
      lose: 'Tap, tap, nothing. Under fifty, under nothing. The clinic sells Crackdust, by the way. Three hundred.',
    },
  }),
  trainer({
    id: 'cairnhold-jory', name: 'Jory', title: 'Stonecutter', class: 'route', sprite: 'trainerVest', kind: 'marmot',
    map: 'cairnhold', post: 'cairnhold-standing-stones', postName: 'the standing stones above Knapp\'s End', region: 'cairnhold', band: 'day',
    party: [mon('scrapling', 11, ['knuckle', 'shadowbox', 'sand-smother', 'tap']), mon('rushling', 12, ['tap', 'reed-whip', 'salt-spray']), mon('siltback', 13, ['tap', 'salt-spray', 'shard-fling', 'settle'])],
    tacticTag: 'Siltback ace: Brine/Stone, Settles in',
    lines: {
      intro: 'Every one of these stones was cut by someone with a creature at their side. Mine is a Siltback. Like the keeper\'s.',
      win: 'Clean break along the grain. You have a stonecutter\'s eye.',
      lose: 'Measure twice, cut once. You measured zero times, friend.',
    },
  }),
  trainer({
    id: 'cairnhold-ellery', name: 'Ellery', title: 'Lamp Pilgrim', class: 'route', sprite: 'trainerCoat', kind: 'hedgehog',
    map: 'cairnhold', post: 'cairnhold-memorial-path', postName: 'the path to the memorial', region: 'cairnhold', band: 'night', declinable: true,
    party: [mon('puddlepip', 12, ['salt-spray', 'settle', 'shell-rattle', 'tap']), mon('mothling', 13, ['dust-veil', 'dazzle', 'shardlight', 'tap'])],
    tacticTag: 'Glass ace; Dazzle softens both your stats',
    lines: {
      intro: 'I walk to every lamp on the isles that still burns. There are not many. Battle me while my candle lasts?',
      win: 'My candle is out and so am I. Light it for me next time you pass?',
      lose: 'A small light still wins in the dark. Go gently.',
    },
  }),
  trainer({
    id: 'cairnhold-bette', name: 'Bette', title: 'Quarry Forewoman', class: 'route', sprite: 'trainerVest', kind: 'wombat',
    map: 'cairnhold', post: 'cairnhold-quarry-floor', postName: 'the quarry floor, beside the crane', region: 'cairnhold', band: 'night', declinable: true,
    party: [mon('knuckleback', 13, ['knuckle', 'shadowbox', 'sand-smother', 'tap']), mon('rimeplate', 14, ['frost-nip', 'shard-fling', 'plate-toss', 'tap']), mon('prismoth', 15, ['dust-veil', 'shardlight', 'updraft', 'tap'])],
    items: heal('salve'),
    tacticTag: 'Ward: Glasshide (only Strong hits land: Kiln, Rime)',
    lines: {
      intro: 'Shift ends at dusk. Mine never does. You can walk on by, or you can meet my Prismoth. It does not take most hits personally.',
      win: 'Kiln or Rime. You read it. The crew owes me a round now.',
      lose: 'Only Strong gets through, love. Come back with something Strong.',
    },
  }),

  // ===== Emberstep (curve 19; day 15-20, night 17-22). =====
  trainer({
    id: 'emberstep-asha', name: 'Asha', title: 'Spa Bather', class: 'route', sprite: 'trainerVest', kind: 'water shrew',
    map: 'emberstep', post: 'emberstep-lower-terrace', postName: 'the lower spa terrace', region: 'emberstep', band: 'day',
    party: [mon('puddlepip', 17, ['salt-spray', 'settle', 'shell-rattle', 'tap']), mon('rayling', 18, ['salt-spray', 'breaker', 'tap'])],
    tacticTag: 'two Brine; Breaker hits hard',
    lines: {
      intro: 'I came here to relax. Then I saw your face and thought: one quick battle, then relax harder.',
      win: 'Lovely. I am going back in the water now. Forever, possibly.',
      lose: 'Steam opens the pores and closes the matter. Off you go.',
    },
  }),
  trainer({
    id: 'emberstep-kip', name: 'Kip', title: 'Ash Shoveller', class: 'route', sprite: 'trainerVest', kind: 'mole',
    map: 'emberstep', post: 'emberstep-ash-cut', postName: 'the ash cut on the cliff path', region: 'emberstep', band: 'day',
    party: [mon('mudfist', 16, ['knuckle', 'pummel', 'sand-smother', 'tap']), mon('scrapling', 17, ['knuckle', 'shadowbox', 'pummel', 'sand-smother']), mon('sootling', 18, ['ember-lick', 'scorch', 'settle', 'tap'])],
    tacticTag: 'Grit pair, then Sootling Scorches',
    lines: {
      intro: 'I shovel ash all day. Ask me what I want. Go on. It is a battle. It is always a battle.',
      win: 'Back to the shovel. It never beats me either, but it never tries.',
      lose: 'Ha! Ash in your fur. You will be finding it for a week.',
    },
  }),
  trainer({
    id: 'emberstep-roswitha', name: 'Roswitha', title: 'Cliff Climber', class: 'route', sprite: 'trainerVest', kind: 'chamois',
    map: 'emberstep', post: 'emberstep-chimney-ledge', postName: 'a ledge off the cliff path (the long way)', region: 'emberstep', band: 'night', declinable: true,
    party: [mon('skirl', 18, ['tap', 'downdraft', 'gale-cut']), mon('sedgehare', 19, ['reed-whip', 'reap', 'updraft', 'tap'])],
    tacticTag: 'fast; Sedgehare\'s ears glint before a crit',
    lines: {
      intro: 'You climbed up here? On purpose? Then you have earned a battle. Or a rest. Your pick.',
      win: 'Good holds, good reads. I will race you down. I will lose that too.',
      lose: 'Watch the ears. When they glint, it bites. Now you know.',
    },
  }),
  trainer({
    id: 'emberstep-tobiah', name: 'Tobiah', title: 'Steam Fitter', class: 'route', sprite: 'trainerCoat', kind: 'raccoon dog',
    map: 'emberstep', post: 'emberstep-pipe-yard', postName: 'the pipe yard behind the spa', region: 'emberstep', band: 'day',
    party: [mon('wirewhisk', 18, ['jolt', 'static-net', 'updraft', 'arc-ping']), mon('rimeplate', 19, ['frost-nip', 'plate-toss', 'shard-fling', 'tap']), mon('emberjaw', 20, ['ember-lick', 'slag-burst', 'scorch'])],
    tacticTag: 'numb you, wall you, burn you',
    lines: {
      intro: 'Pressure is just patience with nowhere to go. Let us find out where yours goes.',
      win: 'Valve released. You fit together nicely, you lot.',
      lose: 'Hissed right off the pipe. Check your seals before the Spire.',
    },
  }),
  trainer({
    id: 'emberstep-marl', name: 'Marl', title: 'Scatter Volunteer', class: 'route', sprite: 'trainerVest', kind: 'ferret',
    map: 'emberstep', post: 'emberstep-raft-flyer', postName: 'the Shift fair flyers by the cliff stair', region: 'emberstep', band: 'night', declinable: true,
    party: [
      mon('rushling', 19, ['reed-whip', 'salt-spray', 'root-knot', 'tap']),
      mon('mudfist', 20, ['knuckle', 'pummel', 'stand-firm', 'sand-smother'], { bossShift: dialShift(1, 2, 'knuckleback', 'scrapling', 'puddlepip') }),
      mon('skeinwing', 21, ['gale-cut', 'skein-sweep', 'salt-spray', 'undertow']),
    ],
    tacticTag: 'forces a posted Shift on his own Mudfist',
    lines: {
      intro: 'Change is a gift! Watch: my Mudfist will Shift mid-fight. I posted the odds. I am very proud of the odds.',
      win: 'It landed... somewhere! That is the beauty. Also I lost. Also beautiful.',
      lose: 'See? Change wins. Sometimes. Today, specifically.',
    },
  }),

  // ===== Drownwood (curve 26; day 22-27, night 24-29). =====
  trainer({
    id: 'drownwood-wenna', name: 'Wenna', title: 'Stilt Fisher', class: 'route', sprite: 'trainerVest', kind: 'water shrew',
    map: 'drownwood', post: 'drownwood-stilt-ladder', postName: 'the ladder up to the stilt town', region: 'drownwood', band: 'day',
    party: [mon('bilgebob', 24, ['salt-spray', 'gnash', 'settle', 'shellguard']), mon('rillfin', 24, ['salt-spray', 'breaker', 'settle', 'tap']), mon('rushling', 25, ['reed-whip', 'salt-spray', 'spore-drift', 'riptide'])],
    tacticTag: 'all Brine-side; Rushling poisons',
    lines: {
      intro: 'The street drowns twice a day and we fish off the windows. Battle off the ladder?',
      win: 'Reeled in. Mind the third rung; it bites.',
      lose: 'You flapped like a dab on a deck. Dry off and try again.',
    },
  }),
  trainer({
    id: 'drownwood-gil', name: 'Gil', title: 'Mangrove Poler', class: 'route', sprite: 'trainerCoat', kind: 'capybara',
    map: 'drownwood', post: 'drownwood-mangrove-boardwalk', postName: 'the mangrove boardwalk (the long way)', region: 'drownwood', band: 'day',
    party: [mon('reedkit', 24, ['reed-whip', 'spore-drift', 'root-knot', 'tap']), mon('sedgehare', 25, ['reap', 'updraft', 'root-knot', 'reed-whip']), mon('rustcreel', 26, ['rust-bite', 'corrode', 'iron-pin', 'tap'])],
    tacticTag: 'trap and poison chip; Rustcreel finishes',
    lines: {
      intro: 'Pole, push, pause. Pole, push, pause. Battle, then pause some more.',
      win: 'You found the channel. Not many do.',
      lose: 'Tangled in the roots. Everyone does, the first time.',
    },
  }),
  trainer({
    id: 'drownwood-hettie', name: 'Hettie', title: 'Scatter Rescuer', class: 'route', sprite: 'trainerVest', kind: 'mink',
    map: 'drownwood', post: 'drownwood-rescue-raft', postName: 'the Scatter rescue raft', region: 'drownwood', band: 'day',
    party: [mon('gillwick', 25, ['salt-spray', 'reed-whip', 'mire-bloom']), mon('rushling', 26, ['reed-whip', 'riptide', 'root-knot', 'salt-spray']), mon('brinelance', 27, ['gnash', 'frost-nip', 'riptide', 'salt-spray'])],
    tacticTag: 'Brinelance ace: Gnash flinches',
    lines: {
      intro: 'My Bilgebob Shifted the night the street flooded and swam six children out. Now it is a Brinelance. Want to meet a hero?',
      win: 'Heroes lose too. It is the swimming that counts.',
      lose: 'Told you. Hero. Go on, the Waystone is that way.',
    },
  }),
  trainer({
    id: 'drownwood-abner', name: 'Abner', title: 'Mooring Warden', class: 'route', sprite: 'trainerCoat', kind: 'cormorant',
    map: 'drownwood', post: 'drownwood-anchor-post', postName: 'the Mooring post at the drowning street', region: 'drownwood', band: 'day',
    party: [mon('stillox', 25, ['shard-fling', 'stand-firm', 'grind-down', 'tap']), mon('rimeplate', 26, ['plate-toss', 'stand-firm', 'hoarfrost', 'frost-nip']), mon('creelwight', 27, ['snuff', 'rust-bite', 'echo-drain', 'corrode'])],
    tacticTag: 'walls; Creelwight is Hollow (immune to Plain, Grit)',
    lines: {
      intro: 'Nothing changes on my watch. Not the street, not my creatures, not my mind.',
      win: 'Hm. One thing changed. The score. Noted.',
      lose: 'Steady holds. The Provost would be pleased. Do not tell her I smiled.',
    },
  }),
  trainer({
    id: 'drownwood-sorcha', name: 'Sorcha', title: 'Lamp Diver', class: 'route', sprite: 'trainerVest', kind: 'water vole',
    map: 'drownwood', post: 'drownwood-drowned-lamp', postName: 'the drowned street lamp at the night low', region: 'drownwood', band: 'night', declinable: true,
    party: [mon('rayling', 26, ['salt-spray', 'breaker', 'riptide', 'tap']), mon('mothling', 27, ['shardlight', 'dazzle', 'dust-veil', 'tap']), mon('duskwisp', 28, ['murk', 'hush', 'echo-drain'])],
    tacticTag: 'Hollow ace; Hush cuts your Sp. Attack',
    lines: {
      intro: 'I dive for the old street lamps. Some of them still glow, down there. You can pass, or you can see what else glows.',
      win: 'Surfacing. Thank you. It is very quiet down there.',
      lose: 'Shh. Hear that? That was your plan sinking.',
    },
  }),

  // ===== Thistlewind (curve 33; day 29-34, night 31-36). =====
  trainer({
    id: 'thistlewind-ned', name: 'Ned', title: 'Millhand', class: 'route', sprite: 'trainerVest', kind: 'brown rat',
    map: 'thistlewind', post: 'thistlewind-mill-race', postName: 'the mill race below the first windmill', region: 'thistlewind', band: 'day',
    party: [mon('wirewhisk', 30, ['jolt', 'static-net', 'updraft', 'mirror-step']), mon('mudfist', 30, ['pummel', 'stand-firm', 'grind-down', 'knuckle']), mon('skirl', 31, ['gale-cut', 'downdraft', 'updraft', 'tap'])],
    tacticTag: 'Static Net, then Gust',
    lines: {
      intro: 'Sails turn, stones turn, battles turn. Want a turn?',
      win: 'Ground fine. Flour on both of us.',
      lose: 'The wind was on my side. It usually is, up here.',
    },
  }),
  trainer({
    id: 'thistlewind-lark', name: 'Lark', title: 'Kite Flyer', class: 'route', sprite: 'trainerVest', kind: 'skylark',
    map: 'thistlewind', post: 'thistlewind-kite-hill', postName: 'the kite hill on the moor', region: 'thistlewind', band: 'day',
    party: [mon('skirl', 30, ['gale-cut', 'downdraft', 'updraft', 'tap']), mon('coilcrest', 31, ['jolt', 'gale-cut', 'downdraft', 'live-wire']), mon('gillwick', 32, ['salt-spray', 'mire-bloom', 'tidal-mend', 'riptide'])],
    tacticTag: 'Gust pair; Gillwick Mends',
    lines: {
      intro: 'Hold this string. No, wait, battle first, then hold this string.',
      win: 'My kite is in a tree and my team is on the grass. Good day, really.',
      lose: 'Up and away! You are the tree in this story.',
    },
  }),
  trainer({
    id: 'thistlewind-cuthbert', name: 'Cuthbert', title: 'Moor Shepherd', class: 'route', sprite: 'trainerCoat', kind: 'sheep',
    map: 'thistlewind', post: 'thistlewind-sheepfold', postName: 'the drystone sheepfold', region: 'thistlewind', band: 'day',
    party: [mon('tossup', 31, ['knuckle', 'rust-bite', 'shellguard', 'settle']), mon('knuckleback', 32, ['grind-down', 'pummel', 'stand-firm', 'shadowbox']), mon('cragmitt', 33, ['grind-down', 'sandtrap', 'shard-fling', 'pummel'])],
    tacticTag: 'Grit line top to bottom; bring Hollow or Moss',
    lines: {
      intro: 'I count sheep for a living. I have counted your team. Not enough sheep.',
      win: 'Lost count. That happens to me about once a decade.',
      lose: 'Into the fold with you. Mind the wall; I built it.',
    },
  }),
  trainer({
    id: 'thistlewind-maisie', name: 'Maisie', title: 'Sail Mender', class: 'route', sprite: 'trainerVest', kind: 'field mouse',
    map: 'thistlewind', post: 'thistlewind-sail-loft', postName: 'the sail loft door', region: 'thistlewind', band: 'night', declinable: true,
    party: [mon('rillfin', 31, ['salt-spray', 'breaker', 'settle', 'shellguard']), mon('sedgehare', 32, ['reap', 'root-knot', 'spore-drift', 'updraft']), mon('wirewhisk', 33, ['jolt', 'static-net', 'mirror-step', 'shell-rattle']), mon('duskowl', 34, ['murk', 'gale-cut', 'drowned-bell', 'hush'])],
    tacticTag: 'four-deep; Duskowl stronger at night',
    lines: {
      intro: 'Every tear in a sail has a story. Want to give me a new one? You may say no; I have plenty.',
      win: 'Patched and beaten. Neat stitches, though, on your side.',
      lose: 'Ripped right down the middle. I can mend that. Can you?',
    },
  }),
  trainer({
    id: 'thistlewind-gideon', name: 'Gideon', title: 'Surge Witness', class: 'route', sprite: 'trainerCoat', kind: 'hare',
    map: 'thistlewind', post: 'thistlewind-surge-street', postName: 'the street in Windle that Shifted in one night', region: 'thistlewind', band: 'night', declinable: true,
    party: [mon('rushling', 32, ['riptide', 'tidal-mend', 'root-knot', 'spore-drift']), mon('chillnub', 33, ['plate-toss', 'rime-lock', 'hoarfrost', 'frost-nip']), mon('siltback', 34, ['riptide', 'sandtrap', 'stand-firm', 'shard-fling']), mon('bogmonarch', 35, ['riptide', 'settle', 'stand-firm', 'shard-fling'])],
    items: heal('tonic'),
    tacticTag: 'Ward: Stillcoat on Chillnub; Sandtrap chip',
    lines: {
      intro: 'I went to sleep with a Sloshkin and woke with a Bogmonarch. Same mark. Same snore. Battle me; I need to feel normal.',
      win: 'There. Normal. Thank you. Mostly.',
      lose: 'Nobody reads the night before. That is the whole trouble.',
    },
  }),

  // ===== Rimeholt (curve 40; day 36-41, night 38-43). =====
  trainer({
    id: 'rimeholt-hild', name: 'Hild', title: 'Ice Cutter', class: 'route', sprite: 'trainerCoat', kind: 'arctic hare',
    map: 'rimeholt', post: 'rimeholt-ice-quarry', postName: 'the ice quarry on the glacier tongue', region: 'rimeholt', band: 'day',
    party: [mon('chillnub', 37, ['plate-toss', 'rime-lock', 'hoarfrost', 'settle']), mon('mudfist', 37, ['grind-down', 'pummel', 'stand-firm', 'shellguard']), mon('rimeplate', 38, ['plate-toss', 'hoarfrost', 'rime-lock', 'sandtrap'])],
    items: heal('tonic'),
    tacticTag: 'Ward: Stillcoat; Rime Lock stalls',
    lines: {
      intro: 'Ice cuts clean if you read the grain. So do battles.',
      win: 'Split on the line. Well read.',
      lose: 'Chipped. Go warm your paws at Frostwick.',
    },
  }),
  trainer({
    id: 'rimeholt-oskar', name: 'Oskar', title: 'Cave Lamp-bearer', class: 'route', sprite: 'trainerCoat', kind: 'ptarmigan',
    map: 'rimeholt', post: 'rimeholt-cave-mouth', postName: 'the mouth of the mirror-ice caves', region: 'rimeholt', band: 'day',
    party: [mon('mothling', 37, ['shardlight', 'dazzle', 'dust-veil', 'tap']), mon('wirewhisk', 38, ['gale-cut', 'mirror-step', 'static-net', 'jolt']), mon('floeback', 39, ['floe-ram', 'hoarfrost', 'stand-firm', 'cairn-crash'])],
    tacticTag: 'Floeback ace, heavy and slow',
    lines: {
      intro: 'Three tiles of light in there. I carry them. Battle by lamplight?',
      win: 'Lamp still lit. That is what matters. Well done.',
      lose: 'Dark in there without me. Remember that.',
    },
  }),
  trainer({
    id: 'rimeholt-greer', name: 'Greer', title: 'Glacier Guide', class: 'route', sprite: 'trainerVest', kind: 'mountain hare',
    map: 'rimeholt', post: 'rimeholt-ice-path', postName: 'the ice path (the long way)', region: 'rimeholt', band: 'day',
    party: [mon('skirl', 38, ['gale-cut', 'downdraft', 'updraft', 'tap']), mon('rimeplate', 39, ['plate-toss', 'hoarfrost', 'stand-firm', 'sandtrap']), mon('gillwick', 39, ['mire-bloom', 'riptide', 'tidal-mend', 'salt-spray']), mon('strandrunner', 40, ['breaker', 'gale-cut', 'downdraft', 'riptide'])],
    tacticTag: 'four-deep; Strandrunner moves first with Downdraft',
    lines: {
      intro: 'Rope up. The glacier is fair, but it keeps score.',
      win: 'You made the crossing. The glacier will remember you. Kindly, I think.',
      lose: 'Crevasse. Metaphorically. Back down to Frostwick.',
    },
  }),
  trainer({
    id: 'rimeholt-sunniva', name: 'Sunniva', title: 'Mirror Polisher', class: 'route', sprite: 'trainerCoat', kind: 'stoat',
    map: 'rimeholt', post: 'rimeholt-polished-wall', postName: 'the polished ice wall outside the Mirror Spire', region: 'rimeholt', band: 'night', declinable: true,
    party: [mon('mothling', 38, ['shardlight', 'dazzle', 'dust-veil', 'tap']), mon('rushling', 39, ['riptide', 'tidal-mend', 'root-knot', 'reap']), mon('skeinwing', 40, ['mirror-step', 'skein-sweep', 'riptide', 'updraft']), mon('lumenveil', 41, ['shardlight', 'mirror-step', 'dazzle', 'lens-focus'])],
    items: heal('tonic'),
    tacticTag: 'Ward: Mirrorveil (status fails); evasion preview',
    lines: {
      intro: 'I polish the walls so Seraphine\'s challengers can see themselves coming. Want a preview? Optional, like all good warnings.',
      win: 'You looked, and then you leapt. In that order. Seraphine will like you.',
      lose: 'Status fails on Mirrorveil. Bring a hit, not a hex.',
    },
  }),
  trainer({
    id: 'rimeholt-aldous', name: 'Aldous', title: 'Frost Hermit', class: 'route', sprite: 'trainerCoat', kind: 'musk ox',
    map: 'rimeholt', post: 'rimeholt-hermit-hut', postName: 'the hermit\'s hut above the ice path', region: 'rimeholt', band: 'night', declinable: true,
    party: [mon('sootling', 39, ['slag-burst', 'kiln-maw', 'scorch', 'settle']), mon('stillox', 40, ['grind-down', 'sandtrap', 'stand-firm', 'shard-fling']), mon('floeback', 41, ['floe-ram', 'hoarfrost', 'stand-firm', 'rime-lock']), mon('caldermaw', 42, ['kiln-maw', 'slag-burst', 'stand-firm', 'scorch'])],
    items: heal('tonic'),
    tacticTag: 'fire on the ice; Caldermaw ace',
    lines: {
      intro: 'Thirty years up here keeping a stove lit. Come in out of the cold, or come in for a battle. Either way, shut the door.',
      win: 'The stove and I both thank you for the company.',
      lose: 'Warm now? Good. Off you go, door shut behind you.',
    },
  }),

  // ===== Pellwick: night one. =====
  trainer({
    id: 'pip', name: 'Pip', title: 'Dock Hand', class: 'dock', npc: 'pip',
    map: 'pellwick', post: 'pellwick-quay-bollards', postName: 'the bollards on the quay', region: 'pellwick', band: 'day',
    // FH-15: two creatures, so the first trainer takes 3-4 turns and a Read pays (a Plain opener, then
    // the Bolt ace); night-one EXP stays under Lv8 (340 + 30 + 66 = 436 < 512), so the window opens on day 2
    party: [mon('tossup', 2, ['tap']), mon('wirewhisk', 4, ['arc-ping', 'tap'])],
    tacticTag: 'a little Tossup to open, then the Wirewhisk ace; Arc Ping goes first',
    scripts: { before: 'pip-before' },
    lines: {
      intro: 'Tossup, flip for it! Whisk\'s on the bollard, waiting.',
      win: 'Hah! Untied, fair and square. Here\'s your two hundred.',
      lose: 'Tied up! Like a boat! If we had boats!',
    },
  }),

  // ===== Spire leaders (ace x200 + 3 Starsalt; badge, share). =====
  trainer({
    id: 'maud-spire', name: 'Maud Tallis', title: 'Spire Leader', class: 'leader', npc: 'maud',
    map: 'spire-turn', post: 'spire-turn-dais', postName: 'the Turn Spire dais', region: 'lowmoor', spire: 'turn',
    party: [
      mon('puddlepip', 8, ['tap', 'salt-spray', 'settle'], { bossShift: sureShift(1, 2, 'up', 'sloshkin') }),
      mon('bilgebob', 10, ['tap', 'salt-spray', 'gnash'], { bossShift: dialShift(1, 2, 'brinelance', 'rushling', 'puddlepip') }),
    ],
    items: heal('salve'),
    ai: 'spire', payoutRule: 'ace', expSource: 'spire',
    tacticTag: 'posted scripted Shifts, one sure, one rolled',
    lines: {
      intro: 'Every creature I send out will Shift, and I will post the odds a turn ahead. Read them. Then decide. Confirm?',
      win: 'You planned for all three cards. That is a reader. Take the Turn Seal, and the Reroll with it.',
      lose: 'You planned for the card you wanted. Plan for the one you get. The ferry runs at five.',
      // a Porch Duel visit (battle.js trainerEndLine): no seal on a porch
      duelWin: 'Fair read, on a porch and all. I will tell the geese.',
      duelLose: 'Porch rules: nobody loses anything. Except me, usually. Not tonight.',
    },
  }),
  trainer({
    id: 'osric-spire', name: 'Osric Penhallow', title: 'Spire Leader', class: 'leader', npc: 'osric',
    map: 'spire-ward', post: 'spire-ward-dais', postName: 'the Ward Spire dais', region: 'cairnhold', spire: 'ward',
    party: [
      mon('siltback', 14, ['salt-spray', 'shard-fling', 'settle', 'tap']),
      mon('rimeplate', 15, ['frost-nip', 'shard-fling', 'plate-toss', 'tap']),
      mon('prismoth', 16, ['dust-veil', 'shardlight', 'updraft', 'tap']),
    ],
    items: heal('salve', 'salve'),
    ai: 'spire', payoutRule: 'ace', expSource: 'spire',
    tacticTag: 'stone pair, then a Glasshide Prismoth (Kiln, Rime, chip)',
    lines: {
      intro: 'I cut every stone in this Spire by hand. Slowly. Read slowly, too. My Prismoth wears a Ward, and it shows.',
      win: 'You read the shimmer and you did not waste a swing. That is the whole of it. The Ward Seal is yours.',
      lose: 'Only Strong hits land on Glasshide. Poison does not ask permission. Think on it, and come back.',
      duelWin: 'Slowly, and well. A good evening\'s cutting.',
      duelLose: 'A porch is no place for haste. Nor for losing. Again some evening.',
    },
  }),
  trainer({
    id: 'ines-spire', name: 'Ines Calloway', title: 'Spire Leader', class: 'leader', npc: 'ines',
    map: 'spire-weather', post: 'spire-weather-dais', postName: 'the Weather Spire dais, over the steam vents', region: 'emberstep', spire: 'weather',
    party: [
      mon('rayling', 20, ['salt-spray', 'breaker', 'riptide', 'tap']),
      mon('coilcrest', 21, ['jolt', 'gale-cut', 'downdraft', 'updraft']),
      mon('emberjaw', 22, ['ember-lick', 'slag-burst', 'kiln-maw', 'scorch']),
    ],
    items: heal('tonic'),
    ai: 'spire', payoutRule: 'ace', expSource: 'spire',
    tacticTag: 'posted 3-turn weather: steam, ash, squall, clear',
    lines: {
      intro: 'The weather in here changes every three turns, and I post it. You will know before I do. Well. At the same time.',
      win: 'You dressed for the weather. My mother would approve. The Weather Seal, and Corin will be glad of the Prism.',
      lose: 'Steam favours the Kiln. You knew. You swung anyway. Have a soak and reconsider.',
      duelWin: 'No steam out here, and you still read the weather. Well done.',
      duelLose: 'Clear skies, and I still caught you. Have some tea.',
    },
  }),
  trainer({
    id: 'wendel-spire', name: 'Wendel Teague', title: 'Spire Leader', class: 'leader', npc: 'wendel',
    map: 'spire-hollow', post: 'spire-hollow-dais', postName: 'the Hollow Spire dais, on the boat ribs', region: 'drownwood', spire: 'hollow',
    party: [
      mon('duskwisp', 27, ['murk', 'hush', 'echo-drain']),
      mon('creelwight', 28, ['snuff', 'echo-drain', 'corrode', 'rust-bite']),
      mon('hulkwight', 29, ['snuff', 'iron-pin', 'drowned-bell', 'stand-firm'], { held: 'oilskin' }),
    ],
    items: heal('tonic', 'tonic'),
    ai: 'spire', payoutRule: 'ace', expSource: 'spire',
    tacticTag: 'all Hollow: immune to Plain and Grit; Oilskin halves chip',
    lines: {
      intro: 'A hull is mostly what is not there. So is my team. Plain and Grit go straight through. Check your menu for "No effect".',
      win: 'You brought what floats. The Hollow Seal, and Corin will show you Recall.',
      lose: 'Tap, tap, nothing. Hollow does not hold a grudge. Come back with something that lands.',
      duelWin: 'You found the solid part. On a porch, even. Good.',
      duelLose: 'Tap, tap, nothing. Porch planks are louder than my hull. Again?',
    },
  }),
  trainer({
    id: 'hallorans-spire', name: 'Ada & Ivo Halloran', title: 'Spire Leaders', class: 'leader', npc: 'ada', npcs: Object.freeze(['ada', 'ivo']),
    map: 'spire-relay', post: 'spire-relay-dais', postName: 'the Relay Spire dais, between the two mill wheels', region: 'thistlewind', spire: 'relay',
    party: [
      mon('skirl', 33, ['gale-cut', 'downdraft', 'updraft', 'murk'], { trainer: 'ivo' }),
      mon('gillwick', 35, ['mire-bloom', 'riptide', 'tidal-mend', 'salt-spray'], { trainer: 'ivo' }),
      mon('rimeplate', 34, ['plate-toss', 'hoarfrost', 'shard-fling', 'rime-lock'], { trainer: 'ada' }),
      mon('stillox', 35, ['grind-down', 'shard-fling', 'bedrock-charge', 'sandtrap'], { trainer: 'ada' }),
      mon('duskowl', 35, ['murk', 'gale-cut', 'drowned-bell', 'hush'], { trainer: 'ivo' }),
      mon('coilcrest', 36, ['live-wire', 'gale-cut', 'downdraft', 'jolt'], { trainer: 'ada', held: 'whetstone' }),
    ],
    items: heal('tonic', 'tonic'),
    ai: 'spire', payoutRule: 'ace', expSource: 'spire',
    tacticTag: 'three rounds, no repeats: one carry will not do',
    lines: {
      intro: 'ADA: Three rounds. IVO: Two of yours each round. ADA: Nobody fights twice. IVO: Unless you have run out of nobodies.',
      win: 'IVO: Six different faces. ADA: Every one of them pulled its weight. BOTH: The Relay Seal.',
      lose: 'ADA: One carry. IVO: Everyone else on the bench. ADA: We have met your rival, you know.',
      duelWin: 'ADA: Porch rules. IVO: We still lost. BOTH: Good evening, Keeper.',
      duelLose: 'IVO: Porch rules. ADA: Nobody loses anything. IVO: You did, a little.',
    },
  }),
  trainer({
    id: 'seraphine-spire', name: 'Seraphine Locke', title: 'Spire Leader', class: 'leader', npc: 'seraphine',
    map: 'spire-mirror', post: 'spire-mirror-dais', postName: 'the Mirror Spire dais, in the ice gallery', region: 'rimeholt', spire: 'mirror',
    party: [
      mon('gillwick', 40, ['mire-bloom', 'tidal-mend', 'riptide', 'spore-drift']),
      mon('rimeplate', 42, ['plate-toss', 'hoarfrost', 'shard-fling', 'rime-lock']),
      mon('floeback', 41, ['floe-ram', 'rime-lock', 'stand-firm', 'hoarfrost']),
      mon('strandrunner', 40, ['gale-cut', 'breaker', 'skein-sweep', 'floe-ram']),
      mon('skeinwing', 42, ['mirror-step', 'skein-sweep', 'riptide', 'hoarfrost']),
      mon('lumenveil', 43, ['shardlight', 'mirror-step', 'echo-drain', 'lens-focus'], { held: 'ballast-stone' }),
    ],
    items: heal('full-salve', 'full-salve'),
    ai: 'spire', payoutRule: 'ace', expSource: 'spire',
    tacticTag: 'evasion to +2, three Mends each, Mirrorveil ace',
    lines: {
      intro: 'In here the menu shows true odds. Two decoys at most; three Mends each; nothing hidden. I built this Spire to answer one person. You will meet him.',
      win: 'You counted the Mends and you swung at the real one. Take the Plumbline. It goes through everything, even me.',
      lose: 'You swung at reflections. Count first. Then swing. The gallery is watching, and so is he.',
      duelWin: 'You counted, even out here. I like this porch.',
      duelLose: 'No mirrors here, and you still swung at the wrong one. Count first.',
    },
  }),

  // ===== The Long Road on the Bar (Lv40-44; highest x50). =====
  trainer({
    id: 'bar-corwen', name: 'Corwen', title: 'Wreck Diver', class: 'long-road', sprite: 'trainerCoat', kind: 'water shrew',
    map: 'the-bar', post: 'bar-wreck-ribs', postName: 'the ribs of the lost fleet', region: 'the-bar', stage: 1,
    party: [mon('bilgebob', 40, ['gnash', 'riptide', 'tidal-mend', 'shellguard']), mon('rustcreel', 40, ['rust-bite', 'iron-pin', 'corrode', 'tap']), mon('creelwight', 41, ['snuff', 'echo-drain', 'iron-pin', 'stand-firm']), mon('hulkwight', 41, ['snuff', 'drowned-bell', 'iron-pin', 'stand-firm'])],
    items: heal('tonic'),
    ai: 'spire',
    tacticTag: 'Long Road 1: hulls and Hollow',
    lines: {
      intro: 'I dive the fleet that grounded the night the light went out. Every rib has a name on it. Battle me on the bones of them.',
      win: 'They would have liked you. Walk on; mind the tide.',
      lose: 'The Bar is long. You will want more than that at the far end.',
    },
  }),
  trainer({
    id: 'bar-tilda', name: 'Tilda', title: 'Tide-pool Warden', class: 'long-road', sprite: 'trainerVest', kind: 'grey seal',
    map: 'the-bar', post: 'bar-tide-pools', postName: 'the big tide pool off the Bar', region: 'the-bar', stage: 2,
    party: [mon('rayling', 40, ['riptide', 'breaker', 'salt-spray', 'mirror-step']), mon('rushling', 40, ['riptide', 'tidal-mend', 'root-knot', 'reap']), mon('gillwick', 41, ['mire-bloom', 'riptide', 'tidal-mend', 'reed-whip']), mon('strandrunner', 41, ['breaker', 'gale-cut', 'downdraft', 'riptide'])],
    items: heal('tonic'),
    ai: 'spire',
    tacticTag: 'Long Road 2: Brine everywhere; bring Bolt or Moss',
    lines: {
      intro: 'Every pool out here is a small sea with small rules. Mine: you battle the warden.',
      win: 'Leave the anemones as you found them. You may go.',
      lose: 'Washed out. The pools refill twice a day. So can you.',
    },
  }),
  trainer({
    id: 'bar-ezra', name: 'Ezra', title: 'Ex-Mooring Quartermaster', class: 'long-road', sprite: 'trainerCoat', kind: 'mountain goat',
    map: 'the-bar', post: 'bar-ration-cairn', postName: 'the old ration cairn on the Bar', region: 'the-bar', stage: 3,
    party: [mon('stillox', 41, ['bedrock-charge', 'grind-down', 'sandtrap', 'stand-firm']), mon('rimeplate', 41, ['plate-toss', 'hoarfrost', 'rime-lock', 'sandtrap']), mon('siltback', 42, ['riptide', 'sandtrap', 'bedrock-charge', 'tidal-mend']), mon('cairnward', 42, ['shardlight', 'stand-firm', 'cairn-crash', 'dazzle'])],
    items: heal('tonic'),
    ai: 'spire',
    tacticTag: 'Long Road 3: Ward (Stillcoat) and Sandtrap attrition; count your PP',
    lines: {
      intro: 'Served under Hollis. Counted every tin. Count your PP, Keeper; the Bar does not restock.',
      win: 'Inventory: one challenger, still standing. Pass.',
      lose: 'Out of supplies. Hollis would have warned you. Hollis did warn you.',
    },
  }),
  trainer({
    id: 'bar-ottilie', name: 'Ottilie', title: 'Brazier Pilgrim', class: 'long-road', sprite: 'trainerCoat', kind: 'rock dove',
    map: 'the-bar', post: 'bar-pilgrim-step', postName: 'the pilgrims\' step, past the halfway post', region: 'the-bar', stage: 5,
    party: [mon('sootling', 41, ['slag-burst', 'kiln-maw', 'scorch', 'settle']), mon('mothling', 41, ['shardlight', 'dazzle', 'dust-veil', 'tap']), mon('emberjaw', 42, ['kiln-maw', 'slag-burst', 'flashover', 'scorch']), mon('duskwisp', 42, ['murk', 'hush', 'echo-drain', 'drowned-bell']), mon('lumenveil', 43, ['shardlight', 'mirror-step', 'echo-drain', 'lens-focus'])],
    items: heal('tonic'),
    ai: 'spire',
    tacticTag: 'Long Road 4: Kiln and Glass; Mirrorveil ace',
    lines: {
      intro: 'The Keepers tended a brazier on Shardcrown all through the dark years. I carry a coal from it. Show me your light.',
      win: 'Bright enough. Go on. They are expecting you.',
      lose: 'A coal is not a lamp. Not yet.',
    },
  }),
  trainer({
    id: 'bar-hamish', name: 'Hamish', title: 'Bar Pilot', class: 'long-road', sprite: 'trainerCoat', kind: 'puffin',
    map: 'the-bar', post: 'bar-channel-marker', postName: 'the old channel marker', region: 'the-bar', stage: 6,
    party: [mon('rillfin', 42, ['breaker', 'salt-spray', 'settle', 'shellguard']), mon('skirl', 42, ['gale-cut', 'downdraft', 'updraft', 'tap']), mon('coilcrest', 42, ['live-wire', 'jolt', 'downdraft', 'gale-cut']), mon('bilgebob', 42, ['gnash', 'riptide', 'tidal-mend', 'settle']), mon('brinelance', 43, ['gnash', 'hoarfrost', 'riptide', 'iron-pin'])],
    items: heal('tonic'),
    ai: 'spire',
    tacticTag: 'Long Road 5: fast; Brinelance hits harder when low',
    lines: {
      intro: 'I would pilot boats over this Bar if there were boats. Instead I pilot challengers. Ready about.',
      win: 'Clear channel. You will make Shardcrown on this tide.',
      lose: 'Run aground. Happens to the best. Happened to a whole fleet.',
    },
  }),
  trainer({
    id: 'bar-delphine', name: 'Delphine', title: "Readers' Fund Scholar", class: 'long-road', sprite: 'trainerVest', kind: 'lynx',
    map: 'the-bar', post: 'bar-last-dry-stone', postName: 'the last dry stone before Hollis\'s Gate', region: 'the-bar', stage: 7,
    party: [mon('wirewhisk', 42, ['arc-ping', 'static-net', 'mirror-step', 'gale-cut']), mon('gillwick', 42, ['mire-bloom', 'tidal-mend', 'riptide', 'salt-spray']), mon('sedgehare', 43, ['reap', 'root-knot', 'gale-cut', 'grind-down']), mon('duskowl', 43, ['murk', 'drowned-bell', 'hush', 'gale-cut']), mon('cragmitt', 44, ['grind-down', 'bedrock-charge', 'sandtrap', 'pummel'], { held: 'whetstone' })],
    items: heal('tonic'),
    ai: 'spire',
    tacticTag: 'Long Road 6: Arc Ping reads you back; Cragmitt ace',
    lines: {
      intro: 'Hollis paid for my lessons out of every Spire share you ever earned. Let me show you what you bought.',
      win: 'Money well spent, then. Both ways. The Gate is just there.',
      lose: 'Read before you roll. They taught me that. Now I am teaching you.',
    },
  }),

  // ===== The Summit (ace x200; heals <= 2; the Summit Bell). =====
  trainer({
    id: 'bastien-keeper', name: 'Bastien Kell', title: 'Summit Keeper', class: 'keeper', npc: 'bastien',
    map: 'keepers-hall', post: 'keepers-hall-brazier-left', postName: 'the left side of the old brazier', region: 'shardcrown',
    party: [
      mon('creelwight', 43, ['snuff', 'echo-drain', 'iron-pin', 'shellguard']),
      mon('gillwick', 44, ['mire-bloom', 'tidal-mend', 'riptide', 'reed-whip']),
      mon('bilgebob', 44, ['gnash', 'riptide', 'tidal-mend', 'shellguard']),
      mon('duskwisp', 45, ['drowned-bell', 'hush', 'echo-drain', 'murk']),
      mon('hulkwight', 46, ['drowned-bell', 'snuff', 'iron-pin', 'stand-firm'], { held: 'oilskin' }),
    ],
    items: heal('full-salve', 'full-salve'),
    ai: 'summit', payoutRule: 'ace', expSource: 'spire',
    tacticTag: 'Hollow/Brine walls backed by two Full Salves (pips shown)',
    scripts: { afterLoss: 'summit-bell' },
    lines: {
      intro: 'I dived the fleet for twenty years. I learned to wait. My team learned to wait. I have two Full Salves; the Prism will have told you. Count them.',
      win: 'You counted. Here, before you go on: my own Shiftlog. Seven forms, one mark. Nobody asks to see it.',
      lose: 'Patience, Keeper. The Bell will hold your place.',
      // Freefall: the Bell keeps nothing (LF-22)
      loseFreefall: 'Patience, Keeper. The Bell keeps nothing on this dial; the climb starts at my door again.',
    },
  }),
  trainer({
    id: 'cass-keeper', name: 'Cass Rune', title: 'Summit Keeper', class: 'keeper', npc: 'cass',
    map: 'keepers-hall', post: 'keepers-hall-brazier-right', postName: 'the right side of the old brazier', region: 'shardcrown',
    party: [
      mon('coilcrest', 45, ['live-wire', 'gale-cut', 'downdraft', 'jolt'], { onEntry: Object.freeze({ weather: 'squall', turns: 3 }) }),
      mon('gillwick', 46, ['mire-bloom', 'tidal-mend', 'riptide', 'salt-spray']),
      mon('floeback', 46, ['floe-ram', 'hoarfrost', 'rime-lock', 'stand-firm']),
      mon('sedgehare', 47, ['reap', 'gale-cut', 'root-knot', 'updraft']),
      mon('skeinwing', 48, ['mirror-step', 'skein-sweep', 'riptide', 'updraft'], { held: 'whetstone' }),
    ],
    items: heal('full-salve', 'tonic'),
    ai: 'summit', payoutRule: 'ace', expSource: 'spire',
    tacticTag: 'squall feeds Gust evasion (still capped at +2)',
    scripts: { afterLoss: 'summit-bell' },
    lines: {
      intro: 'Squall coming in. My Skeinwing loves a squall. Two decoys, never three; the Mirror Spire taught you that. Did it stick?',
      win: 'It stuck. Go on through. He has been waiting a long time; be gentle with him.',
      lose: 'Blown clean off the stack. The Bell rings for you; come back up.',
      loseFreefall: 'Blown clean off the stack. The Bell keeps nothing today: back down, and start at Bastien.',
    },
  }),
  trainer({
    id: 'idris-champion', name: 'Idris Fenwake', title: 'Champion', class: 'champion', npc: 'idris',
    map: 'idris-hall', post: 'idris-hall-bell', postName: 'beneath the Summit Bell', region: 'shardcrown',
    party: [
      mon('prismoth', 46, ['shardlight', 'skein-sweep', 'lens-focus', 'mirror-step']),
      mon('duskowl', 47, ['drowned-bell', 'gale-cut', 'hush', 'murk']),
      mon('strandrunner', 48, ['breaker', 'gale-cut', 'downdraft', 'riptide'], { onEntry: Object.freeze({ weather: 'squall', turns: 3 }) }),
      mon('brinelance', 48, ['gnash', 'hoarfrost', 'riptide', 'iron-pin']),
      mon('bogmonarch', 49, ['riptide', 'bedrock-charge', 'sandtrap', 'stand-firm']),
      mon('vesperay', 50, ['vesper-mend', 'mirror-step', 'riptide', 'lens-focus'], { held: 'still-knot' }),
    ],
    items: heal('full-salve', 'full-salve'),
    ai: 'summit', payoutRule: 'ace', expSource: 'spire',
    tacticTag: 'anchored six: a Ward, a Hollow, a weather setter, a fast hitter; Vesperay evasion + Vesper Mend',
    scripts: { afterWin: 'idris-anchor-release', afterLoss: 'summit-bell' },
    lines: {
      intro: 'Every creature here has been anchored since the day it hatched. Vesperay wears my ring on its tail. I set the Spire tests so the isles could learn to read. I never sat one. Shall we?',
      win: 'You read it. All of it. I think... I think it is time I took the ring off.',
      lose: 'Thank you. Truly. The Bell will hold your place. I will be here; I am always here.',
      loseFreefall: 'Thank you. Truly. The Bell keeps nothing on this dial; climb again. I will be here; I am always here.',
    },
  }),

  // ===== Linnet Rask (rival): four battles; every one continues on any result. =====
  trainer({
    id: 'linnet-dock', name: 'Linnet Rask', title: 'Rival', class: 'rival', npc: 'linnet',
    map: 'pellwick', post: 'pellwick-keepers-dock', postName: 'the dock below the Keeper\'s Cottage', region: 'pellwick',
    // FH-07: the strip posts and the Shift lands as Cinder enters (0 / 0): the intro shows the Sootling under
    // its Up 100% card, then the flip, for every starter. A turn-2 Shift (0 / 1) was tried and dropped: a
    // Lv5 Sloshkin's Undertow or a Scrapling's Knuckle KOs the Sootling on turn 1, so good play never saw it
    party: [mon('sootling', 5, ['ember-lick', 'tap'], { nick: 'Cinder', bossShift: sureShift(0, 0, 'up', 'caldermaw') })],
    story: true, holdOut: 3, payoutRule: 'none', expSource: 'story',
    tacticTag: 'stand as long as you can; the strip says Up 100%',
    scripts: { before: 'linnet-dock-before', afterWin: 'linnet-dock-after', afterLoss: 'linnet-dock-after' },
    lines: {
      intro: 'Cinder, up! Show the walker what all that glowing\'s for!',
      win: 'You knocked over a HILL. Cinder, we\'re practising. All of tomorrow.',
      lose: 'Sorry! Sorry. Cinder doesn\'t know how big it is yet. Neither do I.',
    },
  }),
  trainer({
    id: 'linnet-brackenford', name: 'Linnet Rask', title: 'Rival', class: 'rival', npc: 'linnet',
    map: 'lowmoor', post: 'lowmoor-rematch-stones', postName: 'Linnet\'s rematch stones at Brackenford', region: 'lowmoor',
    party: [mon('tossup', 6, ['tap', 'sure-pinch']), mon('mudfist', 7, ['tap', 'knuckle']), mon('caldermaw', 11, ['kiln-maw', 'ember-lick', 'shard-fling'], { nick: 'Cinder' })],
    story: true, expSource: 'story',
    tacticTag: 'one carry: everything runs through Caldermaw',
    scripts: { before: 'linnet-brackenford-before', afterWin: 'linnet-brackenford-after' },
    lines: {
      intro: 'Badge, then. Fine. Cinder has not lost since the dock. The other two are... warming up. They are always warming up.',
      win: 'You beat Cinder. You beat Cinder? Nobody... fine. First steps. Mine too, apparently.',
      lose: 'Cinder carries. That is what carries do. Rest up; I will be on these stones.',
    },
  }),
  trainer({
    id: 'linnet-rimeholt', name: 'Linnet Rask', title: 'Rival', class: 'rival', npc: 'linnet',
    map: 'rimeholt', post: 'rimeholt-frostwick-jetty', postName: 'the Frostwick jetty', region: 'rimeholt',
    party: [
      mon('rushling', 36, ['riptide', 'root-knot', 'tidal-mend', 'spore-drift']),
      mon('duskwisp', 37, ['murk', 'hush', 'echo-drain', 'drowned-bell']),
      mon('wirewhisk', 37, ['jolt', 'static-net', 'mirror-step', 'gale-cut']),
      mon('rimeplate', 38, ['plate-toss', 'hoarfrost', 'stand-firm', 'rime-lock']),
      mon('sedgehare', 38, ['reap', 'root-knot', 'gale-cut', 'updraft']),
      mon('sootling', 39, ['kiln-maw', 'slag-burst', 'scorch', 'settle'], { nick: 'Cinder' }),
    ],
    items: heal('tonic'),
    story: true, ai: 'spire', expSource: 'story',
    tacticTag: 'a balanced six she trained herself; no carry to target',
    lines: {
      intro: 'Cut my hair. Trained a bench. Every one of them, by hand. Cinder rides up here now. Ready?',
      win: 'Six of them and every one of them mattered. That is new. That is good. Will you... read Cinder for me? Not Merrow. You.',
      lose: 'There. All six. Nobody carried. Now read Cinder for me, would you? I am done being afraid of the cards.',
    },
  }),
  trainer({
    id: 'linnet-gate', name: 'Linnet Rask', title: 'Rival', class: 'rival', npc: 'linnet',
    map: 'the-bar', post: 'bar-shardcrown-gate', postName: 'the Shardcrown gate at the end of the Bar', region: 'the-bar', stage: 8,
    party: [
      mon('rushling', 42, ['riptide', 'root-knot', 'tidal-mend', 'reap']),
      mon('duskwisp', 43, ['drowned-bell', 'hush', 'echo-drain', 'murk']),
      mon('coilcrest', 43, ['live-wire', 'jolt', 'downdraft', 'gale-cut']),
      mon('rimeplate', 44, ['plate-toss', 'hoarfrost', 'rime-lock', 'bedrock-charge']),
      mon('sedgehare', 45, ['reap', 'grind-down', 'root-knot', 'gale-cut']),
      mon('emberjaw', 46, ['kiln-maw', 'flashover', 'slag-burst', 'scorch'], { nick: 'Cinder' }),
    ],
    items: heal('tonic'),
    story: true, ai: 'spire', expSource: 'story',
    tacticTag: 'balanced six; Cinder has Shifted twice since Rimeholt, same mark',
    scripts: { before: 'linnet-gate-before', afterWin: 'linnet-gate-after', afterLoss: 'linnet-gate-after' },
    lines: {
      intro: 'Last stop before the Keepers. Cinder Shifted twice since Rimeholt. Same mark, see? Right there. Let us go.',
      win: 'Good. Good! Here, take this. Gnash. It pops decoys. You will need it more than I will.',
      lose: 'Ha! Still take the disc. Gnash. You will need it up there more than I need to gloat.',
    },
  }),

  // ===== Wick Dorrow (friend; story, any result). =====
  trainer({
    id: 'wick-cairnhold', name: 'Wick Dorrow', title: 'Friend', class: 'friend', npc: 'wick',
    map: 'cairnhold', post: 'cairnhold-knapps-end-dock', postName: 'the Knapp\'s End dock', region: 'cairnhold',
    party: [mon('rillfin', 12, ['salt-spray', 'settle', 'shellguard', 'tap'], { nick: 'Skipper' })],
    story: true, payoutRule: 'none', expSource: 'story',
    tacticTag: 'one fragile Rillfin and support moves',
    lines: {
      intro: 'Keeper! Keeper! Skipper and me have been practising. On rocks. The rocks lost. Your turn!',
      win: 'We lost but Skipper Settled twice! Did you see? Twice!',
      lose: 'We WON? Skipper, we won! Sorry, Keeper. Not sorry. A bit sorry.',
    },
  }),
  trainer({
    id: 'wick-long-road', name: 'Wick Dorrow', title: 'Friend', class: 'friend', npc: 'wick',
    map: 'the-bar', post: 'bar-halfway-post', postName: 'the halfway post on the Bar', region: 'the-bar', stage: 4,
    party: [
      mon('bilgebob', 41, ['gnash', 'riptide', 'tidal-mend', 'shellguard']),
      mon('rushling', 42, ['riptide', 'root-knot', 'tidal-mend', 'reap']),
      mon('gillwick', 43, ['mire-bloom', 'riptide', 'tidal-mend', 'salt-spray'], { nick: 'Skipper', bossShift: sureShift(1, 2, 'up', 'strandrunner') }),
    ],
    story: true, payoutRule: 'none', expSource: 'story',
    tacticTag: 'the water pack; Skipper\'s posted Shift lands Up',
    scripts: { before: 'wick-long-road-before' },
    lines: {
      intro: 'Halfway, Keeper! I carried the flame all the way out here. Skipper has a pip. I want you to see it land. Ready?',
      win: 'It walked out of the water. It walked, Keeper! I do not even mind losing. I mind a little.',
      lose: 'We did it! Skipper can walk AND swim now and we beat the Keeper! Go on, go on, they are waiting!',
    },
  }),

  // ===== Factions (story set pieces; any result). =====
  trainer({
    id: 'merrow-engine', name: 'Agathe Merrow', title: 'Provost', class: 'faction', npc: 'merrow',
    map: 'lantern-stack', post: 'lantern-stack-engine', postName: 'the Sinking Engine on the Lantern Stack', region: 'the-bar',
    party: [
      mon('stillox', 35, ['grind-down', 'sandtrap', 'stand-firm', 'shard-fling']),
      mon('rimeplate', 36, ['plate-toss', 'rime-lock', 'hoarfrost', 'stand-firm']),
      mon('siltback', 37, ['riptide', 'sandtrap', 'bedrock-charge', 'stand-firm']),
      mon('cairnward', 38, ['shardlight', 'stand-firm', 'cairn-crash', 'dazzle']),
    ],
    items: heal('tonic'),
    story: true, ai: 'spire', payoutRule: 'none', expSource: 'story',
    rules: Object.freeze({ anchorPulse: Object.freeze({ everyTurns: 3, effect: 'clear-stages', sides: 'both', text: 'The Engine thrums. An Anchor Pulse rolls across the stack: every stat stage drops to level.' }) }),
    tacticTag: 'anchored team; an Anchor Pulse levels every stat stage every 3 turns',
    scripts: { before: 'merrow-engine-before', afterWin: 'merrow-engine-after', afterLoss: 'merrow-engine-after' },
    lines: {
      intro: 'Light calls the change. I have spent thirty years making sure nothing is called. Stand aside, Keeper, or stand and be counted.',
      win: 'Stop. Stop. What is that in your hand? Give it here.',
      lose: 'You are brave. Brave is not the same as right. What is that in your hand?',
    },
  }),
  trainer({
    id: 'varga-drownwood', name: 'Teo Varga', title: 'Scatter Organizer', class: 'faction', npc: 'varga',
    map: 'drownwood', post: 'drownwood-scatter-raft', postName: 'the Scatter raft at the drowning street', region: 'drownwood',
    party: [
      mon('mudfist', 25, ['sand-smother', 'pummel', 'stand-firm', 'knuckle'], { bossShift: dialShift(1, 2, 'knuckleback', 'rushling', 'puddlepip') }),
      mon('rustcreel', 26, ['rust-bite', 'corrode', 'iron-pin', 'tap'], { bossShift: dialShift(1, 2, 'creelwight', 'mudfist', 'puddlepip') }),
      mon('sedgehare', 27, ['reap', 'root-knot', 'spore-drift', 'updraft'], { bossShift: dialShift(1, 2, 'strandrunner', 'rimeplate', 'reedkit') }),
      mon('bogmonarch', 28, ['riptide', 'settle', 'stand-firm', 'shard-fling']),
    ],
    items: heal('tonic'),
    story: true, payoutRule: 'none', expSource: 'story',
    tacticTag: 'forces posted Shifts on his own side; some land Down',
    lines: {
      intro: 'Only Shifted swimmers came home from the drowning tides. I am not asking anyone to like it. Watch the cards with me.',
      win: 'You beat my odds and you read every card. Come and call odds at the fair. I pay.',
      lose: 'Down card. Up card. Still here. That is the whole argument, Keeper.',
    },
  }),

  // ===== Corin Vale's exhibitions (optional; nothing lost; one posted Tossup Shift each). =====
  trainer({
    id: 'corin-exhibition-1', name: 'Corin Vale', title: 'Mentor', class: 'mentor', npc: 'corin',
    map: 'lowmoor', post: 'lowmoor-brackenford-stones', postName: 'the Brackenford stones at the low', region: 'lowmoor',
    party: [
      mon('skirl', 6, ['tap', 'downdraft']),
      mon('tossup', 8, ['tap', 'sure-pinch', 'settle'], { bossShift: dialShift(1, 2, 'sedgehare', 'wirewhisk', 'puddlepip') }),
    ],
    payoutRule: 'none', expSource: 'story',
    tacticTag: 'exhibition: read all three cards aloud',
    lines: {
      intro: 'An exhibition. Nothing to lose, which is the only way I can teach you anything. My Tossup has a window. Read it to me. My eyes are not what they were.',
      win: 'Three cards, and you planned for each. Good. Say what you see, every time.',
      lose: 'You looked at the Up card the way everyone looks at the Up card. Look at the Down card first. Then the rest.',
    },
  }),
  trainer({
    id: 'corin-exhibition-2', name: 'Corin Vale', title: 'Mentor', class: 'mentor', npc: 'corin',
    map: 'emberstep', post: 'emberstep-sulphur-cross-bench', postName: 'the bench at Sulphur Cross', region: 'emberstep',
    party: [
      mon('duskwisp', 17, ['murk', 'hush']),
      mon('skirl', 18, ['downdraft', 'gale-cut', 'updraft']),
      mon('tossup', 20, ['sure-pinch', 'settle', 'shell-rattle', 'shellguard'], { bossShift: dialShift(1, 2, 'coilcrest', 'rushling', 'puddlepip') }),
    ],
    payoutRule: 'none', expSource: 'story',
    tacticTag: 'exhibition: night owls, then a rolled Tossup Shift',
    lines: {
      intro: 'Another lesson. My owls know the dark better than I do now. The Tossup will Shift on its second turn. You know the drill.',
      win: 'You are reading faster than I can hear you. That is the point.',
      lose: 'Hm. You forgot the Side card. It is always there, being sensible. Do not forget the sensible card.',
    },
  }),
  trainer({
    id: 'corin-exhibition-3', name: 'Corin Vale', title: 'Mentor', class: 'mentor', npc: 'corin',
    map: 'thistlewind', post: 'thistlewind-windle-mill-steps', postName: 'the mill steps in Windle', region: 'thistlewind',
    party: [
      mon('duskwisp', 30, ['murk', 'hush', 'echo-drain']),
      mon('skirl', 31, ['gale-cut', 'downdraft', 'updraft']),
      mon('duskowl', 32, ['murk', 'gale-cut', 'hush', 'drowned-bell']),
      mon('tossup', 34, ['knuckle', 'rust-bite', 'shellguard', 'settle'], { bossShift: dialShift(1, 2, 'strandrunner', 'mudfist', 'puddlepip') }),
    ],
    payoutRule: 'none', expSource: 'story',
    tacticTag: 'exhibition: the last one; the Tossup Shift can skip a stage',
    lines: {
      intro: 'The last exhibition. After this you read for me, not the other way round. Go on, then.',
      win: 'There. I cannot read one that size any more, and you can. I am glad it was you.',
      lose: 'Even now. Even now you look for the card you want. So did she. So did I.',
    },
  }),

  // ===== Porch Duels (friendly; scaled to the party median; 30 x curve; nothing lost). =====
  trainer({
    id: 'porch-wren', name: 'Wren Hearthwright', title: 'Porch Duel', class: 'porch', npc: 'wren',
    map: 'pellwick', post: 'porch-coop-yard', postName: 'the co-op yard porch', region: 'pellwick',
    party: [mon('mudfist', 4, null, { levelOffset: -1 }), mon('siltback', 5, null, { levelOffset: 0 }), mon('scrapling', 6, null, { levelOffset: 1, nick: 'Peg' })],
    payoutRule: 'curve', expSource: 'rematch', scale: PORCH_SCALE,
    tacticTag: 'Peg leads with her fists',
    lines: {
      intro: 'Peg has been gnawing the porch rail all week. She needs a battle more than the rail needs gnawing. Go on.',
      win: 'Peg says good game. Peg says it by chewing your bootlace. Sorry.',
      lose: 'Ha! Builder\'s arms. Pay that in buttons and I will notch it. Kidding. Mostly.',
    },
  }),
  trainer({
    id: 'porch-tully', name: 'Tully', title: 'Porch Duel', class: 'porch', npc: 'tully',
    map: 'pellwick', post: 'porch-tully', postName: 'Tully\'s porch', region: 'pellwick',
    party: [mon('tossup', 4, null, { levelOffset: -1 }), mon('mudfist', 5, null, { levelOffset: 0 }), mon('scrapling', 6, null, { levelOffset: 1, nick: 'Scamp' })],
    payoutRule: 'curve', expSource: 'rematch', scale: PORCH_SCALE,
    tacticTag: 'Scamp is fast. Scamp says.',
    lines: {
      intro: 'Scamp ran three laps this morning. In my head. Fastest kid on the green, me. Fight?',
      win: 'You are quick. Not as quick as me. But quick.',
      lose: 'Told you. Fastest kid on the green. Do not ask the green.',
    },
  }),
  trainer({
    id: 'porch-juniper', name: 'Juniper Pell', title: 'Porch Duel', class: 'porch', npc: 'juniper',
    map: 'pellwick', post: 'porch-pells', postName: 'the porch of Pell\'s Sundries', region: 'pellwick',
    party: [mon('rushling', 4, null, { levelOffset: -1 }), mon('mothling', 5, null, { levelOffset: 0 }), mon('wirewhisk', 6, null, { levelOffset: 1, nick: 'Tinsel' })],
    payoutRule: 'curve', expSource: 'rematch', scale: PORCH_SCALE,
    tacticTag: 'Tinsel pings your moves first',
    lines: {
      intro: 'Shop is shut, shine is on. Tinsel wants to see what you have in your pockets. Battle-wise.',
      win: 'Well spent. You may have the shiny button. No, the other shiny button.',
      lose: 'Buttons, please. Kidding. I will put it on your slate. Kidding. Probably.',
    },
  }),
  trainer({
    id: 'porch-odile', name: 'Odile', title: 'Porch Duel', class: 'porch', npc: 'odile',
    map: 'pellwick', post: 'porch-odile', postName: 'Odile\'s porch, by the easel', region: 'pellwick',
    party: [mon('mothling', 4, null, { levelOffset: -1 }), mon('sedgehare', 5, null, { levelOffset: 0 }), mon('prismoth', 6, null, { levelOffset: 1 })],
    payoutRule: 'curve', expSource: 'rematch', scale: PORCH_SCALE,
    requires: Object.freeze({ visited: 'cairnhold' }),
    tacticTag: 'Ward: Glasshide Prismoth (offered only after you reach Cairnhold)',
    lines: {
      intro: 'Sit for me? No, battle for me. I want the light on your face when it goes well. Or badly. Both paint.',
      win: 'Hold that look. That one. Oh, it is gone. Lovely while it lasted.',
      lose: 'I will paint you anyway. Gracious in defeat. It is a good colour on you.',
    },
  }),
  trainer({
    id: 'porch-tamsin', name: 'Tamsin Brack', title: 'Porch Duel', class: 'porch', npc: 'tamsin',
    map: 'pellwick', post: 'porch-dark-1', postName: 'the porch of dark house 1', region: 'pellwick',
    party: [mon('rustcreel', 4, null, { levelOffset: -1 }), mon('rushling', 5, null, { levelOffset: 0 }), mon('creelwight', 6, null, { levelOffset: 1, nick: 'Kettle' })],
    payoutRule: 'curve', expSource: 'rematch', scale: PORCH_SCALE,
    available: Object.freeze({ flag: 'sp.tamsin-arrived' }),
    tacticTag: 'Kettle is Hollow: Plain and Grit go straight through',
    lines: {
      intro: 'Beat you to the sparkles this morning. Let us see if I can beat you to the finish.',
      win: 'Fine. You are quicker on the steps than on the flats. Noted.',
      lose: 'Kettle\'s on! Get it? Because he... yes, you get it.',
    },
  }),
  trainer({
    id: 'porch-wick', name: 'Wick Dorrow', title: 'Porch Duel', class: 'porch', npc: 'wick',
    map: 'pellwick', post: 'porch-dorrow', postName: 'the Dorrows\' burrow step', region: 'pellwick',
    party: [
      mon('bilgebob', 4, null, { levelOffset: -1 }),
      mon('rushling', 5, null, { levelOffset: 0 }),
      mon('gillwick', 6, null, { levelOffset: 1, nick: 'Skipper', before: Object.freeze({ species: 'rillfin', until: Object.freeze({ thread: Object.freeze({ id: 'water-pack', beat: 2 }) }) }) }),
    ],
    payoutRule: 'curve', expSource: 'rematch', scale: PORCH_SCALE,
    tacticTag: 'Skipper (a Rillfin until the water-pack Shift)',
    lines: {
      intro: 'Keeper! Porch battle! Mum says only one. Mum says that every time.',
      win: 'Again tomorrow? Mum says only one. Tomorrow is a different one.',
      lose: 'We beat the KEEPER! On our own STEP!',
    },
  }),
  trainer({
    id: 'porch-augusta', name: 'Augusta Skerry', title: 'Porch Duel', class: 'porch', npc: 'augusta',
    map: 'pellwick', post: 'porch-wardens-house', postName: 'the Warden\'s house porch', region: 'pellwick',
    party: [mon('rayling', 4, null, { levelOffset: -1 }), mon('rimeplate', 5, null, { levelOffset: 0 }), mon('bilgebob', 6, null, { levelOffset: 1, nick: 'Bosun' })],
    payoutRule: 'curve', expSource: 'rematch', scale: PORCH_SCALE,
    tacticTag: 'Bosun soaks hits; nothing self-destructs near Sodden',
    lines: {
      intro: 'Six in ten I win this. I posted it on the board this morning. Prove me wrong; it is good for the odds.',
      win: 'Four in ten, then. I will amend the board.',
      lose: 'Six in ten, as posted. The Warden is never wrong about weather or Bosun.',
    },
  }),
  trainer({
    id: 'porch-linnet', name: 'Linnet Rask', title: 'Porch Duel', class: 'porch', npc: 'linnet',
    map: 'pellwick', post: 'porch-linnet', postName: 'Linnet\'s porch, next door', region: 'pellwick',
    party: [
      mon('rushling', 4, null, { levelOffset: -1 }),
      mon('duskwisp', 5, null, { levelOffset: 0 }),
      mon('sootling', 6, null, { levelOffset: 1, nick: 'Cinder', before: Object.freeze({ species: 'caldermaw', until: Object.freeze({ flag: 'sp.linnet-fell' }) }) }),
    ],
    payoutRule: 'curve', expSource: 'rematch', scale: PORCH_SCALE,
    available: Object.freeze({ any: Object.freeze([Object.freeze({ not: Object.freeze({ flag: 'sp.linnet-fell' }) }), Object.freeze({ flag: 'sp.linnet-returned' })]) }),
    tacticTag: 'Cinder (a Caldermaw until the fall); not while her porch is dark',
    lines: {
      intro: 'Over the fence or round by the gate? Over the fence. Always over the fence.',
      win: 'Again. No. Tomorrow. Fine. Tomorrow.',
      lose: 'Next door\'s best. That is me. Tell the porch.',
    },
  }),
]);

/** Trainers keyed by id. */
export const TRAINER_BY_ID = Object.freeze(Object.fromEntries(TRAINERS.map((t) => [t.id, t])));

/** Before / win / loss scripts this chapter owns, in the §6.1 op format (merge into DATA.scripts). */
export const TRAINER_SCRIPTS = Object.freeze({ ...scripts });

/** Route trainers per isle, in walking order (the five on each isle). */
export const ROUTE_TRAINERS = Object.freeze(Object.fromEntries(
  ['lowmoor', 'cairnhold', 'emberstep', 'drownwood', 'thistlewind', 'rimeholt'].map((isle) => [isle, Object.freeze(TRAINERS.filter((t) => t.class === 'route' && t.region === isle).map((t) => t.id))]),
));

export default TRAINERS;
