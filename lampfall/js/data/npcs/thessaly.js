/**
 * Thessaly, bilby, the cottage at the footbridge end of the north bank (renamed from Clementine).
 * [DATA-CAST] GDD-06.
 *
 * Writing the second chapter of the harbor's story in a ledger she carries everywhere, and you are on
 * page one (template thread *The Second Chapter*: ask, turn, give). Gentle, bookish, curious, a
 * little grand about narrative; asks everyone for one true thing. Reads her great-aunt Wynne's
 * almanac on her porch in the morning, writes on the bench at the edge of the green 10:00–16:00,
 * walks the creek at dusk.
 * @module data/npcs/thessaly
 */

import {
  P, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tierRange, badges, topic, mem,
} from './_helpers.js';

const ID = 'thessaly';

export const scripts = {
  'talk-thessaly-first': [
    // meet-neighbors meets one of Odile / Thessaly / Bryony per run; only that one already knows you
    { op: 'if', cond: { flag: 'np.thessaly.met-step' },
      then: ['Thessaly: You! Page one! ~ I\'ve written you down already. "A stranger walked in over the sea." It\'s a strong opening. I\'m very pleased with it.'],
      else: ['* A bilby with enormous ears sits on the bench at the edge of the green, writing in a ledger so fast the pencil squeaks.'] },
    'Thessaly: Thessaly. I\'m writing the second chapter. Of the harbor. The first one ended thirty years ago, rather badly, and nobody\'s picked up the pen since.',
    'Thessaly: I don\'t need much from you. Just one true thing, now and then. People are terrible at true things. They\'re wonderful at nearly true things.',
    { op: 'end' },
  ],

  'talk-thessaly-chapter-titles': [
    'Thessaly: I\'ve been working on chapter titles. Tell me which is best. Honestly. ~ Honesty\'s the whole point of me.',
    { op: 'choice', options: [
      { text: '"The Tide Comes Back".', then: [
        ...mem(ID, 'title-pick', 'tide'),
        'Thessaly: The Tide Comes Back. ~ Simple. True twice a day. I\'ve underlined it.',
      ] },
      { text: '"Pay What You Owe".', then: [
        ...mem(ID, 'title-pick', 'owe'),
        'Thessaly: Pay What You Owe. ~ Oh, that\'s stern. That\'s Augusta\'s chapter. I\'m saving it for her.',
      ] },
      { text: '"Somebody Walked".', then: [
        ...mem(ID, 'title-pick', 'walked'),
        'Thessaly: Somebody Walked. ~ That\'s you. That\'s the whole first page in two words. I may have to cut everything else.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-thessaly-surge': [
    'Thessaly: Windle. A whole street Shifted in one night. ~ My great-aunt Wynne lived on that street. Kept the almanac there.',
    'Thessaly: She circled two years in it. The Ebb year. And this one. The year thirty. ~ She knew it was coming round again. She just didn\'t know who\'d be standing here when it did.',
    { op: 'end' },
  ],

  'talk-thessaly-relit': [
    'Thessaly: I finished the chapter. ~ Well. I finished the last line. The middle\'s still a mess. Middles always are.',
    'Thessaly: "And the light went round, and every porch it touched answered." ~ Too much? It\'s too much. I\'m keeping it.',
    { op: 'end' },
  ],

  'talk-thessaly-heart-1': [
    'Thessaly: Do you know why I write it all down? ~ Because the first chapter wasn\'t. Nobody wrote the Ebb winter. They just carried it about in their faces.',
    'Thessaly: If it\'s in a book you can put it on a shelf. You can take it down when you\'re ready and put it back when you\'re not. ~ That\'s all a book is. A shelf for things too heavy to hold.',
    { op: 'end' },
  ],

  'talk-thessaly-heart-2': [
    'Thessaly: Can I read you a sentence I wrote about you? ~ You can say no. Nobody ever says no. I wish they would sometimes.',
    { op: 'choice', options: [
      { text: 'Read it.', then: [
        ...mem(ID, 'sentence', 'read'),
        'Thessaly: "They read everything twice: the cards, the tide, the faces of their neighbours. Then they decided. That was new." ~ There. Is it true?',
        'Thessaly: Don\'t answer. Your ears answered. You haven\'t got big ears, but they answered.',
      ] },
      { text: 'No. Keep it for the book.', then: [
        ...mem(ID, 'sentence', 'kept'),
        'Thessaly: Somebody said no! ~ Oh, that\'s wonderful. That\'s character. I\'m writing THAT down instead.',
      ] },
    ] },
    { op: 'end' },
  ],
};

export default {
  id: ID,
  name: 'Thessaly',
  species: 'bilby',
  sprite: 'thessaly',
  portrait: 'thessaly',
  group: 'resident',
  role: 'Writing the harbor\'s second chapter (template thread The Second Chapter); the bench at the edge of the green 10:00–16:00.',
  home: P,
  homeSpot: spot(P, 'door-thessaly', { pose: 'sleep' }),
  threadId: 'second-chapter',
  porch: porch('porch-thessaly', 'porch-thessaly-step', { hours: [hm(20), hm(22, 30)] }),
  festivals: {
    'lantern-market': spot(P, 'thessaly-bench', { pose: 'sit', activity: 'writing the market down' }),
    'long-night': spot(P, 'porch-linnet-step', { pose: 'stand', facing: 'up', activity: 'ledger open' }),
    'late-delivery-party': spot(P, 'thessaly-bench', { pose: 'sit' }),
  },
  schedule: [
    at(hm(7), P, 'thessaly-porch', { pose: 'sit', activity: 'reading the almanac' }),
    at(hm(10), P, 'thessaly-bench', { pose: 'sit', activity: 'writing on the bench' }),
    at(hm(10, 1), P, 'thessaly-porch', { pose: 'sit', weather: ['rain', 'storm'], activity: 'writing indoors-ish' }),
    at(hm(16), P, 'north-creek-footbridge', { pose: 'stand', activity: 'walking the creek for a sentence' }),
    at(hm(17, 30), P, 'boardwalk-start', { pose: 'stand', facing: 'left', activity: 'watching the marsh at dusk' }),
    at(hm(19), P, 'thessaly-porch', { pose: 'sit' }),
    at(hm(22, 30), P, 'door-thessaly', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-thessaly-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('chapter-titles', 'talk-thessaly-chapter-titles', 4, { cond: { npc: { id: ID, talks: { gte: 3 } } }, once: true }),
    topic('surge', 'talk-thessaly-surge', 7, { cond: { flag: 'sp.surge' }, once: true }),
    topic('relit', 'talk-thessaly-relit', 8, { cond: { flag: 'sp.relighting' }, once: true }),
    topic('heart-1', 'talk-thessaly-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 6 } } }, once: true }),
    topic('heart-2', 'talk-thessaly-heart-2', 2, { cond: { npc: { id: ID, talks: { gte: 12 } } }, once: true }),
  ],
  gifts: {
    love: ['mulberry', 'moth-silk', 'postmark-die'],
    like: ['fig', 'starfly', 'ermine-moth', 'whelk-shell'],
    dislike: ['herring', 'sandhopper', 'crackdust'],
  },
  lines: {
    generic: [
      line('g1', 'One true thing. That\'s all I ask. ~ Not today? That\'s true too. I\'ll write that.'),
      line('g2', 'Every harbor is a book. This one\'s been left open on the same page for thirty years. The spine\'s gone all funny.'),
      line('g3', 'I have big ears for listening. Everyone assumes it\'s for something else. It isn\'t.'),
      line('g4', 'Chapter two needs a hero. I\'ve narrowed it down. To you. And possibly a goose.'),
      line('g5', 'I write in pencil. Ink is for people who\'ve never changed their mind.'),
      line('g6', 'Hesper lends me the old letters to read. Not the private ones. She decides which are private. She\'s a good editor.'),
      line('g7', 'Do you know what\'s wrong with most stories? Everybody in them is in a hurry. Nobody here is in a hurry. Except Tully.'),
      line('g8', 'I\'ve filled four ledgers since you came. That\'s more than the previous thirty years. I\'m not saying it\'s you. It\'s you.'),
    ],
    known: pool([
      ['k1', 'You\'re back on the page! Excellent. I was stuck on a paragraph about weather.'],
      ['k2', 'I gave you a whole chapter heading yesterday. You won\'t see it till the end. No peeking.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning. Aunt Wynne\'s almanac says "fair, with opinions". She was usually right.'],
      ['m2', 'I write best before breakfast. After breakfast I just write longer.'],
    ]),
    evening: evening([
      ['e1', 'Dusk on the marsh. The reeds go copper and the herons all stop at once. I\'ve tried to write it. I keep failing beautifully.'],
      ['e2', 'Evening\'s for reading back what I wrote this morning and wincing.'],
    ]),
    night: night([
      ['n1', 'Up late with the ledger. The harbor\'s quietest after eleven. It\'s when it tells you things.'],
      ['n2', 'The stars over the north bank are in a different order to the ones over the point. I\'ve checked. They\'re not. It felt true.'],
    ]),
    porch: [
      line('p1', 'Sit. I\'ll read you something. Or you read me something. I don\'t mind which side of the page I\'m on.'),
      line('p2', 'From the north bank you see the town backwards. Everyone\'s porch from behind. It\'s very revealing. Mostly washing.'),
    ],
    sleep: [
      line('s1', '* Thessaly is asleep against her door with the ledger open on her chest. The last word on the page trails off into a long pencil line.'),
    ],
    weather: weather({
      rain: 'Rain. Perfect writing weather. Rain\'s the only audience that never interrupts.',
      fog: 'Fog. The harbor\'s a blank page today. I\'ve never been so frightened or so happy.',
      storm: 'Storm. Chapter one ended in a storm. I don\'t like storms in a book. Too obvious. The sea doesn\'t care what I like.',
    }),
    tide: lowTide([
      ['lt1', 'Low water. The flats look like a page that\'s been rubbed out. You can still see what was written underneath.'],
    ]),
    lit: relit([
      ['r1', 'Every eight seconds the light goes over my ledger. Like someone reading over my shoulder. Kindly.'],
    ]),
    unlit: dark([
      ['d1', 'The lighthouse is the full stop at the end of chapter one. I\'ve been waiting for someone to turn it into a comma.'],
    ]),
    lead: leads({
      plain: 'A plain creature. Plain is underrated in literature. Plain is where the reader lives.',
      grit: 'A Grit one. A creature with a temper and a good heart. Classic supporting role.',
      brine: 'A Brine creature. A sea-story creature. Every harbor book needs one.',
      kiln: 'A Kiln creature. Dramatic. Warm. A bit much. I love it.',
      moss: 'A Moss creature. A quiet chapter in a creature. Restful.',
      bolt: 'A Bolt creature. A twist ending with fur.',
      rime: 'A Rime creature. A winter chapter. Somebody\'s going to say something true in it.',
      gust: 'A Gust one. My pages! ~ No, it\'s fine. It\'s a new order. It might be better.',
      stone: 'A Stone creature. The bit of the story everybody leans on and nobody thanks.',
      rust: 'A Rust creature. All the history showing on the outside. Honest, at least.',
      glass: 'A Glass creature. The kind of thing you write and then have to cut because nobody believes it.',
      hollow: 'A Hollow creature. A ghost story. Every good harbor has one. Ours has a few.',
    }),
    shift: shift([
      ['sh1', 'It Shifted. ~ Same character, new chapter. That\'s the best kind of change in a book. The kind where you still recognise them.'],
    ]),
    loan: pool([
      ['l1', 'Your cottage grows a room every few nights. I\'m writing it as a subplot.', tierRange(2, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'No Spires yet? Good. Heroes should take a few chapters to get going.', badges(0)],
      ['b1', 'Four seals. The middle of the book. The middle\'s where everything goes wrong. In a good way. Usually.', badges(4)],
    ], ['generic']),
    gift: gifted({
      mulberry: 'The mulberry stained my ledger purple. I\'ve left it. It\'s the best page.',
      'postmark-die': 'You gave me Mabry\'s postmark die. I stamped every chapter heading with it, then gave it to Hesper. She cried. Happily. I think.',
    }),
  },
};
