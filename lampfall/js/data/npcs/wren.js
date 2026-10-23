/**
 * Wren Hearthwright, beaver, of Hearthwright & Daughter ("I'm the daughter"). [DATA-CAST] GDD-06.
 *
 * Holds the seven interest-free loans, counts every payment twice (three times when it's yours),
 * and is quietly terrified her first own design will disappoint. Precise, anxious, secretly funny;
 * never pressures. Yard 06:00–24:00, porch talk on the co-op porch, the point at dawn to watch the
 * Thatch tie off a roof. Porch Duels with Peg, her Scrapling.
 * @module data/npcs/wren
 */

import {
  P, SUN, MON, WED, FRI, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tier, tierRange, badges, topic, mem, duelScript, duelTopic,
} from './_helpers.js';

const ID = 'wren';

export const scripts = {
  'talk-wren-first': [
    { op: 'if', cond: { seen: 'wren-key-lantern' },
      then: [
        'Wren: Keeper. ~ Sorry. {player}. I haven\'t decided which one you are yet. I\'ll write both down.',
        'Wren: You found the cottage. Good. The door sticks in wet weather; that isn\'t a fault, it\'s a feature I haven\'t fixed.',
      ],
      else: [
        'Wren: Wren Hearthwright. Hearthwright and Daughter. I\'m the daughter.',
        'Wren: If you\'re here about the loan, I hold it. If you\'re here about anything else, I probably hold that too. We\'re a small yard.',
      ] },
    'Wren: The yard\'s open six in the morning till midnight. Pay any amount, any time. I count it twice. ~ Three times if it\'s yours. Sorry.',
    { op: 'end' },
  ],

  'talk-wren-own-design': [
    '* Wren has a roll of paper under one arm and keeps moving it to the other arm, as if it might go off.',
    'Wren: The next tier\'s yours to choose. The rooms are on the plans table in the shed. Most of them are Dad\'s, from the book.',
    'Wren: One isn\'t. ~ One\'s mine. It\'s the first thing I ever drew that I didn\'t copy. It\'s probably wrong somewhere. I\'ve checked it eleven times and it\'s probably wrong somewhere.',
    { op: 'choice', options: [
      { text: 'Show me yours first.', then: [
        ...mem(ID, 'favourite', true),
        '* She unrolls it on the nearest barrel and holds the corners down with her elbows and her tail.',
        'Wren: ...You don\'t have to say anything. ~ You looked at it for a long time. I\'m writing down that you looked at it for a long time.',
      ] },
      { text: 'I\'ll look at all of them.', then: [
        ...mem(ID, 'favourite', false),
        'Wren: Good. That\'s right. That\'s what a sensible person does. ~ It\'s the one with the round window. If you were wondering. You weren\'t.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-wren-favourite-remembered': [
    'Wren: You said you wanted to see mine first. Back at the third tier.',
    'Wren: I\'ve been thinking about it on the ladder. People don\'t usually ask to see the new thing first. They ask what Dad would do.',
    'Wren: ...Anyway. I put an extra course of shingles on the round window. Nobody asked me to. It\'s good for rain. ~ It\'s good for me.',
    { op: 'end' },
  ],

  'talk-wren-flue': [
    'Wren: Hesper brought you the stove letter. "Open the flue first, count to ten." ~ She was right, you know. I rebuilt that stove twice and it still wants the ten.',
    'Wren: Some things you don\'t fix. You learn the count.',
    { op: 'end' },
  ],

  'talk-wren-weir-order': [
    'Wren: You read the one from Josiah Stalk. The weir timber. ~ That letter was addressed to this yard.',
    'Wren: Grandad had the oak cut for a new sluice gate. Seasoned two years. Then Stalk cancelled it, and the gate on the river stayed the old one, the one that seized.',
    'Wren: We built the fence posts on the quay out of that oak. I used to sit on them. ~ I\'m going to go and count something now.',
    { op: 'end' },
  ],

  'talk-wren-square-lighthouse': [
    'Wren: Dad told you about the square lighthouse, didn\'t he. ~ I was six. Round is a bad reason. So the wind can\'t find a corner to argue with? The wind can find anything.',
    'Wren: He kept the drawing. It\'s in the book, between the boathouse and the bandstand. He says it\'s load-bearing.',
    { op: 'end' },
  ],

  'talk-wren-lamp-room-built': [
    '* Wren is standing very still at the foot of the lighthouse, looking up at the Lamp Room. Her clipboard is upside down.',
    'Wren: It\'s finished. The Thatch tied it off at twenty to six. I walked round it nine times. ~ Ten. The tenth was just to look.',
    'Wren: Dad wants to walk it tonight. On his own. With his hand on the wall. ~ If he says it\'s wrong I\'ll fix it. If he says it\'s right I don\'t know what I\'ll do.',
    { op: 'end' },
  ],

  'talk-wren-relit': [
    'Wren: I painted a new line on the yard sign this morning. You don\'t have to look. ~ "Lamp Room by W. Hearthwright."',
    'Wren: Dad ran his thumb over the letters and said the W was crooked. ~ It isn\'t. He was smiling.',
    { op: 'end' },
  ],

  'talk-wren-heart-1': [
    'Wren: Can I tell you a thing about Dad? ~ He can\'t read the plans any more. His eyes. He reads the timber instead, with his thumbs.',
    'Wren: So I sign the drawings now. W. Hearthwright. Every time I write it I feel like I\'m forging him.',
    { op: 'choice', options: [
      { text: 'You\'re not forging him. You\'re following him.', then: [
        ...mem(ID, 'forging', 'following'),
        'Wren: ...Following. ~ That\'s a better word. I\'m keeping that one.',
      ] },
      { text: 'Sign it bigger.', then: [
        ...mem(ID, 'forging', 'bigger'),
        'Wren: Bigger! ~ Ha. He\'d like that. He always said a signature should be readable from across a room.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-wren-heart-2': [
    'Wren: People think the loans are the scary part. Owing. ~ They\'re not. Owing\'s just arithmetic.',
    'Wren: The scary part is you trusting me to build the thing you\'ll sleep under. Every night. Under my nails and my maths.',
    'Wren: That\'s why I count twice. ~ Three times. Sorry. I\'ll stop apologising for that. Tomorrow.',
    { op: 'end' },
  ],

  'talk-wren-duel': duelScript(ID, 'porch-wren', {
    ask: 'Wren: Peg\'s been gnawing the porch rail all week. She needs a duel more than the rail needs gnawing. Friendly. Nobody owes anybody anything after.',
    yes: 'Wren: Peg. Up. ~ Mind her left. She leads with her left.',
    no: 'Wren: That\'s fine. Peg will gnaw the rail. I\'ll replace the rail. It\'s a whole economy.',
  }),
};

export default {
  id: ID,
  name: 'Wren Hearthwright',
  species: 'beaver',
  sprite: 'wren',
  portrait: 'wren',
  group: 'resident',
  role: 'Holds the seven loans at the co-op yard; counts payments on the abacus; draws the commissions and the Lamp Room. Porch Duels with Peg.',
  home: P,
  homeSpot: spot(P, 'door-coop-yard', { pose: 'sleep' }),
  threadId: null,
  porch: porch('porch-coop-yard', 'porch-coop-yard-step', { litAtStart: true, hours: [hm(20), hm(23)] }),
  festivals: {
    'lantern-market': spot(P, 'market-stall-3', { pose: 'stand', activity: 'co-op stall: string lights' }),
    'long-night': spot(P, 'porchlight-player', { pose: 'stand' }),
    'late-delivery-party': spot(P, 'market-stall-3', { pose: 'stand' }),
  },
  schedule: [
    at(hm(5, 20), P, 'point-dawn', { pose: 'stand', facing: 'up', activity: 'watching the Thatch tie off a roof' }),
    at(hm(6), P, 'wren-yard', { pose: 'stand', activity: 'the yard' }),
    at(hm(6, 1), 'int-yard-shed', 'wren-ledger', { pose: 'stand', weather: ['rain', 'storm'], activity: 'the ledger, out of the rain' }),
    at(hm(12), P, 'commons-pin', { pose: 'stand', days: [MON, WED, FRI], activity: 'counting the Commons Jar' }),
    at(hm(12, 45), P, 'wren-yard', { pose: 'stand' }),
    at(hm(14), P, 'point-skywatch', { pose: 'sit', days: [SUN], activity: 'drawing the lighthouse' }),
    at(hm(16), P, 'wren-yard', { pose: 'stand', days: [SUN] }),
    at(hm(19), P, 'yard-payment', { pose: 'stand', activity: 'the yard by lamplight' }),
    at(hm(23), P, 'wren-yard', { pose: 'sit', activity: 'drafting by lamplight' }),
    at(hm(23, 59), P, 'door-coop-yard', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-wren-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('own-design', 'talk-wren-own-design', 7, { cond: { loan: { tier: { gte: 3 } } }, once: true }),
    topic('favourite-remembered', 'talk-wren-favourite-remembered', 6, { cond: { all: [{ flag: 'np.wren.favourite', is: true }, { loan: { tier: { gte: 5 } } }] }, once: true }),
    topic('flue', 'talk-wren-flue', 6, { cond: { flag: 'np.wren.flue' }, once: true }),
    topic('weir-order', 'talk-wren-weir-order', 6, { cond: { flag: 'np.wren.weir-order' }, once: true }),
    topic('square-lighthouse', 'talk-wren-square-lighthouse', 5, { cond: { flag: 'np.ambrose.alder-floor' }, once: true }),
    topic('lamp-room-built', 'talk-wren-lamp-room-built', 8, { cond: { all: [{ flag: 'sp.lamp-room-built' }, { not: { flag: 'sp.relighting' } }] }, once: true }),
    topic('relit', 'talk-wren-relit', 8, { cond: { flag: 'sp.relighting' }, once: true }),
    duelTopic(ID),
    topic('heart-1', 'talk-wren-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 5 } } }, once: true }),
    topic('heart-2', 'talk-wren-heart-2', 2, { cond: { all: [{ npc: { id: ID, talks: { gte: 12 } } }, { flag: 'np.wren.forging' }] }, once: true }),
  ],
  gifts: {
    love: ['timber', 'fruit-seedling'],
    like: ['quince', 'pear', 'honeycomb', 'brass-tide-gauge', 'crinoid-stem'],
    dislike: ['lumpsucker', 'dor-beetle', 'anchor-stone'],
  },
  lines: {
    generic: [
      line('g1', 'Pay it when you can. I mean that. I wrote it on the ledger so I can\'t take it back.'),
      line('g2', 'Tally sticks don\'t lie. People do, sometimes, about money. Sticks just get notched.'),
      line('g3', 'I counted the beads on the abacus this morning. Two hundred. Same as yesterday. ~ I check.'),
      line('g4', 'Dad says a good joint is one nobody notices. I\'ve made a few people notice. On purpose. Sometimes.'),
      line('g5', 'If you see shavings in the street, that\'s us. If you see shavings in your tea, that\'s also us. Sorry.'),
      line('g6', 'The Thatch charge in seed. I keep a sack behind the shed. They\'re very strict about the sack.'),
      line('g7', 'I\'m not anxious. I\'m thorough. ~ It\'s a fine line. I\'ve measured it.'),
      line('g8', 'We build while you sleep. It\'s not a slogan. It\'s just when the light\'s best for the Thatch.'),
    ],
    known: pool([
      ['k1', 'You again. Good. I mean: hello. I mean good, and hello.'],
      ['k2', 'I put your name on the ledger in ink now. Pencil\'s for people who might leave.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning. The Thatch were up before me. I hate that. I\'m very proud of them.'],
      ['m2', 'First light\'s for checking joints. Second light\'s for tea. There is no third light. There\'s just work.'],
      ['m3', 'I saw the scaffold from the yard at dawn. One section higher. I always look first thing. ~ Don\'t tell anyone I look.'],
    ]),
    evening: evening([
      ['e1', 'Evening. If you\'re paying, the abacus is warmed up. If you\'re not, sit. Both are fine.'],
      ['e2', 'The porches come on one by one about now. I count them. Of course I count them.'],
    ]),
    night: night([
      ['n1', 'Still up? Me too. Drafting. The lines are straighter at night. ~ Or I\'m less fussy. One of those.'],
      ['n2', 'Late. Somebody\'s always buying, Ludo says. Somebody\'s always building, I say. We\'re both very tired.'],
    ]),
    porch: [
      line('p1', 'Sit a minute? The step\'s level. I levelled it. Twice.'),
      line('p2', 'Dad\'s inside listening to the kettle. He says he can hear when it\'s about to boil. He\'s never wrong.'),
      line('p3', 'From here you can see your porch. I like seeing it lit. It\'s the only thing in the harbor I can point at and say: we did that.'),
    ],
    sleep: [
      line('s1', '* Wren is asleep sitting up against the door, a pencil still behind one ear.'),
      line('s2', '* A soft snore, then, without waking: "...three times..."'),
    ],
    weather: weather({
      rain: 'Rain\'s good for timber that\'s already up and bad for timber that isn\'t. I\'m inside today with the ledger. Come in.',
      fog: 'Fog. The Thatch won\'t fly in it. They sit on the shed roof and look offended.',
      storm: 'Storm\'s blowing. Everything we built is fine. I went round and checked. Twice. In the rain. Don\'t tell Dad.',
    }),
    tide: lowTide([
      ['lt1', 'Low water. You can see the old slipway stones from the yard. Grandad laid those. They\'re still level. Annoyingly.'],
    ]),
    lit: relit([
      ['r1', 'The beam goes over the yard every eight seconds. I timed it. It\'s eight. I made sure it was eight.'],
      ['r2', 'I keep looking up at the Lamp Room when the beam passes. I\'m going to walk into a post one of these nights.'],
    ]),
    unlit: dark([
      ['d1', 'One day I\'ll build that Lamp Room. In my head it\'s already up. In my head it\'s also slightly wrong somewhere.'],
    ]),
    lead: leads({
      plain: 'Plain creature. Nothing fancy. Dad says the plain joints carry the house.',
      grit: 'Ooh, a Grit one. Peg would like to fight that. Peg would like to fight a fence post.',
      brine: 'Brine lead. Keep it off the timber stacks, please. Wet alder\'s fine; wet oak sulks.',
      kiln: 'A Kiln creature in a wood yard. I\'m being very calm about it. Very calm. Please stand over there.',
      moss: 'Moss lead! It\'s been sniffing the sawdust. Moss things like sawdust. So does mould. I don\'t like to think about that.',
      bolt: 'Bolt lead. Its whiskers just stood up near the abacus. Brass beads. I\'m not sure that\'s safe for either of them.',
      rime: 'A Rime one. The shavings frosted when it walked past. That\'s beautiful and also a problem for the glue.',
      gust: 'Gust lead. Hold onto the plans. No, really, hold onto the plans.',
      stone: 'Stone creature. Solid. If it ever wants a job, the Thatch could use a ballast.',
      rust: 'Rust lead. Please don\'t let it lick the nails. It\'s looking at the nails.',
      glass: 'Glass lead. It catches the lamp. I could design a whole room around how that thing catches the lamp.',
      hollow: 'A Hollow creature. It went straight through the timber stack. Not through the gap. Through the stack.',
    }),
    shift: shift([
      ['sh1', 'It Shifted. It\'s still yours, though. Look, the mark\'s exactly where it was. I measured. With my eyes.'],
      ['sh2', 'New shape. Same creature. Dad says a house is the same house after a new roof. I always thought that was just something builders say.'],
    ]),
    loan: pool([
      ['l1', 'Six thousand. No interest, no deadline. Errands count. I\'ll be at the yard tonight with the abacus.', tier(1)],
      ['l2', 'The cottage next. Two rooms and a mirror. I\'ve drawn the mirror three times. It kept reflecting badly on me.', tier(2)],
      ['l3', 'You\'re choosing rooms now. That still frightens me a little. In a good way. Mostly.', tierRange(3, 5)],
      ['l4', 'We\'re near the top of the stick. After this it\'s the Lamp Room. I keep not saying it in case it hears me.', tier(6)],
      ['l5', 'The last stick. Eighty thousand. The Lamp Room. I\'m not nervous. I\'ve just measured the same rafter four times.', tier(7)],
      ['l6', 'All seven sticks split. Your halves on your wall, ours in the book. I read the book at night now. For fun.', { loan: { tier: { gte: 8 } } }],
    ], ['generic']),
    badge: pool([
      ['b0', 'You\'ve not been to a Spire yet. Fine by me. Buttons from trees spend exactly the same.', badges(0)],
      ['b1', 'Every badge sends a notch to my ledger, from Hollis\'s fund. I never know where to look when it arrives.', { all: [{ badge: 1 }, { not: { badge: 4 } }] }],
      ['b2', 'That\'s a lot of wax seals on your wall. They hang straight, at least. I hung them.', { badge: 4 }],
    ], ['generic']),
    gift: gifted({
      timber: 'You brought me timber that time. Nobody brings a builder timber. It\'s like bringing a baker flour. I loved it.',
      quince: 'That quince you gave me. I made a paste and Dad ate all of it. That was the review.',
    }),
  },
};
