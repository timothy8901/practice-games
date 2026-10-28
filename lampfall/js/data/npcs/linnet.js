/**
 * Linnet Rask, stoat (ermine in Act III), next door. [DATA-CAST] GDD-06; GDD-00 §10, §11.
 *
 * Your rival and next-door neighbour: loud, quick, first at everything, generous once she respects
 * you, and hates being pitied more than she hates losing. Her Cinder Shifts up into a Caldermaw at
 * the dock, back down into a Sootling at the first Lantern Market on or after badge 2; she leaves on
 * Maud's punt and comes back from Rimeholt with her ponytail cut, a bench she trained herself and
 * Cinder in her hood (arc *The Ember Grub*). Ends at Maud's ferry wheel.
 *
 * Merge notes: the topics (`rematch`, `decline`, the Porch Duel `talk-linnet-duel` against trainer
 * `porch-linnet`), the absent cond, the lit porch and every marker come from the integrated build.
 * The live resolver picks generic, porch, phase and pose lines without reading conds, so those are
 * true in every act; act-specific lines sit in tagged pools with conds.
 * @module data/npcs/linnet
 */

import {
  P, SAT, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  relit, dark, badges, topic, mem, duelScript, duelTopic,
} from './_helpers.js';

const ID = 'linnet';
const BEFORE_FALL = { not: { flag: 'sp.linnet-fell' } };
const RETURNED = { flag: 'sp.linnet-returned' };
/** After the Ember Grub's beat 4 (the window read on her own step). */
const READ_FOR = { thread: { id: 'ember-grub', beat: { gte: 4 } } };
/** After the Shardcrown gate (beat 5 is her first morning at Maud's wheel). */
const AT_WHEEL = { seen: 'linnet-gate-after' };

export const scripts = {
  'talk-linnet-first-place': [
    'Linnet: Keep score with me. ~ No, properly. I keep a list. Fish caught, crabs found, creatures Read. I\'m first on all of it.',
    { op: 'choice', options: [
      { text: 'I\'m not racing you.', then: [
        ...mem(ID, 'score', 'refused'),
        'Linnet: Everybody\'s racing me. Some of them just don\'t know. ~ Fine. You\'re on the list anyway. Second. Out of respect.',
      ] },
      { text: 'Put me on the list.', then: [
        ...mem(ID, 'score', 'joined'),
        'Linnet: You\'re on it! Second. ~ Don\'t look like that. Second is a VERY good place. It\'s right behind first.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-linnet-pity': [
    'Linnet: Don\'t. ~ Don\'t do the face. Everybody on the green has been doing the face.',
    'Linnet: Cinder\'s small. Cinder was always going to Shift. I just thought it would be UP again. ~ I read it wrong. I didn\'t read it at all.',
    { op: 'choice', options: [
      { text: 'Then read it next time. With me.', then: [
        ...mem(ID, 'pity', 'read-with'),
        'Linnet: ...With you. ~ Maybe. Ask me again when I\'m not angry. That might be a while. I\'m very good at angry.',
      ] },
      { text: '(Say nothing. Don\'t do the face.)', then: [
        ...mem(ID, 'pity', 'no-face'),
        'Linnet: ...Thanks. ~ That was the right thing. Don\'t tell anyone you did the right thing. They\'ll think I needed it.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-linnet-hair': [
    'Linnet: Yes, I cut it. ~ It kept catching on Cinder. He lives in my hood now. Priorities.',
    'Linnet: I did it myself, in a cave on Rimeholt, with Brannoch holding the lamp and saying "are you sure" every snip. ~ I was sure. I\'m always sure. I\'m sometimes right as well.',
    { op: 'choice', options: [
      { text: 'It suits you.', then: [...mem(ID, 'hair', 'suits'), 'Linnet: I KNOW. ~ Thank you.'] },
      { text: 'You look like you\'ve been somewhere.', then: [...mem(ID, 'hair', 'somewhere'), 'Linnet: ...I have. ~ That\'s better than suits. I\'m keeping that one.'] },
    ] },
    { op: 'end' },
  ],

  'talk-linnet-bench': [
    'Linnet: Six creatures. They take turns. Yes, I do know that now. ~ Don\'t say "I told you". You did tell me. I heard.',
    'Linnet: Cinder sits out half the fights and sulks in my hood and comes out swinging. ~ The sulking is new. I think he\'s learning it from me.',
    { op: 'end' },
  ],

  'talk-linnet-wheel': [
    'Linnet: Maud lets me take the punt across to Lowmoor on my own now. Mornings only. With her standing right behind me not supervising.',
    'Linnet: She says "confirm" so often I\'ve started saying it in my sleep. Mum says I said it at breakfast. To the toast. ~ Brackenford, five. Confirm? See. I can\'t stop.',
    'Linnet: It\'s a terrible job. Everybody gets somewhere and nobody says who got there first. ~ It\'s the best job on the coast.',
    { op: 'end' },
  ],

  'talk-linnet-heart-1': [
    'Linnet: Can I tell you something and you won\'t be nice about it? ~ Promise you won\'t be nice.',
    'Linnet: I wanted to be the first Shiftreader on Lowmoor. Since I was six. I had a badge drawn on a biscuit tin.',
    'Linnet: Then you walked in over the sea and Corin gave YOU the Glass. ~ I was so cross I couldn\'t eat. And then you read Cinder for me, on the dock, before I could. And you were right.',
    'Linnet: So now I\'m second. ~ I\'m a very good second. Don\'t be nice about it.',
    { op: 'end' },
  ],

  'talk-linnet-duel': duelScript(ID, 'porch-linnet', {
    ask: 'Linnet: The slate says us. Friendly rules, Augusta\'s. ~ Friendly means I only try MOSTLY to win. Duel?',
    yes: 'Linnet: YES. Read first. Then come on. ~ Cinder, up. Show them what small does.',
    no: 'Linnet: Coward. ~ Kidding. Another evening. The step will still be here, and so will I. First.',
  }),
};

export default {
  id: ID,
  name: 'Linnet Rask',
  species: 'stoat',
  sprite: 'linnet',
  portrait: 'linnet',
  group: 'resident',
  role: 'Rival and next-door neighbour; Cinder (Sootling, Caldermaw); arc The Ember Grub; Porch Duels; ends at Maud\'s ferry wheel.',
  home: P,
  homeSpot: spot(P, 'door-linnet', { pose: 'sleep' }),
  threadId: 'ember-grub',
  porch: porch('porch-linnet', 'porch-linnet-step', { litAtStart: true }),
  absent: { all: [{ flag: 'sp.linnet-fell' }, { not: { flag: 'sp.linnet-returned' } }] },
  festivals: {
    'lantern-market': spot(P, 'market-green', { pose: 'stand', activity: 'first in every queue' }),
    'mudlark-mile': spot(P, 'mudlark-start', { pose: 'stand', activity: 'heckling the start line' }),
    'long-night': spot(P, 'point-skywatch', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'party-green', { pose: 'stand' }),
  },
  schedule: [
    at(hm(6), P, 'linnet-porch', { activity: 'stretching on the rail' }),
    at(hm(8), 'lowmoor', 'linnet-rematch-stones', { cond: { not: RETURNED }, activity: 'training on the Brackenford stones' }),
    at(hm(8, 1), P, 'maud-berth', { cond: AT_WHEEL, activity: 'learning Maud\'s wheel' }),
    at(hm(12), P, 'commons-training-yard', { activity: 'training on the green' }),
    at(hm(15), P, 'tully-lap-3', { days: [SAT], activity: 'racing Tully round the green, loudly' }),
    at(hm(17), P, 'linnet-porch', { activity: 'on the rail, boots swinging' }),
    at(hm(23), P, 'door-linnet', { pose: 'sleep' }),
  ],
  topics: [
    topic('rematch', 'linnet-brackenford-before', 8, { cond: { all: [{ map: 'lowmoor' }, { badge: 1 }, { not: { flag: 'sp.linnet-rematch' } }] } }),
    topic('decline', 'linnet-decline', 7, { repeatDays: 1, cond: { all: [{ day: { gte: 2 } }, { not: { badge: 1 } }] } }),
    duelTopic(ID),
    topic('pity', 'talk-linnet-pity', 9, { once: true, cond: { all: [RETURNED, READ_FOR] } }),
    topic('hair', 'talk-linnet-hair', 6, { once: true, cond: { all: [RETURNED, READ_FOR, { seen: 'talk-linnet-pity' }] } }),
    topic('bench', 'talk-linnet-bench', 5, { once: true, cond: { all: [RETURNED, READ_FOR, { npc: { id: ID, talks: { gte: 3 } } }] } }),
    topic('wheel', 'talk-linnet-wheel', 6, { once: true, cond: { thread: { id: 'ember-grub', done: true } } }),
    topic('first-place', 'talk-linnet-first-place', 3, { once: true, cond: { all: [{ flag: 'sp.dock-battle' }, { npc: { id: ID, talks: { gte: 2 } } }] } }),
    topic('heart-1', 'talk-linnet-heart-1', 2, { once: true, cond: { npc: { id: ID, talks: { gte: 7 } } } }),
  ],
  gifts: {
    love: ['apple', 'sand-eel', 'skyglass-shard'],
    like: ['pear', 'mackerel', 'cockle', 'dor-beetle'],
    dislike: ['anchor-stone', 'moth-silk'],
  },
  lines: {
    generic: [
      line('g1', 'Neighbor! I was up first. I\'m always up first. Ask anyone. Ask the gulls.'),
      line('g2', 'Don\'t feel sorry for me. Ever. About anything. I\'ll know, and then we\'ll have to battle about it.'),
      line('g3', 'I read the tide board on the way past. Out loud. Somebody has to; Hobb mumbles.'),
      line('g4', 'You\'ve got mud on your boots. Good mud. Lowmoor mud. ~ I\'ve got more.'),
      line('g5', 'Corin says I swing before I look. I say I look very fast.'),
      line('g6', 'Next door is the best place to live. I can see your porch. I can tell when you\'re home. Not in a strange way. In a neighbor way.'),
      line('g7', 'Mum says I was born running. I say I was born winning and the running came after.'),
      line('g8', 'Cinder sends regards. ~ He doesn\'t. He sends smoke. It\'s the same thing.'),
      line('g9', 'If you ever beat me at something, I\'m going to be furious for one day and then I\'m going to be very proud of you. Both. Loudly.'),
      line('g10', 'Wren says my fence and your fence are the same fence. I say mine is the front.'),
      line('g11', 'I\'ve got a list. You\'re on it. It\'s a good list. Mostly.'),
      line('g12', 'First one to the end of the quay. ~ Go. ~ GO. Why aren\'t you going?'),
    ],
    known: pool([
      ['k1', 'There you are. I was about to come and knock. I wasn\'t. I was.'],
      ['k2', 'You were out on the isles yesterday. I could tell. Your porch went on late. I notice porches.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning! I\'ve done the rail, the step, the quay and back. You\'ve done... standing. Good standing, though.'],
      ['m2', 'Breakfast is for people who aren\'t training. ~ I had two.'],
      ['m3', 'The ferry goes at eight. I\'m always at the end of the dock before Maud. She pretends she doesn\'t see me. She sees me.'],
      ['m4', 'Did you hear me shouting at six? That was a warm-up shout. You\'ll know the real one.'],
    ]),
    evening: evening([
      ['e1', 'Evening, neighbor. Sit on your step. I\'ll sit on mine. We can talk across. It\'s very civilised.'],
      ['e2', 'I watched your porch come on just now. Pop. ~ Mine was first. Mine is always first.'],
      ['e3', 'Tell me one thing you won today. One. I\'ll tell you three.'],
      ['e4', 'The rail is warm from the sun still. Best seat on the row. I\'ve tested all of them.'],
    ]),
    night: night([
      ['n1', 'Late! I can\'t sleep. I\'m thinking about tomorrow. Tomorrow is going to be very good. I\'ve decided.'],
      ['n2', 'Shh. Mum thinks I\'m in bed. ~ I am in bed. Spiritually.'],
      ['n3', 'You can see every porch from my rail at night. I count them. Augusta\'s faster. I\'m louder.'],
      ['n4', 'Goodnight, neighbor. ~ I said it first. That counts.'],
    ]),
    porch: [
      line('p1', 'My porch! Sit. Not on the rail, the rail is mine. On the step. The step is very good, I\'ve been told.'),
      line('p2', 'From here I can see your door, the green, the quay and Tully pretending not to be listening. TULLY.'),
      line('p3', 'Porch talk. ~ I\'m not good at porch talk. I\'m good at porch winning. Talk to me anyway.'),
      line('p4', 'This lamp stayed lit for you, you know. The night you walked in. I lit it early, just in case. ~ It was a coincidence. Mostly.'),
    ],
    sleep: [
      line('z1', '* Linnet is asleep across her own doorway with one boot still on, as if she meant to get up again in a minute and win something.'),
    ],
    weather: weather({
      rain: 'Rain! Rain\'s training weather. Everyone else goes in, so I\'m first by default. Default still counts.',
      fog: 'Fog. Can\'t see the end of the quay. I ran it anyway. I think I won. Nobody else was there to say.',
      storm: 'Storm. Mum says in. I\'m in. ~ I\'m on the step. The step is in, it has a roof.',
    }),
    lead: leads({
      plain: 'A Plain one. Nothing fancy. ~ I used to think that meant weak. I don\'t now.',
      grit: 'Grit! Punchy. I like it. Cinder likes it. Cinder doesn\'t like anything, so that\'s high praise.',
      brine: 'Brine lead. Wet. Very wet. ~ Keep it off my step. Cinder hisses at puddles.',
      kiln: 'A Kiln creature! Cinder\'s cousin. Look at them, they\'re steaming at each other. That\'s friendship.',
      moss: 'Moss. Slow. ~ Slow isn\'t losing. Somebody told me that. I\'m still checking.',
      bolt: 'Bolt! Fast! Is it faster than Cinder? It isn\'t. Don\'t check.',
      rime: 'Rime. Cold. ~ The caves up north were that cold. I liked them more than I thought I would.',
      gust: 'A Gust one. It blew my list away. I had the list memorised. I win again.',
      stone: 'Stone. Heavy. It\'s not going anywhere and it doesn\'t mind. I could never do that.',
      rust: 'Rust. Tough old thing. Respect.',
      glass: 'A Glass creature. Shiny. Show-off. ~ I like it.',
      hollow: 'Hollow. It went right through the rail. ~ My rail. Tell it that\'s my rail.',
    }),
    shift: shift([
      ['sh1', 'It Shifted! Show me the mark. ~ Same place. See? Same creature. I learned that the loud way. You learned it the reading way. Both count.'],
    ]),
    act: pool([
      ['a1', 'Cinder is ENORMOUS and he still comes when I whistle. The ground shakes a bit. It\'s fine. The ground is fine.', BEFORE_FALL],
      ['a2', 'Cinder fits in my hood now. There are advantages. I am listing the advantages.', RETURNED],
      ['a3', 'Neighbor. Read it for me. I\'m asking you.', RETURNED],
      ['a4', 'Maud lets me steer. She says confirm so often I\'ve started saying it in my sleep.', AT_WHEEL],
    ], ['generic']),
    lit: relit([
      ['r1', 'The beam goes over my rail every eight seconds. I wave at it. It doesn\'t wave back. I\'m still first to wave.'],
    ]),
    unlit: dark([
      ['d1', 'When that lamp comes on I\'m going to be the first one on the point to see it. You can be second. Next to me.'],
    ]),
    badge: pool([
      ['b0', 'No badge? Then no battle. Not a real one. Get one and come and find me on the stones.', badges(0)],
      ['b1', 'One badge. NOW we can battle. Brackenford. The stones. Don\'t be late. I won\'t be.', badges(1)],
      ['b2', 'Six. ~ You know I\'ll be at the foot of the gate. You know I\'ll be first there. Come and see.', { badge: 6 }],
    ], ['generic']),
  },
};
