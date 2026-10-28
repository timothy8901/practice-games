/**
 * Corin Vale, tawny owl, the Archive loft. [DATA-CAST] GDD-06; GDD-00 §10.
 *
 * Master Shiftreader whose eyes are going; gave you the Reading Glass, teaches Read, Capture
 * Stance, the first Forecast and Recall; runs exhibitions with his Tossup and reads the odds aloud.
 * Dry, distracted, warm in short bursts; answers questions with questions; leaves before goodbyes
 * (a habit borrowed from Isolde, who taught him). Out on the Lowmoor stones before dawn, at the loft
 * desk 10:00-16:00, the reeds in the afternoon, his step at dusk, the Archive porch at night and a
 * slow owl's round of the green before bed.
 *
 * Merge notes: the four story topics, the porch row (`porch-archive`, lit at arrival), the homeSpot
 * and every marker come from the integrated build; this module adds his weekly shape and his voice.
 * Lines in pools the live resolver picks without conds (generic, porch, phase and pose pools) are
 * true in every act; act-specific lines sit in tagged pools with conds.
 * @module data/npcs/corin
 */

import {
  P, SUN, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  relit, dark, badges, topic, mem,
} from './_helpers.js';

const ID = 'corin';

export const scripts = {
  'talk-corin-odds': [
    'Corin: You Read it. Good. ~ Now: what were the odds on the sideways card?',
    { op: 'choice', options: [
      { text: 'I remember them.', then: [
        ...mem(ID, 'odds', 'remembered'),
        'Corin: Then you were reading, not hoping. ~ Hoping looks at the best card. Reading looks at all three and then at the creature.',
      ] },
      { text: 'I only looked at the top one.', then: [
        ...mem(ID, 'odds', 'top-only'),
        'Corin: Everybody does, the first time. ~ The top card is the one you want. The bottom card is the one you have to be ready for. The middle one is usually what happens.',
      ] },
    ] },
    'Corin: Say them aloud next time. Out loud they sound like numbers. In your head they sound like promises.',
    { op: 'end' },
  ],

  'talk-corin-eyes': [
    '* Corin holds a page at arm\'s length, then further, then gives up and hands it to you.',
    'Corin: Read me the third line? ~ Thank you. It says what I thought it said. I like to be told.',
    'Corin: The Glass still works for me on small Shifts. A sprat, a beetle. Anything with a mark bigger than a button, I see the light and not the cards.',
    'Corin: Which is a very workable arrangement, as long as somebody on this coast has young eyes and a habit of saying what they see. ~ Do you know anybody like that?',
    { op: 'end' },
  ],

  'talk-corin-linnet-gone': [
    'Corin: Her porch is dark. ~ You have noticed. You notice porches now; the town has done that to you.',
    'Corin: Do not go after her. ~ Would you want to be gone after, the week your creature changed in front of everyone?',
    'Corin: Leave your own lamp lit. She will see it from wherever Maud has put her ashore. That is all a porch is for.',
    { op: 'end' },
  ],

  'talk-corin-isolde': [
    'Corin: She taught me on a pier a long way north of here. I was older than you and much slower. ~ She made me say every card out loud until I hated the sound of the word "sideways".',
    'Corin: Then she left, before the goodbyes, which I resented for years. ~ Now I do it. It saves a great many words, and the words are the hard part.',
    { op: 'choice', options: [
      { text: 'Will you say goodbye to me?', then: [
        ...mem(ID, 'goodbye', 'asked'),
        'Corin: ...Hm. ~ What a question. Ask me again when the lamp is lit.',
      ] },
      { text: 'Leave when you like. I\'ll know.', then: [
        ...mem(ID, 'goodbye', 'release'),
        'Corin: Yes. You will. ~ That is precisely the trouble with teaching anybody anything.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-corin-relit': [
    'Corin: I could not see the beam. ~ I could see the town change colour every eight seconds. Every window on the green, one after another.',
    'Corin: That is a better way to see a lighthouse, I think. By what it lands on.',
    { op: 'if', cond: { flag: 'np.corin.goodbye', is: 'asked' },
      then: ['Corin: You asked me once if I would say goodbye. ~ Not yet. There is a ninth Spire somebody ought to design first.'] },
    { op: 'end' },
  ],

  'talk-corin-heart-1': [
    'Corin: Why do you think a reader reads aloud? ~ No, think about it. I will wait. I am very good at waiting; I am an owl.',
    'Corin: ...Because the creature hears it too. It knows you looked. Whatever card lands, it landed on somebody who was paying attention.',
    { op: 'end' },
  ],
};

export default {
  id: ID,
  name: 'Corin Vale',
  species: 'tawny owl',
  sprite: 'corin',
  portrait: 'corin',
  group: 'resident',
  role: 'Master Shiftreader lodging over the Archive; gave you the Reading Glass; teaches Read, Capture Stance, the first Forecast and Recall; exhibitions with his Tossup.',
  home: P,
  homeSpot: spot(P, 'door-archive', { pose: 'sleep' }),
  threadId: null,
  porch: porch('porch-archive', 'corin-archive-step', { litAtStart: true }),
  festivals: {
    'lantern-market': spot(P, 'market-green', { pose: 'stand', activity: 'reading the fair odds aloud to nobody' }),
    'long-night': spot(P, 'point-skywatch', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'party-green', { pose: 'stand' }),
  },
  schedule: [
    at(hm(5), 'lowmoor', 'corin-lowmoor-stones', { for: 240, activity: 'the stones before dawn' }),
    at(hm(9), P, 'corin-archive-step', { activity: 'waiting for Barnaby to open' }),
    at(hm(10), 'int-archive', 'corin-loft-desk', { pose: 'sit', activity: 'the loft desk, a page at arm\'s length' }),
    at(hm(16), P, 'corin-reeds', { activity: 'listening to the reeds' }),
    at(hm(16, 1), 'int-archive', 'corin-loft-desk', { pose: 'sit', weather: ['rain', 'storm'], activity: 'the loft desk, out of the rain' }),
    at(hm(16, 2), P, 'point-skywatch', { pose: 'sit', days: [SUN], activity: 'Sunday: watching the point' }),
    at(hm(18), P, 'corin-step', { activity: 'the step by the cottage gate' }),
    at(hm(23), P, 'corin-archive-step', { pose: 'path', path: 'corin-night-round', activity: 'an owl\'s round of the green' }),
    at(hm(23, 40), 'int-archive', 'corin-loft-bed', { pose: 'sleep' }),
  ],
  topics: [
    topic('glass', 'corin-reading-glass', 20, { once: true, cond: { all: [{ flag: 'sp.starter-chosen' }, { not: { flag: 'sp.reading-glass' } }] } }),
    // the lesson is staged at the reeds (a wild Tossup out of the grass), so never at the loft desk
    topic('stance', 'corin-capture-stance', 15, { once: true, cond: { all: [{ flag: 'sp.dock-battle' }, { not: { flag: 'sp.capture-stance' } }, { map: 'pellwick' }] } }),
    topic('first-forecast', 'corin-first-forecast', 14, { once: true, cond: { all: [{ map: 'lowmoor' }, { party: { level: { gte: 8 } } }, { not: { flag: 'sp.first-forecast' } }] } }),
    topic('ninth-spire', 'ninth-spire-ask', 8, { once: true, cond: { flag: 'sp.credits-seen' } }),
    topic('linnet-gone', 'talk-corin-linnet-gone', 7, { once: true, cond: { all: [{ flag: 'sp.linnet-fell' }, { not: { flag: 'sp.linnet-returned' } }] } }),
    topic('relit', 'talk-corin-relit', 7, { once: true, cond: { flag: 'sp.relighting' } }),
    topic('odds', 'talk-corin-odds', 5, { once: true, cond: { all: [{ flag: 'sp.first-forecast' }, { npc: { id: ID, talks: { gte: 3 } } }] } }),
    topic('eyes', 'talk-corin-eyes', 4, { once: true, cond: { npc: { id: ID, talks: { gte: 6 } } } }),
    topic('isolde', 'talk-corin-isolde', 4, { once: true, cond: { all: [{ flag: 'sp.act-3' }, { npc: { id: ID, talks: { gte: 8 } } }] } }),
    topic('heart-1', 'talk-corin-heart-1', 2, { once: true, cond: { npc: { id: ID, talks: { gte: 4 } } } }),
  ],
  gifts: {
    love: ['moth-silk', 'ermine-moth', 'skyglass-shard'],
    like: ['dor-beetle', 'bush-cricket', 'starfly', 'grayling'],
    dislike: ['honeycomb', 'quince'],
  },
  lines: {
    generic: [
      line('g1', 'Look before you swing. Then say what you see.'),
      line('g2', 'The Glass doesn\'t tell the future. It tells you what you\'re choosing.'),
      line('g3', 'My eyes are getting worse. Yours are getting better. A very workable arrangement.'),
      line('g4', 'Isolde used to leave before goodbyes. I have borrowed the habit. It saves a great many words.'),
      line('g5', 'What do you see? ~ No, not what do you think. What do you see.'),
      line('g6', 'Hm. ~ That was agreement. I am told it does not sound like agreement.'),
      line('g7', 'Why do people ask a reader for certainty? ~ We sell odds. Certainty is two doors down, and it is mostly granite.'),
      line('g8', 'A Heartmark doesn\'t move when the creature changes. Neither should you, much. A little is allowed.'),
      line('g9', 'Barnaby keeps asking me to label things in the Archive. I keep labelling them "probably".'),
      line('g10', 'Are you asking me, or are you asking yourself out loud near me? ~ Both are fine. I only want to know which.'),
      line('g11', 'My Tossup has heard every lecture I own. It falls asleep at the same sentence every time. It is a good sentence.'),
      line('g12', 'The odds are not the creature. Remember that the day the odds are bad.'),
    ],
    known: pool([
      ['k1', 'You came back. ~ I did not doubt it. I simply like to have it confirmed.'],
      ['k2', 'You again. Good. I was about to explain something to the Tossup, and it has heard it.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning. I have been up since four reading the stones on Lowmoor. Or reading at them. My eyes read them; I mostly guess.'],
      ['m2', 'Dew on the Glass. Breathe on it, wipe it, read. That is the whole morning routine. Mine has tea in it as well.'],
      ['m3', 'Did you sleep? ~ You should answer that question honestly. A reader with no sleep reads every card as the bottom one.'],
      ['m4', 'Barnaby opens at nine. I wait on his step at five to, every day. He pretends to be surprised every day. It is a very good arrangement.'],
    ]),
    evening: evening([
      ['e1', 'Evening. The porches come on one at a time. I can\'t see them any more. I count the warmth on my face instead.'],
      ['e2', 'Sit. Or don\'t. ~ You were going to sit. Sit.'],
      ['e3', 'What did you read today? Tell me one creature. Just one. I collect them now that I can\'t see them.'],
      ['e4', 'An owl at dusk is supposed to be wise. I am mostly hungry. Do not tell the town.'],
    ]),
    night: night([
      ['n1', 'Night. My eyes are best in the dark now. Small mercies, from an unexpected direction.'],
      ['n2', 'The green at midnight. Every porch is a little sum of somebody\'s day. I walk round and add them up.'],
      ['n3', 'Why are you awake? ~ No, I know why I am. I asked about you.'],
      ['n4', 'Go to bed, Keeper. The cards will still be there. They are extremely patient. It is one of their worst qualities.'],
    ]),
    porch: [
      line('p1', 'The Archive step. Barnaby lends it to me after nine. I think he likes the company. He says it is the draught.'),
      line('p2', 'Porch talk is just reading aloud with the lamp on. ~ Say something. I will tell you the odds on it.'),
      line('p3', 'Every lit porch on this coast was a choice somebody made with what they had. ~ That is the lecture. It is a short one tonight.'),
      line('p4', 'Sit where the light is. I can see you better there. Not well. Better.'),
    ],
    sit: [
      line('s1', '* Corin is at the loft desk with a page held at arm\'s length. Then further. He sighs at it, kindly, as if it were a pupil.'),
      line('s2', 'Shh. ~ No, go on. I was only reading. I read very slowly now; you are not interrupting anything quick.'),
      line('s3', 'Here: is that a seven or a one? ~ A one. Thank you. That changes the odds considerably.'),
    ],
    path: [
      line('w1', '* Corin is walking the edge of the green very slowly, head turning at each lit porch as if he were saying goodnight to it.'),
      line('w2', 'My round. ~ An owl\'s walk. One lap, every porch, then the loft. Walk with me if you like. I go slowly; you will not have to hurry.'),
    ],
    sleep: [
      line('z1', '* A tawny owl asleep in the loft, very upright, one eye not quite shut. It opens a little further when you come close, then decides you are expected.'),
    ],
    weather: weather({
      rain: 'Rain. ~ Read a creature in the rain and you\'ll learn which ones like it. The Glass fogs. Wipe it. Read again.',
      fog: 'Fog. I see exactly as well as everyone else today. I am almost ashamed of how much I am enjoying it.',
      storm: 'Storm. Stay in. ~ Do you know what Isolde did on storm nights? Read the Glass by lamplight and wrote it all down. I recommend the first half.',
    }),
    lead: leads({
      plain: 'A Plain lead. Nothing to read but the creature. That is harder than it sounds.',
      grit: 'Grit. It wants to swing first. Teach it to look first. It will hate you for a week.',
      brine: 'Brine. Reads the water for you. Thank it; most creatures don\'t bother.',
      kiln: 'A Kiln creature. I can see the heat if not the creature. Very useful, for a lamp.',
      moss: 'Moss. Patient. The good readers on this coast all had a Moss creature once. I did.',
      bolt: 'Bolt. My feathers are standing up. ~ It is not personal. It is weather.',
      rime: 'A Rime creature. Cold makes the mark sharper in the Glass. Read it on a winter morning sometime.',
      gust: 'Gust. It moves before you\'ve finished the sentence. Finish the sentence anyway.',
      stone: 'Stone. It will not Shift lightly. When it does, it will mean it.',
      rust: 'Rust. It shows its age on the outside. Most of us hide it. Hm.',
      glass: 'A Glass creature. ~ Hold it up. Yes. Even my eyes can see that one.',
      hollow: 'Hollow. The Glass shows its mark a little late, as if it were deciding whether to be seen. Wait for it.',
    }),
    shift: shift([
      ['sh1', 'It Shifted. Show me the mark. ~ Same place. Then it is the same creature, and you are the same reader, and the rest is simply new.'],
    ]),
    act: pool([
      ['a1', 'Her porch is dark. Leave yours lit. That is the whole of the advice.', { all: [{ flag: 'sp.linnet-fell' }, { not: { flag: 'sp.linnet-returned' } }] }],
      ['a2', 'Linnet asked you to read for her. ~ I have waited a very long time for anybody on this coast to ask that of anybody else.', { flag: 'sp.linnet-returned' }],
      ['a3', 'A shard that size I cannot read. You will go up alone. ~ You will not be alone. You will be reading.', { all: [{ flag: 'sp.act-3' }, { not: { flag: 'sp.two-plans' } }] }],
    ], ['generic']),
    lit: relit([
      ['r1', 'Every eight seconds my face goes warm. I have started counting with it. It is the best clock I have ever owned.'],
    ]),
    unlit: dark([
      ['d1', 'A dark lighthouse is a question nobody on this coast wants to read aloud. ~ Read it anyway. Quietly, if you like.'],
    ]),
    badge: pool([
      ['b0', 'No seals yet. Good. Read the island before you read the leader. Maud will still be there.', badges(0)],
      ['b1', 'Three seals. You have stopped looking at the top card first. I noticed. I was going to keep it to myself.', badges(3)],
      ['b2', 'Six. ~ The gate is open, and you have eyes for it. I will be on the step when you come back. Or I will have just left.', { badge: 6 }],
    ], ['generic']),
  },
};
