/**
 * The twenty Keeper letters (K1-K20), Isolde Petrel to "the Keeper". [DATA-LETTERS] GDD-08 §2.
 *
 * One arrives in the 06:00 mailbox each morning, K1 on day 2 through K20 on day 21 (systems/letters
 * owns the rule; `deliver.day` records the target day). Together they are one gentle mystery that
 * explains why the light went out AND why creatures Shift: it was the same night. K1-K12 resolve it
 * (front-loaded so a 4-8 hour run reads the answer); K13-K20 are what she learned afterwards.
 *
 * Canon texts (GDD-00 §11, from the story concept) are kept, with the harbormaster renamed to Stalk:
 * K1, K2, K3, K4, K6, K8, K10. Bodies use `|` for a paragraph break. Global serial numbers: K = n 1-20.
 * Pure data: no imports, no function values in the export.
 * @module data/letters/keeper
 */

const TO = 'The Keeper, Point Cottage';

/**
 * @param {number} i   position in the Keeper channel (1-20)
 * @param {Record<string, any>} row
 */
const k = (i, row) => ({
  id: `k${i}`, n: i, index: i, channel: 'keeper',
  author: 'isolde', byline: null, from: 'Isolde Petrel', to: TO, addressee: 'player', seal: 'petrel',
  deliver: { at: 'mailbox', hour: 6, day: i + 1 },
  relicId: null, unlock: null,
  ...row,
});

/** @type {ReadonlyArray<import('../index.js').Letter>} */
const KEEPER = [
  k(1, {
    date: '2 November, the Ebb winter',
    subject: 'The light is fine; the river is wrong.',
    reveal: [{ op: 'setFlag', id: 'np.ansel.heard-k1' }],
    body: 'To the Keeper,|If you\'re reading this, someone has reopened the post, and I owe them an apology for my handwriting. The oil boat turned back again. Its keel touched the bar at half tide, where last spring it cleared at low. The sea isn\'t building that bar. The river has stopped pushing it away. I\'ll walk up the valley Sunday and see what\'s gone quiet.|The light is fine. It\'s the river that\'s wrong.|—I.',
  }),
  k(2, {
    date: '9 November, the Ebb winter',
    subject: 'A mill weir, two generations old.',
    reveal: [{ op: 'setFlag', id: 'np.ansel.weir-named' }],
    body: 'To the Keeper,|The valley is quiet because of a wall. A mill weir, two generations old, the mill long gone, the wheel seized with rust. The Stalk mill, the sign says, though nobody has milled there in my time. It holds back a hand\'s depth of river, and that hand is what used to scour the bar.|I have written to the harbor office. I\'ve drawn it for them. Young Stalk writes a good report and reads a poor drawing.|Keep the wick trimmed.|—I.',
  }),
  k(3, {
    date: '20 November, the Ebb winter',
    subject: 'The sea hums; a wanderer on a thirty-year road.',
    reveal: [{ op: 'setFlag', id: 'np.corin.wanderer-letter' }],
    body: 'To the Keeper,|Three nights of the sea humming. Not the wind. The creatures hear it before I do; the Siltback sits on the gallery rail facing south-east like a dog at a door. There is a light in the sky there that was not there in autumn. A wanderer, the almanac says, on a thirty-year road.|I\'ve started a second log for it beside the tides. Two clocks now.|—I.',
  }),
  k(4, {
    date: '28 November, the Ebb winter',
    subject: 'Something on the Siltback\'s brow glows.',
    reveal: [{ op: 'setFlag', id: 'np.corin.lean-letter' }],
    body: 'To the Keeper,|Something on the Siltback\'s forehead glows when the hum is loud. A small four-point thing, the colour of nothing I own. She is not hurt. She is, if anything, pleased. I can see which way she leans — I don\'t know how else to say it. Towards something larger.|I am going to write that down and feel foolish later.|—I.',
  }),
  k(5, {
    date: '5 December, the Ebb winter',
    subject: 'Merrow\'s ward, and her broth.',
    reveal: [{ op: 'setFlag', id: 'np.merrow.broth-letter' }],
    body: 'To the Keeper,|Agathe Merrow came up the stair tonight with broth and a ward list. Eleven creatures at her clinic with the same small mark, all born this year; their elders have none. She asked if it was catching. I said I thought it was listening.|The Siltback is the oldest she has seen marked. I think that is because she has been listening longest. Every mark in the room glowed brighter when I turned up the lamp. Merrow did not like that, and said nothing, which from Merrow is a paragraph.|—I.',
  }),
  k(6, {
    date: '12 December, the Ebb winter',
    subject: 'Oil for nine nights. The lamp or the wheel.',
    reveal: [{ op: 'setFlag', id: 'np.augusta.nine-nights' }],
    body: 'To the Keeper,|Oil for nine nights. The boat will try the bar at the full moon. If it fails, I will have to choose between the lamp and the wheel, and I know already which one I will choose, because a wheel can be turned and a bar cannot be lowered by wishing.|Merrow sends up broth and does not ask. Stalk sends up a form.|—I.',
  }),
  k(7, {
    date: '16 December, the Ebb winter',
    subject: 'The fleet\'s bell on the Old Quay.',
    reveal: [
      { op: 'setFlag', id: 'th.the-bell.located' },
      { op: 'toast', text: 'Barnaby will want to hear where the bell went.' },
    ],
    body: 'To the Keeper,|The oil boat tried the bar at the full moon and backed off it like a cat off a hot stove. So: the lamp has what it has.|The fleet\'s bell still hangs at the end of the Old Quay, where the boats ring in. Hal Gannet says if the bar keeps rising the swell will come round and take the quay, bell and all. I told him a bell goes with the quay if the bar takes it, and the quay goes nowhere I can\'t find it.|If it does go, dig at a big low. Bells don\'t float.|—I.',
  }),
  k(8, {
    date: '22 December, before dawn',
    to: 'Whoever keeps the light after me',
    subject: 'The storm night.',
    reveal: [{ op: 'setFlag', id: 'np.merrow.storm-letter' }],
    body: 'To whoever keeps the light after me.|The night of the storm I filled the lamp from the last can and took the Siltback up the valley. The wanderer came down while we were at the wheel. It broke. The sky went the colour of that mark on her forehead and the shards came down like sleet into the river. She Shifted under my hands into something that did not know me, and the wheel needed two of us.|I came back down to a dark tower and a harbor full of wrong shapes. I don\'t know yet what happened on the bar. I know what I\'d have seen from the gallery if I\'d stayed.|—I.',
  }),
  k(9, {
    date: '23 December, the Ebb winter',
    subject: 'The morning after.',
    reveal: [{ op: 'setFlag', id: 'th.empty-creek.morning-after' }],
    body: 'To the Keeper,|Morning. Every boat is on the bar or under it. Every soul waded home across the flats, the children on shoulders, which is the only sentence in this letter I will read twice.|Young Stalk was on the quay before light with a notebook. He was kind about it. He asked what time the lamp went out and I told him: midnight. He wrote it down. That is what a report is.|At dawn something with grey wings came and sat on the gallery rail, facing south-east. There is a small four-point mark on its brow, in exactly the place hers was.|—I.',
  }),
  k(10, {
    date: '6 January, the Ebb winter',
    subject: 'A read Shift is a Shift survived.',
    reveal: [{ op: 'setFlag', id: 'np.merrow.read-shift-letter' }],
    body: 'To the Keeper,|They were right to name me. Not for the reason in the report. I was the only one on the coast who could see the marks lean, and I went up a valley with that instead of standing in the harbor reading them home. Merrow\'s ward is full of creatures with lit marks and no owners who know them. If I had read them, they\'d have been Shifts, not accidents.|A read Shift is a Shift survived. I\'m going out to the Isles to learn how.|Keep the wick trimmed, whoever you are.|—I.',
  }),
  k(11, {
    date: 'February, the lagoon crossing',
    subject: 'A fire on Shardcrown.',
    reveal: [{ op: 'setFlag', id: 'np.bastien.brazier-letter' }],
    body: 'To the Keeper,|The punt that took me out crossed water that was fields last year; the wanderer dug itself a lagoon. In the middle there is a new island of glass and rubble the fishers already call Shardcrown.|There is a fire on top of it. A salvage diver, a young mink, carried coal up in a sack because the tower was dark and the boats still need something to steer by. He says he and his cousins will keep it until the tower is lit, "whoever\'s tower, whoever lights it."|I gave him my spare oil. It isn\'t enough. Nothing is enough. It\'s still a fire.|—I.',
  }),
  k(12, {
    date: 'March, the Outer Isles',
    subject: 'Light doesn\'t call the change. It shows it.',
    reveal: [{ op: 'setFlag', id: 'th.heirlooms-going-home.lantern-named' }],
    body: 'To the Keeper,|Merrow has written to me, in the formal way she writes when she means it. She says the marks glow at lamps, Prismoths crowd every harbor light, and so light calls the change. She means to keep the tower dark.|She is half right, which is the most dangerous amount. Light doesn\'t call the change. It shows it. A mark glows so you can read which way it leans, in time to choose.|I left my lantern on the counter at Pell\'s the night I went, for whoever comes. It will be dusty. Light it anyway.|—I.',
  }),
  k(13, {
    date: 'Summer, the first year, the Outer Isles',
    subject: 'The first deliberate Forecast.',
    reveal: [{ op: 'setFlag', id: 'np.corin.skeinwing-letter' }],
    body: 'To the Keeper,|She found me. The grey-winged one crossed forty miles of open sea and landed on my washing line. The islanders here call her kind a skeinwing. I had already called her by her old name, and she came to it.|Her mark glowed again this week. This time I sat her by the lamp and looked properly: three ways she might go, one a little likelier than the others, none of them a stranger. I told her what I saw. Then I let her choose, and held her while she did.|It was the first time I wasn\'t afraid of one.|—I.',
  }),
  k(14, {
    date: 'Autumn, the second year, the Outer Isles',
    subject: '"He wrote what he could see."',
    reveal: [{ op: 'setFlag', id: 'np.ansel.forgiven' }],
    body: 'To the Keeper,|A copy of the harbor report reached me here, two years late, wrapped round a parcel of salt fish. I read it standing up.|It\'s a good report. Times, tides, names, the hour the lamp went out. Every line of it is true. He wrote what he could see, and nobody had shown him the rest, because the one drawing that would have was mine and I drew it badly.|If you meet Ansel Stalk, tell him the keeper says it\'s a good report. Tell him she\'d like the drawing back.|—I.',
  }),
  k(15, {
    date: 'Spring, the fifth year, the Outer Isles',
    subject: 'An apprentice with failing eyes.',
    reveal: [{ op: 'setFlag', id: 'np.corin.apprentice-letter' }],
    body: 'To the Keeper,|I have an apprentice. An owl, twelve years old, who has squinted at lamps since he could fly and thinks that is why he can see the lean. It might be. His eyes won\'t last; the doctor here says so, and so does he, cheerfully, which I find very hard.|So I teach him to say it out loud. Look before you swing, then say what you see. Words keep when eyes don\'t.|He answers every question with another one. I\'m told I used to.|—I.',
  }),
  k(16, {
    date: 'Winter, the ninth year, the Outer Isles',
    subject: 'What rides the wanderer.',
    reveal: [{ op: 'setFlag', id: 'np.varga.passenger-letter' }],
    body: 'To the Keeper,|I have finally read the old almanacs properly. The wanderer comes every thirty years, and every time, somebody on some coast writes down a creature on the shore after: big as a boat, a different shape each time they looked, gone with the comet.|I think the wanderer carries a passenger. I think it is alone up there, and thirty years is a long time to be alone in the dark, and that is why it drinks light. Not to change us. To find somewhere lit to land.|Merrow would call that sentimental. Merrow would also leave a lamp on.|—I.',
  }),
  k(17, {
    date: 'Summer, the fourteenth year, the Outer Isles',
    subject: 'The hum is a tide, not a storm.',
    reveal: [{ op: 'setFlag', id: 'np.merrow.tide-letter' }],
    body: 'To the Keeper,|The hum is quieter every year, and steadier. I have kept the second log all this while beside the tides, and the two curves have started to agree. The heart of the wanderer, the big shard it carries, pulls on the marks the way the moon pulls on the water: in and out, on a clock.|That night was a storm because nobody knew the tide was coming. Know the tide, and a storm is only weather.|If anyone lights the tower again, chalk the windows on the tide table. Let the whole town read them a tide ahead.|—I.',
  }),
  k(18, {
    date: 'Spring, the twentieth year, the Outer Isles',
    subject: 'Anchor and salt: both half right.',
    reveal: [
      { op: 'setFlag', id: 'np.merrow.half-right' },
      { op: 'setFlag', id: 'np.varga.half-right' },
    ],
    body: 'To the Keeper,|They tell me Merrow has a Mooring now, with licences and stones from Cairnhold, and a young man called Varga has left her laboratory to shake the marks with salt instead. Each writes to me to say the other is a danger. Each is right.|An anchor is a fine thing to own and a poor thing to live in. Salt is a fine thing to spend and a poor thing to drink. Keep both in the house. Read first, then reach for whichever the creature needs, not whichever you\'re afraid of.|—I.',
  }),
  k(19, {
    date: 'Autumn, the twenty-sixth year, the Outer Isles',
    subject: 'The wanderer\'s return, counted.',
    reveal: [{ op: 'setFlag', id: 'np.wick.slow-flame' }],
    body: 'To the Keeper,|By my count, and the second log\'s, and three almanacs\', the wanderer comes back in four years, near the end of a winter. Low, slow, and looking for a light.|I am too old to climb a stair with any dignity, and nobody on that coast wants me on it. But someone will be there. Someone always walks in eventually; it\'s the one thing tides and towns agree on.|If it\'s you: the lamp takes a slow flame. Light it from a lantern, not a match. Then stand where it can see you.|—I.',
  }),
  k(20, {
    date: 'Spring, the twenty-ninth year, the Outer Isles',
    subject: 'Keep the wick trimmed.',
    reveal: [{ op: 'setFlag', id: 'np.hesper.last-keeper-letter' }],
    body: 'To the Keeper,|This is the last one I\'ll send this way. Mabry has kept every letter, she tells me, in the old sack under her stairs. Order is a kindness, she says, so they will reach you in the order I wrote them, a little late.|Here is everything I know, in one line: pay attention, and pay what you owe, and when something you love starts to change, sit with it in the light and read it before you choose.|The rest is wicks and weather.|Keep the wick trimmed.|—Isolde Petrel, Keeper (retired, under protest)',
  }),
];

export default KEEPER;
