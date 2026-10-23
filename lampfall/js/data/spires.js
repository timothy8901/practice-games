/**
 * The six Spires, the Long Road on the Bar, the Summit, the Summit Bell and the Reading, as data.
 * [GDD-04 BATTLE]
 *
 * Exports (the orchestrator wires `SPIRES` into DATA once a `spires` table exists; GDD-ids lists
 * the ids under UNMAPPED.spires):
 * - `WEATHER_KINDS`   the four arena weathers the Weather Spire, Cass Rune and Idris post
 * - `BOSS_SHIFT_ODDS` Up / Side / Down card odds a posted boss Shift uses when its `odds` is 'dial'
 * - `SPIRES`          six rows: leader, trainer, theme rule, the order of things inside, dossier,
 *                     badge (wax seal), prize, Spire share and the reader tools the badge unlocks
 * - `LONG_ROAD`, `SUMMIT`, `SUMMIT_BELL`, `THE_READING`
 *
 * Every rule here is a data shape the battle flow reads (`theme.rule`, `rules`); nothing names a
 * system. References use manifest ids: trainers, species, items, shops, scripts, maps, npcs.
 * Numbers follow GDD-00 §4, §7, §8 and §11; see design/GDD-04-battle.md for the reasoning.
 * @module data/spires
 */

const f = Object.freeze;

// --- arena weather ------------------------------------------------------------------------------

/**
 * Arena weathers (Weather Spire cycle; Cass Rune's and Idris's weather setters post `squall`).
 * `power` multiplies a move's power by its type; `accuracy` multiplies every move's hit chance;
 * `chip` is end-of-turn damage as a fraction of max HP on creatures without one of `chipImmune`
 * types (weather chip is indirect damage: every Ward lets it through); `evasion` grants stages on
 * the first turn of the weather to creatures of those types (never past the +2 cap).
 */
export const WEATHER_KINDS = f([
  f({ id: 'steam', name: 'Steam', power: f({ Kiln: 1.2, Rime: 0.8 }), accuracy: 0.9, chip: null, evasion: null,
    text: 'Steam: Kiln moves x1.2, Rime x0.8. Every move is a little less sure (accuracy x0.9).' }),
  f({ id: 'ash', name: 'Ash', power: f({ Stone: 1.2, Grit: 1.2, Gust: 0.8 }), accuracy: 1, chip: f({ fraction: 1 / 16, chipImmune: f(['Kiln', 'Stone']) }), evasion: null,
    text: 'Ash: Stone and Grit moves x1.2, Gust x0.8. Anything not Kiln or Stone loses 1/16 HP each turn (gets past Wards).' }),
  f({ id: 'squall', name: 'Squall', power: f({ Gust: 1.2, Bolt: 1.2, Kiln: 0.8 }), accuracy: 1, chip: null, evasion: f({ types: f(['Gust']), stages: 1 }),
    text: 'Squall: Gust and Bolt moves x1.2, Kiln x0.8. Gust creatures gain +1 evasion as it blows in (cap +2).' }),
  f({ id: 'clear', name: 'Clear', power: f({}), accuracy: 1, chip: null, evasion: null, text: 'Clear: no weather effects.' }),
]);

// --- posted boss Shifts -------------------------------------------------------------------------

/**
 * Card odds for a posted boss Shift whose `odds` is 'dial' (GDD-00 §8 Shift table). `lit` applies
 * once `lit.steadied` is set (5 points Down -> Side). A card whose form is missing drops out and
 * its odds go to the remaining cards pro rata, as on the player's Forecast.
 */
export const BOSS_SHIFT_ODDS = f({
  base: f({ drift: f({ up: 50, side: 40, down: 10 }), flux: f({ up: 40, side: 35, down: 25 }), freefall: f({ up: 30, side: 30, down: 40 }) }),
  lit: f({ drift: f({ up: 50, side: 45, down: 5 }), flux: f({ up: 40, side: 40, down: 20 }), freefall: f({ up: 30, side: 35, down: 35 }) }),
  stream: 'bossShift:<trainerId>:<slot>',
  postedText: 'Its mark is glowing. Forecast posted: it Shifts at the end of next turn.',
});

// --- the six Spires -----------------------------------------------------------------------------

/** Spire share (GDD-00 §7): 10% of the loan currently open, notched onto Wren's ledger, once per badge. */
const SHARE = f({ fraction: 0.1, of: 'open-loan', ledger: 'wren', once: true });

export const SPIRES = f([
  f({
    id: 'turn', n: 1, name: 'Turn Spire', isle: 'lowmoor', map: 'spire-turn', waystone: 'brackenford', curveLevel: 7,
    leader: 'maud', trainer: 'maud-spire', ace: f({ species: 'bilgebob', level: 10 }),
    theme: f({
      kind: 'scripted-shifts', name: 'Posted scripted Shifts',
      text: 'Each of Maud\'s creatures Shifts once, mid-battle, and the Forecast strip is posted a turn before it lands. Her Puddlepip\'s card is a sure thing; her Bilgebob\'s three cards roll at your dial\'s odds.',
      rule: f({ bossShifts: true, postTurnsAhead: 1, playerShifts: false, odds: 'per-creature' }),
    }),
    order: f([
      f({ kind: 'door', text: 'TURN SPIRE. Maud Tallis, ferry pilot. Two creatures; both will Shift. Odds posted a turn ahead.' }),
      f({ kind: 'lesson', script: 'maud-practice-table', optional: true, text: 'The practice table at Brackenford: Reroll a sample Forecast with no clock (taught before the Spire, any time).' }),
      f({ kind: 'battle', trainer: 'maud-spire' }),
    ]),
    dossier: f({
      title: 'Turn Spire: Maud Tallis',
      tacticTag: 'posted scripted Shifts, one sure, one rolled',
      text: 'Puddlepip Lv8 (Brine). Strip: Up to Sloshkin, 100%. Bilgebob Lv10 (Brine, Sodden). Strip: Up Brinelance / Side Rushling / Down Puddlepip at your dial\'s odds. One Salve. Plan a move for every card, not just the one you like. "Read them. Then decide. Confirm?" -M.T.',
    }),
    badge: f({ id: 'turn', name: 'Turn Seal', seal: 'a goose feather pressed into grey wax' }),
    prize: f({ buttons: 2000, starsalt: 3 }),
    share: SHARE,
    unlocks: f([
      f({ kind: 'reader-tool', id: 'reroll', name: 'Reroll', text: 'Spend Starsalt to redraw a Forecast: 1, 2, 4, 8 Starsalt within one window.' }),
      f({ kind: 'stock', shop: 'pells-sundries', item: 'disc-spore-drift', text: 'The chip-damage disc (Spore Drift) is guaranteed in Pell\'s stock from now on.' }),
    ]),
  }),
  f({
    id: 'ward', n: 2, name: 'Ward Spire', isle: 'cairnhold', map: 'spire-ward', waystone: 'knapps-end', curveLevel: 13,
    leader: 'osric', trainer: 'osric-spire', ace: f({ species: 'prismoth', level: 16 }),
    theme: f({
      kind: 'wards', name: 'Wards',
      text: 'Two stone sentinels teach the tell before Osric does: the lattice shimmer, the Ward ? badge, the readout after a blocked hit. Osric fields one Ward of his own, a Glasshide Prismoth (only Strong hits land: Kiln and Rime). Chip damage (poison, burn, trap) always gets through, and Crackdust suppresses a Ward for 3 turns.',
      rule: f({ wardBadge: true, readout: true, crackdust: f({ item: 'crackdust', shops: f(['cairnhold-clinic', 'pells-sundries']), price: 300, turns: 3 }) }),
    }),
    order: f([
      f({ kind: 'door', text: 'WARD SPIRE. Osric Penhallow, stonecutter. Read the shimmer. Crackdust at the clinic, 300.' }),
      f({
        kind: 'sentinel', id: 'ward-sentinel-east', name: 'East Sentinel', ai: 'wild', capture: false, costs: 'nothing',
        foe: f({ species: 'chillnub', level: 13, moves: f(['tap', 'frost-nip', 'settle']) }),
        lesson: 'Stillcoat: hits under 50 power do nothing. Tap bounces; Salt Spray lands.',
      }),
      f({
        kind: 'sentinel', id: 'ward-sentinel-west', name: 'West Sentinel', ai: 'wild', capture: false, costs: 'nothing',
        foe: f({ species: 'cairnward', level: 14, moves: f(['shard-fling', 'settle', 'dazzle']) }),
        lesson: 'Another Stillcoat, on a Stone/Glass body. The readout lists which of your moves still land.',
      }),
      f({ kind: 'battle', trainer: 'osric-spire' }),
    ]),
    dossier: f({
      title: 'Ward Spire: Osric Penhallow',
      tacticTag: 'stone pair, then a Glasshide Prismoth (Kiln, Rime, chip)',
      text: 'Siltback Lv14 (Brine/Stone). Rimeplate Lv15 (Rime/Stone). Prismoth Lv16 (Glass/Gust, WARD: Glasshide; only Strong hits land: Kiln, Rime; its HP is a quarter of a normal one). Two Salves. Poison, burn and trap chip get through any Ward. "Slowly. Read slowly." -O.P.',
    }),
    badge: f({ id: 'ward', name: 'Ward Seal', seal: 'a hex lattice cut into granite-grey wax' }),
    prize: f({ buttons: 3200, starsalt: 3 }),
    share: SHARE,
    unlocks: f([
      f({ kind: 'travel', id: 'lantern-paths', name: 'Lantern-paths', text: 'Ludo has lit every Waystone you have visited: walk between any two, or home, at any tide.' }),
      f({ kind: 'travel', id: 'free-ferry', name: 'Free ferry', text: 'Maud\'s ferry no longer charges its 200.' }),
      f({ kind: 'stock', shop: 'pells-sundries', item: 'skyglass-wick', text: 'Skyglass Wicks (x2 capture odds) at Pell\'s.' }),
    ]),
  }),
  f({
    id: 'weather', n: 3, name: 'Weather Spire', isle: 'emberstep', map: 'spire-weather', waystone: 'sulphur-cross', curveLevel: 19,
    leader: 'ines', trainer: 'ines-spire', ace: f({ species: 'emberjaw', level: 22 }),
    theme: f({
      kind: 'weather', name: 'Posted 3-turn weather',
      text: 'The arena weather changes every three turns in a posted cycle: steam, ash, squall, clear, and round again. The HUD always shows the next three turns. Steam favours Ines\'s Emberjaw; squall her Coilcrest.',
      rule: f({ cycle: f(['steam', 'ash', 'squall', 'clear']), turnsEach: 3, postedTurnsAhead: 3, startsWith: 'steam' }),
    }),
    order: f([
      f({ kind: 'door', text: 'WEATHER SPIRE. Ines Calloway. Steam, ash, squall, clear: three turns each, posted. Dress accordingly.' }),
      f({ kind: 'battle', trainer: 'ines-spire' }),
    ]),
    dossier: f({
      title: 'Weather Spire: Ines Calloway',
      tacticTag: 'posted 3-turn weather: steam, ash, squall, clear',
      text: 'Rayling Lv20 (Brine). Coilcrest Lv21 (Bolt/Gust; loves a squall). Emberjaw Lv22 (Kiln; loves the steam). One Tonic. Turns 1-3 steam, 4-6 ash, 7-9 squall, 10-12 clear, repeat. Ash chips everything but Kiln and Stone. "You will know before I do. Well. At the same time." -I.C.',
    }),
    badge: f({ id: 'weather', name: 'Weather Seal', seal: 'three wavy lines in sulphur-yellow wax' }),
    prize: f({ buttons: 4400, starsalt: 3 }),
    share: SHARE,
    unlocks: f([
      f({ kind: 'key-item', item: 'scouting-prism', npc: 'corin', text: 'Corin clips the Scouting Prism to your Reading Glass: Read adds moves, held item and Mends left.' }),
      f({ kind: 'stock', shop: 'pells-sundries', item: 'ether', text: 'Ethers at Pell\'s.' }),
      f({ kind: 'stock', shop: 'pells-sundries', item: 'full-ether', text: 'Full Ethers at Pell\'s.' }),
    ]),
  }),
  f({
    id: 'hollow', n: 4, name: 'Hollow Spire', isle: 'drownwood', map: 'spire-hollow', waystone: 'mossgate', curveLevel: 26,
    leader: 'wendel', trainer: 'wendel-spire', ace: f({ species: 'hulkwight', level: 29 }),
    theme: f({
      kind: 'immunities', name: 'Immunities',
      text: 'Every creature Wendel fields is Hollow, and Hollow is immune to Plain and Grit. The move menu marks those moves "No effect" before you pick. The Coverage view will already have said "Gap: Hollow" if you are short.',
      rule: f({ allTypes: f(['Hollow']), immune: f({ Hollow: f(['Plain', 'Grit']) }), menuMarksNoEffect: true, coverageWarning: 'Hollow' }),
    }),
    order: f([
      f({ kind: 'door', text: 'HOLLOW SPIRE. Wendel Teague, boatwright. Hollow only. Plain and Grit go straight through.' }),
      f({ kind: 'battle', trainer: 'wendel-spire' }),
    ]),
    dossier: f({
      title: 'Hollow Spire: Wendel Teague',
      tacticTag: 'all Hollow: immune to Plain and Grit; Oilskin halves chip',
      text: 'Duskwisp Lv27 (Hollow). Creelwight Lv28 (Hollow/Rust; Empty Weave halves the first hit that is not Strong). Hulkwight Lv29 (Hollow/Rust, holds an Oilskin). Two Tonics. Strong into Hollow: Kiln, Gust, Glass. "A hull is mostly what is not there." -W.T.',
    }),
    badge: f({ id: 'hollow', name: 'Hollow Seal', seal: 'a hull rib in tar-black wax' }),
    prize: f({ buttons: 5800, starsalt: 3 }),
    share: SHARE,
    unlocks: f([
      f({ kind: 'reader-tool', id: 'recall', name: 'Recall', npc: 'corin', cost: f({ starsalt: 6 }), text: 'Corin at the Archive returns a creature to any form in its Shiftlog for 6 Starsalt.' }),
      f({ kind: 'stock', shop: 'pells-sundries', faceUp: 1, items: f(['disc-cairn-crash', 'disc-hoarfrost', 'disc-drowned-bell']), text: 'One coverage disc of the three is face-up in Pell\'s stock.' }),
    ]),
  }),
  f({
    id: 'relay', n: 5, name: 'Relay Spire', isle: 'thistlewind', map: 'spire-relay', waystone: 'windle', curveLevel: 33,
    leader: 'ada', leaders: f(['ada', 'ivo']), trainer: 'hallorans-spire', ace: f({ species: 'coilcrest', level: 36 }),
    theme: f({
      kind: 'relay', name: 'No-repeat rounds, singles',
      text: 'Three singles rounds against the Halloran twins, two of their creatures a round. You bring two creatures to each round, and nobody of yours fights in two rounds. If you run out of fresh creatures, anyone may come back (the rule never walls a small party). No healing between rounds.',
      rule: f({
        singles: true, playerPerRound: 2, noRepeat: true, whenDry: 'reuse-any', healBetweenRounds: false,
        rounds: f([
          f({ n: 1, trainer: 'ivo', slots: f([0, 1]) }),
          f({ n: 2, trainer: 'ada', slots: f([2, 3]) }),
          f({ n: 3, trainer: 'both', slots: f([4, 5]) }),
        ]),
      }),
    }),
    order: f([
      f({ kind: 'door', text: 'RELAY SPIRE. Ada & Ivo Halloran. Three rounds, two of yours each, no repeats. One carry will not do.' }),
      f({ kind: 'battle', trainer: 'hallorans-spire', round: 1 }),
      f({ kind: 'battle', trainer: 'hallorans-spire', round: 2 }),
      f({ kind: 'battle', trainer: 'hallorans-spire', round: 3 }),
    ]),
    dossier: f({
      title: 'Relay Spire: Ada & Ivo Halloran',
      tacticTag: 'three rounds, no repeats: one carry will not do',
      text: 'Round 1 (Ivo): Skirl Lv33, Gillwick Lv34. Round 2 (Ada): Rimeplate Lv34, Sedgehare Lv35. Round 3 (both): Duskowl Lv35, Coilcrest Lv36 (holds a Whetstone). Two Tonics across the three rounds. Bench EXP has been on since your first route; your sitters are readier than you think. "Unless you have run out of nobodies." -I.H.',
    }),
    badge: f({ id: 'relay', name: 'Relay Seal', seal: 'two jackdaw feathers crossed in red wax' }),
    prize: f({ buttons: 7200, starsalt: 3 }),
    share: SHARE,
    unlocks: f([
      f({ kind: 'key-item', item: 'weatherglass', text: 'The Weatherglass: isle weather and Errants on the map.' }),
      f({ kind: 'commons-project', id: 'training-yard-green', text: 'The Training Yard on the green can be built as a Commons project.' }),
    ]),
  }),
  f({
    id: 'mirror', n: 6, name: 'Mirror Spire', isle: 'rimeholt', map: 'spire-mirror', waystone: 'frostwick', curveLevel: 40,
    leader: 'seraphine', trainer: 'seraphine-spire', ace: f({ species: 'lumenveil', level: 43 }),
    theme: f({
      kind: 'mirror', name: 'Evasion, Mends, true odds',
      text: 'Seraphine stacks evasion and heals. Evasion caps at +2, so there are never more than two Afterimage decoys, each drawn. Every creature has three Mends, shown as pips. The move menu shows the true hit odds. Her Lumenveil wears Mirrorveil: status moves aimed at it fail, except Plumbline, which this Spire awards.',
      rule: f({ evasionCap: 2, decoysMax: 2, mendsPerBattle: 3, showTrueOdds: true, gallery: f({ npc: 'idris', script: 'idris-gallery' }) }),
    }),
    order: f([
      f({ kind: 'door', text: 'MIRROR SPIRE. Seraphine Locke. Two decoys at most. Three Mends each. True odds on every move.' }),
      f({ kind: 'scene', script: 'idris-gallery', text: 'Idris watches from the gallery.' }),
      f({ kind: 'battle', trainer: 'seraphine-spire' }),
    ]),
    dossier: f({
      title: 'Mirror Spire: Seraphine Locke',
      tacticTag: 'evasion to +2, three Mends each, Mirrorveil ace',
      text: 'Rushling Lv40 (Tidal Mend, Root Knot). Floeback Lv41 (Rime Lock). Skeinwing Lv42 (Mirror Step). Lumenveil Lv43 (Glass, WARD: Mirrorveil; holds a Ballast Stone). A Full Salve and a Tonic. Sure-hit moves (Sure Pinch, Plumbline) never miss, whatever the evasion. "Count first. Then swing." -S.L.',
    }),
    badge: f({ id: 'mirror', name: 'Mirror Seal', seal: 'a fox paw in frosted white wax' }),
    prize: f({ buttons: 8600, starsalt: 3 }),
    share: SHARE,
    unlocks: f([
      f({ kind: 'disc', item: 'disc-plumbline', text: 'The Plumbline disc: always hits, through every Ward and Mirrorveil; clears stat stages and blocks re-boosting for 2 turns.' }),
      f({ kind: 'gate', id: 'summit', npc: 'hollis', script: 'summit-gate', text: 'Six badges: Hollis opens the Summit gate.' }),
    ]),
  }),
]);

// --- the Long Road ------------------------------------------------------------------------------

export const LONG_ROAD = f({
  id: 'long-road', name: 'The Long Road', map: 'the-bar', region: 'the-bar', curveLevel: 41, levels: f([40, 44]),
  keeper: 'hollis', waystone: 'hollis-gate',
  access: f({
    beforeRelighting: f({ tide: 'lower-low', windowMinutes: 90, text: 'Dry for an hour and a half either side of the day\'s lower low.' }),
    afterRelighting: f({ flag: 'lit.bar', tide: 'any', text: 'The lit Bar: walkable at any tide.' }),
  }),
  text: 'Hollis Brandt\'s six on the drowned tide-road from the point to Shardcrown, among the ribs of the lost fleet. Wick waits halfway with the flame. No Waystone until Hollis\'s Gate, so the HUD shows total team PP and the supplies you carry; Hollis hands you the Ration Ledger the first time you set foot on the Bar.',
  hud: f({ teamPp: true, supplies: true }),
  ledger: 'ration-ledger',
  order: f([
    f({ step: 1, trainer: 'bar-corwen' }),
    f({ step: 2, trainer: 'bar-tilda' }),
    f({ step: 3, trainer: 'bar-ezra' }),
    f({ step: 4, trainer: 'wick-long-road', story: true, text: 'Wick, halfway, with the flame.' }),
    f({ step: 5, trainer: 'bar-ottilie' }),
    f({ step: 6, trainer: 'bar-hamish' }),
    f({ step: 7, trainer: 'bar-delphine' }),
    f({ step: 8, trainer: 'linnet-gate', story: true, cond: f({ badge: 6 }), text: 'Linnet at the Shardcrown gate, after badge 6. The Gnash disc, win or lose.' }),
  ]),
  gate: f({ badges: 6, npc: 'hollis', script: 'summit-gate', text: 'Six badges open Hollis\'s Gate.' }),
});

// --- the Summit and its Bell --------------------------------------------------------------------

export const SUMMIT = f({
  id: 'summit', name: 'The Summit at Shardcrown', region: 'shardcrown', curveLevel: 47,
  gate: f({ badges: 6, waystone: 'hollis-gate', npc: 'hollis', script: 'summit-gate' }),
  order: f([
    f({ step: 1, trainer: 'bastien-keeper', map: 'keepers-hall' }),
    f({ step: 2, trainer: 'cass-keeper', map: 'keepers-hall' }),
    f({ step: 3, trainer: 'idris-champion', map: 'idris-hall' }),
  ]),
  between: f({ heal: false, revive: false, ppTopUp: 5, text: 'No Waystone between fights: HP and fainted creatures stay as they are; every move regains 5 PP.' }),
  items: 'all',
  healCap: 2,
  losses: f({ buttons: 0, blackout: false, text: 'Summit losses cost nothing.' }),
  dossier: f({
    where: 'the Summit gate and the Commons board',
    text: 'Every Keeper\'s and the Champion\'s full roster, abilities, heal pips and tactic tags are posted at Hollis\'s Gate. Teams never change between attempts.',
  }),
  champion: f({ trainer: 'idris-champion', buttons: 10000, seal: 'summit', script: 'idris-anchor-release', flag: 'sp.idris-beaten',
    text: 'Beating Idris: the anchor-release scene (silence is an answer), the Summit seal on the Seed Card, 10,000.' }),
});

export const SUMMIT_BELL = f({
  id: 'summit-bell', script: 'summit-bell', dials: f(['drift', 'flux']),
  restartAt: 'who-beat-you',
  snapshot: 'party-as-that-fight-began',
  refills: false,
  declinable: true,
  declineRestartsAt: 'bastien-keeper',
  freefall: 'full-restart',
  text: 'After a Summit loss on Drift or Flux the Bell holds your place: the next attempt starts at whoever beat you, with your party exactly as it stood when that fight began. It refills nothing. You can always decline it and start again from the first Keeper. On Freefall every loss restarts the climb. The Bell remembers a challenger once; Idris says so.',
});

// --- the Reading --------------------------------------------------------------------------------

const aspect = (name, palette, typeQueue, extra = {}) => f({ name, palette, typeQueue: f(typeQueue), ...extra });
const cards = (up, side, down) => f({ odds: 'dial', cards: f([f({ dir: 'up', ...up }), f({ dir: 'side', ...side }), f({ dir: 'down', ...down })]) });

/**
 * The Reading (GDD-00 §11): seven phases of two turns on the Lantern Stack, Relighting night. One
 * 96x96 Vagary whose palette and Unfixed type queue change per phase; each phase posts the next
 * phase's Forecast at the end of its first turn and it lands at the end of its second. It cannot be
 * lost: your creatures never fall below 1 HP and its bar never empties; nothing is spent but PP.
 * On the seventh its Forecast is offered to you: Anchor (Merrow's way) or Reroll (Varga's way) are
 * free here and each keeps the night going one more phase; only Accept ends it. Phase 1-6 echo the
 * six Spires' lessons in order; the seventh is yours.
 */
export const THE_READING = f({
  id: 'the-reading', name: 'The Reading', script: 'the-reading', map: 'lantern-stack', species: 'vagary',
  level: f({ scale: 'party-max', offset: 2, min: 30, max: 60 }),
  phaseTurns: 2,
  postAtTurn: 1,
  oddsNote: 'Card odds are the dial\'s, and the Relighting has already steadied them (lit.steadied).',
  stream: 'reading:<phase>:<draw>',
  rules: f({
    canLose: false, playerHpFloor: 1, foeHpFloor: 1, blackout: false, buttons: 0,
    run: false, lantern: false, items: true, read: 'free', scrap: true,
    ai: 'wild', mends: 3,
  }),
  endsOn: 'accept',
  shoreParty: f(['corin', 'wick', 'linnet', 'merrow', 'varga', 'idris']),
  arrival: aspect('Comet-fall', 'comet', ['Star', 'Brine', 'Kiln', 'Moss']),
  phases: f([
    f({
      n: 1, name: 'The Turn', lesson: 'turn',
      text: 'It lands on the stack and its mark is already glowing. The first Forecast posts before you can blink: three cards, odds on each.',
      moves: f(['tailfall', 'starfall', 'riptide', 'kiln-maw']),
      rule: f({}),
      voice: f({ npc: 'corin', line: 'Read it to me. Every card. I cannot see one that size.' }),
      next: cards(
        { aspect: aspect('Lattice', 'glass', ['Star', 'Glass', 'Stone', 'Rime']) },
        { aspect: aspect('Cairn', 'stone', ['Star', 'Stone', 'Glass', 'Grit']) },
        { aspect: aspect('Hoar', 'frost', ['Star', 'Rime', 'Glass', 'Brine']) },
      ),
    }),
    f({
      n: 2, name: 'The Ward', lesson: 'ward',
      text: 'A lattice shimmers over the whole body. Hits under 50 power do nothing this phase. The readout lists what still lands.',
      moves: f(['tailfall', 'shardlight', 'hoarfrost', 'starfall']),
      rule: f({ ward: f({ kind: 'min-power', minPower: 50 }) }),
      voice: f({ npc: 'merrow', line: 'Granite and glass. We cut our stones to look like that. I never knew why.' }),
      next: cards(
        { aspect: aspect('Steam-crown', 'ember', ['Star', 'Kiln', 'Brine', 'Glass'], { weather: 'steam' }) },
        { aspect: aspect('Ash-veil', 'stone', ['Star', 'Stone', 'Kiln', 'Grit'], { weather: 'ash' }) },
        { aspect: aspect('Squall-tail', 'gale', ['Star', 'Gust', 'Bolt', 'Brine'], { weather: 'squall' }) },
      ),
    }),
    f({
      n: 3, name: 'The Weather', lesson: 'weather',
      text: 'The sky above the stack turns to match whichever card landed, for this phase only.',
      moves: f(['tailfall', 'kiln-maw', 'bandlight', 'riptide']),
      rule: f({ weatherFromAspect: true }),
      voice: f({ npc: 'wick', line: 'Keeper, the clouds are doing it too! Is the whole sky Shifting?' }),
      next: cards(
        { aspect: aspect('Drowned Bell', 'dusk', ['Star', 'Hollow', 'Brine', 'Rust']) },
        { aspect: aspect('Wreck-light', 'dusk', ['Star', 'Hollow', 'Glass', 'Stone']) },
        { aspect: aspect('Empty Weave', 'dusk', ['Star', 'Hollow', 'Gust', 'Moss']) },
      ),
    }),
    f({
      n: 4, name: 'The Hollow', lesson: 'hollow',
      text: 'Every aspect this phase carries Hollow. Plain and Grit go straight through it; the menu says "No effect" before you pick.',
      moves: f(['tailfall', 'echo-drain', 'starfall', 'hoarfrost']),
      rule: f({}),
      voice: f({ npc: 'idris', line: 'My first partner went like that. Hollow, then gone. It is still here. It is still here.' }),
      next: cards(
        { aspect: aspect('Windle', 'gale', ['Star', 'Gust', 'Bolt', 'Moss']) },
        { aspect: aspect('Mill-race', 'tide', ['Star', 'Brine', 'Moss', 'Gust']) },
        { aspect: aspect('Sheepfold', 'moss', ['Star', 'Moss', 'Grit', 'Stone']) },
      ),
    }),
    f({
      n: 5, name: 'The Relay', lesson: 'relay',
      text: 'No repeats: the creature that ended the last phase must sit this one out. Someone else reads.',
      moves: f(['tailfall', 'bandlight', 'riptide', 'shardlight']),
      rule: f({ noRepeatLead: true }),
      voice: f({ npc: 'linnet', line: 'Swap. Go on. Nobody carries this one. I learned that the hard way.' }),
      next: cards(
        { aspect: aspect('Lumen', 'glass', ['Star', 'Glass', 'Rime', 'Brine']) },
        { aspect: aspect('Vesper', 'tide', ['Star', 'Brine', 'Glass', 'Hollow']) },
        { aspect: aspect('Rime-mirror', 'frost', ['Star', 'Rime', 'Glass', 'Gust']) },
      ),
    }),
    f({
      n: 6, name: 'The Mirror', lesson: 'mirror',
      text: 'Two decoys flicker beside it (evasion +2, the cap). It has three Mends and the menu shows the true odds. Plumbline goes through all of it.',
      moves: f(['tailfall', 'echo-drain', 'shardlight', 'starfall']),
      rule: f({ evasion: 2, decoys: 2, showTrueOdds: true }),
      voice: f({ npc: 'varga', line: 'Look at it. Every shape at once. And you want to pick ONE?' }),
      next: cards(
        { aspect: aspect('Lamplit', 'comet', ['Star', 'Glass', 'Kiln', 'Brine']) },
        { aspect: aspect('Harbor', 'tide', ['Star', 'Brine', 'Stone', 'Moss']) },
        { aspect: aspect('Dark Water', 'dusk', ['Star', 'Hollow', 'Brine', 'Rime']) },
      ),
    }),
    f({
      n: 7, name: 'The Reading', lesson: 'yours',
      text: 'Its mark turns toward the lamp. This time the Forecast is offered to you.',
      moves: f(['tailfall', 'starfall', 'riptide', 'shardlight']),
      rule: f({ offerToPlayer: true }),
      voice: f({ npc: 'corin', line: 'I cannot read one that size. You can.' }),
      offer: f({
        accept: f({ ends: true, text: 'Accept: let it land. The Heartshard steadies; its hum settles into a tide.', flag: 'sp.reading-done', stamp: 'the-reading' }),
        anchor: f({ free: true, addsPhase: true, voice: 'merrow', text: 'Anchor (the Mooring\'s way): refuse this window. Free tonight. The night goes on one more phase.',
          line: 'Hold it. Hold it still. ...It is still. Is that what I wanted?' }),
        reroll: f({ free: true, addsPhase: true, voice: 'varga', text: 'Reroll (the Scatter\'s way): redraw the cards. Free tonight. The night goes on one more phase.',
          line: 'Again! Again. ...Every one of them is beautiful. That is the trouble.' }),
      }),
      next: cards(
        { aspect: aspect('Ring of the Light', 'comet', ['Star', 'Glass', 'Kiln', 'Brine'], { settles: true }) },
        { aspect: aspect('Ring of the Tide', 'tide', ['Star', 'Brine', 'Stone', 'Moss'], { settles: true }) },
        { aspect: aspect('Ring of the Dark Water', 'dusk', ['Star', 'Hollow', 'Brine', 'Rime'], { settles: true }) },
      ),
      rerollPool: f([
        aspect('Ring of the Light', 'comet', ['Star', 'Glass', 'Kiln', 'Brine'], { settles: true }),
        aspect('Ring of the Tide', 'tide', ['Star', 'Brine', 'Stone', 'Moss'], { settles: true }),
        aspect('Ring of the Dark Water', 'dusk', ['Star', 'Hollow', 'Brine', 'Rime'], { settles: true }),
        aspect('Ring of the Ember', 'ember', ['Star', 'Kiln', 'Stone', 'Glass'], { settles: true }),
        aspect('Ring of the Reeds', 'moss', ['Star', 'Moss', 'Brine', 'Gust'], { settles: true }),
        aspect('Ring of the Gale', 'gale', ['Star', 'Gust', 'Bolt', 'Rime'], { settles: true }),
      ]),
    }),
  ]),
  settle: f({ text: 'Whichever ring lands is the shape it keeps: the post-game Passenger perches on the Lantern Stack in that palette.', perch: 'passenger-perch' }),
});

/** Spires keyed by id (badge order). */
export const SPIRE_BY_ID = f(Object.fromEntries(SPIRES.map((s) => [s.id, s])));

export default SPIRES;
