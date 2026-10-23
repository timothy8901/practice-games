/**
 * Barnaby, *The Bell* (lead thread, 4 beats). [DATA-THREADS] GDD-08 §7.6; GDD-00 §11.
 *
 * Barnaby ties the first string on his wall once you have read K2 (the weir). K7 says where the
 * fleet's bell went down; at the first spring low after it (every Saturday) you dig it out of the
 * bared Old Quay (story set-piece `bell-dig`, GDD-07, called from beat 3) and he moves out of the
 * diving helmet into the bell: "Exhibit 1: My Old House". When the weir records (F8) and K10 are
 * both in, he ties the last string between the weir records, Isolde's letters and the lamp, and for
 * once speaks without parentheses: "Oh. Oh, that poor keeper." Finishing pays the resident share.
 * Pure data.
 * @module data/threads/the-bell
 */

const T = 'the-bell';
const mem = (key, value, npc = 'barnaby') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

export const scripts = {
  'th-the-bell-1': [
    '* Barnaby\'s porthole is fogged. He is standing on a stool in front of a wall of pins and red string, a find in one claw and a letter in the other.',
    'Barnaby: You\'ve read the second one! The weir! (Hesper told me. Hesper tells me everything, slowly.) Oh, this is a string day. I can feel it.',
    'Barnaby: Every find on this wall has a provenance (where, when, what tide, who), and every provenance touches a letter. String goes from what to why. That\'s a museum. (I\'m fairly sure that\'s a museum.)',
    { op: 'choice', options: [
      { text: 'Pin the letter beside the find.', then: [
        ...mem('wall', 'beside'),
        'Barnaby: Beside it! Neat. Orderly. The way a real museum would. (Is this a real museum? Don\'t answer that.)',
      ] },
      { text: 'Pin it by the weir drawing.', then: [
        ...mem('wall', 'weir'),
        'Barnaby: By the weir! Oh, you\'re thinking in string already. (I\'m so proud I could moult.)',
      ] },
    ] },
    '* He ties the first red string. It runs from a fossil on the left to a blank card on the right, labelled in tiny capitals: WHY?',
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-the-bell-2': [
    'Barnaby: The bell! The fleet\'s bell! She says it hung at the end of the Old Quay, and the quay went, and bells don\'t float! (They don\'t. I checked. I dropped a teaspoon off the quay. Juniper was furious.)',
    'Barnaby: So it\'s under the Old Quay, in the silt. And the Old Quay only comes up at a spring low. The big one. Every seventh day.',
    'Barnaby: Will you dig it? I\'d dig it myself, but I\'m small, and the helmet doesn\'t fit through anything. (It fits perfectly. I simply prefer to be snug.)',
    { op: 'choice', options: [
      { text: 'I\'ll bring a shovel.', then: [
        ...mem('plan', 'shovel'),
        'Barnaby: Saturday! The spring low! I\'ll bring the cards. (Provenance: Old Quay, spring low, the Keeper\'s letter, you.)',
      ] },
      { text: 'Barnaby, do you want to move house?', then: [
        ...mem('plan', 'move'),
        'Barnaby: Move? ~ (Into a BELL?) ~ ...I hadn\'t thought. I\'d thought about the museum. I hadn\'t thought about me. ~ Oh, I might, though. I might.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-the-bell-3': [
    '* The spring low has pulled the sea back past the end of the Old Quay. Barnaby waits on the bared stones with a stack of blank cards and a pencil tucked behind his eyestalk.',
    'Barnaby: Here. She said here. (I measured. Twice. Three times, the third time with string.)',
    { op: 'call', script: 'bell-dig' },
    { op: 'if', cond: { not: { hasItem: 'fleet-bell' } }, then: [{ op: 'give', item: 'fleet-bell', n: 1 }] },
    '* The fleet\'s bell lies in your arms, green with thirty years of silt and heavier than it looks. When you tip it, the clapper swings, and it rings once, low, across the whole bay.',
    '* All along the quay, people stop and turn round.',
    'Barnaby: Oh. ~ (Oh.)',
    { op: 'choice', prompt: 'Where does the bell go?', options: [
      { text: 'It\'s yours, Barnaby. Move in.', then: [
        ...mem('bell', 'house'),
        '* You set the bell down on the stones in front of him. He walks all the way round it twice, then climbs in under the rim. The helmet clanks off onto the sand.',
        'Barnaby: It fits. ~ It actually fits.',
      ] },
      { text: 'Hang it where the whole town can ring it.', then: [
        ...mem('bell', 'town'),
        'Barnaby: Where everyone can ring it... ~ What if I lived in it, and left a rope out of the top? Anyone can ring. I\'ll just say hello when they do.',
        '* He climbs in under the rim. The helmet clanks off onto the sand.',
      ] },
    ] },
    { op: 'take', item: 'fleet-bell', n: 1 },
    'Barnaby: The helmet goes on a plinth. Exhibit 1: My Old House. (Provenance: me.)',
    { op: 'setFlag', id: 'sp.bell-dug' },
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],

  'th-the-bell-4': [
    '* The Archive is quiet. Barnaby\'s bell sits by the string wall with a rope hanging out of the top. He stands in front of the wall holding one last piece of red string.',
    'Barnaby: The weir records came. Thirty years late, on the harbor office\'s own paper. Never sent. (Never SENT.)',
    'Barnaby: So. The weir, here. The bar, here. The night, here. Her letters, all along the top. And the lamp.',
    '* He ties the last string. It runs from the weir records, through every one of Isolde\'s letters, to a small painted card of the lighthouse. Then he steps back, and for once he says nothing in brackets.',
    'Barnaby: Oh. Oh, that poor keeper.',
    { op: 'choice', options: [
      { text: 'She\'d be glad someone finally tied it.', then: [
        ...mem('string', 'glad'),
        'Barnaby: Would she? ~ I hope so. I\'d want someone to. I\'d want someone to look at the whole wall and see it wasn\'t my fault. Or wasn\'t only.',
      ] },
      { text: '(Say nothing. Stand with him.)', then: [
        ...mem('string', 'silent'),
        '* You stand with him in front of the wall for a long time. The rope from the bell sways a little in the draught. Nobody rings it.',
      ] },
    ] },
    'Barnaby: I\'m telling Wren you\'re owed a notch. For the bell. And the string. (And for standing still. Most people fidget.)',
    { op: 'beat', thread: T, to: 4 },
    { op: 'end' },
  ],
};

export default {
  id: T, npcId: 'barnaby', title: 'The Bell', kind: 'lead',
  summary: 'The string wall becomes the visible state of the mystery. The fleet\'s bell comes up from the Old Quay at a spring low and becomes Barnaby\'s house.',
  beats: [
    { id: 1, cond: { all: [{ flag: 'sp.field-log' }, { letter: { read: 2 } }] }, script: 'th-the-bell-1', where: { mapId: 'int-archive', x: 8, y: 5 },
      when: 'At the Archive (09:00-19:00) once K2 is read.', topic: 'The string wall.',
      choices: [{ key: `th.${T}.wall`, options: ['beside', 'weir'] }] },
    { id: 2, cond: { letter: { read: 7 } }, script: 'th-the-bell-2', advance: { days: 1 }, where: { mapId: 'int-archive', x: 8, y: 5 },
      when: 'At the Archive after K7 (the bell).', topic: 'Bells don\'t float.',
      choices: [{ key: `th.${T}.plan`, options: ['shovel', 'move'] }] },
    { id: 3, cond: { lowTide: true }, script: 'th-the-bell-3', advance: { dayOfWeek: [5] }, where: { mapId: 'pellwick', x: 54, y: 44 },
      when: 'The first spring low (Saturday) after K7, on the bared Old Quay.', topic: 'Dig at a big low.',
      choices: [{ key: `th.${T}.bell`, options: ['house', 'town'] }] },
    { id: 4, cond: { all: [{ letter: { read: 28 } }, { letter: { read: 10 } }] }, script: 'th-the-bell-4', advance: { days: 1 },
      where: { mapId: 'int-archive', x: 8, y: 5 },
      when: 'At the Archive once F8 (the weir records) and K10 are both read.', topic: 'The last string.',
      choices: [{ key: `th.${T}.string`, options: ['glad', 'silent'] }],
      reward: { share: true, keepsake: 'fleet-bell', keepsakeTo: 'barnaby' } },
  ],
};
