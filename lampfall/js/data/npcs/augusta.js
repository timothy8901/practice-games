/**
 * Augusta Skerry, grey seal, Harbor Warden ("Warden" means her and nobody else). [DATA-CAST] GDD-06.
 *
 * Keeps the Commons board on the green (06:00–12:00): weather odds, cracks seen, thread beats, the
 * Porch Duel slate, Spire dossiers and, from badge 5, Errant sightings. Counts the porches every
 * evening. Was Warden thirty years ago too, and posted three in ten for a gale Isolde called at
 * eight. Dry, numerate, gruff; says every chance as "n in 10". Porch Duels with her Bilgebob.
 * @module data/npcs/augusta
 */

import {
  P, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tier, tierRange, badges, topic, mem, duelScript, duelTopic,
} from './_helpers.js';

const ID = 'augusta';

/** Next-Spire advice by badges held (the dossier talk). */
const DOSSIER = [
  'Turn Spire, Lowmoor. Maud\'s two both Shift mid-fight and she posts the odds a turn ahead. Plan a move for every card, not the one you fancy. Seven in 10 of challengers plan for one card. Seven in 10 lose.',
  'Ward Spire, Cairnhold. Osric\'s stones wear Wards: watch for the shimmer, read the badge, and carry Crackdust. Pell\'s has it under three hundred. The clinic too.',
  'Weather Spire, Emberstep. Ines posts three turns of weather on a board by the door. Steam, ash, squall. Read the board before you read her.',
  'Hollow Spire, Drownwood. Wendel fields Hollow only. Plain and Grit go straight through. Bring Kiln, bring Glass, bring a cushion for the boat ride.',
  'Relay Spire, Thistlewind. The twins want every creature you have to fight once. No repeats. If your bench is asleep, wake it up now. Nine in 10 of one-carry teams don\'t get past round two.',
  'Mirror Spire, Rimeholt. Seraphine stacks Afterimages and Mends. The Plumbline cuts through all of it, but she holds the Plumbline. Patience, then. Count her Mends.',
];

export const scripts = {
  'talk-augusta-first': [
    '* A grey seal in a peaked Warden\'s cap is chalking a number on the Commons board. She finishes the number before she turns round.',
    'Augusta: Augusta Skerry. Harbor Warden. ~ That\'s the only Warden in this harbor, before anybody gets ideas.',
    'Augusta: The board\'s mine. Weather odds, cracks seen, who\'s on a porch tonight, which Spire wants what. Read it every morning. Six in 10 people don\'t, and four in 10 of those get rained on.',
    { op: 'end' },
  ],

  'talk-augusta-odds': [
    { op: 'if', cond: { weather: ['rain'] },
      then: ['Augusta: Raining. I had it at six in 10 yesterday. Ansel\'s barometer had it at seven. ~ Ansel\'s barometer is getting cocky.'] },
    { op: 'if', cond: { weather: ['fog'] },
      then: ['Augusta: Fog. Silver schools come into the quay in fog. Three in 10 of a good catch by the evening tide. Better odds than most things.'] },
    { op: 'if', cond: { weather: ['storm'] },
      then: ['Augusta: Storm. Lightning on the sea means an Errant somewhere. Don\'t go chasing it in a boat. You haven\'t got a boat. Good.'] },
    { op: 'if', cond: { weather: ['clear', 'overcast'] },
      then: ['Augusta: Dry today. I\'d still not trust the evening. I never trust the evening. Thirty years and it\'s never given me a reason to.'] },
    'Augusta: Odds are odds. You read them, then you decide. That\'s all a Warden\'s for. ~ That\'s all anybody\'s for, some days.',
    { op: 'end' },
  ],

  'talk-augusta-dossier': [
    { op: 'if', cond: badges(0), then: [`Augusta: ${DOSSIER[0]}`] },
    { op: 'if', cond: badges(1), then: [`Augusta: ${DOSSIER[1]}`] },
    { op: 'if', cond: badges(2), then: [`Augusta: ${DOSSIER[2]}`] },
    { op: 'if', cond: badges(3), then: [`Augusta: ${DOSSIER[3]}`] },
    { op: 'if', cond: badges(4), then: [`Augusta: ${DOSSIER[4]}`] },
    { op: 'if', cond: badges(5), then: [`Augusta: ${DOSSIER[5]}`] },
    'Augusta: The full dossier\'s nailed to the Spire door and pinned on the board. I just say it out loud for people who don\'t read. Which is most people.',
    { op: 'end' },
  ],

  'talk-augusta-errants': [
    'Augusta: Five badges. Then you\'ll want this. ~ From today the board lists Errant sightings. Lightning on the sea, which isle, which hour.',
    'Augusta: Squallcoil moves one route every hour. Hailcoil sits in the cold and sulks. Both come back the day after you\'ve dealt with them. Like weather. Like Tully.',
    { op: 'end' },
  ],

  'talk-augusta-storm-odds': [
    'Augusta: You read the letter Isolde sent me. The gale.',
    'Augusta: I posted three in 10 on this board. She came down from the point and said eight. To my face. In front of the fleet.',
    'Augusta: I was right about the barometer and wrong about the night. ~ I kept her lantern thirty years. I never once lit it. Didn\'t feel like it was mine to light.',
    { op: 'choice', options: [
      { text: 'You read what you had.', then: [
        ...mem(ID, 'gale', 'read-what-you-had'),
        'Augusta: ...That\'s what Ansel says about his report. ~ Maybe that\'s what all of us say. Maybe it\'s even true.',
      ] },
      { text: 'Three in 10 still happens three times in 10.', then: [
        ...mem(ID, 'gale', 'three-in-ten'),
        'Augusta: Hah. ~ Yes. It does. Nobody remembers the seven nights it didn\'t.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-augusta-nine-nights': [
    'Augusta: Oil for nine nights. ~ I remember the notice going up. I pinned it myself, on this board, with the same rusty tack.',
    'Augusta: Everybody read it. Nobody did anything. We all thought somebody else would. ~ That\'s the oldest odds in the world, that.',
    { op: 'end' },
  ],

  'talk-augusta-quarry': [
    'Augusta: The Penhallows wrote thanking me for a warning that came too late. ~ Thanking me. For being late.',
    'Augusta: Osric still says it to my face whenever I\'m on Cairnhold. "Thanks for the warning, Warden." He means it kindly. That\'s the worst part.',
    { op: 'end' },
  ],

  'talk-augusta-soundings': [
    'Augusta: The bar soundings. ~ They were on this board for a year. A year! Shoaling by the month, in numbers anybody could read.',
    'Augusta: Numbers don\'t frighten people. Pictures do. Isolde drew a picture. We should\'ve looked at the picture.',
    { op: 'end' },
  ],

  'talk-augusta-relit': [
    'Augusta: I counted the porches last night with the beam going over. ~ Every one pulsed when it passed. I lost count. First time in thirty years.',
    'Augusta: I lit her lantern on my step. Isolde\'s. The one she lent me. ~ It felt like mine to light, finally.',
    { op: 'end' },
  ],

  'talk-augusta-heart-1': [
    'Augusta: People ask why a seal is Warden. ~ Because I can swim out to the bar and back before the tide turns. Because I know what the water does when nobody\'s watching.',
    'Augusta: And because nobody else wanted the cap. ~ That\'s usually how it goes.',
    { op: 'end' },
  ],

  'talk-augusta-duel': duelScript(ID, 'porch-augusta', {
    ask: 'Augusta: Duel on the Warden\'s porch. Friendly. I\'d give you six in 10. My Bilgebob would give you four. He\'s an optimist about himself.',
    yes: 'Augusta: Bilgebob. Off the step. ~ Don\'t splash the board, please.',
    no: 'Augusta: Sensible. I\'ll chalk it as "declined, no odds given".',
  }),
};

export default {
  id: ID,
  name: 'Augusta Skerry',
  species: 'grey seal',
  sprite: 'augusta',
  portrait: 'augusta',
  group: 'resident',
  role: 'Harbor Warden: the Commons board (06:00–12:00), weather odds, the porch count, Spire dossiers, Errant sightings from badge 5. Porch Duels with her Bilgebob.',
  home: P,
  homeSpot: spot(P, 'door-wardens-house', { pose: 'sleep' }),
  threadId: null,
  porch: porch('porch-wardens-house', 'augusta-wardens-step', { litAtStart: true, hours: [hm(20), hm(23)] }),
  festivals: {
    'lantern-market': spot(P, 'augusta-commons-board', { pose: 'stand', activity: 'posting the market odds' }),
    'mudlark-mile': spot(P, 'corin-dock', { pose: 'stand', activity: 'keeping time on the barometer\'s second hand' }),
    'long-night': spot(P, 'point-dawn', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'augusta-commons-board', { pose: 'stand' }),
  },
  schedule: [
    at(hm(6), P, 'augusta-commons-board', { pose: 'stand', activity: 'the Commons board' }),
    at(hm(12), P, 'augusta-wardens-step', { pose: 'sit', activity: 'lunch on the step' }),
    at(hm(14), P, 'mail-sack', { pose: 'stand', activity: 'the quay tide board' }),
    at(hm(14, 1), P, 'linnet-ferry-leaves', { pose: 'stand', weather: ['storm'], activity: 'watching the sea' }),
    at(hm(16), P, 'night-fishing', { pose: 'stand', activity: 'a swim off the slipway' }),
    at(hm(18), P, 'augusta-wardens-step', { pose: 'path', path: 'augusta-porch-count', activity: 'the porch count' }),
    at(hm(19, 30), P, 'augusta-wardens-step', { pose: 'sit' }),
    at(hm(23), P, 'door-wardens-house', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-augusta-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('odds', 'talk-augusta-odds', 3, { cond: { hour: [6, 12] }, repeatDays: 1 }),
    topic('dossier', 'talk-augusta-dossier', 4, { cond: { all: [{ not: { badge: 6 } }, { npc: { id: ID, talks: { gte: 2 } } }] }, repeatDays: 3 }),
    topic('errants', 'talk-augusta-errants', 6, { cond: { badge: 5 }, once: true }),
    topic('storm-odds', 'talk-augusta-storm-odds', 7, { cond: { flag: 'np.augusta.storm-odds' }, once: true }),
    topic('nine-nights', 'talk-augusta-nine-nights', 6, { cond: { any: [{ flag: 'np.augusta.nine-nights' }, { flag: 'np.augusta.nine-more-nights' }] }, once: true }),
    topic('quarry', 'talk-augusta-quarry', 6, { cond: { flag: 'np.augusta.quarry-thanks' }, once: true }),
    topic('soundings', 'talk-augusta-soundings', 5, { cond: { flag: 'np.augusta.soundings' }, once: true }),
    topic('relit', 'talk-augusta-relit', 8, { cond: { flag: 'sp.relighting' }, once: true }),
    duelTopic(ID),
    topic('heart-1', 'talk-augusta-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 6 } } }, once: true }),
  ],
  gifts: {
    love: ['herring', 'mackerel', 'pollack'],
    like: ['sand-eel', 'sea-bass', 'brass-tide-gauge', 'apple'],
    dislike: ['honeycomb', 'fig', 'tiger-moth'],
  },
  lines: {
    generic: [
      line('g1', 'Six in 10, rain by the evening tide. I\'ll stand by it. I\'ll stand by it from indoors.'),
      line('g2', 'Odds aren\'t promises. Nobody believes that until it rains on them.'),
      line('g3', 'I counted fourteen lit porches last night. Fourteen. When I was a pup it was forty. We\'ll get there.'),
      line('g4', 'Ansel chalks the barometer at dawn. Never says a word. Leaves a fish on the board sometimes. Small fish. Odd man.'),
      line('g5', 'Warden\'s a good job. You get a cap. Nobody listens to you. The cap\'s nice.'),
      line('g6', 'Every chance is a number if you look at it long enough. Even you. I\'d put you at seven in 10 for most things.'),
      line('g7', 'The Commons Jar\'s on the board. Folk put buttons in when nobody\'s looking. I look. I don\'t tell.'),
      line('g8', 'Don\'t argue with the tide table. The tide table\'s never lost an argument.'),
    ],
    known: pool([
      ['k1', 'Morning, Keeper. I\'ve chalked you a good one today. Don\'t waste it.'],
      ['k2', 'You read the board every day now. Eight in 10 days. I\'ve noticed. I notice everything. It\'s the cap.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Board\'s fresh. Odds, cracks, porch beats, duels. Read it and then don\'t ask me what it says.'],
      ['m2', 'Ansel\'s been and gone. Barometer\'s falling. Not much. Enough that I\'ll mention it to anyone with washing out.'],
      ['m3', 'Up with the board. Always am. The weather doesn\'t sleep in. Neither do I.'],
    ]),
    evening: evening([
      ['e1', 'Porch count\'s done. I\'ll tell you the number if you ask nicely. You didn\'t ask. Fine. It\'s a good number.'],
      ['e2', 'Evening tide\'s turning. I can smell it. Seals can. Don\'t make it weird.'],
    ]),
    night: night([
      ['n1', 'Late for a Warden. I sit up when the barometer\'s twitchy. It\'s twitchy.'],
      ['n2', 'Night\'s quiet. Nothing on the sea but the shoal and the stars. I like it. I\'d never say so on the board.'],
    ]),
    porch: [
      line('p1', 'Sit. The step\'s cold. Seals don\'t mind. You might.'),
      line('p2', 'From here I can see eleven porches. I count them twice. Once for the number. Once because I like it.'),
      line('p3', 'Thirty years I\'ve sat here and watched the point stay dark. You can see it from this step. That\'s on purpose. I put the step here.'),
    ],
    sleep: [
      line('s1', '* Augusta is asleep in the doorway with her cap tipped over her eyes. One flipper is still holding the chalk.'),
    ],
    weather: weather({
      rain: 'Rain. Told you. Well. I told the board.',
      fog: 'Fog. Silver schools come in on fog. Three in 10 of a good catch on the quay tonight.',
      storm: 'Storm. Stay off the causeways. The sea doesn\'t mind about odds when it\'s like this.',
    }),
    tide: lowTide([
      ['lt1', 'Low water. Sparkles on the flats, the Glint somewhere among them. Seven in 10 you\'ll find it. Go on, make me look good.'],
    ]),
    lit: relit([
      ['r1', 'The count\'s gone up three porches since the beam. I\'m posting it in red chalk. I\'ve never used red chalk.'],
      ['r2', 'Odds of fair weather are the same as ever. The odds of folk going out in it have doubled. Light does that.'],
    ]),
    unlit: dark([
      ['d1', 'Dark lamp. Fleet\'s gone, oil boat can\'t cross the bar. Odds of that changing? Depends on you, apparently.'],
    ]),
    lead: leads({
      plain: 'Plain creature. Even odds on everything. Restful.',
      grit: 'A Grit one. Six in 10 it\'s going to try and dig under the board. Eight in 10 now.',
      brine: 'Brine lead. Good. Proper harbor creature. Smells of home.',
      kiln: 'A Kiln one. Keep it off the chalk. The chalk melts. Don\'t ask how I know.',
      moss: 'Moss lead. Rain loves it. It loves rain. Ten in 10.',
      bolt: 'A Bolt creature. My whiskers are up. Storm odds just went up a point, I reckon.',
      rime: 'Rime lead. Cold front just walked past me. Literally.',
      gust: 'A Gust one. Don\'t let it near the board. I pin things for a reason.',
      stone: 'Stone creature. Steady. Seven in 10 it outlasts everything on the isles.',
      rust: 'A Rust creature. It\'s been at the tack on the board. That tack is thirty years old. Was.',
      glass: 'A Glass lead. Prismoths come to lit porches at night. That one came to you. Odds are it knows something.',
      hollow: 'A Hollow creature. I couldn\'t put odds on that. Nobody can. That\'s rather the point of them.',
    }),
    shift: shift([
      ['sh1', 'It Shifted. You read it first? Good. A read Shift is a Shift survived. ~ Somebody wise said that. Not me. I\'d have said six in 10.'],
    ]),
    loan: pool([
      ['l1', 'Your porch isn\'t on the count yet. One loan. Then you\'re a number on my board.', tier(1)],
      ['l2', 'Your porch is on my count. Number eight. ~ Don\'t let it go to your head.', tierRange(2, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'No badges. The isles aren\'t going anywhere. The tide is, twice a day. Mind that.', badges(0)],
      ['b1', 'Three badges. I\'ve moved you up on the board. Nobody else can see the board I\'ve moved you up on. It\'s in my head.', badges(3)],
      ['b2', 'Six badges. Hollis\'s gate will open for you. Odds of the Summit going easy? Two in 10. Odds of you going anyway? Ten.', { badge: 6 }],
    ], ['generic']),
    gift: gifted({
      herring: 'That herring you brought. I ate it on the slipway with my eyes shut. Best four seconds of the week.',
      honeycomb: 'You brought a seal honeycomb. ~ I appreciate the thought. I\'ve given it to Ansel. He looked at it for an hour.',
    }),
  },
};
