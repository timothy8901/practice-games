/**
 * Wick Dorrow, puffling, the cliff-stair burrow. [DATA-CAST] GDD-06.
 *
 * Calls you Keeper. Carries his Rillfin everywhere in a bucket, later his Gillwick in a water pack
 * he built himself (arc *The Water Pack*); carries the flame up the lighthouse stair with you; will
 * be the next reader. Breathless, brave in bursts, earnest, very proud of his arms. Up and down the
 * cliff stair all day, on the quay watching Maud, at your gate every dusk, in bed by half past nine
 * except on market night. Porch Duels on your porch.
 *
 * Merge notes: keeps the integrated build's `errands` topic (story script `wick-errands`), its porch
 * id `porch-dorrow`, and his Lowmoor outings at `wick-lowmoor` (Tuesdays and Fridays on Maud's punt).
 * @module data/npcs/wick
 */

import {
  P, TUE, FRI, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tier, tierRange, badges, topic, mem, duelScript, duelTopic,
} from './_helpers.js';

const ID = 'wick';

export const scripts = {
  'talk-wick-first': [
    { op: 'if', cond: { seen: 'wick-keeper' },
      then: [
        'Wick: KEEPER! ~ Sorry. Mum says I shout. I don\'t shout. I project.',
        'Wick: I didn\'t do the proper bit before. On the stair. Bottom of the cliff stair, the door with the kettle painted on. That\'s us. ~ And this is Rillfin. He\'s in the bucket. He\'s always in the bucket.',
      ],
      else: [
        '* A puffling with a bucket comes down the cliff stair two steps at a time, then three, then nearly all of them.',
        'Wick: I\'m Wick. Wick Dorrow. Bottom of the cliff stair. The door with the kettle painted on. ~ This is Rillfin. He\'s in the bucket. He\'s always in the bucket.',
      ] },
    'Wick: If you need anything carried, I\'ll carry it. My arms are very strong. Feel. ~ No, feel.',
    { op: 'end' },
  ],

  'talk-wick-whale': [
    'Wick: Hesper brought Gran\'s letter! From the old keeper! About Gran\'s Bilgebob towing the oil boat off the bar TWICE.',
    'Wick: "A civic institution." That\'s what she called him. Gran\'s had it framed. Well. Mum framed it. Gran cried on it first.',
    'Wick: And there\'s a bit about a whale. ~ The light\'s on because of a whale. I knew it. I KNEW there was a whale.',
    { op: 'end' },
  ],

  'talk-wick-no-whale': [
    'Wick: There\'s no whale. ~ The keeper wrote to say. It was to Mum. Mum was the small Dorrow. She asked if the whale was all right, when she was little like me.',
    'Wick: "The light is on so everyone gets home. That\'s the whole job." ~ Grandad was on the Gannet. He didn\'t get home.',
    { op: 'choice', options: [
      { text: 'You can keep the whale, Wick.', then: [
        ...mem(ID, 'whale', 'kept'),
        'Wick: ...She said that too. "You can keep the whale." ~ I\'m keeping it. And the real reason. I can carry both. My arms are very strong.',
      ] },
      { text: 'The real reason is better.', then: [
        ...mem(ID, 'whale', 'real'),
        'Wick: Is it? ~ Yeah. Everybody gets home. That\'s better than a whale. Don\'t tell the whale.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-wick-slow-flame': [
    'Wick: The keeper\'s letter said you carry a flame up a stair slow. Slower than you want. Because the draught on the stair is the draught that blows it out.',
    'Wick: I\'ve been practising. With a candle. On the cliff stair. ~ I\'ve blown it out forty times. Forty-one. I\'m getting slower.',
    { op: 'end' },
  ],

  'talk-wick-long-road': [
    'Wick: Six badges! Then you\'re going on the Long Road. On the Bar. To the Summit.',
    'Wick: I\'ll be there. Halfway. Corin says it\'s the hardest road on the isles, and halfway is where people have to stop and look at you.',
    'Wick: Don\'t go easy. ~ Promise you won\'t go easy. If you go easy I\'ll know and I\'ll project about it.',
    { op: 'end' },
  ],

  'talk-wick-reader': [
    'Wick: Keeper? When you read a Shift. What does it look like? Not the cards. Before the cards.',
    { op: 'choice', options: [
      { text: 'Like the creature leaning. Just a bit.', then: [
        ...mem(ID, 'reading', 'leaning'),
        'Wick: Leaning. ~ Gillwick leans when he\'s thinking. I thought that was just him. Maybe I\'ve been reading him the whole time.',
      ] },
      { text: 'Like a tide about to turn.', then: [
        ...mem(ID, 'reading', 'tide'),
        'Wick: A tide about to turn. ~ I know what that looks like. Everybody on the cliff stair knows what that looks like.',
      ] },
    ] },
    'Wick: Corin says I\'ve got the eyes for it. He said it squinting. He says everything squinting.',
    { op: 'end' },
  ],

  'talk-wick-heart-1': [
    'Wick: Can I tell you a secret? ~ I\'m not brave. I just go before the scared bit catches up.',
    'Wick: Mum says that IS brave. Mum says that\'s the only kind there is. ~ I think she\'s making it up. I\'m going to believe her anyway.',
    { op: 'end' },
  ],

  'talk-wick-duel': duelScript(ID, 'porch-wick', {
    ask: 'Wick: Keeper! Porch duel! On YOUR porch! Friendly! Mum says friendly means nobody cries. I might cry. Happy crying.',
    yes: 'Wick: Here we go here we go here we GO.',
    no: 'Wick: Tomorrow, then. ~ I\'ll practise on the cliff stair. On a crab. The crab won\'t mind. The crab will mind.',
  }),
};

export default {
  id: ID,
  name: 'Wick Dorrow',
  species: 'puffling',
  sprite: 'wick',
  portrait: 'wick',
  group: 'resident',
  role: 'Calls you Keeper; carries Rillfin (later Gillwick in a water pack); carries the flame; the next reader. Trainer on Cairnhold and halfway along the Long Road; Porch Duels.',
  home: P,
  homeSpot: spot(P, 'door-dorrow', { pose: 'sleep' }),
  threadId: 'water-pack',
  porch: porch('porch-dorrow', 'porch-dorrow-step', { hours: [hm(20), hm(21, 30)] }),
  festivals: {
    'lantern-market': spot(P, 'weathervane-ansel', { pose: 'stand', activity: 'allowed up late for the market' }),
    'mudlark-mile': spot(P, 'wick-cliff-stair', { pose: 'stand', activity: 'cheering from the stair' }),
    'long-night': spot(P, 'lighthouse-door', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'weathervane-ansel', { pose: 'stand' }),
  },
  schedule: [
    at({ tide: 'low', offset: -60 }, P, 'glint-hint', { pose: 'wander', wanderR: 2, for: 120, cond: { hour: [13, 17] }, activity: 'racing the gulls across the flats' }),
    at(hm(7), P, 'wick-burrow', { pose: 'stand', activity: 'breakfast on the step' }),
    at(hm(8), P, 'wick-cliff-stair', { pose: 'path', path: 'wick-errand-run', activity: 'up and down the cliff stair' }),
    at(hm(10), P, 'linnet-ferry-leaves', { pose: 'stand', facing: 'down', activity: 'watching Maud\'s punt' }),
    at(hm(10, 1), 'lowmoor', 'wick-lowmoor', { pose: 'stand', days: [TUE, FRI], activity: 'riding Maud\'s punt to Lowmoor and back' }),
    at(hm(13), P, 'wick-cliff-stair', { pose: 'sit', activity: 'Rillfin\'s bucket on the stair' }),
    at(hm(17, 30), P, 'wick-errands', { pose: 'stand', facing: 'up', activity: 'waiting at the Keeper\'s gate' }),
    at(hm(20), P, 'wick-burrow', { pose: 'stand' }),
    at(hm(21, 30), P, 'door-dorrow', { pose: 'sleep' }),
  ],
  topics: [
    topic('errands', 'wick-errands', 11, { once: true, cond: { all: [{ flag: 'sp.dock-battle' }, { not: { flag: 'sp.errands-started' } }] } }),
    topic('first', 'talk-wick-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('whale', 'talk-wick-whale', 6, { cond: { flag: 'np.wick.whale' }, once: true }),
    topic('no-whale', 'talk-wick-no-whale', 7, { cond: { flag: 'np.wick.no-whale' }, once: true }),
    topic('slow-flame', 'talk-wick-slow-flame', 6, { cond: { flag: 'np.wick.slow-flame' }, once: true }),
    topic('long-road', 'talk-wick-long-road', 6, { cond: { badge: 6 }, once: true }),
    topic('reader', 'talk-wick-reader', 4, { cond: { all: [{ thread: { id: 'water-pack', beat: { gte: 2 } } }, { npc: { id: ID, talks: { gte: 6 } } }] }, once: true }),
    duelTopic(ID),
    topic('heart-1', 'talk-wick-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 5 } } }, once: true }),
  ],
  gifts: {
    love: ['sand-eel', 'glimmer-sprat', 'starfly'],
    like: ['stickleback', 'herring', 'cockle', 'sea-glass'],
    dislike: ['quince', 'anchor-stone', 'dor-beetle'],
  },
  lines: {
    generic: [
      line('g1', 'Keeper! ~ Nothing. I just like saying it.'),
      line('g2', 'Rillfin did a flip in the bucket this morning. A whole one. Mum says it was a slosh. It was a flip.'),
      line('g3', 'I can do the cliff stair in forty-one seconds. Up. Down is faster but you have to be braver.'),
      line('g4', 'Corin says a good reader looks before they swing. I look before I jump. Same thing. Mostly.'),
      line('g5', 'When I\'m big I\'m going to keep the light. Not instead of you. Next to you. There\'s room.'),
      line('g6', 'Do you need anything carried? Anything. I carried a whole crate of wicks for Juniper. She gave me a button. I\'m saving it.'),
      line('g7', 'Gran says I was born with my beak open. I say it\'s so the words can get out faster.'),
      line('g8', 'I know every step on the cliff stair by name. The wobbly one is called Gerald.'),
    ],
    known: pool([
      ['k1', 'Keeper! You came back! You always come back. I counted.'],
      ['k2', 'I waited at your gate yesterday. You were on an isle. That\'s fine. I waited anyway. It\'s good practice for waiting.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning, Keeper! Rillfin\'s had breakfast. I\'ve had half a breakfast. The other half is in my pocket for later.'],
      ['m2', 'Did the Thatch do your roof? I watched from the stair. They tied a knot with their FEET.'],
      ['m3', 'I\'ve done the stair four times already. Mum says I have too much in me. I say that\'s the right amount.'],
    ]),
    evening: evening([
      ['e1', 'Did you see the porches come on? Dusk\'s the best. Everything goes gold and then, pop, pop, pop.'],
      ['e2', 'I waited for you at the gate. Not long. A medium amount.'],
    ]),
    night: night([
      ['n1', '* Wick is supposed to be asleep. He is very obviously not asleep. "I\'m asleep," he whispers.'],
      ['n2', '* A small voice from behind the kettle door: "Keeper? Is that you? ~ Goodnight, Keeper." A pause. "Goodnight, Rillfin." Blub.'],
    ]),
    market: pool([
      ['mk1', 'Market night! I\'m allowed up! I\'m going to stay up till the stars go out. Or till nine. Whichever.'],
    ], ['night'], { any: [{ all: [{ hour: [20, 24] }, { day: { dow: [5] } }] }, { all: [{ hour: [0, 3] }, { day: { dow: [6] } }] }] }),
    porch: [
      line('p1', 'This is our step! Gran painted the kettle on the door. Mum says it\'s a whale. It\'s a kettle.'),
      line('p2', 'Sit, Keeper! I\'ll show you Rillfin\'s trick. ~ He hasn\'t got a trick. We\'re working on one.'),
    ],
    sleep: [
      line('s1', '* Wick is fast asleep in the doorway, one wing curled round the bucket. Something in the bucket goes blub, softly.'),
    ],
    weather: weather({
      rain: 'Rain! Rillfin loves rain. He puts his face up out of the bucket. I put my face up too. We\'re the same.',
      fog: 'Fog! I can\'t see the bottom of the stair. I did it anyway. Forty-four seconds. The fog cost me three.',
      storm: 'Storm. Mum says stay in. I\'m staying in. ~ I\'m on the step. The step is basically in.',
    }),
    tide: lowTide([
      ['lt1', 'Low tide! The flats! I\'m going to beat the gulls to the shiny bits. Don\'t tell the gulls.'],
    ]),
    lit: relit([
      ['r1', 'I carried it up the stair! I DIDN\'T DROP IT. ~ I tell everybody. I\'ve told the crabs.'],
      ['r2', 'Every eight seconds the light goes over our door. I wave at it. It doesn\'t wave back. It doesn\'t need to.'],
    ]),
    unlit: dark([
      ['d1', 'One day the light\'s going to come on and I\'m going to be there. I\'ve decided.'],
    ]),
    lead: leads({
      plain: 'A plain one! Plain\'s brave. It doesn\'t need tricks. Like me. I don\'t have tricks either.',
      grit: 'A Grit creature! Can I arm-wrestle it? My arms are very strong. ~ It\'s winning. Let go. LET GO.',
      brine: 'A Brine one! Rillfin likes it. He did a slosh at it. A friendly slosh.',
      kiln: 'A Kiln creature! It\'s WARM. Can I warm my feet? Rillfin says no. Rillfin\'s a fish.',
      moss: 'A Moss one! It smells like the top of the cliff where the thrift grows.',
      bolt: 'A Bolt creature! My feathers went fuzzy! Do it again! Do it AGAIN!',
      rime: 'A Rime creature! Rillfin\'s bucket\'s got ice on top. He\'s fine. He likes it. He told me.',
      gust: 'A Gust one! If it blew hard enough could I fly? Puffins fly. I\'m practising.',
      stone: 'A Stone creature! It\'s like a bit of the cliff walking about.',
      rust: 'A Rust creature! It\'s eating the bucket handle. RILLFIN\'S bucket. ~ It\'s a bit hungry. I\'ll get another handle.',
      glass: 'A Glass creature! It looks like the inside of the lamp! Like the bit that\'s going to shine!',
      hollow: 'A Hollow creature. It went through me. ~ I didn\'t feel it. I want to feel it. Can it do it again slower?',
    }),
    shift: shift([
      ['sh1', 'It SHIFTED. It\'s DIFFERENT. ~ Its mark\'s in the same place though. Look! Rillfin\'s will be too, when he goes. I\'ve checked where it is. I check every day.'],
    ]),
    loan: pool([
      ['l1', 'When your porch comes on I\'m going to call you Keeper properly. With a capital K. You\'ll hear the capital.', tier(1)],
      ['l2', 'Your porch is on! I can see it from our step. I say goodnight to it.', tierRange(2, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'Have you been to a Spire yet? What\'s a Spire like? Is it tall? Is it spiky? I bet it\'s spiky.', badges(0)],
      ['b1', 'Two badges! Now Rillfin\'s glowing a bit. Corin says that\'s his window. I don\'t know what it\'s a window to. I\'m scared and excited at the same time.', badges(2)],
      ['b2', 'Five badges! I\'ve got a badge too. I made it. It\'s cardboard. It says KEEPER\'S HELPER.', badges(5)],
    ], ['generic']),
    gift: gifted({
      'sand-eel': 'You gave me a sand eel! For me! Not for Rillfin! ~ I ate it in one go. It was the best thing I ever ate.',
      'glimmer-sprat': 'That glimmer sprat glowed all the way down. I could see it in my tummy. Mum says that\'s not true. I could.',
    }),
  },
};
