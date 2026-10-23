/**
 * Barnaby Thole, hermit crab, the Archive. [DATA-CAST] GDD-06.
 *
 * Curator: names every find in one batch, writes provenance cards (tide, place, finder), keeps the
 * string wall, the Field Log and the Shiftlog wall, relearns techniques free. Excitable, fussy,
 * kind; a pedant who apologises for it; talks fast and in parentheses (and breaks the habit once, in
 * *The Bell*). Desk 09:00–19:00; beachcombs the point flats at a morning or evening low; the Old
 * Quay at a spring low once K7 says where the bell went down. Lives in a diving helmet that fits
 * perfectly.
 * @module data/npcs/barnaby
 */

import {
  P, MON, SAT, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tierRange, badges, topic, mem,
} from './_helpers.js';

const ID = 'barnaby';

export const scripts = {
  'talk-barnaby-first': [
    { op: 'if', cond: { seen: 'barnaby-field-log' },
      then: ['Barnaby: The shell finder! (I\'ve written you down as "the shell finder". I\'ll change it. I\'ll change it to your name. In ink.)'],
      else: ['* A hermit crab in a brass diving helmet several sizes too big peers at you through the porthole. The glass fogs, clears, fogs again.'] },
    'Barnaby: Barnaby Thole, curator, Archive, (museum), (I\'m fairly sure it\'s a museum). Bring me anything you find. Anything! I\'ll name the lot in one go.',
    'Barnaby: Where you found it, when, what tide. That\'s the important part. A cockle is just a cockle. A cockle from the east flats at a Tuesday low is HISTORY.',
    { op: 'end' },
  ],

  'talk-barnaby-relearn': [
    'Barnaby: Has one of your creatures forgotten a technique it used to know? (They do, when they learn new ones. It\'s very sad. It\'s also very normal.)',
    'Barnaby: The desk can remind them. Free! Memory\'s not for sale in this Archive. (Nothing\'s for sale in this Archive. Except duplicates. I buy duplicates.)',
    { op: 'end' },
  ],

  'talk-barnaby-bounty': [
    'Barnaby: Monday! New week, new bounty. The card\'s pinned by the tanks: three things the collection is missing, (a Held form\'s drop among them, usually), and a fair price for each.',
    'Barnaby: Bring them by Sunday and I\'ll write you on the provenance card as the finder. (That\'s the real reward. The buttons are just to be polite.)',
    { op: 'end' },
  ],

  'talk-barnaby-thole-luck': [
    'Barnaby: You read the roll of the fleet. ~ Did you see the eighth name?',
    'Barnaby: Thole\'s Luck. (My father\'s boat. My father. My grandfather\'s boat before that.) It\'s on the Bar somewhere, with the others. The ribs show at the lowest lows.',
    'Barnaby: I collect where things were found because I never found anything of his. ~ There. That\'s why the cards. (I\'ve never told anybody that. I\'m going to go and fog up quietly.)',
    { op: 'end' },
  ],

  'talk-barnaby-gallery': [
    'Barnaby: Odile\'s canvases! In MY Archive! On the long wall where the damp patch was! (The damp patch is still there. It\'s behind the harbor at dusk. You can\'t tell.)',
    'Barnaby: Eleven porches and a Shiftlog. I wrote a card for every one: where she stood, what hour, what light. She said nobody had ever written down her light before.',
    { op: 'end' },
  ],

  'talk-barnaby-bell-home': [
    'Barnaby: Do you like the label? I wrote it myself. ~ "Exhibit 1: My Old House."',
    'Barnaby: The bell\'s much roomier. And it rings when I turn over in my sleep, (which is a problem, I\'m told, for the whole green), but it rings in TUNE.',
    { op: 'end' },
  ],

  'talk-barnaby-relit': [
    'Barnaby: I put a new card on the lamp. The real one. Up the hill. (I climbed up specially. Wren had to help me down.)',
    'Barnaby: "Lamp, lighthouse, the point. Relit. Finder: the Keeper." ~ It\'s the best provenance card I\'ve ever written.',
    { op: 'end' },
  ],

  'talk-barnaby-heart-1': [
    'Barnaby: Can I ask you something? (You can say no.) ~ Is this a real museum?',
    { op: 'choice', options: [
      { text: 'It\'s the most real museum I\'ve ever seen.', then: [
        ...mem(ID, 'real-museum', 'yes'),
        'Barnaby: (Oh.) ~ (Oh, the porthole\'s gone completely.) Thank you. I\'m going to write that on a card and not show anyone.',
      ] },
      { text: 'Does it matter, if the cards are true?', then: [
        ...mem(ID, 'real-museum', 'cards'),
        'Barnaby: ...If the cards are true. ~ No. No, I suppose it doesn\'t. That\'s a very curator thing to say. Are you sure you\'re not a curator?',
      ] },
    ] },
    { op: 'end' },
  ],
};

const BELL_DIG = { all: [{ flag: 'th.the-bell.located' }, { not: { flag: 'sp.bell-dug' } }, { hour: [6, 20] }] };

export default {
  id: ID,
  name: 'Barnaby Thole',
  species: 'hermit crab',
  sprite: 'barnaby',
  portrait: 'barnaby',
  group: 'resident',
  role: 'Curator of the Archive (09:00–19:00): batch identification, provenance cards, the string wall, the Field Log, the Shiftlog wall, free Memory relearn; the weekly Archive Bounty.',
  home: 'int-archive',
  homeSpot: spot('int-archive', 'barnaby-helmet-front', { pose: 'sleep' }),
  threadId: 'the-bell',
  porch: porch('porch-archive', 'barnaby-archive-step', { litAtStart: true, hours: [hm(20), hm(23)] }),
  shopPost: { shopId: 'archive-desk', ...spot('int-archive', 'barnaby-desk'), pose: 'shop' },
  festivals: {
    'lantern-market': spot(P, 'commons-pin', { pose: 'stand', activity: 'naming finds by the board' }),
    'long-night': spot(P, 'linnet-vault-to', { pose: 'stand', facing: 'left' }),
    'late-delivery-party': spot(P, 'party-green', { pose: 'stand', activity: 'the string wall on the green' }),
    'mudlark-mile': spot(P, 'meet-odile', { pose: 'stand', activity: 'writing the race on a card' }),
  },
  schedule: [
    at({ tide: 'low', offset: -75 }, P, 'barnaby-flats', { pose: 'wander', wanderR: 2, for: 150, cond: { hour: [6, 9] }, activity: 'beachcombing before opening' }),
    at({ tide: 'low', offset: -60 }, P, 'barnaby-flats', { pose: 'wander', wanderR: 2, for: 120, priority: 'high', cond: { all: [{ hour: [19, 21] }, { not: { weather: ['storm'] } }] }, activity: 'beachcombing after closing' }),
    at({ tide: 'low', offset: -60 }, P, 'bell-dig', { pose: 'stand', for: 120, days: [SAT], priority: 'high', cond: BELL_DIG, activity: 'the Old Quay at a spring low' }),
    at(hm(6), 'int-archive', 'barnaby-helmet-front', { pose: 'stand', activity: 'polishing the helmet' }),
    at(hm(8), 'int-archive', 'string-wall-front', { pose: 'stand', activity: 'pinning strings' }),
    at(hm(9), 'int-archive', 'barnaby-desk', { pose: 'shop' }),
    at(hm(19), P, 'barnaby-archive-step', { pose: 'stand', activity: 'airing the helmet on the step' }),
    at(hm(23), 'int-archive', 'barnaby-helmet-front', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-barnaby-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('relearn', 'talk-barnaby-relearn', 5, { cond: { all: [{ npc: { id: ID, talks: { gte: 2 } } }, { party: { level: { gte: 9 } } }] }, once: true }),
    topic('bounty', 'talk-barnaby-bounty', 3, { cond: { all: [{ day: { dow: [MON] } }, { flag: 'sp.field-log' }] }, repeatDays: 7 }),
    topic('thole-luck', 'talk-barnaby-thole-luck', 6, { cond: { flag: 'np.bastien.fleet-roll' }, once: true }),
    topic('gallery', 'talk-barnaby-gallery', 6, { cond: { thread: { id: 'twelve-lights', beat: { gte: 4 } } }, once: true }),
    topic('bell-home', 'talk-barnaby-bell-home', 7, { cond: { flag: 'sp.bell-dug' }, once: true }),
    topic('relit', 'talk-barnaby-relit', 7, { cond: { flag: 'sp.relighting' }, once: true }),
    topic('heart-1', 'talk-barnaby-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 7 } } }, once: true }),
  ],
  gifts: {
    love: ['ammonite', 'old-shape-skull', 'whelk-shell', 'fleet-tally-token'],
    like: ['cockle', 'razor-shell', 'cuttlebone', 'mermaids-purse', 'sea-glass'],
    dislike: ['honeycomb', 'starsalt', 'dab'],
  },
  lines: {
    generic: [
      line('g1', 'Provenance is everything. (Where, when, what tide, who.) Without it a fossil is just a heavy stone with opinions.'),
      line('g2', 'No, the helmet fits perfectly. I simply prefer to be… snug.'),
      line('g3', 'I\'ve catalogued four hundred and twelve cockles. (They\'re all different. Nobody believes me. They\'re all different.)'),
      line('g4', 'The string wall goes from what to why. That\'s a museum. (I\'m fairly sure that\'s a museum.)'),
      line('g5', 'Sorry. I\'m being pedantic. (I\'m always being pedantic. I apologise in advance for the rest of the week.)'),
      line('g6', 'Corin\'s upstairs. He reads with his face very close to the page and he hums when it\'s a good bit. (It\'s usually a good bit.)'),
      line('g7', 'Bring me duplicates! I buy them. (I keep one of everything, and then the second one is for someone else to love.)'),
      line('g8', 'The porthole fogs when I\'m excited. Or when it\'s humid. (It\'s never humid. I\'m always excited.)'),
    ],
    known: pool([
      ['k1', 'You! Have you found anything? (You always find something. You have very good eyes. Has anyone told you that? I\'m telling you.)'],
      ['k2', 'I wrote your name on twelve provenance cards this week. (Thirteen. I miscounted. I\'m a curator, not a mathematician.)'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning! (Is it? It is.) The light comes in the porthole sideways at this hour. Excellent for reading labels. Terrible for my complexion.'],
      ['m2', 'Doors at nine. (Ten past, if I\'ve been on the flats. Fifteen past if I found something.)'],
      ['m3', 'I was on the flats at first light. (I found a pebble. It\'s a very good pebble. It\'s not anything. I love it.)'],
    ]),
    evening: evening([
      ['e1', 'The Archive\'s shut. (The wall\'s still open. The wall\'s always open. In my head.)'],
      ['e2', 'Evening\'s for writing up the cards. (I write very small. The cards are very small. It\'s a whole system.)'],
    ]),
    night: night([
      ['n1', 'Can\'t sleep. Thinking about string. (Red for letters, blue for finds, yellow for "I don\'t know yet". There\'s a lot of yellow.)'],
      ['n2', 'Night\'s when the tanks glow. The fish sleep with one eye open. (I\'ve checked. I\'ve checked a lot.)'],
    ]),
    porch: [
      line('p1', 'Sit! (Mind the step, it\'s an old step. It has provenance.)'),
      line('p2', 'From here I can see every porch on the north row. I\'ve catalogued them. (Lit, unlit, and "flickers, someone should tell Wren".)'),
      line('p3', 'Corin comes down for porch talk sometimes and doesn\'t say anything. (I talk for both of us. It works out.)'),
    ],
    sleep: [
      line('s1', '* Barnaby is asleep inside the helmet. The porthole has fogged in a small steady circle, like breath on a window.'),
    ],
    weather: weather({
      rain: 'Rain! The finds on the flats get washed clean. (Tomorrow\'s a cracking day for provenance.)',
      fog: 'Fog. (I can\'t see out of the porthole. I can\'t see out of the porthole on a clear day either. It fogs.)',
      storm: 'Storm. (Storms move things. Old things come up after a storm.) I\'ll be on the flats at the next low. (With a rope.)',
    }),
    tide: lowTide([
      ['lt1', 'It\'s LOW! (The flats! The sparkles!) Go, go. Write down which sparkle. I\'ll want to know which sparkle.'],
    ]),
    lit: relit([
      ['r1', 'The beam comes in the porthole every eight seconds. (I\'ve started measuring my days in beams. It\'s very efficient.)'],
    ]),
    unlit: dark([
      ['d1', 'There\'s one string on the wall that doesn\'t go anywhere yet. (It\'s tied to the lamp.) I keep looking at it.'],
    ]),
    lead: leads({
      plain: 'A plain creature! Plain is underrated. (Every collection needs a type specimen.)',
      grit: 'A Grit creature. It\'s digging at my floor. (It\'s found a button. Where did it find a button?) Provenance: my floor.',
      brine: 'A Brine one! (Mind the cards. Water and ink are old enemies.)',
      kiln: 'A Kiln creature. Please stand by the fossils, not the paper. (Fossils have already been through worse.)',
      moss: 'A Moss creature. (It smells of the reeds by Pell\'s. I\'d know that smell anywhere. I catalogued it.)',
      bolt: 'A Bolt creature. My helmet\'s humming. (Is that good? I\'m going to write down that it\'s humming.)',
      rime: 'A Rime creature. (The tanks have frosted at the edges. The fish are fascinated.)',
      gust: 'A Gust one. (The CARDS. Oh, the cards. It\'s fine. I\'ll re-sort. I like re-sorting.)',
      stone: 'A Stone creature. (Ooh, sedimentary or igneous? Don\'t answer, I\'ll guess. Sedimentary. It\'s got layers.)',
      rust: 'A Rust creature. It\'s looking at my helmet. (It\'s brass! It\'s fine! Brass doesn\'t rust! ~ Does it? I\'ll check.)',
      glass: 'A Glass creature. (It\'s refracting the porthole. There are tiny rainbows all over the finds. I\'m going to cry.)',
      hollow: 'A Hollow creature. (It went through the display case and the display case is still locked. That\'s a provenance problem.)',
    }),
    shift: shift([
      ['sh1', 'It Shifted! (Same mark, same spot, I can see it from here.) I\'m going to put it on the Shiftlog wall. With a card. With TWO cards.'],
    ]),
    loan: pool([
      ['l1', 'The co-op builds overnight. (I\'ve never seen them do it. I\'ve tried staying up. I fall asleep in the helmet.)', tierRange(1, 3)],
      ['l2', 'Your cottage gets a new room every few nights. (I\'m keeping a card on it. "The Keeper\'s Cottage: provenance".)', tierRange(4, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'The Spires post dossiers. (I file a copy. Of course I file a copy.)', badges(0)],
      ['b1', 'Recall\'s at the desk now. Corin does it. (He holds the creature very close to his face and then he just knows. It\'s eerie. It\'s lovely.)', { badge: 4 }],
    ], ['generic']),
    gift: gifted({
      ammonite: 'You gave me an ammonite! (Point flats, Wednesday low, the Keeper.) It\'s the centrepiece. It\'s been the centrepiece for days.',
      'whelk-shell': 'That whelk shell. (I tried it on. As a house. Just to see.) It was very nice. The helmet is nicer. Don\'t tell the whelk.',
    }),
  },
};
