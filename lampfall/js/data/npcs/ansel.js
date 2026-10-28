/**
 * Ansel Stalk, grey heron, the beached launch. [DATA-CAST] GDD-06.
 *
 * Young harbormaster thirty years ago; wrote the report that named the keeper. His grandfather built
 * the weir. Chalks the barometer on the Commons board at dawn, mends at the launch, stares at the
 * seized weir wheel at midday, and fishes the empty north creek every evening 17:00–23:00 (arc *The
 * Empty Creek*). Teaches the fishing tells. Few words, chosen carefully, each one a little late.
 *
 * Merge notes: the errand-six topic `tells` still runs the story script `ansel-fishing-tells`; his
 * porch row keeps the integrated build's id and lit-at-start state (`porch-wardens-house`, whose
 * canonical row is Augusta's), seated on the creek bank so the 17:00-23:00 creek watch holds.
 * @module data/npcs/ansel
 */

import {
  P, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tierRange, badges, topic, mem,
} from './_helpers.js';

const ID = 'ansel';

export const scripts = {
  'talk-ansel-first': [
    { op: 'if', cond: { seen: 'ansel-fishing-tells' },
      then: ['Ansel: The perch. You didn\'t rush it. ~ Most people rush it.'],
      else: ['* A tall grey heron stands at the bow of a beached launch, so still the gulls have stopped bothering to watch him.'] },
    'Ansel: Ansel Stalk. ~ You\'ll hear the name. People will tell you what it means. Some of them are right.',
    { op: 'end' },
  ],

  'talk-ansel-tells': [
    'Ansel: Every fish has a tell. Shape of the shadow, sound of the bite, a word for it. Learn three of a kind and you know them.',
    'Ansel: A Brine creature in the lead learns them faster. Reads the water for you. ~ I had one. Long time ago. Before.',
    'Ansel: Small shadow, quick bite. Forked tail, wait. Large and slow, you\'ll want the patient reel. Don\'t rush any of it. The sea\'s been waiting longer than you.',
    { op: 'end' },
  ],

  'talk-ansel-inspection': [
    'Ansel: "Deferred until the mill is sold." ~ That was my signature under the notice. I was twenty-two.',
    'Ansel: The mill was my family\'s. I didn\'t think about that. I should have thought about that.',
    { op: 'end' },
  ],

  'talk-ansel-report': [
    'Ansel: They\'ve pinned my report on the board. A page at a time. ~ I see people reading it on their way to Pell\'s.',
    'Ansel: I don\'t stop them. It\'s a good report. Clear. Every fact in it is true. ~ That\'s what\'s wrong with it.',
    { op: 'end' },
  ],

  'talk-ansel-relieved': [
    'Ansel: "Recommendation: the keeper be relieved." ~ My words. In my hand.',
    'Ansel: They relieved her. She left on the last boat out. I watched it go from the end of the quay and I thought: there. That\'s done properly.',
    { op: 'choice', options: [
      { text: 'You were young.', then: [
        ...mem(ID, 'relieved', 'young'),
        'Ansel: I was. ~ I\'m not now. That hasn\'t helped as much as I hoped.',
      ] },
      { text: '(Stand with him. Say nothing.)', then: [
        ...mem(ID, 'relieved', 'silence'),
        '* The creek runs past your boots. After a long time Ansel nods, once, at nothing.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-ansel-addendum': [
    'Ansel: The addendum. ~ You found it. It was never posted. I wrote it the year I opened the drawer and found her drawing.',
    'Ansel: One word at the bottom. "True." ~ It took me twenty years to write one word.',
    { op: 'end' },
  ],

  'talk-ansel-forgiven': [
    'Ansel: She wrote about me. Didn\'t she. In one of yours. ~ You don\'t have to say what.',
    { op: 'if', cond: { flag: 'sp.ansel-confessed' },
      then: ['Ansel: "He wrote what he could see." ~ ...I\'m going to stand here a while. If that\'s all right. Stand with me if you like.'],
      else: ['Ansel: I can see it on your face. ~ Not yet. I\'m not ready to hear it from you. I\'m not sure I\'m ready to hear it from her.'] },
    { op: 'end' },
  ],

  'talk-ansel-relit': [
    'Ansel: I saw it come on from the creek. ~ I didn\'t move. I didn\'t want to miss the first sweep.',
    'Ansel: It went over the launch. Over the weir. Over me. ~ Didn\'t stop at any of us. Just kept going round. That\'s the right way for a light to be.',
    { op: 'end' },
  ],

  'talk-ansel-heart-1': [
    'Ansel: People ask why I fish a creek with nothing in it. ~ I stopped answering.',
    'Ansel: I\'ll answer you. Standing here is the only honest thing I know how to do about it. ~ It isn\'t enough. It\'s what I\'ve got.',
    { op: 'end' },
  ],
};

export default {
  id: ID,
  name: 'Ansel Stalk',
  species: 'grey heron',
  sprite: 'ansel',
  portrait: 'ansel',
  group: 'resident',
  role: 'Former harbormaster; wrote the report; chalks the barometer at dawn; fishes the empty north creek 17:00–23:00; teaches the fishing tells.',
  home: P,
  homeSpot: spot(P, 'ansel-launch', { pose: 'sleep' }),
  threadId: 'empty-creek',
  porch: porch('porch-wardens-house', 'ansel-creek', { litAtStart: true, pose: 'fish', hours: [hm(20), hm(23)] }),
  festivals: {
    'lantern-market': spot(P, 'market-green', { pose: 'stand', activity: 'at the edge of the market' }),
    'long-night': spot(P, 'bar-head', { pose: 'stand', facing: 'up', activity: 'watching the bar' }),
    'late-delivery-party': spot(P, 'party-green', { pose: 'stand' }),
  },
  schedule: [
    at(hm(5, 40), P, 'weathervane-ansel', { pose: 'stand', activity: 'chalking the barometer' }),
    at(hm(6, 15), P, 'ansel-launch', { pose: 'stand', activity: 'mending at the launch' }),
    at(hm(12), P, 'ansel-weir', { pose: 'stand', facing: 'right', activity: 'looking at the weir wheel' }),
    at(hm(12, 1), P, 'weir-wheel', { pose: 'stand', cond: { flag: 'sp.weir-turned' }, activity: 'oiling the turned wheel' }),
    at(hm(14), P, 'ansel-launch', { pose: 'stand' }),
    at(hm(17), P, 'ansel-creek', { pose: 'fish', activity: 'fishing the creek' }),
    at(hm(23), P, 'ansel-launch', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-ansel-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('tells', 'ansel-fishing-tells', 11, { once: true, cond: { all: [{ flag: 'sp.dock-battle' }, { not: { seen: 'ansel-fishing-tells' } }] } }),
    topic('tells-more', 'talk-ansel-tells', 5, { cond: { all: [{ seen: 'ansel-fishing-tells' }, { npc: { id: ID, talks: { gte: 2 } } }] }, once: true }),
    topic('inspection', 'talk-ansel-inspection', 6, { cond: { flag: 'np.ansel.inspection-deferred' }, once: true }),
    topic('report', 'talk-ansel-report', 6, { cond: { any: [{ flag: 'np.ansel.report-1' }, { flag: 'np.ansel.report-2' }] }, once: true }),
    topic('relieved', 'talk-ansel-relieved', 7, { cond: { flag: 'np.ansel.report-3' }, once: true }),
    topic('addendum', 'talk-ansel-addendum', 7, { cond: { flag: 'np.ansel.addendum' }, once: true }),
    topic('forgiven', 'talk-ansel-forgiven', 7, { cond: { flag: 'np.ansel.forgiven' }, once: true }),
    topic('relit', 'talk-ansel-relit', 8, { cond: { flag: 'sp.relighting' }, once: true }),
    topic('heart-1', 'talk-ansel-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 6 } } }, once: true }),
  ],
  gifts: {
    love: ['brown-trout', 'grayling', 'sea-trout'],
    like: ['perch', 'stickleback', 'silver-eel', 'brass-tide-gauge'],
    dislike: ['honeycomb', 'skyglass-shard', 'quince'],
  },
  lines: {
    generic: [
      line('g1', 'Forked tail, by the piling. Don\'t rush it.'),
      line('g2', '* Ansel looks at you, then back at the water. That seems to be the whole conversation, and it is not an unfriendly one.'),
      line('g3', 'The tide doesn\'t care who\'s watching. That\'s a comfort, some days.'),
      line('g4', 'Patience is just standing still on purpose.'),
      line('g5', 'Mended this net four times. It still has the same holes. I\'ve come to think of them as the net.'),
      line('g6', 'Good day. ~ Is it? I suppose it is.'),
      line('g7', 'Augusta leaves the chalk where I can reach it. Neither of us has ever mentioned it.'),
      line('g8', 'You read the water before you cast. Good. Most people read it after.'),
    ],
    known: pool([
      ['k1', 'You. ~ Stand there. Your shadow\'s off the water there.'],
      ['k2', 'You come and stand by the creek most days. You don\'t have to. I\'m glad of it.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Barometer\'s chalked. Falling. Augusta will say six in 10.'],
      ['m2', 'Morning\'s for nets. Evening\'s for the creek. I keep the order. It keeps me.'],
    ]),
    evening: evening([
      ['e1', 'Creek\'s low. It\'s always low. ~ Stand quiet a bit, if you like.'],
      ['e2', 'Light goes gold on the stones about now. Nothing in the water to see it but me.'],
    ]),
    night: night([
      ['n1', 'Late. The launch creaks when the tide comes up under the quay. I sleep through it now.'],
      ['n2', 'Night\'s easier. In the dark nobody can see where the lighthouse is.'],
    ]),
    fish: [
      line('f1', '* Ansel stands on one leg in the creek. He strikes. He misses. He settles again, exactly where he was.'),
      line('f2', 'Nothing yet. ~ There\'s never anything yet.'),
      line('f3', 'Forked tail. Would be. By the piling. ~ If there were any.'),
    ],
    porch: [
      line('p1', 'Porch hours. ~ This is my porch. The bank. It doesn\'t need a lamp. It has the whole sky not lit.'),
      line('p2', 'Augusta counts porches. She counts me on the creek. I asked her not to. She said it\'s her job to count the people who are out.'),
      line('p3', 'Sit, if you like. The stones are dry. They\'re always dry. That\'s the trouble.'),
    ],
    sleep: [
      line('s1', '* Ansel sleeps standing in the launch, head tucked under one wing. He does not stir when you come close. He hears you anyway.'),
    ],
    weather: weather({
      rain: 'Rain on the creek. Makes it sound like there\'s water in it.',
      fog: 'Fog. Can\'t see the weir. Can\'t see the lighthouse. I fish better.',
      storm: 'Storm night. ~ I don\'t talk on storm nights. Not you. Nobody.',
    }),
    tide: lowTide([
      ['lt1', 'Low. You can see how high the bar\'s grown, from here. Every year a little. Every year a little.'],
    ]),
    lit: relit([
      ['r1', 'Eight seconds. I count. ~ I always counted. Before, it was something else I was counting.'],
    ]),
    unlit: dark([
      ['d1', 'Don\'t ask about the lighthouse. ~ Ask if you like. I just won\'t have a good answer.'],
    ]),
    creek: pool([
      ['c1', 'Shadows in the creek today. Real ones. ~ I\'ve stood here thirty years for that. I didn\'t think I\'d mind so much.', { flag: 'sp.weir-turned' }],
    ], ['generic']),
    lead: leads({
      plain: 'Plain creature. Steady. Good to have something steady by you.',
      grit: 'A Grit one. Keep it off the launch. The launch has had enough knocks.',
      brine: 'A Brine creature. ~ It\'s reading the creek for you. It knows there\'s nothing in it. Kind of it to look anyway.',
      kiln: 'A Kiln creature. Warm. The stones dry where it walks. Odd to see dry stones that wanted to be wet.',
      moss: 'Moss lead. The reeds on the creek bank lean towards it. Plants know things.',
      bolt: 'A Bolt one. It\'s humming at the creek. ~ Nothing to hum at. Tell it thank you.',
      rime: 'Rime creature. The edge of the creek frosted. Pretty. Wrong time of year.',
      gust: 'A Gust one. It ruffled the water. For a breath it looked like there was a current.',
      stone: 'Stone creature. Heavy. Like the weir. ~ No offence to it.',
      rust: 'A Rust creature. It\'s looking at the weir wheel. So am I. Every day.',
      glass: 'Glass lead. It catches what light there is. Somebody\'s got to.',
      hollow: 'A Hollow creature. It went right through the launch. ~ Didn\'t find anything in there either.',
    }),
    shift: shift([
      ['sh1', 'It Shifted. You read it. You chose. ~ That\'s more than most of us got, the first time.'],
    ]),
    loan: pool([
      ['l1', 'The co-op roof\'s going up on the point. I can see it from the creek. ~ Good.', tierRange(2, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'Spires. My grandfather thought they were for show. He thought a lot of things were for show.', badges(0)],
      ['b1', 'Six seals. You read what\'s in front of you. ~ Keep doing that. It\'s rarer than you\'d think.', { badge: 6 }],
    ], ['generic']),
    gift: gifted({
      'brown-trout': 'You brought me a trout from the river. ~ I held it in the creek a minute before I ate it. Showed it the creek. Silly.',
      honeycomb: 'A honeycomb. ~ I don\'t know what to do with it. I\'ve put it on the launch. The bees have found it. Now I have bees.',
    }),
  },
};
