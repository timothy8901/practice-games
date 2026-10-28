/**
 * Tamsin, *The Oyster Boat* (lead thread, 5 beats). [DATA-THREADS] GDD-08 §7.3; GDD-00 §11.
 *
 * Tamsin arrives in dark house 1 and races you to sparkles. Her family's oyster boat, the Tidy Sum,
 * lies in the dry north creek where the surge left it, missing its nameboard. On Drownwood you Read
 * her Creelwight "Kettle" (the Bracks' old creel creature, F4) and the board glints inside it.
 * Wendel's rollers bring the boat down to the quay mud; once the harbor can float it (the fleet
 * comes home at the Relighting, or the weir turns) she sails first, in the coda. Beat 5 calls the
 * story script `tamsin-sails` (GDD-07) for the set-piece and pays the resident share. Pure data.
 * @module data/threads/oyster-boat
 */

const T = 'oyster-boat';
const mem = (key, value, npc = 'tamsin') => [
  { op: 'setFlag', id: `th.${T}.${key}`, value },
  { op: 'remember', npc, key: `${T}.${key}`, value },
];

export const scripts = {
  'th-oyster-boat-1': [
    '* Low tide. Tamsin is already on the point flats with a shovel over her shoulder, watching the sparkles come up out of the wet sand.',
    'Tamsin: You\'re the walker. Wren said. ~ I\'m the digger. There are three sparkles out there and I can see all three.',
    'Tamsin: Race you. Fair start. I\'ll even count.',
    { op: 'choice', options: [
      { text: 'Race her.', then: [
        ...mem('sparkles', 'raced'),
        '* She counts to three and is gone on two. She reaches two sparkles before you reach one, and holds up a cockle and a razor shell like trophies.',
        'Tamsin: Twice your speed. I\'m not being unkind. I\'m being accurate.',
      ] },
      { text: 'Let her have them.', then: [
        ...mem('sparkles', 'gave'),
        'Tamsin: ...You\'re letting me? ~ Nobody lets me anything. Suspicious. ~ Thank you.',
        '* She digs all three in the time it takes you to think about it.',
      ] },
    ] },
    'Tamsin: Brack. Tamsin Brack. My family used to be somebody on this quay. We had a boat. ~ Never mind. Same time next low.',
    { op: 'beat', thread: T, to: 1 },
    { op: 'end' },
  ],

  'th-oyster-boat-2': [
    '* Tamsin is standing in the dry bed of the north creek, beside a boat.',
    '* It is an oyster boat, lying on its side in the pebbles where the water left it, grey as driftwood. There is a clean pale square on the bow where a nameboard used to be.',
    'Tamsin: The surge carried her up here the night of the bar. Thirty years. My gran used to walk up and sit in her.',
    'Tamsin: Hull\'s sound, mostly. Wendel on Drownwood says he could roll her down to the quay, if I had a reason. ~ A boat without its name is just a shape. I\'m not sailing a shape.',
    { op: 'choice', options: [
      { text: 'Then let\'s find the name.', then: [
        ...mem('search', 'help'),
        'Tamsin: You\'d help? ~ It\'s been gone thirty years. It\'s in the bar, or a dealer\'s window, or a gull\'s nest. ~ All right. Keep your eyes open. You\'re the one who reads things.',
      ] },
      { text: 'Why does the name matter so much?', then: [
        ...mem('search', 'why'),
        'Tamsin: Because the name\'s the part that was ours. The wood\'s just wood.',
        'Tamsin: You\'ve got a creature with a mark on it. You\'d know it in any shape, wouldn\'t you? Same thing.',
      ] },
    ] },
    { op: 'beat', thread: T, to: 2 },
    { op: 'end' },
  ],

  'th-oyster-boat-3': [
    '* The drowning street at Mossgate. Tamsin crouches on a half-sunk doorstep beside a Creelwight, a hulking rusty basket of a creature that rattles when it breathes.',
    'Tamsin: This is Kettle. Found me here last spring and wouldn\'t leave. Rattles like a kettle, so.',
    { op: 'if', cond: { letter: { read: 24 } },
      then: [
        '* You remember a letter: the creel creature the children call Kettle, for the noise it makes.',
        'Tamsin: ...What? Why are you looking at him like that?',
      ] },
    'Tamsin: Corin says you see things. Read him? He\'s been off his food. Keeps rattling at the north.',
    '* You raise the Reading Glass. Kettle comes up in the lens, Hollow and Rust, old iron ribs and a slow heart... and wedged deep between two ribs, something flat and painted catches the light.',
    '* Letters. Faded green on white. TIDY SUM.',
    'Tamsin: That\'s. ~ That\'s our board. That\'s the Tidy Sum. He\'s had it. He\'s had it the whole time.',
    { op: 'choice', options: [
      { text: 'Read his lean, too.', then: [
        ...mem('kettle', 'read'),
        '* Kettle\'s lean comes up faint and steady: no window, no hurry. Just old, and pleased to be looked at.',
        'Tamsin: He kept it. Thirty years in a drowned street and he kept it.',
      ] },
      { text: 'Just the board. Let him be.', then: [
        ...mem('kettle', 'spared'),
        '* You lower the Glass. Kettle rattles gently, like a pot coming off the boil.',
        'Tamsin: Good. He doesn\'t like being stared at. Neither do I.',
      ] },
    ] },
    '* Kettle coughs, enormously, and the nameboard slides out into your paws, wet and whole.',
    'Tamsin: You carry it. My paws are shaking. ~ Don\'t drop it.',
    { op: 'give', item: 'oyster-boat-nameboard', n: 1 },
    { op: 'beat', thread: T, to: 3 },
    { op: 'end' },
  ],

  'th-oyster-boat-4': [
    '* The north creek bed is crowded. Wendel Teague has come over from Drownwood with a stack of greased rollers, and half the harbor has turned up to push.',
    'Wendel: Rollers under the keel. Everybody on the left side. Nobody lean on the rudder; it\'s older than me.',
    '* The oyster boat rolls. An inch, then another, then all at once: down the creek, over the stones by the bridge, onto the mud below the quay, where she settles with a sigh like someone who has been waiting to sit down.',
    'Tamsin: She can\'t float yet. Not with the bar the way it is and the creek dry. ~ But she\'s down here with us. That\'s something.',
    'Tamsin: The board. If you\'ve still got it.',
    { op: 'choice', options: [
      { text: 'Here. Nail it on yourself.', then: [
        ...mem('board', 'handed'),
        '* You hand it over. Tamsin holds it a moment, then sets it on the bow and taps the nails in with a pebble, one at a time.',
      ] },
      { text: 'Hold it in place while she nails it.', then: [
        ...mem('board', 'held'),
        '* You hold the board against the pale square on the bow. Tamsin taps the nails in with a pebble, one at a time, and doesn\'t look at you once, which is how you know.',
      ] },
    ] },
    { op: 'take', item: 'oyster-boat-nameboard', n: 1, ask: true },
    'Tamsin: Tidy Sum. ~ Gran said it was a stupid name for a boat that got sold to pay debts. She also said it was ours.',
    { op: 'beat', thread: T, to: 4 },
    { op: 'end' },
  ],

  'th-oyster-boat-5': [
    '* There is water under the Tidy Sum. Not much. Enough.',
    'Tamsin: Keeper. ~ Wick calls you that and it\'s catching. Look. She\'s floating.',
    { op: 'call', script: 'tamsin-sails' },
    'Tamsin: First boat in, first boat out. Thirty years late. Like the post.',
    { op: 'choice', options: [
      { text: 'Take me out with you sometime.', then: [
        ...mem('sail', 'crew'),
        'Tamsin: Tomorrow\'s low. Bring a bucket. You bail, I steer, we don\'t discuss it.',
      ] },
      { text: 'She\'s yours. Go.', then: [
        ...mem('sail', 'wave'),
        'Tamsin: She\'s ours. The Bracks\', I mean. And a bit yours; you carried the name. ~ Go on, wave like an idiot. Everyone else is.',
      ] },
    ] },
    { op: 'setFlag', id: 'sp.tamsin-sailed' },
    'Tamsin: I\'m telling Wren you\'re owed a notch. I\'d pay you myself, but I\'ve put everything into tar.',
    { op: 'beat', thread: T, to: 5 },
    { op: 'end' },
  ],
};

export default {
  id: T, npcId: 'tamsin', title: 'The Oyster Boat', kind: 'lead',
  summary: 'The Brack oyster boat lies in the dry north creek without its name. Her creature has been carrying it for thirty years.',
  involve: { flag: 'sp.tamsin-arrived' },
  beats: [
    { id: 1, cond: { all: [{ flag: 'sp.tamsin-arrived' }, { lowTide: true }] }, script: 'th-oyster-boat-1', where: { mapId: 'pellwick', x: 8, y: 34 },
      when: 'Any low tide once dark house 1 is open, on the point flats.', topic: 'Race you to the sparkles.',
      choices: [{ key: `th.${T}.sparkles`, options: ['raced', 'gave'] }] },
    { id: 2, cond: { hour: [8, 18] }, script: 'th-oyster-boat-2', advance: { days: 1 }, where: { mapId: 'pellwick', x: 30, y: 5 },
      when: 'A day after beat 1, 08:00-18:00, in the dry north creek.', topic: 'The boat in the creek.',
      choices: [{ key: `th.${T}.search`, options: ['help', 'why'] }] },
    { id: 3, cond: { map: 'drownwood' }, script: 'th-oyster-boat-3', advance: { days: 1 }, where: { mapId: 'drownwood', x: 24, y: 16 },
      when: 'On Drownwood, at the drowning street by Mossgate (Tamsin waits there with Kettle once beat 2 is done).', topic: 'Read Kettle.',
      choices: [{ key: `th.${T}.kettle`, options: ['read', 'spared'] }] },
    { id: 4, cond: { all: [{ hasItem: 'oyster-boat-nameboard' }, { hour: [8, 18] }] }, script: 'th-oyster-boat-4', advance: { days: 1 },
      where: { mapId: 'pellwick', x: 30, y: 5 },
      when: 'A day after the board is found, 08:00-18:00; Wendel brings his rollers.', topic: 'Rollers.',
      choices: [{ key: `th.${T}.board`, options: ['handed', 'held'] }] },
    { id: 5, cond: { any: [{ flag: 'lit.fleetHome' }, { flag: 'sp.weir-turned' }] }, script: 'th-oyster-boat-5', where: { mapId: 'pellwick', x: 48, y: 36 },
      when: 'The coda: once the harbor can float her (the Relighting brings the fleet home, or the weir turns).', topic: 'She floats.',
      choices: [{ key: `th.${T}.sail`, options: ['crew', 'wave'] }],
      reward: { share: true, story: 'tamsin-sails' } },
  ],
};
