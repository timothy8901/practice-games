/**
 * Linnet, *The Ember Grub* (cast arc, 5 beats). [DATA-THREADS] GDD-08 §7.7; GDD-00 §11.
 *
 * The rival arc's battles and set-pieces are GDD-07 story scripts (`linnet-dock-*`,
 * `linnet-brackenford-*`, `linnet-fall`, `linnet-returns`, `linnet-gate-*`). This arc is what
 * happens between them, on her porch next door: each beat follows one story beat and remembers what
 * you told her. Beat 3 is carried by Maud (Linnet's porch is dark; Maud ferried her away). Beat 4 is
 * the Sootling's window read on her own lit step ("Read it for me. I'm not asking Merrow."). Beat 5
 * is the coda: Linnet learning Maud's wheel. Cast arcs pay no resident share. Pure data.
 * @module data/threads/ember-grub
 */

const T = 'ember-grub';
const mem = (key, value, npc = 'linnet') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

export const scripts = {
  'th-ember-grub-1': [
    '* Linnet is on her porch next door, sitting on the rail with her boots swinging. Her Caldermaw lies across the whole garden like a cooling hill. Its breath steams.',
    'Linnet: Neighbor. ~ It doesn\'t fit through the door. I tried. It took some of the door frame with it.',
    'Linnet: It glowed, and it changed, and it\'s ENORMOUS, and it\'s still mine. It still comes when I whistle. The ground shakes a bit, but it comes.',
    { op: 'choice', options: [
      { text: 'Bench it sometimes. Let the others learn.', then: [
        ...mem('advice', 'bench'),
        'Linnet: Bench it? It\'s a VOLCANO. You don\'t bench a volcano. ~ Fine. Noted. Ignored, but noted.',
      ] },
      { text: 'It\'s magnificent.', then: [
        ...mem('advice', 'praise'),
        'Linnet: It IS, isn\'t it. ~ Thank you. Everyone else just asks who\'s paying for the door.',
      ] },
    ] },
    'Linnet: Brackenford, when you\'ve got a badge. I\'m not fighting you without one. It\'d be unfair. To me.',
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-ember-grub-2': [
    '* Linnet\'s porch. She is rebandaging her Caldermaw\'s foreleg very carefully, and not looking at you.',
    'Linnet: You beat me at Brackenford. ~ You beat ME. With a team. They all took turns. That\'s allowed, apparently.',
    'Linnet: Caldermaw carried everything. Everything I\'ve got is Caldermaw and three creatures who mostly watch.',
    { op: 'if', cond: { flag: `th.${T}.advice`, is: 'bench' },
      then: ['Linnet: You told me to bench it. I didn\'t listen. ~ I\'m still not listening. But I heard you.'] },
    { op: 'choice', options: [
      { text: 'Train the others. You\'ll need them.', then: [
        ...mem('rematch', 'train'),
        'Linnet: ...Maybe. MAYBE. Don\'t look smug about it.',
      ] },
      { text: 'Caldermaw will carry you anywhere.', then: [
        ...mem('rematch', 'carry'),
        'Linnet: Right? RIGHT? ~ I knew you\'d see it.',
        '* The Caldermaw lets out a long hot breath. You can\'t tell whether it agrees.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-ember-grub-3': [
    '* Linnet\'s porch is dark. Down at her berth, Maud is coiling a rope that doesn\'t need coiling.',
    'Maud: You\'re looking for the stoat. ~ I took her out on the first crossing. She paid in exact change and didn\'t say a word the whole way, which for that one is a medical event.',
    'Maud: She had the little ember thing inside her coat. The grub. Wouldn\'t let the stone woman or the salt man near it.',
    { op: 'choice', options: [
      { text: 'Where did you take her?', then: [
        ...mem('fall', 'where'),
        'Maud: Where she asked. Some things aren\'t a ferry pilot\'s to tell. ~ Is that a no I hear? Good.',
      ] },
      { text: 'Was she looking after the Sootling?', then: [
        ...mem('fall', 'grub'),
        'Maud: Held it like it might break. It might, the size of it. ~ She was talking to it when she got off. Talking\'s a good sign.',
      ] },
    ] },
    'Maud: She\'ll be back. People come back to a harbor; it\'s what harbors are for. That\'s my reading. ~ Confirm? ~ Confirmed.',
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],

  'th-ember-grub-4': [
    '* Linnet\'s porch is lit again. She sits on the step in white winter fur, with the Sootling asleep in her hood.',
    'Linnet: Don\'t say anything about the coat. It\'s winter. It happens. ~ You can say it looks good. Once.',
    '* The Sootling stirs. On its brow the mark is glowing, faint and pink, and leaning.',
    'Linnet: It\'s going to Shift. Tonight, maybe. ~ I could have asked you on the ice. I wanted to ask here, on my own step, because that\'s harder. Read it for me. I\'m not asking Merrow.',
    '* You raise the Reading Glass. Three ways, odds showing: one bigger, one the same size, one smaller still. None of them a stranger.',
    { op: 'choice', options: [
      { text: 'Tell her exactly what you see.', then: [
        ...mem('read', 'exact'),
        'Linnet: Okay. ~ Okay. Those are the odds. I can hold odds.',
      ] },
      { text: 'Tell her it\'ll still be hers, whichever.', then: [
        ...mem('read', 'hers'),
        'Linnet: Whichever. ~ Yeah. The mark\'s in the same place. Same as always.',
      ] },
    ] },
    '* She doesn\'t reach for a stone. She doesn\'t reach for salt. She tucks the Sootling back into her hood to let the window land in its own time, on her own step. ~ Whatever it wakes up as, the mark will be in the same place.',
    'Linnet: Not Merrow. Not Varga. My neighbor. ~ Thanks, neighbor.',
    { op: 'beat', thread: T, to: 4 },
    { op: 'end' },
  ],

  'th-ember-grub-5': [
    '* Maud\'s punt, early. Linnet is at the wheel. Maud stands behind her with her wings folded, pretending not to supervise.',
    'Linnet: Maud says I can learn the ring line. Not the Outer Isles yet. Just round. Every dock, every tide.',
    'Maud: She over-steers. ~ She\'ll stop. Confirm, Linnet?',
    'Linnet: Confirmed.',
    { op: 'choice', options: [
      { text: 'You\'ll be good at it.', then: [
        ...mem('wheel', 'good'),
        'Linnet: I\'ll be the BEST at it. ~ Sorry. Old habit. I\'ll be good at it.',
      ] },
      { text: 'Take me round once you\'re licensed.', then: [
        ...mem('wheel', 'ride'),
        'Linnet: First passenger. No charge. ~ Fine, half charge. I\'ve got a bench to feed.',
      ] },
    ] },
    'Linnet: Funny. I wanted to be first at everything. Now I just want to get everybody where they\'re going.',
    { op: 'beat', thread: T, to: 5 },
    { op: 'end' },
  ],
};

export default {
  id: T, npcId: 'linnet', title: 'The Ember Grub', kind: 'cast',
  summary: 'The rival next door: a titan at the dock, a one-carry team, the fall to a palm-sized ember grub, a return in ermine, and a wheel.',
  involve: { flag: 'sp.dock-battle' },
  beats: [
    { id: 1, cond: { all: [{ flag: 'sp.dock-battle' }, { hour: [19, 1] }] }, script: 'th-ember-grub-1', porch: true,
      when: 'Porch talk on a night after the dock (`linnet-dock-after`).', topic: 'A volcano in the garden.',
      choices: [{ key: `th.${T}.advice`, options: ['bench', 'praise'] }] },
    { id: 2, cond: { all: [{ flag: 'sp.linnet-rematch' }, { hour: [19, 1] }] }, script: 'th-ember-grub-2', porch: true,
      when: 'Porch talk after the Brackenford rematch.', topic: 'Rematch the rematch.',
      choices: [{ key: `th.${T}.rematch`, options: ['train', 'carry'] }] },
    { id: 3, npcId: 'maud', cond: { flag: 'sp.linnet-fell' }, script: 'th-ember-grub-3', where: { mapId: 'pellwick', x: 50, y: 38 },
      when: 'At Maud\'s berth after Linnet\'s fall (her porch is dark).', topic: 'The stoat on the first crossing.',
      choices: [{ key: `th.${T}.fall`, options: ['where', 'grub'] }] },
    { id: 4, cond: { all: [{ flag: 'sp.linnet-returned' }, { hour: [19, 1] }] }, script: 'th-ember-grub-4', porch: true,
      when: 'Porch talk once she is back and her porch relit.', topic: 'Read it for me.',
      choices: [{ key: `th.${T}.read`, options: ['exact', 'hers'] }] },
    { id: 5, cond: { seen: 'linnet-gate-after' }, script: 'th-ember-grub-5', advance: { days: 1 }, where: { mapId: 'pellwick', x: 50, y: 38 },
      when: 'A morning after the Shardcrown gate, at Maud\'s punt.', topic: 'Maud\'s wheel.',
      choices: [{ key: `th.${T}.wheel`, options: ['good', 'ride'] }],
      reward: { share: false } },
  ],
};
