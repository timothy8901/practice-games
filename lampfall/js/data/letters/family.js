/**
 * The eighteen family letters (F1-F18). [DATA-LETTERS] GDD-08 §3.
 *
 * One reaches Hesper's counter at 18:00 from day 2 (F1 on day 2 ... F18 on day 19 when each is
 * collected); the player carries it to its `door` (a porch id). At a lit porch Juniper returns the
 * `heirloom` at once; at a dark one it waits until the porch lights (F4 waits for Tamsin in dark
 * house 1). F1, F5, F9 and F13 light their own porch (`lightsPorch`) and also return a common
 * creature (Bilgebob, Puddlepip, Mothling, Wirewhisk), each a level or two under its first Shift
 * window so a Forecast is near. F1 is canon text (GDD-00 §11). Global serial numbers: F = n 21-38.
 * Pure data: no imports, no function values in the export.
 * @module data/letters/family
 */

/**
 * @param {number} i   position in the family channel (1-18)
 * @param {Record<string, any>} row
 */
const f = (i, row) => ({
  id: `f${i}`, n: 20 + i, index: i, channel: 'family',
  author: null, byline: null, seal: 'wax-red',
  deliver: { at: 'counter', hour: 18, day: i + 1, carry: true },
  heirloom: null, creature: null,
  relicId: null, unlock: null,
  ...row,
});

/** @type {ReadonlyArray<import('../index.js').Letter>} */
const FAMILY = [
  f(1, {
    author: 'isolde', from: 'Isolde Petrel', to: 'The Dorrows, cliff stair', addressee: 'wick', seal: 'petrel',
    date: '8 November, the Ebb winter',
    door: 'porch-dorrow', lightsPorch: 'porch-dorrow', heirloom: 'dorrow-kettle',
    creature: { species: 'bilgebob', level: 6 },
    subject: 'Maren\'s Bilgebob, a civic institution.',
    reveal: [{ op: 'setFlag', id: 'np.wick.whale' }],
    body: 'To the Dorrows, cliff stair,|Maren, your Bilgebob towed the oil boat off the bar twice this week and will not take a fish for it. I have told him he is a civic institution. Tell the small one the Keeper says the light is on because of a whale.|—I. Petrel',
  }),
  f(2, {
    author: 'isolde', from: 'Isolde Petrel', to: 'Ambrose Hearthwright, the co-op yard', addressee: 'ambrose', seal: 'petrel',
    date: '1 December, the Ebb winter',
    door: 'porch-coop-yard',
    subject: 'The alder floor in the Lamp Room.',
    reveal: [{ op: 'setFlag', id: 'np.ambrose.alder-floor' }],
    body: 'To Ambrose Hearthwright, the co-op yard,|The new floor in the Lamp Room is the best thing on this coast, and I have stood on most of it. Alder, you said, because it doesn\'t mind being wet and doesn\'t creak at two in the morning. It doesn\'t. I\'ve tested it with pacing.|Your girl came up with the last plank and asked why lighthouses are round. I said so the wind can\'t find a corner to argue with. She said that was a bad reason and drew me a square one. Keep that drawing.|—I. Petrel',
  }),
  f(3, {
    from: 'Hal Gannet, bosun of the fleet', byline: 'Hal Gannet, bosun of the lost fleet', to: 'Agnes Pell, at the shop', addressee: 'juniper',
    date: '2 January, the Ebb winter',
    door: 'porch-pells',
    subject: 'The winter\'s flour, on Pell\'s slate.',
    reveal: [{ op: 'setFlag', id: 'th.heirlooms-going-home.slate' }],
    body: 'To Agnes Pell, at the shop,|You put the winter flour on the slate for every house on the quay and wouldn\'t hear a word about it. I\'m writing it down so somebody does: eleven sacks of flour, four of oats, a side of bacon and the good tea, owed by the fleet, to be paid when the fleet sails.|The fleet\'s on the bar, Agnes. I don\'t know when that is.|Yours in debt and in earnest,|Hal Gannet, bosun',
  }),
  f(4, {
    author: 'isolde', from: 'Isolde Petrel', to: 'The Bracks, aboard the Tidy Sum', addressee: 'tamsin', seal: 'petrel',
    date: '15 December, the Ebb winter',
    door: 'porch-dark-1', heirloom: 'brack-still-knot',
    subject: 'The creel creature, and a knot for it.',
    reveal: [{ op: 'setFlag', id: 'th.oyster-boat.kettle-named' }],
    body: 'To the Bracks, aboard the Tidy Sum,|Your creel creature, the one the children call Kettle for the noise it makes, was on my gallery rail again last night, rattling at the hum. It\'s frightened, not ill. Here is a knot of the old kind, the one my keeper tied on a restless dog. Tie it to Kettle\'s creel on loud nights and it will hold still and feel held.|If it ever doesn\'t come home, listen for the rattle. Creatures keep what they love inside them, given the chance.|—I. Petrel',
  }),
  f(5, {
    from: 'Old Fen, bean-grower, Brackenford', byline: 'A Lowmoor bean-grower', to: 'The bean house by the green', addressee: 'bryony',
    date: '20 October, the Ebb winter',
    door: 'porch-bryony', lightsPorch: 'porch-bryony', heirloom: 'bryony-seed-tin',
    creature: { species: 'puddlepip', level: 7 },
    subject: 'Seed for a low fence, and a puddle-pup.',
    reveal: [{ op: 'setFlag', id: 'th.the-fence.low-beans' }],
    body: 'To the bean house by the green,|Here are the runner beans you asked after: Lowmoor Sweets. They\'ll climb anything, but give them a fence no higher than your elbow. Any taller and they sulk, and so do neighbors. A low fence is for leaning on and passing beans over.|A puddle-pup followed the cart from Brackenford and has made the seed tin its bed. I tried three times to keep it. It wants the tin. It\'s yours now, and so is the pup, I\'m afraid.|Old Fen, Lowmoor',
  }),
  f(6, {
    author: 'isolde', from: 'Isolde Petrel', to: 'Augusta Skerry, Harbor Warden', addressee: 'augusta', seal: 'petrel',
    date: '19 December, the Ebb winter',
    door: 'porch-wardens-house', heirloom: 'grade-two-lantern',
    subject: 'Storm odds, and a lantern on loan.',
    reveal: [{ op: 'setFlag', id: 'np.augusta.storm-odds' }],
    body: 'To Augusta Skerry, Harbor Warden,|Your board says three in ten for a gale on the twenty-first. I read my glass and the sea\'s mood and I make it eight. You\'re the Warden and I\'m a keeper with a bad pencil, so put up your number, but bring the fleet in early anyway.|I\'m lending you my grade-two lantern for the end of the quay. It\'s steadier than mine, which says something about one of us. Keep it lit if mine isn\'t.|—I. Petrel',
  }),
  f(7, {
    from: 'Dad, aboard the Gannet', byline: 'A deckhand of the lost fleet', to: 'My boy, the house with the blue step', addressee: 'tully',
    date: '10 December, the herring grounds',
    door: 'porch-tully',
    subject: 'Home to a slow kid who swore he was fast.',
    reveal: [{ op: 'setFlag', id: 'th.mudlark-mile.dad-letter' }],
    body: 'To my boy, the house with the blue step,|We\'re at the herring off Thistlewind, nets full, cook terrible. Your mother says you ran the flats again on Sunday and came in last and told everybody you\'d won. Good. Tell them again.|I watched you from the deck once, flat out with your ears back. Slowest kid on the coast and the only one who never stopped. Keep that. Speed you can buy later.|Home by the twenty-first, gale permitting.|Dad',
  }),
  f(8, {
    from: 'The harbor office', byline: 'The harbor office', to: 'The Archivist', addressee: 'barnaby', seal: 'harbor-office',
    date: '20 November, the Ebb winter',
    door: 'porch-archive',
    subject: 'Weir records requested, never sent.',
    reveal: [{ op: 'setFlag', id: 'th.the-bell.weir-records' }],
    body: 'HARBOR OFFICE — To the Archivist|At the request of the Keeper, the office asks that the Archive forward any plans, deeds or survey records relating to the Stalk mill weir on the north river, together with any record of the river\'s depth at the bar before the weir was built.|The Keeper describes the matter as urgent. The Board describes it as noted. Kindly send what you have at your convenience, or sooner if the Keeper calls again; she has been calling a great deal.|For the Harbormaster',
  }),
  f(9, {
    from: 'Gran', byline: 'Odile\'s grandmother', to: 'Little Odile, for when her legs are long enough', addressee: 'odile',
    date: '1 November, the Ebb winter',
    door: 'porch-odile', lightsPorch: 'porch-odile', heirloom: 'odile-easel',
    creature: { species: 'mothling', level: 18 },
    subject: 'The easel, and the light she could not paint.',
    reveal: [{ op: 'setFlag', id: 'th.twelve-lights.easel' }],
    body: 'To my little Odile, for when your legs are long enough for this,|Here is my easel. It leans left; so do I. I have painted every porch on this harbor and never once the lighthouse lit, because a light that\'s always on isn\'t a subject, it\'s furniture. I always thought there would be time.|If it ever goes dark, paint the dark honestly, then wait. A light coming back is a subject.|Moths like the easel. Don\'t shoo them; they\'re critics.|Gran',
  }),
  f(10, {
    from: 'Ned, of the Emberstep ropewalk', byline: 'A towrope maker', to: 'The Rask house, next the point', addressee: 'linnet',
    date: '10 January, the Ebb winter',
    door: 'porch-linnet',
    subject: 'A rope that held, and a creature that did not.',
    reveal: [{ op: 'setFlag', id: 'th.ember-grub.towrope' }],
    body: 'To the Rask house, next the point,|You sent back the piece of tow line off the Ivy Rask and asked was it the rope that failed. I\'ve had it under the glass all week. It isn\'t. It held to the last strand. Whatever was in the traces changed shape and couldn\'t hold the course, and no rope I make can help with that.|I\'m sorry. A rope only does the one thing. I\'d still sell you another, if you ever go back out.|Ned, the ropewalk, Emberstep',
  }),
  f(11, {
    author: 'isolde', from: 'Isolde Petrel', to: 'Mabry Coil, the post office', addressee: 'hesper', seal: 'petrel',
    date: '7 January, the Ebb winter',
    door: 'porch-post-office',
    subject: 'Keep my letters until someone lights the lamp.',
    reveal: [{ op: 'setFlag', id: 'np.hesper.keep-my-letters' }],
    body: 'To Mabry Coil, the post office,|You have been holding my letters to the Keeper in the blue pigeonhole. Please go on holding them. When the office closes, and Hesper says it will, keep them anyway. Keep the ones I send after, too.|Don\'t post them to anybody. Give them to whoever lights the lamp again, one a morning, in order. They\'ll need the whole story, and they\'ll need it slowly.|I know it is a great deal to ask of a postmistress. That is why I\'m asking you.|—Isolde',
  }),
  f(12, {
    from: 'Josiah Stalk', byline: 'Ansel\'s grandfather', to: 'The Hearthwright yard', addressee: 'wren',
    date: '1 December, the Ebb winter',
    door: 'porch-coop-yard',
    subject: 'An order for weir timber, cancelled.',
    reveal: [{ op: 'setFlag', id: 'np.wren.weir-order' }],
    body: 'To the Hearthwright yard,|Further to my order of the 3rd, for oak to make good the sluice gate at the Stalk weir: cancel it. The mill is to be sold, my agent says, and a new owner will want to do things his own way.|I built that weir when I was younger than my grandson is now, and the gate has been seized for twenty years of it. It can wait for whoever buys it. I am too old to stand in that river.|Settle what I owe for the drawing work. My grandson will collect the account.|Josiah Stalk',
  }),
  f(13, {
    from: 'Wynne, almanac-keeper, Windle', byline: 'A Thistlewind almanac-keeper', to: 'My sister at the harbor, with the almanac', addressee: 'thessaly',
    date: '30 October, the Ebb winter',
    door: 'porch-thessaly', lightsPorch: 'porch-thessaly', heirloom: 'thessaly-almanac',
    creature: { species: 'wirewhisk', level: 19 },
    subject: 'An almanac with the comet\'s year circled.',
    reveal: [{ op: 'setFlag', id: 'th.second-chapter.almanac' }],
    body: 'To my sister at the harbor, with the almanac,|You asked for the long tables, so here is the whole almanac, the one with the coffee ring. I\'ve circled this year, and on the long tables the year thirty on. The wanderer comes back every thirty, the old pages say, and every time it does, the next chapter of somebody\'s life starts. Write yours down.|A whisker-spark has been sleeping in the binding since harvest and hums at the comet pages. It travels with the book. Feed it nothing; it eats static.|Your sister,|Wynne, Windle',
  }),
  f(14, {
    author: 'isolde', from: 'Isolde Petrel', to: 'Agnes Pell, at the shop', addressee: 'juniper', seal: 'petrel',
    date: '8 January, the Ebb winter',
    door: 'porch-pells',
    subject: 'The lantern will be on your counter.',
    reveal: [{ op: 'setFlag', id: 'th.heirlooms-going-home.counter' }],
    body: 'To Agnes Pell,|I\'m leaving my keeper\'s lantern on your counter tonight, wrapped in the blue cloth. Don\'t sell it, however good the offer. Don\'t give it to the harbor office. Don\'t give it to me if I come back asking; I won\'t deserve it yet.|Give it to whoever pays down the dark. You\'ll know them. They\'ll be the one carrying everybody else\'s things up the hill.|Put it on my slate. I\'m good for it eventually.|—Isolde',
  }),
  f(15, {
    from: 'The Penhallow quarry, Cairnhold', byline: 'A Cairnhold quarry family', to: 'The Harbor Warden', addressee: 'augusta',
    date: '4 January, the Ebb winter',
    door: 'porch-wardens-house',
    subject: 'Thanks for the warning that came too late.',
    reveal: [{ op: 'setFlag', id: 'np.augusta.quarry-thanks' }],
    body: 'To the Harbor Warden,|We had your warning the morning of the twenty-first, by the boy on the quarry road. Our Davey\'s boat was already out past the bar with the fleet, so it came too late to keep him in, but it reached him in time to tie everything down, and he says that\'s why the boat broke and he didn\'t.|Don\'t take it hard about the odds. Nobody reads a gale right in the dark.|The Penhallows, Knapp\'s End',
  }),
  f(16, {
    author: 'isolde', from: 'Isolde Petrel', to: 'The small Dorrow, cliff stair', addressee: 'wick', seal: 'petrel',
    date: '18 December, the Ebb winter',
    door: 'porch-dorrow',
    subject: 'There is no whale.',
    reveal: [{ op: 'setFlag', id: 'np.wick.no-whale' }],
    body: 'To the small Dorrow, the cliff stair,|Your mother tells me you asked her if the whale was all right.|There is no whale. I made it up, because you asked why the light was on and I didn\'t know how to say "so your father gets home" without it sounding like a worry.|So: the light is on so everyone gets home. That\'s the whole job. The whale was more fun, I know. You can keep the whale.|—The Keeper',
  }),
  f(17, {
    author: 'mabry', from: 'Mabry Coil', to: 'Hesper, from the day book', addressee: 'hesper', seal: 'day-book',
    date: '28 February, the year after',
    door: 'porch-post-office',
    subject: 'The sack sealed, the office closed.',
    reveal: [{ op: 'setFlag', id: 'np.hesper.order-is-a-kindness' }],
    body: 'To Hesper, from the day book, torn out for you,|The sack is sealed. Your half-round is on top, the Keeper\'s held letters under it in their own string, everything in order.|If you ever open the door again, deliver them the way we were taught: one at a time, to the right house, in the order they came. People can bear nearly anything one at a time. Order is a kindness.|The key is under the third stair. Don\'t cry on the stamps.|M. Coil',
  }),
  f(18, {
    author: 'isolde', from: 'Isolde Petrel', to: 'Whoever lives in the cottage now', addressee: 'player', seal: 'petrel',
    date: '9 January, the Ebb winter',
    door: 'porch-keepers-cottage',
    subject: 'The stove smokes; open the flue first.',
    reveal: [{ op: 'setFlag', id: 'np.wren.flue' }],
    body: 'To whoever lives in the cottage now,|The stove smokes. It always has. Open the flue first, all the way, count to ten, then light it, and it will behave like a gentleman.|The third step on the stair to the lamp is loose; step over it. The window over the bed sticks in wet weather; thump the left corner. The gulls are not your friends, however they look at you.|The view is worth all of it. Sleep well.|—I.',
  }),
];

export default FAMILY;
