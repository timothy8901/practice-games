/**
 * Bryony, *The Fence* (lead thread, 4 beats). [DATA-THREADS] GDD-08 §7.4; GDD-00 §11.
 *
 * Bryony's beans run up a rotten fence that Tully's dawn laps go straight through. You broker a
 * peace or take a side (three options; both neighbors remember which), bring Ambrose timber, and he
 * cuts lower posts. A Sedgehare lives in her beans and nobody may catch it; when the fence is low
 * enough to talk over, it chooses to come to you. Finishing pays the resident share and gives the
 * creature (Lv14, between the Cairnhold and Emberstep curves). Pure data.
 * @module data/threads/the-fence
 */

const T = 'the-fence';
const mem = (key, value, npc = 'bryony') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

export const scripts = {
  'th-the-fence-1': [
    '* Bryony is in her bean rows with a watering can bigger than she is. She whistles sharply when she sees you, then pretends she didn\'t.',
    'Bryony: You. New one. You\'ve got arms. I need the beans watered morning and evening while it\'s dry. What do you charge?',
    { op: 'choice', options: [
      { text: 'Three hundred a week.', then: [
        ...mem('fee', 'paid'),
        'Bryony: THREE hundred? For water? ~ Two-fifty and a bag of beans when they come. ~ Fine. Three hundred. You\'re a pirate.',
        { op: 'earn', amount: 300 },
      ] },
      { text: 'For free. They\'re nice beans.', then: [
        ...mem('fee', 'free'),
        'Bryony: Free. ~ Nobody does anything free. What are you up to? ~ ...Fine. You get first beans. Don\'t argue.',
      ] },
    ] },
    '* Something rustles deep in the bean rows. Long ears, a flicker of green.',
    'Bryony: Don\'t look at it. That\'s the Sedgehare. It lives in the beans. Nobody catches it. Nobody. It isn\'t a creature, it\'s a neighbor.',
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-the-fence-2': [
    '* A thundering at dawn. Tully, mid-lap, cuts straight across the corner of Bryony\'s garden. Bean poles go over like skittles.',
    '* Bryony whistles. It is the loudest whistle you have ever heard. Somewhere a gull falls off a roof.',
    'Bryony: FENCE. I want a FENCE. A real one, with posts, not that rotten thing my gran put up.',
    'Tully: It\'s the fastest line round the green! It\'s always been the line!',
    'Bryony: It\'s my BEANS!',
    '* They both look at you.',
    { op: 'choice', options: [
      { text: 'Run the laps round the pump instead.', then: [
        ...mem('side', 'broker'),
        { op: 'remember', npc: 'tully', key: `${T}.side`, value: 'broker' },
        'Tully: Round the pump... that\'s longer. ~ That\'s MORE training. Ooh. Locked in.',
        'Bryony: Hm. Fine. I still want the fence.',
      ] },
      { text: 'The beans were here first, Tully.', then: [
        ...mem('side', 'bryony'),
        { op: 'remember', npc: 'tully', key: `${T}.side`, value: 'bryony' },
        'Tully: ...Fair. Fair! I\'ll go round. Grumbling. I\'ll go round grumbling.',
        'Bryony: Thank you. Somebody on this green has sense.',
      ] },
      { text: 'It is the fastest line, Bryony.', then: [
        ...mem('side', 'tully'),
        { op: 'remember', npc: 'tully', key: `${T}.side`, value: 'tully' },
        'Bryony: Traitor. ~ I\'ll remember this.',
        'Tully: Thanks, {player}! ~ She will, you know. She remembers everything.',
      ] },
    ] },
    'Bryony: I\'m getting new posts. Ambrose cuts posts. Ambrose wants timber. You\'ve got arms, and the storm branches are all over the orchard. Three good pieces.',
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-the-fence-3': [
    '* Ambrose runs a thumb down each piece of timber, reading the grain with his eyes shut.',
    'Ambrose: Ash. Ash. ~ And this one\'s pear. Good. Fence posts for the hyrax, is it.',
    'Ambrose: How high?',
    { op: 'choice', options: [
      { text: 'Low enough to talk over.', then: [
        ...mem('height', 'talk'),
        'Ambrose: Elbow height. Good. A fence you can lean on is a fence that\'s working.',
      ] },
      { text: 'Low enough to step over.', then: [
        ...mem('height', 'step'),
        'Ambrose: Knee height. Ha. That\'s not a fence, that\'s a suggestion. ~ The best kind.',
      ] },
    ] },
    { op: 'take', item: 'timber', n: 3 },
    '* He gnaws. Chips fly. In a minute there are six short posts on the bench, smooth as river stones.',
    'Ambrose: Tell her they\'re from the yard. Don\'t tell her they\'re from you. She\'ll argue less.',
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],

  'th-the-fence-4': [
    '* Bryony and Tully are on their knees in the same garden, setting posts. Neither of them is speaking. Both of them are smiling at the posts.',
    { op: 'if', cond: { flag: `th.${T}.side`, is: 'broker' },
      then: ['Tully: Round the pump is better, honestly. I\'m faster on the bend. Don\'t tell her.'] },
    { op: 'if', cond: { flag: `th.${T}.side`, is: 'bryony' },
      then: ['Tully: She\'s let me hold the hammer. That\'s basically forgiveness.'] },
    { op: 'if', cond: { flag: `th.${T}.side`, is: 'tully' },
      then: ['Bryony: Your friend here took his side. I\'ve forgiven the posts. Not the friend. ~ I\'m joking. Mostly.'] },
    { op: 'if', cond: { flag: `th.${T}.height`, is: 'talk' },
      then: ['* The fence comes up to your elbow. Tully leans on it from one side, Bryony from the other, and they start arguing about beans, cheerfully, across the top.'],
      else: ['* The fence comes up to your knee. Tully steps over it, steps back, and steps over it again, delighted.'] },
    '* The bean rows rustle. The Sedgehare steps out between the new posts, ears up, and looks at you.',
    'Bryony: ~ Oh. It\'s never come out for anyone.',
    { op: 'choice', options: [
      { text: 'Kneel down beside it.', then: [
        ...mem('sedgehare', 'knelt'),
        '* You kneel. It walks the last three steps itself and sits against your boot, the way your first creature did on the causeway stones.',
      ] },
      { text: 'Stay still and let it decide.', then: [
        ...mem('sedgehare', 'waited'),
        '* You stay still. It takes its time, the way Bryony takes her time over a price. Then it decides, and sits on your foot.',
      ] },
    ] },
    'Bryony: Well. It\'s chosen. ~ You\'ll bring it to visit. Every week. It likes the second row.',
    { op: 'addCreature', species: 'sedgehare', level: 14 },
    'Bryony: And I\'m taking Wren a tally stick for you. Don\'t make that face. Fair\'s fair.',
    { op: 'beat', thread: T, to: 4 },
    { op: 'end' },
  ],
};

export default {
  id: T, npcId: 'bryony', title: 'The Fence', kind: 'lead',
  summary: 'Bryony\'s beans, Tully\'s laps and a rotten fence. When it is low enough to talk over, the Sedgehare in the beans chooses you.',
  beats: [
    { id: 1, cond: { hour: [7, 12] }, script: 'th-the-fence-1', where: { mapId: 'pellwick', x: 28, y: 27 },
      when: 'Her garden hours, 07:00-12:00.', topic: 'Water the beans?',
      choices: [{ key: `th.${T}.fee`, options: ['paid', 'free'] }] },
    { id: 2, cond: { all: [{ hour: [6, 9] }, { npc: { id: 'tully', met: true } }] }, script: 'th-the-fence-2', advance: { days: 1 },
      where: { mapId: 'pellwick', x: 28, y: 27 },
      when: 'A dawn after beat 1, during Tully\'s laps.', topic: 'FENCE.',
      choices: [{ key: `th.${T}.side`, options: ['broker', 'bryony', 'tully'] }] },
    { id: 3, npcId: 'ambrose', cond: { all: [{ hasItem: 'timber', n: 3 }, { hour: [7, 19] }] }, script: 'th-the-fence-3',
      where: { mapId: 'pellwick', x: 40, y: 14 },
      when: 'At the co-op yard with three timber, while Ambrose is on his bench (07:00-19:00).', topic: 'Posts for Bryony.',
      choices: [{ key: `th.${T}.height`, options: ['talk', 'step'] }] },
    { id: 4, cond: { hour: [7, 12] }, script: 'th-the-fence-4', advance: { days: 1 }, where: { mapId: 'pellwick', x: 28, y: 27 },
      when: 'The morning after the posts are cut.', topic: 'Raising the fence.',
      choices: [{ key: `th.${T}.sedgehare`, options: ['knelt', 'waited'] }],
      reward: { share: true, creature: { species: 'sedgehare', level: 14 } } },
  ],
};
