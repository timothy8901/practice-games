/**
 * Ambrose Hearthwright, old beaver, Wren's father. [DATA-CAST] GDD-06.
 *
 * Gnaws the notches, splits the stick with one THWAP, reads timber with his thumbs now that his
 * eyes have gone. Few words, all of them load-bearing. Yard bench 07:00–19:00, the timber stack on
 * Tuesdays and Thursdays, the co-op porch beside Wren in the evening. Carves a perch for your lead.
 * @module data/npcs/ambrose
 */

import {
  P, TUE, THU, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tier, tierRange, badges, topic, mem,
} from './_helpers.js';

const ID = 'ambrose';

export const scripts = {
  'talk-ambrose-first': [
    '* An old beaver sits on the yard bench with a cane across his knees. His spectacles are as thick as bottle ends.',
    'Ambrose: You\'re the walker. ~ Wren said. Come here. Closer. ~ Hm. Good boots. Bad laces.',
    'Ambrose: Ambrose. I gnaw the notches. She does the sums. Between us we\'re one decent builder.',
    { op: 'end' },
  ],

  'talk-ambrose-perch': [
    'Ambrose: That creature of yours. Bring it here.',
    '* He runs a thumb along a short length of alder, turns it, gnaws once, twice, and holds it out at the height of your lead\'s head.',
    'Ambrose: Perch. For your step. Something to sit on that\'s its own. ~ Every creature wants one thing in a house that\'s just theirs.',
    { op: 'choice', options: [
      { text: 'It\'s perfect. Thank you.', then: [
        ...mem(ID, 'perch', 'thanked'),
        'Ambrose: It\'s alder. It\'s fine. ~ It\'s good. Don\'t tell Wren I said good. She\'ll want it in writing.',
      ] },
      { text: 'It\'ll Shift one day. Will it still fit?', then: [
        ...mem(ID, 'perch', 'shift'),
        'Ambrose: Then I\'ll cut another. ~ You don\'t throw the house away because the family grew.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-ambrose-alder-floor': [
    'Ambrose: You read the letter. The floor. ~ Alder, I told her. Doesn\'t mind wet. Doesn\'t creak at two in the morning.',
    'Ambrose: She paced it. Every night that winter. I could hear it from the yard, in my head. ~ It never creaked once.',
    'Ambrose: Thirty years I\'ve wondered if it was my floor kept her up there too long. ~ Floors don\'t keep anybody. I know that. I know that.',
    { op: 'end' },
  ],

  'talk-ambrose-lamp-room': [
    '* Ambrose stands at the foot of the lighthouse stair with one hand flat on the wall.',
    'Ambrose: I walked it. Every board. Hand on the wall, all the way round. ~ She doesn\'t know I came up at four.',
    'Ambrose: It\'s better than mine. ~ Don\'t tell her yet. Let her be frightened one more night. It\'s good for the joints.',
    { op: 'end' },
  ],

  'talk-ambrose-relit': [
    'Ambrose: I can\'t see the beam. ~ I can feel it go over. The bench goes warm for a breath. Every eight seconds.',
    'Ambrose: Thirty years. ~ Hm. Good joints.',
    { op: 'end' },
  ],

  'talk-ambrose-thwap': [
    'Ambrose: You want to know how the THWAP works. Everybody does. ~ It\'s the tail. And the grain. You read where it wants to split, and you agree with it.',
    'Ambrose: Most things go easier if you agree with where they want to go. ~ Not Wren. Wren goes where she\'s pointed, and then a bit further.',
    { op: 'end' },
  ],

  'talk-ambrose-heart-1': [
    'Ambrose: My eyes went the year Wren started signing the drawings. ~ People say "what a shame". It\'s not a shame. It\'s a handover.',
    'Ambrose: I taught her to see. Now she sees for both of us. ~ I gnaw. That\'s plenty. That\'s a lot, at my age.',
    { op: 'end' },
  ],

  'talk-ambrose-heart-2': [
    'Ambrose: Can I ask you a thing? ~ Is she happy? Wren. When she\'s on the ladder. I can\'t see her face from down here.',
    { op: 'choice', options: [
      { text: 'She\'s smiling. She hides it in the clipboard.', then: [
        ...mem(ID, 'wren-happy', 'smiling'),
        'Ambrose: ...Clipboard. Her mother did that with a hymn book. ~ Thank you.',
      ] },
      { text: 'She counts everything. I think that\'s her happy.', then: [
        ...mem(ID, 'wren-happy', 'counting'),
        'Ambrose: Hah. ~ Yes. That\'s her happy. Three times over.',
      ] },
    ] },
    { op: 'end' },
  ],
};

export default {
  id: ID,
  name: 'Ambrose Hearthwright',
  species: 'old beaver',
  sprite: 'ambrose',
  portrait: 'ambrose',
  group: 'resident',
  role: 'Elder of the co-op: notches, THWAP, timber read by touch; walks the Lamp Room by hand; carves a perch for your lead.',
  home: P,
  homeSpot: spot(P, 'door-coop-yard', { pose: 'sleep' }),
  threadId: null,
  porch: porch('porch-coop-yard', 'wren-yard', { litAtStart: true, hours: [hm(19, 30), hm(22)] }),
  festivals: {
    'lantern-market': spot(P, 'commons-third-stall', { pose: 'sit', activity: 'sitting where he can hear the market' }),
    'long-night': spot(P, 'odile-easel', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'commons-third-stall', { pose: 'sit' }),
  },
  schedule: [
    at(hm(7), P, 'ambrose-bench', { pose: 'sit', activity: 'the yard bench' }),
    at(hm(7, 1), 'int-yard-shed', 'ambrose-workbench', { pose: 'stand', weather: ['rain', 'storm'], activity: 'the workbench, out of the wet' }),
    at(hm(10), P, 'ambrose-timber', { pose: 'stand', days: [TUE, THU], activity: 'reading the timber with his thumbs' }),
    at(hm(12), P, 'ambrose-bench', { pose: 'sit', days: [TUE, THU] }),
    at(hm(19), P, 'ambrose-bench', { pose: 'sit', activity: 'listening to the yard settle' }),
    at(hm(22), P, 'door-coop-yard', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-ambrose-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('perch', 'talk-ambrose-perch', 6, { cond: { all: [{ npc: { id: ID, talks: { gte: 2 } } }, { party: { size: { gte: 1 } } }] }, once: true }),
    topic('alder-floor', 'talk-ambrose-alder-floor', 7, { cond: { flag: 'np.ambrose.alder-floor' }, once: true }),
    topic('lamp-room', 'talk-ambrose-lamp-room', 8, { cond: { all: [{ flag: 'sp.lamp-room-built' }, { not: { flag: 'sp.relighting' } }] }, once: true }),
    topic('relit', 'talk-ambrose-relit', 8, { cond: { flag: 'sp.relighting' }, once: true }),
    topic('thwap', 'talk-ambrose-thwap', 3, { cond: { flag: 'sp.first-payment' }, once: true }),
    topic('heart-1', 'talk-ambrose-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 6 } } }, once: true }),
    topic('heart-2', 'talk-ambrose-heart-2', 2, { cond: { all: [{ npc: { id: ID, talks: { gte: 10 } } }, { loan: { tier: { gte: 4 } } }] }, once: true }),
  ],
  gifts: {
    love: ['timber', 'honeycomb'],
    like: ['apple', 'plum', 'fossil-fern', 'cuttlebone'],
    dislike: ['skyglass-shard', 'starsalt', 'sea-glass'],
  },
  lines: {
    generic: [
      line('g1', 'Alder. Notch it wide. ~ That\'s most of what I know. The rest is detail.'),
      line('g2', 'A good joint is one nobody notices. A bad one, everybody notices. Usually in the rain.'),
      line('g3', 'Wren says I shouldn\'t gnaw the bench. I\'m not gnawing it. I\'m reading it.'),
      line('g4', 'You can tell a tree\'s whole life from the grain. Wet years. Dry years. The year it got a fright.'),
      line('g5', 'Sit down. Standing makes the yard nervous.'),
      line('g6', 'I built half the roofs you can see from here. Can\'t see any of them. Doesn\'t matter. I know where they are.'),
      line('g7', 'People ask if I miss my eyes. I miss reading the paper. I don\'t miss reading the bills.'),
      line('g8', 'Hm. ~ That\'s a whole sentence, at my age. Wren can translate.'),
    ],
    known: pool([
      ['k1', 'You. ~ I know the walk. Bad laces.'],
      ['k2', 'Sit. Tell me what the harbor looks like today. Wren just says "fine". Fine isn\'t a colour.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning. I heard the Thatch go out at half five. Good crew. Loud crew.'],
      ['m2', 'Morning\'s for gnawing. The wood\'s still cool. Cool wood cuts honest.'],
      ['m3', 'Kettle\'s on inside. I can hear it thinking about boiling.'],
    ]),
    evening: evening([
      ['e1', 'Evening. The yard ticks when it cools. Like an old dog settling.'],
      ['e2', 'Wren\'s on the abacus. I can hear the beads. She\'s counting something twice again.'],
    ]),
    night: night([
      ['n1', 'Can\'t sleep. Old beavers don\'t. We just lie very still and think about rafters.'],
      ['n2', 'Night air\'s good for timber. Bad for knees.'],
    ]),
    porch: [
      line('p1', 'Sit with us. Wren talks. I listen. You can do either.'),
      line('p2', 'I can\'t see the porches come on. I hear people go quiet when they do. That\'s how I know.'),
      line('p3', 'Thirty years, this porch. Never once creaked. ~ Don\'t test it.'),
    ],
    sleep: [
      line('s1', '* Ambrose is asleep with his cane across his knees and one thumb still resting on the grain of the bench.'),
    ],
    weather: weather({
      rain: 'Rain. Good. The roofs get to show off.',
      fog: 'Fog\'s no different to me. Everybody else gets to be blind for a day. I find it restful.',
      storm: 'Storm. I can hear every joint in the harbor. They\'re all holding. ~ Most of them are mine.',
    }),
    tide: lowTide([
      ['lt1', 'Tide\'s out. You can smell the mud from here. Smells like work.'],
    ]),
    lit: relit([
      ['r1', 'The bench goes warm when the beam passes. Eight seconds. I count them.'],
    ]),
    unlit: dark([
      ['d1', 'I laid the floor in that Lamp Room. Alder. It\'ll still be good. Alder doesn\'t mind waiting.'],
    ]),
    lead: leads({
      plain: 'Plain creature. Good. Plain is honest grain.',
      grit: 'That one\'s got knuckles. I can hear them. Grit, is it?',
      brine: 'Smells like the quay. A Brine one. Keep it off the oak.',
      kiln: 'Warm. Too warm for a wood yard. A Kiln creature. ~ Stand downwind, would you.',
      moss: 'Smells of a wet hedge. Moss. Fine creature for a yard. Keeps the woodlice honest.',
      bolt: 'My whiskers went funny. You\'ve a Bolt creature with you.',
      rime: 'Cold just came in with you. Rime. Hm. Good for keeping glue.',
      gust: 'Wind came round the bench and there isn\'t any wind. A Gust one.',
      stone: 'Heavy step. Stone creature. The yard likes that. Settles the boards.',
      rust: 'Smells like old nails. Rust lead. Don\'t let it near my chisels.',
      glass: 'It rings when it moves. Faint. Glass creature. I\'d know that sound anywhere.',
      hollow: 'Something went past my ear and nothing was there. Hollow, then.',
    }),
    shift: shift([
      ['sh1', 'It sounds different. Walks different. Breathes the same. ~ Same creature. New roof.'],
    ]),
    loan: pool([
      ['l1', 'First stick. Six thousand. I\'ll gnaw it wide.', tier(1)],
      ['l2', 'Two halves on your wall. Wren will tell you the number. I just know the weight.', tierRange(2, 4)],
      ['l3', 'More sticks on your wall than my old knees have years left. Hm. Keep going.', tierRange(5, 7)],
      ['l4', 'All split. Seven halves on your wall. I\'ve never split that many for one house.', { loan: { tier: { gte: 8 } } }],
    ], ['generic']),
    badge: pool([
      ['b0', 'Spires. Badges. Seals. I don\'t follow it. I follow the notches Hollis sends.', badges(0)],
      ['b1', 'Another notch from the Readers\' fund. You\'re feeding the stick from both ends.', { badge: 2 }],
    ], ['generic']),
    gift: gifted({
      honeycomb: 'That honeycomb. Ate it on the bench with my eyes shut. Not that it makes a difference. It was the best part of the week.',
      timber: 'You brought me timber. I could tell the tree from the smell. Old Meg\'s cousin, from the hill. Good wood.',
    }),
  },
};
