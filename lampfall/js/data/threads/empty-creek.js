/**
 * Ansel, *The Empty Creek* (cast arc, 5 beats). [DATA-THREADS] GDD-08 §7.9; GDD-00 §11.
 *
 * Ansel Stalk fishes the dry north creek every evening. His beats follow Isolde's letters: K1 (the
 * river is wrong), K2 ("young Stalk"), K8 (the storm night he watched from the quay). Beat 4 is the
 * confession at K9 + beat 4: the canonical scene is the story script `ansel-confession` (GDD-07),
 * called here between a lead-in and an aftermath that decides what happens to his unsent addendum
 * (T18). Once he has confessed AND the lamp is lit, beat 5 turns the weir wheel (`ansel-weir-wheel`)
 * and the creek runs to the sea again. The wheel still needs two. Cast arcs pay no resident share.
 * Pure data.
 * @module data/threads/empty-creek
 */

const T = 'empty-creek';
const mem = (key, value, npc = 'ansel') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

export const scripts = {
  'th-empty-creek-1': [
    '* Evening at the north creek. Clear water over empty stones, a thin trickle where a river ought to be. Ansel stands on one leg in it, very still. He strikes, and misses, as he always does.',
    'Ansel: Nothing in it. ~ I know.',
    'Ansel: Hesper\'s been delivering, I hear. She reads slowly and talks fast.',
    { op: 'choice', options: [
      { text: 'Then why fish it?', then: [
        ...mem('first', 'why'),
        'Ansel: Habit. ~ Something to stand in. A heron has to stand in something.',
      ] },
      { text: '(Stand on the bank and watch the water.)', then: [
        ...mem('first', 'stood'),
        '* You stand on the bank. He doesn\'t look round. After a while he shifts his weight onto the other leg, which you suspect is a kind of welcome.',
      ] },
    ] },
    'Ansel: Forked tail, by the piling. That\'s where they\'d be, if there were any. ~ Go on home. Tide\'s turning.',
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-empty-creek-2': [
    '* Ansel is at the creek again. He has a fish this time, a small one, caught somewhere else. He is looking at it, not eating it.',
    'Ansel: She wrote "young Stalk". Hesper told the whole post office. ~ I was twenty-six. I had a good coat and a bad habit of being sure.',
    'Ansel: "Writes a good report and reads a poor drawing." ~ That\'s fair. She was always fair. It was the worst thing about her.',
    { op: 'choice', options: [
      { text: 'She also said you write a good report.', then: [
        ...mem('young', 'kind'),
        'Ansel: She did, didn\'t she. ~ Hm.',
        '* He puts the fish in the water. It swims off downstream, the only fish in the creek.',
      ] },
      { text: '(Say nothing.)', then: [
        ...mem('young', 'silent'),
        '* You say nothing. The creek says nothing. Ansel seems to find this restful.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-empty-creek-3': [
    '* Late. Ansel isn\'t fishing. He sits on the gunwale of his beached launch with an old notebook open on his knee, its pages gone soft as cloth.',
    'Ansel: You\'ve read the storm one. ~ I was on the quay that night. I saw the lamp go out. Midnight. I wrote it down, because that\'s what I did. I wrote things down.',
    'Ansel: Then the bar. Then everyone wading in with lanterns, children on shoulders. I wrote that down too. I wrote everything down, and none of it was the thing that mattered.',
    { op: 'choice', options: [
      { text: 'What was the thing that mattered?', then: [
        ...mem('storm', 'asked'),
        'Ansel: Ask me when Hesper brings the next one. ~ I\'ll know if you\'ve read it.',
      ] },
      { text: '(Sit on the gunwale beside him.)', then: [
        ...mem('storm', 'sat'),
        '* You sit. The launch creaks. He closes the notebook gently, as if it might wake.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],

  'th-empty-creek-4': [
    '* Evening. The creek. Ansel stands on one leg in the empty water, the way he has every evening since you came.',
    'Ansel: Hesper brought you the morning after. I can tell by the way you walked up.',
    { op: 'call', script: 'ansel-confession' },
    { op: 'setFlag', id: 'sp.ansel-confessed' },
    'Ansel: There\'s an addendum. To the report. I\'ve written it four times. It\'s in a drawer.',
    { op: 'choice', options: [
      { text: 'Post it. Let the town read it.', then: [
        ...mem('addendum', 'post'),
        'Ansel: Augusta would pin it to the Commons board. The whole harbor would read it before breakfast. ~ ...Yes. All right. Thirty years is long enough to be brave about something.',
      ] },
      { text: 'Keep it. Tell them yourself, when you can.', then: [
        ...mem('addendum', 'tell'),
        'Ansel: Out loud. ~ I\'m better on paper. ~ But I\'ll try. I\'ll start with Hesper. She\'ll tell everyone else, slowly.',
      ] },
    ] },
    { op: 'if', cond: { letter: { read: 14 } },
      then: ['Ansel: She said it was a good report. In the letter. ~ She wanted the drawing back. I\'ve still got it. I\'ll send it, if anybody knows where.'] },
    { op: 'beat', thread: T, to: 4 },
    { op: 'end' },
  ],

  'th-empty-creek-5': [
    '* Morning, up at the weir. The old sluice wheel is red with rust and taller than Ansel. He has brought oil, a mallet and his good coat, which he has taken off and folded on a stone.',
    'Ansel: Light\'s on. No excuse left, then.',
    'Ansel: She came up here in the dark, with a creature changing under her hands. The wheel needed two. ~ It still does.',
    { op: 'choice', options: [
      { text: 'Put your shoulder to it beside him.', then: [
        ...mem('wheel', 'two'),
        '* You set your shoulder to the wheel beside his. Nothing. Nothing. Then a shriek of iron, a shudder, and the wheel gives a quarter turn, and then another.',
      ] },
      { text: 'Let him try it alone first.', then: [
        ...mem('wheel', 'alone'),
        '* You stand back. Ansel leans his whole thin weight on the spoke and nothing happens. He leans again. Then he looks at you, and you step in without a word, and the wheel moves.',
      ] },
    ] },
    { op: 'call', script: 'ansel-weir-wheel' },
    { op: 'setFlag', id: 'sp.weir-turned' },
    '* Below the weir, for the first time in thirty years, the river runs down the north creek all the way to the sea.',
    'Ansel: The bar will take seasons. ~ The fish will come back first. A few a week. I\'ll be here. I\'ll count them.',
    { op: 'beat', thread: T, to: 5 },
    { op: 'end' },
  ],
};

export default {
  id: T, npcId: 'ansel', title: 'The Empty Creek', kind: 'cast',
  summary: 'The harbormaster who named the keeper fishes an empty creek every evening. He confesses, and once the lamp is lit he turns his grandfather\'s weir.',
  involve: { letter: { read: 1 } },
  beats: [
    { id: 1, cond: { all: [{ letter: { read: 1 } }, { hour: [17, 23] }] }, script: 'th-empty-creek-1', where: { mapId: 'pellwick', x: 30, y: 5 },
      when: 'An evening at the north creek (17:00-23:00) after K1.', topic: 'Nothing in it.',
      choices: [{ key: `th.${T}.first`, options: ['why', 'stood'] }] },
    { id: 2, cond: { all: [{ letter: { read: 2 } }, { hour: [17, 23] }] }, script: 'th-empty-creek-2', advance: { days: 1 }, where: { mapId: 'pellwick', x: 30, y: 5 },
      when: 'An evening after K2.', topic: '"Young Stalk."',
      choices: [{ key: `th.${T}.young`, options: ['kind', 'silent'] }] },
    { id: 3, cond: { all: [{ letter: { read: 8 } }, { hour: [17, 23] }] }, script: 'th-empty-creek-3', advance: { days: 1 }, where: { mapId: 'pellwick', x: 26, y: 6 },
      when: 'An evening after K8, at his beached launch.', topic: 'He saw the lamp go out.',
      choices: [{ key: `th.${T}.storm`, options: ['asked', 'sat'] }] },
    { id: 4, cond: { all: [{ letter: { read: 9 } }, { hour: [17, 23] }] }, script: 'th-empty-creek-4', where: { mapId: 'pellwick', x: 30, y: 5 },
      when: 'An evening after K9: the confession (`ansel-confession`).', topic: 'The morning after.',
      choices: [{ key: `th.${T}.addendum`, options: ['post', 'tell'] }] },
    { id: 5, cond: { all: [{ flag: 'sp.ansel-confessed' }, { flag: 'sp.relighting' }] }, script: 'th-empty-creek-5', advance: { days: 1 },
      where: { mapId: 'pellwick', x: 20, y: 3 },
      when: 'A day after both the confession and the Relighting, at the weir (`ansel-weir-wheel`).', topic: 'The wheel needs two.',
      choices: [{ key: `th.${T}.wheel`, options: ['two', 'alone'] }],
      reward: { share: false, story: 'ansel-weir-wheel' } },
  ],
};
