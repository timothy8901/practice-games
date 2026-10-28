/**
 * Tully, wombat, the quay row. [DATA-CAST] GDD-06.
 *
 * Loud, warm, physical, relentlessly encouraging; everything is a rep. Gives everyone a nickname
 * within a day and takes it brilliantly when you decline or counter ("Ooh, better. Locked in.").
 * Times his own laps of the green at dawn, trains on the point flats at a daytime low, argues with
 * Bryony over the fence, keeps one eye on the Porch Duel slate. Lead thread *The Mudlark Mile*; trains
 * in your Training Yard once it is built. Porch Duels with his Scrapling, Scamp.
 *
 * Merge notes: the first nickname is offered by the story script `tully-nickname` ("Lampy"; the
 * Commons-board errand), kept here as the `nickname` topic; his loop is the shared `tully-flats-lap`.
 * @module data/npcs/tully
 */

import {
  P, MON, TUE, WED, THU, FRI, SAT, SUN, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads,
  shift, lowTide, relit, dark, gifted, tier, tierRange, badges, topic, mem, duelScript, duelTopic,
} from './_helpers.js';

const ID = 'tully';

export const scripts = {
  'talk-tully-first': [
    { op: 'if', cond: { seen: 'tully-nickname' },
      then: [
        { op: 'if', cond: { npc: { id: ID, nickname: true } },
          then: ['Tully: {npcNick}! There they are! Strong carrying arm on you. I said that already. Still true.'],
          else: ['Tully: {player}! Your actual name! I\'m practising it. It\'s a good name. Very... nameish.'] },
      ],
      else: [
        'Tully: NEW NEIGHBOR! Welcome! Tully. Quay row, blue step, fastest kid on the green. Strong carrying arm on you.',
        'Tully: I\'m working on a nickname for you. Everybody gets one. It\'s the law. My law. ~ It\'ll come to me. They always come on lap three.',
      ] },
    { op: 'end' },
  ],

  'talk-tully-nickname-again': [
    'Tully: Right. I\'ve been thinking. Very hard. In the bath. ~ You didn\'t want a nickname. Fine. But that was before I thought of THIS one.',
    { op: 'nickname', who: ID, offer: 'Lantern' },
    { op: 'if', cond: { npc: { id: ID, nickname: true } },
      then: ['Tully: YES. Locked in. ~ Or you gave me a better one. Either way: locked. In.'],
      else: ['Tully: Still no! Respect. Huge respect. I\'m retiring from nicknaming you. ~ For a week. Minimum.'] },
    { op: 'end' },
  ],

  'talk-tully-nickname-check': [
    'Tully: {npcNick}. ~ Still good? You can tell me if it\'s not. I won\'t cry. I might do a lap.',
    { op: 'choice', options: [
      { text: 'It\'s perfect. Keep it.', then: [
        ...mem(ID, 'nick-check', 'keep'),
        'Tully: Perfect! Locked in forever. Carved. I\'d carve it if Ambrose let me near a chisel.',
      ] },
      { text: 'Let me pick a new one.', then: [
        ...mem(ID, 'nick-check', 'change'),
        { op: 'nickname', who: ID },
        'Tully: Ooh, better. Locked in.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-tully-duels-explained': [
    'Tully: You know about Porch Duels? ~ You don\'t! Brilliant, I get to explain.',
    'Tully: Augusta posts three offers a night on the Commons board. Neighbours, leaders you\'ve beaten, route folk. You go to their porch after seven, you have a friendly duel, they pay thirty a level. Nobody loses anything. Somebody makes tea.',
    'Tully: Scamp\'s on the slate most weeks. Scamp is fast. Scamp says.',
    { op: 'end' },
  ],

  'talk-tully-fence-side': [
    { op: 'if', cond: { flag: 'th.the-fence.side', is: 'tully' },
      then: ['Tully: You took my side on the fence. ~ Nobody ever takes my side on the fence. I\'m going to be insufferable about it. In a nice way.'] },
    { op: 'if', cond: { flag: 'th.the-fence.side', is: 'bryony' },
      then: ['Tully: You took Bryony\'s side. ~ Fair. Her beans were there first. My laps were there loudest.'] },
    { op: 'if', cond: { flag: 'th.the-fence.side', is: 'broker' },
      then: ['Tully: You got us both to the fence and made us shake. Over the beans. She\'s got a grip like a vice. I respect it.'] },
    'Tully: The new posts are low enough to talk over now. We talk over them. Mostly about the fence.',
    { op: 'end' },
  ],

  'talk-tully-after-mile': [
    'Tully: I keep looking at my feet. ~ They ran the Mudlark Mile. These ones. The slowest feet on the coast. All the way.',
    'Tully: You still got the sweatband? Don\'t wash it. ~ Do wash it. Wash it once. For the sake of the harbor.',
    { op: 'end' },
  ],

  'talk-tully-heart-1': [
    'Tully: Odile painted me mid-lap once. Running past her easel. ~ I cried. Don\'t tell anyone. I\'m telling you, so now you\'re anyone.',
    'Tully: It wasn\'t because it was a good painting. It was. It\'s because she made me look like I was going somewhere.',
    { op: 'end' },
  ],

  'talk-tully-duel': duelScript(ID, 'porch-tully', {
    ask: 'Tully: Scamp ran three laps this morning. In my head. Duel? Friendly! Fast-friendly. The fastest kind of friendly.',
    yes: 'Tully: SCAMP! Go go go! ~ Mind the step. Scamp, mind the step.',
    no: 'Tully: Respect. Scamp will do push-ups instead. Scamp cannot do push-ups. Scamp will try.',
  }),
};


export default {
  id: ID,
  name: 'Tully',
  species: 'wombat',
  sprite: 'tully',
  portrait: 'tully',
  group: 'resident',
  role: 'Nicknames for everyone (accept / decline / counter); dawn laps; the Porch Duel slate; lead thread The Mudlark Mile; trains in your Training Yard. Porch Duels with Scamp.',
  home: P,
  homeSpot: spot(P, 'door-tully', { pose: 'sleep' }),
  threadId: 'mudlark-mile',
  porch: porch('porch-tully', 'porch-tully-step', { litAtStart: true, hours: [hm(20), hm(23)] }),
  nickname: {
    offer: 'Lampy',
    second: 'Lantern',
    accept: 'Locked in. ~ Ooh, I like that on you.',
    decline: 'No? Respect. Respect! I\'ll use your real name and think about it really hard.',
    counter: 'Ooh, better. Locked in.',
  },
  festivals: {
    'lantern-market': spot(P, 'tully-nickname', { pose: 'stand', activity: 'reading the slate out loud' }),
    'mudlark-mile': spot(P, 'mudlark-start', { pose: 'stand', activity: 'on the start line' }),
    'long-night': spot(P, 'relighting-crowd-1', { pose: 'stand', facing: 'up' }),
    'late-delivery-party': spot(P, 'tully-nickname', { pose: 'stand' }),
  },
  schedule: [
    at({ tide: 'low', offset: -75 }, P, 'mudlark-start', { pose: 'wander', wanderR: 3, for: 150, cond: { hour: [9, 17] }, activity: 'training on the flats' }),
    at(hm(6), P, 'tully-lap-1', { pose: 'path', path: 'tully-flats-lap', activity: 'laps of the green' }),
    at(hm(8), P, 'tully-nickname', { pose: 'stand', activity: 'reading the Porch Duel slate' }),
    at(hm(10), P, 'mail-sack', { pose: 'stand', activity: 'reps with creels on the quay' }),
    at(hm(12), P, 'tully-porch', { pose: 'sit', activity: 'lunch on the step' }),
    at(hm(14), P, 'fence-bryony-tully', { pose: 'stand', days: [MON, WED, FRI], activity: 'discussing the fence' }),
    at(hm(14, 1), P, 'tully-lap-4', { pose: 'stand', days: [TUE, THU, SAT, SUN], activity: 'stretching on the green' }),
    at(hm(17), P, 'commons-training-yard', { pose: 'stand', cond: { flag: 'sys.commons.training-yard-green' }, activity: 'training on the green yard' }),
    at(hm(17, 1), P, 'porchlight-player', { pose: 'stand', cond: { flag: 'sys.build.training-yard' }, activity: 'training in the Keeper\'s yard' }),
    at(hm(19), P, 'tully-porch', { pose: 'stand' }),
    at(hm(23), P, 'door-tully', { pose: 'sleep' }),
  ],
  topics: [
    // the scene pins your notice on the Commons board, so it plays only by the board (the square);
    // elsewhere Tully's ordinary first-meeting talk runs and the errand waits for the pin
    topic('nickname', 'tully-nickname', 11, { once: true, cond: { all: [{ flag: 'sp.errands-started' }, { not: { seen: 'tully-nickname' } }, { map: 'pellwick' }, { inRegion: 'commons-square' }] } }),
    topic('first', 'talk-tully-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('nickname-again', 'talk-tully-nickname-again', 7, { cond: { all: [{ seen: 'tully-nickname' }, { npc: { id: ID, nickname: false } }, { npc: { id: ID, talks: { gte: 3 } } }] }, once: true }),
    topic('nickname-check', 'talk-tully-nickname-check', 3, { cond: { all: [{ npc: { id: ID, nickname: true } }, { npc: { id: ID, talks: { gte: 9 } } }] }, once: true }),
    topic('duels-explained', 'talk-tully-duels-explained', 6, { cond: { all: [{ npc: { id: ID, met: true } }, { hour: [19, 1] }] }, once: true }),
    topic('fence-side', 'talk-tully-fence-side', 6, { cond: { flag: 'th.the-fence.side' }, once: true }),
    topic('after-mile', 'talk-tully-after-mile', 7, { cond: { thread: { id: 'mudlark-mile', done: true } }, once: true }),
    duelTopic(ID),
    topic('heart-1', 'talk-tully-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 7 } } }, once: true }),
  ],
  gifts: {
    love: ['grey-mullet', 'apple', 'honeycomb'],
    like: ['pear', 'plum', 'mackerel', 'dor-beetle', 'bush-cricket'],
    dislike: ['sea-glass', 'moth-silk', 'lumpsucker'],
  },
  lines: {
    generic: [
      line('g1', 'Carrying three oranges? That\'s a rep. Carrying four? Two reps. I don\'t make the rules. I do make the rules.'),
      line('g2', 'Fastest kid on the green, me. Don\'t ask the green.'),
      line('g3', 'Every morning, four corners of the green. Counted out loud. The counting is the important part.'),
      line('g4', 'Bryony says my laps scare her beans. Beans can\'t be scared. ~ Can they? I\'ve been running quieter.'),
      line('g5', 'You look strong today. You looked strong yesterday. Consistency! Love it.'),
      line('g6', 'I gave Hesper a nickname. "Speedy." She gave me a look. I\'ve kept the look. It\'s in a drawer.'),
      line('g7', 'Life\'s a race. Not against anybody. Just a race. Running somewhere. Good legs help.'),
      line('g8', 'I have never once stopped in the middle of anything. I\'ve stopped at the ends. The ends are fine.'),
    ],
    nickname: pool([
      ['nk1', '{npcNick}! There they are! Best nickname I ever gave. Possibly best nickname anybody ever gave.'],
      ['nk2', 'There\'s {npcNick}. Saying it out loud so the whole quay knows. QUAY: THIS IS {npcNick}.'],
      ['nk3', 'People ask me who {npcNick} is. I say: the strongest carrying arm on the point. They nod. They know.'],
    ], ['nickname']),
    declined: pool([
      ['dc1', 'Still no nickname? Respect. I\'m calling you {player}. Out loud. Like a proper name. Feels very formal. Love it.'],
    ], ['known'], { all: [{ npc: { id: ID, nickname: false } }, { seen: 'tully-nickname' }] }),
    known: pool([
      ['k1', 'You came back! Course you did. Nobody stays away from Tully long. It\'s the energy.'],
      ['k2', 'I timed how long since we last talked. A day! Personal best.'],
    ], ['known']),
    morning: morning([
      ['m1', 'MORNING. Lap four. Can\'t talk. Can talk. Talking while running is a rep.'],
      ['m2', 'Sun\'s up, legs are up, I\'m up. Everything\'s up. Except the tide. The tide\'s doing its own thing.'],
      ['m3', 'Did you see me go past? I went past. Very fast. You might\'ve blinked.'],
    ]),
    evening: evening([
      ['e1', 'Evening! Legs are proud of themselves. I let them sit. They\'ve earned it.'],
      ['e2', 'Slate\'s up for tonight. Am I on it? Am I? ~ Don\'t tell me. Tell me.'],
    ]),
    night: night([
      ['n1', 'Late! Can\'t sleep. Thinking about the spring low. Thinking about running. Thinking about thinking about running.'],
      ['n2', 'Night run? No. Night WALK. Very slow. Recovery. Very important. I read it on a slip.'],
    ]),
    porch: [
      line('p1', 'Sit down! Sit! Step\'s warm. I\'ve been warming it. Professionally.'),
      line('p2', 'The quay\'s lovely from here. All the bollards, all in a row. Like a starting line nobody\'s used yet.'),
      line('p3', 'You know what? Porch talk is the best kind of talk. Nowhere to run. I\'ve checked.'),
    ],
    sleep: [
      line('s1', '* Tully is asleep on his back across the doorway, legs still twitching as if he is running somewhere in a dream. He is winning.'),
    ],
    weather: weather({
      rain: 'Rain! Free water! Running in rain is twice the rep and half the sweat. Science.',
      fog: 'Fog. Can\'t see the corners of the green. I\'m running by sound. I\'ve run into the Commons board twice.',
      storm: 'Storm. Augusta says stay in. I\'m doing indoor laps. My house is very small. I\'ve done four hundred.',
    }),
    tide: lowTide([
      ['lt1', 'LOW TIDE. The flats are OPEN. Mud running is the best running. It runs back.'],
    ]),
    lit: relit([
      ['r1', 'I ran a lap of the point under the beam last night. Every eight seconds I was lit up like a champion. I WAS a champion.'],
    ]),
    unlit: dark([
      ['d1', 'One day I\'m running to the lighthouse and back in under a minute. When it\'s on. Then I\'ll have something to run at.'],
    ]),
    lead: leads({
      plain: 'Plain creature! Fundamentals! Love fundamentals.',
      grit: 'A Grit one! Scamp\'s cousin! Look at those knuckles! Respect!',
      brine: 'Brine lead! Swimmer! Swimming\'s just running for fish. Respect.',
      kiln: 'Kiln creature! Warm-up done, then! Ha! Warm-up! ~ I\'ve been saving that one.',
      moss: 'A Moss one. Very calm. Very grounded. I could learn from that. I won\'t, but I could.',
      bolt: 'A Bolt creature! Fast! Is it faster than me? Don\'t answer. Don\'t let it answer.',
      rime: 'Rime lead! Ice bath! Ice baths are good for legs! Can it make me one? Can it?',
      gust: 'A Gust one! Tailwind! I\'d run a personal best with that behind me.',
      stone: 'A Stone creature. Solid core. Look at that core.',
      rust: 'A Rust creature. Tough. Weathered. Like an old champion. Like me in thirty years. Like me now.',
      glass: 'Glass lead! Shiny! It\'d look great on a podium. Is there a podium? I\'ll build a podium.',
      hollow: 'A Hollow creature. Spooky! Respect. Spooky is a kind of fast.',
    }),
    shift: shift([
      ['sh1', 'It SHIFTED! New legs! Or no legs! Or more legs! Whatever it\'s got, it\'s still on YOUR team. Locked in.'],
    ]),
    loan: pool([
      ['l1', 'Wren gave you a loan? Wren gave ME a loan once. For a medal stand. I\'m still paying it. One button a week. Discipline.', tier(1)],
      ['l2', 'Your porch is on now! Neighbours! Porch neighbours! That\'s the best kind!', tierRange(2, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'No badges? Go get punched by a goose! Respect to the goose.', badges(0)],
      ['b1', 'Three badges! You\'re on the slate for leaders now. Beaten leaders come in on Maud\'s ferry for duels. It\'s a whole scene.', badges(3)],
      ['b2', 'Six badges! SIX. I\'m going to tell everybody I trained you. I didn\'t. I\'m going to tell them anyway.', { badge: 6 }],
    ], ['generic']),
    gift: gifted({
      'grey-mullet': 'You brought me a grey mullet! For luck! I looked at it for an hour on race morning. Then Ludo bought it. Lucky Ludo.',
      apple: 'That apple! Crunch! Fuel! I ran six laps on it. Seven. One was a victory lap.',
    }),
  },
};
