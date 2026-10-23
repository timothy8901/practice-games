/**
 * Juniper, *Heirlooms Going Home* (lead thread, 6 beats). [DATA-THREADS] GDD-08 §7.5; GDD-00 §11.
 *
 * Family letters to lit porches return heirlooms from Juniper's back room: the Dorrows' kettle
 * (F1), the Bracks' Still Knot (F4, once Tamsin is in dark house 1), a grade-two lantern (F6). F3,
 * a bosun's IOU on her grandmother's slate, starts the reveal; F6 finishes it: her family kept the
 * shop open through the Ebb winter on credit nobody repaid, and she has bought back the town's
 * pawned things ever since so no mainland dealer could have them. F14 names the last heirloom,
 * Isolde's Lantern, which she shows you and keeps back. She hands it over at 17:30 on the
 * Relighting (story script `the-relighting`, GDD-07); the morning after, beat 6 finishes the thread
 * and pays the resident share (to the Commons Jar once the loan is clear).
 * Beat conds accept either the letter read or the heirloom in the satchel, so they hold whichever
 * of the two systems records first. Pure data.
 * @module data/threads/heirlooms-going-home
 */

const T = 'heirlooms-going-home';
const mem = (key, value, npc = 'juniper') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

export const scripts = {
  'th-heirlooms-going-home-1': [
    '* Juniper is behind the counter at Pell\'s, polishing a teaspoon that is already very shiny.',
    'Juniper: The Dorrows\' porch is lit! I saw it from the shop step. And the kettle went home? Good. GOOD. That kettle sat on my third shelf for thirty years and never once made tea.',
    'Juniper: Come here. Back room. Don\'t touch anything that sparkles; I\'ll know.',
    '* The back room is shelves to the ceiling, every shelf lined with things wrapped in brown paper and string, each with a label in Juniper\'s tidy hand. A clock. A child\'s boots. A ship in a bottle. A brass bell-pull.',
    'Juniper: Everything people pawned when the harbor went dark. Gran bought it before the mainland dealers could, and I kept it. When a porch lights again and its letter comes home, its thing goes back. For nothing.',
    { op: 'choice', options: [
      { text: 'Why for nothing?', then: [
        ...mem('first', 'why'),
        'Juniper: Because it\'s theirs. ~ And because I\'m a theatrical old bird and I like a good entrance. Next question.',
      ] },
      { text: 'How many are there?', then: [
        ...mem('first', 'count'),
        'Juniper: Two hundred and eleven. ~ Two hundred and ten, now. Every one\'s a story. I collect the stories. The things just come with them.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-heirlooms-going-home-2': [
    '* There is a slate on the counter, a real one, in a frame gone silver with age. It is covered edge to edge in faded chalk.',
    'Juniper: You brought Hal Gannet\'s letter in. Eleven sacks of flour. Four of oats. The good tea. He wrote it down so somebody would.',
    'Juniper: This was my gran\'s slate. Agnes Pell. The whole quay\'s winter is on it. Nobody ever paid it, because nobody had anything to pay with.',
    { op: 'choice', options: [
      { text: 'Can I see it?', then: [
        ...mem('slate', 'looked'),
        '* She turns it round. Names in columns: Gannet, Rask, Brack, Dorrow, Thole, Skerry. Every house you know, and some you don\'t yet.',
        'Juniper: She never rubbed out one line. Not one.',
      ] },
      { text: 'You don\'t owe me the story.', then: [
        ...mem('slate', 'spared'),
        'Juniper: No. I don\'t. ~ That\'s why I\'ll tell you. Later. When I\'ve had a cup of something.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-heirlooms-going-home-3': [
    '* Tamsin is at the counter with her arms folded. Juniper is holding out a small coil of old cord, tied in a knot your eyes slide off.',
    'Juniper: The Bracks\' knot. Your family\'s. The keeper tied it for your creel creature, thirty years back.',
    'Tamsin: I\'ll pay for it. What\'s it worth?',
    'Juniper: It isn\'t for sale. It was never for sale. It was for keeping.',
    'Tamsin: Everything\'s for sale. We sold a BOAT.',
    '* They both look at you.',
    { op: 'choice', options: [
      { text: 'Take it, Tamsin. It\'s yours.', then: [
        ...mem('knot', 'take'),
        { op: 'remember', npc: 'tamsin', key: `${T}.knot`, value: 'take' },
        'Tamsin: ...Fine. Fine. But I\'m bringing you the best cockle of every low until I feel square.',
        'Juniper: Done! She\'s robbing me blind and I\'m charmed.',
      ] },
      { text: 'Let them haggle it out.', then: [
        ...mem('knot', 'haggle'),
        { op: 'remember', npc: 'tamsin', key: `${T}.knot`, value: 'haggle' },
        '* They haggle for ten minutes. At the end of it Juniper has agreed to accept nothing, and Tamsin has agreed to pay it in instalments.',
        'Juniper: A fine piece of business. Everybody loses. My favourite.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],

  'th-heirlooms-going-home-4': [
    '* Pell\'s, at closing. The sign is turned but the door isn\'t locked. Juniper has been waiting for you.',
    'Juniper: Augusta cried when I gave her the lantern back. Augusta! I\'ve known her fifty years and never seen her damp anywhere but the sea.',
    'Juniper: Sit. I said I\'d tell you.',
    'Juniper: The winter the light went out there were no boats, no money and no flour coming. Gran kept the shop open anyway, on the slate, for every house on the quay. All winter.',
    'Juniper: Nobody paid, because they couldn\'t. Then they left, and they pawned what they couldn\'t carry, and Gran bought all of it so it wouldn\'t go to the mainland. She died with the slate full. I\'ve been giving it back ever since. Not the money. The things.',
    { op: 'choice', options: [
      { text: 'That\'s a debt too. They owe you.', then: [
        ...mem('reveal', 'debt'),
        'Juniper: Do they? ~ Gran said a debt is just a story somebody hasn\'t finished. I\'m finishing it. One porch at a time.',
      ] },
      { text: 'That isn\'t a debt. That\'s a town.', then: [
        ...mem('reveal', 'town'),
        '* Juniper freezes halfway to a teaspoon. Then she laughs, and doesn\'t stop for a while.',
        'Juniper: Oh, that\'s going on the slate. Top line. In chalk.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 4 },
    { op: 'end' },
  ],

  'th-heirlooms-going-home-5': [
    'Juniper: You\'ve read it, haven\'t you. The keeper\'s letter to Gran. I can tell. You\'ve got your reading face on.',
    '* She takes you into the back room, to the top shelf, and lifts down a bundle wrapped in faded blue cloth. Through the cloth you can feel brass, and glass, and something that might be warmth.',
    'Juniper: Her lantern. She left it on that counter the night she went. Gran never sold it, never lent it, never let me play with it, and believe me, I asked.',
    'Juniper: "Give it to whoever pays down the dark," she said. ~ Not yet. When the Lamp Room\'s built. Not a day before. I promised a magpie who\'s not here to check, which is worse.',
    { op: 'choice', options: [
      { text: 'Can I hold it, just for a second?', then: [
        ...mem('lantern', 'asked'),
        'Juniper: No. ~ Sorry. No. If I let you hold it now I\'ll let you keep it now, and then where\'s my entrance?',
      ] },
      { text: 'I\'ll come for it when it\'s time.', then: [
        ...mem('lantern', 'waited'),
        'Juniper: You will. I\'ve watched you carry everybody\'s things up and down that hill. ~ You\'re exactly what she meant.',
      ] },
    ] },
    '* She wraps it again, carefully, and puts it back on the top shelf, at the front.',
    { op: 'beat', thread: T, to: 5 },
    { op: 'end' },
  ],

  'th-heirlooms-going-home-6': [
    '* The back room at Pell\'s. The top shelf is empty. There is a clean square in the dust where the blue bundle sat for thirty years.',
    'Juniper: Look at that. ~ Empty. I\'ve never seen that shelf empty. I don\'t care for it. I\'m putting biscuits on it.',
    'Juniper: The beam came round over the shop last night and I stood on the step like a fool and counted. It touched every porch on Gran\'s slate. Every one that\'s lit, anyway. The rest are coming.',
    { op: 'if', cond: { flag: `th.${T}.reveal`, is: 'debt' },
      then: ['Juniper: You said they owed me. I\'ve decided they\'ve paid. ~ Not in buttons. In porches.'],
      else: ['Juniper: "Not a debt. A town." It\'s on the slate, top line, like I said. I\'ve stopped rubbing anything out.'] },
    { op: 'choice', options: [
      { text: 'Your gran would be proud.', then: [
        ...mem('end', 'proud'),
        'Juniper: Gran would be insufferable. ~ Thank you.',
      ] },
      { text: 'What\'s left in the back room?', then: [
        ...mem('end', 'left'),
        'Juniper: Two hundred and some. The dark houses. They\'ll come home one a night now, Augusta says. I\'ll be here. I\'m always here. I\'m the shop.',
      ] },
    ] },
    'Juniper: I\'ve told Wren you\'re owed a notch. She says your loan\'s done, so it goes in the Commons Jar and the town can argue about it.',
    { op: 'beat', thread: T, to: 6 },
    { op: 'end' },
  ],
};

export default {
  id: T, npcId: 'juniper', title: 'Heirlooms Going Home', kind: 'lead',
  summary: 'Juniper\'s back room holds everything the harbor pawned. Each family letter to a lit porch sends one thing home, and the last is Isolde\'s Lantern.',
  beats: [
    { id: 1, cond: { any: [{ letter: { read: 21 } }, { hasItem: 'dorrow-kettle' }] }, script: 'th-heirlooms-going-home-1',
      where: { mapId: 'int-pells', x: 6, y: 4 },
      when: 'At Pell\'s once F1 has gone home (the Dorrows\' kettle).', topic: 'The back room.',
      choices: [{ key: `th.${T}.first`, options: ['why', 'count'] }] },
    { id: 2, cond: { letter: { read: 23 } }, script: 'th-heirlooms-going-home-2', advance: { days: 1 },
      where: { mapId: 'int-pells', x: 6, y: 4 },
      when: 'At Pell\'s after F3 (the bosun\'s IOU).', topic: 'Gran\'s slate.',
      choices: [{ key: `th.${T}.slate`, options: ['looked', 'spared'] }] },
    { id: 3, cond: { any: [{ hasItem: 'brack-still-knot' }, { all: [{ letter: { read: 24 } }, { flag: 'sp.tamsin-arrived' }] }] },
      script: 'th-heirlooms-going-home-3', advance: { days: 1 }, where: { mapId: 'int-pells', x: 6, y: 4 },
      when: 'At Pell\'s once F4 is delivered and Tamsin lives in dark house 1.', topic: 'The Bracks\' knot.',
      choices: [{ key: `th.${T}.knot`, options: ['take', 'haggle'] }] },
    { id: 4, cond: { any: [{ hasItem: 'grade-two-lantern' }, { letter: { read: 26 } }] }, script: 'th-heirlooms-going-home-4', advance: { days: 1 },
      where: { mapId: 'int-pells', x: 6, y: 4 },
      when: 'At Pell\'s after F6 (Augusta\'s lantern), any hour the shop is open.', topic: 'The Ebb winter, on credit.',
      choices: [{ key: `th.${T}.reveal`, options: ['debt', 'town'] }] },
    { id: 5, cond: { letter: { read: 34 } }, script: 'th-heirlooms-going-home-5', advance: { days: 1 },
      where: { mapId: 'int-pells', x: 6, y: 4 },
      when: 'At Pell\'s after F14 (Isolde to Agnes Pell).', topic: 'The blue bundle.',
      choices: [{ key: `th.${T}.lantern`, options: ['asked', 'waited'] }] },
    { id: 6, cond: { flag: 'sp.relighting' }, script: 'th-heirlooms-going-home-6', where: { mapId: 'int-pells', x: 6, y: 4 },
      when: 'The day after the Relighting (Juniper hands over the Lantern in `the-relighting`).', topic: 'The empty shelf.',
      choices: [{ key: `th.${T}.end`, options: ['proud', 'left'] }],
      reward: { share: true, keepsake: 'isoldes-lantern', keepsakeVia: 'the-relighting' } },
  ],
};
