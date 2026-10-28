/**
 * The opening: night one and the first morning (GDD-00 §3, §12 "The first 30 minutes"). [DATA-SCRIPTS]
 * GDD-07 §3. Every beat of the first-30-minutes table, from the causeway closing behind you to your
 * first Forecast on the Lowmoor stones. Triggers live in ./triggers.js; the chained beats on the
 * causeway (arrival -> lease card -> key and Lantern -> the three creatures) and at the cottage
 * (Wick -> Corin -> Linnet) run as one cutscene each, so the first four minutes never stop for a
 * walk the player did not choose.
 *
 * The starter is the first creature of a new run, so its uid is always `c1` (systems/flags.nextUid):
 * `{nick:c1}` names it in text and `player:c1` addresses it in `nickname` / `forecast`.
 * Pure data.
 * @module data/scripts/story-opening
 */

import {
  mk, tp, warpTo, cam, camHome, face, emote, flag, errand, wait, sfx, music, toast, call, label, go, END, byDial,
} from './_stage.js';

const P = 'pellwick';
const STARTER = 'player:c1';

export default {
  // ---------------------------------------------------------------------------------------------
  // 0:30 — the causeway closes behind you
  // ---------------------------------------------------------------------------------------------
  'arrival-causeway': [
    tp('player', P, 'arrival-start'),
    face('player', 'left'),
    { op: 'camera', to: 'player', ms: 0 },
    { op: 'move', who: 'player', path: 'LL', wait: true },
    sfx('wave'),
    { op: 'camera', to: 'player', ms: 200, shake: 1 },
    '* Dusk. Foam slides over the causeway stones you just walked, then the next ones, and the mainland becomes a grey line you cannot reach tonight.',
    cam(P, 'market-green', 1400),
    cam(P, 'point-skywatch', 1200),
    '* Across the harbor, seven porches are lit. Up on the point, the lighthouse stands black. No lamp in it. Not even a candle.',
    camHome(900),
    { op: 'move', who: 'player', path: 'L', wait: true },
    flag('sp.arrived'),
    call('wren-lease-card'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 1:30 — "You walked. Nobody walks."
  // ---------------------------------------------------------------------------------------------
  'wren-lease-card': [
    tp('wren', P, 'wren-causeway'),
    face('wren', 'right'),
    '* A lantern bobs toward you along the stones, held a little too high by a beaver in an apron with a pencil behind each ear.',
    face('player', 'left'),
    'Wren: You walked. ~ Nobody walks. Ten more minutes and you\'d have swum. ~ Wren Hearthwright, of Hearthwright and Daughter. I\'m the daughter.',
    { op: 'branch', on: 'sys.lease.plant', cases: {
      marigold: ['Wren: And you\'ve signed the card. Legible. ~ Dawn, so a marigold on your sill, and tomorrow\'s whatever you ticked. Nothing else on it is hidden.'],
      moonflower: ['Wren: And you\'ve signed the card. Legible. ~ Middle of the night, so a moonflower on your sill, and tomorrow\'s whatever you ticked. Nothing else on it is hidden.'],
      default: ['Wren: And you\'ve signed the card. Legible. ~ Dusk, so an evening primrose on your sill, and tomorrow\'s whatever you ticked. Nothing else on it is hidden.'],
    } },
    { op: 'choice', prompt: 'Wren: Quick questions. The tide\'s in.', options: [
      { text: 'What\'s wrong with the lighthouse?', then: [
        'Wren: It\'s been dark thirty years. Ask Ansel. ~ Actually, don\'t ask Ansel.',
      ] },
      { text: 'What\'s the catch?', then: [
        'Wren: Coming. With the key in your paw, so you can\'t say I hid it.',
      ] },
    ] },
    flag('sp.lease-signed'),
    call('wren-key-lantern'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 3:30 — the key, the Lantern, five wicks, and the loan, once
  // ---------------------------------------------------------------------------------------------
  'wren-key-lantern': [
    '* She presses a brass key into your paw, warm from her apron pocket, then unhooks the lantern from her pole and folds your paw round the handle.',
    'Wren: The Keeper\'s Cottage, on the point. Bedsit for now. ~ Here\'s the catch: six thousand buttons, no interest. Pay it when you can; we build while you sleep. That\'s the whole catch. I checked.',
    { op: 'give', item: 'keepers-lantern', n: 1 },
    { op: 'give', item: 'tallow-wick', n: 5 },
    { op: 'give', item: 'rod', n: 1 },
    { op: 'give', item: 'net', n: 1 },
    { op: 'give', item: 'shovel', n: 1 },
    toast('Keeper\'s Lantern, 5 Tallow Wicks, rod, net and shovel.'),
    'Wren: The co-op\'s Lantern, five wicks (each raise burns one), and the last tenant\'s rod, net and shovel, oiled. ~ Mind the stones; something\'s sitting on them.',
    face('wren', 'down'),
    call('starter-choice'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 4:00 — three on the last dry stones; one picks you
  // ---------------------------------------------------------------------------------------------
  'starter-choice': [
    { op: 'spawn', who: 'stone-sloshkin', artId: 'sloshkin', ...mk(P, 'starter-sloshkin') },
    { op: 'spawn', who: 'stone-scrapling', artId: 'scrapling', ...mk(P, 'starter-scrapling') },
    { op: 'spawn', who: 'stone-reedkit', artId: 'reedkit', ...mk(P, 'starter-reedkit') },
    cam(P, 'starter-reedkit', 600),
    '* On the last dry stones, where the lantern light reaches, three small creatures sit and watch you. None of them runs.',
    'Wren: They come to lanterns. Always have. ~ Kneel. They\'ll tell you which.',
    tp('player', P, 'starter-kneel'),
    face('player', 'right'),
    camHome(300),
    label('kneel'),
    { op: 'choice', prompt: 'Kneel beside…', options: [
      { text: 'The Sloshkin.', then: [
        emote('stone-sloshkin', '♥'),
        '* The Sloshkin hops off its stone and sits on your boot, which is wet now. It looks up at you as if this was its idea.',
        flag('np.wren.starter', 'sloshkin'),
      ] },
      { text: 'The Scrapling.', then: [
        emote('stone-scrapling', '!'),
        '* The Scrapling drops its pebble, considers it, then puts it in your paw instead. It leans on your knee like a dog that has decided.',
        flag('np.wren.starter', 'scrapling'),
      ] },
      { text: 'The Reedkit.', then: [
        emote('stone-reedkit', '…'),
        '* The Reedkit does not move. Then, very slowly, it presses its forehead against your wrist and stays there.',
        flag('np.wren.starter', 'reedkit'),
      ] },
    ] },
    { op: 'choice', prompt: 'Stay beside it?', options: [
      { text: 'Stay.', goto: 'stay' },
      { text: 'Kneel by another.', then: ['* It follows you anyway, a step behind, while you kneel by the next one.', go('kneel')] },
    ], defaultIndex: 0 },
    label('stay'),
    'Wren: That one picked you. They do the picking. ~ Raise the Lantern. It\'s been waiting thirty years for somebody to ask.',
    sfx('lantern'),
    '* The Lantern unfolds: a square, a strip, an outline of light. The meter fills, one, two, three. 100%. No roll. Some things are simply yes.',
    sfx('capture'),
    { op: 'branch', on: 'np.wren.starter', cases: {
      scrapling: [
        { op: 'addCreature', species: 'scrapling', level: 5 },
        { op: 'despawn', who: 'stone-scrapling' },
        { op: 'nickname', who: STARTER, offer: 'PEBBLE' },
      ],
      reedkit: [
        { op: 'addCreature', species: 'reedkit', level: 5 },
        { op: 'despawn', who: 'stone-reedkit' },
        { op: 'nickname', who: STARTER, offer: 'RUSHY' },
      ],
      default: [
        { op: 'addCreature', species: 'sloshkin', level: 5 },
        { op: 'despawn', who: 'stone-sloshkin' },
        { op: 'nickname', who: STARTER, offer: 'PUDDLE' },
      ],
    } },
    flag('sp.starter-chosen'),
    // checkpoint: quitting after the naming resumes here, not at the causeway (FH-04)
    { op: 'save', reason: 'starter-named' },
    sfx('shiftReveal'),
    '* You say the name out loud. On {nick:c1}\'s brow a tiny four-point mark lights up, comet magenta.',
    'Wren: Every creature born since the Starfall has one. Whatever shape it ends up in, the mark stays put. That\'s how you\'ll know it\'s still {nick:c1}.',
    { op: 'despawn', who: 'stone-sloshkin' },
    { op: 'despawn', who: 'stone-scrapling' },
    { op: 'despawn', who: 'stone-reedkit' },
    'Wren: The other two are off to Lowmoor. You\'ll see them again. ~ Point\'s that way: Keeper\'s Cottage, red fence next door, black tower above it.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 5:30 — "Keeper!" on the cliff stair; the bedsit
  // ---------------------------------------------------------------------------------------------
  'wick-keeper': [
    tp('wick', P, 'wick-cliff-stair'),
    emote('wick', '!'),
    '* A puffling in a cap three sizes too big takes the cliff stair two steps at a time.',
    'Wick: KEEPER! Wren said someone walked. Nobody walks. ~ I\'m Wick. Wick Dorrow. We live in the cliff. Under you, a bit.',
    { op: 'choice', options: [
      { text: 'I\'m only renting.', then: [
        'Wick: The Keeper\'s Cottage. Under the lighthouse. ~ That makes you the Keeper. That\'s how it works. I asked.',
      ] },
      { text: 'Hello, Wick.', then: [
        'Wick: Hello! ~ Nobody says hello back. They say "mind the step".',
      ] },
    ] },
    'Wick: Come and see! I swept it. Mostly.',
    warpTo('int-cottage', 'bedsit-first-look', 'up'),
    '* One room: a patched quilt, a kettle on the hearth, a crate, an empty windowsill, and through a gap in the roof a square of evening sky.',
    'Wick: The roof\'s got a hole. Wren says it\'s the first thing you\'ll pay for. ~ It was the real Keeper\'s, before. Mum says she went away the night the light went out. Nobody tells me the rest.',
    warpTo(P, 'porch-keepers-cottage-step', 'down'),
    call('corin-reading-glass'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 6:00 — Corin and the Reading Glass
  // ---------------------------------------------------------------------------------------------
  'corin-reading-glass': [
    tp('corin', P, 'corin-step'),
    face('corin', 'player'),
    '* A tawny owl sits on the end of your porch rail with his head tilted, as if you were a sound rather than a shape. He holds out a brass loupe on a cord.',
    'Corin: The walker. Corin Vale; I lodge over the Archive. ~ The Reading Glass. It was the last keeper\'s, and it has been in my drawer too long.',
    { op: 'give', item: 'reading-glass', n: 1 },
    flag('sp.reading-glass'),
    'Corin: It Reads creatures: their types, their temper, whether there is a Ward on them. And when one is ready to change, it shows the odds before you choose. ~ Look before you swing.',
    byDial({
      drift: ['Corin: On a gentle coast the Mooring hands out anchor stones; you will have three already. A stone refuses one window. Spend them when a card frightens you.'],
      flux: [
        'Corin: And these. Two anchor stones, Cairnhold granite. Each one refuses one window, once. The Mooring sells them; I would rather you had two before anybody sold you one.',
        { op: 'give', item: 'anchor-stone', n: 2 },
      ],
      freefall: ['Corin: You chose wild odds. Stones are scarce for you: one per badge, never sold. I have none to give that would not be a lie about the dial you picked.'],
    }),
    label('read'),
    { op: 'choice', prompt: 'Corin: Read your own creature. Go on.', options: [
      { text: 'Read {nick:c1}.', goto: 'read-starter' },
      { text: 'Read Corin.', then: ['Corin: I am an owl, Keeper. The Glass is for creatures. ~ Mostly.', go('read')] },
    ] },
    label('read-starter'),
    sfx('confirm'),
    { op: 'branch', on: 'np.wren.starter', cases: {
      scrapling: ['* READ: {nick:c1}, Scrapling. Grit. Hits hard, hits plainly; Grit lands Strong on Plain, Brine, Kiln and Rust. Under the mark: Shift — not yet.'],
      reedkit: ['* READ: {nick:c1}, Reedkit. Moss. Quick and patient; Moss lands Strong on Bolt, Stone and Rust. Under the mark: Shift — not yet.'],
      default: ['* READ: {nick:c1}, Sloshkin. Brine. Sturdy and unbothered; Brine lands Strong on Kiln, Moss and Rime. Under the mark: Shift — not yet.'],
    } },
    'Corin: At about level eight its mark will glow and the Glass will show three cards, with the odds on each. Then you choose. ~ Now look over the fence. Somebody has waited all afternoon to be first.',
    call('linnet-dock-before'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 7:00 — Linnet vaults the fence (trainer linnet-dock: hold three turns)
  // ---------------------------------------------------------------------------------------------
  'linnet-dock-before': [
    tp('linnet', P, 'linnet-porch'),
    emote('linnet', '!'),
    { op: 'move', who: 'linnet', path: 'LLL', run: true, wait: true },
    '* A stoat vaults the red fence next door without touching the top rail and points at you with her whole arm. Behind her a coal-black Sootling steams on the grass, its mark already glowing.',
    'Linnet: You\'re the walker! I\'m Linnet, next door. I\'ve waited since NOON. ~ Cinder, look. A new one. ~ Battle. Now. Not here, Wren will kill me about the fence. The dock.',
    warpTo(P, 'corin-dock', 'down'),
    tp('player', P, 'corin-dock', 0, 1),
    face('player', 'down'),
    tp('linnet', P, 'corin-dock', 0, 3),
    face('linnet', 'up'),
    tp('corin', P, 'corin-dock', 0, -1),
    '* The dock runs out over the flats into the dusk. Corin settles on a piling behind you and tilts his head at Cinder.',
    'Corin: Its window is open. Keeper, the Glass: over Cinder stands a strip, and one card is lit. UP — CALDERMAW — 100%. A posted Shift. It lands the moment she sends it out, on every dial.',
    'Corin: Then that Sootling is a great deal larger than you, and much harder to hurt. You are not meant to win. Hold three turns. ~ Read, then choose.',
    'Linnet: Stop TEACHING, it\'s my turn!',
    { op: 'startBattle', trainer: 'linnet-dock', source: 'story', holdOut: 3 },
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // after the hold-out (any result): Identity Crisis; Maud from her punt
  // ---------------------------------------------------------------------------------------------
  'linnet-dock-after': [
    '* The Caldermaw sits on the end of the dock like a hill that has decided to stay. It is still steaming. It is still, unmistakably, looking at Linnet the way the Sootling did.',
    'Linnet: Did you SEE that? It\'s ENORMOUS. ~ Same mark. Look. Right there, same place. It\'s still Cinder.',
    'Corin: Same mark, every shape. ~ Keeper, you held. That is the first lesson and most people never learn it.',
    flag('sp.dock-battle'),
    // checkpoint after the hold-out, so a quit here does not replay the dock (FH-04)
    { op: 'save', reason: 'hold-out' },
    '* {nick:c1} looks at the Caldermaw, then at you, and you feel it decide that it is not afraid of anything that size any more. Corin looks it over: singed, not hurt.',
    toast('Held out three turns: +100 EXP.'),
    sfx('wave'),
    tp('maud', P, 'maud-punt-dock'),
    '* Out on the dark water a punt glides past with a lamp at its prow. A grey goose leans on the pole and calls across the flats.',
    'Maud: Come back stronger. Brackenford stones, low\'s at five. ~ That\'s an invitation, not a ferry ticket. Confirm?',
    { op: 'choice', options: [
      { text: 'Confirmed.', then: ['Maud: Good. I like a yes I can hear.'] },
      { text: 'Who are you?', then: ['Maud: Maud Tallis. Ferry. Spire, on Lowmoor, when there\'s a challenger. Mostly ferry. ~ Brackenford. Five. Confirm?', 'Maud: …I\'ll take the nod.'] },
    ] },
    { op: 'despawn', who: 'maud' },
    'Linnet: Brackenford\'s mine. I\'ve got stones there. ~ Come and get a badge first. I\'m not fighting you without one; it wouldn\'t be fair. ~ To me.',
    { op: 'move', who: 'linnet', path: 'UUU', wait: false },
    'Corin: She is not wrong about the badge. ~ Goodnight, Keeper. I leave before the goodbyes; it saves everybody time.',
    { op: 'despawn', who: 'corin' },
    call('wick-errands'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 10:00 — the errands clipboard (six × 500 off loan 1, any order)
  // ---------------------------------------------------------------------------------------------
  'wick-errands': [
    tp('wick', P, 'corin-dock', 0, -2),
    '* Wick comes down the dock at a run with a clipboard held over his head like a prize.',
    'Wick: Keeper! Wren sent the list. First Night Errands. Six of them. Each one\'s five hundred off your loan.',
    { op: 'give', item: 'errands-clipboard', n: 1 },
    flag('sp.errands-started'),
    '* The clipboard is in Wick\'s best capitals, with a drawing of a lighthouse in the corner. The lighthouse has a light in it.',
    '* 1. GET YOUR APRON AT THE YARD (WREN).  2. PIN YOUR NOTICE ON THE COMMONS BOARD.  3. SHAKE THE COMMONS ORCHARD (AUGUSTA).  4. MAIL SACK, QUAY TO POST OFFICE (HESPER).  5. A SHORE FIND FOR BARNABY.  6. ASK ANSEL WHAT\'S BITING.',
    'Wick: Any order. That\'s three thousand if you do them all. Wren says nobody\'s ever done all six on the first night. ~ Nobody\'s ever walked, either.',
    { op: 'choice', options: [
      { text: 'Which first?', then: ['Wick: The yard. Wren gets twitchy if you\'re not wearing an apron near timber. Past the green, by the causeway.'] },
      { text: 'Who drew the lighthouse?', then: ['Wick: Me. ~ I drew it lit. I always draw it lit. Is that allowed?', { op: 'choice', options: [
        { text: 'It\'s allowed.', then: ['Wick: Good. I wasn\'t going to stop.'] },
        { text: 'Draw it lit till it is.', then: ['Wick: Till it IS. ~ Keeper. That\'s the best thing anyone\'s said on this dock.'] },
      ] }] },
    ] },
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 10:30 — the apron at the yard (errand 1)
  // ---------------------------------------------------------------------------------------------
  'yard-apron': [
    tp('wren', P, 'wren-yard'),
    face('wren', 'player'),
    '* The co-op yard smells of shavings and tar. Timber is stacked higher than the fence. An old beaver sits on a sawhorse by the tally post with a cane across his knees and his eyes half closed.',
    'Wren: You took the list. Good. ~ Apron.',
    '* She hands you a co-op apron with sawdust in every pocket. It goes on by itself, somehow.',
    'Wren: That\'s Dad. Ambrose. He can\'t see much any more. He can hear a split in a plank from across the yard.',
    'Ambrose: …Keeper\'s cottage. ~ Roof\'s rotten over the bed. I\'ll want alder.',
    'Wren: He\'s pricing your roof. Ignore him. ~ Don\'t ignore him, he\'s always right.',
    '* She gives you a card, ruled like the lease: NEW IN TOWN, with your name at the top in her capitals.',
    'Wren: Your notice. Pin it on the Commons board on the green. Augusta likes to know who\'s new; she counts porches and people and gets cross when they don\'t match.',
    errand('apron'),
    toast('Errand done: 500 off loan 1.'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 10:30 — your notice on the board (errand 2); Tully's nickname
  // ---------------------------------------------------------------------------------------------
  'tully-nickname': [
    '* The Commons board stands in the cobbled square: weather odds in chalk, a slate of names for friendly duels, a jar with a slot in the lid. You pin your notice at the top, under a drawing pin shaped like a fish.',
    errand('notice'),
    toast('Errand done: 500 off loan 1.'),
    tp('tully', P, 'tully-nickname'),
    face('tully', 'player'),
    '* A wombat in a sweatband stops jogging on the spot beside you and reads your notice with his lips moving.',
    'Tully: New Keeper. Lantern. Walked in. ~ Tully. I do laps. I do nicknames. I\'m very good at both.',
    'Tully: You\'re a Lampy. I can see it. Lampy. It\'s got a ring.',
    { op: 'nickname', who: 'tully', offer: 'Lampy' },
    { op: 'if', cond: { npc: { id: 'tully', nickname: true } },
      then: ['Tully: There we go. Took me less than a lap. ~ I\'ll tell everybody. Some of them will even use it.'],
      else: ['Tully: Just your name? Bold. Honest. I respect it. ~ I\'ll keep thinking. I always keep thinking.'] },
    'Tully: Duels on the slate. Porch to porch, friendly, nobody loses anything. Mine\'s the porch with the scuff marks. ~ Not tonight. Tonight I\'m being mysterious.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 10:30–12:00 — Odile, Bryony and Thessaly on their steps (one trigger at each step)
  // ---------------------------------------------------------------------------------------------
  'meet-neighbors': [
    { op: 'if', cond: { inRegion: 'porchlight-view' }, then: [
      tp('odile', P, 'odile-porch'),
      '* A roseate spoonbill sits on her step with a sketchbook, looking not at you but past you, at the black lighthouse on the point.',
      'Odile: Oh, you\'re in my light. ~ No, stay, you\'re a good shape. Odile.',
      'Odile: I paint the lit porches I can see from this step. Eleven, some years. Seven, now. ~ I keep leaving a canvas for that one. I can\'t paint something that isn\'t on.',
      { op: 'choice', options: [
        { text: 'Paint it dark.', then: ['Odile: I tried. It came out as a hole with a frame round it. ~ I\'ll wait.'] },
        { text: 'I\'ll see what I can do.', then: ['Odile: Will you. ~ Then I\'ll keep the canvas. I\'ve kept it this long.'] },
      ] },
      flag('np.odile.met-step'),
    ], else: [
      { op: 'if', cond: { inRegion: 'first-orchard' }, then: [
        tp('thessaly', P, 'thessaly-bench'),
        '* A bilby sits on the bench at the edge of the green with a fat almanac open on her knee and a pencil behind each enormous ear.',
        'Thessaly: You\'re the one who walked. I wrote it down. ~ Thessaly. I keep the tide notes. Somebody has to; the Warden only keeps odds.',
        'Thessaly: I\'ve kept them thirty years. ~ This is the first page in thirty years with a new name on it.',
        { op: 'choice', options: [
          { text: 'What did you write?', then: ['Thessaly: "Seventeen forty. Rising. One walker, from the east, with a lantern." ~ It\'s the best line in the book.'] },
          { text: '(Look at the page.)', then: ['* Rows of tides in a small neat hand, and at the bottom, tonight\'s date, and you. She lets you look as long as you like.'] },
        ] },
        flag('np.thessaly.met-step'),
      ], else: [
        tp('bryony', P, 'bryony-beans'),
        '* A rock hyrax stands in a row of bean poles taller than she is, glaring at a fence that runs between her garden and the next.',
        'Bryony: Don\'t lean on that. ~ Bryony. The beans are mine. The fence is the argument.',
        'Bryony: Tully says the fence is his. Tully says a lot of things while running away.',
        { op: 'choice', options: [
          { text: 'Whose fence is it?', then: ['Bryony: The beans\'. ~ Ask me again when you know us better. You\'ll get a longer answer.'] },
          { text: 'Nice beans.', then: ['Bryony: They ARE nice beans. ~ Something lives in them. Don\'t look for it. It doesn\'t like being looked for.'] },
        ] },
        flag('np.bryony.met-step'),
      ] },
    ] },
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 12:00 — six trees, eighteen fruit, a purse, the bee hum (errand 3)
  // ---------------------------------------------------------------------------------------------
  'first-orchard': [
    tp('augusta', P, 'augusta-commons-board'),
    face('augusta', 'player'),
    '* A grey seal in a Warden\'s coat watches you from beside the Commons board, a stub of chalk in her flipper.',
    'Augusta: Errand three. The Commons orchard. ~ Augusta Skerry, Harbor Warden. I post the odds. Tonight it\'s nine in ten you\'ll shake every tree, because Wick wrote it down and you look the type.',
    'Augusta: Six trees on the west lawn. Shake each one. Three fruit a tree if you\'re patient; a press drops one at a time.',
    'Augusta: The Miser has a purse in it. Nobody knows who keeps putting it back. ~ I have a list of suspects. It\'s everybody.',
    'Augusta: And Honeypot hums. When you hear it, step back a second and hold your net up. A second is all you get. ~ That\'s not odds. That\'s bees.',
    sfx('shake'),
    '* Augusta raps the nearest trunk with her flipper. The branches shiver, and nothing falls.',
    'Augusta: They only give to the one who\'s picking. Face a trunk and press; one fruit a press, three a tree. ~ Errand three. The list doesn\'t say how well, so I\'ll mark it now and watch the rest.',
    errand('orchard'),
    toast('Errand done: 500 off loan 1.'),
    'Augusta: Sell what you pick. Someone\'s always buying; after ten it\'s Ludo, on the post office eave, upside down. ~ Don\'t stare. He hates that.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 13:30 — the mail sack, quay to post office (errand 4); Hesper's lamp
  // ---------------------------------------------------------------------------------------------
  'hesper-mail-sack': [
    { op: 'if', cond: { not: { hasItem: 'mail-sack' } }, then: [
      '* On the quay, by the bollards, someone has left a canvas sack tied with tarred string. A tag on it, in a goose\'s careful hand: POST OFFICE. CAME ON MY PUNT. DON\'T DROP IT. — M.T.',
      '* It is heavier than it looks. Something inside it shifts like paper settling.',
      { op: 'give', item: 'mail-sack', n: 1 },
      '* Number four on Wick\'s list. By the look of the tag, somebody has been waiting for this sack for a very long time.',
      { op: 'goto', id: 'done' },
    ] },
    tp('hesper', P, 'hesper-post-step'),
    '* The post office is shut, its windows dark, but there is a garden snail on the step with a counter-lamp beside her, unlit, and an expression of someone who has been waiting a very long time and has decided not to mention it.',
    'Hesper: Is that — oh. Oh, it is. The sack. ~ Hesper Coil. Post office. Night counter, eighteen till two, when there is a counter. There hasn\'t been one. There is now.',
    { op: 'take', item: 'mail-sack', n: 1 },
    '* She holds the sack in both feelers and does not open it.',
    'Hesper: Thirty years, Mabry kept it under her stairs. Order is a kindness, she used to say. ~ I read slowly. I talk fast. Between the two I shall be quite busy.',
    sfx('firefly'),
    '* She lights the counter-lamp. It is small, and amber, and for a moment it is the warmest thing on the street.',
    'Hesper: Something\'s been waiting for you. ~ Morning. Not before. I have to read the envelopes first, and I read slowly.',
    flag('sp.mail-sack'),
    errand('mail-sack'),
    toast('Errand done: 500 off loan 1.'),
    label('done'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 14:00 — the reeds: a wild Tossup, Capture Stance, the real odds; it comes back until it is held
  // ---------------------------------------------------------------------------------------------
  'corin-capture-stance': [
    tp('corin', P, 'corin-reeds'),
    face('corin', 'player'),
    '* Corin is perched on a fence post above the reeds, so still you take him for part of it until he speaks.',
    'Corin: The reeds. The only place in town anything wild lives. ~ Something in there has been watching your Lantern for a minute.',
    { op: 'emote', who: 'player', kind: '!' },
    '* The reeds part. A small creature with a coin-shaped face hops out and flips itself over, twice, as if to show you both sides.',
    'Corin: A Tossup. Level four. ~ In the fight there is a stance with no slot: Capture Stance. With it on, your hits stop at a sliver, so nothing knocks it out by accident while you bring it home.',
    'Corin: The Glass shows the odds before you burn a wick: about a third while it is fresh, nearly sure at a sliver. ~ And every miss raises the next try.',
    label('reeds'),
    { op: 'if', cond: { not: { hasItem: 'tallow-wick' } }, then: [
      'Corin: Out of wicks? Take two of mine. An owl does not need a Lantern to find a fence post.',
      { op: 'give', item: 'tallow-wick', n: 2 },
    ] },
    // this Tossup only flips (Settle): the lesson cannot be lost however low the party came off the dock
    { op: 'startBattle', wild: { speciesId: 'tossup', level: 4, moves: ['settle'] }, source: 'story' },
    { op: 'if', cond: { fieldLog: { form: 'tossup', state: 'held' } },
      then: [
        flag('sp.capture-stance'),
        '* The Tossup is gone from the reeds and in the Lantern\'s light. A warm chord. No wobble, no click. Just yes.',
        'Corin: Into the light. ~ The odds were the odds, and you looked first. That is all reading is.',
      ],
      else: [
        { op: 'choice', prompt: 'Corin: Back into the reeds. They do. ~ It will be out again in a moment; it likes your Lantern. The Stance, a hit or two down to a sliver, then the Lantern.', options: [
          { text: 'Again.', then: ['* The reeds part. The Tossup flips itself over, twice, and waits.', go('reeds')] },
          { text: 'Later.', then: [flag('sp.capture-stance'), 'Corin: The reeds will have another, and the Glass will have the odds. ~ Try again when you like.'] },
        ], defaultIndex: 0 },
      ] },
    'Corin: I am going to sit here and pretend I can see the comet. ~ Goodnight.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 15:30 — Barnaby's porthole fogs over a shell: the Field Log (errand 5)
  // ---------------------------------------------------------------------------------------------
  'barnaby-field-log': [
    '* The Archive is closed, but at the round porthole beside its door a hermit crab in a brass diving helmet is pressed to the glass, which fogs and unfogs with his breathing.',
    'Barnaby: Is that a shell? ~ In your pocket? Is that a SHELL? Hold it up. Higher. (Not that high. I\'m small.)',
    'Barnaby: Barnaby Thole. Archive. Curator. Owner. Cleaner. Sole member of staff. (We\'re hiring. We\'ve been hiring for eleven years.)',
    '* He unscrews a little hatch at the bottom of the porthole and holds out a claw for your find. He turns it over three times, and writes on a card without looking.',
    'Barnaby: Provenance: the point, tonight, the new Keeper, rising tide. ~ Oh, that\'s a good provenance.',
    'Barnaby: Here. Have a Field Log. Every creature you see, every one you Read, every one you hold, gets a plate. Forty-two plates. Nobody\'s filled it. (Corin got thirty-one. He says it doesn\'t count because he can\'t see the pictures.)',
    flag('sp.field-log'),
    'Barnaby: Bring me finds and I\'ll name them, in one go, in the morning. Fossils, relics, things the tide leaves. Every one I pin on my wall gets a string. ~ Strings are how a museum thinks.',
    errand('shell'),
    toast('Errand done: 500 off loan 1.'),
    'Barnaby: (The Archive opens at nine. I\'ll be here. I\'m always here. I live here.) ~ (In the helmet.) ~ (It\'s very snug.)',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 16:30 — "Forked tail, by the piling." (errand 6)
  // ---------------------------------------------------------------------------------------------
  'ansel-fishing-tells': [
    tp('ansel', P, 'ansel-launch'),
    '* A grey heron stands at the bow of a launch that has not floated in a long time, looking down at a river that runs past the end of the creek and not into it.',
    'Ansel: You\'re the one with Wick\'s list. ~ Number six. "Ask Ansel what\'s biting." Nothing\'s biting in the creek. Something\'s biting in the river.',
    'Ansel: Ansel Stalk. ~ Watch the shadows, not the float. Every fish has a tell: a shape, a sound, a word for it. Learn three of the same and you\'ll know it every time.',
    cam(P, 'piling', 700),
    '* By the old piling, a shadow turns in the brown water. Its tail splits into two neat points.',
    'Ansel: Forked tail, by the piling. Don\'t rush it.',
    'Ansel: Cast past it. It\'ll come and look. It\'ll nudge it, twice. Feint, feint. Then the third time it means it, and you\'ll hear it. ~ Plip.',
    camHome(500),
    { op: 'choice', options: [
      { text: 'What does it mean, the forked tail?', then: ['Ansel: Perch, this time of night. At a night low, out on the flats, a forked tail like that is a John Dory. ~ Two thousand four hundred buttons. I\'ve never caught one. I\'ve seen four.'] },
      { text: 'Why fish the empty creek?', then: ['Ansel: …Habit. ~ Fish the river tonight. Ask me about the creek when you\'ve read something worth asking about.'] },
    ] },
    errand('fish'),
    toast('Errand done: 500 off loan 1.'),
    'Ansel: Go on. The river doesn\'t wait for anyone, and the creek doesn\'t come for anyone. ~ Between them they\'ve taught me patience. Not much else.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 18:00 — Pip the dock hand (trainer pip; the before script starts its own battle)
  // ---------------------------------------------------------------------------------------------
  'pip-before': [
    face('pip', 'player'),
    '* A water rat in rolled sleeves sits on a bollard coiling a rope that is not tied to anything.',
    'Pip: You\'re the new Keeper? Pip. I tie boats. ~ Well, I would if we had boats. I practise on the bollards. The bollards have never once drifted off.',
    'Pip: Tossup first; it\'s only little. Then Whisk, my Wirewhisk; Arc Ping goes first, every time, that\'s just how it\'s wired. ~ Battle? Two hundred buttons if you win. Don\'t tell Maud I bet.',
    { op: 'choice', options: [
      { text: 'Battle.', goto: 'fight' },
      { text: 'Not tonight.', then: ['Pip: Fair. The bollards and I will be here. We\'re always here. ~ We\'re very reliable.', go('out')] },
    ], defaultIndex: 0 },
    label('fight'),
    { op: 'startBattle', trainer: 'pip' },
    label('out'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 19:00 — sell to Ludo on the eave
  // ---------------------------------------------------------------------------------------------
  'ludo-first-sale': [
    tp('ludo', P, 'ludo-eave'),
    '* Something hangs upside down from the post office eave, wrapped in its own wings like a folded umbrella. It opens one eye.',
    'Ludo: Buying. ~ Anything. Full price. Fruit, fish, finds, whatever\'s in that apron. Night\'s my shop. Day\'s for sleeping.',
    'Ludo: Ludo. Don\'t stare. Everybody stares. ~ You\'re staring.',
    { op: 'choice', options: [
      { text: 'Sorry.', then: ['Ludo: Don\'t be sorry. Be selling.'] },
      { text: 'Is the blood rushing to your head?', then: ['Ludo: Always. It\'s how I think so fast. ~ Selling?'] },
    ] },
    { op: 'openShop', shop: 'ludo-eave' },
    { op: 'if', cond: { wallet: { gte: 3000 } },
      then: ['Ludo: Three thousand in your apron. ~ The yard\'s still lit. Wren pays attention to people who pay attention.'],
      else: ['Ludo: Come back with more. Ten till eight, every night. Someone\'s always buying. Usually me.'] },
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 19:30 — the first payment (runs when loan 1 clears: beads, the THWAP, the split stick, the roof)
  // ---------------------------------------------------------------------------------------------
  'first-payment': [
    warpTo(P, 'yard-payment', 'up'),
    tp('wren', P, 'wren-yard'),
    tp('ambrose', P, 'ambrose-bench'),
    '* The yard by lamplight. The abacus beads are still swinging on their wires. Shavings have settled on everything, including Wren.',
    'Wren: Six. ~ Six beads. Six thousand. Dad.',
    'Ambrose: Stick.',
    '* He runs a thumb down the tally stick, reading the grain the way other people read print.',
    'Ambrose: Alder. Good. ~ Notch it wide, so they can read it from across a room.',
    sfx('thwap'),
    { op: 'camera', to: 'player', ms: 100, shake: 3 },
    '* THWAP. His tail comes down on the stick, dust jumps off the bench, and the stick lies in two clean halves.',
    'Ambrose: Your half. Hang it where you\'ll see it in the mornings. ~ Ours goes in the book.',
    flag('sp.first-payment'),
    'Wren: Roof tonight. The Thatch tie it off at twenty to six; you can watch if you\'re up. ~ You picked the colour on the card. Slate blue\'s the one the cursor likes. It\'s also the one I like.',
    'Wren: Loan two\'s on the ledger whenever you want it. Fifteen thousand. A real cottage: two rooms, a mirror, more satchel. ~ Same terms. Pay it when you can.',
    { op: 'choice', options: [
      { text: 'Write it down.', then: ['Wren: Already have. ~ I write everything down. It saves arguing with Dad.', 'Ambrose: I heard that.', 'Wren: You were meant to.'] },
      { text: 'One thing at a time.', then: ['Wren: Good answer. It\'s the right one, too. I checked.'] },
    ] },
    'Wren: Go home. ~ Your lamp\'s waiting. It doesn\'t know yet, but it is.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 20:30 — the porchlight comes on; Dimity; a Prismoth at the lamp: Ward ?
  // ---------------------------------------------------------------------------------------------
  'porchlight-on': [
    tp('player', P, 'porchlight-player'),
    face('player', 'up'),
    sfx('lantern'),
    '* Your porch lamp comes on. Nobody touches it. It simply decides, the way the porches across the water decided, and the light falls warm and amber down your step.',
    '* Something small and pink and yellow comes out of the dark and lands inside the glass, folding its wings as if it has done this every night for years.',
    'Dimity: Oh, good. ~ It\'s warm. Somebody paid for warm.',
    'Dimity: Dimity. I keep the page. Whatever happens in a day, I write it down when you sit or sleep: buttons, people, catches, Shifts. And tomorrow. Always tomorrow.',
    'Dimity: I\'ll keep the save too. If it ever fails I\'ll say so, in red. It won\'t. ~ I\'m very careful.',
    tp('wick', P, 'wick-errands'), // (10,25), below the mailbox: cottage-porch +1,+1 is the mailbox itself
    'Wick: Keeper. ~ Your porch is on. That\'s eight. Augusta will have to change the board.',
    { op: 'spawn', who: 'lamp-prismoth', artId: 'prismoth', ...mk(P, 'prismoth-lamp') },
    '* Another wing at the lamp. Larger, glassy, catching the light in a lattice that shivers every few seconds. It does not land. It looks at the light like it wants to drink it.',
    'Wick: A Prismoth! They come to lamps. Mum says the light calls them. ~ Read it! Go on!',
    sfx('blocked'),
    '* Through the Glass the Prismoth\'s outline shimmers in a lattice. Under its name the Glass writes one word and a question mark. WARD ?',
    'Wick: Ward. That means some hits just bounce off. Corin says read the shimmer, then pick what still lands. ~ You can\'t fight them here. They live on Cairnhold. This one\'s just visiting.',
    { op: 'despawn', who: 'lamp-prismoth' },
    '* The Prismoth turns once in the light and goes back into the dark, toward the lighthouse, as if checking whether that lamp is on yet.',
    'Dimity: It\'ll be back. They always come back to a lit porch. ~ Sit with me when you\'re ready. I\'ll write the page.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 22:00 — the party pip; Corin's slip in the door
  // ---------------------------------------------------------------------------------------------
  'corin-slip': [
    '* A slip of paper is tucked into your door frame, folded twice. The handwriting is large, as if written by somebody who cannot quite see it.',
    { op: 'if', cond: { party: { level: { gte: 7 } } },
      then: ['* "{nick:c1} is level seven. Its mark has a pip on it: Shift pending. One more level and the window opens.'],
      else: ['* "{nick:c1} is close. A few more fights and its mark will show a pip: Shift pending.'] },
    '* Tomorrow. I\'ll be on the stones at the low. Bring the Glass. —C."',
    'Dimity: The owl. ~ He knocks very quietly and leaves before anyone answers. It\'s his way of being polite.',
    'Dimity: The low\'s just after five. Stones to Lowmoor, by the point flats, or the boardwalk if you sleep in. ~ I\'ve put it under Tomorrow.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 24:30 — the first night low: the flats glow
  // ---------------------------------------------------------------------------------------------
  'first-glowing-flats': [
    tp('barnaby', P, 'barnaby-flats'),
    sfx('night'),
    '* The tide has gone out from under the point, and the mud it left behind is glowing. Seams of cyan light run through the flats like veins in a leaf, brightest where your foot presses.',
    'Barnaby: (Don\'t step on the cockles.) ~ It\'s you! The Keeper! Out at the night low! Oh, you\'re a natural. (I\'m out at every low. It\'s the provenance.)',
    'Barnaby: That\'s skyglass under there, all through the mud. Bits of comet. They hum; put your ear down. ~ (Not literally. You\'ll get mud in it.)',
    'Barnaby: At a night low the bigger pieces come up near the surface. Three a night, no more. Dig where the glow is thickest.',
    cam(P, 'glint-hint', 600),
    '* Further out, something glints that is not cyan: a hard brass gleam, just under the mud.',
    'Barnaby: And THAT is the Glint. One a day, somewhere on the flats. Somebody\'s purse, or a lot of somebodies\'. It gets bigger every day. (Nobody knows why. I have a string for it.)',
    camHome(400),
    'Barnaby: Cockles are worth something too. Ludo buys everything. ~ (Ludo buys me lunch, sometimes. He\'s very good to the Archive.)',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 26:00 — the Thatch tie off your roof (the dawn build)
  // ---------------------------------------------------------------------------------------------
  'thatch-first-roof': [
    warpTo(P, 'porchlight-player', 'up'),
    cam(P, 'thatch-roof', 600),
    sfx('dawn'),
    '* Twenty to six. A flock of finches comes over the cottage in a single whirring sheet and settles on your roof, every one of them carrying something: a reed, a peg, a twist of tarred string.',
    'The Thatch: Tie it! Tie it! Over, under, tight! Who\'s got the pegs? Pegs! Tie it!',
    '* They work the way water runs downhill. In a minute the hole over your bed is a roof, and the roof is the colour on your card.',
    'The Thatch: Done! Done! Nobody fell! Breakfast!',
    '* They are gone as fast as they came, toward the yard, where somebody leaves seed on the timber stacks.',
    camHome(500),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 26:30 — "One for you. It's… a little late." K1
  // ---------------------------------------------------------------------------------------------
  'hesper-k1': [
    warpTo(P, 'porchlight-player', 'down'),
    tp('hesper', P, 'hesper-cottage-gate'),
    face('hesper', 'player'),
    '* Six o\'clock. Hesper is at your gate. She has a letter in one feeler and the expression of a snail who has had a long night with the envelopes and would like to tell you about all of them.',
    'Hesper: Morning. ~ One for you.',
    'Hesper: It\'s… a little late.',
    'Hesper: Addressed to the Keeper. Point Cottage. Thirty years in the sack. ~ That\'s you now, I suppose. Mabry always said order is a kindness, so they\'ll come one a morning, in the order she wrote them.',
    'Hesper: She. The Keeper. Isolde. ~ I\'ve read the envelope. I haven\'t read the letter. I wouldn\'t. ~ I would, but I haven\'t.',
    { op: 'letter', n: 1 },
    { op: 'choice', options: [
      { text: 'She says the river is wrong.', then: ['Hesper: Does she. ~ Ansel will want to know that. Or he won\'t. One of the two, very strongly.'] },
      { text: '(Fold it away.)', then: ['Hesper: Quite right. A letter is the reader\'s business. ~ I\'ll be back tomorrow, at six, with the next.'] },
    ] },
    'Hesper: Tomorrow at six. Every morning. ~ And from tonight, the counter: other people\'s letters, to carry to their doors. Eighteen till two.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // 27–30 — the Lowmoor stones: two wilds, level eight, your first Forecast
  // ---------------------------------------------------------------------------------------------
  'corin-first-forecast': [
    tp('corin', 'lowmoor', 'corin-lowmoor-stones'),
    face('corin', 'player'),
    { op: 'if', cond: { flag: 'sp.first-forecast' }, then: [
      'Corin: You read one already. Without me. ~ Good. That is the whole point of me.',
      'Corin: I will still be on the stones at the low, most mornings. Owls like the edges of things.',
      { op: 'goto', id: 'out' },
    ] },
    { op: 'if', cond: { not: { flag: 'np.corin.stones-met' } }, then: [
      '* Corin is on the last stone of the crossing with his feathers fluffed against the morning, facing exactly the wrong way until you speak.',
      'Corin: Keeper. You came at the low. ~ Most people come at noon and then wonder where the stones went.',
      flag('np.corin.stones-met'),
    ] },
    { op: 'if', cond: { not: { party: { level: { gte: 8 } } } }, then: [
      'Corin: Not yet. {nick:c1} needs a level, perhaps two. The flats here are full of things that want to fight a stranger. ~ Come back to me when its mark is glowing. I will wait. I am good at waiting; it is the only thing my eyes have improved at.',
      { op: 'goto', id: 'out' },
    ] },
    '* {nick:c1}\'s mark is glowing. Not the faint four-point mark: a bright one, pulsing, like a second heartbeat.',
    'Corin: There. Its window is open. ~ Raise the Glass. Three cards. Up, sideways, down. Each with its odds. Read them all before you look at the one you want.',
    'Corin: Accept lets it land. An anchor stone refuses this window and keeps it as it is. Starsalt redraws the cards, once you have a badge and some salt. ~ There is no wrong answer. There is only reading, and then choosing.',
    music('forecast'),
    { op: 'forecast', who: STARTER },
    music(null),
    flag('sp.first-forecast'),
    'Corin: Read, and chosen. ~ Whatever it is now, look: the mark is in the same place. Same mark, every shape.',
    { op: 'choice', options: [
      { text: 'It\'s still {nick:c1}.', then: ['Corin: It is. ~ She used to say that. "It\'s still her." About a Siltback, a long time ago.'] },
      { text: '(Watch it settle.)', then: ['* {nick:c1} shakes itself like a dog out of the sea and looks up at you. The mark glows once more and goes quiet.'] },
    ] },
    'Corin: Brackenford is up the shore. The ferry pavilion, Maud\'s practice table, and a Spire with a goose in it. ~ I will be at the Archive, pretending to read.',
    label('out'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // a blackout: you wake on your porch
  // ---------------------------------------------------------------------------------------------
  'blackout-wake': [
    { op: 'if', cond: { loan: { tier: { gte: 2 } } },
      then: [
        '* Porchlight amber. Your own step under you, your own lamp above you, and every one of your creatures curled round your feet, rested.',
        'Dimity: You came home carried. ~ I kept your place.',
        'Dimity: An hour gone, and a little from your apron. Half of it went in the Keeper\'s Purse; it\'ll come back with the next three Glints. ~ Nothing else. Not a stone, not a notch.',
      ],
      else: [
        '* You wake on your own step. The porch lamp is dark, but there is a puffling sitting beside you with his cap pulled down.',
        'Wick: Keeper. You came home carried. ~ I watched your stuff. Nobody touched it. A gull looked at it.',
        'Wick: You lost some buttons, Mum says. Not the loan. The loan doesn\'t mind. ~ Nobody minds. You just go again.',
      ] },
    END,
  ],
};
