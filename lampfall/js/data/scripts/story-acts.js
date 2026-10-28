/**
 * Story beats the integrated build had no scene for (merged from Claude's stashed story chapter).
 * [DATA-SCRIPTS] GDD-00 §11, §8; GDD-07 §4-§9.
 *
 *  - `story-spire-<id>-enter`: the first step inside each of the six Spires (an `enter` trigger on
 *    the Spire's `from-door` cell, ./triggers.js). It frames the door and the dossier; the leader's
 *    own battle lines stay on the trainer row (GDD-04), so the leader is never re-staged here.
 *  - `story-spire-<id>-badge`: the seal and the reader tool it unlocks (GDD-00 §8 badge table:
 *    B3 the Scouting Prism from Corin, B5 the Weatherglass, B6 the Plumbline disc), queued by
 *    `badge:won:<id>`. Every gift is guarded by `hasItem`, so a replay never duplicates it.
 *  - `story-first-forecast-noted`: the first Forecast anywhere sets `sp.first-forecast`, so Corin on
 *    the Lowmoor stones knows you have already read one (`shift:resolved`).
 *  - `story-ration-ledger`: Hollis's parcel at the Bar head, the first time you walk the Bar.
 *
 * Pure data.
 * @module data/scripts/story-acts
 */

import { mk, tp, warpTo, camHome, flag, sfx, END } from './_stage.js';
import { SPIRE_BY_ID } from '../spires.js';

/**
 * The six Spires' entry and badge lines. `'warp'` steps outside onto the isle's `spire-step` with
 * Corin; `'give:<item>'` hands over a reader tool once.
 */
const SPIRE_BEATS = {
  turn: {
    door: [
      '* The Turn Spire is a round tower of tarred planks with a ship\'s wheel set into the floor of its hall, turning very slowly on its own.',
      'Maud: Challenger. ~ Two creatures, both will Shift, every strip posted a turn before it lands. You\'ll see the cards when I do.',
      'Maud: Read them. Then decide. Confirm?',
    ],
    badge: [
      'Maud: The Turn Seal. Goose feather, grey wax. ~ Starsalt\'s yours to spend now. Reroll: one pinch, then two, then four. Every window, the price starts at one again.',
      'Maud: Wren\'s ledger will show a notch from Hollis\'s fund. A share of whatever you owe. Spires pay toward roofs on this coast. ~ Confirm?',
      'Maud: …I\'ll take the nod.',
    ],
  },
  ward: {
    door: [
      '* The Ward Spire is cut stone, three courts stepping up to a dais. Two granite sentinels stand in the courts with their marks glowing, patient as gravestones.',
      'Osric: Slowly. ~ Read the shimmer on the sentinels first. They will teach you the tell before I do. They are better teachers than I am. They do not talk.',
    ],
    badge: [
      'Osric: The Ward Seal. A lattice cut in granite wax. I cut it this morning. ~ Slowly.',
      'Osric: The Lantern-paths will be lit between the Waystones you have touched. And Maud will not take your buttons any more; she has a soft spot for seals.',
      '* Pell\'s will stock Skyglass Wicks from tomorrow: better odds than a tallow wick, and they hum.',
    ],
  },
  weather: {
    door: [
      '* The Weather Spire is hot. Steam curls off the floor of its hall, and a chalkboard by the door shows the next three turns of weather, already posted.',
      'Ines: You will know before I do. ~ Well. At the same time. That is the point.',
    ],
    badge: [
      'Ines: The Weather Seal, sulphur-yellow. ~ Go out the front. Somebody is waiting for you who cannot see the steps very well.',
      'warp',
      'Corin: Keeper. ~ Give me the Glass a moment.',
      '* Corin clips a small prism of skyglass to the rim of your Reading Glass. It catches the light and splits it into colours you did not know you were missing.',
      'give:scouting-prism',
      'Corin: The Scouting Prism. Now when you Read, the Glass shows their moves, what they carry and how many Mends they have left. ~ She made it for me. I cannot use it any more. It should be used.',
      '* Pell\'s will stock Ethers from tomorrow.',
    ],
  },
  hollow: {
    door: [
      '* The Hollow Spire is a ship\'s hull turned upside down, its ribs for rafters, a plank walk winding up to a deck where a grebe in a tar-stained apron waits.',
      'Wendel: A hull is mostly what is not there. ~ So is my team. Plain and Grit go straight through them. Your menu will say so before you pick. Believe it.',
    ],
    badge: [
      'Wendel: The Hollow Seal. A hull rib in tar. ~ Corin can send a creature back to any shape it has worn now. Six Starsalt at the Archive. He calls it Recall. I call it a second launch.',
      '* One of the three coverage discs will sit face-up at Pell\'s from tomorrow.',
      { op: 'if', cond: { flag: 'sp.tamsin-arrived' }, then: ['Wendel: And tell Tamsin Brack my rollers are hers when she finds that name. She will know what I mean.'] },
    ],
  },
  relay: {
    door: [
      '* The Relay Spire turns. You feel it in your feet: the windmill outside drives the floor, three rings of it, slowly round.',
      'Ada: Three rounds. Two of yours each. Nobody fights twice.',
      'Ivo: Unless you have run out of nobodies.',
      'Ada: Then anyone can come back. We are not cruel.',
      'Ivo: We are twins.',
    ],
    badge: [
      'Ada: The Relay Seal. Two feathers crossed. One each.',
      'give:weatherglass',
      'Ada: Take the Weatherglass. Isle weather, and the Errants, on your map. ~ Ivo built it. I made it work.',
      '* The town can build a Training Yard on the green now, if the Commons Jar can stand it.',
    ],
  },
  mirror: {
    door: [
      '* The Mirror Spire is cold and bright. Every wall is ice polished to glass, and you are in all of them, a hundred Keepers deep.',
      'Seraphine: Two decoys at most. Three Mends each. True odds on every move. ~ Count first. Then swing.',
    ],
    badge: [
      'Seraphine: The Mirror Seal. Frosted white. ~ And this. It goes through every Ward and every veil, mine included. I would rather you had it than anyone.',
      'give:disc-plumbline',
      'Seraphine: Six seals. Hollis Brandt keeps the gate at the end of the Bar. He will want to see them. He will count them twice.',
    ],
  },
};

/** @param {string} id */
function spireEnter(id) {
  const s = SPIRE_BY_ID[id];
  const dais = mk(s.map, 'leader-dais');
  return [
    { op: 'camera', to: [dais.x, dais.y], ms: 900 },
    ...SPIRE_BEATS[id].door,
    camHome(500),
    // title and body on their own slips: the body alone fills a page (dialogue.pagesFor)
    `* A dossier is nailed inside the door: ${s.dossier.title}.`,
    `* ${s.dossier.text}`,
    END,
  ];
}

/** @param {string} id */
function spireBadge(id) {
  const s = SPIRE_BY_ID[id];
  const ops = [sfx('stamp'), `* The ${s.badge.name}: ${s.badge.seal}. It will hang on your tally wall with the split sticks.`];
  for (const line of SPIRE_BEATS[id].badge) {
    if (line === 'warp') ops.push(warpTo(s.isle, 'spire-step', 'down'), tp('corin', s.isle, 'spire-step', 1, 0));
    else if (typeof line === 'string' && line.startsWith('give:')) {
      const item = line.slice(5);
      ops.push({ op: 'if', cond: { not: { hasItem: item } }, then: [{ op: 'give', item, n: 1 }] });
    } else ops.push(line);
  }
  ops.push(END);
  return ops;
}

/** Spire ids in badge order (the keys of {@link SPIRE_BEATS}). */
export const SPIRE_BEAT_IDS = Object.freeze(Object.keys(SPIRE_BEATS));

const spireScripts = Object.fromEntries(SPIRE_BEAT_IDS.flatMap((id) => [
  [`story-spire-${id}-enter`, spireEnter(id)],
  [`story-spire-${id}-badge`, spireBadge(id)],
]));

export default {
  // the first Forecast anywhere: the flag even when Corin is not on the stones
  'story-first-forecast-noted': [
    flag('sp.first-forecast'),
    END,
  ],

  // the first step on the Bar: Hollis's Ration Ledger
  'story-ration-ledger': [
    '* At the Bar head, wedged between two stones above the tide line, there is a parcel in oilcloth tied with a quartermaster\'s knot. A label in square handwriting: FOR WHOEVER WALKS IT. — H.B.',
    { op: 'if', cond: { not: { hasItem: 'ration-ledger' } }, then: [{ op: 'give', item: 'ration-ledger', n: 1 }] },
    '* Inside, the Ration Ledger: ruled columns for PP, medicine and wicks, a page for every trainer on the Long Road, and a note on the flyleaf.',
    '* "No Waystone till my gate. Count what you carry. Then count it again. —Hollis Brandt, Hollis\'s Gate, the end of the Bar."',
    END,
  ],

  ...spireScripts,
};
