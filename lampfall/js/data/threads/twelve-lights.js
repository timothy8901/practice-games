/**
 * Odile, *Twelve Lights* (lead thread, 5 beats). [DATA-THREADS] GDD-08 §7.2; GDD-00 §11.
 *
 * Odile paints one canvas for each lit porch she can see from her step: the seven lit at arrival,
 * yours (loan 1), the Dorrows' (F1), Bryony's (F5) and her own (F9, painted from the green while
 * you sit on her step): eleven. Between porches she paints your starter's Shiftlog. She stalls at
 * the twelfth, the lighthouse ("you can't paint a light that isn't there") and gives up the night
 * you sit on her lit step; the eleven hang in the Archive with a blank frame. The twelfth canvas is
 * the beam, painted the morning after the Relighting; that beat finishes the thread and pays the
 * resident share (after the payoff it goes to the Commons Jar). Pure data.
 * @module data/threads/twelve-lights
 */

const T = 'twelve-lights';
const mem = (key, value, npc = 'odile') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

export const scripts = {
  'th-twelve-lights-1': [
    '* Odile is on her step with a canvas the size of a door, holding a brush out at arm\'s length and squinting along it at the harbor.',
    'Odile: Oh... you. Stand there. ~ No. There. Where the light goes... apricot. Yes. Don\'t move for a minute.',
    '* You don\'t move for a minute. Across the water, the porch at Pell\'s comes on.',
    'Odile: There. I have to catch them the minute they light. After that they\'re just lamps.',
    'Odile: I\'m painting every porch I can see from this step. One canvas each. Pell\'s, the yard, Tully\'s, the Warden\'s... Eleven, when they\'re all lit. And the twelfth...',
    '* She looks up the point at the lighthouse, black against the evening, and doesn\'t finish.',
    { op: 'choice', options: [
      { text: 'Which one is the twelfth?', then: [
        ...mem('first', 'twelfth'),
        'Odile: The tall one. ~ It isn\'t lit, so it isn\'t a painting yet. It\'s a... shape. Slate, with a cold edge.',
      ] },
      { text: 'Why not paint your own porch?', then: [
        ...mem('first', 'own'),
        'Odile: It\'s dark. It has been since Gran. ~ I never had the heart to light it on my own. Isn\'t that silly.',
      ] },
    ] },
    'Odile: Thank you for standing still. Most people fidget. You were very nearly a post.',
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-twelve-lights-2': [
    'Odile: Your porch came on last night. I saw it from the green. Honey, with a cold edge. I\'ll need a bigger brush.',
    '* She has already started. Your cottage sits small at the bottom of the canvas, under the dark tower, with one warm square of light.',
    'Odile: This one\'s yours, when it\'s dry. I\'ve lost count of everybody\'s except yours.',
    { op: 'choice', options: [
      { text: 'It looks warmer than it is.', then: [
        ...mem('cottage', 'warm'),
        'Odile: Everything does, from the green. That\'s what the green is for.',
      ] },
      { text: 'You made the tower very dark.', then: [
        ...mem('cottage', 'dark'),
        'Odile: I painted what\'s there. ~ When it\'s lit I\'ll paint that. I don\'t paint wishes. They come out muddy.',
      ] },
    ] },
    'Odile: Come and sit on my step sometime. Not now. When the light\'s right. I\'ll know when.',
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-twelve-lights-3': [
    '* Odile has pinned a long, thin strip of canvas across her easel, like a ribbon.',
    'Odile: Corin says your little one has a Shiftlog now. Every shape it\'s been, in a row. ~ May I paint it? Between porches. I need something that keeps changing, or I paint the same harbor over and over.',
    '* She looks at your creature for a long time. Then at its mark. Then back at the strip.',
    { op: 'choice', options: [
      { text: 'Paint every form it has been.', then: [
        ...mem('shiftlog', 'forms'),
        'Odile: All of them, end to end, with the mark in the same place on each, so you can follow it like a lamp across a bay. ~ Yes.',
      ] },
      { text: 'Just paint the mark.', then: [
        ...mem('shiftlog', 'mark'),
        'Odile: Only the mark? ~ Oh. That\'s braver. One little four-point light on a long empty strip, and you know it\'s the same one all the way.',
        'Odile: Magenta. I\'ll have to mix it. I don\'t own that colour. Nobody does.',
      ] },
    ] },
    'Odile: It\'ll hang with the porches. It\'s a kind of porch, isn\'t it. Something you come home to.',
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],

  'th-twelve-lights-4': [
    '* Odile\'s porch is lit. Her grandmother\'s easel stands on the step, leaning left. Odile sits beside it, not painting.',
    'Odile: You came. ~ Sit. Here, on the step. I want to see what it looks like with someone on it.',
    '* You sit. She walks out onto the green with a small board and paints fast, looking up every few seconds. Then she comes back and sits beside you.',
    'Odile: Eleven. That\'s all of them I can see. ~ All but the tall one.',
    'Odile: I tried again tonight. You can\'t paint a light that isn\'t there. Gran tried for years. I\'ve tried for thirty.',
    'Odile: I\'m going to stop. I\'ll keep the twelfth canvas blank and hang the rest. Barnaby says the Archive will take them.',
    { op: 'choice', options: [
      { text: 'It\'ll be lit. Keep the canvas.', then: [
        ...mem('steps', 'promise'),
        'Odile: ...You\'re paying for it, aren\'t you. Notch by notch. ~ All right. Blank, then. Blank is honest. Blank is just early.',
      ] },
      { text: 'Paint it dark, then.', then: [
        ...mem('steps', 'dark'),
        'Odile: Gran wrote that, in her letter. Paint the dark honestly, then wait. ~ I did. It\'s under this one. I think I\'ll keep waiting.',
      ] },
    ] },
    '* The two of you sit on her lit step for a long time. Neither of you says anything. It is nice.',
    { op: 'beat', thread: T, to: 4 },
    { op: 'end' },
  ],

  'th-twelve-lights-5': [
    '* Morning. Odile is at the foot of the lighthouse stair with the twelfth canvas, the one she kept blank, painting very fast.',
    'Odile: Don\'t talk. ~ It\'s still sweeping. I have to get it while I still believe it.',
    '* The beam goes round. She paints it once, wide and warm, crossing every roof in the harbor and touching every porch she has already painted.',
    'Odile: There. Twelve. ~ Gran never got this one. Gran never had you.',
    { op: 'if', cond: { flag: `th.${T}.steps`, is: 'promise' },
      then: ['Odile: You said it would be lit. I wrote that on the back of the canvas, in case you were wrong. You weren\'t.'],
      else: ['Odile: I painted it dark first, under the eleventh. Now this one goes on top. That\'s the right order.'] },
    { op: 'choice', options: [
      { text: 'Hang it in the Archive with the others.', then: [
        ...mem('twelfth', 'archive'),
        'Odile: In the middle. Barnaby will cry. Barnaby cries at labels.',
      ] },
      { text: 'Hang it where you can see it from your step.', then: [
        ...mem('twelfth', 'step'),
        'Odile: From my step. ~ Then I\'d see the real one and the painted one at once. That\'s greedy. I\'ll do it.',
      ] },
    ] },
    'Odile: I\'m telling Wren you\'re owed a notch. Don\'t argue. It\'s in the paint now.',
    { op: 'beat', thread: T, to: 5 },
    { op: 'end' },
  ],
};

export default {
  id: T, npcId: 'odile', title: 'Twelve Lights', kind: 'lead',
  summary: 'Odile paints every lit porch she can see from her step, and your starter\'s Shiftlog between them. The twelfth subject is the dark lighthouse.',
  beats: [
    { id: 1, cond: { hour: [15, 19] }, script: 'th-twelve-lights-1', where: { mapId: 'pellwick', x: 26, y: 20 },
      when: 'Golden hour, 15:00-19:00, at her easel.', topic: 'Stand very still.',
      choices: [{ key: `th.${T}.first`, options: ['twelfth', 'own'] }] },
    { id: 2, cond: { all: [{ loan: { tier: 2 } }, { hour: [6, 19] }] }, script: 'th-twelve-lights-2', advance: { days: 1 },
      when: 'The day after your porch lights (loan 1 paid).', topic: 'Your porch, in paint.',
      choices: [{ key: `th.${T}.cottage`, options: ['warm', 'dark'] }] },
    { id: 3, cond: { all: [{ flag: 'sp.first-forecast' }, { hour: [14, 19] }] }, script: 'th-twelve-lights-3', advance: { days: 1 },
      when: 'An afternoon after your first Forecast.', topic: 'A Shiftlog canvas.',
      choices: [{ key: `th.${T}.shiftlog`, options: ['forms', 'mark'] }] },
    { id: 4, cond: { all: [{ flag: 'sys.porch.porch-odile' }, { hour: [19, 1] }] }, script: 'th-twelve-lights-4', porch: true, advance: { days: 1 },
      when: 'Porch talk once her porch is lit (F9 brings the easel home).', topic: 'Sit on her step.',
      choices: [{ key: `th.${T}.steps`, options: ['promise', 'dark'] }] },
    { id: 5, cond: { flag: 'sp.relighting' }, script: 'th-twelve-lights-5', where: { mapId: 'pellwick', x: 5, y: 21 },
      when: 'The morning after the Relighting, at the foot of the lighthouse.', topic: 'The twelfth canvas.',
      choices: [{ key: `th.${T}.twelfth`, options: ['archive', 'step'] }],
      reward: { share: true, gallery: 'twelve-lights' } },
  ],
};
