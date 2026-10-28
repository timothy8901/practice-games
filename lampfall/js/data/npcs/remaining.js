/**
 * The isle folk, Spire leaders, Summit keepers, faction heads, fixtures and absent letter writers.
 * [DATA-CAST] GDD-06; GDD-00 §10. Named-marker placements only.
 *
 * Each row keeps the integrated build's ids, groups, absent conds, topics and posts; the merge adds
 * each person's voice (generic, phase and weather lines) and gives the isle folk a day: up at their
 * post at six (eight for the spa, the mill and the cave lamps), asleep there by night, through the
 * shared `isle-post` / `isle-post-late` templates and loops in data/schedules. The sixteen scheduled
 * residents have their own modules.
 *
 * The live resolver picks generic and phase lines without reading conds, so every line here holds
 * in every act.
 * @module data/npcs/remaining
 */
import { at, spot, hm, line, topic, P, morning, evening, night, weather } from './_helpers.js';
import { THREAD_BY_NPC } from '../threads/index.js';

export const scripts = {};
const lines = (rows, prefix = 'g') => rows.map((text, i) => line(`${prefix}${i + 1}`, text));

/**
 * One cast row at a fixed post.
 * @param {string} id
 * @param {string} name
 * @param {string} species
 * @param {string} map
 * @param {string} marker
 * @param {string[]} words   generic lines
 * @param {Record<string, any>} [extra]  row overrides, plus `voice: {morning?, evening?, night?, rain?, fog?, storm?, sleep?}`
 */
function person(id, name, species, map, marker, words, extra = {}) {
  const { voice = {}, ...rest } = extra;
  const post = spot(map, marker);
  const out = { id, name, species, sprite: id, portrait: id, group: 'isle', home: map,
    homeSpot: { ...post, pose: 'stand' }, threadId: THREAD_BY_NPC[id] ?? null,
    schedule: [at(0, map, marker)], topics: [],
    lines: {
      generic: lines(words),
      porch: lines([words[0]], 'p'),
      sleep: lines([voice.sleep ?? '* There is a quiet breath from the other side of the door. Tomorrow will do.'], 's'),
      ...(voice.morning ? { morning: morning(voice.morning.map((t, i) => [`m${i + 1}`, t])) } : {}),
      ...(voice.evening ? { evening: evening(voice.evening.map((t, i) => [`e${i + 1}`, t])) } : {}),
      ...(voice.night ? { night: night(voice.night.map((t, i) => [`n${i + 1}`, t])) } : {}),
      ...((voice.rain || voice.fog || voice.storm) ? { weather: weather(Object.fromEntries(['rain', 'fog', 'storm'].filter((k) => voice[k]).map((k) => [k, voice[k]]))) } : {}),
    },
    ...rest };
  return out;
}

/** Isle folk keep the shared day: their post from six (or eight), asleep at the post at night. */
function islePost(map, marker, late = false) {
  const s = spot(map, marker);
  return [{ id: late ? 'isle-post-late' : 'isle-post', mapId: s.mapId, x: s.x, y: s.y, facing: s.facing }];
}

const folk = [
  person('dimity', 'Dimity', 'rosy maple moth', P, 'dimity-porch', [
    'Tomorrow: a tide, a letter, and whatever you choose to leave open.',
    'You came home. I kept your place.',
    'Your seed remembers. So do I.',
    'I keep the day for you. Every day you lived, folded, in order. You can open any of them. Most people only open today.',
    'The dial is a promise you made to yourself about how wild the sea would be. You may change it. I will write that down too, gently.',
    'I came to your lamp the night it was lit. Moths always do. This one stayed.',
    'Shall I keep this moment? ~ I keep them all. You only have to ask to see one.',
    'Nothing you do here is lost. It is only put away.',
  ], { group: 'fixture', absent: { not: { flag: 'sp.first-payment' } }, voice: {
    morning: ['Good morning. The page is fresh. I have not written anything on it yet; that is your job.'],
    evening: ['Evening. The lamp is warm. I have been sitting by it, being glad of it.'],
    night: ['Late. Lie down when you are ready. I will fold the day up for you; it will keep.'],
    rain: 'Rain on the glass. I like a lamp in the rain best of all. It looks like it means it.',
    fog: 'Fog. The lamp makes a little room in it. Stay in the room a while.',
    storm: 'A storm night. Stay by the lamp. I will be here; I am always here when it is lit.',
    sleep: '* Dimity is folded up against the lamp glass, wings closed, very still. The light breathes through them, faintly pink.',
  } }),
  person('maud', 'Maud Tallis', 'greylag goose', 'lowmoor', 'maud-practice-table', [
    'Every dock, every tide. Ask before you pay. Ask again before you leave.',
    'A reroll buys another reading, not a promise.',
    'Some passengers want the far shore. Some want a quiet crossing. Both pay the same.',
    'Brackenford. Confirm? ~ I always ask. The day I don\'t ask is the day somebody ends up on Rimeholt in their slippers.',
    'I\'ve seen every kind of Shift there is. Up, down, sideways, and the kind nobody has a word for. I still like creatures. That surprises people.',
    'Come back stronger. ~ I don\'t mean bigger. I mean readier.',
    'Sit at the table. No clock. Draw the cards again until you know why you drew them. Then we\'ll talk about the Spire.',
    'The punt\'s older than your grandmother and steers better than most people. Mind the third plank.',
  ], { group: 'leader', schedule: [at(hm(1), P, 'maud-berth', { pose: 'sleep' }), at(hm(5), 'lowmoor', 'maud-practice-table'), at(hm(18), P, 'maud-berth')],
    topics: [topic('practice', 'maud-practice-table', 10, { once: true, cond: { not: { flag: 'sp.reroll-taught' } } }),
      // The Ember Grub beat 3 is Maud's (the beat's npcId), reached through a topic: the resolver reads only an npc's own threadId (MID-03)
      topic('ember-grub-crossing', 'th-ember-grub-3', 20, { cond: { all: [{ thread: { id: 'ember-grub', beat: { eq: 2 } } }, { flag: 'sp.linnet-fell' }] } })], voice: {
      morning: ['First crossing\'s at five. You\'re late for it. Second\'s at eight. Confirm?'],
      evening: ['Punt\'s tied. Rope\'s coiled. That\'s a day. ~ Sit if you\'re sitting. I don\'t do porch talk. I do berth talk. It\'s shorter.'],
      night: ['Late for a crossing. The tide doesn\'t care, but I do. Go home. Confirm? ~ Confirmed.'],
      rain: 'Rain. The punt doesn\'t mind. The passengers mind. I\'ve stopped minding the passengers minding.',
      fog: 'Fog. I go by the bell buoys and the smell of the mudflats. Nobody\'s ever been lost on my punt. Nobody\'s ever been early, either.',
      storm: 'No crossings in a storm. Don\'t ask. ~ You asked. The answer\'s still no. Confirmed.',
      sleep: '* Maud is asleep in the punt with her head under her wing and one foot hooked through the mooring rope, as if the punt might leave without her.',
    } }),
  person('osric', 'Osric Penhallow', 'tortoise', 'spire-ward', 'osric-dais', [
    'A Ward is a question. Read which question before you answer.',
    'I cut the stone. The creature decides whether it is heavy.',
    'Granite holds for a very long time. That isn\'t always kindness.',
    'You checked before you swung. ~ Good. That is the whole lesson. The rest is stone.',
    'A strong arm and a bad eye make a lot of chips and no statues.',
    'I carved the chart into the quarry wall so nobody has to ask me. People ask me anyway. I point at the wall.',
    'Crackdust at the Shelter. Cheaper than a lost round. Buy it or don\'t. I\'ve said it.',
    'I don\'t trust readers. ~ I trust you a little. You read the stone before you hit it.',
  ], { group: 'leader', voice: {
    morning: ['Morning. Stone\'s cold. It\'ll be warm by noon. I won\'t.'],
    evening: ['The quarry rings at dusk when it cools. Listen. ~ That\'s the stone settling. It\'s been settling for nine hundred years.'],
    night: ['The Spire is open. I am here. I am always here. I am a tortoise.'],
    rain: 'Rain on granite. It shines. Doesn\'t change it.',
    fog: 'Fog. The Wards are harder to see. Read harder.',
    storm: 'Storm. The quarry floods to the second step. I\'m on the third.',
  } }),
  person('ines', 'Ines Calloway', 'crested newt', 'spire-weather', 'ines-dais', [
    'Weather is posted three turns ahead. Bring a coat and a plan.',
    'The steam comes out whether we look at it or not. Looking helps.',
    'At the spa, everyone gets the same towel. Even champions.',
    'Steam, ash, squall, clear. It goes round like a song. You learn the song, you stop getting wet.',
    'The board tells you what the arena will do. It doesn\'t tell you what you\'ll do. That\'s yours.',
    'I opened the spa so people would sit still for an hour. Then I built a Spire so they\'d learn to move. I contradict myself professionally.',
    'Bring the newt-skin towels back. I count them. I have counted them for eleven years.',
    'An Errant was seen on the ridge again. Lightning with a tail. Augusta will want a note.',
  ], { group: 'leader', voice: {
    morning: ['Morning steam\'s the thickest. The terrace disappears. I like to stand in it and not be anybody.'],
    evening: ['Evening. The pools go orange with the ash light. Sit. Five minutes. Then challenge me.'],
    night: ['The night soak is half price. The Spire is the same price. Both are hot.'],
    rain: 'Rain on the spa. Warm below, cold above. Perfect. That\'s the whole island in one sentence.',
    fog: 'Fog and steam together. I can\'t tell which is which. Neither can the arena.',
    storm: 'Squall. In the arena it lasts three turns. Out here it lasts as long as it likes.',
  } }),
  person('wendel', 'Wendel Teague', 'grebe', 'spire-hollow', 'wendel-dais', [
    'Plain and Grit pass through Hollow. A good boatwright checks the hull before loading it.',
    'Rollers, ropes, patient people. That\'s how you move a boat without water.',
    'The drowned street is still a street. People lived there.',
    'The menu says "No effect" before you choose. Read the menu. I put it there for you.',
    'Every boat in my yard floats somebody\'s whole life. You treat it like that or you don\'t touch it.',
    'The Brack girl\'s oyster boat. I\'ve got the rollers greased. Tell her the yard\'s ready when she is.',
    'Hollow creatures aren\'t empty. They\'re just not where you\'re hitting.',
    'I dive for the stilts every spring. Half of Mossgate is held up by things I\'ve hammered underwater.',
  ], { group: 'leader', voice: {
    morning: ['Low water at the yard this morning. Good for caulking. Bad for conversation; I\'ve got pitch in my beak.'],
    evening: ['The boardwalks creak at dusk when the tide comes in under them. That\'s how you know they\'re still holding.'],
    night: ['Night. The Spire\'s lit. The yard\'s dark. I\'m between them, as usual.'],
    rain: 'Rain. Good. Keeps the planks swollen tight.',
    fog: 'Fog on the drowned street. Poles out. Nobody walks it alone in fog.',
    storm: 'Storm. Every boat double-tied. I\'ll be out checking knots all night. Don\'t come with me.',
  } }),
  person('ada', 'Ada Halloran', 'jackdaw', 'spire-relay', 'ada-dais', [
    'No repeat rounds. Everyone on your team has a job.',
    'Ivo says the wind\'s changing. I say it never stopped.',
    'The roster is chalk. The promise is not.',
    'Bench EXP has been on since your first route. Sixty in every hundred. Your bench has been learning while you weren\'t looking.',
    'Last round is both of us. Bring two you trust together, not two you trust apart.',
    'I keep the roster in chalk because people change. Ivo says that\'s sentimental. Ivo keeps a pebble from every challenger.',
    'Windle had a street Shift in one night. We cleared it in pairs. That\'s where the Spire comes from.',
    'If you\'re here to win with one creature, the door\'s behind you. ~ Kindly meant.',
  ], { group: 'leader', voice: {
    morning: ['Morning! The sails are up. Ivo\'s still in bed. I\'ve chalked him as "late".'],
    evening: ['Evening. The mills slow down when the wind drops. So do I. Ivo speeds up. We cancel out.'],
    night: ['Spire\'s open at night. The wind\'s better. Ivo says so. For once he\'s right.'],
    rain: 'Rain on the sails. They go heavy and slow. Good day to talk about the bench.',
    fog: 'Fog. Can\'t see the next mill. You trust it\'s there. That\'s a relay.',
    storm: 'Storm! All sails furled. All creatures in. All chalk smudged. Start again tomorrow.',
  } }),
  person('ivo', 'Ivo Halloran', 'jackdaw', 'spire-relay', 'ivo-dais', [
    'Ada keeps the roster. I keep the chalk. Very equal arrangement.',
    'A relay is trusting the one you send next.',
    'You can hear the whole moor from up here. Listen for the mill that stopped.',
    'I keep a pebble from every challenger. Yours is the grey one with the white line. I chose it before you came. I\'m usually right.',
    'Ada says the wind never stopped. I say it changes its mind. We\'re both right. That\'s twins.',
    'Double battle at the end. Your last two together. Pick the two who\'d hold the door for each other.',
    'The stopped mill is Rook\'s. Every draft creature changed in the same minute. We heard it from here. A sort of quiet.',
    'Shiny thing? Show me. ~ No, keep it. I only wanted to look. Jackdaw. It\'s not my fault.',
  ], { group: 'leader', voice: {
    morning: ['Morning. I\'m up. Ada chalked me late. I was late. It\'s still unfair.'],
    evening: ['Evening. The sails go gold. If you squint they\'re lanterns. Ada says don\'t squint at the sails.'],
    night: ['Night. Listen. ~ That\'s the moor breathing. Or Rook snoring. Same direction.'],
    rain: 'Rain. Every pebble on the sill is shiny. Very distracting.',
    fog: 'Fog. I can hear Ada\'s chalk from here. Squeak. Squeak. That\'s how I find her.',
    storm: 'Storm. Ada furls the sails. I count the bolts of lightning. Eleven so far. Twelve.',
  } }),
  person('seraphine', 'Seraphine Locke', 'arctic fox', 'spire-mirror', 'seraphine-dais', [
    'Evasion is an odds problem. The true chance is always there to read.',
    'Mirror ice doubles a light. It does not make another one.',
    'Idris taught me to read. I am still learning what he left out.',
    'Two Afterimages at most. Three Mends, shown as pips. I hide nothing. Hiding is his style. I built this place to unteach it.',
    'You figured me out. ~ Thank you. It is the nicest thing a challenger can do.',
    'The ice reflects on a posted pattern. Read the pattern. It never lies; only people do.',
    'He sits in the gallery and watches. I let him. One day he will watch someone beat his style and finally see it.',
    'Cold is just patience you can feel.',
  ], { group: 'leader', voice: {
    morning: ['Morning. The ice has re-set overnight. Every wall is a new mirror. I walk them all before I open.'],
    evening: ['Evening. The caves go blue at this hour. Even the lamps look cold.'],
    night: ['Night. The mirror ice holds the last light longest. Like a reader holding a card they have already read.'],
    rain: 'Rain does not reach the caves. Neither does much else. That is why people come.',
    fog: 'Fog at the cave mouth. Inside, everything is still clear. A good lesson, if you want it.',
    storm: 'A storm outside. In here you would never know. Brannoch keeps the lamps trimmed. I keep the odds honest.',
  } }),
  person('hollis', 'Hollis Brandt', 'mountain goat', 'hollis-gate', 'hollis-desk', [
    'The Readers\' fund pays a share on every badge. Wren has the other half of the book.',
    'The gate needs six badges. The road only needs a pair of feet.',
    'Supplies first. Pride packs badly.',
    'Count your PP before the Causeway. Arrive with some left. That\'s the whole battle, and it isn\'t mine.',
    'I ran relief after the Night of Wrong Shapes. Blankets, broth, bandages. I left the Mooring over the fees. I don\'t regret the blankets.',
    'Waste is just a decision you made twice.',
    'The Ration Ledger isn\'t a list. It\'s an argument with your future self. Win it.',
    'Don\'t thank me for the fund. Thank everyone who paid in. I only keep the book honest.',
  ], { group: 'summit', topics: [topic('gate', 'summit-gate', 12, { once: true, cond: { badge: 6 } })], voice: {
    morning: ['Morning. Ledger first, tea second. Tea is not in the ledger. It should be.'],
    evening: ['Evening. Good time to repack. Nobody packs well in the morning.'],
    night: ['The gate doesn\'t close at night. The road does. Rest.'],
    rain: 'Rain on the Causeway. Bring a dry pocket for the important things. One pocket. Not four.',
    fog: 'Fog on the Bar road. Wait it out. Waiting is free; getting lost isn\'t.',
    storm: 'Storm. Nobody goes up today. ~ That\'s not a rule. It\'s arithmetic.',
  } }),
  person('bastien', 'Bastien Kell', 'mink', 'keepers-hall', 'bastien-post', [
    'I brought that brazier out of the fleet. We have kept it burning since.',
    'Hollow and Brine. Read the pair, not just the first word.',
    'A keeper is somebody who stays when staying matters.',
    'I dived on the wrecks for twenty years. ~ Slowly. Everything underwater is slow. So am I. It suits me.',
    'Would you like to see my Shiftlog? ~ It is long. My creature has been five things. I was there for every one.',
    'Please. Take your time. The Summit is not going anywhere. Neither am I.',
    'I do not move for anybody. Politely. You will have to go through.',
    'The brazier was on the Grace. The ferry. It was the only thing still lit when we found her.',
  ], { group: 'summit', voice: {
    morning: ['Good morning. I have trimmed the brazier. It took an hour. It always takes an hour.'],
    evening: ['Good evening. The brazier looks brighter at dusk. It is not. We are.'],
    night: ['Night watch. I enjoy it. Nobody asks me to hurry at night.'],
    rain: 'Rain on the hall roof. It sounds like being underwater. I find it restful.',
    fog: 'Fog on the Summit. The brazier is the only thing you can see. That was always the point of it.',
    storm: 'Storm. I will stay by the brazier. Somebody should. It has always been somebody.',
  } }),
  person('cass', 'Cass Rune', 'lynx', 'keepers-hall', 'cass-post', [
    'Weather on the board. True odds in the Glass. You have everything I have.',
    'Keep the next creature in mind. This one won\'t do every job.',
    'We rang the bell for every traveler. We never rang it for a loser.',
    'I don\'t bluff. I don\'t need to. I tell you the weather and then I use it better than you.',
    'Lynxes see well in the dark. I can see you counting your Mends. Good. Keep counting.',
    'Bastien moves like a tide. I move like weather. Between us we make a climate.',
    'You came up the Long Road with PP to spare. Hollis will be insufferable about it. Let her.',
    'The bell\'s rung for you already. That\'s not a promise about the fight. It\'s a promise about the road.',
  ], { group: 'summit', voice: {
    morning: ['Morning. Clear on the board. That won\'t last. Nothing up here lasts but the brazier.'],
    evening: ['Evening. The cold comes up off the Bar like a tide. Stand near Bastien. He doesn\'t notice it.'],
    night: ['Night. My eyes are best now. Challenge me now if you want to lose with dignity.'],
    rain: 'Rain on the Summit. Slippery footing. Read your accuracy twice.',
    fog: 'Fog. I like fog. Everybody else has to guess. I only have to look.',
    storm: 'Storm on the Summit. The bell rings by itself in the wind. We don\'t count those.',
  } }),
  person('idris', 'Idris Fenwake', 'great northern diver', 'idris-hall', 'idris-dais', [
    'The ring held the same shape for thirty years. I called that care.',
    'Vesperay. Whatever it becomes, I will learn the name again.',
    'You may come before you light the lamp. Or after. I will be here.',
    'Please. Sit. ~ I speak slowly. It is not age. I am listening for the end of your sentence, in case it changes mine.',
    'Seraphine says I hold on. ~ She is right. She was always the better reader of the two of us. I taught her that, and then forgot it myself.',
    'Every challenger is kind to me. I wonder sometimes what I did to deserve that. Then I remember I am the last door.',
    'The anchor holds Vesperay still. It also holds me. I knew that, and I did it anyway.',
    'Thank you for coming up the long way. Most people forget there was a short one, once.',
  ], { group: 'summit', voice: {
    morning: ['Good morning. I watched the sun come up over the Bar. I do it every morning. It is the same sun. I am not sure I am the same diver.'],
    evening: ['Good evening. From up here the porches of Pellwick are very small. You can still count them. I count them.'],
    night: ['It is late. Vesperay is restless at night. So am I. We keep each other company, which is not the same as keeping each other.'],
    rain: 'Rain on the hall. It runs down the anchor chain like it is trying to wash something off.',
    fog: 'Fog. I cannot see the ring from here today. ~ That is almost a relief.',
    storm: 'A storm. Vesperay hates them. So, I find, do I. We sit out the worst of it together and pretend it is for the other\'s sake.',
  } }),
  person('merrow', 'Agathe Merrow', 'cormorant', P, 'merrow-anchorage', [
    'The stones stay licensed. The clinics will take your Forecasts.',
    'I nursed the harbor through that night. I will not pretend I forgot it.',
    'A stone is a choice. The person holding it should be told that.',
    'I keep the mourning band on. Not for show. It reminds me why the rules are there.',
    'Rules saved people the night the shapes went wrong. I will defend them until something saves more.',
    'If I have been mistaken, I will write it down. In full. In ink. ~ I find it difficult to say aloud. I am working on it.',
    'The license fee pays for the clinic. I know who it turns away. I keep a list of their names.',
    'Bring me your Forecasts. Not your opinions. Forecasts.',
  ], { group: 'faction', schedule: [at(hm(7), P, 'merrow-anchorage'), at(hm(19), 'cairnhold', 'merrow-memorial')], voice: {
    morning: ['Good morning. The clinic opens at seven. I open it. I have opened it every day for thirty years.'],
    evening: ['I go to the memorial in the evenings. I read the names. I do not need to. I know them.'],
    night: ['It is late. I sleep badly. I always have, since. The rules don\'t help with that. I had hoped they might.'],
    rain: 'Rain. The anchor stones go slick. Mind your grip; a dropped stone is a refused window wasted.',
    fog: 'Fog. On the night of wrong shapes there was fog. I don\'t care for it.',
    storm: 'A storm. The clinic stays open. Storms are when people need it.',
  } }),
  person('varga', 'Teo Varga', 'raccoon', P, 'varga-raft', [
    'Salt redraws the cards. Anybody selling you certainty has a crate to clear.',
    'Changed swimmers pulled us out of the drowning street. I owe them the rest of my life.',
    'Hollis offered to fund a clinic. Had to read the letter twice.',
    'Hold this. No, this end. ~ I fix things when I argue. Keeps my hands from saying what my mouth shouldn\'t.',
    'Mags Penny. Eighteen herring and a boat with a hole in the bow. The Mooring wanted a fee before they\'d read her. I remember every name. Every one.',
    'Starsalt pushes a Shift. On MY creatures, never yours. I post the Forecast first. That\'s more than the stone people do.',
    'You think I\'m angry? I\'m not angry. I\'m very, very awake.',
    'I worked in a Mooring lab once. Clean benches. Clean hands. I left with dirty ones and I sleep better.',
  ], { group: 'faction', absent: { day: { lte: 2 } }, schedule: [at(hm(2), P, 'varga-raft', { pose: 'sleep' }), at(hm(12), P, 'varga-raft')], voice: {
    evening: ['Evening! Raft\'s open, lights are up, odds are honest. Two of those are true every night.'],
    night: ['Late? The Raft runs till two. The fishers come after their boats are in. Somebody has to be open for them.'],
    rain: 'Rain! Tarp up. Hold that corner. No, the OTHER corner. ~ Thank you. You\'re hired. Unpaid.',
    fog: 'Fog. Fishers come in blind on a night like this. I put every lamp on the Raft. Let the Mooring count those.',
    storm: 'Storm. Raft\'s lashed. Crates are tied. I\'m not. I\'m checking on the boats.',
    sleep: '* Varga is asleep on a crate of salt with a half-mended lantern in his paws. He mutters a name, then another, then a third.',
  } }),
  person('dov', 'Dov Lattimer', 'kinkajou', P, 'dov-stall', [
    'Sealed crate. Contents listed. Suspense is free; the disc isn\'t.',
    'I count bids, not heartbeats. Take your time.',
    'No bid is an excellent bid if you need your buttons.',
    'Every disc fits somebody. The seed rolled them before you were born, practically. One of them is yours. Which one? That\'s the auction.',
    'Going once. ~ I always say it slowly. Nobody should lose a disc to a fast mouth.',
    'I hang upside down to count the crowd. Kinkajou. It\'s quicker. And the crowd looks friendlier.',
    'The tags show the technique and who can learn it. Read the tag. I\'ll wait. I like a reader.',
    'Sold! To the reader with the lantern. ~ Don\'t look so surprised. You bid.',
  ], { group: 'faction', topics: [topic('auction', 'dov-auction', 7, { repeatDays: 7, cond: { flag: 'sp.first-market' } })], voice: {
    morning: ['Morning. No auction in daylight. Daylight makes people sensible. Terrible for business.'],
    evening: ['Evening. Crates are stacked, tags are tied. Market night\'s Saturday. Bring your sensible face; I\'ll bring mine.'],
    night: ['Late. I\'m counting yesterday\'s bids again. Upside down. They add up the same either way.'],
    rain: 'Rain. Crates under canvas. Discs don\'t mind a drop. Bidders do.',
    fog: 'Fog. Can\'t see the back row. They can still raise a paw. I can still hear it.',
    storm: 'Storm. Auction\'s off. The crates are sulking under the tarp. So am I.',
  } }),
  person('pip', 'Pip', 'water rat', P, 'pip-quay', [
    'Dock hands get time off too. Mine\'s three turns long.',
    'Wirewhisk knows every rope on this quay. Some of them know him.',
    'You can say no. The tide won\'t report you.',
    'I check the bollards every morning. Nothing\'s ever tied to them. I check anyway. One day there\'ll be a boat.',
    'Maud lets me throw her the line when she comes in. It\'s the best part of my day. Don\'t tell her.',
    'Arc Ping goes first. Every time. It\'s just how he\'s wired. Ha. Wired. ~ I say that every time too.',
    'Two hundred buttons if you beat me. Don\'t tell Maud I bet. She disapproves of everything except ropes.',
    'I\'m going to crew on the first real boat out. When the bar\'s clear. I\'ve already got the knots.',
  ], { schedule: [at(0, P, 'pip-quay'), at(hm(7), P, 'pip-quay', { pose: 'path', path: 'pip-bollards', activity: 'checking the bollards' }), at(hm(9), P, 'pip-quay')],
    topics: [topic('duel', 'pip-before', 8, { cond: { all: [{ flag: 'sp.capture-stance' }, { not: { flag: 'sys.trainer.pip' } }] } })], voice: {
      morning: ['Morning! Bollards checked. All present. None drifted. Personal best.'],
      evening: ['Evening. Quay\'s quiet. I like it quiet. Wirewhisk likes it loud. We take turns.'],
      night: ['Night shift. I\'m not on night shift. I just like the quay at night. The water talks.'],
      rain: 'Rain. Ropes go heavy. Good practice. Everything\'s good practice.',
      fog: 'Fog on the quay. I\'ve got the bell. If you hear it, that\'s me, not a ghost. Probably.',
      storm: 'Storm! Everything\'s tied down twice. I tied it. Three times.',
    } }),
  person('the-thatch', 'The Thatch', 'finches', P, 'ambrose-bench', [
    'Tie it! Over, under, tight!',
    'Nobody fell! Breakfast!',
    'Seed paid. Pegs counted. Roof yours.',
    'Five-forty! Five-forty! Roof time!',
    'Straw! Straw! Who has the straw? ~ Everyone has the straw!',
    'One knot each! Two knots each! ~ Somebody tied the wrong end! ~ It holds! It holds!',
    'Ambrose says alder! Alder it is!',
    'Look up! Not at us! At the roof! ~ All right, at us a bit!',
  ], { group: 'fixture', voice: {
    morning: ['Up! Up! Roof\'s done! Seed now! Seed!'],
    evening: ['Roost! Roost! Same eave! Shove up!'],
    night: ['* A row of small round finches asleep along the eave, packed so tight that one sneeze would knock off three.'],
    rain: 'Wet! Wet! Under the eave! Shove up! SHOVE UP!',
    fog: 'Where\'s the roof? ~ Here\'s the roof! ~ That\'s a hat! ~ It\'s a good hat!',
    storm: '* The Thatch are pressed in a row under the deepest eave, every one of them facing the same way, every one of them pretending to be brave.',
  } }),
  person('isolde', 'Isolde Petrel', 'storm petrel', 'int-lighthouse', 'isolde-desk-front', ['* A clean space on the desk where a letter used to be.'], { group: 'absent', absent: true }),
  person('mabry', 'Mabry Coil', 'garden snail', 'int-post-office', 'mabry-daybook-front', ['* The day book is closed. There is a ribbon marking tomorrow.'], { group: 'absent', absent: true }),
  person('hobb-fallow', 'Hobb Fallow', 'brown hare', 'lowmoor', 'hobb-pavilion', [
    'Short way at low tide. Boardwalk at every tide. The board has both.',
    'Maud\'s practice table is by the pavilion. She\'s patient. Don\'t tell her I said that.',
    'No badge to walk here. No badge to go anywhere round the ring.',
    'I chalk the tide board every morning. Wrong, sometimes. Never twice in a row.',
    'Linnet reads my board out loud on her way past. Very loud. She says I mumble. I do mumble. It\'s a hare thing.',
    'The stones go under at the turn. Don\'t race them. They win.',
    'Brackenford\'s been a ferry dock since before the Ebb. The pavilion\'s newer. Only ninety years.',
  ], { schedule: [at(hm(9), 'lowmoor', 'hobb-pavilion', { pose: 'path', path: 'hobb-tide-round', activity: 'chalking the tide board' }), at(hm(10), 'lowmoor', 'hobb-pavilion', { activity: 'at the pavilion' })],
    templates: islePost('lowmoor', 'hobb-pavilion'), voice: {
      morning: ['Morning. Board\'s chalked. Low at the time it says, give or take a hare.'],
      evening: ['Evening. Last crossing\'s gone. You can still walk the boardwalk. It doesn\'t close. It just gets dark.'],
      rain: 'Rain\'s washing my chalk off. I\'ll chalk it again. Board\'s never been right two days running, but it\'s never been blank.',
      fog: 'Fog on the moor. Stick to the boardwalk. The short way is shorter if you can see it.',
      storm: 'Storm. Board says "no". That\'s all I\'ve chalked. It\'s accurate.',
      sleep: '* Hobb is asleep in the pavilion doorway, ears folded flat, chalk dust all down his front.',
    } }),
  person('wynn-cobble', 'Wynn Cobble', 'dormouse', 'cairnhold', 'wynn-clinic', [
    'One stone refuses one window. It doesn\'t remove the next.',
    'The clinic sells anchors, Still Knots and Crackdust. The explanation is free.',
    'If you want to release a knot, put the creature first and the knot second.',
    'I\'ll write it down for you. Dosage, window, what to watch. People forget in the excitement. I forget in the quiet.',
    'The fee isn\'t mine. I just take it. I hand back the change very carefully, so nobody feels rushed.',
    'Mostly I tell people to wait. Waiting is the cheapest anchor there is.',
    'I nap at noon. Dormouse. If the clinic bell rings, I wake. Ring it gently.',
  ], { templates: islePost('cairnhold', 'wynn-clinic'), voice: {
    morning: ['Good morning. Kettle\'s on, ledger\'s open, stones are counted. You\'re my first. Sit.'],
    evening: ['Evening. Clinic\'s nearly shut. I\'ll see you anyway. I always see the last one.'],
    rain: 'Rain. Quarry dust turns to paste. Wipe your feet. Wipe your creature\'s feet.',
    fog: 'Fog off the quarry. Breathe through your sleeve if you\'ve come up the steps.',
    storm: 'Storm. The clinic stays open. Storms are when Shifts come early.',
    sleep: '* Wynn is curled up asleep behind the clinic counter on a folded blanket, tail over her nose.',
  } }),
  person('quill-hartsease', 'Quill Hartsease', 'hedgehog', 'cairnhold', 'quill-memorial', [
    'Every name belongs to a boat. Every boat brought its people home on foot.',
    'Wrong shapes, they called them. I write changed shapes on the new plaque.',
    'Keep your lantern. The memorial doesn\'t need it more than you do.',
    'I polish one name a day. It takes a year to get round them all. Then I start again.',
    'People leave shells on the step. I don\'t move them. They\'re words people couldn\'t find.',
    'Merrow comes every evening. She doesn\'t need to read the names. I leave her alone with them.',
    'The Night of Wrong Shapes. ~ I was nine. I remember the quiet afterwards more than the noise.',
  ], { templates: islePost('cairnhold', 'quill-memorial'), voice: {
    morning: ['Morning. Today\'s name is a fisher called Hal. He had a laugh you could hear from the quarry. That\'s all I know. It\'s enough.'],
    evening: ['Evening. The plaque catches the last light. Every name for about a minute. Then the stone again.'],
    rain: 'Rain on the plaque. It cleans better than I do. I let it.',
    fog: 'Fog. The memorial goes quiet in fog. Quieter. I didn\'t think it could.',
    storm: 'Storm. I sit with the names on storm nights. Somebody should.',
    sleep: '* Quill is asleep on the memorial step, curled into a ball with only the tip of a nose showing.',
  } }),
  person('mags-penny', 'Mags Penny', 'herring gull', 'cairnhold', 'mags-dock', [
    'They wanted a license fee before they\'d look at the Forecast. I wanted them to look first.',
    'My boat is small. My fish are excellent. My paperwork is neither.',
    'I\'ll take the long road. It stays where you put it.',
    'Varga remembers my name. The anchor office remembers my fee. One of those is a friend.',
    'Herring, eighteen. Mackerel, two. A boot. A very good boot. I\'m keeping the boot.',
    'Don\'t feed me chips. I\'m a gull. I\'ll want them. I\'ll take them. I\'ll hate myself. Mostly I\'ll have the chips.',
    'There\'s a hole in the bow I patch every week. It\'s practically a door now. Fish come in to look.',
  ], { templates: islePost('cairnhold', 'mags-dock'), voice: {
    morning: ['Morning! Boat\'s out at five, back at eight, the herring are in a mood. So am I. Good mood. Mostly.'],
    evening: ['Evening. Nets drying. Gulls circling. Not me. I\'m a professional.'],
    rain: 'Rain! Fish bite in the rain. I bite in the rain. Everybody\'s biting.',
    fog: 'Fog. I go by the smell of the quarry dust. It\'s never let me down. Once. Twice. It\'s let me down twice.',
    storm: 'Storm. Boat\'s up the slip. I\'m up the slip with it. We\'re both sulking.',
    sleep: '* Mags is asleep standing up on the end of the dock, one leg tucked, head under a wing, facing the sea.',
  } }),
  person('gorse-abernethy', 'Gorse Abernethy', 'marmot', 'emberstep', 'gorse-spa', [
    'Steam, ash, squall, clear. Three turns each. Towels are not weatherproof.',
    'That lightning out on the ridge has a tail. Augusta will want a note.',
    'The terrace is warm even in rain. That\'s the whole recommendation.',
    'I whistle when the steam\'s right. ~ That was it. That was the steam being right.',
    'Ines runs the Spire. I run the towels. Between us, nobody leaves cold.',
    'Sit on the warm rock. It\'s been warm for six hundred years. It can manage you.',
    'Marmots hibernate. I don\'t. I just sit very still near the pools from about October.',
  ], { templates: islePost('emberstep', 'gorse-spa', true), voice: {
    morning: ['Morning steam\'s the thickest. You can\'t see the terrace. You can hear me, though. I\'m here. Towel?'],
    evening: ['Evening soak\'s the best soak. The ash goes pink. Everybody goes quiet. Even Ines.'],
    rain: 'Rain on the terrace. Warm water below, cold water above. Best seat on the island.',
    fog: 'Fog and steam. Can\'t tell which. Doesn\'t matter. Both are free.',
    storm: 'Squall up on the ridge. That tailed lightning again. I\'ve written it down. Augusta can have the note.',
    sleep: '* Gorse is asleep on the warmest rock on the terrace, flat out, paws up, a towel over his face.',
  } }),
  person('teal-fenner', 'Teal Fenner', 'water shrew', 'drownwood', 'teal-poler', [
    'We take a pole to the drowned street. You can keep your feet dry if you listen.',
    'The Scatter got my aunt out. The Mooring brought blankets. I remember both.',
    'A changed body still knows where home was.',
    'Pole goes in on the left, out on the right. Don\'t help. Helping tips the punt.',
    'The street goes under at high water and comes back at the low. Like it\'s practising for something.',
    'Every stilt in Mossgate has a name. Wendel names them. I just lean on them.',
    'Shrews talk fast. I\'ll slow down for you. ~ That was slow. You\'re welcome.',
  ], { schedule: [at(hm(7), 'drownwood', 'teal-poler', { pose: 'path', path: 'teal-poling-round', activity: 'poling the boardwalks' }), at(hm(9), 'drownwood', 'teal-poler', { activity: 'at the poling post' })],
    templates: islePost('drownwood', 'teal-poler'), voice: {
      morning: ['Morning round done. Boardwalks, dock, boatyard, back. Eleven minutes. I\'m a shrew. We go.'],
      evening: ['Evening. Tide\'s coming in under the boards. You can feel it in your feet. That\'s Mossgate saying goodnight.'],
      rain: 'Rain. Everybody\'s wet anyway on Drownwood. Rain just makes it official.',
      fog: 'Fog on the street. Nobody poles alone. Take my line.',
      storm: 'Storm. Poles in, punts tied, everybody up on the high boards. We\'ve done this before.',
      sleep: '* Teal is asleep in the bottom of her punt, curled round the pole, rocking very gently on the dark water.',
    } }),
  person('rook-hayward', 'Rook Hayward', 'rook', 'thistlewind', 'rook-mill', [
    'The mill stopped. Every draft creature changed in the same minute. We unhooked the traces first.',
    'Tomorrow we\'ll fit the harnesses again. To whatever turned up.',
    'Windle keeps a spare of everything except people.',
    'The sails turned for ninety years. They\'ll turn again. I\'ve oiled them every morning since, so they know I mean it.',
    'My old draft ox is a heron now. ~ Same eyes. He still waits by the trough at four.',
    'The twins cleared the street in pairs. I carried tea. Somebody has to carry tea.',
    'Caw. ~ Sorry. Rook. It comes out when I\'m thinking.',
  ], { templates: islePost('thistlewind', 'rook-mill', true), voice: {
    morning: ['Morning. Oiled the sails. They didn\'t turn. They will. I\'m patient. I\'m a rook.'],
    evening: ['Evening. The moor goes quiet at this hour. Quieter since the mill stopped. I miss the creak.'],
    rain: 'Rain on the sails. Heavy canvas, no wind. A day for mending harness.',
    fog: 'Fog on the moor. You can hear the twins\' mills. Not mine. Not yet.',
    storm: 'Storm. Wind enough to turn ten mills. Mine still won\'t. It\'s waiting for something. So am I.',
    sleep: '* Rook is asleep on a sack of grain inside the mill door, beak tucked into his shoulder, one foot hooked through a harness ring.',
  } }),
  person('brannoch-vey', 'Brannoch Vey', 'ptarmigan', 'rimeholt', 'brannoch-cave-lamp', [
    'Three tiles of light in the caves. Take the path you can see.',
    'Idris is in the gallery sometimes. Watches his own reflection as if it might answer.',
    'A stoat came through in winter white. Had a small warm thing in her hood.',
    'I trim every lamp from the mouth to the mirror ice. Then I start again from the mouth. That\'s the job.',
    'Ptarmigan go white in winter. I\'ve been white for eleven winters running. The caves don\'t know what month it is.',
    'Seraphine says I\'m the best lamp-trimmer on the isles. I\'m the only lamp-trimmer on the isles. She knows that.',
    'Are you sure? ~ I ask everybody that, before the deep caves. Most people are. Some people turn round. Both are right.',
  ], { schedule: [at(hm(9), 'rimeholt', 'brannoch-cave-lamp', { pose: 'path', path: 'brannoch-lamp-round', activity: 'trimming the cave lamps' }), at(hm(11), 'rimeholt', 'brannoch-cave-lamp', { activity: 'at the cave lamp' })],
    templates: islePost('rimeholt', 'brannoch-cave-lamp', true), voice: {
      morning: ['Morning. Lamps trimmed to the mirror ice. Three tiles each. You\'ll see your feet. That\'s all you need.'],
      evening: ['Evening. Outside it\'s dusk. In here it\'s always lamp-time.'],
      rain: 'Rain at the mouth. Not in the caves. In the caves it\'s just drip. Drip has been going since before the Ebb.',
      fog: 'Fog at the mouth. Follow the lamps. They\'re where I put them.',
      storm: 'Storm outside. The deep caves don\'t hear it. Stay in a while if you like. The lamps don\'t mind company.',
      sleep: '* Brannoch is asleep beside the cave lamp, feathers puffed white, so still against the ice you almost miss him.',
    } }),
];

export const REMAINING_NPCS = folk;
