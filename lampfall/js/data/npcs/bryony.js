/**
 * Bryony, rock hyrax, the bean house by the green (renamed from Bramble). [DATA-CAST] GDD-06.
 *
 * Grows Lowmoor Sweets up a fence she and Tully have argued over for years; a Sedgehare lives in
 * her beans and nobody is catching it until the fence is low enough to talk over (lead thread *The
 * Fence*). Brisk, stubborn, practical, prickly on top and soft as compost underneath; owns the
 * loudest whistle in the harbor. Garden 07:00–12:00, the green on market days, the beans again at
 * dusk.
 * @module data/npcs/bryony
 */

import {
  P, TUE, THU, SAT, WED, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tierRange, badges, topic, mem,
} from './_helpers.js';

const ID = 'bryony';

export const scripts = {
  'talk-bryony-first': [
    // meet-neighbors meets one of Odile / Thessaly / Bryony per run; only that one already knows you
    { op: 'if', cond: { flag: 'np.bryony.met-step' },
      then: ['Bryony: You. The walker. You\'re standing on a bean. ~ No, you\'re fine. That one\'s a stone. I thought it was a bean.'],
      else: ['* A rock hyrax in an enormous straw hat glares up at you from between two rows of beans. Then she decides you can stay.'] },
    'Bryony: Bryony. Beans. Lowmoor Sweets, from Old Fen\'s seed, best on the coast. Don\'t step on them, don\'t pick them, don\'t let your creature eat them.',
    'Bryony: ~ You can admire them. Admiring\'s allowed.',
    { op: 'end' },
  ],

  'talk-bryony-sedgehare': [
    '* Something long-eared moves deep in the bean rows. A flick of green. Then nothing.',
    'Bryony: You saw it. ~ Don\'t. Don\'t you DARE raise that lantern.',
    'Bryony: It came the year the fence went up. Lives in the beans. Eats the slugs, leaves the pods. Best tenant I ever had.',
    'Bryony: Nobody catches it. Not you, not Linnet, not Corin with his glass. ~ If it wants to go somewhere, it\'ll go. When the fence is low enough to see over. Not before.',
    { op: 'end' },
  ],

  'talk-bryony-low-beans': [
    'Bryony: Old Fen\'s letter. ~ "Seed for a low fence." Thirty years late and he still knew what I\'d do wrong.',
    'Bryony: Beans don\'t need a high fence. They need something to climb and someone to talk to over the top. ~ I built it for the climbing. I forgot the talking.',
    { op: 'end' },
  ],

  'talk-bryony-fence-side': [
    { op: 'if', cond: { flag: 'th.the-fence.side', is: 'bryony' },
      then: ['Bryony: You took my side. ~ I\'ve given you the first pods of the season. Don\'t tell Tully. Tell Tully.'] },
    { op: 'if', cond: { flag: 'th.the-fence.side', is: 'tully' },
      then: ['Bryony: You took his side. ~ Fine. Fair, even. He\'s been running past that fence for ten years and never once trod on a bean. I checked.'] },
    { op: 'if', cond: { flag: 'th.the-fence.side', is: 'broker' },
      then: ['Bryony: You stood us both at the fence and made us shake. ~ He\'s got soft paws. Don\'t tell him I said.'] },
    'Bryony: Ambrose\'s posts are good posts. Low. We talk over them now. ~ Mostly I talk. He nods. He\'s learning.',
    { op: 'end' },
  ],

  'talk-bryony-chosen': [
    'Bryony: It went with you. ~ I saw. It sat in the gap in the beans and looked at me, and then it looked at you, and that was that.',
    'Bryony: Look after it. It likes the shade side. It hates being carried. ~ It\'ll let you, mind. It\'ll just make a face.',
    { op: 'end' },
  ],

  'talk-bryony-heart-1': [
    'Bryony: People think I\'m prickly. ~ I am prickly. Hyraxes are. We sit on the warm rock and shout at anyone who wants the warm rock.',
    'Bryony: But I\'ll share the rock. ~ Ask nicely. Bring a bean. I mean bring a bean back. Don\'t bring my own beans.',
    { op: 'end' },
  ],

  'talk-bryony-heart-2': [
    'Bryony: The beans don\'t care about the harbor. The fleet, the lamp, the letters. ~ I used to think that was the best thing about them.',
    { op: 'choice', options: [
      { text: 'And now?', then: [
        ...mem(ID, 'beans', 'and-now'),
        'Bryony: Now I think they\'re just waiting. Same as the rest of us. Climbing whatever\'s there until something better turns up. ~ You turned up.',
      ] },
      { text: 'It\'s still a good thing.', then: [
        ...mem(ID, 'beans', 'still-good'),
        'Bryony: Hm. ~ Yes. Somebody has to get on with it while everybody else is having feelings. That\'s me. And the beans.',
      ] },
    ] },
    { op: 'end' },
  ],
};

export default {
  id: ID,
  name: 'Bryony',
  species: 'rock hyrax',
  sprite: 'bryony',
  portrait: 'bryony',
  group: 'resident',
  role: 'Bean grower on the quay row; the fence she shares with Tully; the Sedgehare in her beans (lead thread The Fence).',
  home: P,
  homeSpot: spot(P, 'door-bryony', { pose: 'sleep' }),
  threadId: 'the-fence',
  porch: porch('porch-bryony', 'porch-bryony-step', { hours: [hm(20), hm(22, 30)] }),
  festivals: {
    'lantern-market': spot(P, 'first-orchard', { pose: 'stand', activity: 'selling beans off a crate' }),
    'mudlark-mile': spot(P, 'meet-bryony', { pose: 'stand', activity: 'whistling on an upturned bucket' }),
    'long-night': spot(P, 'relighting-crowd-2', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'meet-thessaly', { pose: 'stand' }),
  },
  schedule: [
    at(hm(7), P, 'bryony-beans', { pose: 'stand', activity: 'the beans' }),
    at(hm(7, 1), P, 'bryony-porch', { pose: 'sit', weather: ['storm'], activity: 'glaring at the storm from the step' }),
    at(hm(9), P, 'fence-bryony-tully', { pose: 'stand', days: [TUE, THU, SAT], activity: 'inspecting the fence' }),
    at(hm(10), P, 'bryony-beans', { pose: 'stand', days: [TUE, THU, SAT] }),
    at(hm(12), P, 'bryony-porch', { pose: 'sit', activity: 'lunch on the step' }),
    at(hm(14), P, 'market-stall-1', { pose: 'stand', days: [WED, SAT], activity: 'beans off a crate on the green' }),
    at(hm(17), P, 'bryony-beans', { pose: 'stand', activity: 'watering at dusk' }),
    at(hm(19), P, 'bryony-beans', { pose: 'sit', activity: 'sitting among the beans' }),
    at(hm(22, 30), P, 'door-bryony', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-bryony-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('sedgehare', 'talk-bryony-sedgehare', 5, { cond: { all: [{ npc: { id: ID, talks: { gte: 3 } } }, { not: { thread: { id: 'the-fence', done: true } } }] }, once: true }),
    topic('low-beans', 'talk-bryony-low-beans', 6, { cond: { flag: 'th.the-fence.low-beans' }, once: true }),
    topic('fence-side', 'talk-bryony-fence-side', 6, { cond: { flag: 'th.the-fence.side' }, once: true }),
    topic('chosen', 'talk-bryony-chosen', 8, { cond: { thread: { id: 'the-fence', done: true } }, once: true }),
    topic('heart-1', 'talk-bryony-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 5 } } }, once: true }),
    topic('heart-2', 'talk-bryony-heart-2', 2, { cond: { npc: { id: ID, talks: { gte: 11 } } }, once: true }),
  ],
  gifts: {
    love: ['fruit-seedling', 'honeycomb'],
    like: ['plum', 'pear', 'damselfly', 'cuttlebone', 'fossil-fern'],
    dislike: ['bush-cricket', 'sandhopper', 'red-gurnard'],
  },
  lines: {
    generic: [
      line('g1', 'Mind the beans.'),
      line('g2', 'A bean doesn\'t care who you are. It cares if you water it. Best kind of friend.'),
      line('g3', 'Tully ran past at six. Loudly. I\'ve told him the beans can hear. He\'s started tiptoeing. It\'s louder.'),
      line('g4', 'Old Fen gave my mother these seeds. She gave them to me. I\'ll give them to somebody who deserves them. Nobody yet.'),
      line('g5', 'I\'m not grumpy. I\'m a hyrax. We\'re born looking like this.'),
      line('g6', 'You want a bean? You can\'t have a bean. ~ Here. One bean. Don\'t tell anybody.'),
      line('g7', 'The Sedgehare\'s in there somewhere. Don\'t look for it. Looking\'s how it starts.'),
      line('g8', 'Slugs, gulls, Tully. That\'s my whole list of enemies. Two of them I\'ve made peace with.'),
    ],
    known: pool([
      ['k1', 'Oh. It\'s you. ~ Good. You don\'t step on things.'],
      ['k2', 'I saved you a pod. It\'s in my pocket. It\'s a bit warm. Still good.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning. Dew\'s on. Best time for beans and worst time for knees.'],
      ['m2', 'If you\'re going past Pell\'s, tell Juniper the Sweets are early. She\'ll make a fuss. I like the fuss.'],
      ['m3', 'Up before the sun. Beans don\'t wait. Neither do slugs.'],
    ]),
    evening: evening([
      ['e1', 'Watering. Don\'t talk to me while I\'m watering. ~ You can talk. I just won\'t listen till the can\'s empty.'],
      ['e2', 'Evening\'s when the beans grow. You can hear them if you sit still. Creak. Creak.'],
    ]),
    night: night([
      ['n1', 'Can\'t sleep. Thinking about the north row. It\'s leaning.'],
      ['n2', 'Night. The Sedgehare comes out to the edge of the rows about now. Sit still and you might see its ears.'],
    ]),
    porch: [
      line('p1', 'Sit. Not there, that\'s the pod basket. There.'),
      line('p2', 'You can see the whole bean patch from here. And the fence. And Tully\'s porch. I see a lot of Tully\'s porch.'),
    ],
    sleep: [
      line('s1', '* Bryony is asleep in the doorway with her hat over her face. Even asleep, she looks like she is guarding something.'),
    ],
    weather: weather({
      rain: 'Rain. Good. Free water. I\'m out in it. Beans like company.',
      fog: 'Fog. The slugs love fog. I hate fog. Fog loves slugs. It\'s a whole thing.',
      storm: 'Storm\'s at the beans. I\'ve tied them three times. If they go, they go. ~ They won\'t go.',
    }),
    tide: lowTide([
      ['lt1', 'Tide\'s out. Wrack on the flats. Good for the beds. Bring me a bucket of weed if you\'re passing. Don\'t bring me the crabs in it.'],
    ]),
    lit: relit([
      ['r1', 'The beam goes over the beans every eight seconds. They\'re confused. They think it\'s morning eleven thousand times a night.'],
    ]),
    unlit: dark([
      ['d1', 'Beans don\'t need a lighthouse. People do. That\'s the difference between beans and people. Beans are smarter.'],
    ]),
    lead: leads({
      plain: 'Plain creature. Good. Plain things leave beans alone.',
      grit: 'A Grit one. If it digs in my rows I\'ll dig in it.',
      brine: 'A Brine creature. Salt\'s bad for beans. Stand on the path, please. The PATH.',
      kiln: 'A Kiln creature. Too hot. Too hot! The leaves are curling. Back. Back.',
      moss: 'A Moss one. ~ Fine. It can stay. It\'s family. Don\'t let it eat the pods.',
      bolt: 'A Bolt creature. My hat\'s crackling. I don\'t like my hat crackling.',
      rime: 'A Rime creature. Frost on the beans in summer. I\'m going to need a minute.',
      gust: 'Gust lead. Hold it still. The canes are only tied with string.',
      stone: 'Stone creature. Heavy. Good for keeping the compost lid down.',
      rust: 'A Rust creature. It\'s chewing my trowel. ~ That trowel was my mother\'s.',
      glass: 'Glass creature. It catches the sun. The beans grow towards it. Traitors.',
      hollow: 'A Hollow creature. It walked through the rows and didn\'t bend a leaf. That\'s the only good thing I\'ll say about it.',
    }),
    shift: shift([
      ['sh1', 'It Shifted. ~ Beans do that too. Plant one kind, get a sport. You keep it anyway. It\'s still from your seed.'],
    ]),
    loan: pool([
      ['l1', 'Wren\'s built half the porches on this row. Her joints are tight. Not as tight as my rows, but tight.', tierRange(1, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'Spires. Fighting. Not my business. My business is beans.', badges(0)],
      ['b1', 'You\'ve got seals now. Five. Six? I don\'t count seals. I count pods.', { badge: 5 }],
    ], ['generic']),
    gift: gifted({
      'fruit-seedling': 'That seedling you gave me is in the corner bed. It\'s doing better than the beans. I\'m furious. I\'m delighted.',
      'bush-cricket': 'You brought me a bush cricket. In a BEAN PATCH. ~ I let it go on the far side of the harbor. Very far side.',
    }),
  },
};
