/**
 * Tamsin Brack, badger, dark house 1 (from the Commons project; arrives day 3). [DATA-CAST] GDD-06.
 *
 * Races you to every sparkle on the flats at a low and digs like a ferry engine. Her family's oyster
 * boat, the Tidy Sum, lies in the dry north creek without its nameboard (lead thread *The Oyster
 * Boat*); her Creelwight, Kettle, has been carrying it for thirty years. Blunt, competitive,
 * generous in defeat and worse in victory. On Drownwood by Wendel's boatyard and the drowning street
 * while the thread waits there for you. Porch Duels with Kettle.
 * @module data/npcs/tamsin
 */

import {
  P, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tierRange, badges, topic, mem, duelScript, duelTopic,
} from './_helpers.js';

const ID = 'tamsin';
/** Oyster Boat waiting at beat 2: Tamsin is on Drownwood (GDD-08 handoff). */
const BEAT2 = { thread: { id: 'oyster-boat', beat: { eq: 2 } } };
/**
 * Oyster Boat waiting at beat 1: beat 2 ("standing in the dry bed of the north creek", 08:00-18:00)
 * is next, so through its hours Tamsin keeps to the boat (the beat plays where she is; its thread
 * `where` is only a hint).
 */
const BEAT1 = { thread: { id: 'oyster-boat', beat: { eq: 1 } } };

export const scripts = {
  'talk-tamsin-first': [
    { op: 'if', cond: { seen: 'tamsin-arrives' },
      then: ['Tamsin: You\'re the one who paid for the house. The Commons Jar. ~ Thanks. I\'m not good at thanks. That was it.'],
      // she can be met at the boat, on the flats or on her step, so the narration names no place
      else: ['* A badger in a fisher\'s jersey is eating an apple, core and all, and looking you up and down without stopping.'] },
    'Tamsin: Tamsin Brack. The Bracks had oysters, once. And a boat. ~ Long story. Short version: I\'m back.',
    'Tamsin: Low tide, I\'m on the flats. You\'re welcome to come. You\'re welcome to lose.',
    { op: 'end' },
  ],

  'talk-tamsin-kettle': [
    'Tamsin: Kettle. My Creelwight. ~ The old keeper wrote my gran about him. "The creel creature the children call Kettle for the noise it makes."',
    'Tamsin: Same creature. Thirty years older and a different shape, and he still rattles when there\'s a hum in the air. ~ I thought Gran made him up. Turns out she just made up his name.',
    { op: 'end' },
  ],

  'talk-tamsin-dark-house': [
    'Tamsin: This house was dark the whole time I was gone. The Bracks\' house. ~ Somebody kept the roof on. I think it was Wren\'s dad, just because.',
    'Tamsin: First night back I sat on the step with the lamp lit and every porch on the quay row lit theirs back. ~ Don\'t tell anybody I cried. I\'ll know it was you.',
    { op: 'end' },
  ],

  'talk-tamsin-drownwood': [
    'Tamsin: You came out. ~ Good. Wendel says the drowning street goes under at high water and comes back at the low, every time, like it\'s practising.',
    'Tamsin: Kettle won\'t settle here. He keeps rattling at the water. ~ Read him for me? When you\'re ready. Not before.',
    { op: 'end' },
  ],

  'talk-tamsin-sailed': [
    'Tamsin: She floats. ~ The Tidy Sum. On water the weir gave back. I keep saying it out loud in case it stops being true.',
    'Tamsin: Kettle rides in the bow now. Rattles at every wave. ~ It\'s the happiest noise I\'ve ever heard.',
    { op: 'end' },
  ],

  'talk-tamsin-heart-1': [
    'Tamsin: I don\'t lose well. You\'ve noticed. ~ Tully loses better than anybody alive. I\'m trying to learn it off him.',
    'Tamsin: Don\'t tell him. He\'ll make a slip for the Commons board. "LOSING LESSONS. ASK TULLY." He would. He absolutely would.',
    { op: 'end' },
  ],

  'talk-tamsin-heart-2': [
    'Tamsin: Why\'d you put buttons in the Jar for my house? ~ You didn\'t know me.',
    { op: 'choice', options: [
      { text: 'A dark house is a hole in the harbor.', then: [
        ...mem(ID, 'why', 'hole'),
        'Tamsin: A hole in the harbor. ~ Yeah. It is. Was. ~ I\'m going to fill it very loudly.',
      ] },
      { text: 'Somebody did it for me first.', then: [
        ...mem(ID, 'why', 'paid-forward'),
        'Tamsin: Wren. The loan. ~ Huh. So it goes round. Like the tide. ~ I\'ll put some in for the next one.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-tamsin-duel': duelScript(ID, 'porch-tamsin', {
    ask: 'Tamsin: Kettle wants a go. He\'s been rattling at you all evening. Friendly. I\'ll still try to win. Badly. I mean I\'ll try very hard.',
    yes: 'Tamsin: Kettle. Up. ~ Don\'t rattle at them. Rattle AT them. You know what I mean.',
    no: 'Tamsin: Scared. ~ Kidding. Tomorrow, then. Kettle will sulk. He sulks like a teapot.',
  }),
};

export default {
  id: ID,
  name: 'Tamsin Brack',
  species: 'badger',
  sprite: 'tamsin',
  portrait: 'tamsin',
  group: 'resident',
  role: 'Back in dark house 1 from day 3; races you to the sparkles; the Bracks\' oyster boat (lead thread The Oyster Boat); Porch Duels with her Creelwight, Kettle.',
  home: P,
  homeSpot: spot(P, 'door-dark-1', { pose: 'sleep' }),
  threadId: 'oyster-boat',
  absent: { not: { flag: 'sp.tamsin-arrived' } },
  porch: porch('porch-dark-1', 'porch-dark-1-step', { hours: [hm(20), hm(23)] }),
  festivals: {
    'lantern-market': spot(P, 'meet-thessaly', { pose: 'stand', activity: 'arm-wrestling at the market' }),
    'mudlark-mile': spot(P, 'mudlark-finish', { pose: 'stand', activity: 'at the finish, unbearable' }),
    'long-night': spot(P, 'door-linnet', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'shift-fair', { pose: 'stand' }),
  },
  schedule: [
    at({ tide: 'low', offset: -75 }, P, 'tamsin-flats', { pose: 'wander', wanderR: 3, for: 150, cond: { all: [{ hour: [7, 19] }, { not: BEAT2 }, { not: { all: [BEAT1, { hour: [8, 18] }] } }] }, activity: 'racing to the sparkles' }),
    at({ tide: 'low', offset: -75 }, 'drownwood', 'drowning-street', { pose: 'stand', for: 150, cond: { all: [{ hour: [9, 17] }, BEAT2] }, activity: 'waiting at the drowning street with Kettle' }),
    at(hm(7), P, 'tamsin-porch', { pose: 'sit', activity: 'breakfast on the step' }),
    at(hm(8), P, 'tamsin-boat', { pose: 'stand', activity: 'the boat in the north creek' }),
    at(hm(8, 1), P, 'night-fishing', { pose: 'stand', cond: { flag: 'sp.tamsin-sailed' }, activity: 'the Tidy Sum at the slipway' }),
    at(hm(9), 'drownwood', 'tamsin-drownwood', { pose: 'stand', cond: BEAT2, activity: 'Wendel\'s boatyard on Drownwood' }),
    at(hm(13), P, 'tamsin-porch', { pose: 'sit', cond: { all: [{ not: BEAT2 }, { not: BEAT1 }] }, activity: 'lunch' }),
    at(hm(14), P, 'tamsin-boat', { pose: 'stand', cond: { not: BEAT2 } }),
    at(hm(17), P, 'tamsin-porch', { pose: 'stand', cond: { not: BEAT1 } }),
    at(hm(17, 1), P, 'tamsin-boat', { pose: 'stand', cond: BEAT1, activity: 'the boat in the north creek' }),
    at(hm(18), P, 'tamsin-porch', { pose: 'stand', cond: BEAT1 }),
    at(hm(23), P, 'door-dark-1', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-tamsin-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('kettle', 'talk-tamsin-kettle', 6, { cond: { flag: 'th.oyster-boat.kettle-named' }, once: true }),
    topic('dark-house', 'talk-tamsin-dark-house', 4, { cond: { npc: { id: ID, talks: { gte: 3 } } }, once: true }),
    topic('drownwood', 'talk-tamsin-drownwood', 5, { cond: { all: [{ map: 'drownwood' }, BEAT2] }, repeatDays: 2 }),
    topic('sailed', 'talk-tamsin-sailed', 8, { cond: { flag: 'sp.tamsin-sailed' }, once: true }),
    duelTopic(ID),
    topic('heart-1', 'talk-tamsin-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 6 } } }, once: true }),
    topic('heart-2', 'talk-tamsin-heart-2', 2, { cond: { npc: { id: ID, talks: { gte: 10 } } }, once: true }),
  ],
  gifts: {
    love: ['cockle', 'razor-shell', 'apple'],
    like: ['whelk-shell', 'lumpsucker', 'dor-beetle', 'pear'],
    dislike: ['sea-glass', 'moth-silk', 'fig'],
  },
  lines: {
    generic: [
      line('g1', 'Low tide\'s a race. Everything\'s a race if you\'re a Brack.'),
      line('g2', 'I dig. Gran dug. Gran\'s gran dug. We\'ve dug this harbor flat three times over.'),
      line('g3', 'Tully says he\'s faster than me. Tully is a lot of things.'),
      line('g4', 'Kettle rattles when he\'s happy. And when he\'s sad. And when there\'s a hum. He rattles a lot.'),
      line('g5', 'Don\'t help me up. I fell on purpose. ~ I didn\'t fall on purpose.'),
      line('g6', 'Everybody says sorry about the boat. Don\'t. It\'s a boat. It\'s waiting. Bracks are good at waiting. Badly.'),
      line('g7', 'I lost a race to a gull once. Didn\'t speak for a day. The gull still looks smug.'),
      line('g8', 'If you find a sparkle before me, I\'ll know. I always know.'),
    ],
    known: pool([
      ['k1', 'You again. Good. I need somebody to beat today.'],
      ['k2', 'You beat me to two sparkles yesterday. I\'ve been thinking about it. Constantly.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning. Apple. Core and all. Don\'t look at me like that, it\'s fibre.'],
      ['m2', 'Boat\'s still there. I check every morning. In case it walked.'],
    ]),
    evening: evening([
      ['e1', 'Evening. Mud to the elbows. Good day.'],
      ['e2', 'Sit if you\'re sitting. I\'m not good at talking but I\'m all right at sitting next to.'],
    ]),
    night: night([
      ['n1', 'Late. Kettle\'s rattling at the sky. Something up there he doesn\'t like. Or likes too much.'],
      ['n2', 'Night low soon. The flats glow. Race you. ~ No. Sit. Then race you.'],
    ]),
    porch: [
      line('p1', 'This step had moss on it a finger deep. I scrubbed it. Took a day. Worth it.'),
      line('p2', 'Every porch on the row came on when I lit mine. First night. ~ I count them now. Like Augusta. Don\'t tell her.'),
      line('p3', 'Kettle sleeps under the step. If you hear rattling, that\'s him dreaming.'),
    ],
    sleep: [
      line('s1', '* Tamsin is asleep against her own door with mud still on her paws. Under the step, something rattles softly, in time with her snoring.'),
    ],
    weather: weather({
      rain: 'Rain. Doesn\'t stop digging. Makes it worse. Makes it better.',
      fog: 'Fog on the flats. Can\'t see the sparkles. Can still beat you to them.',
      storm: 'Storm. ~ Gran used to say every storm a Brack lost a boat. I haven\'t got a boat to lose. Small mercies.',
    }),
    tide: lowTide([
      ['lt1', 'LOW. Flats. Now. Go. ~ Why are you still here?'],
    ]),
    lit: relit([
      ['r1', 'The light goes over the north creek every eight seconds. Over the boat. ~ Like it\'s checking she\'s still there. Same as me.'],
    ]),
    unlit: dark([
      ['d1', 'Gran said the fleet would come home when the light did. I used to think that was a story. ~ It\'s still a story. I just like it more.'],
    ]),
    lead: leads({
      plain: 'A plain creature. No tricks. Good. Tricks are for people who can\'t dig.',
      grit: 'A Grit one. Now that\'s a digger. Can it race? Can it race ME?',
      brine: 'A Brine creature. Kettle likes it. Kettle doesn\'t like anybody. Huh.',
      kiln: 'A Kiln creature. Warm. Keep it off the flats, it\'ll bake the cockles.',
      moss: 'A Moss one. Fine. Slow. Not a racer. Nothing wrong with that. Except everything.',
      bolt: 'A Bolt creature. Fast. I\'ll give it that. I won\'t give it a head start.',
      rime: 'A Rime creature. The mud went hard where it walked. That\'s cheating. That\'s brilliant.',
      gust: 'A Gust one. Blows the sand off the sparkles. ~ Can I borrow it? No. I\'ll win fair. Mostly.',
      stone: 'A Stone creature. Heavy. Sinks in the mud. So do I. We understand each other.',
      rust: 'A Rust creature. Kettle\'s cousin, nearly. They\'re sizing each other up.',
      glass: 'A Glass creature. Shines like a sparkle. ~ I nearly dug it up.',
      hollow: 'A Hollow creature. Kettle\'s gone very quiet. That\'s respect. Or terror. Same rattle.',
    }),
    shift: shift([
      ['sh1', 'It Shifted. ~ Same mark. Kettle\'s mark never moved either. Thirty years, two shapes. Same Kettle.'],
    ]),
    loan: pool([
      ['l1', 'Your porch is on the count. Mine too, now. We\'re both numbers. Good numbers.', tierRange(2, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'Spires. Fights in a tower. Give me the flats any day.', badges(0)],
      ['b1', 'Four badges. That\'s Drownwood done. ~ Did you see the boatyard? Wendel\'s rollers? Don\'t answer. I\'m excited.', { badge: 4 }],
    ], ['generic']),
    gift: gifted({
      cockle: 'You gave me a cockle. ~ I already had nine hundred. This one\'s the best one. Don\'t tell the others.',
      'sea-glass': 'Sea glass. ~ It\'s pretty. I don\'t know what to do with pretty. It\'s on the windowsill. It\'s fine. It\'s nice.',
    }),
  },
};
