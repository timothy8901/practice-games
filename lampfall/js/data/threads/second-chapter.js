/**
 * Thessaly, *The Second Chapter* (template thread, 3 beats). [DATA-THREADS] GDD-08 §7.10.
 *
 * The template every later neighbor thread copies (the dark-house arrivals after the Relighting):
 * beat 1 ASK (a small request at the neighbor's post, one remembered choice), beat 2 TURN (a
 * letter or a lit porch changes what they want, one remembered choice), beat 3 GIVE (they show
 * what your choices made and hand over a small gift). No resident share; cut-order 5.
 * Thessaly is a bilby who writes with ink to the wrists. Everyone in the harbor lived chapter one
 * the night the light went out; her great-aunt's almanac (F13) has this year circled, so chapter
 * two is now, and the newcomer is on page one. Pure data.
 * @module data/threads/second-chapter
 */

const T = 'second-chapter';
const mem = (key, value, npc = 'thessaly') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

export const scripts = {
  'th-second-chapter-1': [
    '* Thessaly is on her bench with a notebook on her knee and ink on both paws, up to the wrists. Her enormous ears swivel towards you before the rest of her does.',
    'Thessaly: Ah. The one who walked. ~ You\'re in it, you know. Page one of chapter two. You will be. I haven\'t started chapter two.',
    'Thessaly: Chapter one is the night the light went out. Everybody here lived chapter one that night, one way or another. Nobody\'s written two. Nothing happened worth a new chapter. ~ Until something walked across the causeway.',
    'Thessaly: Tell me one true thing you saw today. Just one. I collect them.',
    { op: 'choice', options: [
      { text: 'The flats were glowing.', then: [
        ...mem('truth', 'flats'),
        'Thessaly: Glowing. ~ Cyan, or green? No, don\'t tell me. I\'ll go and look tonight. Writers should go and look.',
      ] },
      { text: 'A creature changed its shape.', then: [
        ...mem('truth', 'shift'),
        'Thessaly: Changed. ~ And was it still itself, after? ~ That\'s the whole book, you know. That\'s every book.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-second-chapter-2': [
    '* Thessaly\'s porch is lit. She sits under the lamp with a fat old almanac open on her knee. A Wirewhisk is curled in the spine, humming.',
    'Thessaly: My great-aunt\'s almanac. From Windle. The coffee ring is hers. The jam is mine, I\'m afraid.',
    '* She turns it round. On the page for this year, someone has drawn a careful circle in brown ink, thirty years ago.',
    'Thessaly: The wanderer comes back every thirty years, she says, and every time it does, somebody\'s next chapter starts. ~ She circled this year. She circled NOW.',
    'Thessaly: I need a title for chapter two. You choose. You\'re in it.',
    { op: 'choice', options: [
      { text: '"The Return."', then: [
        ...mem('title', 'return'),
        'Thessaly: The Return. ~ Plain. Good. Plain titles age well.',
      ] },
      { text: '"Paying Attention."', then: [
        ...mem('title', 'attention'),
        'Thessaly: Paying Attention. ~ Oh, that\'s a little unkind to all of us. I love it.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-second-chapter-3': [
    '* Thessaly waves you over to the bench with an inky paw. She holds a single page, copied out clean.',
    'Thessaly: First page of chapter two. Sit. I\'ll read it. Don\'t make faces; writers can see faces.',
    { op: 'if', cond: { flag: `th.${T}.title`, is: 'return' },
      then: ['Thessaly: "Chapter Two. The Return."'],
      else: ['Thessaly: "Chapter Two. Paying Attention."'] },
    { op: 'if', cond: { flag: `th.${T}.truth`, is: 'flats' },
      then: ['Thessaly: "The flats glowed the night the newcomer came, and nobody had looked at them properly in thirty years."'],
      else: ['Thessaly: "A creature changed its shape on the point, and stayed itself, and somebody was there to see it."'] },
    'Thessaly: "The newcomer walked across the causeway as the sea closed behind, and the harbor, which had been holding its breath for a very long time, let it out." ~ That\'s as far as I\'ve got. The rest depends on you.',
    { op: 'choice', options: [
      { text: 'Keep going. I want to know what happens.', then: [
        ...mem('ending', 'more'),
        'Thessaly: So do I. ~ That\'s the trouble with writing it while it\'s happening.',
      ] },
      { text: 'Leave the ending blank for now.', then: [
        ...mem('ending', 'blank'),
        'Thessaly: Blank. ~ Odile says blank is just early. I think she\'s right.',
      ] },
    ] },
    'Thessaly: Here. A seedling from my aunt\'s garden; it came with the almanac. Plant it where you\'ll see it from a bench.',
    { op: 'give', item: 'fruit-seedling', n: 1 },
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],
};

export default {
  id: T, npcId: 'thessaly', title: 'The Second Chapter', kind: 'template',
  summary: 'Thessaly is writing chapter two of the harbor\'s story, and you are on page one. The three-beat template (ask, turn, give) for every later neighbor.',
  template: { beats: ['ask', 'turn', 'give'] },
  beats: [
    { id: 1, cond: { hour: [10, 16] }, script: 'th-second-chapter-1', where: { mapId: 'pellwick', x: 38, y: 20 },
      when: 'Her bench hours, 10:00-16:00.', topic: 'One true thing.', template: 'ask',
      choices: [{ key: `th.${T}.truth`, options: ['flats', 'shift'] }] },
    { id: 2, cond: { all: [{ flag: 'sys.porch.porch-thessaly' }, { hour: [10, 23] }] }, script: 'th-second-chapter-2', advance: { days: 1 },
      where: { mapId: 'pellwick', x: 38, y: 20 },
      when: 'Once F13 has lit her porch (the almanac comes home).', topic: 'A circled year.', template: 'turn',
      choices: [{ key: `th.${T}.title`, options: ['return', 'attention'] }] },
    { id: 3, cond: { all: [{ flag: 'sp.act-3' }, { hour: [10, 16] }] }, script: 'th-second-chapter-3', advance: { days: 2 },
      where: { mapId: 'pellwick', x: 38, y: 20 },
      when: 'Her bench hours once the comet has brightened (Act III).', topic: 'Page one.', template: 'give',
      choices: [{ key: `th.${T}.ending`, options: ['more', 'blank'] }],
      reward: { share: false, gift: 'fruit-seedling' } },
  ],
};
