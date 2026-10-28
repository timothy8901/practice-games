/**
 * Acts I-III after the first morning (GDD-00 §11 "Acts and triggers", "The rival arc"). [DATA-SCRIPTS]
 * GDD-07 §4-§6. Lowmoor and the rematch; the Raft and Tamsin; Act II's Cairnhold, Emberstep and the
 * first Lantern Market with Linnet's fall; Act III's drowning street, the Surge, Idris in the gallery,
 * Linnet's return, and "Two plans, one night"; the Lamp Room offer and the Lamp Room built.
 *
 * Staging rule (qa/HUMAN-PLAYTEST HP-008): a scene queued by a bus event can start on any map, so it
 * either establishes its map first (`warpTo`) or stages actors only inside `{map}` guards and
 * narrates otherwise. Teleports never run against another map's coordinates.
 *
 * Optional battles stay declinable (`source: 'rival'` with a default "come back" option); story
 * battles continue on any result. Pure data.
 * @module data/scripts/story-isles
 */
import { tp, warpTo, cam, camHome, face, emote, flag, porch, wait, sfx, music, toast, call, label, go, END, byDial } from './_stage.js';

const P = 'pellwick';
const LS = 'lantern-stack';
const ON_P = { map: P };
/** Linnet is about: she never fell, or she has come home. */
const LINNET_HOME = { any: [{ not: { flag: 'sp.linnet-fell' } }, { flag: 'sp.linnet-returned' }] };
/** Two plans' second pair of paws: Linnet if she is about, else Tamsin, else Maud. */
const companion = (who) => ({ op: 'if', cond: LINNET_HOME, then: who.linnet, else: [
  { op: 'if', cond: { flag: 'sp.tamsin-arrived' }, then: who.tamsin, else: who.maud },
] });

export default {
  // ---------------------------------------------------------------------------------------------
  // day 2: Linnet declines (the Decline lesson); also her daily topic until badge 1
  // ---------------------------------------------------------------------------------------------
  'linnet-decline': [
    { op: 'if', cond: { flag: 'sp.linnet-declined' }, then: [
      'Linnet: Still no. ~ Badge. Goose. Spire. In that order.',
      go('out'),
    ] },
    { op: 'if', cond: { map: 'lowmoor' }, then: [
      tp('linnet', 'lowmoor', 'linnet-decline'),
      face('linnet', 'player'),
      '* Linnet is sitting on her rematch stones with Cinder the Caldermaw lying behind her like a warm cliff. She sees you coming and holds up a paw, palm out.',
    ], else: ['* Linnet sees you coming and holds up a paw, palm out.'] },
    'Linnet: No. ~ No badge, no rematch. I said.',
    'Linnet: That\'s a Decline. You can do it too, to anyone who isn\'t a leader or a story or me. They offer, you say no, nobody loses anything but the buttons you didn\'t win. It\'s in the rules. I read them. Twice.',
    { op: 'choice', options: [
      { text: 'Afraid I\'ll win?', then: ['Linnet: Afraid you\'ll LOSE and Cinder will feel bad. ~ He\'s sensitive. He\'s a volcano and he\'s sensitive.'] },
      { text: 'Fair enough.', then: ['Linnet: It IS fair. That\'s why I said it. ~ The goose is in her Spire. Go and get feathered.'] },
    ] },
    flag('sp.linnet-declined'),
    // FE-11: "right here, on my stones" only fits at the Brackenford stones
    { op: 'if', cond: { map: 'lowmoor' },
      then: ['Linnet: I\'ll be right here. On my stones. Being patient. ~ I\'m very good at being patient. I\'ve been practising since yesterday.'],
      else: ['Linnet: I\'ll be on my stones at Brackenford. Being patient. ~ I\'m very good at being patient. I\'ve been practising since yesterday.'] },
    label('out'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Brackenford: Maud's practice table (Reroll, no clock)
  // ---------------------------------------------------------------------------------------------
  'maud-practice-table': [
    { op: 'if', cond: { map: 'lowmoor' }, then: [tp('maud', 'lowmoor', 'maud-practice-table'), face('maud', 'player')] },
    '* Under the old ferry pavilion, Maud has set up a card table with a slate on it, three cards face down, and a saucer of grey salt.',
    'Maud: Practice table. No creature on it, no clock on it, nothing to lose on it. Odds on every card, no money on any of them. ~ Sit.',
    'Maud: Here\'s a Bilgebob with its window open. My Bilgebob, in a minute, in my Spire.',
    '* She turns the cards. UP: Brinelance. SIDE: Rushling. DOWN: Puddlepip.',
    byDial({
      drift: ['Maud: Your dial\'s gentle. Fifty up, forty side, ten down. Before Bond.'],
      flux: ['Maud: Your dial\'s the middle one. Forty up, thirty-five side, twenty-five down. Before Bond.'],
      freefall: ['Maud: You picked wild. Thirty up, thirty side, forty down. And the faces are flat on your dial; anything in the pool can come.'],
    }),
    'Maud: Three choices. Accept: let it land. Anchor: one stone, refuse this window, keep what you\'ve got. Reroll: a pinch of Starsalt, the cards go round again. One pinch, then two, then four, then eight. Same window, the price doubles.',
    label('table'),
    { op: 'choice', prompt: 'Maud: Your move. Confirm when you\'ve chosen.', options: [
      { text: 'Reroll.', then: [
        sfx('shiftFlip'),
        '* Maud pinches salt over the cards. They turn over, slide, and turn back. UP: Brinelance. SIDE: Puddlepip. DOWN: Puddlepip.',
        'Maud: Different faces, same odds. Reroll redraws what\'s on the cards, never the chance of each card. It does not promise Up. ~ That\'s what the Scatter forgets. Again?',
        go('table'),
      ] },
      { text: 'Anchor.', then: [
        '* She sets a small grey stone on the slate. The cards go still.',
        'Maud: Anchored. That window\'s spent. It\'ll open again at the next one, later, higher. ~ That\'s what the Mooring forgets. It\'s a pause, not a cure.',
        go('table'),
      ] },
      { text: 'Accept.', then: [
        '* She turns the up card face down, then the others, and slides them off the slate.',
        'Maud: Accepted. ~ Whatever it lands as, it\'s still yours. Same mark. Same name. Same Bond. That\'s the bit that matters, and it\'s the bit nobody can roll.',
      ] },
    ] },
    flag('sp.reroll-taught'),
    'Maud: The salt\'s yours to spend once you\'ve a seal. Not before; Hollis\'s rule, not mine. Till then, the table is free. Same lesson, no chance of a bill. ~ Spire\'s up the meadow.',
    'Maud: Confirm?',
    { op: 'choice', options: [{ text: 'Confirmed.' }, { text: '…' }] },
    'Maud: Good. I like a yes I can hear.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // after badge 1: the Brackenford rematch (trainer linnet-brackenford; declinable)
  // ---------------------------------------------------------------------------------------------
  'linnet-brackenford-before': [
    { op: 'if', cond: { not: { badge: 1 } }, then: [call('linnet-decline'), go('done')] },
    { op: 'if', cond: { map: 'lowmoor' }, then: [tp('linnet', 'lowmoor', 'linnet-rematch-stones'), face('linnet', 'player')] },
    emote('linnet', '!'),
    { op: 'if', cond: { flag: 'np.linnet.rematch-offered' },
      then: ['Linnet: Again? Good. I like again. Again is my favourite.'],
      else: [
        'Linnet: Feathered! ~ You got feathered. Let me see. ~ Huh. It\'s just wax. It looked bigger on Maud.',
        'Linnet: Right. Badge, then. Fine. Cinder hasn\'t lost since the dock. The other two are warming up. They\'re always warming up.',
        flag('np.linnet.rematch-offered'),
      ] },
    { op: 'choice', defaultIndex: 1, options: [
      { text: 'Ready.', then: [{ op: 'startBattle', trainer: 'linnet-brackenford', source: 'rival' }] },
      { text: 'I will come back.', then: ['Linnet: I\'ll be very casually waiting. Here. Where I happen to be.'] },
    ] },
    label('done'),
    END,
  ],

  'linnet-brackenford-after': [
    '* Cinder lies down on the stones with a sound like a kiln door closing. Linnet stands very still, then sits down next to him.',
    'Linnet: You beat Cinder. ~ You beat CINDER.',
    'Linnet: Everything went through him. I let everything go through him, because he\'s big and he\'s mine and the others are… warming up. ~ They\'ve been warming up for a week.',
    { op: 'choice', options: [
      { text: 'Train the other two.', then: ['Linnet: Bench a volcano? ~ …Fine. Noted. Ignored, probably, but noted.'] },
      { text: 'He\'s still magnificent.', then: ['Linnet: He IS. ~ Thanks. Don\'t tell anyone I said thanks.'] },
    ] },
    flag('sp.linnet-rematch'),
    'Linnet: First steps. Mine too, apparently. ~ See you at the market. I\'m going to show the whole town what Cinder can do. The whole town.',
    toast('First Steps'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // day 3: the Carnival Raft docks at the Old Pier
  // ---------------------------------------------------------------------------------------------
  'raft-docks': [
    sfx('bell'),
    { op: 'if', cond: ON_P, then: [
      '* A sound nobody in Pellwick has heard in years: three notes of a steam organ out on the water, and a horn that is not Maud\'s.',
      cam(P, 'raft-berth', 1200),
      '* A raft as wide as a house has moored at the end of the Old Pier: flags, cages, a striped awning, a carefully lettered price board, a sign in gold that needs repainting. TEO VARGA\'S CARNIVAL RAFT. STARSALT. REFINING. SHIFT FAIRS.',
      tp('varga', P, 'varga-raft'),
      'Varga: Good morning, Pellwick! ~ I know, I know. Nobody asked. Nobody ever asks.',
      'Varga: Teo Varga, late of the Mooring, now of the Scatter, always of the sea. Starsalt, three a day, eight hundred a pinch. Skyglass relics refined, one to one. And Shift fairs, where we watch the cards together and nobody hides the odds.',
      'Varga: Noon till two in the morning. Come and argue with me. Everybody does.',
      '* Augusta is already on the pier with her chalk.',
      'Augusta: You will post the odds before you take a button.',
      'Varga: I brought extra chalk.',
      camHome(800),
    ], else: [
      '* Word travels the way it does on this coast, by gull and by Wick: a raft as wide as a house has moored at the end of Pellwick\'s Old Pier. Flags, cages, a striped awning, and a sign in gold that needs repainting: TEO VARGA\'S CARNIVAL RAFT. STARSALT. REFINING. SHIFT FAIRS.',
      '* Noon till two in the morning, says the price board. Starsalt, three a day. Odds posted. Very moderate shouting.',
    ] },
    flag('sp.raft-docked'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the Commons funds dark house 1: Tamsin moves in
  // ---------------------------------------------------------------------------------------------
  'tamsin-arrives': [
    porch('porch-dark-1', true),
    { op: 'if', cond: ON_P, then: [
      tp('tamsin', P, 'tamsin-porch'),
      sfx('doorOpen'),
      '* Dark house 1 has its shutters open. The porch lamp is lit for the first time since anyone can remember, and a badger is sitting under it on an upturned crate, eating an apple, core and all. A digging shovel leans on the rail.',
      'Tamsin: You\'re the Keeper. ~ Wick told me. Wick tells everyone everything. Tamsin Brack.',
      'Tamsin: The Commons Jar paid my roof. I didn\'t ask it to. I\'d have slept in the creek. ~ Thank you. I\'m bad at that word. I\'ll get better.',
      'Tamsin: Gran\'s boat is in the north creek. The Bracks\' oyster boat. It\'s been there thirty years with no name on it. ~ I\'m going to find out why.',
      { op: 'choice', options: [
        { text: 'I\'ll help.', then: ['Tamsin: I didn\'t ask. ~ …Low tide, the point flats. Bring a shovel. Last one to a sparkle owes the other a cockle.'] },
        { text: 'Welcome home.', then: ['Tamsin: Home. ~ Huh. Yeah. All right.'] },
      ] },
    ], else: [
      '* Back in Pellwick, a badger walks the causeway at dusk with a digging shovel and a parcel wrapped in sailcloth. She stops at the first dark house and wipes its number with her sleeve.',
      '* The key fits. The porch lamp takes two attempts. She leaves it burning. Tamsin Brack has come home to a house the Commons Jar paid for.',
    ] },
    flag('sp.tamsin-arrived'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Act II, The Odds: badge 1 or day 4
  // ---------------------------------------------------------------------------------------------
  'act-2-open': [
    music('title', 600),
    toast('II — The Odds'),
    { op: 'if', cond: ON_P, then: [
      '* On the Commons board this morning, under the weather odds, Augusta has chalked a new line in her square capitals: COMET — VISIBLE AFTER DARK — SOUTH-EAST.',
      tp('augusta', P, 'augusta-commons-board'),
      'Augusta: Thirty years, and it\'s back in the sky. Odds of it doing something interesting: I don\'t post odds on comets. ~ I post odds on rain. Rain has the decency to be likely.',
      'Augusta: Cairnhold\'s the next isle round. The Mooring runs the clinic there. They\'ll sell you stones and licence your creatures and give you a leaflet about light. ~ Read the leaflet. Then read the creatures.',
    ], else: [
      '* Somewhere behind you, Augusta is chalking a new line on the Commons board in her square capitals: COMET — VISIBLE AFTER DARK — SOUTH-EAST.',
    ] },
    '* The ring of isles lies beyond Lowmoor. Every long road stays dry; every short road has a tide written beside it. A badge is a tool, not a permit to walk: you could have walked the whole ring yesterday.',
    music(null),
    flag('sp.act-2'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Cairnhold: Merrow at the memorial to the Night of Wrong Shapes
  // ---------------------------------------------------------------------------------------------
  'cairnhold-memorial': [
    { op: 'if', cond: { map: 'cairnhold' }, then: [
      tp('merrow', 'cairnhold', 'merrow-memorial'),
      tp('quill-hartsease', 'cairnhold', 'quill-memorial'),
      cam('cairnhold', 'cairnhold-memorial', 700),
    ] },
    '* A plain granite slab above the quarry path, carved with names. Not people\'s names. Creatures\': Bess, Old Tom, Whistle, Grace, Plenty, Mab. Dozens of them, each with a small four-point mark cut beside it.',
    'Quill Hartsease: The Night of Wrong Shapes. ~ Every draft creature in the harbor Shifted in its harness, halfway home. Most of them lived. Some came back as something that didn\'t know its own name. These are those.',
    face('merrow', 'player'),
    '* A cormorant in a grey coat with a Mooring pin at the collar stands at the end of the slab, very upright, a clipboard under one wing.',
    'Merrow: Provost Agathe Merrow. ~ I was the harbor nurse that night. I had fourteen patients in my ward. By morning I had fourteen strangers.',
    'Merrow: They drink light, Keeper. Skyglass creatures. Prismoths crowd every lamp on this coast. The night the lamp burned brightest, they changed. ~ Light calls the change. I built the Mooring on that, and I have not been wrong once in thirty years.',
    { op: 'choice', options: [
      { text: 'Or the comet called it.', then: ['Merrow: The comet was the cause. The lamp was the call. ~ You have a creature with a lit mark and a Glass in your pocket. You will learn the difference, or you will learn to wish you had.'] },
      { text: 'I\'m sorry about your patients.', then: ['Merrow: …So am I. Every day. ~ That is what the Mooring is for. So that nobody else has to be.'] },
      { text: '(Read the names in silence.)', then: ['* You read them all. Merrow waits until you have finished, and you realise she has read them every day for thirty years and never once been finished.'] },
    ] },
    camHome(500),
    flag('sp.memorial-seen'),
    'Merrow: The clinic is at the gate. Stones are five hundred. A licence is free. ~ Use both.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Cairnhold: the Mooring clinic turns away a fisher who cannot pay
  // ---------------------------------------------------------------------------------------------
  'anchorage-turns-away': [
    { op: 'if', cond: { map: 'cairnhold' }, then: [
      tp('wynn-cobble', 'cairnhold', 'wynn-clinic'),
      tp('mags-penny', 'cairnhold', 'mags-dock'),
    ] },
    '* At the clinic counter a herring gull in oilskins is holding a Bilgebob on a rope. Its mark is glowing, steady, bright: a window open. A folded Forecast lies on the counter beside a price card.',
    'Mags Penny: Five hundred. ~ It\'s five hundred for the stone, and I\'ve got one hundred and twelve, and the boat\'s my winter.',
    'Wynn Cobble: I know, Mags. ~ I don\'t set the price. The Provost sets the price. The licence pays for the stones and the clinic. No stone, no Anchor. I can give you a licence. Licences are free.',
    'Mags Penny: A licence for what? To watch it change? My creature does not know what a licence is. ~ It hauls my nets. If it comes back as something that can\'t pull, I\'ve no winter.',
    face('mags-penny', 'player'),
    { op: 'choice', prompt: 'Mags looks at the Glass in your apron.', options: [
      { text: 'Buy her the stone. (500)', cond: { wallet: { gte: 500 } }, then: [
        { op: 'spend', amount: 500 },
        '* You put five hundred on the counter. Wynn looks at it, then at the Provost\'s notice on the wall, then counts it very slowly and slides a grey stone across to Mags.',
        'Mags Penny: …I don\'t take charity. ~ I\'ll take that. I\'ll pay you back in herring. A lot of herring.',
        flag('np.mags-penny.helped', 'stone'),
      ] },
      { text: 'Read it for her first.', then: [
        '* Through the Glass the Bilgebob\'s three cards stand over it. UP: Brinelance, a long pale swimmer with a lance of a jaw. SIDE: Rushling. DOWN: Puddlepip, smaller, quicker. Every card can still haul a net.',
        'Mags Penny: All three can pull? ~ You\'re sure? You\'d say if one couldn\'t?',
        'Mags Penny: Then let it come. ~ If it\'s going to change, I want to see what it changes into. I\'ve watched that rope thirty years.',
        flag('np.mags-penny.helped', 'read'),
      ] },
      { text: '(Say nothing.)', then: [
        '* You say nothing. Mags folds the Forecast smaller, ties the rope tighter, nods to Wynn as if nothing happened, and walks back to her boat with the Bilgebob glowing behind her. She leaves carrying the same question she came with.',
        flag('np.mags-penny.helped', 'none'),
      ] },
    ] },
    'Wynn Cobble: She\'ll be all right. They usually are. ~ It\'s the usually that the Provost can\'t sleep for.',
    flag('sp.anchorage-seen'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Emberstep: lightning walking on the sea — the first Errant
  // ---------------------------------------------------------------------------------------------
  'first-errant-sighting': [
    { op: 'if', cond: { map: 'emberstep' }, then: [tp('gorse-abernethy', 'emberstep', 'errant-sighting'), cam('emberstep', 'errant-sighting')] },
    sfx('thunder'),
    '* From the crater lookout the whole lagoon is laid out below. Out over the water, a fork of lightning comes down and does not go away. It walks. It turns, and walks back, like a knot of living weather.',
    'Gorse Abernethy: That\'s not weather. ~ That\'s a creature.',
    'Gorse Abernethy: Squallcoil. An Errant. The old ones say the comet dropped two kinds that never settled, and they\'ve been running round the isles ever since. One route an hour. Never the same one twice running.',
    'Gorse Abernethy: Catch one or beat one and the isles pay you for it: two Starsalt and fifteen hundred, the spa pays, the clinic pays, everybody pays to have it quiet a night. ~ And it\'s back the next day. They always come back. No creature is lost because you missed one evening.',
    'Gorse Abernethy: Mind the steam on the way down. ~ And bring a better wick than tallow, against that.',
    camHome(),
    flag('sp.errant-seen'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the first Lantern Market (Saturday, day 7 on): stalls, Dov's crate, Varga's Shift fair
  // ---------------------------------------------------------------------------------------------
  'first-lantern-market': [
    music('lantern_market', 800),
    { op: 'if', cond: { not: ON_P }, then: [warpTo(P, 'market-green', 'up')] },
    cam(P, 'market-green', 900),
    '* Saturday. The green is strung with lights from the Commons board to the post office eave and down the length of the Old Pier, and under them the whole town is out: stalls, lanterns, a fiddle somewhere. For once the whole green is warm.',
    tp('ludo', P, 'market-stall-1'),
    'Ludo: Seedlings! Peach, fig, apricot, mulberry. One a week. Grow them in a Greenhouse, or a pot, or your hat. ~ Don\'t grow them in your hat.',
    tp('augusta', P, 'market-green'),
    'Augusta: First market of the season. Prices and odds where everyone can see them. That includes you, Dov. ~ Odds of Tully winning the lantern toss: nil, but he\'ll try. Spring low under the pier tonight. Mind your boots.',
    camHome(600),
    flag('sp.first-market'),
    flag('sys.lantern-market'),
    toast('Market Night'),
    call('dov-auction'),
    call('varga-hires-you'),
    { op: 'if', cond: { all: [{ badge: 2 }, { not: { flag: 'sp.linnet-fell' } }] }, then: [call('linnet-fall')] },
    music(null),
    END,
  ],

  // every later market night: the string lights and stalls go up at 20:00 Saturday and come down
  // after 02:00 (triggers.js market-lights rows; LG-CH61). The first market lights them itself.
  'market-lights-on': [
    flag('sys.lantern-market'),
    toast('Market Night'),
    END,
  ],
  'market-lights-off': [
    { op: 'setFlag', id: 'sys.lantern-market', value: false },
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Dov's sealed crate: the first market's crate, then a weekly lot (Dov's market topic)
  // ---------------------------------------------------------------------------------------------
  'dov-auction': [
    { op: 'if', cond: { flag: 'np.dov.first-crate' }, then: [
      'Dov: Sealed crate. One reusable technique disc. Contents listed before the bid: Gnash. Two thousand buttons. No bid is the first option for excellent reasons.',
      { op: 'choice', defaultIndex: 0, options: [
        { text: 'No bid.', then: ['Dov: A fine bid. Yours, to keep.'] },
        { text: 'Buy Gnash — 2,000 buttons.', cond: { wallet: { gte: 2000 } }, then: [{ op: 'spend', amount: 2000 }, { op: 'give', item: 'disc-gnash' }, 'Dov: Sold. The disc is yours forever. Teach as often as you like.'] },
      ] },
      go('out'),
    ] },
    { op: 'if', cond: ON_P, then: [tp('dov', P, 'dov-stall'), face('dov', 'player')] },
    '* On a crate stage by the Raft, a kinkajou in a waistcoat with too many pockets bangs a gavel on a sealed crate the size of a bread bin.',
    'Dov: Ladies, gentlemen, gulls! A sealed crate off a wreck on the Bar. Inside: one technique disc. Contents beautifully lettered on the lid, and the lid is tarred shut. ~ Suspense is free. The disc isn\'t.',
    'Dov: I can tell you it\'s not a staple. I can tell you it rattles in a confident way. Bidding opens at fifteen hundred.',
    'Juniper: Eighteen hundred. ~ On principle. If it\'s any good it\'s going on my shelf.',
    { op: 'choice', prompt: 'Dov: Eighteen hundred to the magpie! Do I hear two?', defaultIndex: 1, options: [
      { text: 'Two thousand.', cond: { wallet: { gte: 2000 } }, then: [
        'Juniper: …Fine. I know when I\'m outbid. I\'m outbid about twice a decade.',
        { op: 'spend', amount: 2000 },
        sfx('crack'),
        '* Dov levers the lid off with a flourish. Inside, in straw, a disc in a brass sleeve: STAND FIRM.',
        { op: 'give', item: 'disc-stand-firm', n: 1 },
        'Dov: Stand Firm! Plant your feet and take it! A disc for the patient! ~ Sold to the Keeper, who looked patient.',
      ] },
      { text: 'Let Juniper have it.', then: [
        'Dov: Going once, going twice… sold to the magpie, on principle!',
        '* Juniper prises it open on the spot. STAND FIRM. She looks pleased with herself for a full minute.',
        'Juniper: It\'ll be on the market shelf in the morning, at a fair price. A fair price for me.',
      ] },
    ] },
    flag('np.dov.first-crate'),
    label('out'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the first market: Varga hires you to call odds at the Shift fair
  // ---------------------------------------------------------------------------------------------
  'varga-hires-you': [
    { op: 'if', cond: ON_P, then: [tp('varga', P, 'shift-fair'), face('varga', 'player')] },
    '* At the end of the green, Varga has a small stage built of crates, a crowd in front of it, and three creatures in front of him with their marks glowing.',
    'Varga: Keeper! Just the eyes I wanted. ~ This is a Shift fair. Three windows, open tonight, in front of everybody. No anchors, no secrets. I can shout a number; a reader makes people believe somebody checked it. Call the cards out loud for the folk at the back?',
    { op: 'choice', defaultIndex: 2, options: [
      { text: 'I will read exactly what is there.', then: [go('call')] },
      { text: 'Why in public?', then: [
        'Varga: Because the Mooring does it in a clinic with the door shut and a form to sign. ~ I want the harbor to see the odds. Odds you can see are odds you can live with.',
        go('call'),
      ] },
      { text: 'I will watch.', then: ['Varga: Watching is the first half. You can take the other half whenever you like.', go('out')] },
    ] },
    label('call'),
    '* You lift the Glass. One by one you read the strips aloud: a Tossup, sideways to a Mudfist, three in ten. A Rayling, up to a Vesperay, four in ten. A Puddlepip, up to a Sloshkin, most likely of all. Nobody cheers until you have finished.',
    sfx('shiftReveal'),
    '* They land: the Tossup a Mudfist, the Rayling a Vesperay with a tail like a ribbon, the Puddlepip a Sloshkin that sneezes. The crowd cheers each one as if it were a goal.',
    'Varga: You see? They\'re still theirs. Every one. Same mark. ~ That\'s all I ever wanted anyone to see.',
    'Varga: Exactly right. Five hundred for the work. Reading is work. ~ Come back any market. There\'s always a window open somewhere.',
    { op: 'earn', amount: 500 },
    flag('sp.varga-hired'),
    label('out'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the first market on or after badge 2: Linnet's fall at the Shift fair
  // ---------------------------------------------------------------------------------------------
  'linnet-fall': [
    { op: 'if', cond: { not: ON_P }, then: [warpTo(P, 'market-green', 'up')] },
    tp('linnet', P, 'shift-fair', 1, 0),
    tp('merrow', P, 'market-stall-3'),
    tp('varga', P, 'shift-fair', -1, 0),
    '* Linnet climbs up onto Varga\'s crates without being asked. Cinder the Caldermaw lumbers up after her and fills the whole platform, and the stage creaks.',
    'Linnet: Everybody! ~ EVERYBODY. This is Cinder. He\'s a Caldermaw. He was a Sootling a week ago and now look at him.',
    '* Cinder\'s mark is glowing. Brighter than it should. A window, open, in front of the whole town.',
    'Linnet: He\'s got a window. Watch! He\'ll go up again! He always goes up! He has been big for weeks. He cannot just—',
    '* Through the Glass you see the strip before anyone else does. UP: Hulkwight or Floeback. SIDE: Cragmitt, Bogmonarch. DOWN: Emberjaw, or Sootling.',
    byDial({
      drift: ['* The down card is one in ten. Small. Not nothing.'],
      flux: ['* The down card is one in four. A real card. A card you could draw.'],
      freefall: ['* The down card is the biggest of the three. Four in ten.'],
    }),
    face('merrow', 'player'),
    'Merrow: Miss Rask. ~ A stone. Now. Before it lands. The Mooring will not charge you.',
    'Varga: Or salt! Redraw it, Linnet, I\'ll stand you the pinch, the down card might not even be on the next draw —',
    'Linnet: NO. ~ Both of you. No. He\'s MINE. It\'s his roll. Nobody touches his cards.',
    { op: 'choice', prompt: 'Linnet looks at you. Just for a second.', options: [
      { text: '"Read it first, Linnet."', then: ['Linnet: I don\'t need to read it. I know him. ~ Go on, Cinder.'] },
      { text: '"It\'s your call."', then: ['Linnet: It is. ~ Go on, Cinder.'] },
      { text: '(Say nothing.)', then: ['* You say nothing. She turns back to Cinder.'] },
    ] },
    sfx('shiftFlip'),
    wait(600),
    sfx('shiftReveal'),
    '* The cards turn. The down card lands. Cinder shrinks, and shrinks, the hill folding down into a coal-black Sootling no bigger than a kettle, steaming on the crates. The heat goes out of the boards.',
    '* The whole green goes quiet. Somebody laughs, once, and stops.',
    emote('linnet', '…'),
    '* The Sootling climbs up Linnet\'s leg and onto her shoulder, where it used to sit before it was a mountain. Its mark is in the same place. It always is.',
    'Linnet: …Same mark. ~ Right. Yes. Same mark. Cinder. In my coat. Come on.',
    '* She gets down off the stage. She doesn\'t look at anyone. She walks to the quay and straight onto Maud\'s punt, and pays exact change.',
    tp('maud', P, 'linnet-ferry-leaves'),
    'Maud: Where to? ~ Anywhere. All right. Confirm?',
    'Linnet: Confirm.',
    { op: 'despawn', who: 'linnet' },
    { op: 'despawn', who: 'maud' },
    porch('porch-linnet', false),
    flag('sp.linnet-fell'),
    cam(P, 'porch-linnet-step', 1000),
    '* Next door to your cottage, Linnet\'s porch lamp goes out. On the green, Augusta rubs out the porch count on the Commons board and chalks it again, one smaller, and stands looking at it.',
    camHome(800),
    'Merrow: …I would have given her the stone for nothing. ~ I would have given anybody the stone for nothing tonight.',
    'Varga: And I\'d have given her the salt. ~ She didn\'t want either of us. She wanted it to go UP.',
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Act III, The Surge: badge 3 or loan 4 — the comet brightens
  // ---------------------------------------------------------------------------------------------
  'comet-brightens': [
    music('title', 600),
    toast('III — The Surge'),
    '* The comet is not a smudge any more. It has a tail, and a sharp edge. It lies across the south-east like a scratch on glass, and every mark in the harbor, wild or bonded, glows a little whenever it clears a cloud. The hum under the mud reaches the windows before the wind does.',
    { op: 'if', cond: ON_P, then: [
      tp('corin', P, 'point-skywatch'),
      'Corin: Can you see it? ~ I can\'t. I can feel the Glass warm in my pocket when I face it. That is how I know where it is.',
      'Corin: She wrote that it would come back. Low and slow, looking for a light. ~ The Mooring is printing more licences. Varga is buying every relic on the flats. Both of them are frightened, and both of them are doing something about it.',
      'Corin: The rest of us are going to have to read faster.',
    ], else: [
      '* Back home, Augusta will have the board changed by morning. That is why she keeps one: read tomorrow before you pack for it.',
    ] },
    music(null),
    flag('sp.act-3'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Drownwood at low tide: the drowning street and the Scatter volunteers
  // ---------------------------------------------------------------------------------------------
  'drowning-street': [
    { op: 'if', cond: { map: 'drownwood' }, then: [
      tp('teal-fenner', 'drownwood', 'teal-drowning-street'),
      tp('varga', 'drownwood', 'varga-drowning-street'),
      cam('drownwood', 'drowning-street', 800),
    ] },
    '* Low tide, and a street comes out of the water: cobbles, doorsteps, window boxes full of weed. People lived here. At high tide it is two fathoms down.',
    'Teal Fenner: Mind the step. It\'s my step. ~ Teal Fenner. I pole the stilt-town now. I was six when this was my street.',
    'Teal Fenner: When the tide came in that winter it came in like a wall. The only creatures that brought anybody out were the ones that had Shifted into something with gills. ~ Mine had. It had been a Rustcreel. It came back a swimmer, and it swam me home. New gills. New hands. Those were the hands that pulled us out.',
    face('varga', 'player'),
    'Varga: And that is the Scatter, Keeper, in one sentence. ~ Only Shifted swimmers came home from the drowning tides. Merrow remembers the traces breaking. I remember who could still swim. Both happened.',
    '* Along the street, Scatter volunteers in orange scarves are carrying benches out of a house that has no dry floor and checking the old cellars before the tide turns, each with a Shifted swimmer on a long line.',
    camHome(600),
    flag('sp.drowning-street'),
    call('anchor-pulse-misfire'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the Mooring's Anchor Pulse misfires
  // ---------------------------------------------------------------------------------------------
  'anchor-pulse-misfire': [
    { op: 'if', cond: { map: 'drownwood' }, then: [
      tp('merrow', 'drownwood', 'merrow-anchor-pulse'),
      cam('drownwood', 'anchor-pulse', 700),
    ] },
    '* On an iron post at the head of the street, someone from the Mooring has bolted a granite drum the size of a barrel, wired to a dial. Merrow stands beside it with a clipboard.',
    'Merrow: The Anchor Pulse. One turn of the dial and every mark within a hundred yards holds still. No Shifts. Nobody comes back a stranger. ~ We test it at low water, when the street is empty.',
    'Teal Fenner: It isn\'t empty! Provost, the volunteers are still in the cellars —',
    sfx('thunder'),
    { op: 'camera', to: 'player', ms: 120, shake: 2 },
    '* The drum thrums. A grey wave of nothing rolls down the street, and every glowing mark in it goes dull at once.',
    '* In the water at the street\'s end, a volunteer\'s swimmer seizes in the current. It is still a swimmer. It simply cannot move like one: the Pulse has locked its mark, and its mark was what was swimming.',
    { op: 'choice', prompt: 'The volunteer is going under with it.', options: [
      { text: 'Grab the line.', then: ['* You and Teal grab the line together and haul. The swimmer comes up the steps like a sack of wet sand, coughing, the volunteer hanging on to its neck.'] },
      { text: 'Shout for Merrow to stop it.', then: ['* "STOP IT!" Merrow is already turning the dial back. You and Teal haul the line while it spins down, and the swimmer comes up the steps coughing.'] },
    ] },
    sfx('blocked'),
    '* The drum winds down. The marks in the street flicker back, one by one. Nobody drowned. It was close enough to count.',
    face('merrow', 'player'),
    'Merrow: …It was meant to stop a Shift. ~ Not a swimmer.',
    'Varga: It stopped a swimmer, Agathe. It stopped everything. That\'s what still means.',
    'Merrow: I know what still means, Teo. I have known for thirty years. ~ Nobody runs that again. The stone in a hand is one choice. A street cannot hold a hand. Wynn will have the drum off that post by the next tide.',
    camHome(600),
    flag('sp.pulse-stopped'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // the Surge: first night on Thistlewind after badge 4, or day 10
  // ---------------------------------------------------------------------------------------------
  'the-surge': [
    { op: 'if', cond: { map: 'thistlewind' }, then: [
      tp('rook-hayward', 'thistlewind', 'rook-surge'),
      cam('thistlewind', 'surge-street', 900),
      sfx('shiftReveal'),
      '* Night on Weft Lane, under the windmills. Every mark on the street is glowing at once: in kennels, on rooftops, in the reeds of the mill-race. The comet is low over the moor, and the whole lane is humming with it.',
      'Rook Hayward: It started an hour ago. ~ My Skirl first. Then the Tullochs\' old Mudfist, then the Gillwicks in the race. Every window on the lane, open, together. I\'ve been a miller forty years. I\'ve never seen a whole street of windows.',
      '* Through the Glass, a dozen strips hang over a dozen creatures, one after another, odds on every card. Some leaning up, some down. Nobody has a stone. Nobody has salt. Nobody has time.',
      { op: 'choice', prompt: 'Rook is looking at your Glass.', options: [
        { text: 'Read every strip aloud.', then: [
          '* You go down the lane reading cards out loud, door to door, so that every owner hears what is coming before it comes. Up. Side. Down. Odds, every time.',
          'Rook Hayward: They know. ~ That\'s the thing. They know what\'s coming, and they can hold their creatures while it does.',
        ] },
        { text: 'Help the owners hold on.', then: [
          '* You go from step to step with a paw on each creature\'s back while the cards turn. Every one lands. Every one of them is still somebody\'s.',
          'Rook Hayward: You held my Skirl. ~ It\'s a Duskowl now. It knew my whistle the second it landed.',
        ] },
      ] },
      '* By midnight the lane is quiet. Twenty creatures on Weft Lane Shifted in one night. Every collar lies open, and people are fitting the harnesses to the creatures that came home. Every mark is in the same place it was.',
      'Rook Hayward: Unhook first. Name them after. They still know us.',
      camHome(700),
    ], else: [
      { op: 'if', cond: ON_P, then: [
        tp('maud', P, 'maud-berth'),
        '* On the quay, Maud\'s punt comes in early with a passenger\'s worth of news and no passenger.',
      ], else: ['* Maud\'s punt comes in early with a passenger\'s worth of news and no passenger.'] },
      'Maud: Thistlewind. Weft Lane, in Windle. Every creature on the street Shifted in the night. All at once. ~ Rook Hayward says nobody was hurt. He says nobody could read fast enough, either.',
      'Maud: The Mooring\'s sending stones. The Scatter\'s sending a raft. Rook says what he wants is somebody with a Glass. ~ Ferry\'s there when you want it. Confirm?',
      { op: 'choice', options: [{ text: 'Confirmed.' }, { text: 'Later.' }] },
      'Maud: I\'ll take that as a yes for later. ~ A read Shift is a Shift survived. Not a Shift stopped. Corin says that. I say it slower.',
    ] },
    flag('sp.surge'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Idris in the gallery (Rimeholt's gallery, or above the Mirror Spire's hall)
  // ---------------------------------------------------------------------------------------------
  'idris-gallery': [
    { op: 'if', cond: { map: 'spire-mirror' }, then: [
      cam('spire-mirror', 'idris-gallery', 900),
      '* High on a gallery above the Spire\'s hall, behind a rail of clear ice, a great northern diver sits very still. Beside him a Vesperay rests its long tail across his feet. A silver ring gleams on the tail.',
    ], else: [
      { op: 'if', cond: { map: 'rimeholt' }, then: [tp('idris', 'rimeholt', 'idris-gallery'), cam('rimeholt', 'idris-gallery', 900)] },
      '* In the gallery of mirror ice, a great northern diver watches a Vesperay in the glass. Beside him the real one rests its long tail across his feet. A silver ring gleams on the tail, pressed into the feathers above its mark.',
    ] },
    'Idris: Don\'t mind me. ~ I come to watch the challengers who get this far. Seraphine was my student once. She is a far better teacher than I was.',
    'Idris: Idris Fenwake. I keep the Summit. I set the Spire tests, so the isles could learn to read. ~ I never sat one.',
    'Idris: The ring is a Still Knot. My Vesperay has worn it since the day it hatched. My first partner Shifted Hollow on the Night of Wrong Shapes and never knew my name again, and I swore nothing of mine would ever change. ~ Thirty years. Same shape, same move, same answers. I called it care because I was afraid to call it fear.',
    { op: 'choice', options: [
      { text: 'Has it ever had a window?', then: ['Idris: Nine. ~ I have counted every one, and spent every one, unused. I could tell you the dates.'] },
      { text: 'It still knows your name.', then: ['Idris: It does. ~ It has never had the chance not to. That is the difference between us, I think. You give yours the chance.'] },
    ] },
    'Idris: Six badges for the Summit. No debt paid first. No lamp lit first. Come when you have a question worth bringing. ~ I will be at the Summit. I am always at the Summit.',
    camHome(700),
    flag('sp.idris-gallery'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Rimeholt: Linnet returns in ermine (trainer linnet-rimeholt)
  // ---------------------------------------------------------------------------------------------
  'linnet-returns': [
    { op: 'if', cond: { map: 'rimeholt' }, then: [tp('linnet', 'rimeholt', 'linnet-returns'), face('linnet', 'player')] },
    '* At the end of the Frostwick jetty a stoat stands in a winter coat gone white as the ice: ermine, tail tipped black. A Sootling rides on her shoulder, steaming gently into the cold. Five creatures of very different shapes stand round her feet.',
    'Linnet: Keeper. ~ Don\'t say anything about the coat. It does that up here. I didn\'t choose it. ~ You can say it looks good. Once.',
    'Linnet: I cut my hair. I trained a bench. Every one of them, by hand, on the ice, every morning. Cinder rides up here now, where he used to. ~ He likes it better. He says so. He steams it.',
    'Linnet: Six of them. Nobody carries. I was carrying a team and only looking at one creature. ~ Ready?',
    { op: 'startBattle', trainer: 'linnet-rimeholt', source: 'story' },
    '* Linnet looks at her six, one by one, the way Corin looks at a page he can\'t quite see: closely, and as if it matters.',
    'Linnet: Every one of them mattered. That\'s new. ~ That\'s good. They all take turns now. Cinder too.',
    porch('porch-linnet', true),
    flag('sp.linnet-returned'),
    'Linnet: I\'m going home. Maud\'s punt goes tonight. My porch has been dark long enough. ~ When I get home… read it for me. On my own step. I\'m not asking Merrow.',
    toast('Read It for Me'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // Act III: Two plans, one night (the night low after badge 5, loan 6 or loan 7)
  // ---------------------------------------------------------------------------------------------
  'two-plans-one-night': [
    flag('sp.two-plans'),
    warpTo(P, 'engine-watch', 'up'),
    tp('wick', P, 'engine-watch', 1, 1),
    sfx('thunder'),
    '* The night low. The Bar is coming up out of the sea, a long grey road to the dark, and at the end of its spur the Lantern Stack carries two sets of lights: a ring of lamps round something iron, and lower down, boats.',
    'Wick: KEEPER. ~ Two lights! Look! One on the Stack, and one out on the lagoon, low, in boats!',
    'Wick: The Stack one\'s the Mooring. Wynn told Tamsin, Tamsin told me. It\'s an engine. Cables down into the sea. It\'s for sinking the comet\'s heart when it comes down. ~ The boats are Varga. They\'re charges. To crack it, and throw the bits on every isle.',
    'Wick: Both tonight. Both before it even lands. ~ Keeper, which one do we stop?',
    companion({
      linnet: [tp('linnet', P, 'engine-watch', -1, 0), 'Linnet: Both. ~ You take Merrow; you\'re the one with the Glass. Wick and me take the boats. Wick. The charges. You know knots?', 'Wick: Mum says I know too many.'],
      tamsin: [tp('tamsin', P, 'engine-watch', -1, 0), 'Tamsin: Both. ~ You take the Stack. Wick and me take the boats. Kettle swims better than I do and I swim fine.'],
      maud: [tp('maud', P, 'engine-watch', -1, 0), 'Maud: Both. ~ You take the Stack. The puffling and I take the boats. My punt draws six inches. Confirm?'],
    }),
    { op: 'choice', options: [
      { text: 'Go. Be careful.', then: ['Wick: I\'m ALWAYS careful. ~ I\'m careful quickly.'] },
      { text: 'Pull the fuses, don\'t cut them.', then: ['Wick: Pull, don\'t cut. Pull, don\'t cut. ~ Got it. Corin said that too, about something else.'] },
    ] },
    warpTo('the-bar', 'spur-foot', 'up'),
    '* The spur is wet sand and broken shells, a hundred yards of it, and then the black stack rising out of the low tide with the iron ring on top. Mooring cables run down into the sea; Scatter charges run up toward the sky.',
    warpTo(LS, 'engine-player', 'up'),
    call('merrow-engine-before'),
    END,
  ],

  'merrow-engine-before': [
    { op: 'if', cond: { map: LS }, then: [tp('merrow', LS, 'merrow-engine'), face('merrow', 'player'), cam(LS, 'engine', 900)] },
    '* The Sinking Engine is a granite drum the size of a cottage, wound with chain, its face set with a hundred small grey stones that all glow the same dull colour. It thrums. You feel it in your teeth.',
    'Merrow: Keeper. ~ I thought it would be you.',
    'Merrow: When the comet comes down to the light, and it will, its heart comes with it. The Heartshard. The thing that has been calling every mark on this coast for thirty years. ~ The Engine sinks it. To the bottom of the lagoon, under a hundred anchor stones, where it can call nothing. The next window never comes.',
    'Merrow: No more windows. No more strangers in the morning. Nobody else has to carve a name on that slab. ~ The Engine stays until I have a safer answer.',
    camHome(500),
    { op: 'choice', options: [
      { text: 'And every mark goes dark with it.', then: ['Merrow: A dark mark is a safe mark. ~ Stand aside, or show me what you have learned.'] },
      { text: 'Neither plan has asked it a question.', then: ['Merrow: Then ask me one. ~ Show me what you have learned.'] },
    ] },
    { op: 'startBattle', trainer: 'merrow-engine', source: 'story' },
    END,
  ],

  'merrow-engine-after': [
    '* The Engine thrums on. Merrow\'s creatures stand round her, anchored, unchanged, and tired.',
    'Merrow: …What is that in your hand?',
    { op: 'if', cond: { letter: { read: 10 } }, then: [
      '* You hold out the letter. The tenth. The one she wrote the week she left. You lay Isolde\'s account on the cold housing of the Engine, and Merrow reads the page all the way to the bottom under the Engine\'s lamps.',
      '* "Merrow\'s ward is full of creatures with lit marks and no owners who know them. If I had read them, they\'d have been Shifts, not accidents. A read Shift is a Shift survived."',
      'Merrow: …She wrote that about me. ~ About my ward. I never asked what she learned after.',
      'Merrow: She\'s right. I never read them. I nursed them. I was so busy keeping them still that I never once looked to see which way they leaned.',
    ], else: [
      { op: 'if', cond: { letter: { read: 8 } }, then: [
        '* You hold out the eighth letter. The storm night. Merrow reads it under the Engine\'s lamps, and you watch her reach the line near the end: "I came back down to a dark tower and a harbor full of wrong shapes."',
        'Merrow: A dark tower. ~ It wasn\'t burning when they changed. It was out.',
        'Merrow: Thirty years I have said the light called it. And the light was out.',
      ], else: [
        '* You hold out the only thing you have: {nick:c1}, in your arms, its mark glowing in the Engine\'s lamps. Through the Glass you show her its Shiftlog: every shape it has worn, and the mark in the same place in every one.',
        'Merrow: Same mark. ~ Every shape. You read it every time.',
        'Merrow: I never read mine. Not once. I only ever held them still. ~ I have spent thirty years at the wrong half of this page.',
      ] },
    ] },
    '* She puts her wing flat on the Engine\'s drum and pulls the key. The thrum dies. The cables stop humming. The hundred grey stones go dark, one by one.',
    'Merrow: The stones stay licensed. ~ The clinics will take your Forecasts. No pulse over a whole street. No Engine under a creature that has not chosen.',
    'Merrow: That is the most I can give tonight. ~ It is more than I have given anyone in thirty years.',
    flag('sp.engine-halted'),
    call('charges-pulled'),
    END,
  ],

  'charges-pulled': [
    { op: 'if', cond: { map: LS }, then: [
      tp('varga', LS, 'varga-stack'),
      tp('wick', LS, 'wick-charges'),
      companion({ linnet: [tp('linnet', LS, 'linnet-charges')], tamsin: [tp('tamsin', LS, 'linnet-charges')], maud: [tp('maud', LS, 'linnet-charges')] }),
    ] },
    '* Up the stack stair come Wick, soaked to the cap, dragging a canvas sack of cold charges with the last fuse rolled neatly round one wing, and behind him his partner in crime, and behind them Varga, very quiet for once.',
    'Wick: Pulled! All of them! Pulled, not cut! Three. I counted twice. Wren says twice. ~ They\'re in the sack. They\'re very heavy. They\'re very, very heavy.',
    companion({
      linnet: ['Linnet: Cinder held the boat steady. In the dark. In the SEA. ~ Somebody tell him he\'s brave; he won\'t believe me.'],
      tamsin: ['Tamsin: Kettle dived for the last one. Under the boat. ~ I\'m not saying I was worried. I\'m saying I\'m going to sit down.'],
      maud: ['Maud: Six inches of draught and not a scratch on her. ~ Confirm: nobody is to tell my punt how close that was.'],
    }),
    face('varga', 'player'),
    'Varga: You pulled them. ~ Crack it, I thought. Throw it on every isle. Let every creature Shift, all the time, so nobody ever drowns because the right body didn\'t come. I had it worked out to the last pinch.',
    'Varga: And then the puffling asked me what happens to the ones who don\'t want to. ~ I didn\'t post that. I didn\'t have an answer. I had a charge.',
    '* Varga looks at the dark sea, then at the sack. He folds the firing handle and puts it away.',
    face('merrow', 'player'),
    'Merrow: Teo.',
    'Varga: Agathe.',
    '* They stand on either side of the dead Engine and look at each other for a long time, the two halves of one argument that started on the same night thirty years ago.',
    'Merrow: Two plans. ~ One night.',
    'Varga: And neither went off. ~ Imagine that.',
    sfx('night'),
    '* Above the stack, the comet hangs low over the lagoon, so close you can see its tail move. It isn\'t falling. It\'s waiting.',
    'Wick: Keeper. ~ What\'s it waiting for?',
    { op: 'choice', options: [
      { text: 'A light.', then: ['Wick: …The lighthouse. ~ Our lighthouse. Keeper, that\'s OUR lighthouse.'] },
      { text: '(Look back at the point.)', then: ['* You look back across the water. The point is dark. The tower is dark. The whole night is waiting on one lamp.'] },
    ] },
    flag('sp.charges-pulled'),
    { op: 'if', cond: { not: { flag: 'sp.act-4' } }, then: [flag('sp.act-4'), toast('IV — The Light')] },
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // loan 7 opens: Wren offers the Lamp Room
  // ---------------------------------------------------------------------------------------------
  'lamp-room-offered': [
    warpTo('int-yard-shed', 'lamp-room-offer-player', 'up'),
    tp('wren', 'int-yard-shed', 'lamp-room-offer-wren'),
    tp('ambrose', 'int-yard-shed', 'ambrose-workbench'),
    '* In the shed, on the plans table, there is a model under a cloth. Wren has her paw on the cloth. She has clearly been standing there for some time.',
    'Wren: Last plan. Loan seven\'s the last one. ~ Everything else came out of the book. Dad\'s book. His dad\'s. This didn\'t. This one\'s mine.',
    sfx('confirm'),
    '* She pulls the cloth off. A lamp room in pale wood and brass, small enough to hold: the lens ring, the walkway, the stair coming up through the floor, a little brass moth on the rail. The whole harbor, small, through the glass.',
    'Wren: The Lamp Room. For the tower. ~ The lens is still up there. Cracked in one panel, Dad says; he\'s been up the stair by touch every year since he lost his eyes, and counted the panels.',
    'Ambrose: Eleven good. ~ One cracked. She\'s drawn the twelfth new. In alder. Let them look, Wren.',
    'Wren: Eighty thousand. No interest. No deadline. Same terms as everything else. The rooms downstairs can wait for afterwards if you want; this one lets the light out. It goes up overnight when you\'ve paid it, and the night after that… ~ I\'m not going to say it. I\'ll jinx it.',
    { op: 'choice', options: [
      { text: 'That\'s my favourite.', then: [
        'Wren: You don\'t have to say that. ~ I\'m writing down that you said it.',
        '* She writes it down. Her ears are flat, and then they aren\'t.',
      ] },
      { text: 'Build it.', then: ['Wren: When you\'ve paid it. That\'s the deal. ~ But yes. Yes. We\'ll build it.'] },
      { text: '(Look at the little moth.)', then: ['Wren: That\'s for Dimity. ~ She\'ll want to move up. Everybody will want to move up.'] },
    ] },
    'Ambrose: I heard all of that.',
    'Wren: You were meant to.',
    flag('sp.lamp-room-offered'),
    END,
  ],

  // ---------------------------------------------------------------------------------------------
  // dawn after loan 7: the Lamp Room is built
  // ---------------------------------------------------------------------------------------------
  'lamp-room-built': [
    warpTo('int-lighthouse', 'relight-player', 'up'),
    tp('ambrose', 'int-lighthouse', 'ambrose-lamp-room'),
    tp('wren', 'int-lighthouse', 'relight-wick'),
    sfx('dawn'),
    '* Twenty to six, and the Thatch are not on a roof. They are on the very top of the tower, all of them at once, tying the last peg of the Lamp Room while the sky goes grey behind them.',
    'The Thatch: Tie it! Highest yet! Nobody look down! Who looked down? Tie it!',
    '* Then the room is finished: pale alder and brass, the old lens back in its ring with a twelfth panel new and gold among the eleven old ones, a walkway round it, a little brass moth on the rail. Wren stands at the stair, holding her clipboard upside down.',
    'Ambrose: Wall.',
    '* Ambrose walks the room by touch. One paw on the curved stone, all the way round, slowly, the cane tucked under his arm. He stops at the twelfth panel and puts his whole paw flat against it.',
    'Ambrose: Alder. ~ Better than mine.',
    'Wren: Dad. ~ You\'ve never said that. About anything.',
    'Ambrose: I said it. Put it in the book.',
    '* The lens has no flame in it. It sits in its ring and waits, the way the whole harbor has been waiting.',
    'Wren: Tonight. At dusk. ~ I\'m not going to say anything else. I\'ll cry on the brass and it\'ll spot.',
    flag('sp.lamp-room-built'),
    { op: 'if', cond: { not: { flag: 'sp.act-4' } }, then: [flag('sp.act-4'), toast('IV — The Light')] },
    END,
  ],
};
