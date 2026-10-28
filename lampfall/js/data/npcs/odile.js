/**
 * Odile, roseate spoonbill, the house on the rise west of the green. [DATA-CAST] GDD-06.
 *
 * Painter. Soft-spoken, unhurried, already half in tomorrow's sunset; notices light before people,
 * then notices exactly how you feel. Talks in half-finished sentences that trail off into colour
 * names. Sketches on her step in the morning, paints at the easel on the point at golden hour
 * (14:00–19:00), watches the town from the rise at night. Lead thread *Twelve Lights*; paints
 * Shiftlogs. Porch Duels with a Prismoth once you have reached Cairnhold.
 *
 * Merge notes: keeps the integrated build's Archive visits (`odile-gallery`, Monday and Friday
 * mornings) and porch id `porch-odile`.
 * @module data/npcs/odile
 */

import {
  P, MON, TUE, WED, THU, FRI, SAT, SUN, hm, at, spot, porch, line, pool, morning, evening, night, weather, leads, shift,
  lowTide, relit, dark, gifted, tier, tierRange, badges, topic, mem, duelScript, duelTopic,
} from './_helpers.js';

const ID = 'odile';

export const scripts = {
  'talk-odile-first': [
    // meet-neighbors meets one of Odile / Thessaly / Bryony per run; only that one already knows you
    { op: 'if', cond: { flag: 'np.odile.met-step' },
      then: ['Odile: You again. ~ No, that came out wrong. You again, like when the light comes back round. Good again.'],
      // she can be met in the Archive gallery as well as on the rise, so the narration names no place
      else: ['* A tall pink bird stands very still, looking at the light as if it might do something if she is patient.'] },
    'Odile: Odile. I paint. ~ Mostly the light. Sometimes the things it lands on. You\'ve got a nice… hm. Ochre. Round the edges.',
    { op: 'end' },
  ],

  'talk-odile-lighthouse': [
    '* The canvas on the easel is the lighthouse. The sky is finished. The sea is finished. The lamp is a small square of bare linen.',
    'Odile: I can\'t do the top. ~ You can\'t paint a light that isn\'t there. I tried. It came out as… grey. Just grey.',
    'Odile: I\'ll leave it. It can wait on the easel. Canvases are good at waiting. Better than me.',
    { op: 'end' },
  ],

  'talk-odile-easel': [
    'Odile: Gran\'s easel. ~ It came home. In a letter. Well. The letter came, and then Juniper came with the easel, and I sat down on the step for a long time.',
    'Odile: She wrote she couldn\'t paint the light on this coast. Nobody could, she said. ~ I\'m going to try. On her legs. They\'re very good legs. Ash.',
    { op: 'end' },
  ],

  'talk-odile-tully': [
    'Odile: I painted Tully once. Running. ~ He cried. I didn\'t mean to make him cry. I only painted what he looked like.',
    'Odile: He looked like he was going somewhere. ~ Most people look like they\'re coming back from somewhere. He never does. Vermilion.',
    { op: 'end' },
  ],

  'talk-odile-prismoth': [
    'Odile: A Prismoth came to my lamp the night you went to Cairnhold. ~ It stayed. It sits on the easel and splits the light into… everything. Every colour I own, and two I don\'t.',
    'Odile: I don\'t fight much. ~ If you want a duel, though. On my step. It would like to show you the colours.',
    { op: 'end' },
  ],

  'talk-odile-credits': [
    'Odile: Twelve. ~ All twelve. Eleven porches and the light. I didn\'t think I\'d ever finish. Finishing is strange. Like a sentence you forgot you were saying.',
    'Odile: Barnaby wants them all on the long wall. I said yes. ~ I said yes before he finished asking. Gold leaf. That\'s the colour of saying yes.',
    { op: 'end' },
  ],

  'talk-odile-heart-1': [
    'Odile: Can I tell you how you look? Not your face. Your… colour. ~ When you walked up just now.',
    { op: 'choice', options: [
      { text: 'Please. What colour am I?', then: [
        ...mem(ID, 'colour', 'asked'),
        'Odile: Slate blue, with a warm edge. ~ Like a roof that\'s just been finished. Someone\'s going to sleep well under it.',
      ] },
      { text: 'I\'m almost afraid to ask.', then: [
        ...mem(ID, 'colour', 'afraid'),
        'Odile: Then I\'ll paint it instead. ~ You can look when you\'re ready. Paintings are patient. Like me. Mostly like me.',
      ] },
    ] },
    { op: 'end' },
  ],

  'talk-odile-heart-2': [
    'Odile: I watch the town from up here at night. Every porch. ~ People think I\'m dreaming. I\'m counting. Not like Augusta. Augusta counts lamps.',
    'Odile: I count who\'s on the step. Who\'s sitting with who. ~ You sit with a lot of people now. It shows. In the light. Amber.',
    { op: 'end' },
  ],

  'talk-odile-duel': duelScript(ID, 'porch-odile', {
    ask: 'Odile: The Prismoth wants to… perform. On my step. Friendly. It doesn\'t understand losing. It thinks everything is about the light.',
    yes: 'Odile: Go on, then. ~ Show them the colours.',
    no: 'Odile: That\'s all right. ~ It\'ll perform for the moths instead. They clap. With their wings.',
  }),
};

export default {
  id: ID,
  name: 'Odile',
  species: 'roseate spoonbill',
  sprite: 'odile',
  portrait: 'odile',
  group: 'resident',
  role: 'Painter: one canvas for every lit porch she can see from her step, your starter\'s Shiftlog, and the lighthouse last (lead thread Twelve Lights). Porch Duels with a Prismoth from Cairnhold.',
  home: P,
  homeSpot: spot(P, 'door-odile', { pose: 'sleep' }),
  threadId: 'twelve-lights',
  porch: porch('porch-odile', 'porch-odile-step', { hours: [hm(20), hm(23)] }),
  festivals: {
    'lantern-market': spot(P, 'party-green', { pose: 'stand', activity: 'sketching the string lights' }),
    'long-night': spot(P, 'point-skywatch', { pose: 'stand', facing: 'up', activity: 'brush ready' }),
    'late-delivery-party': spot(P, 'first-orchard', { pose: 'stand' }),
  },
  schedule: [
    at(hm(8), P, 'odile-porch', { pose: 'sit', activity: 'sketching on the step' }),
    at(hm(10), 'int-archive', 'odile-gallery', { pose: 'stand', days: [MON, FRI], activity: 'looking at the canvases in the Archive gallery' }),
    at(hm(11), P, 'party-green', { pose: 'stand', days: [TUE, THU, SAT], activity: 'watching the light on the green' }),
    at(hm(11, 1), P, 'meet-odile', { pose: 'stand', days: [MON, WED, FRI, SUN], activity: 'watching the light on the flats' }),
    at(hm(14), P, 'odile-easel', { pose: 'stand', facing: 'up', activity: 'painting at golden hour' }),
    at(hm(14, 1), P, 'odile-porch', { pose: 'sit', weather: ['rain', 'storm'], activity: 'painting rain from the step' }),
    at(hm(19), P, 'meet-odile', { pose: 'stand', facing: 'left', activity: 'watching the town come on' }),
    at(hm(23, 30), P, 'door-odile', { pose: 'sleep' }),
  ],
  topics: [
    topic('first', 'talk-odile-first', 10, { cond: { npc: { id: ID, met: false } }, once: true }),
    topic('lighthouse', 'talk-odile-lighthouse', 6, { cond: { all: [{ thread: { id: 'twelve-lights', beat: { gte: 3 } } }, { not: { flag: 'sp.relighting' } }] }, once: true }),
    topic('easel', 'talk-odile-easel', 6, { cond: { flag: 'th.twelve-lights.easel' }, once: true }),
    topic('tully', 'talk-odile-tully', 4, { cond: { all: [{ npc: { id: ID, talks: { gte: 4 } } }, { npc: { id: 'tully', met: true } }] }, once: true }),
    topic('prismoth', 'talk-odile-prismoth', 5, { cond: { any: [{ flag: 'sp.memorial-seen' }, { badge: 'ward' }] }, once: true }),
    topic('credits', 'talk-odile-credits', 8, { cond: { thread: { id: 'twelve-lights', done: true } }, once: true }),
    duelTopic(ID),
    topic('heart-1', 'talk-odile-heart-1', 2, { cond: { npc: { id: ID, talks: { gte: 6 } } }, once: true }),
    topic('heart-2', 'talk-odile-heart-2', 2, { cond: { all: [{ npc: { id: ID, talks: { gte: 11 } } }, { flag: 'np.odile.colour' }] }, once: true }),
  ],
  gifts: {
    love: ['apricot', 'peach', 'red-admiral'],
    like: ['cherry', 'damselfly', 'sea-glass', 'mermaids-purse', 'skyglass-bead'],
    dislike: ['herring', 'dor-beetle', 'anchor-stone'],
  },
  lines: {
    generic: [
      line('g1', 'Oh… stand there. No — there. Where the light goes… apricot. Yes. Don\'t move for a minute.'),
      line('g2', 'The harbor\'s different every hour. Nobody believes me. Come back in an hour. ~ See?'),
      line('g3', 'I ran out of rose madder. I\'ve been mixing it from memory. Memory\'s a bit… lilac.'),
      line('g4', 'You don\'t have to say anything. I like it when people stand near the easel and don\'t say anything.'),
      line('g5', 'Shadows aren\'t grey. Nobody\'s shadow is grey. Yours is… violet, with a bit of the sea in it.'),
      line('g6', 'I dreamt the sea was the sky last night. I woke up and painted it. It was just the sea. It was enough.'),
      line('g7', 'Tully says I\'m slow. I\'m not slow. I\'m… on time for things that haven\'t happened yet.'),
      line('g8', 'Every porch is a different yellow. Did you know? Butter. Straw. Honey. One on the quay is nearly… peach.'),
    ],
    known: pool([
      ['k1', 'You came back the same colour as yesterday. That\'s rare. ~ That\'s a compliment.'],
      ['k2', 'I kept a corner of today\'s canvas for you. In case you walked past. You walked past.'],
    ], ['known']),
    morning: morning([
      ['m1', 'Morning light\'s thin. Like milk with water in. I sketch in it. I don\'t paint. Painting is for later, when it thickens.'],
      ['m2', 'Look. The roofs are… pearl. For about four more minutes.'],
    ]),
    evening: evening([
      ['e1', 'The porches are coming on. ~ Watch. One. Two. That one\'s yours. Honey, with a cold edge.'],
      ['e2', 'I put the brushes away when the light goes. Then I just look. Looking\'s the other half.'],
    ]),
    night: night([
      ['n1', 'Night isn\'t black. Nothing\'s black. It\'s… ink, and blue, and the bit of amber from everyone\'s step.'],
      ['n2', 'Up late. The town looks like a painting someone hasn\'t finished yet. I like those best.'],
    ]),
    porch: [
      line('p1', 'Sit. ~ From my step you can see eleven porches and the dark one at the top. I\'ve painted every one but that.'),
      line('p2', 'Gran used to sit here. Her easel stood just… there. You can see the marks on the boards. Three little dents.'),
      line('p3', 'Shh. ~ No, nothing. Just the light going. I like to be quiet for it.'),
    ],
    sleep: [
      line('s1', '* Odile is asleep standing on one leg in the doorway, head tucked under a wing. There is paint on her beak.'),
    ],
    weather: weather({
      rain: 'Rain. Everything goes darker and shinier and… the green turns into a whole new green. I\'m painting it from the step.',
      fog: 'Fog. The world\'s one colour. ~ Pearl. Pewter. Somewhere in between there\'s a name for it. I\'m looking.',
      storm: 'Storm light is the best light and the worst weather. I\'m inside. Painting the window.',
    }),
    tide: lowTide([
      ['lt1', 'Low water. The flats are mirrors. Twice the sky. Twice the work.'],
    ]),
    lit: relit([
      ['r1', 'The beam goes round and every porch I painted lights up in turn. Like my canvases are blinking at me.'],
      ['r2', 'I can paint at night now. In eight-second strokes.'],
    ]),
    unlit: dark([
      ['d1', 'The lighthouse at golden hour is… beautiful. And wrong. Like a face with its eyes shut.'],
    ]),
    lead: leads({
      plain: 'A plain creature. Plain\'s hard to paint, you know. Nothing to hide behind. Honest… umber.',
      grit: 'A Grit one. Burnt sienna. All knuckles. It looks like it\'d punch the canvas. It might.',
      brine: 'A Brine creature. Teal… no, deeper. Like the quay at high water.',
      kiln: 'A Kiln creature. Oh. Cadmium. I haven\'t got enough cadmium for that.',
      moss: 'A Moss one. Sap green, with a bit of… sleep in it.',
      bolt: 'A Bolt creature. It\'s the colour lightning would be if lightning stood still. Lemon. Sharp.',
      rime: 'A Rime creature. Cerulean. And the white you only get by leaving the canvas bare.',
      gust: 'A Gust one. It\'s blowing my brushes. ~ That\'s all right. They go where the light goes.',
      stone: 'A Stone creature. Payne\'s grey. It\'s the most patient colour I own.',
      rust: 'A Rust creature. I love rust. Every red at once. ~ Please don\'t let it near the easel screws.',
      glass: 'A Glass creature. ~ I can\'t. It\'s every colour. I\'ve put my brush down. I\'m just looking.',
      hollow: 'A Hollow creature. It\'s the colour of the gap between two colours. I\'ve never had a name for it.',
    }),
    shift: shift([
      ['sh1', 'It Shifted. ~ Oh, I want to paint it. Next to the old shape. Same mark, same place. Like two pages of one… sky.'],
    ]),
    loan: pool([
      ['l1', 'When your porch lights, stand on my step at dusk. I want to see what colour it is.', tier(1)],
      ['l2', 'Your porch is honey with a cold edge. I\'ve painted it. You\'ve seen. ~ I keep painting it again.', tierRange(2, 7)],
    ], ['generic']),
    badge: pool([
      ['b0', 'Spires. Augusta says they\'re tall. I\'d like to paint one. From very far away.', badges(0)],
      ['b1', 'You\'re wearing more wax seals. They\'re red. A good red. Like… a promise somebody kept.', { badge: 3 }],
    ], ['generic']),
    gift: gifted({
      apricot: 'You gave me an apricot. ~ I didn\'t eat it for two days. I was mixing the colour. Then I ate it. It was the right colour.',
      'red-admiral': 'The red admiral you netted for me. I let it go after I\'d drawn it. ~ It sat on the easel all afternoon anyway.',
    }),
  },
};
