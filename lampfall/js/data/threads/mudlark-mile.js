/**
 * Tully, *The Mudlark Mile* (lead thread, 5 beats). [DATA-THREADS] GDD-08 §7.1; GDD-00 §11.
 *
 * Tully times laps at dawn and swears he was never the slowest kid. He asks for a grey mullet for
 * luck, loses a practice race to Tamsin, admits on his porch that he was, and runs the Mile at a
 * spring low (every Saturday is a spring-tide day: GDD weekday 5) with your fastest creature pacing
 * his Scrapling. Win or lose he gives you his sweatband; finishing pays the resident share.
 * Every choice is remembered twice: a `th.mudlark-mile.*` flag (later beats branch on it) and an
 * npc memory key. Pure data.
 * @module data/threads/mudlark-mile
 */

const T = 'mudlark-mile';
/** A remembered choice: the thread flag plus the npc's memory. */
const mem = (key, value, npc = 'tully') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

/** Beat scripts (merged into DATA.scripts by the orchestrator). */
export const scripts = {
  'th-mudlark-mile-1': [
    '* Tully is doing knee-lifts by the Commons board in the grey before sunrise. His sweatband is already damp.',
    'Tully: {npcNick}! Perfect. You\'ve got a face for a stopwatch.',
    '* He presses a brass pocket watch into your paw. The glass is cracked straight across.',
    'Tully: Once round the green, past the pump, back to the board. Call my time out loud. LOUD loud. Go when I sneeze.',
    '* He sneezes. He goes. ~ He is not fast. He is extremely committed.',
    'Tully: TIME!',
    { op: 'choice', prompt: 'The watch says two minutes and nine seconds.', options: [
      { text: 'Two minutes nine. Exactly.', then: [
        ...mem('timer', 'honest'),
        'Tully: Two-oh-nine. ~ Right. Right! That\'s a number. You can\'t argue with a number. I tried, once.',
      ] },
      { text: 'Call it an even two.', then: [
        ...mem('timer', 'kind'),
        'Tully: An even two! ~ The watch has a crack in it, you know. Could\'ve gone either way. You\'re a good timer.',
      ] },
    ] },
    'Tully: Same time soon? Not tomorrow. Legs need a day to be proud of themselves.',
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-mudlark-mile-2': [
    '* There is a new slip on the Commons board, in very large capitals: WANTED. ONE GREY MULLET. FOR LUCK. NOT FOR EATING. — T.',
    'Tully: You saw it. Don\'t laugh. Mullet\'s lucky. My dad swore by them. Grey ones, river mouth, they jump when they\'re happy.',
    'Tully: I don\'t want to eat it. I want to LOOK at it the morning of a race. Then you sell it. Ludo gives a good price for a mullet at night.',
    { op: 'choice', options: [
      { text: 'I\'ll fish one for luck.', then: [
        ...mem('mullet', 'yes'),
        'Tully: YES. Locked in. Rising tide, by the piling. Ansel says that\'s where they hang about.',
      ] },
      { text: 'Luck isn\'t a diet, Tully.', then: [
        ...mem('mullet', 'no'),
        'Tully: Everything\'s a diet if you believe hard enough. ~ Fine. I\'ll ask Ansel. He won\'t laugh. He doesn\'t laugh.',
      ] },
    ] },
    { op: 'if', cond: { flag: 'sp.tamsin-arrived' },
      then: ['Tully: And I\'m racing the badger in the dark house. Practice race. She digs like a ferry engine. How hard can running be?'],
      else: ['Tully: I need someone to race. A practice race. Somebody fast. Somebody who isn\'t me.'] },
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-mudlark-mile-3': [
    '* Low water on the point flats. Tully and Tamsin crouch at a line scratched in the mud with a stick.',
    'Tamsin: First to the marker post and back. Loser carries the winner\'s bucket up the hill.',
    'Tully: Deal. {player}, you say go.',
    '* You say go. ~ Tamsin goes through the mud like it owes her money. Tully goes through it like it\'s a conversation.',
    '* Tamsin touches the post, turns, and is sitting on her bucket by the time Tully arrives, breathing like a kettle.',
    'Tamsin: Good race. ~ Honestly. You never stopped. Bucket\'s that one.',
    { op: 'choice', options: [
      { text: 'She cut the corner at the post.', then: [
        ...mem('race', 'loyal'),
        'Tully: ...She didn\'t. ~ But thanks. That\'s a friend thing to say.',
      ] },
      { text: 'She was just faster today.', then: [
        ...mem('race', 'honest'),
        'Tully: Yeah. ~ Yeah, she was.',
      ] },
    ] },
    'Tully: I\'m going to sulk now. For exactly one day. Don\'t come round.',
    '* He carries her bucket up the hill. He carries it very well.',
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],

  'th-mudlark-mile-4': [
    '* Tully\'s porch, late. He is sitting on the top step with the cracked stopwatch, not timing anything.',
    'Tully: Sulk\'s over. Twenty-four hours on the dot. I\'m very disciplined about sulking.',
    'Tully: ...Can I tell you something? I was the slowest kid on this coast. Not slow. SLOWEST. There used to be a race every spring at the big low, the Mudlark Mile. I came last every year and told everybody I\'d won.',
    'Tully: Nobody\'s run it since the harbor went dark. So I\'m running it. On my own if I have to. Next spring low.',
    { op: 'if', cond: { flag: `th.${T}.timer`, is: 'honest' },
      then: ['Tully: You called my real time, that first morning. Nobody\'s ever done that. I didn\'t like it. ~ I think I needed it.'],
      else: ['Tully: You rounded my time down, that first morning. I saw. ~ It was nice. I\'m going to need the real one now, though.'] },
    { op: 'if', cond: { letter: { read: 27 } },
      then: ['Tully: Hesper brought me a letter from my dad. Thirty years late. He said keep never stopping. ~ So.'] },
    { op: 'choice', options: [
      { text: 'I\'ll pace you.', then: [
        ...mem('pace', 'promised'),
        'Tully: You will? With a creature? Your fastest one, out in front, so I\'ve got something to chase? ~ Oh, that\'s good. Locked in.',
      ] },
      { text: 'Slowest is a fine thing to have been.', then: [
        ...mem('pace', 'reassured'),
        'Tully: ...Yeah? ~ Yeah. You know what, I think it is. Come anyway. Bring your fastest creature. I need something to chase.',
      ] },
    ] },
    'Tully: Spring low. Saturday. Wear boots you don\'t love.',
    { op: 'beat', thread: T, to: 4 },
    { op: 'end' },
  ],

  'th-mudlark-mile-5': [
    '* The spring low has bared the far flats all the way to the Old Quay. Someone has scratched a finish line and propped the cracked stopwatch on a crate.',
    'Tully: Biggest low of the month. You brought your fastest? Out in front, where I can see it.',
    '* Your lead trots out ahead and looks back. Tully\'s Scrapling sets off beside it, very seriously.',
    { op: 'if', cond: { flag: `th.${T}.mullet`, is: 'yes' },
      then: ['Tully: I looked at a mullet this morning. Ludo\'s got it now. Doesn\'t matter. I LOOKED at it.'] },
    '* You say go. ~ For the first half mile he is slow. For the second half mile he is still slow. He does not stop once.',
    { op: 'if', cond: { thread: { id: 'the-fence', done: true } },
      then: ['* At the finish, Bryony is standing on an upturned bucket, whistling like a kettle. She has brought beans.'],
      else: ['* Across the flats, Bryony\'s porch light is on. Pointedly.'] },
    { op: 'choice', prompt: 'He crosses the line.', options: [
      { text: 'Call his real time.', then: [
        ...mem('finish', 'timed'),
        'Tully: Fourteen minutes and something. ~ That\'s the worst time ever run on this mile. And it\'s MINE.',
      ] },
      { text: 'Forget the watch. He finished.', then: [
        ...mem('finish', 'finished'),
        'Tully: Forget the watch. ~ Yeah. I finished. Thirty years and I finished.',
      ] },
    ] },
    '* He pulls the orange sweatband off his head and presses it, damp, into your paw.',
    'Tully: Win or lose, I said. I\'m not sure which this was. Keep it anyway. I\'m telling Wren you\'re owed a notch.',
    { op: 'give', item: 'tully-sweatband', n: 1 },
    { op: 'beat', thread: T, to: 5 },
    { op: 'end' },
  ],
};

/** @type {import('../index.js').ThreadDef & Record<string, any>} */
export default {
  id: T, npcId: 'tully', title: 'The Mudlark Mile', kind: 'lead',
  summary: 'Tully swears he was never the slowest kid. He was. He runs the old Mudlark Mile anyway, at a spring low, with your fastest creature pacing his Scrapling.',
  beats: [
    { id: 1, cond: { hour: [6, 10] }, script: 'th-mudlark-mile-1', where: { mapId: 'pellwick', x: 32, y: 22 },
      when: 'Dawn laps, 06:00-10:00, on the green.', topic: 'Time my laps?',
      choices: [{ key: `th.${T}.timer`, options: ['honest', 'kind'] }] },
    { id: 2, cond: { hour: [6, 12] }, script: 'th-mudlark-mile-2', advance: { days: 2 }, where: { mapId: 'pellwick', x: 32, y: 22 },
      when: 'A morning after beat 1, by the Commons board.', topic: 'Grey mullet, for luck.',
      choices: [{ key: `th.${T}.mullet`, options: ['yes', 'no'] }] },
    { id: 3, cond: { all: [{ flag: 'sp.tamsin-arrived' }, { lowTide: true }] }, script: 'th-mudlark-mile-3', advance: { days: 1 },
      where: { mapId: 'pellwick', x: 8, y: 34 },
      when: 'Any low tide once Tamsin lives in dark house 1, on the point flats.', topic: 'Practice race.',
      choices: [{ key: `th.${T}.race`, options: ['loyal', 'honest'] }] },
    { id: 4, cond: { hour: [19, 1] }, script: 'th-mudlark-mile-4', porch: true, advance: { days: 1 },
      when: 'Porch talk, 19:00-01:00, the day after the sulk.', topic: 'On Tully\'s step.',
      choices: [{ key: `th.${T}.pace`, options: ['promised', 'reassured'] }] },
    { id: 5, cond: { lowTide: true }, script: 'th-mudlark-mile-5', advance: { dayOfWeek: [5] }, where: { mapId: 'pellwick', x: 10, y: 40 },
      when: 'The next spring low (Saturday), on the far flats.', topic: 'The Mudlark Mile.',
      choices: [{ key: `th.${T}.finish`, options: ['timed', 'finished'] }],
      reward: { share: true, keepsake: 'tully-sweatband' } },
  ],
};
