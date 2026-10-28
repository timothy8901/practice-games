/**
 * Act IV, the ending, the coda and the post-game (GDD-00 §11 "The ending scene", "Coda and
 * post-game", §8 "The Summit"). [DATA-SCRIPTS] GDD-07 §7-§9.
 *
 * The Long Night is directed by scenes/ending.js: `the-relighting` (queued by `relighting:due`, also
 * reached through the legacy `relighting` alias in ./index.js) ends by setting `lit.calls`, which
 * starts the ending scene; it plays the lens and beam set-pieces and then pushes `the-crossing`,
 * `the-reading` and `credits-dawn` itself, and the credits queue `coda-morning`. So these scripts never
 * `call` one another. The Reading is one protected 14-turn hold-out over the seven posted
 * {@link READING_PHASES} (battleFlow `source: 'reading'`), then an offer only Accept ends.
 *
 * `ansel-confession`, `ansel-weir-wheel`, `bell-dig` and `tamsin-sails` are set-pieces their thread
 * beats `call`; they never set thread flags or advance beats. The Summit beats work before or after
 * the Relighting. Pure data.
 * @module data/scripts/story-ending
 */
import { warpTo, tp, cam, camHome, face, emote, flag, porch, deliver, sfx, music, toast, label, go, END, byDial } from './_stage.js';

const P = 'pellwick';
const LS = 'lantern-stack';
/** Linnet is about: she never fell, or she has come home. */
const LINNET_HOME = { any: [{ not: { flag: 'sp.linnet-fell' } }, { flag: 'sp.linnet-returned' }] };

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

/** The seven families who come home after the Relighting, one a night (dark houses 2-8). */
const HOMECOMINGS = [
  { porch: 'porch-dark-2', text: 'Dark house 2, by the Anchorage: Hal Gannet\'s granddaughter, off the Outer Isles ferry with a trunk and a Bilgebob, who says her gran always told her which house it was by the colour of the step.' },
  { porch: 'porch-dark-3', text: 'Dark house 3, below the green: the Penhallows of Cairnhold, a nephew of Osric\'s and his wife, come to mend nets because the bar is lit and there will be nets to mend.' },
  { porch: 'porch-dark-4', text: 'Dark house 4, past the post office: Old Fen\'s daughter, who left the winter of the Ebb as a girl and comes back with a girl of her own, and stands a long time in the doorway.' },
  { porch: 'porch-dark-5', text: 'Dark house 5, on the dark row: three cousins of the Thole\'s Luck crew, who argue about the stove all night. Barnaby says they are family and says it in brackets, proudly.' },
  { porch: 'porch-dark-6', text: 'Dark house 6: the youngest of the Three Sisters\' crew, very old now, who walks the quay end to end every evening counting bollards and finds them all present.' },
  { porch: 'porch-dark-7', text: 'Dark house 7, at the neck: Ned of the Emberstep ropewalk, who taught half the harbor to splice and has come to see if anyone remembers how. Pip does, badly.' },
  { porch: 'porch-dark-8', text: 'Dark house 8, by the north creek: the family who named a boat Good Morning and meant it, and say so to everyone they meet, every morning, until it catches.' },
];

export default {
  // ---------------------------------------------------------------------------------------------
  // the dusk after the zero balance: the Relighting (the lens and beam are the ending scene's)
  // ---------------------------------------------------------------------------------------------
  'the-relighting': [
    { op: 'if', cond: { flag: 'sp.relighting' }, then: [go('out')] },
    { op: 'if', cond: { not: { loan: { tier: { gte: 7 }, paid: true } } }, then: [
      'Wren: The lens is ready. The last balance is still in the book. Pay it when you can. ~ It will wait.', go('out'),
    ] },
    music('relighting', 1200),
    warpTo(P, 'porchlight-player', 'up'),
    tp('juniper', P, 'relighting-juniper'),
    tp('wick', P, 'wick-errands'), // (10,25): the cell beside the porch step is the mailbox
    tp('wren', P, 'relighting-crowd-1'),
    tp('ambrose', P, 'relighting-crowd-2'),
    '* Dusk on the point, and the whole town has come up it. They stand along the lighthouse path and the cottage fence in their good coats, not saying much, the way people stand on a quay waiting for a boat.',
    face('juniper', 'player'),
    '* Juniper comes up the path last, carrying something wrapped in blue cloth in both arms, and a letter in her beak, which she takes out to speak.',
    'Juniper: The last thing in my back room. ~ Gran kept it thirty years. I\'ve kept it since. It\'s been on my top shelf, at the front, since the night you walked in.',
    '* She unwraps it. An old keeper\'s lantern, brass gone brown, the glass clean. The handle is worn smooth in the shape of someone else\'s paw.',
    'Juniper: Isolde\'s. She left it on the counter the night she went. "For whoever comes." ~ You\'ve carried a lantern everywhere. Don\'t drop this one.',
    { op: 'give', item: 'isoldes-lantern' },
    deliver('lantern'),
    'Juniper: And this was posted to the shop, years ago, to be kept with it. To whoever lights it. ~ That\'s you, now. I\'ve not read it. I\'ve wanted to every day.',
    { op: 'letter', n: 57 },
    '* You hold Isolde\'s lantern up to your own porch lamp. Dimity moves her wings aside without being asked.',
    'Dimity: Mind the glass. ~ Go on. I\'ll write it down.',
    sfx('lantern'),
    '* The wick takes. A small flame, amber, steady, in a lantern that has not been lit in thirty years.',
    face('wick', 'player'),
    '* Wick is beside you. He has pushed his cap back off his face, for once, all the way.',
    'Wick: Keeper. ~ Can I carry it? Up the stair? I won\'t drop it. I\'ve been practising since I hatched.',
    { op: 'choice', options: [
      { text: 'Carry it.', then: ['* You hand him the lantern. He takes the handle in both wings, very straight, the way Juniper carried it up the hill.', 'Wick: Keeper. I have it.'] },
      { text: 'We\'ll carry it together.', then: ['* You keep one paw on the handle and he takes the other side, and you go up the path like that, slowly, the flame between you.'] },
    ] },
    warpTo('int-lighthouse', 'stair-foot', 'up'),
    '* The stair. Ninety-one steps, Ambrose said; he counted them every year by touch. Wick counts them out loud, under his breath, the whole way up.',
    warpTo('int-lighthouse', 'relight-player', 'up'),
    tp('wick', 'int-lighthouse', 'relight-wick'),
    '* The Lamp Room. Through the glass, the harbor is laid out below in the last of the light: the quay, the green, the dark row, the porches. Out in the lagoon, on the black stack at the end of the Bar, nothing yet.',
    'Wick: Here. ~ It\'s your lamp. You light it.',
    '* You open the lens door and put Isolde\'s flame to the wick of the great lamp.',
    flag('sp.relighting'), flag('lit.shiftTide'), flag('lit.steadied'), flag('lit.keepersAnchor'), flag('lit.fleetHome'), flag('lit.bar'),
    // Last flag starts the visual ending director when the cutscene returns to the field.
    flag('lit.calls'), { op: 'save', reason: 'relighting' }, label('out'), END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the sea draws back: the crossing to the Lantern Stack
  // ---------------------------------------------------------------------------------------------
  'the-crossing': [
    '* Beneath the beam the sea draws back. Not with the tide: all at once, in one long breath, off the Bar and the spur and the flats, as if the whole lagoon had stepped back to let somebody through. The Lantern Stack is no longer a black tooth. Something is coming down to it.',
    { op: 'tide', set: 0 }, sfx('wave'), warpTo('the-bar', 'crossing-start', 'up'),
    tp('corin', 'the-bar', 'crossing-corin'), tp('wick', 'the-bar', 'crossing-wick'),
    tp('merrow', 'the-bar', 'crossing-merrow'), tp('varga', 'the-bar', 'crossing-varga'),
    { op: 'if', cond: LINNET_HOME,
      then: [tp('linnet', 'the-bar', 'crossing-linnet')],
      else: ['* Out on the dark water beyond the Bar head, a punt lamp holds still. Maud\'s. Somebody small and white is standing in the bow, watching.'] },
    { op: 'if', cond: { flag: 'sp.idris-beaten' }, then: [tp('idris', 'the-bar', 'crossing-idris')] },
    '* On the Bar head the shore party is waiting. Nobody planned it. Everybody came.',
    face('corin', 'player'),
    'Corin: The wanderer, coming down to the light, exactly as she counted. ~ I have waited twenty-seven years to say that sentence and I find I have nothing to add to it.',
    'Merrow: No Engine.', 'Varga: No charges.',
    'Merrow: If it calls every mark on this coast at once, Keeper, there are not enough stones in Cairnhold.',
    'Varga: And if it calls every mark at once, there\'s nobody who\'ll need salt again. ~ Neither of us is going out there. Notice that.',
    { op: 'if', cond: LINNET_HOME, then: [
      'Linnet: Good. You can both carry a lamp.',
      { op: 'if', cond: { flag: 'sp.linnet-returned' }, then: ['Linnet: Read it. Like you read for me on my step. ~ All the cards. Out loud. I want to hear them from here.'] },
    ] },
    { op: 'if', cond: { flag: 'sp.idris-beaten' }, then: [
      '* Idris stands a little apart, his partner beside him with its tail bare. There is a pale band where the ring used to be.',
      'Idris: The ring is off. I would like to see what I missed. ~ Go on. Whatever it becomes, it will still be the thing that came.',
    ] },
    'Wick: I\'ll hold the flame. ~ I mean I\'ll stand here and think about it really hard. Go, Keeper.',
    { op: 'choice', options: [
      { text: 'Walk out to the Stack.' },
      { text: '(Look back at the beam first.)', then: ['* You look back. The beam goes round over Pellwick: the yard, the green, your porch with a moth in the lamp. Every eight seconds it comes round to you as well.'] },
    ] },
    warpTo('the-bar', 'crossing-stack-foot', 'up'),
    '* The spur is dry for the first time in thirty years at this hour. Your footprints are the only ones on it. The Stack rises ahead, lit amber on every pass of the beam.',
    warpTo(LS, 'reading-player', 'up'), END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the Reading: seven posted phases; cannot be lost; ends only on Accept
  // ---------------------------------------------------------------------------------------------
  'the-reading': [
    '* It lands on the Stack as softly as a moth on a lamp. It is enormous: the size of a boat, the size of a house, a different shape at every pass of the beam, and on its brow, the size of your whole paw, a four-point mark the colour of nothing you own.',
    '* The Vagary. The Passenger. The thing the comet carries every thirty years. Its mark is already glowing.',
    'Corin: Seven phases. Two turns each. The next shape is posted before it comes. Neither side can fall tonight. This is a reading, Keeper. Take your time.',
    'Merrow: You may anchor it.', 'Varga: You may redraw it.',
    { op: 'if', cond: LINNET_HOME, then: ['Linnet: You may let it answer.'] },
    readingBattle(), label('choose'),
    '* The seventh window opens. The Passenger turns its great mark toward the lamp, and then toward you, and the Glass in your paw goes warm.',
    '* Three cards hang in the air between you: the Ring of the Light, the Ring of the Tide, the Ring of the Dark Water. Odds on every one. The Heartshard waits without moving. For the first time, the choice is not its. It is yours.',
    { op: 'choice', defaultIndex: 0, options: [
      { text: 'Accept. Let it become.', then: [
        flag('sp.reading-done'), sfx('shiftReveal'),
        '* The cards turn. One lands. The Passenger settles into it like a ship into a berth, and the hum that has been in the sea for thirty years goes quiet, and then comes back slower, steadier, like a tide.',
        '* The Heartshard is steady. Along the shore, every creature\'s mark, wild and bonded, glows once and settles to a soft even light.',
        'Corin: I can\'t read one that size. ~ You can.',
        'Merrow: It held. ~ Not because anybody held it. Because somebody read it, and let it.',
        'Varga: It changed, and it\'s still here. ~ Agathe, that\'s both of us right. I don\'t know how I feel about it.',
        'Merrow: Badly, Teo. You feel badly about it. So do I. We will feel badly about it together at the clinic, where the Shift Tide line is going on the wall.',
        { op: 'if', cond: { flag: 'sp.idris-beaten' }, then: ['Idris: Silence is an answer. ~ So, it turns out, is yes.'] },
        'Corin: Light calls the change. ~ Light lets you read it.', go('done'),
      ] },
      { text: 'Anchor — hold this night a little longer. Free.', then: [
        flag('np.keeper.reading-choice', 'anchor'),
        'Merrow: Hold it. Hold it still. ~ …It is still. Is that what I wanted? A hand. One choice. You read it first.',
        readingBattle(2),
        '* The window opens again. The cards are the same three, and so are the odds. The choice is still yours.',
        go('choose'),
      ] },
      { text: 'Reroll — ask for another shape. Free.', then: [
        flag('np.keeper.reading-choice', 'reroll'),
        'Varga: Again! Again. ~ …Every one of them is beautiful. That is the trouble. Another reading. No promise. You know.',
        sfx('shiftFlip'), readingBattle(2),
        '* The cards come round again, new faces, the same odds. The choice is still yours.',
        go('choose'),
      ] },
    ] }, label('done'), toast('The Reading'), { op: 'save', reason: 'reading' }, END,
  ],

  // ---------------------------------------------------------------------------------------------
  // dawn: the beam fading into morning (the credits scene follows)
  // ---------------------------------------------------------------------------------------------
  'credits-dawn': [
    '* Dawn comes up over the Brindle Isles from behind the houses. The beam goes on turning in the grey, fainter as the sky fills, but turning.',
    '* Across the harbor, porch after porch, lamps going pale in the morning: every one you lit, and every one somebody lit because you did.',
    'Wick: It will be there tonight too?', 'Corin: If somebody keeps it.',
    'Wick: We will.', warpTo('int-cottage', 'coda-morning', 'down'), END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the morning after: Hesper's flustered note; "I saw the light." (post-credits)
  // ---------------------------------------------------------------------------------------------
  'coda-morning': [
    { op: 'if', cond: { flag: 'sp.coda-morning' }, then: [go('done')] },
    '* You wake late, in your own bed, with the sun in your face through a window that has a plant on its sill.',
    '* There is a note pushed under the door. The handwriting runs downhill at speed: "Keeper — the sack is NOT empty — there is one in it that was NOT in it — postmarked LAST WEEK — I am at your gate — I have been at your gate since five — H. Coil (Miss)"',
    warpTo(P, 'mailbox-front', 'down'),
    tp('hesper', P, 'hesper-cottage-gate'),
    face('hesper', 'player'),
    'Hesper: Morning. ~ One for you. This one is not late. I checked the stamp three times and then I asked Juniper to check it.',
    'Hesper: It came in the sack. It wasn\'t in the sack yesterday. I count the sack. ~ I count it twice.',
    deliver('saw-the-light'),
    '* A postcard: a black rock in a grey sea, one small white tower on it. The stamp is new. The handwriting is the same as every letter you have read at six in the morning, only a little shakier.',
    { op: 'letter', n: 58 },
    { op: 'choice', options: [
      { text: 'She saw it.', then: ['Hesper: Last week. From the Outer Isles. ~ Forty miles. She saw it from forty miles.', '* Hesper sits down on your step quite suddenly and doesn\'t say anything at all for a while, which nobody in Pellwick has ever seen.'] },
      { text: '(Hand Hesper the card.)', then: ['* Hesper reads it. It takes her a long time; she reads slowly. She reads it again.', 'Hesper: Four words. ~ Thirty years of letters and she sends four words. ~ They\'re the best four.'] },
    ] },
    { op: 'if', cond: { flag: 'sp.linnet-returned' }, then: [
      cam(P, 'maud-berth', 1000),
      '* Down at the quay, Maud\'s punt goes out on the morning tide with a white stoat at the pole and a goose beside her saying "Confirm?" every ten yards.',
      camHome(700),
    ] },
    sfx('wave'),
    '* Far out beyond the Bar, the horn sounds again. Six notes. Your Signal.',
    '* The north creek has a wheel to turn. Tamsin has a boat to float. Seven dark houses have doors facing the road. There is another Keeper letter in the old sack.',
    'Dimity: Tomorrow: whatever you leave open. There is room.', flag('sp.coda-morning'), { op: 'save', reason: 'coda' }, label('done'), END,
  ],

  // ---------------------------------------------------------------------------------------------
  // set-pieces called by thread beats (they never set the beats' flags or advance beats)
  // ---------------------------------------------------------------------------------------------
  'ansel-confession': [
    '* A long pause, filled by the creek. He strikes at the empty water. Misses. Folds his wing.',
    'Ansel: My grandfather\'s weir held the river back year after year, and the bar rose to meet it. She worked that out with a tide log and a pencil. ~ I worked it out twenty years late, from a drawer.',
    'Ansel: I wrote the report that spring. It named the keeper.',
    'Ansel: I named her. I\'d name her again with what I had. ~ I didn\'t have the drawing.',
    'Ansel: Every evening I fish a creek I know is empty. I suppose I thought standing here long enough would count for something.',
    { op: 'choice', options: [
      { text: 'It wasn\'t you who built it.', then: [
        { op: 'remember', npc: 'ansel', key: 'confession', value: 'built' },
        'Ansel: No. My grandfather built it. I just wrote down everything except that. ~ It\'s a very thorough report. You\'d be amazed what it leaves out.',
      ] },
      { text: 'You should tell them.', then: [
        { op: 'remember', npc: 'ansel', key: 'confession', value: 'tell' },
        'Ansel: Tell them. ~ Thirty years of telling nobody, and you say it like it\'s a walk to the post office.',
        'Ansel: …Maybe it is. Hesper\'s there till two.',
      ] },
      { text: '(Say nothing. Stand with him.)', then: [
        { op: 'remember', npc: 'ansel', key: 'confession', value: 'silence' },
        '* You stand in the creek with him. The water runs over your feet, a thin cold thread of it, the only river the weir lets through.',
        'Ansel: …That\'s what she\'d have done.',
      ] },
    ] },
    { op: 'if', cond: { flag: 'sp.relighting' },
      then: ['Ansel: The light\'s on. ~ Then I\'ve run out of reasons. Tomorrow, the wheel.'],
      else: ['Ansel: I\'ll go up to the wheel. Not in the dark, though. ~ She had to do it in the dark.'] },
    END,
  ],

  'ansel-weir-wheel': [
    cam(P, 'weir-wheel', 800),
    sfx('crack'),
    { op: 'camera', to: 'player', ms: 200, shake: 2 },
    '* Rust breaks with a long cry of iron. A shudder goes down through the stone into your feet, and the sluice gate behind the wheel lifts out of thirty years of silt.',
    sfx('wave'),
    cam(P, 'north-creek-footbridge', 1400),
    '* The river comes through. Brown at first, then clear, then fast: down the weir race, under the old footbridge, into the north creek, filling it bank to bank for the first time since the Ebb winter.',
    cam(P, 'tamsin-boat', 1200),
    '* It reaches the Bracks\' oyster boat and lifts its stern a hand\'s breadth off the mud, and puts it down again, and lifts it, as if checking.',
    camHome(900),
    END,
  ],

  'bell-dig': [
    cam(P, 'bell-dig', 700),
    '* You set the shovel where Barnaby\'s string ends. The silt is grey and heavy, full of old rope and pale oyster shell, and it gives way slowly, the way thirty years would.',
    sfx('dig'),
    'Barnaby: Careful! ~ (Not that careful. The tide doesn\'t wait for careful.)',
    sfx('dig'),
    '* A foot down, the shovel rings. Not a clink: a note, low and long, that goes out across the bared quay and comes back off the harbor wall.',
    sfx('bell'),
    'Barnaby: That\'s it. ~ That\'s IT. Oh, that\'s the rim. That\'s a bell rim, that is. Gannet. Brown Bess. The Grace. ~ It called all of them home. (I\'d know a rim anywhere. I wouldn\'t. I\'ve never seen one. I\'d know this one.)',
    '* You dig round it with your paws in the end, the way you would round something alive, until the whole green shoulder of the bell is out of the mud and the sea is already sliding back over the far end of the quay.',
    camHome(500),
    END,
  ],

  'tamsin-sails': [
    cam(P, 'tamsin-boat', 900),
    sfx('wave'),
    '* The Tidy Sum slides off the mud on the morning tide, rocks once, and floats. Tamsin stands at the tiller with Kettle the Creelwight in the bow holding the nameboard straight, and Wendel\'s rollers lying empty on the bank behind her like a job well done.',
    cam(P, 'maud-berth', 1600),
    '* She brings it down the creek on water the weir gave back, out under the footbridge and along the harbor wall, and the quay fills up as she comes: Wren, Ambrose with his cane, Juniper, Tully running alongside, Wick on a bollard waving his cap, Barnaby ringing his bell.',
    sfx('bell'),
    '* The first boat in Pellwick harbor in thirty years. It isn\'t a big boat. Nobody on the quay seems to have noticed. She waves only when she is sure nobody needs the rope.',
    camHome(900),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the Summit: Hollis opens the gate (six badges), before or after the Relighting
  // ---------------------------------------------------------------------------------------------
  'summit-gate': [
    { op: 'if', cond: { map: 'hollis-gate' }, then: [tp('hollis', 'hollis-gate', 'hollis-desk'), face('hollis', 'player')] },
    { op: 'if', cond: { not: { badge: 6 } }, then: [
      '* A mountain goat in a quartermaster\'s coat sits behind a desk piled with ledgers, a pen behind each horn.',
      'Hollis: Hollis Brandt. Readers\' fund, Ration Ledger, this gate. ~ Six seals open it. I count them twice, because I was the Mooring\'s quartermaster for eleven years and it does things to you.',
      'Hollis: Come back with six. The Spires have been paying into your roof the whole way round; you\'ll have noticed the notches. That was the fund.',
      go('out'),
    ] },
    '* Hollis takes each seal from you, holds it up to the light, puts it on the desk, and counts them. Then he counts them again.',
    'Hollis: Six. ~ Six. Six questions read properly. The Keepers are through that door.',
    'Hollis: The lamp may be dark or lit. Your balance may be large or small. None of that belongs on this gate.',
    'Hollis: Two Keepers and the Champion past this gate. Their rosters are on the board by the door; they never change. ~ Read the board.',
    byDial({
      drift: ['Hollis: If one of them beats you, the Bell holds your place: next time you start at whoever beat you. Losses cost nothing up here. Nothing.'],
      flux: ['Hollis: If one of them beats you, the Bell holds your place: next time you start at whoever beat you. Losses cost nothing up here. Nothing.'],
      freefall: ['Hollis: You picked wild odds, so the Bell won\'t hold your place: lose, and the climb starts again from the first Keeper. Losses still cost nothing. ~ Nothing but the walk.'],
    }),
    { op: 'if', cond: { flag: 'sp.relighting' },
      then: ['Hollis: Bar\'s lit now. Walk it any tide. ~ I watched the beam go round from here. I cried into the Ration Ledger. Don\'t tell Bastien.'],
      else: ['Hollis: The Bar comes up at the lower low and goes under after. Watch your clock coming back. ~ The light\'s still dark. Up there, they\'ve kept a brazier going thirty years against that. You\'ll see.'] },
    sfx('doorOpen'),
    '* He gets up, walks to the gate, and lifts the bar off it with both hands.',
    flag('sp.summit-open'),
    label('out'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the Shardcrown gate after badge 6 (trainer linnet-gate; the Gnash disc win or lose)
  // ---------------------------------------------------------------------------------------------
  'linnet-gate-before': [
    { op: 'if', cond: { map: 'the-bar' }, then: [tp('linnet', 'the-bar', 'linnet-gate'), face('linnet', 'player')] },
    { op: 'if', cond: { all: [{ flag: 'sp.linnet-fell' }, { not: { flag: 'sp.linnet-returned' } }] }, then: [
      '* A stoat in white winter fur is sitting on the last dry stone before the gate, with a Sootling on her shoulder steaming into the wind. Linnet. Back, and changed, and here.',
      'Linnet: I came back the long way. Rimeholt, the jetty, the ice. You weren\'t on the jetty, so I came here. ~ My porch is lit again. Maud took me home first.',
      porch('porch-linnet', true),
      flag('sp.linnet-returned'),
    ] },
    'Linnet: Last stop before the Keepers. ~ Cinder\'s on my shoulder. Same mark, see? Right there.',
    'Linnet: I\'m not here to stop you. I\'m here because I want to see if I can. Before you go up. One more. Six each, everyone takes a turn. ~ I have been wanting to say that properly.',
    { op: 'choice', defaultIndex: 1, options: [
      { text: 'One more.', then: [{ op: 'startBattle', trainer: 'linnet-gate', source: 'rival' }] },
      { text: 'After I prepare.', then: ['Linnet: Sensible. Annoying, but sensible.'] },
    ] }, END,
  ],

  'linnet-gate-after': [
    '* Linnet\'s six stand round her on the wet stone. She looks at them, then at you, and laughs, properly, for the first time since the market.',
    'Linnet: Here. Take this. ~ Gnash. Cinder learned it when being small was the only thing it was good at. Turns out small can be very good at something. It pops decoys, and Cass loves a decoy.',
    { op: 'if', cond: { not: { hasItem: 'disc-gnash' } }, then: [{ op: 'give', item: 'disc-gnash' }] },
    { op: 'choice', options: [
      { text: 'Win or lose?', then: ['Linnet: Doesn\'t matter. ~ That\'s the thing I learned. It doesn\'t matter, and I\'m giving you the disc either way, and I mean it.'] },
      { text: 'Thank you, Linnet.', then: ['Linnet: Don\'t. ~ …Fine. You\'re welcome. Don\'t tell anyone I said you\'re welcome.'] },
    ] },
    flag('sp.linnet-gate'),
    'Linnet: Maud says when this is done I can learn the wheel. Her punt. ~ Imagine me, saying "Confirm?" to people. Win, lose. Neighbor. Same word.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the Long Road, halfway: Wick with the flame (trainer wick-long-road)
  // ---------------------------------------------------------------------------------------------
  'wick-long-road-before': [
    { op: 'if', cond: { map: 'the-bar' }, then: [tp('wick', 'the-bar', 'wick-long-road'), face('wick', 'player')] },
    emote('wick', '!'),
    'Wick: KEEPER! ~ Halfway! I\'m in the middle of the Long Road, where people have to stop. I said I would be.',
    '* He has a lantern on a pole beside him, lit, and his water pack round his feet: three creatures dripping on the wreck stones, standing in a mostly straight line.',
    'Wick: I carried the flame out here. All the way from the point. For anyone on the Road who needs to see their feet. ~ Hollis said I could wait here if I had the pack strapped properly. Hollis said "fine" four times.',
    'Wick: Skipper has a pip. I want you to see it land. ~ Do you want to see?',
    { op: 'choice', defaultIndex: 1, options: [
      { text: 'Show me.', then: [{ op: 'startBattle', trainer: 'wick-long-road', source: 'story' }] },
      { text: 'I will come back.', then: ['Wick: I will keep your place. Dimity taught me.'] },
    ] }, END,
  ],

  // ---------------------------------------------------------------------------------------------
  // after the Champion: the anchor release (silence is an answer)
  // ---------------------------------------------------------------------------------------------
  'idris-anchor-release': [
    { op: 'if', cond: { map: 'idris-hall' }, then: [tp('idris', 'idris-hall', 'anchor-release-idris'), face('idris', 'player')] },
    '* Idris\'s Vesperay comes to him across the hall, slow, its long tail trailing. The silver ring on it catches the light from the lagoon windows.',
    'Idris: You read it. All of it. Every one of mine, anchored since the day it hatched, and you read every card they never got to draw.',
    'Idris: I know every move it knows. Every way it can stand. ~ I have called that knowing it. I think… ~ I think it is time I took the ring off.',
    '* He kneels. His wing-tips shake on the clasp. It doesn\'t open. He tries again, and it does, and the ring comes away in his feathers and leaves a pale band on the Vesperay\'s tail.',
    sfx('shiftReveal'),
    '* The Vesperay\'s mark lights where it has always been. Bright, at once, as if it had only been waiting for permission: a window, its tenth, the first one nobody will spend for it. A Forecast opens.',
    { op: 'choice', options: [
      { text: 'Read it with him.', then: [
        { op: 'remember', npc: 'idris', key: 'release', value: 'read' },
        '* You read the three cards aloud. Idris listens to every number, and then he says its name, and it turns its head at once, the way it always has.',
        'Idris: It knows. ~ Of course it knows.',
      ] },
      { text: '(Say nothing. Let him read.)', then: [
        { op: 'remember', npc: 'idris', key: 'release', value: 'silence' },
        '* You say nothing. He reads slowly. He has never had to read this one before. The two of them stand in the hall in the light off the lagoon for a long time.',
        'Idris: Silence is an answer. ~ Thank you.',
      ] },
    ] },
    'Idris: Whatever wakes, I will learn it. ~ Your seed card will carry the Summit seal. Hollis will want to count it. And I would like, if you would allow it, to be on your Porch Duel slate. I have a great deal of catching up to do.',
    flag('sp.idris-beaten'), toast('Ring Off'), END,
  ],

  // ---------------------------------------------------------------------------------------------
  // a Summit loss, or the Bell rung by hand
  // ---------------------------------------------------------------------------------------------
  'summit-bell': [
    sfx('bell'),
    '* Somewhere above the Summit halls, the Bell rings once. Low, long, patient.',
    byDial({
      drift: ['* The Bell keeps your place. Rest, change the team, and come back up: you start at whoever held you, with your party as it stood. Nothing lost. Nobody asks you to climb the same stair twice.'],
      flux: ['* The Bell keeps your place. Rest, change the team, and come back up: you start at whoever held you, with your party as it stood. Nothing lost. Nobody asks you to climb the same stair twice.'],
      freefall: ['* You chose wild odds, so the Bell rings for the whole climb: come back, and it starts with Bastien again. It costs nothing. Nothing up here ever costs anything but the climb.'],
    }),
    '* The rosters on the board at Hollis\'s gate never change. Read them again.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the 56th letter: the Late Delivery party on the green
  // ---------------------------------------------------------------------------------------------
  'late-delivery-party': [
    music('lantern_market', 800),
    warpTo(P, 'party-green', 'up'),
    tp('hesper', P, 'party-green', 0, -1),
    tp('augusta', P, 'augusta-commons-board'),
    tp('barnaby', P, 'commons-pin'),
    '* Augusta pins the last notice, stamped so hard the board cracks: LATE DELIVERY. THE GREEN. GUEST OF HONOUR: HESPER COIL (MISS). Somebody has underlined ON TIME.',
    '* Hesper\'s counter has been carried out onto the grass and turned into a buffet. Every neighbour has brought the letter that came to them, and Barnaby has brought his whole string wall, pinned to a frame, every string tied.',
    'Hesper: I only brought the letters.', 'Juniper: All of them.', 'Barnaby: In order.',
    'Augusta: Order, please. ~ Odds of order: low. One line each. From your letter. Then sit down.',
    'Augusta: I\'ll start. Mine says my board said three in ten for a gale, and she made it eight. ~ She was right. I post eight in ten a good deal more often now.',
    'Tully: Mine\'s from my dad, off the herring boats. It says I was a slow kid who swore he was fast. ~ I still swear it. I\'m just fast late.',
    'Bryony: Mine says give the beans a fence no higher than your elbow. ~ Tully. Your elbow. Not your head.',
    'Odile: Mine says Gran painted every porch on this harbor. ~ She never painted the light either. She left it for me.',
    'Juniper: Mine says "Put it on my slate. I\'m good for it eventually." ~ She was. Eventually.',
    'Barnaby: (Every one of them is on the wall. Every one. Strings from the finds to the letters to the lamp.) ~ It\'s a museum. I\'m almost sure now.',
    face('hesper', 'player'),
    'Hesper: I\'d like to say something. ~ I\'m going to say it fast, because I talk fast, and I\'ve rehearsed it slowly, so it should come out about right.',
    'Hesper: Fifty-six letters. Thirty years in a sack under Mabry\'s stairs. Mabry said order is a kindness. ~ I think delivering them was the kindness. I think she knew I\'d need something to do.',
    '* On the green the old post sack hangs empty. Hesper puts a feeler inside once more, just to be certain, and laughs.',
    'Hesper: The sack is empty. I have never in my life seen it empty. ~ I don\'t care for it. I\'m going to need more post.',
    { op: 'choice', options: [
      { text: 'Write to the Outer Isles.', then: ['Hesper: Oh. ~ Oh, I could, couldn\'t I. ~ I\'ll need a stamp.'] },
      { text: '(Raise your cup to Hesper.)', then: ['* You raise your cup. The whole green raises theirs. Hesper goes very pink for a snail and hides inside her shell for a whole minute.'] },
    ] },
    music(null, 1200),
    flag('sp.late-delivery'), toast('Late Delivery'), END,
  ],

  // ---------------------------------------------------------------------------------------------
  // post-game: the Passenger perched on the Lantern Stack
  // ---------------------------------------------------------------------------------------------
  'passenger-perch': [
    { op: 'if', cond: { map: LS }, then: [cam(LS, 'passenger-perched', 800)] },
    '* On the top of the Lantern Stack, in the beam\'s path, the Passenger sits on the old perch with its wings folded, in the shape the Reading gave it, watching the lighthouse turn. It looks like it has nowhere else to be for thirty years.',
    camHome(500),
    'Corin: It has stayed. Now you ask. That is what the Lantern is for.',
    { op: 'choice', defaultIndex: 0, options: [
      { text: 'Leave it on its perch.', then: ['* You leave it be. The beam comes round and lights it every eight seconds, and it closes its eyes every time, like a cat in a window.'] },
      { text: 'Raise the Lantern and ask.', then: [
        '* Through the Glass the odds are honest and very small. It does not seem to mind being asked.',
        { op: 'startBattle', wild: { speciesId: 'vagary', level: 50 }, source: 'route' },
      ] },
    ] },
    { op: 'if', cond: { fieldLog: { form: 'vagary', state: 'held' } }, then: [
      flag('sp.passenger-caught'),
      '* Somewhere in Pellwick, an owl will hear about this from Barnaby and pretend not to be delighted.',
    ] },
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // after the Relighting: a dark house reopens, one a night (houses 2-8)
  // ---------------------------------------------------------------------------------------------
  'dark-house-reopens': [
    sfx('firefly'),
    { op: 'branch', on: 'sys.dark-houses-reopened', cases: {
      ...Object.fromEntries(HOMECOMINGS.slice(1).map((h, i) => [String(i + 1), [porch(h.porch, true), `* A porch lamp comes on across the harbor. ${h.text}`]])),
      default: [
        porch(HOMECOMINGS[0].porch, true),
        '* At dusk a traveller steps off the causeway. They stop to look at the beam, then at a key on a string. A porch that was dark yesterday is warm tonight.',
        `* ${HOMECOMINGS[0].text}`,
        'Wren: Nobody walks. ~ I may have to stop saying that.',
      ],
    } },
    { op: 'inc', id: 'sys.dark-houses-reopened' },
    '* On the green, by the light of the beam, Augusta chalks the porch count up by one, and then stands back and looks at the board as if it might need to be bigger.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // post-game: Corin and Wick ask for the ninth Spire
  // ---------------------------------------------------------------------------------------------
  'ninth-spire-ask': [
    { op: 'if', cond: { map: 'int-archive' }, then: [tp('corin', 'int-archive', 'corin-desk'), tp('wick', 'int-archive', 'reader-2')] },
    '* Corin and Wick are bent over a sheet of paper with a drawing on it: a tower, nine storeys, every floor different.',
    'Wick: Keeper! We\'ve been planning. Well, I\'ve been planning and Corin\'s been saying "hm". ~ We counted eight. The six, the Summit, the Reading. What comes next?',
    'Corin: Six Spires taught six lessons. The Summit tested them. The Reading put them together. ~ A ninth: a question you make yourself, built fresh from your own seed. A different lesson, different odds, different cards. Nobody could study for it. You would have to read.',
    'Wick: The training green, then? One challenge from your seed each day. I will write the roster. You read it. ~ And I\'d be the leader. Some days. When I\'m not on the Long Road.',
    { op: 'choice', options: [
      { text: 'Build it.', then: ['Corin: Then we will. Nine is a very good number for beginning again. ~ Hm.', 'Wick: That "hm" means yes.'] },
      { text: 'Who reads it, when I can\'t?', then: ['Corin: Whoever is standing in the right place. ~ That is how it has always worked. She left a lantern on a counter. You picked it up.', '* Wick says nothing. He pushes his cap back.'] },
    ] },
    flag('sp.ninth-spire'),
    END,
  ],
};
