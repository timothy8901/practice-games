/**
 * Ludo, fruit bat, the post-office eave. [DATA-CAST] GDD-06.
 *
 * The night buyer: hangs from the post-office eave 22:00–08:00 and buys anything at full price,
 * sells Starsalt (three a day, shared with the Raft), seedlings and moth-silk; from badge 2 he has lit
 * every Waystone you have visited (the Lantern-paths). Sleeps the day away under the eave. Easy,
 * sleepy, plain-spoken, fair to the button; hums when he counts.
 * @module data/npcs/ludo
 */

import {
  P, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tierRange, badges, topic,
} from './_helpers.js';

const ID = 'ludo';

export const scripts = {
  'talk-ludo-first': [
    { op: 'if', cond: { seen: 'ludo-first-sale' },
      then: ['Ludo: The walker. You sold me a whole tree\'s worth on your first night. I hummed the whole count. Did you hear?'],
      else: ['* Hanging upside down from the post-office eave, wrapped in his own wings like a parcel, a fruit bat opens one eye.'] },
    'Ludo: Ludo. I buy at night. Anything. Full price, always full price. Night\'s hard enough without being haggled at.',
    'Ludo: Ten at night till eight in the morning. After that I\'m asleep and very bad at sums.',
    { op: 'end' },
  ],

  'talk-ludo-starsalt': [
    'Ludo: Starsalt. You\'ll want some, now you\'re rerolling. Three a day, between me and the Raft. Varga by day, me by night. Same price. We agreed it on a napkin.',
    'Ludo: Don\'t buy it all at once just because you can. It keeps. ~ Mind, so does fruit, and nobody listens to me about fruit either.',
    { op: 'end' },
  ],

  'talk-ludo-waystones': [
    'Ludo: Have you looked at the Waystones lately? On the isles you\'ve walked?',
    'Ludo: They\'re lit. That\'s me. I fly the ring after the eave closes and light the ones with your footprints round them. ~ It\'s not far. For a bat.',
    'Ludo: Walk from one lit stone to another, or home, any tide. Old keeper\'s paths. Isolde used to say a lamp\'s for whoever\'s walking towards it.',
    { op: 'end' },
  ],

  'talk-ludo-market': [
    'Ludo: Saturday market, I\'ve a stall by the board. One foreign seedling a week, and moth-silk from the moths that come to the string lights.',
    'Ludo: Fig, peach, apricot, mulberry. Graft them at home and they\'ll fetch four times a pear. ~ I just like having them about. They smell like somewhere warm.',
    { op: 'end' },
  ],

  'talk-ludo-relit': [
    'Ludo: I was out over the Bar when it came on. ~ I nearly flew into the sea. You don\'t know what it\'s like, a light that big, when your eyes are made for the dark.',
    'Ludo: I went round twice to look. Then I came back and bought everyone\'s fish at full price. Felt like the right thing.',
    { op: 'end' },
  ],

  'talk-ludo-heart-1': [
    'Ludo: Why do I buy at full price? ~ Everybody asks. Juniper thinks it\'s bad business.',
    'Ludo: The ones who sell at three in the morning are the ones who need it. Night fishers, folk who can\'t sleep, folk who owe. You don\'t knock a button off for them. You just don\'t.',
    { op: 'end' },
  ],
};

export default {
  id: ID,
  name: 'Ludo',
  species: 'fruit bat',
  sprite: 'ludo',
  portrait: 'ludo',
  group: 'resident',
  role: 'Night buyer at full price from the post-office eave (22:00–08:00); Starsalt, seedlings, moth-silk; lights the Waystones you have visited.',
  home: P,
  homeSpot: spot(P, 'ludo-eave', { pose: 'sleep' }),
  threadId: null,
  porch: porch('porch-post-office', 'ludo-eave', { litAtStart: true, hours: [hm(20), hm(22)] }),
  shopPost: { shopId: 'ludo-eave', ...spot(P, 'ludo-eave'), pose: 'shop' },
  festivals: {
    'lantern-market': spot(P, 'market-stall-1', { pose: 'shop', activity: 'seedlings and moth-silk' }),
    'long-night': spot(P, 'wick-cliff-stair', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'market-stall-1', { pose: 'stand' }),
  },
  schedule: [
    at(hm(8), P, 'ludo-eave', { pose: 'sleep', activity: 'asleep under the eave' }),
    at(hm(20), P, 'ludo-eave', { pose: 'stand', activity: 'waking up' }),
    at(hm(22), P, 'ludo-eave', { pose: 'shop' }),
  ],
  topics: [
    topic('first', 'talk-ludo-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('starsalt', 'talk-ludo-starsalt', 6, { cond: { any: [{ flag: 'sp.reroll-taught' }, { badge: 1 }] }, once: true }),
    topic('waystones', 'talk-ludo-waystones', 7, { cond: { badge: 2 }, once: true }),
    topic('market', 'talk-ludo-market', 5, { cond: { flag: 'sp.first-market' }, once: true }),
    topic('relit', 'talk-ludo-relit', 8, { cond: { flag: 'sp.relighting' }, once: true }),
    topic('heart-1', 'talk-ludo-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 6 } } }, once: true }),
  ],
  gifts: {
    love: ['fig', 'mulberry', 'peach'],
    like: ['apricot', 'plum', 'cherry', 'moth-silk', 'starfly'],
    dislike: ['herring', 'silver-eel', 'anchor-stone'],
  },
  lines: {
    generic: [
      line('g1', 'Full price. Always. Don\'t thank me, I\'ll go all funny.'),
      line('g2', 'Someone\'s always buying. That\'s me. That\'s my whole thing.'),
      line('g3', 'Upside down, the harbor looks like it\'s hanging off the sky. You should try it. Don\'t try it.'),
      line('g4', 'I hum when I count. Hesper says it carries through the ceiling. She hums back, sometimes.'),
      line('g5', 'Fruit tastes better after midnight. Scientific fact. I did the study myself. Every night.'),
      line('g6', 'Folk think bats are spooky. We\'re just up late with good ears.'),
      line('g7', 'I\'ve seen every porch in the harbor from the air. Lit ones look like buttons on a coat.'),
      line('g8', 'Got anything with a stone in it? Plums, cherries? I spit the stones on the hill. Half the orchard up there is me.'),
    ],
    known: pool([
      ['k1', 'Evening, regular. Your usual? I don\'t know what your usual is. Whatever you\'ve got.'],
      ['k2', 'You sell me fish at three in the morning and you smell of the quay. That\'s a proper customer.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Mm. Morning. Is it? Too bright. Last sale before I close. Make it a good one.'],
      ['m2', '...Five more minutes. Then I\'m asleep. Then I\'m a parcel.'],
    ]),
    evening: evening([
      ['e1', 'Waking up. Give me a minute to remember which way is up. Usually it\'s the other way.'],
      ['e2', 'Not open till ten. You can tell me what you\'ve got, though. I like to look forward to things.'],
    ]),
    night: night([
      ['n1', 'Open. Bring it all. Fish, fruit, shells, a boot. I bought a boot once. Good boot.'],
      ['n2', 'Quiet hour. Just us and the gulls who can\'t sleep. Sell me something and I\'ll hum.'],
      ['n3', 'Flats are glowing out there at the low. Pretty, isn\'t it. Bring me what the glow gives up.'],
    ]),
    porch: [
      line('p1', 'I\'m not really on the porch. I\'m above it. Counts, Hesper says.'),
      line('p2', 'Hang about a bit. Everyone talks softer on a porch. I hear all of it. I\'m very discreet. Mostly.'),
    ],
    sleep: [
      line('s1', '* Ludo is wrapped up tight in his wings, gently swaying. A small sign pinned to the eave reads: OPEN 10 PM. FULL PRICE.'),
      line('s2', '* From inside the wings, very faintly: "...one plum... two plum..."'),
    ],
    weather: weather({
      rain: 'Rain. Wings get heavy. I\'m buying from under the eave tonight. Same price. Wetter buttons.',
      fog: 'Fog. Can\'t see a thing. Don\'t need to. I\'ve good ears and you\'ve loud boots.',
      storm: 'Storm. I\'m staying put. If the eave goes, I go. It won\'t. Wren built it.',
    }),
    tide: lowTide([
      ['lt1', 'Low water. Listen. You can hear the flats ticking as they dry. Fish down there, waiting for someone sensible.'],
    ]),
    lit: relit([
      ['r1', 'I squint now, every eight seconds. Worth it. Worth every squint.'],
    ]),
    unlit: dark([
      ['d1', 'Dark lamp, bright stars. One day it\'ll be the other way. I\'ll miss the stars. I won\'t say so.'],
    ]),
    lead: leads({
      plain: 'Plain creature. Good. Nothing fancy at three in the morning is a blessing.',
      grit: 'A Grit one. It looked at me like I owe it money. I don\'t. I pay full price.',
      brine: 'Brine lead. Smells of the night shoal. Bring me some of what it smells of.',
      kiln: 'Kiln creature. Warm. Hang it under the eave in winter, would you? For me.',
      moss: 'Moss lead. It smells like an orchard after rain. I\'ve gone all soft.',
      bolt: 'A Bolt one. My ears are ringing. Pleasantly.',
      rime: 'Rime lead. Chilly. I\'m wrapping up. More than usual.',
      gust: 'Gust creature! Careful, careful, I\'m only hanging on by my toes.',
      stone: 'A Stone creature. Heavy steps. I felt them in the eave before I saw it.',
      rust: 'A Rust one. Keep it off the post office guttering. Hesper\'s very fond of that guttering.',
      glass: 'A Glass creature. It glows a bit, in the dark. Like a moth that\'s made up its mind.',
      hollow: 'A Hollow one. Night creature, same as me. We understand each other. We nod.',
    }),
    shift: shift([
      ['sh1', 'Different shape in the dark. Same heartbeat. I can hear heartbeats. Don\'t tell anyone.'],
    ]),
    loan: pool([
      ['l1', 'Owe the yard? Sell to me at night and pay Wren in the morning. That\'s the harbor way. It\'s also my way.', tierRange(1, 3)],
      ['l2', 'Your porch is one of the bright buttons on the coat now. I see it from the Bar.', tierRange(2, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'The isles\' Waystones are dark till someone walks them. Walk them. I\'ll do the rest.', badges(0)],
      ['b1', 'Six Waystones lit and I\'ve singed my eyebrows on four of them. Worth it.', { badge: 5 }],
    ], ['generic']),
    gift: gifted({
      fig: 'You gave me a fig. A FIG. I hung there eating it till sunrise and I don\'t regret a moment.',
      mulberry: 'That mulberry. My chin was purple for two days. Hesper thought I\'d been in a fight. Best fight of my life.',
    }),
  },
};
