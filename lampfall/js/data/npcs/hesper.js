/**
 * Hesper Coil, garden snail, the post office. [DATA-CAST] GDD-06.
 *
 * Night shift: the counter 18:00–02:00 (one family letter from 18:00), sorting till dawn, the Keeper
 * letter at your gate at 06:00, then sleep above the office. Twice a week before bed her shimmer
 * trail leads up the lighthouse stair, where she reads Isolde's letters by the dead lamp. Slow,
 * meticulous, soft-voiced, quietly guilty; answers questions with questions. Order is a kindness.
 * @module data/npcs/hesper
 */

import {
  P, TUE, FRI, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tierRange, badges, topic, mem,
} from './_helpers.js';

const ID = 'hesper';

export const scripts = {
  'talk-hesper-first': [
    { op: 'if', cond: { seen: 'hesper-mail-sack' },
      then: [
        'Hesper: You carried the sack in. ~ Do you know how long it sat on that causeway post? Do you want to?',
        'Hesper: Thirty years, give or take a winter. I\'m sorry. I keep saying that. Do you mind if I keep saying it?',
      ],
      else: [
        '* Behind the counter, a garden snail looks up from a letter, slowly, the way the tide comes in.',
        'Hesper: Hesper Coil. The post office. ~ Were you expecting something? Weren\'t we all.',
      ] },
    'Hesper: The counter\'s open from six in the evening till two. One letter at a time. In order. ~ Order is a kindness. Did nobody ever tell you that?',
    { op: 'end' },
  ],

  'talk-hesper-should-i-stop': [
    '* Hesper\'s eyestalks are low tonight. She holds tomorrow\'s envelope against her shell and does not put it on the counter.',
    'Hesper: Can I ask you something? You can say no. Can I?',
    'Hesper: I know what the next ones say. I read them. I read all of them, years ago, and then I read them again. ~ Should I stop? Bringing them?',
    { op: 'choice', options: [
      { text: 'Keep bringing them. One at a time.', then: [
        ...mem(ID, 'keep-going', 'yes'),
        'Hesper: One at a time. ~ Yes. That\'s how Mabry taught me. People can bear nearly anything one at a time.',
      ] },
      { text: 'You can stop if it hurts you. I\'ll understand.', then: [
        ...mem(ID, 'keep-going', 'offered'),
        'Hesper: ...Nobody\'s ever offered me that. ~ No. I\'ll bring them. But thank you. Isn\'t it strange, how much easier it is now that I could stop?',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-hesper-keep-my-letters': [
    'Hesper: You read the one to Mabry. "Please go on holding them." ~ That was my great-aunt\'s counter. That was this counter.',
    'Hesper: She did go on holding them. Under her stairs, in the old sack, in their own string. I just carried on not opening the door. Is that the same thing? It isn\'t, is it.',
    { op: 'end' },
  ],

  'talk-hesper-order': [
    'Hesper: "Don\'t cry on the stamps." ~ That\'s the bit I read most. Did you see it?',
    'Hesper: I cried on the stamps. Of course I did. Mabry knew I would. That\'s why she wrote it down.',
    { op: 'end' },
  ],

  'talk-hesper-day-book': [
    'Hesper: Mabry\'s day book is on the Commons board now, a page at a time. Have you noticed how small her writing gets when something\'s wrong?',
    'Hesper: The week the oil boat turned back, she wrote the whole entry on one line. Like if she kept it small it wouldn\'t take up so much of the week.',
    { op: 'end' },
  ],

  'talk-hesper-wading': [
    'Hesper: The children wading home across the flats. ~ I was one of them. Did you guess? Mabry wrote "the little Coil, holding the lamp up". I was holding a jam jar with a glow-worm in it.',
    'Hesper: It went out halfway. The glow-worm. I kept holding it up anyway. ~ Do you think that counts?',
    { op: 'end' },
  ],

  'talk-hesper-returned': [
    'Hesper: "Returned, no forwarding." Mabry wrote that on every letter we sent to the Outer Isles, the year after. ~ So nobody wrote back to Isolde. Ever.',
    'Hesper: She kept writing anyway. To a keeper who didn\'t exist yet. ~ Isn\'t that what a post office is? Faith with stamps on.',
    { op: 'end' },
  ],

  'talk-hesper-last-keeper-letter': [
    'Hesper: That was the last of hers. The last Keeper letter. ~ Do you know how many mornings I\'ve walked to your gate? I counted. Of course I counted. Twenty.',
    'Hesper: Tomorrow I\'ll walk there anyway. Out of habit. I might just say good morning. Would that be all right?',
    { op: 'end' },
  ],

  'talk-hesper-saw-the-light': [
    '* Hesper is flustered. Hesper is never flustered. Her shell is trembling very slightly.',
    'Hesper: Did you read it? Did you? It\'s postmarked LAST WEEK. From the Outer Isles. In her hand.',
    'Hesper: "I saw the light." ~ Six words. Thirty years, and six words, and I\'ve read them forty times since six o\'clock. Isn\'t that the most beautiful letter you\'ve ever been brought?',
    { op: 'end' },
  ],

  'talk-hesper-late-delivery': [
    'Hesper: A party. For me. For being LATE. ~ Do you think they understand what they\'re celebrating? Do you think I do?',
    'Hesper: Barnaby made a banner. It says "THE LATE DELIVERY". He spelled Delivery with two Ls and then fixed it with a tiny patch. I\'ve never been so happy in my life.',
    { op: 'end' },
  ],

  'talk-hesper-heart-1': [
    'Hesper: People think snails are slow because we\'re lazy. ~ We\'re slow because we\'re careful. Have you ever tried to carry your whole house and not drop anything?',
    'Hesper: Snails do our best work when nobody\'s watching. That\'s why nights. ~ Is that sad? I always thought it was quite nice.',
    { op: 'end' },
  ],
};

export default {
  id: ID,
  name: 'Hesper Coil',
  species: 'garden snail',
  sprite: 'hesper',
  portrait: 'hesper',
  group: 'resident',
  role: 'Postmistress on the night shift: the Keeper letter at 06:00, the counter 18:00–02:00 with one family letter.',
  home: 'int-post-office',
  homeSpot: spot('int-post-office', 'sorting-table-front', { pose: 'sleep' }),
  threadId: null,
  porch: porch('porch-post-office', 'porch-post-office-step', { litAtStart: true, hours: [hm(17), hm(18)] }),
  festivals: {
    'lantern-market': spot(P, 'hesper-post-step', { pose: 'shop', activity: 'the counter on the step for market night' }),
    'long-night': spot(P, 'mailbox-front', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'market-green', { pose: 'stand', activity: 'guest of honour' }),
  },
  schedule: [
    at(hm(2), 'int-post-office', 'hesper-sorting', { pose: 'stand', activity: 'sorting' }),
    at(hm(5, 30), P, 'hesper-cottage-gate', { pose: 'stand', activity: 'the morning letter' }),
    at(hm(6, 40), 'int-post-office', 'sorting-table-front', { pose: 'sleep' }),
    at(hm(6, 41), 'int-lighthouse', 'isolde-desk-front', { pose: 'sit', days: [TUE, FRI], cond: { not: { flag: 'sp.relighting' } }, activity: 'reading by the dead lamp' }),
    at(hm(8), 'int-post-office', 'sorting-table-front', { pose: 'sleep', days: [TUE, FRI] }),
    at(hm(17), P, 'hesper-post-step', { pose: 'sit', activity: 'an hour on the step before opening' }),
    at(hm(18), 'int-post-office', 'hesper-counter', { pose: 'shop', activity: 'the counter' }),
  ],
  topics: [
    topic('first', 'talk-hesper-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('should-i-stop', 'talk-hesper-should-i-stop', 7, { cond: { all: [{ letter: { read: 8 } }, { not: { letter: { read: 20 } } }] }, once: true }),
    topic('keep-my-letters', 'talk-hesper-keep-my-letters', 6, { cond: { flag: 'np.hesper.keep-my-letters' }, once: true }),
    topic('order', 'talk-hesper-order', 6, { cond: { flag: 'np.hesper.order-is-a-kindness' }, once: true }),
    topic('day-book', 'talk-hesper-day-book', 5, { cond: { any: [{ flag: 'np.hesper.day-book-oil' }, { flag: 'np.hesper.day-book-drawing' }, { flag: 'np.hesper.day-book-last-sack' }] }, once: true }),
    topic('wading', 'talk-hesper-wading', 6, { cond: { flag: 'np.hesper.day-book-wading' }, once: true }),
    topic('returned', 'talk-hesper-returned', 6, { cond: { flag: 'np.hesper.day-book-returned' }, once: true }),
    topic('last-keeper-letter', 'talk-hesper-last-keeper-letter', 7, { cond: { flag: 'np.hesper.last-keeper-letter' }, once: true }),
    topic('saw-the-light', 'talk-hesper-saw-the-light', 9, { cond: { flag: 'np.hesper.saw-the-light' }, once: true }),
    topic('late-delivery', 'talk-hesper-late-delivery', 8, { cond: { flag: 'sp.late-delivery' }, once: true }),
    topic('heart-1', 'talk-hesper-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 5 } } }, once: true }),
  ],
  gifts: {
    love: ['glow-worm', 'postmark-die', 'mulberry'],
    like: ['cherry', 'fig', 'moth-silk', 'whelk-shell'],
    dislike: ['sandhopper', 'red-gurnard', 'crackdust'],
  },
  lines: {
    generic: [
      line('g1', 'Good evening. Or is it? I lose track, on nights. Does it matter, if the letter\'s the right one?'),
      line('g2', 'Yes, I read them. All of them. Somebody should, before they go back out into the world. Don\'t you think?'),
      line('g3', 'One letter a morning. Never two. Not even if you ask nicely. Especially not if you ask nicely.'),
      line('g4', 'Have you ever tried to lick a stamp with a snail\'s tongue? Don\'t. It\'s a whole afternoon.'),
      line('g5', 'The pigeonholes are alphabetical, then by tide. Mabry\'s system. Does anyone else understand it? I hope not.'),
      line('g6', 'I\'m slow because I\'m careful. Or careful because I\'m slow. Which came first, do you think?'),
      line('g7', 'Some letters you deliver. Some letters you carry. The second kind are heavier, and you can\'t put them down.'),
      line('g8', 'Is there anything sadder than an unsent letter? An unread one. Is there anything happier? A late one, finally opened.'),
    ],
    known: pool([
      ['k1', 'You came back. People don\'t always come back to the post office. Did you know that?'],
      ['k2', 'You read them in the morning, don\'t you? Standing at the gate. I see you from the corner. I always wait till you\'ve finished the first line.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Good morning. One for you. It\'s… a little late. Thirty years, give or take. I\'m sorry.'],
      ['m2', 'I should be asleep. Shouldn\'t I? I wanted to see your face when you opened it.'],
      ['m3', 'The dew\'s good for the trail this morning. Did you see? I went round your gate twice. Not on purpose.'],
    ]),
    evening: evening([
      ['e1', 'The counter\'s open. There\'s one for a door tonight, if you\'ll carry it. Will you?'],
      ['e2', 'Six o\'clock is my morning. Do you mind if I yawn? I\'m going to yawn.'],
    ]),
    night: night([
      ['n1', 'Late post. Ludo\'s on the eave above me. He hums when he counts. Can you hear it?'],
      ['n2', 'The office is warm at this hour. The stove, the lamp, the paper. Would you like to stand in it a minute?'],
    ]),
    porch: [
      line('p1', 'An hour on the step before I open. Do you sit too? Sit.'),
      line('p2', 'Watch the green from here. Everyone walks past the post office eventually. Have you noticed?'),
      line('p3', 'The step was Mabry\'s. She said a postmistress should be seen once a day not working. So people know she\'s a person.'),
    ],
    sleep: [
      line('s1', '* Hesper has drawn into her shell on the sorting table. A small note on the shell says, in tidy capitals, BACK AT SIX.'),
    ],
    weather: weather({
      rain: 'Rain. Isn\'t it lovely? Snail weather. I could deliver to the whole harbor in this.',
      fog: 'In fog every house looks the same. Isn\'t that a hard day to be the post?',
      storm: 'Storm. I put the letters in oilcloth. Twice. Do you think that\'s enough? It\'s never enough.',
    }),
    tide: lowTide([
      ['lt1', 'Low water. The flats shine like a page nobody\'s written on yet. Don\'t they?'],
    ]),
    lit: relit([
      ['r1', 'The beam goes past the office window every eight seconds now. I stop sorting every time. Is that silly? I don\'t care if it is.'],
      ['r2', 'She\'d have seen it from the Outer Isles, wouldn\'t she? On a clear night? I think about that a great deal.'],
    ]),
    unlit: dark([
      ['d1', 'The lamp\'s dark tonight. As always. Doesn\'t it look patient, up there? I think it\'s waiting for the right letter.'],
    ]),
    letters: pool([
      ['lk1', 'Tomorrow\'s is a short one. Short ones are hardest. Did you know that?', { all: [{ letter: { read: 7 } }, { not: { letter: { read: 8 } } }] }],
      ['lk2', 'You read the storm one. ~ I\'m sorry. I\'m sorry I didn\'t bring it thirty years ago. Would it have helped anybody?', { all: [{ letter: { read: 8 } }, { not: { letter: { read: 10 } } }] }],
      ['lk3', 'The letters are getting lighter. Have you noticed? The ink. Like she\'d stopped pressing so hard.', { letter: { read: 13 } }],
    ], ['generic']),
    lead: leads({
      plain: 'A plain one. Isn\'t that restful? Not everything has to be extraordinary.',
      grit: 'A Grit creature. It nearly knocked the postbox. Can you hold it? Gently?',
      brine: 'A Brine creature. Snails and Brine don\'t mix, you know. Salt. We don\'t talk about salt.',
      kiln: 'It\'s warm in here suddenly. A Kiln one? Could it stand by the stove, away from the paper?',
      moss: 'A Moss creature. Oh, it smells like a garden after rain. Can it stay a minute?',
      bolt: 'The lamp flickered when it came in. Bolt? Isn\'t that thrilling, and also a fire risk?',
      rime: 'A Rime creature. The ink\'s gone thick. Would it mind waiting outside? Only a little outside.',
      gust: 'A Gust one. Please, the pigeonholes. ~ Thank you. Mabry\'s system can\'t survive a breeze.',
      stone: 'A Stone creature. So heavy and so careful. Like a good parcel.',
      rust: 'A Rust creature. It\'s looking at the letterbox hinges. Can you tell it they\'re load-bearing?',
      glass: 'A Glass one. It catches the counter lamp. Don\'t you think it looks like a sealed envelope held up to the light?',
      hollow: 'A Hollow creature. It went through the sorting table. ~ It didn\'t take anything. I checked. Twice.',
    }),
    shift: shift([
      ['sh1', 'It\'s different. Isn\'t it? But it came to the counter the same way. Things keep their walk, I find. Do you?'],
    ]),
    loan: pool([
      ['l1', 'Wren says your porch will light when the first loan\'s paid. I\'ll see it on the way to the gate. Won\'t that be nice?', tierRange(1, 1)],
      ['l2', 'Your porch is on. I deliver to a lit porch now. It\'s different. Is it silly that it\'s different?', tierRange(2, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'Letters come from the isles sometimes. Have you been out there yet? Write, if you go. Who would you write to?', badges(0)],
      ['b1', 'The Spires send their dossiers through the office. I read those too. Is that wrong? It\'s not technically mail.', { badge: 3 }],
    ], ['generic']),
    gift: gifted({
      'glow-worm': 'You gave me a glow-worm in a jar. ~ I let it go on the flats the next night. Is that all right? It wanted to go home.',
      'postmark-die': 'That postmark die you found. Mabry\'s. It\'s on the counter now. I stamp the date with it every morning. Isn\'t that something?',
    }),
  },
};
