/**
 * Wick, *The Water Pack* (cast arc, 4 beats). [DATA-THREADS] GDD-08 §7.8; GDD-00 §11.
 *
 * Wick Dorrow starts calling you Keeper the night loan 1 is paid. He carries his Rillfin everywhere
 * in a bucket because it cannot breathe out of water for long. With your Read beside him it Shifts
 * Up into a Gillwick, a gill-breather that can leave the bucket; he builds a water pack and aims at
 * the middle of the Long Road (his battles are GDD-07/GDD-04's `wick-cairnhold` and
 * `wick-long-road`). He carries the flame up the stair at the Relighting (`the-relighting`); the
 * morning after, beat 4 makes him the next reader. Cast arcs pay no resident share. Pure data.
 * @module data/threads/water-pack
 */

const T = 'water-pack';
const mem = (key, value, npc = 'wick') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

export const scripts = {
  'th-water-pack-1': [
    '* Dusk. Wick is sitting on your porch step with his cap pulled down and a bucket between his feet. Something in the bucket is blowing bubbles.',
    'Wick: Keeper. ~ This is Rillfin. He\'s mine. He can\'t be out of water long or his gills go tight, so he lives in the bucket and I carry the bucket.',
    'Wick: Everyone says a creature like that\'s no good for anything but a bucket.',
    { op: 'choice', options: [
      { text: 'Let me Read him.', then: [
        ...mem('first', 'read'),
        '* You raise the Glass. Rillfin, Brine. A small fierce heart. Somewhere far off, not yet, a lean you can\'t quite make out.',
        'Wick: What\'s it say? ~ Don\'t tell me if it\'s bad. Tell me if it\'s good.',
        '* You tell him it\'s good.',
      ] },
      { text: 'You carry him everywhere?', then: [
        ...mem('first', 'carry'),
        'Wick: Everywhere. Up the cliff stair, down the cliff stair. My arms are very strong. ~ Feel. No, feel.',
      ] },
    ] },
    'Wick: I\'m going to be a keeper too. When I\'m bigger. When there\'s a light to keep.',
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-water-pack-2': [
    '* Wick comes running down the point at dusk with the bucket slopping. Rillfin\'s brow is glowing pink through the water.',
    'Wick: Keeper! KEEPER. He\'s doing it. The glow. Corin says it means... it means...',
    'Wick: What if he comes out wrong. What if he doesn\'t know me.',
    { op: 'choice', options: [
      { text: 'Tell him the odds plainly.', then: [
        ...mem('window', 'plain'),
        '* You read it out: mostly bigger, some chance the same, a small chance smaller. Wick listens with his whole face.',
        'Wick: Mostly bigger. ~ Okay. Okay. I can do mostly.',
      ] },
      { text: 'Hold his wing and read it together.', then: [
        ...mem('window', 'together'),
        '* You crouch beside him, hold his wing, and read it out to both of them, Wick and the bucket. His grip is very strong.',
      ] },
    ] },
    '* The glow fills the bucket. Then the bucket tips over, because the creature in it is too big for a bucket now: longer, green-finned, breathing air through a frill at its throat.',
    'Wick: Gills. ~ Air gills. He can come OUT.',
    '* The Gillwick turns round twice on the grass and pushes its face into Wick\'s chest. The mark on its brow is exactly where it was.',
    'Wick: He knows me. ~ Keeper, he knows me.',
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-water-pack-3': [
    '* Wick is on the quay with the Gillwick and two new creatures, all of them dripping, standing in a very straight line.',
    'Wick: This is my pack. The water pack. Gillwick\'s in charge. These two are learning. ~ Mostly they\'re learning to stand in a line.',
    'Wick: I want to fight on the Long Road one day. Corin says it\'s the hardest road on the isles. I want to be in the middle of it, where people have to stop.',
    { op: 'choice', options: [
      { text: 'Then learn to Read first.', then: [
        ...mem('lesson', 'read'),
        'Wick: Look before you swing. Then say what you see. ~ Corin says that every day. I\'ll say it every day too.',
      ] },
      { text: 'Then learn when not to fight.', then: [
        ...mem('lesson', 'decline'),
        'Wick: When NOT to? ~ ...Oh. Like Linnet, before she had a badge. That\'s harder. I\'ll practise that one.',
      ] },
    ] },
    'Wick: Will you come and find me there? On the Road? I\'ll be the one in the middle.',
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],

  'th-water-pack-4': [
    '* The morning after. Wick is sitting on the lighthouse step with his cap pushed back for once, the Gillwick asleep across his feet.',
    'Wick: I carried it. ~ The flame. Up all the stairs. I didn\'t drop it. I didn\'t even nearly.',
    'Wick: When you\'re old, Keeper, and the stairs are too many... ~ I don\'t mean old. I mean a bit old.',
    { op: 'choice', options: [
      { text: 'You\'ll keep it one day.', then: [
        ...mem('flame', 'keep'),
        'Wick: I\'ll trim the wick every night. Every night. Even when it doesn\'t need it.',
      ] },
      { text: 'Your turn on the stair next time.', then: [
        ...mem('flame', 'turn'),
        'Wick: Next time? ~ Every time. I\'ll carry it every time. You can walk behind and say what you see.',
      ] },
    ] },
    '* He pulls his cap back down. Then he pushes it up again, because there is nothing left to hide from.',
    { op: 'beat', thread: T, to: 4 },
    { op: 'end' },
  ],
};

export default {
  id: T, npcId: 'wick', title: 'The Water Pack', kind: 'cast',
  summary: 'A puffling with a fish in a bucket. The fish Shifts into a gill-breather; the puffling builds a pack, carries the flame and becomes the next reader.',
  involve: { loan: { tier: 2 } },
  beats: [
    { id: 1, cond: { all: [{ loan: { tier: 2 } }, { hour: [18, 22] }] }, script: 'th-water-pack-1', where: { mapId: 'pellwick', x: 8, y: 25 },
      when: 'Dusk on your porch, from the night loan 1 is paid.', topic: 'Keeper. This is Rillfin.',
      choices: [{ key: `th.${T}.first`, options: ['read', 'carry'] }] },
    { id: 2, cond: { all: [{ badge: 2 }, { hour: [18, 22] }] }, script: 'th-water-pack-2', advance: { days: 1 }, where: { mapId: 'pellwick', x: 8, y: 25 },
      when: 'Dusk, once you hold two badges: Rillfin\'s window opens.', topic: 'He\'s glowing.',
      choices: [{ key: `th.${T}.window`, options: ['plain', 'together'] }] },
    { id: 3, cond: { all: [{ badge: 3 }, { hour: [6, 18] }] }, script: 'th-water-pack-3', advance: { days: 2 }, where: { mapId: 'pellwick', x: 48, y: 36 },
      when: 'A day on the quay once you hold three badges.', topic: 'The water pack.',
      choices: [{ key: `th.${T}.lesson`, options: ['read', 'decline'] }] },
    { id: 4, cond: { flag: 'sp.relighting' }, script: 'th-water-pack-4', where: { mapId: 'pellwick', x: 5, y: 21 },
      when: 'The morning after the Relighting, on the lighthouse step.', topic: 'I didn\'t drop it.',
      choices: [{ key: `th.${T}.flame`, options: ['keep', 'turn'] }],
      reward: { share: false } },
  ],
};
