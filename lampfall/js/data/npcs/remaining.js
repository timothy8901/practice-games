/** The remaining residents, isle folk and absent letter writers. Named-marker placements only. */
import { at, spot, porch, hm, line, topic, duelTopic, duelScript, P } from './_helpers.js';
import { THREAD_BY_NPC } from '../threads/index.js';

export const scripts = {};
const lines = (rows) => rows.map((text, i) => line(`g${i + 1}`, text));
function person(id, name, species, map, marker, words, extra = {}) {
  const post = spot(map, marker);
  return { id, name, species, sprite: id, portrait: id, group: 'isle', home: map,
    homeSpot: { ...post, pose: 'stand' }, threadId: THREAD_BY_NPC[id] ?? null,
    schedule: [at(0, map, marker)], topics: [],
    lines: { generic: lines(words), porch: lines([words[0]]), sleep: lines(['* There is a quiet breath from the other side of the door. Tomorrow will do.']) },
    ...extra };
}
function resident(id, name, species, door, seat, schedule, words, extra = {}) {
  const row = person(id, name, species, P, seat, words, { group: 'resident',
    homeSpot: spot(P, door, { pose: 'sleep' }), porch: porch(`porch-${id === 'wick' ? 'dorrow' : id === 'tamsin' ? 'dark-1' : id}`, seat),
    schedule, festivals: { 'lantern-market': spot(P, 'market-green'), 'long-night': spot(P, 'point-skywatch'), 'late-delivery-party': spot(P, 'party-green') }, ...extra });
  if (['wick', 'tully', 'odile', 'tamsin', 'linnet'].includes(id)) {
    scripts[`talk-${id}-duel`] = duelScript(id, `porch-${id}`, {
      ask: `${name.split(' ')[0]}: The slate says us. Friendly rules. Would you like a duel?`,
      yes: `${name.split(' ')[0]}: Read first. Then come on.`, no: `${name.split(' ')[0]}: Another evening. The step will still be here.`,
    });
    row.topics = [...row.topics, duelTopic(id)];
  }
  return row;
}

const residents = [
  resident('ansel', 'Ansel Stalk', 'grey heron', 'door-wardens-house', 'ansel-launch', [
    at(hm(6), P, 'ansel-launch', { pose: 'fish' }), at(hm(12), P, 'ansel-weir'),
    at(hm(17), P, 'ansel-creek', { pose: 'fish' }), at(hm(23), P, 'door-wardens-house', { pose: 'sleep' }),
  ], ["Forked tail, by the piling. Don't rush it. The fish isn't going anywhere until it is.",
    "A report is only as good as the drawing you put beside it. I learned that late.",
    "The creek is empty. I know. I fish it anyway.", "The river remembers where the sea is. We put a wheel in its way."],
    { porch: porch('porch-wardens-house', 'ansel-launch', { litAtStart: true }), topics: [topic('tells', 'ansel-fishing-tells', 9, { once: true, cond: { flag: 'sp.dock-battle' } })] }),
  resident('wick', 'Wick Dorrow', 'puffling', 'door-dorrow', 'porch-dorrow-step', [
    at(hm(6), P, 'wick-burrow'), at(hm(10), 'lowmoor', 'wick-lowmoor'), at(hm(16), P, 'wick-cliff-stair'),
    at(hm(18), P, 'wick-errands'), at(hm(23), P, 'door-dorrow', { pose: 'sleep' }),
  ], ["Keeper! I knew you'd come back. I watched the road. Only a bit.",
    "Gillwick breathes water. I breathe air. So I made a pack. Mum says that is what a plan looks like.",
    "The cap's meant to be big. Room for learning.", "When the light comes on, can I carry something? Something important. I'll use both wings."],
    { topics: [topic('errands', 'wick-errands', 10, { once: true, cond: { all: [{ flag: 'sp.dock-battle' }, { not: { flag: 'sp.errands-started' } }] } })] }),
  resident('tully', 'Tully', 'wombat', 'door-tully', 'porch-tully-step', [
    at(hm(6), P, 'tully-lap-1', { pose: 'path', path: 'tully-flats-lap' }), at(hm(8), P, 'tully-porch'),
    at(hm(12), P, 'commons-training-yard'), at(hm(18), P, 'tully-porch'), at(hm(23), P, 'door-tully', { pose: 'sleep' }),
  ], ["Fastest on the flats. That's what the sweatband says. It doesn't say how many runners.",
    "A nickname's a gift. You can leave it on the step if it doesn't fit.",
    "Bryony's beans have right of way now. I put it in the race rules.", "Training isn't being quick. It's coming out again tomorrow."],
    { porch: porch('porch-tully', 'porch-tully-step', { litAtStart: true }), topics: [topic('nickname', 'tully-nickname', 10, { once: true, cond: { flag: 'sp.errands-started' } })] }),
  resident('odile', 'Odile', 'roseate spoonbill', 'door-odile', 'porch-odile-step', [
    at(hm(7), P, 'odile-porch'), at(hm(10), 'int-archive', 'odile-gallery'), at(hm(14), P, 'odile-easel'),
    at(hm(19), P, 'odile-porch'), at(hm(23), P, 'door-odile', { pose: 'sleep' }),
  ], ["Hold still. No, not you. The light.", "A new shape doesn't spoil a portrait. It makes the next one necessary.",
    "Eleven porches. One tower. I kept the large canvas for something.", "Amber is a difficult colour to mix when everybody is looking at it." ]),
  resident('bryony', 'Bryony', 'rock hyrax', 'door-bryony', 'porch-bryony-step', [
    at(hm(7), P, 'bryony-beans'), at(hm(12), P, 'fence-bryony-tully'), at(hm(17), P, 'bryony-porch'),
    at(hm(22), P, 'door-bryony', { pose: 'sleep' }),
  ], ["The beans don't mind racing. They mind being raced through.", "Sedgehare lives here. Living here isn't the same as being mine.",
    "A lower fence. Enough to keep a runner out and let a conversation through.", "Water at the root, please. The leaves have their own weather." ]),
  resident('thessaly', 'Thessaly', 'bilby', 'door-thessaly', 'porch-thessaly-step', [
    at(hm(8), P, 'thessaly-porch'), at(hm(10), P, 'thessaly-bench'), at(hm(16), P, 'market-green'),
    at(hm(19), P, 'thessaly-porch'), at(hm(23), P, 'door-thessaly', { pose: 'sleep' }),
  ], ["I'm writing the next chapter. Everybody says that means I ought to finish this one.",
    "A harbor is a good place for a mystery. Everyone knows everything and tells you half.",
    "You can sit. I only put people in books if they ask. Usually.", "A silence is a line too. I leave space for them." ]),
  resident('tamsin', 'Tamsin Brack', 'badger', 'door-dark-1', 'porch-dark-1-step', [
    at(hm(6), P, 'tamsin-porch'), at(hm(10), P, 'tamsin-flats'),
    at({ tide: 'low' }, P, 'tamsin-flats', { pose: 'wander', wanderR: 1, for: 100 }),
    at(hm(12), 'drownwood', 'tamsin-drownwood', { priority: 'high', for: 240, cond: { thread: { id: 'oyster-boat', beat: { eq: 2 } } } }),
    at(hm(18), P, 'tamsin-porch'), at(hm(23), P, 'door-dark-1', { pose: 'sleep' }),
  ], ["If you can see the glint, I can already reach it. Race you.", "Kettle isn't carrying stolen things. Kettle carries home.",
    "Tidy Sum. That's her name. Boats keep their names even on dry land.", "I can wait for water. I've waited for worse." ],
    { absent: { not: { flag: 'sp.tamsin-arrived' } } }),
  resident('corin', 'Corin Vale', 'tawny owl', 'door-archive', 'corin-archive-step', [
    at(hm(5), 'lowmoor', 'corin-lowmoor-stones', { for: 240 }), at(hm(9), P, 'corin-archive-step'),
    at(hm(10), 'int-archive', 'corin-loft-desk', { pose: 'sit' }), at(hm(16), P, 'corin-reeds'),
    at(hm(18), P, 'corin-step'), at(hm(23), 'int-archive', 'corin-loft-bed', { pose: 'sleep' }),
  ], ["Look before you swing. Then say what you see.", "The Glass doesn't tell the future. It tells you what you're choosing.",
    "My eyes are getting worse. Yours are getting better. A very workable arrangement.", "Isolde used to leave before goodbyes. I have borrowed the habit. It saves a great many words." ],
    { porch: porch('porch-archive', 'corin-archive-step', { litAtStart: true }), topics: [
      topic('glass', 'corin-reading-glass', 20, { once: true, cond: { all: [{ flag: 'sp.starter-chosen' }, { not: { flag: 'sp.reading-glass' } }] } }),
      topic('stance', 'corin-capture-stance', 15, { once: true, cond: { all: [{ flag: 'sp.dock-battle' }, { not: { flag: 'sp.capture-stance' } }] } }),
      topic('first-forecast', 'corin-first-forecast', 14, { once: true, cond: { all: [{ map: 'lowmoor' }, { party: { level: { gte: 8 } } }, { not: { flag: 'sp.first-forecast' } }] } }),
      topic('ninth-spire', 'ninth-spire-ask', 8, { once: true, cond: { flag: 'sp.credits-seen' } }),
    ] }),
  resident('linnet', 'Linnet Rask', 'stoat', 'door-linnet', 'porch-linnet-step', [
    at(hm(6), P, 'linnet-porch'), at(hm(8), 'lowmoor', 'linnet-rematch-stones', { cond: { not: { flag: 'sp.linnet-returned' } } }),
    at(hm(12), P, 'commons-training-yard'), at(hm(17), P, 'linnet-porch'), at(hm(23), P, 'door-linnet', { pose: 'sleep' }),
  ], ["Neighbor. Read it for me. I'm asking you.", "Cinder fits in my hood now. There are advantages. I am listing the advantages.",
    "Six creatures. They take turns. Yes, I do know that now.", "Maud lets me steer. She says confirm so often I've started saying it in my sleep." ],
    { porch: porch('porch-linnet', 'porch-linnet-step', { litAtStart: true }),
      absent: { all: [{ flag: 'sp.linnet-fell' }, { not: { flag: 'sp.linnet-returned' } }] },
      topics: [topic('rematch', 'linnet-brackenford-before', 8, { cond: { all: [{ map: 'lowmoor' }, { badge: 1 }, { not: { flag: 'sp.linnet-rematch' } }] } }),
        topic('decline', 'linnet-decline', 7, { repeatDays: 1, cond: { all: [{ day: { gte: 2 } }, { not: { badge: 1 } }] } })] }),
];

const folk = [
  person('dimity', 'Dimity', 'rosy maple moth', P, 'porch-keepers-cottage-step', ["Tomorrow: a tide, a letter, and whatever you choose to leave open.", "You came home. I kept your place.", "Your seed remembers. So do I."], { group: 'fixture', absent: { not: { flag: 'sp.first-payment' } } }),
  person('maud', 'Maud Tallis', 'greylag goose', 'lowmoor', 'maud-practice-table', ["Every dock, every tide. Ask before you pay. Ask again before you leave.", "A reroll buys another reading, not a promise.", "Some passengers want the far shore. Some want a quiet crossing. Both pay the same."], { group: 'leader', schedule: [at(hm(1), P, 'maud-berth', { pose: 'sleep' }), at(hm(5), 'lowmoor', 'maud-practice-table'), at(hm(18), P, 'maud-berth')], topics: [topic('practice', 'maud-practice-table', 10, { once: true, cond: { not: { flag: 'sp.reroll-taught' } } })] }),
  person('osric', 'Osric Penhallow', 'tortoise', 'spire-ward', 'osric-dais', ["A Ward is a question. Read which question before you answer.", "I cut the stone. The creature decides whether it is heavy.", "Granite holds for a very long time. That isn't always kindness."], { group: 'leader' }),
  person('ines', 'Ines Calloway', 'crested newt', 'spire-weather', 'ines-dais', ["Weather is posted three turns ahead. Bring a coat and a plan.", "The steam comes out whether we look at it or not. Looking helps.", "At the spa, everyone gets the same towel. Even champions."], { group: 'leader' }),
  person('wendel', 'Wendel Teague', 'grebe', 'spire-hollow', 'wendel-dais', ["Plain and Grit pass through Hollow. A good boatwright checks the hull before loading it.", "Rollers, ropes, patient people. That's how you move a boat without water.", "The drowned street is still a street. People lived there."], { group: 'leader' }),
  person('ada', 'Ada Halloran', 'jackdaw', 'spire-relay', 'ada-dais', ["No repeat rounds. Everyone on your team has a job.", "Ivo says the wind's changing. I say it never stopped.", "The roster is chalk. The promise is not."], { group: 'leader' }),
  person('ivo', 'Ivo Halloran', 'jackdaw', 'spire-relay', 'ivo-dais', ["Ada keeps the roster. I keep the chalk. Very equal arrangement.", "A relay is trusting the one you send next.", "You can hear the whole moor from up here. Listen for the mill that stopped."], { group: 'leader' }),
  person('seraphine', 'Seraphine Locke', 'arctic fox', 'spire-mirror', 'seraphine-dais', ["Evasion is an odds problem. The true chance is always there to read.", "Mirror ice doubles a light. It does not make another one.", "Idris taught me to read. I am still learning what he left out."], { group: 'leader' }),
  person('hollis', 'Hollis Brandt', 'mountain goat', 'hollis-gate', 'hollis-desk', ["The Readers' fund pays a share on every badge. Wren has the other half of the book.", "The gate needs six badges. The road only needs a pair of feet.", "Supplies first. Pride packs badly."], { group: 'summit', topics: [topic('gate', 'summit-gate', 12, { once: true, cond: { badge: 6 } })] }),
  person('bastien', 'Bastien Kell', 'mink', 'keepers-hall', 'bastien-post', ["I brought that brazier out of the fleet. We have kept it burning since.", "Hollow and Brine. Read the pair, not just the first word.", "A keeper is somebody who stays when staying matters."], { group: 'summit' }),
  person('cass', 'Cass Rune', 'lynx', 'keepers-hall', 'cass-post', ["Weather on the board. True odds in the Glass. You have everything I have.", "Keep the next creature in mind. This one won't do every job.", "We rang the bell for every traveler. We never rang it for a loser."], { group: 'summit' }),
  person('idris', 'Idris Fenwake', 'great northern diver', 'idris-hall', 'idris-dais', ["The ring held the same shape for thirty years. I called that care.", "Vesperay. Whatever it becomes, I will learn the name again.", "You may come before you light the lamp. Or after. I will be here."], { group: 'summit' }),
  person('merrow', 'Agathe Merrow', 'cormorant', P, 'merrow-anchorage', ["The stones stay licensed. The clinics will take your Forecasts.", "I nursed the harbor through that night. I will not pretend I forgot it.", "A stone is a choice. The person holding it should be told that."], { group: 'faction', schedule: [at(hm(7), P, 'merrow-anchorage'), at(hm(19), 'cairnhold', 'merrow-memorial')] }),
  person('varga', 'Teo Varga', 'raccoon', P, 'varga-raft', ["Salt redraws the cards. Anybody selling you certainty has a crate to clear.", "Changed swimmers pulled us out of the drowning street. I owe them the rest of my life.", "Hollis offered to fund a clinic. Had to read the letter twice."], { group: 'faction', absent: { day: { lte: 2 } }, schedule: [at(hm(2), P, 'varga-raft', { pose: 'sleep' }), at(hm(12), P, 'varga-raft')] }),
  person('dov', 'Dov Lattimer', 'kinkajou', P, 'dov-stall', ["Sealed crate. Contents listed. Suspense is free; the disc isn't.", "I count bids, not heartbeats. Take your time.", "No bid is an excellent bid if you need your buttons."], { group: 'faction', topics: [topic('auction', 'dov-auction', 7, { repeatDays: 7, cond: { flag: 'sp.first-market' } })] }),
  person('pip', 'Pip', 'water rat', P, 'pip-quay', ["Dock hands get time off too. Mine's three turns long.", "Wirewhisk knows every rope on this quay. Some of them know him.", "You can say no. The tide won't report you."], { topics: [topic('duel', 'pip-before', 8, { cond: { all: [{ flag: 'sp.capture-stance' }, { not: { flag: 'sys.trainer.pip' } }] } })] }),
  person('the-thatch', 'The Thatch', 'finches', P, 'ambrose-bench', ["Tie it! Over, under, tight!", "Nobody fell! Breakfast!", "Seed paid. Pegs counted. Roof yours."], { group: 'fixture' }),
  person('isolde', 'Isolde Petrel', 'storm petrel', 'int-lighthouse', 'isolde-desk-front', ["* A clean space on the desk where a letter used to be."], { group: 'absent', absent: true }),
  person('mabry', 'Mabry Coil', 'garden snail', 'int-post-office', 'mabry-daybook-front', ["* The day book is closed. There is a ribbon marking tomorrow."], { group: 'absent', absent: true }),
  person('hobb-fallow', 'Hobb Fallow', 'brown hare', 'lowmoor', 'hobb-pavilion', ["Short way at low tide. Boardwalk at every tide. The board has both.", "Maud's practice table is by the pavilion. She's patient. Don't tell her I said that.", "No badge to walk here. No badge to go anywhere round the ring." ]),
  person('wynn-cobble', 'Wynn Cobble', 'dormouse', 'cairnhold', 'wynn-clinic', ["One stone refuses one window. It doesn't remove the next.", "The clinic sells anchors, Still Knots and Crackdust. The explanation is free.", "If you want to release a knot, put the creature first and the knot second." ]),
  person('quill-hartsease', 'Quill Hartsease', 'hedgehog', 'cairnhold', 'quill-memorial', ["Every name belongs to a boat. Every boat brought its people home on foot.", "Wrong shapes, they called them. I write changed shapes on the new plaque.", "Keep your lantern. The memorial doesn't need it more than you do." ]),
  person('mags-penny', 'Mags Penny', 'herring gull', 'cairnhold', 'mags-dock', ["They wanted a license fee before they'd look at the Forecast. I wanted them to look first.", "My boat is small. My fish are excellent. My paperwork is neither.", "I'll take the long road. It stays where you put it." ]),
  person('gorse-abernethy', 'Gorse Abernethy', 'marmot', 'emberstep', 'gorse-spa', ["Steam, ash, squall, clear. Three turns each. Towels are not weatherproof.", "That lightning out on the ridge has a tail. Augusta will want a note.", "The terrace is warm even in rain. That's the whole recommendation." ]),
  person('teal-fenner', 'Teal Fenner', 'water shrew', 'drownwood', 'teal-poler', ["We take a pole to the drowned street. You can keep your feet dry if you listen.", "The Scatter got my aunt out. The Mooring brought blankets. I remember both.", "A changed body still knows where home was." ]),
  person('rook-hayward', 'Rook Hayward', 'rook', 'thistlewind', 'rook-mill', ["The mill stopped. Every draft creature changed in the same minute. We unhooked the traces first.", "Tomorrow we'll fit the harnesses again. To whatever turned up.", "Windle keeps a spare of everything except people." ]),
  person('brannoch-vey', 'Brannoch Vey', 'ptarmigan', 'rimeholt', 'brannoch-cave-lamp', ["Three tiles of light in the caves. Take the path you can see.", "Idris is in the gallery sometimes. Watches his own reflection as if it might answer.", "A stoat came through in winter white. Had a small warm thing in her hood." ]),
];

export const REMAINING_NPCS = [...residents, ...folk];
