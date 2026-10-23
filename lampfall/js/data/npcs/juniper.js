/**
 * Juniper Pell, magpie, Pell's Sundries. [DATA-CAST] GDD-06.
 *
 * A theatrical haggler with a soft centre who always lets you win; collects stories more than
 * objects; freezes mid-sentence when something glints and dives behind the counter at the first
 * bee. Secretly the harbor's pawnbroker in reverse (thread *Heirlooms Going Home*). Shop 08:00–22:00,
 * porch after closing, sweeps the step at seven. Porch Duels with her Wirewhisk.
 * @module data/npcs/juniper
 */

import {
  P, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tier, tierRange, badges, topic, mem, duelScript, duelTopic,
} from './_helpers.js';

const ID = 'juniper';

export const scripts = {
  'talk-juniper-first': [
    '* A magpie leans across the counter on both elbows, as if she has been waiting all morning for exactly you.',
    'Juniper: A NEW face! In MY shop! Juniper Pell, of Pell\'s Sundries, open every day, closed never, robbed constantly.',
    'Juniper: Buttons! My favourite currency. Don\'t tell the other currencies. ~ What have you got for me? Fruit? Fish? Something that shi— ~ ...',
    '* She has stopped mid-word, staring at a brass button on your coat.',
    'Juniper: ...Sorry. That button\'s doing something to me. Anyway! Staples on the shelves, two discs a day in the case, and three things I\'m mad for on the Wanted board.',
    { op: 'end' },
  ],

  'talk-juniper-shop-sense': [
    'Juniper: Shall I tell you how to rob me properly? Since you\'re going to anyway.',
    'Juniper: Wanted Today. Three things on the board by the door, half again on top, one stack each. Read it before you sell to Ludo. Ludo pays fair. I pay theatrical.',
    'Juniper: Wicks, salves, Crackdust, the lot: never randomized. If it\'s on my shelf today it\'s on my shelf tomorrow. A shop you can\'t predict isn\'t a shop. It\'s a raffle.',
    { op: 'choice', options: [
      { text: 'You\'re very generous.', then: [
        ...mem(ID, 'generous', 'said'),
        'Juniper: Generous! Me! I\'m a monster of commerce. ~ ...Don\'t tell anybody you said that. I\'ve a reputation.',
      ] },
      { text: 'I\'m going to haggle you into the ground.', then: [
        ...mem(ID, 'generous', 'haggle'),
        'Juniper: OH, I hope so. Nobody haggles any more. They just pay. It\'s heartbreaking.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-juniper-back-room': [
    '* The door to the back room is half open. Inside, shelves of bundles wrapped in brown paper, each tied with string and a label in faded ink.',
    'Juniper: Don\'t look in there. ~ You looked. Everybody looks. It\'s stock. Old stock. Very old, very not-for-sale stock.',
    'Juniper: Some things you keep because they\'re worth something. Some things you keep because they\'re worth someone. ~ Ignore me. I\'ve been dusting. Dust makes me profound.',
    { op: 'end' },
  ],

  'talk-juniper-lantern-named': [
    'Juniper: You read the one about the lantern on the counter. My counter. ~ My GRANDMOTHER\'S counter.',
    'Juniper: Don\'t ask me. Not yet. If I tell you where it is I\'ll want to give it to you, and if I give it to you now, where\'s my entrance?',
    'Juniper: A lantern like that wants a lit room to come home to. When there is one. ~ I\'m being mysterious. I\'m enjoying it enormously.',
    { op: 'end' },
  ],

  'talk-juniper-agnes': [
    'Juniper: Gran ran this shop through the Ebb winter on a slate. Flour, oats, the good tea. Every house on the quay.',
    'Juniper: Nobody paid. Nobody could. The fleet was gone. ~ She wiped the slate the spring she died. I found it in the cellar years later, still with the chalk ghosts on.',
    'Juniper: That\'s why I buy things back. ~ There. I said it. Don\'t make a face. You\'re making a face.',
    { op: 'end' },
  ],

  'talk-juniper-relit': [
    'Juniper: The back room shelf is empty. Thirty years I\'ve dusted round that blue bundle, and now there\'s just a clean square in the dust.',
    'Juniper: I keep going in there to look at the square. ~ It\'s the best-looking square I\'ve ever seen.',
    { op: 'end' },
  ],

  'talk-juniper-heart-1': [
    'Juniper: People think magpies steal shiny things. ~ We don\'t steal them. We keep them safe until somebody notices they\'re missing.',
    'Juniper: Most people never notice. ~ That\'s the sad part. Not the keeping. The never noticing.',
    { op: 'end' },
  ],

  'talk-juniper-heart-2': [
    'Juniper: Do you know why I always let you win the haggle? ~ Of course you do. You\'re clever. Do you know why I make a fuss about it?',
    { op: 'choice', options: [
      { text: 'So I feel like I\'ve earned it.', then: [
        ...mem(ID, 'fuss', 'earned'),
        'Juniper: Yes. ~ Owing is easy. Winning is rare. Everybody in this harbor deserves to win a haggle once a day.',
      ] },
      { text: 'Because you enjoy it.', then: [
        ...mem(ID, 'fuss', 'enjoy'),
        'Juniper: Because I ENJOY it! ~ Ha! Yes! Finally someone who understands theatre.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-juniper-duel': duelScript(ID, 'porch-juniper', {
    ask: 'Juniper: A duel on my porch! Under my lamp! I\'ll even sell you a Salve after at full price. Friendly price. Full friendly price.',
    yes: 'Juniper: Wirewhisk, darling, they\'ve come to be robbed. Show them the door. Politely.',
    no: 'Juniper: Your loss. ~ Your gain, really. My Wirewhisk is shameless.',
  }),
};

export default {
  id: ID,
  name: 'Juniper Pell',
  species: 'magpie',
  sprite: 'juniper',
  portrait: 'juniper',
  group: 'resident',
  role: 'Keeps Pell\'s Sundries 08:00–22:00: staples, two discs a day, Wanted Today, the back room of heirlooms. Porch Duels with her Wirewhisk.',
  home: P,
  homeSpot: spot(P, 'door-pells', { pose: 'sleep' }),
  threadId: 'heirlooms-going-home',
  porch: porch('porch-pells', 'porch-pells-step', { litAtStart: true, hours: [hm(22), hm(24)] }),
  shopPost: { shopId: 'pells-sundries', ...spot('int-pells', 'juniper-counter'), pose: 'shop' },
  festivals: {
    'lantern-market': spot(P, 'market-stall-2', { pose: 'shop', activity: 'Pell\'s market stall' }),
    'long-night': spot(P, 'relighting-juniper', { pose: 'stand', facing: 'left' }),
    'late-delivery-party': spot(P, 'market-stall-2', { pose: 'stand' }),
  },
  schedule: [
    at(hm(7), P, 'juniper-pells-step', { pose: 'sweep', activity: 'sweeping the step' }),
    at(hm(8), 'int-pells', 'juniper-counter', { pose: 'shop' }),
    at(hm(22), P, 'porch-pells-step', { pose: 'sit', activity: 'counting the till on the step' }),
    at(hm(23, 59), P, 'door-pells', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-juniper-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('shop-sense', 'talk-juniper-shop-sense', 6, { cond: { npc: { id: ID, talks: { gte: 1 } } }, once: true }),
    topic('back-room', 'talk-juniper-back-room', 5, { cond: { all: [{ npc: { id: ID, talks: { gte: 3 } } }, { map: 'int-pells' }] }, once: true }),
    topic('lantern-named', 'talk-juniper-lantern-named', 6, { cond: { flag: 'th.heirlooms-going-home.lantern-named' }, once: true }),
    topic('agnes', 'talk-juniper-agnes', 4, { cond: { all: [{ flag: 'th.heirlooms-going-home.slate' }, { npc: { id: ID, talks: { gte: 6 } } }] }, once: true }),
    topic('relit', 'talk-juniper-relit', 7, { cond: { flag: 'sp.relighting' }, once: true }),
    duelTopic(ID),
    topic('heart-1', 'talk-juniper-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 8 } } }, once: true }),
    topic('heart-2', 'talk-juniper-heart-2', 2, { cond: { npc: { id: ID, talks: { gte: 14 } } }, once: true }),
  ],
  gifts: {
    love: ['sea-glass', 'skyglass-bead', 'brass-tide-gauge', 'fleet-tally-token'],
    like: ['cherry', 'starfly', 'whelk-shell', 'mackerel'],
    dislike: ['honeycomb', 'bush-cricket', 'dor-beetle'],
  },
  lines: {
    generic: [
      line('g1', 'You\'re robbing me! ~ Carry on. I\'m enjoying it.'),
      line('g2', 'Every object in this shop has a story. Most of them are lies. The good ones are true.'),
      line('g3', 'If a bee comes in, I am not here. I am under the counter. I have always been under the counter.'),
      line('g4', 'Buttons, buttons, buttons. I dream in buttons. Brass ones. Round ones. One with an anchor on that I\'ve never been able to find.'),
      line('g5', 'Pell\'s has never closed a day. Not the Ebb winter, not the great hailstorm, not the time Ambrose sat on the till.'),
      line('g6', 'Thirty oranges and you want HOW much? ~ Fine. FINE. You\'re robbing me blind and I\'m charmed.'),
      line('g7', 'Something in your satchel just glinted and I lost my whole train of thought. What were we— ~ Never mind.'),
      line('g8', 'I collect stories. Objects are just how the stories travel.'),
    ],
    known: pool([
      ['k1', 'My favourite thief! Come in, come in, rob me slowly.'],
      ['k2', 'I put the good salves at eye level for you. Don\'t tell the other customers. There are no other customers. Don\'t tell them anyway.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning! The step\'s swept, the brass is polished, and I\'ve already sold a wick to a gull. Long story.'],
      ['m2', 'Doors at eight, darling. Not seven fifty-nine. I have standards and a broom.'],
      ['m3', 'Wanted board\'s up. Three beauties. Go and look. Go! Shoo! Come back rich!'],
    ]),
    evening: evening([
      ['e1', 'Evening trade\'s the best trade. People get sentimental after six. They buy candles.'],
      ['e2', 'Two hours to close and I\'ve haggled myself into the poorhouse twice. Wonderful day.'],
    ]),
    night: night([
      ['n1', 'Shop\'s shut. I\'m just out here counting the till by porch light. Badly. On purpose. It\'s calming.'],
      ['n2', 'Ludo\'s got the night trade now. He pays fair. I pay theatrical. The harbor needs both.'],
    ]),
    porch: [
      line('p1', 'Sit with me. Tell me something you found today. Not the thing. The story.'),
      line('p2', 'My grandmother sat on this step every night of the Ebb winter with the slate in her lap. ~ Not doing sums. Just sitting with them.'),
      line('p3', 'Do you see the porches coming on along the quay? Each one is a house that\'s still here. I count them like coins.'),
    ],
    sleep: [
      line('s1', '* Juniper is asleep with her head under one wing, one eye opening a crack whenever something on your coat catches the light.'),
    ],
    weather: weather({
      rain: 'Rain! Umbrellas, oilskins, warm shawls: rain is a magpie\'s market. I love rain. Don\'t tell the sun.',
      fog: 'Fog. Nobody can see what they\'re buying. Very good for business. Very bad for my conscience. I\'m labelling everything twice.',
      storm: 'Storm\'s up. I\'ve battened the shutters and the brass is all under a blanket. It doesn\'t like thunder. Neither do I.',
    }),
    tide: lowTide([
      ['lt1', 'Low tide! Go and dig. The flats glitter at a low and I can\'t go, I\'ll never come back. Bring me the glitter.'],
    ]),
    lit: relit([
      ['r1', 'The beam goes over the shop sign now and the gilt lights up every eight seconds. I\'ve sat in the street watching it. Twice. Tonight.'],
    ]),
    unlit: dark([
      ['d1', 'Some things in the back room are waiting for the right porch to light. I can wait too. I\'m a patient monster of commerce.'],
    ]),
    lead: leads({
      plain: 'A plain creature! The classics never go out of fashion. Like brass.',
      grit: 'A Grit one. Mind the jars. ~ MIND THE JARS. Thank you.',
      brine: 'Brine lead, dripping on my nice floor. ~ It\'s fine. Floors can be mopped. Hearts can\'t.',
      kiln: 'A Kiln creature! Keep it off the candles. I\'ve a whole shelf that\'ll go at once and I\'d be heartbroken and also on fire.',
      moss: 'A Moss creature. It\'s eating my pot plant. ~ It can have the pot plant. It\'s very charming.',
      bolt: 'A Bolt one! Oh, it makes the brass hum. Can it do that on purpose? Could I hire it?',
      rime: 'A Rime creature. My till\'s frosted shut. That is, financially speaking, a disaster. Aesthetically, divine.',
      gust: 'Gust lead. The price tags are all over the floor now. Fine. Everything\'s free. NO. Everything\'s where it was.',
      stone: 'A Stone creature. Solid. Dependable. The opposite of me in every way. I adore it.',
      rust: 'Rust lead! Oh no. Not near the brass. Not near the BRASS.',
      glass: 'A Glass creature. ~ ...I\'m sorry, I wasn\'t listening, it\'s doing something with the light and I\'ve gone all magpie.',
      hollow: 'A Hollow one. It went into the back room. Through the wall. ~ Ask it what it saw. No, don\'t.',
    }),
    shift: shift([
      ['sh1', 'It Shifted! Oh, it\'s gorgeous. It\'s still yours, it still looks at you first. That\'s the bit that matters. The rest is wrapping.'],
    ]),
    loan: pool([
      ['l1', 'Owe Wren six thousand? Sell me things. I\'ll pretend to be ruined. We\'ll both feel better.', tier(1)],
      ['l2', 'Your cottage has rooms now. Rooms need things. Things are my department.', tierRange(2, 5)],
      ['l3', 'Nearly at the top of the stick! I\'m going to cry at the Relighting. I\'ve bought a handkerchief. It\'s silk. It\'s for sale.', tierRange(6, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'No badges yet? The Spire share is real money, you know. Hollis pays into Wren\'s ledger. Go and get punched by a goose.', badges(0)],
      ['b1', 'The discs in the case change with your badges. Not the price. The price is the price. I\'m theatrical, not crooked.', { badge: 1 }],
    ], ['generic']),
    gift: gifted({
      'sea-glass': 'You gave me sea glass. Green. I hold it up to the window every morning and the whole shop goes underwater for a second.',
      honeycomb: 'You gave me HONEYCOMB. Where the BEES live. ~ I know you meant well. I put it in the cellar. I\'m not going in the cellar.',
    }),
  },
};
