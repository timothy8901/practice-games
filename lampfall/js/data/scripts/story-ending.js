/** Relighting, the protected Reading, Summit and the continuing harbor. */
import { warpTo, tp, flag, porch, deliver, sfx, music, toast, call, label, go, END } from './_stage.js';

/** Posted two-turn phases passed directly to the Reading battle (no data import cycle). */
export const READING_PHASES = Object.freeze([
  { id: 'shore', name: 'The Shore', types: ['Brine'], next: 'Moss', turns: 2 },
  { id: 'root', name: 'The Root', types: ['Moss'], next: 'Kiln', turns: 2 },
  { id: 'ember', name: 'The Ember', types: ['Kiln'], next: 'Bolt', turns: 2 },
  { id: 'storm', name: 'The Storm', types: ['Bolt', 'Gust'], next: 'Hollow', turns: 2 },
  { id: 'hollow', name: 'The Empty Room', types: ['Hollow'], next: 'Glass', turns: 2 },
  { id: 'mirror', name: 'The Mirror', types: ['Glass', 'Rime'], next: 'Star', turns: 2 },
  { id: 'heart', name: 'The Heart', types: ['Star'], next: 'Your choice', turns: 2 },
].map(Object.freeze));
const readingBattle = (turns = 14) => ({ op: 'startBattle', source: 'reading', holdOut: turns,
  wild: { speciesId: 'vagary', level: 50, readingPhases: turns === 14 ? READING_PHASES : [READING_PHASES[6]] } });

export default {
  'the-relighting': [
    { op: 'if', cond: { flag: 'sp.relighting' }, then: [go('out')] },
    { op: 'if', cond: { not: { loan: { tier: { gte: 7 }, paid: true } } }, then: [
      'Wren: The lens is ready. The last balance is still in the book. Pay it when you can. ~ It will wait.', go('out'),
    ] },
    warpTo('pellwick', 'porchlight-player', 'up'), tp('juniper', 'pellwick', 'relighting-juniper'),
    'Juniper: Last thing in the back room. She left it on the counter the night she went. I dusted round it for thirty years.',
    { op: 'give', item: 'isoldes-lantern' }, deliver('lantern'),
    'Juniper: You have carried a lantern everywhere. ~ Do not drop this one.',
    { op: 'letter', n: 57 },
    '* You light Isolde\'s Lantern from your own porch lamp. One small flame. Wick takes the handle with both wings, his cap pushed back for once.',
    'Wick: Keeper. I have it.',
    warpTo('int-lighthouse', 'relight-player', 'up'), tp('wick', 'int-lighthouse', 'relight-wick'),
    'Ambrose: Wall.', '* He puts his paw flat on the curved stone, and leaves it there.',
    'Wren: Better than yours?', 'Ambrose: Better than mine.',
    '* The lens catches. The beam turns over the roofs, slow the first time, as if learning every one. Out beyond the Bar a horn answers with Your Signal.',
    flag('sp.relighting'), flag('lit.shiftTide'), flag('lit.steadied'), flag('lit.keepersAnchor'), flag('lit.fleetHome'), flag('lit.bar'),
    // Last flag starts the visual ending director when the cutscene returns to the field.
    flag('lit.calls'), { op: 'save', reason: 'relighting' }, label('out'), END,
  ],
  'the-crossing': [
    '* Beneath the beam the sea draws back from the Bar. The Lantern Stack is no longer a black tooth. Something is coming down to it.',
    { op: 'tide', set: 0 }, warpTo('the-bar', 'crossing-start', 'up'),
    tp('corin', 'the-bar', 'crossing-corin'), tp('wick', 'the-bar', 'crossing-wick'), tp('linnet', 'the-bar', 'crossing-linnet'),
    tp('merrow', 'the-bar', 'crossing-merrow'), tp('varga', 'the-bar', 'crossing-varga'),
    { op: 'if', cond: { flag: 'sp.idris-beaten' }, then: [tp('idris', 'the-bar', 'crossing-idris'), 'Idris: The ring is off. I would like to see what I missed.'] },
    'Merrow: No Engine.', 'Varga: No charges.', 'Linnet: Good. You can both carry a lamp.',
    'Corin: I cannot read one that size. ~ You can.',
    warpTo('lantern-stack', 'reading-player', 'up'), END,
  ],
  'the-reading': [
    '* The Passenger unfolds over the Lantern Stack. One body, larger than the tower window; a mark bright enough to read the whole coast by.',
    'Corin: Seven phases. Two turns each. The next shape is posted before it comes. Neither side can fall tonight. This is a reading, Keeper. Take your time.',
    'Merrow: You may anchor it.', 'Varga: You may redraw it.', 'Linnet: You may let it answer.',
    readingBattle(), label('choose'),
    '* The seventh Forecast turns toward you. Not the Glass. You. The Heartshard waits without moving.',
    { op: 'choice', defaultIndex: 0, options: [
      { text: 'Accept. Let it become.', then: [
        flag('sp.reading-done'), '* The Heartshard steadies. The hum settles into a tide. Along the shore, every creature\'s mark glows once and goes quiet.',
        'Corin: Light calls the change. ~ Light lets you read it.', go('done'),
      ] },
      { text: 'Anchor — hold this night a little longer. Free.', then: [
        flag('np.keeper.reading-choice', 'anchor'), 'Merrow: A hand. One choice. You read it first.', readingBattle(2), go('choose'),
      ] },
      { text: 'Reroll — ask for another shape. Free.', then: [
        flag('np.keeper.reading-choice', 'reroll'), 'Varga: Another reading. No promise. ~ You know.', readingBattle(2), go('choose'),
      ] },
    ] }, label('done'), toast('The Reading'), { op: 'save', reason: 'reading' }, END,
  ],
  'credits-dawn': [
    '* Dawn comes from behind the houses. The lamp keeps turning, pale now against a pale sky.',
    'Wick: It will be there tonight too?', 'Corin: If somebody keeps it.',
    'Wick: We will.', warpTo('int-cottage', 'coda-morning', 'down'), END,
  ],
  'coda-morning': [
    { op: 'if', cond: { flag: 'sp.coda-morning' }, then: [go('done')] },
    warpTo('pellwick', 'mailbox-front', 'down'),
    'Hesper: Morning. ~ One for you. This one is not late. I checked the stamp three times and then I asked Juniper to check it.',
    deliver('saw-the-light'), { op: 'letter', n: 58 },
    'Hesper: Last week. From the Outer Isles. ~ She saw it.',
    '* The north creek has a wheel to turn. Tamsin has a boat to float. Seven dark houses have doors facing the road. There is another Keeper letter in the old sack.',
    'Dimity: Tomorrow: whatever you leave open. There is room.', flag('sp.coda-morning'), { op: 'save', reason: 'coda' }, label('done'), END,
  ],
  'ansel-confession': [
    'Ansel: You have been reading her letters. Did she write about the wheel?',
    '* He strikes at the empty creek. Misses. Folds his wing.',
    'Ansel: My grandfather held the river back. Year after year, the bar rose to meet it. She worked that out with a tide log and a pencil. I worked it out twenty years late, from a drawer.',
    'Ansel: I named her. I would name her again with what I had. ~ I did not have the drawing.',
    { op: 'choice', options: [
      { text: 'Tell them what was missing.', then: ['Ansel: An addendum. ~ Yes. A report can have one of those.'] },
      { text: 'It was not you who built it.', then: ['Ansel: It was me who signed it. I can sign something else.'] },
      { text: '(Stand beside him.)', then: ['* The creek fills the silence.', 'Ansel: That is what she would have done.'] },
    ] },
    { op: 'if', cond: { flag: 'sp.relighting' }, then: ['Ansel: Light is on. No excuse left, then.'], else: ['Ansel: I will go up to the wheel. Not in the dark. She had to do it in the dark.'] }, END,
  ],
  'ansel-weir-wheel': [
    '* Rust breaks with a long cry. Water finds the open sluice, then the old channel, then the north creek.', sfx('wave'),
    'Ansel: The bar will take seasons. The fish will come first. A few a week. ~ I will count them.', END,
  ],
  'bell-dig': [
    '* The Old Quay gives up the bell in a nest of rope and pale shells. Barnaby puts a claw on the lip. For once he has no card ready.',
    'Barnaby: Gannet. Brown Bess. The Grace. ~ It called all of them home.', sfx('bell'),
    '* Its first note in thirty years rolls across mud instead of water. Every porch door opens.',
    'Barnaby: Exhibit 1. My old house. ~ I will need a bigger card.', END,
  ],
  'tamsin-sails': [
    '* Tidy Sum lifts off the mud without a sound. Tamsin stands at the tiller while Kettle holds the nameboard straight.',
    'Tamsin: The first boat back. I said I would.',
    '* She sails the north creek on water the weir gave back. She waves only when she is sure nobody needs the rope.', END,
  ],
  'summit-gate': [
    'Hollis: Six badges. Six questions read properly. The Keepers are through that door.',
    'Hollis: The lamp may be dark or lit. Your balance may be large or small. None of that belongs on this gate.',
    flag('sp.summit-open'), END,
  ],
  'linnet-gate-before': [
    'Linnet: Before you go up. One more. Six each, everyone takes a turn. ~ I have been wanting to say that properly.',
    { op: 'choice', defaultIndex: 1, options: [
      { text: 'One more.', then: [{ op: 'startBattle', trainer: 'linnet-gate', source: 'rival' }] },
      { text: 'After I prepare.', then: ['Linnet: Sensible. Annoying, but sensible.'] },
    ] }, END,
  ],
  'linnet-gate-after': [
    'Linnet: Gnash. Cinder learned it when being small was the only thing it was good at. Turns out small can be very good at something.',
    { op: 'if', cond: { not: { hasItem: 'disc-gnash' } }, then: [{ op: 'give', item: 'disc-gnash' }] },
    flag('sp.linnet-gate'), 'Linnet: Win, lose. Neighbor. Same word.', END,
  ],
  'wick-long-road-before': [
    'Wick: Keeper! Halfway. Hollis said I could wait here if I had the pack strapped properly.',
    'Wick: Gillwick is ready. I am ready. ~ Do you want to see?',
    { op: 'choice', defaultIndex: 1, options: [
      { text: 'Show me.', then: [{ op: 'startBattle', trainer: 'wick-long-road', source: 'story' }] },
      { text: 'I will come back.', then: ['Wick: I will keep your place. Dimity taught me.'] },
    ] }, END,
  ],
  'idris-anchor-release': [
    '* Idris takes the granite ring in both wings. There is a white line where it has pressed the same feathers for thirty years.',
    'Idris: I know every move it knows. Every way it can stand. ~ I have called that knowing it.',
    '* The ring cracks. Vesperay\'s mark lights where it has always been. A Forecast opens.',
    { op: 'choice', options: [
      { text: 'Read it with him.', then: ['* You read the three cards aloud. Idris listens to every number.'] },
      { text: '(Let him read.)', then: ['* He reads slowly. He has never had to read this one before.'] },
    ] },
    'Idris: Whatever wakes. I will learn it.', flag('sp.idris-beaten'), toast('Ring Off'), END,
  ],
  'summit-bell': [
    sfx('bell'), 'Hollis: The bell keeps your place. Rest, change the team, return to the Keeper who held you. Nobody asks you to climb the same stair twice.', END,
  ],
  'late-delivery-party': [
    '* Augusta pins the last notice: LATE DELIVERY. TONIGHT. GUEST OF HONOUR: HESPER COIL. Somebody has underlined ON TIME.',
    'Hesper: I only brought the letters.', 'Juniper: All of them.', 'Barnaby: In order.',
    '* On the green the old post sack hangs empty. Hesper puts a feeler inside once more, just to be certain, and laughs.',
    flag('sp.late-delivery'), toast('Late Delivery'), END,
  ],
  'passenger-perch': [
    '* The Passenger folds itself above the Lantern Stack. The coast is in its eyes. The Glass shows a chance you can read, and no promise.',
    'Corin: It has stayed. Now you ask. That is what the Lantern is for.',
    { op: 'choice', defaultIndex: 0, options: [
      { text: 'Leave it on its perch.', then: ['* It watches the next sweep of the beam.'] },
      { text: 'Raise the Lantern and ask.', then: [{ op: 'startBattle', wild: { speciesId: 'vagary', level: 50 }, source: 'route' }] },
    ] }, END,
  ],
  'dark-house-reopens': [
    '* At dusk a traveler steps off the causeway. They stop to look at the beam, then at a key on a string. A porch that was dark yesterday is warm tonight.',
    'Wren: Nobody walks. ~ I may have to stop saying that.', END,
  ],
  'ninth-spire-ask': [
    'Wick: Keeper. We counted eight. The six, the Summit, the Reading. What comes next?',
    'Corin: A question you make yourself. Nine is a very good number for beginning again.',
    'Wick: The training green, then? One challenge from your seed each day. I will write the roster. You read it.',
    flag('sp.ninth-spire'), END,
  ],
};
