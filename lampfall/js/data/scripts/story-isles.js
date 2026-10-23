/** The ring of isles and the two plans. Full story scenes use only the shared script vocabulary. */
import { tp, warpTo, cam, camHome, face, flag, porch, deliver, sfx, music, toast, call, label, go, END } from './_stage.js';
const P = 'pellwick';
export default {
  'linnet-decline': [
    'Linnet: No. A whole, complete no. Get a badge first. Then Brackenford, and I will be extremely fair about beating you.',
    flag('sp.linnet-declined'), END,
  ],
  'maud-practice-table': [
    'Maud: Three cards on the table. Odds on every card. No money on any of them. That is a practice table.',
    '* Maud puts a grain of Starsalt beside the Glass. The three cards redraw; their new odds are written before you touch them.',
    'Maud: Reroll redraws the forecast. It does not promise Up. Read the new odds and then confirm. If you do not like them, you can still refuse the window with a stone.',
    { op: 'choice', options: [
      { text: 'I confirm after I read.', then: ['Maud: Confirmed. You will make a decent passenger.'] },
      { text: 'I can leave a window alone.', then: ['Maud: Correct. A very useful thing to know before somebody sells you salt.'] },
    ] },
    'Maud: The first badge opens Reroll on your Glass. Till then, the table is free. Same lesson, no chance of a bill.',
    flag('sp.reroll-taught'), END,
  ],
  'linnet-brackenford-before': [
    { op: 'if', cond: { not: { badge: 1 } }, then: [call('linnet-decline'), go('done')] },
    'Linnet: A badge. Finally. I was beginning to think Maud had hidden it from you.',
    'Linnet: Cinder and I have been practising. You and yours should have been doing the same. Ready?',
    { op: 'choice', defaultIndex: 1, options: [
      { text: 'Ready.', then: [{ op: 'startBattle', trainer: 'linnet-brackenford', source: 'rival' }] },
      { text: 'I will come back.', then: ['Linnet: I will be very casually waiting. Here. Where I happen to be.'] },
    ] }, label('done'), END,
  ],
  'linnet-brackenford-after': [
    'Linnet: You used all of them. Each one had a job. ~ I know that is allowed. I know.',
    'Maud: First steps. Nobody has to take them in a straight line.',
    flag('sp.linnet-rematch'), toast('First Steps'), END,
  ],
  'raft-docks': [
    '* At the Old Pier a raft arrives carrying too many flags and a carefully lettered price board. A raccoon hops ashore, checks the knots and turns the board so everyone can read it.',
    'Varga: Carnival Raft. Starsalt, clinics, very moderate shouting. Teo Varga. The Scatter. You may have heard something unhelpful.',
    'Augusta: You will post the odds before you take a button.',
    'Varga: I brought extra chalk.', flag('sp.raft-docked'), END,
  ],
  'tamsin-arrives': [
    '* A badger walks the causeway at dusk with a digging shovel and a parcel wrapped in sailcloth. She stops at the first dark house and wipes its number with her sleeve.',
    'Tamsin: Tamsin Brack. That is my house, if the key fits. If it does not, I have a shovel.',
    '* The key fits. The porch lamp takes two attempts. She leaves it burning.',
    'Tamsin: Flats tomorrow. Try to keep up.', porch('porch-dark-1', true), flag('sp.tamsin-arrived'), END,
  ],
  'act-2-open': [
    '* The ring of isles lies beyond Lowmoor. Every long road stays dry; every short road has a tide written beside it.',
    'Corin: A badge is a tool, Keeper. It is not a permit to walk. You could have walked the whole ring yesterday. ~ Now you know what to look for.',
    flag('sp.act-2'), toast('II — The Odds'), END,
  ],
  'cairnhold-memorial': [
    tp('merrow', 'cairnhold', 'merrow-memorial'),
    '* The memorial lists boats. Below them, in smaller letters: EVERYONE CAME HOME. NIGHT OF WRONG SHAPES.',
    'Merrow: I was the harbor nurse. A creature towing a patient would change in the traces. The patient knew the voice. The harness did not.',
    'Merrow: I fed them broth. I tied the bandages. Afterwards I learned to cut anchor stones. You may disagree with me. First, read the names.',
    { op: 'choice', options: [
      { text: 'Read every name.', then: ['* Merrow waits. When you finish, she nods once.'] },
      { text: 'Everyone came home.', then: ['Merrow: Everyone. ~ Keep that part in your report.'] },
    ] }, flag('sp.memorial-seen'), END,
  ],
  'anchorage-turns-away': [
    '* Mags Penny lays a folded Forecast on the clinic counter. The orderly puts a price card beside it. Mags checks an empty pocket, then folds the Forecast smaller.',
    'Mags: I wanted you to look first.',
    'Merrow: The license pays for the stones and the clinic.',
    'Mags: My creature does not know what a license is.',
    '* She leaves carrying the same question she came with.', flag('sp.anchorage-seen'), END,
  ],
  'first-errant-sighting': [
    cam('emberstep', 'errant-sighting'), sfx('thunder'),
    '* Lightning runs sideways along the ridge. Something long and bright carries it, turning through the ash like a knot of living weather.',
    'Gorse: Squallcoil. An Errant. Same one Augusta posted. It roams; no creature is lost because you missed one evening.',
    camHome(), flag('sp.errant-seen'), END,
  ],
  'first-lantern-market': [
    '* String lights run from the post office to the board. For once the whole green is warm. Dov has a sealed crate, Juniper has a till, and Ludo has come down from the eave.',
    'Augusta: Prices and odds where everyone can see them. That includes you, Dov.',
    'Dov: Especially me. Mine are beautifully lettered.',
    flag('sp.first-market'), flag('sys.lantern-market'), toast('Market Night'), call('varga-hires-you'), END,
  ],
  'dov-auction': [
    'Dov: Sealed crate. One reusable technique disc. Contents listed before the bid: Gnash. Two thousand buttons. No bid is the first option for excellent reasons.',
    { op: 'choice', defaultIndex: 0, options: [
      { text: 'No bid.', then: ['Dov: A fine bid. Yours, to keep.'] },
      { text: 'Buy Gnash — 2,000 buttons.', cond: { wallet: { gte: 2000 } }, then: [{ op: 'spend', amount: 2000 }, { op: 'give', item: 'disc-gnash' }, 'Dov: Sold. The disc is yours forever. Teach as often as you like.'] },
    ] }, END,
  ],
  'varga-hires-you': [
    'Varga: Call the odds for me? I can shout a number; a reader makes people believe somebody checked it.',
    { op: 'choice', defaultIndex: 1, options: [
      { text: 'I will read exactly what is there.', then: [
        '* You read every card aloud. Up. Side. Down. Nobody cheers until you have finished.',
        'Varga: Exactly right. Five hundred for the work. Reading is work.', { op: 'earn', amount: 500 }, flag('sp.varga-hired'),
      ] },
      { text: 'I will watch.', then: ['Varga: Watching is the first half. You can take the other half whenever you like.'] },
    ] }, END,
  ],
  'linnet-fall': [
    '* At the Shift fair Cinder fills the whole platform. Linnet holds its Forecast high. DOWN is lit.',
    'Linnet: It has been big for weeks. It cannot just—',
    '* The shape folds. The heat goes out of the boards. A small Sootling sits where the Caldermaw was, with the same bright mark on the same place on its brow.',
    'Merrow: A stone for the next window. Let me—', 'Varga: Salt. We can redraw—',
    'Linnet: NO. ~ Both of you. No.',
    '* She lifts the Sootling in both paws. Her voice, when she speaks to it, is quieter than you have ever heard it.',
    'Linnet: Cinder. In my coat. Come on.',
    '* Maud loosens the punt. Linnet pays exact change, looks at nobody and gets aboard.',
    porch('porch-linnet', false), flag('sp.linnet-fell'), END,
  ],
  'comet-brightens': [
    '* The comet has a sharp edge tonight. The hum under the mud reaches the windows before the wind does.',
    'Augusta: The board is changing. That is why we keep one. Read tomorrow before you pack for it.',
    flag('sp.act-3'), toast('III — The Surge'), END,
  ],
  'drowning-street': [
    '* At low water the drowned street appears. Teal and the Scatter volunteers carry benches from a house that has no dry floor.',
    'Teal: The swimmers changed on the way down. New gills. New hands. Those were the hands that pulled us out.',
    'Varga: Merrow remembers the traces breaking. I remember who could still swim. Both happened.',
    flag('sp.drowning-street'), call('anchor-pulse-misfire'), END,
  ],
  'anchor-pulse-misfire': [
    '* The Mooring pulse rings from the anchor post. Every glowing mark in the street goes dim at once. A swimmer stiffens under the water.',
    'Merrow: Stop it. Now.', sfx('wardBreak'),
    '* The machine falls quiet. Teal gets a rope under the swimmer. Its mark returns before it takes a breath.',
    'Merrow: Nobody runs that again. The stone in a hand is one choice. A street cannot hold a hand.', flag('sp.pulse-stopped'), END,
  ],
  'the-surge': [
    '* In Windle, every creature in the mill traces Shifts in the same minute. Rook cuts the first strap. Ada catches the shaft. Ivo posts the street before anybody can run into it.',
    'Rook: Unhook first. Name them after. They still know us.',
    '* When the street is quiet, every collar lies open. People are fitting the harnesses to the creatures that came home.',
    'Corin: A read Shift is a Shift survived. Not a Shift stopped.', flag('sp.surge'), END,
  ],
  'idris-gallery': [
    '* Idris watches a Vesperay in the mirror ice. A granite ring presses into the feathers above its mark.',
    'Idris: Thirty years. Same shape, same move, same answers. I called it care because I was afraid to call it fear.',
    'Idris: Six badges for the Summit. No debt paid first. No lamp lit first. Come when you have a question worth bringing.',
    flag('sp.idris-gallery'), END,
  ],
  'linnet-returns': [
    '* A stoat in ermine steps out of the mirror cave. Sootling sleeps in her hood. Five creatures of very different shapes follow her feet.',
    'Linnet: Do not say anything about the coat. It is winter. ~ You can say it looks good. Once.',
    'Linnet: They all take turns now. Cinder too. I was carrying a team and only looking at one creature.',
    'Linnet: When I get home... read it for me. On my own step. I am not asking Merrow.',
    { op: 'startBattle', trainer: 'linnet-rimeholt', source: 'story' },
    porch('porch-linnet', true), flag('sp.linnet-returned'), toast('Read It for Me'), END,
  ],
  'two-plans-one-night': [
    '* At the night low the Lantern Stack carries two sets of lights. Mooring cables run down into the sea. Scatter charges run up into the Heartshard.',
    'Merrow: Sink it. The next window never comes.', 'Varga: Crack it. Every isle gets the chance to change.',
    'Corin: Two plans. Neither has asked it a question.',
    'Linnet: Wick. The charges. You know knots?', 'Wick: Mum says I know too many.',
    flag('sp.two-plans'), warpTo('lantern-stack', 'engine-player', 'up'), call('merrow-engine-before'), END,
  ],
  'merrow-engine-before': [
    'Merrow: The Engine stays until I have a safer answer. Show me what you have learned.',
    { op: 'startBattle', trainer: 'merrow-engine', source: 'story' }, END,
  ],
  'merrow-engine-after': [
    '* You lay Isolde\'s account on the cold housing of the Engine. Merrow reads the page all the way to the bottom.',
    { op: 'if', cond: { letter: { read: 10 } }, then: ['Merrow: "A read Shift is a Shift survived." She wrote that after the night. ~ I never asked what she learned after.'], else: ['Merrow: The wheel needed two. The creature changed. She still went to the wheel. ~ I have spent thirty years at the wrong half of this page.'] },
    'Merrow: The stones stay licensed. The clinics will take your Forecasts. No pulse over a whole street. No Engine under a creature that has not chosen.',
    '* She pulls the key. The cables stop humming.', flag('sp.engine-halted'), call('charges-pulled'), END,
  ],
  'charges-pulled': [
    '* Linnet comes round the stack with a sack of cold charges. Wick follows with the last fuse rolled neatly round one wing.',
    'Wick: Three. I counted twice. Wren says twice.',
    'Varga: You pulled them.', 'Linnet: You did not post what happens to it after.',
    '* Varga looks at the dark sea, then at the sack. He folds the firing handle and puts it away.',
    'Varga: No. I did not.', flag('sp.charges-pulled'), flag('sp.act-4'), toast('IV — The Light'), END,
  ],
  'lamp-room-offered': [
    'Wren: Last plan. The Lamp Room. Not from the book. Mine.',
    'Wren: Eighty thousand. No interest. No deadline. The rooms downstairs can wait for afterwards if you want. This one lets the light out.',
    'Ambrose: Let them look, Wren.', '* She unrolls the drawing. A round room. A great lens. The whole harbor, small through the glass.',
    flag('sp.lamp-room-offered'), END,
  ],
  'lamp-room-built': [
    '* The Thatch tie the last peg at twenty to six. Wren stands at the stair, holding her clipboard upside down.',
    'Ambrose: Wall.', '* He climbs with one paw on the curved stone. At the top he puts his whole paw flat against it.',
    'Ambrose: Better than mine.', 'Wren: Dad.', 'Ambrose: I said it. Put it in the book.',
    flag('sp.lamp-room-built'), END,
  ],
};
