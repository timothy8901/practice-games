/**
 * The eighteen town letters (T1-T18). [DATA-LETTERS] GDD-08 §4.
 *
 * Each arrives the moment its find is pinned on Barnaby's string wall (`find`, mirrored in
 * `relicId` for the validator); any still locked once K20 has come arrive by morning post from
 * day 22, one a morning. They are documents, readable in any order: harbor notices (author null,
 * `byline`), Mabry Coil's post-office day book, Merrow's ward log and Ansel's report in three
 * parts plus the addendum he never sent. Global serial numbers: T = n 39-56.
 * Pure data: no imports, no function values in the export.
 * @module data/letters/town
 */

const NOTICE = { author: null, byline: 'Harbor notice', from: 'The harbor office', seal: 'harbor-office' };
const DAY_BOOK = { author: 'mabry', byline: 'Mabry Coil, post-office day book', from: 'Mabry Coil', seal: 'day-book' };
const WARD_LOG = { author: 'merrow', byline: 'Agathe Merrow, harbor ward log', from: 'Agathe Merrow', seal: 'ward-log' };
const REPORT = { author: 'ansel', byline: 'Ansel Stalk, harbormaster\'s report', from: 'Ansel Stalk', seal: 'harbormaster' };

/**
 * @param {number} i      position in the town channel (1-18)
 * @param {string} find   the find whose pin unlocks it
 * @param {Record<string, any>} voice   one of the author presets above
 * @param {Record<string, any>} row
 */
const t = (i, find, voice, row) => ({
  id: `t${i}`, n: 38 + i, index: i, channel: 'town',
  ...voice,
  to: 'The Commons board', addressee: null,
  find, relicId: find,
  deliver: { at: 'wall', find, postFromDay: 22 },
  unlock: null,
  ...row,
});

/** @type {ReadonlyArray<import('../index.js').Letter>} */
const TOWN = [
  t(1, 'ammonite', NOTICE, {
    date: 'March, the spring before',
    subject: 'Bar soundings: the channel shoaling.',
    reveal: [{ op: 'setFlag', id: 'np.augusta.soundings' }],
    body: 'HARBOR OFFICE — NOTICE TO MASTERS|Soundings across the harbor bar, taken at low water on the March springs:|North channel: four fathoms last spring, two and a half this. South channel: three fathoms, one and a half. The middle ground now dries at the lowest springs.|Masters of vessels drawing more than six feet are advised to cross on the top half of the tide only. The office is aware of the shoaling and is gathering opinions as to its cause.|By order, A. Stalk, Deputy Harbormaster',
  }),
  t(2, 'belemnite', DAY_BOOK, {
    date: '3 November, the Ebb winter',
    subject: 'The oil boat turned back; the keeper\'s letters went out.',
    reveal: [{ op: 'setFlag', id: 'np.hesper.day-book-oil' }],
    body: 'POST OFFICE DAY BOOK — M. Coil|3 Nov. Wet. Oil boat turned back off the bar again; no mail aboard for us either, so the sack is light both ways.|Keeper down from the point at noon with three letters: the harbor office, the Archive, and one addressed only "To the Keeper", which she asked me to hold, not post. Said keepers here write their log to the next one. Said it would keep. I put it in the blue pigeonhole.|Stamps sold: 4. Biscuits eaten: more than 4.',
  }),
  t(3, 'crinoid-stem', NOTICE, {
    date: '18 November, the Ebb winter',
    subject: 'Weir inspection deferred "until the mill is sold".',
    reveal: [{ op: 'setFlag', id: 'np.ansel.inspection-deferred' }],
    body: 'HARBOR OFFICE — MINUTE OF THE BOARD, 18 NOVEMBER|Item 4. A letter and drawing from the Keeper regarding the old mill weir on the north river. The Board notes that the weir is the private property of the Stalk estate, that the mill is offered for sale, and that the estate\'s agent asks that no works be undertaken while a sale is pending.|Resolved: inspection of the weir is deferred until the mill is sold.|Item 5. The quay lamps. Also deferred.',
  }),
  t(4, 'fossil-fern', DAY_BOOK, {
    date: '10 November, the Ebb winter',
    subject: 'The keeper posts a drawing to the harbor office.',
    reveal: [{ op: 'setFlag', id: 'np.hesper.day-book-drawing' }],
    body: 'POST OFFICE DAY BOOK — M. Coil|10 Nov. Keeper in again, brisk, with a long stiff envelope for the harbor office. A drawing, she said: the river, the weir, the bar, with arrows. She had drawn the arrows twice as thick as they needed to be. "In case," she said.|Young Stalk collected it himself at four. Opened it on the step, turned it round twice, said "Hm," and put it under his arm with the tide forms.|I don\'t think he knew which way up the river went.',
  }),
  t(5, 'urchin-cast', WARD_LOG, {
    date: '14 December, the Ebb winter',
    subject: 'Broth up the lighthouse stair; the keeper does not sleep.',
    reveal: [{ op: 'setFlag', id: 'np.merrow.ward-log-broth' }],
    body: 'HARBOR WARD — DAILY LOG, A. MERROW, NURSE|14 Dec. Ward: nine creatures, all marked, all settled after dusk. Took broth to the point at ten, as on every night this week. Keeper at the lamp. She had not slept; I could tell by yesterday\'s soup, untouched, with a skin on it you could stand a spoon in.|She thanked me and asked how many marks were glowing in the ward. I said nine. She wrote it in the second log. I asked what the second log was for. She said, "Weather."|I did not believe her. I left the broth.',
  }),
  t(6, 'old-shape-skull', WARD_LOG, {
    date: '2 January, the Ebb winter',
    subject: 'Creatures born before the hum carry no mark.',
    reveal: [{ op: 'setFlag', id: 'np.merrow.ward-log-unmarked' }],
    body: 'HARBOR WARD — DAILY LOG, A. MERROW|2 Jan. Count since the Night: forty-one creatures brought in who no longer answer to their people. Every one born this year or last carries a lit mark, and every one of those came to its owner\'s voice within the week, once the owner learned to look past the new shape.|The older ones carry no mark. Nineteen of them. They come to no voice. I have stopped writing "yet".|Recommendation to myself: find a way to stop this happening again. Any way.',
  }),
  t(7, 'brass-tide-gauge', NOTICE, {
    date: '12 December, the Ebb winter',
    subject: 'Notice to mariners: the light will burn nine more nights.',
    reveal: [{ op: 'setFlag', id: 'np.augusta.nine-more-nights' }],
    body: 'HARBOR OFFICE — NOTICE TO MARINERS, 12 DECEMBER|The Keeper reports oil sufficient for nine nights\' burning at full flame. The oil vessel will attempt the bar at the full moon.|Should that attempt fail, masters are advised that the light may go out on or about the night of the 21st, and that the fleet should be in harbor and moored before dusk on that date, weather permitting.|Weather, as of writing, is not permitting anything.|A. Stalk, Harbormaster',
  }),
  t(8, 'postmark-die', DAY_BOOK, {
    date: '28 February, the year after',
    subject: 'The last sack; the post office closes.',
    reveal: [{ op: 'setFlag', id: 'np.hesper.day-book-last-sack' }],
    body: 'POST OFFICE DAY BOOK — M. Coil|28 Feb. No boat since the Night, no mainland bag since, and the harbor office writes to say there is no money for a post office in a harbor with no harbor.|So. The last sack is sealed with everything undelivered in it, the Keeper\'s held letters tied in their own string. Hesper had half a round left. She cried, then finished sorting, then cried again. Good girl.|Closed at four. Locked the door. Kept the key.',
  }),
  t(9, 'fleet-tally-token', NOTICE, {
    date: '23 December, the Ebb winter',
    subject: 'Roll of the lost fleet.',
    reveal: [{ op: 'setFlag', id: 'np.bastien.fleet-roll' }],
    body: 'HARBOR OFFICE — ROLL OF THE FLEET, 23 DECEMBER|Vessels lost on the harbor bar on the night of the 21st:|Gannet · Brown Bess · Kittiwake · Three Sisters · Thole\'s Luck · Plenty · Ivy Rask · Merrow Maid · Long Odds · Good Morning · Grace (ferry)|Found in the north creek after the surge, unfit for sea: Tidy Sum (Brack), oyster boat, nameboard missing.|Draft creatures: see the harbor ward.|All hands safe ashore. The office records this twice, at the Harbormaster\'s request. All hands safe ashore.',
  }),
  t(10, 'skyglass-shard', WARD_LOG, {
    date: 'The night of the 21st, the Ebb winter',
    subject: 'The Night of Wrong Shapes, hour by hour.',
    reveal: [{ op: 'setFlag', id: 'np.merrow.ward-log-wrong-shapes' }],
    body: 'HARBOR WARD — LOG OF THE NIGHT OF THE 21ST, A. MERROW|18:00 Wind rising. Lamp lit. Fleet sighted beyond the bar, towing in.|21:40 Sky lit pink to the south-east. Every mark in the ward woke at once.|22:15 Glass falling. A sound like sleet on slate.|23:00 Ward creatures Shifting, all of them, one after another. None in pain. All frightened. So were we.|00:00 The lamp went out.|00:20 Shouting on the bar.|04:00 The last of the wading children brought in, cold, laughing about it.|06:00 I have run out of beds and words.',
  }),
  t(11, 'skyglass-bead', REPORT, {
    date: '27 December, the Ebb winter',
    subject: 'Report on the grounding of the fleet.',
    reveal: [{ op: 'setFlag', id: 'np.ansel.report-1' }],
    body: 'REPORT ON THE GROUNDING OF THE FLEET — A. STALK, HARBORMASTER|1. On the night of the 21st the fleet, eleven vessels and one oyster boat, approached the bar under tow by draft creatures, ahead of the gale.|2. At approximately midnight the harbor light went out.|3. At or near the same time the draft creatures Shifted in the traces and, being strange to their new bodies, could not hold the channel.|4. All vessels grounded. All hands waded ashore across the flats. No lives were lost.|5. Findings follow in Part II.',
  }),
  t(12, 'skyglass-knot', WARD_LOG, {
    date: '1 April, the year after',
    subject: 'Founding the Mooring: light calls the change.',
    reveal: [{ op: 'setFlag', id: 'np.merrow.ward-log-mooring' }],
    body: 'HARBOR WARD — LOG, A. MERROW, 1 APRIL|This morning the ward became the Mooring. Six of us signed. The rule is short, because rules should be: light calls the change.|We have seen it. The marks glow brighter at a lamp. Prismoths gather at every lit window. The tower was lit the night everything changed. Keep the lights low and the creatures steady, and nobody wakes to a stranger in the stall again.|We will license stones from Cairnhold to hold a Shift. We will tie Still Knots the way the keeper tied hers.|I am aware the keeper would disagree. She is not here.',
  }),
  t(13, 'cockle', DAY_BOOK, {
    date: '22 December, the Ebb winter',
    subject: 'Children wading home across the flats.',
    reveal: [{ op: 'setFlag', id: 'np.hesper.day-book-wading' }],
    body: 'POST OFFICE DAY BOOK — M. Coil|22 Dec. Nobody slept. The whole harbor waded in off the bar at the low, carrying lanterns, carrying each other. The little Dorrow on her father\'s shoulders, singing the whole way. The wombat from the blue-step house with three children who weren\'t his, one under each arm and one on his head.|Opened at six because people needed somewhere dry with a stove. Hesper made tea until the tin ran out.|Nobody drowned. I have written it here so I will believe it.',
  }),
  t(14, 'razor-shell', REPORT, {
    date: '27 December, the Ebb winter',
    subject: 'Finding: the light was out at midnight.',
    reveal: [{ op: 'setFlag', id: 'np.ansel.report-2' }],
    body: 'REPORT ON THE GROUNDING — PART II: FINDINGS|6. The harbor light was found out at midnight, the lamp dry.|7. The Keeper was not at the light. By her own account she was on the north river, attempting to open the mill sluice, which she believed related to the shoaling of the bar.|8. No evidence was put before this office connecting the river to the bar.|9. The masters state that had the light burned, they could have held the channel by eye despite the creatures.|10. The light did not burn.',
  }),
  t(15, 'sea-glass', NOTICE, {
    date: '9 January, the Ebb winter',
    subject: 'Ferry service suspended indefinitely.',
    reveal: [{ op: 'setFlag', id: 'np.maud.ferry-suspended' }],
    body: 'HARBOR OFFICE — NOTICE, 9 JANUARY|With the loss of the fleet, and the ferry Grace among it, the island ferry service is suspended indefinitely. Passengers for the isles may walk the causeways at low water at their own risk, and are reminded that the tide does not wait for anybody, however important they feel.|The mainland causeway remains open an hour either side of low. The office regrets any inconvenience, and also everything else.|A. Stalk, Harbormaster',
  }),
  t(16, 'cuttlebone', REPORT, {
    date: '27 December, the Ebb winter',
    subject: 'Recommendation: the keeper be relieved.',
    reveal: [{ op: 'setFlag', id: 'np.ansel.report-3' }],
    body: 'REPORT ON THE GROUNDING — PART III: RECOMMENDATION|11. That the Keeper, Isolde Petrel, be relieved of the light, with thanks for long service.|12. That the light remain unlit until oil can be landed and a new keeper found.|13. That the harbor office review its arrangements for the supply of oil.|I wish to record that the Keeper made no attempt to excuse herself, and answered every question put to her.|Respectfully submitted,|A. Stalk, Harbormaster',
  }),
  t(17, 'mermaids-purse', DAY_BOOK, {
    date: 'The third year after the closing',
    subject: 'Letters to the Outer Isles returned, no forwarding.',
    reveal: [{ op: 'setFlag', id: 'np.hesper.day-book-returned' }],
    body: 'POST OFFICE DAY BOOK — M. Coil (kept at home)|Third year since the closing. Wrote again to the keeper on the Outer Isles, care of the island packet. Came back again: NOT KNOWN AT THIS ADDRESS, NO FORWARDING.|She moves about. Her letters still find me, though, by fishing boat, by whoever is going: three this year, all "To the Keeper", all for the sack.|I keep them in order under the stairs, with the key. Somebody will reopen. Somebody will light it. I would like them read in the right order.',
  }),
  t(18, 'whelk-shell', REPORT, {
    date: 'Twenty years on (never sent)',
    byline: 'Ansel Stalk, addendum to the report (unsent)',
    subject: 'The weir. He did see the drawing, later.',
    reveal: [{ op: 'setFlag', id: 'np.ansel.addendum' }],
    body: 'ADDENDUM TO THE REPORT — NOT SENT|Twenty years on. Clearing my grandfather\'s desk I found the mill papers, and under them the keeper\'s drawing, which the Board had sent to the estate "for comment". My grandfather had written one word on it: "True."|The weir held the river. The river let the bar rise. She drew it, and I read the drawing as a complaint about property.|I have written this four times. It goes in the drawer with the others. Someone braver can post it.|A. Stalk',
  }),
];

export default TOWN;
