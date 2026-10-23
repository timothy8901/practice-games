/**
 * The letter serial: 20 Keeper + 18 family + 18 town + 2 event letters (58 rows). [DATA-LETTERS]
 * GDD-08; row contract ARCHITECTURE §14.8 plus the fields systems/letters reads.
 *
 * Row fields (every row):
 *  - `id` (manifest), `n` global serial 1-58 (what `{letter: {read: n}}` conds and world.letters
 *    store: K1-K20 = 1-20, F1-F18 = 21-38, T1-T18 = 39-56, E1-E2 = 57-58), `index` (position in the
 *    channel, so labels read K10 / F9 / T7 / E1), `channel` (keeper | family | town | event);
 *  - `author` (npc id: isolde, mabry, merrow, ansel; or null) and `byline` (display text when the
 *    author is not an npc), `from` / `to` (display), `addressee` (npc id, 'player' or null);
 *  - `seal` (a SEALS id), `date` (the postmark line), `subject` (one line for the Journal list);
 *  - `deliver` (the delivery rule, informational: K `{at:'mailbox', hour:6, day}`, F `{at:'counter',
 *    hour:18, day, carry:true}`, T `{at:'wall', find, postFromDay:22}`, E `{at:'event', event}`);
 *  - `unlock` (always null: the channel rules in systems/letters gate delivery), `relicId`;
 *  - `reveal` (ops run when read; only `setFlag` and `toast`), `flags` (the setFlag ids of
 *    `reveal`, so systems/letters.markRead sets them even if the host skips the ops);
 *  - `body`: the full text, `|` = paragraph break.
 * Family rows add `door` (porch id), `heirloom` (keepsake id or null), `creature` ({species, level}
 * or null) and, for F1/F5/F9/F13, `lightsPorch`. Town rows add `find` (= `relicId`). Event rows add
 * `event` ('lantern', 'saw-the-light').
 * @module data/letters
 */

import { deepFreeze } from '../ids.js';
import KEEPER from './keeper.js';
import FAMILY from './family.js';
import TOWN from './town.js';
import EVENT from './event.js';

/**
 * Wax seals and stamps a letter can carry (the letter reader draws the glyph in the colour; colour
 * is never the only tell: each seal has its own glyph and name).
 * @type {ReadonlyArray<{id: string, name: string, colour: string, glyph: string, text: string}>}
 */
export const SEALS = deepFreeze([
  { id: 'petrel', name: 'Petrel seal', colour: '#5B6E8C', glyph: 'petrel', text: 'Blue-grey wax pressed with a storm petrel in flight. Isolde\'s.' },
  { id: 'wax-red', name: 'Red wax', colour: '#A8323A', glyph: 'blot', text: 'Ordinary red sealing wax, thumbed flat.' },
  { id: 'harbor-office', name: 'Harbor office stamp', colour: '#2B3A67', glyph: 'anchor-ring', text: 'A blue ink ring: HARBOR OFFICE, an anchor in the middle.' },
  { id: 'day-book', name: 'Day-book page', colour: '#8C6A3E', glyph: 'string', text: 'A page torn from the post-office day book, tied with brown string.' },
  { id: 'ward-log', name: 'Ward-log pin', colour: '#7A8C74', glyph: 'pin', text: 'A log sheet held with a nurse\'s safety pin.' },
  { id: 'harbormaster', name: 'Harbormaster\'s seal', colour: '#6B4A2E', glyph: 'heron', text: 'Brown wax with the harbormaster\'s heron, slightly smudged.' },
  { id: 'outer-isles', name: 'Outer Isles postmark', colour: '#3B4A6B', glyph: 'wave', text: 'A new stamp and a wavy postmark: THE OUTER ISLES.' },
]);

/**
 * Adds `flags` (the setFlag ids of a row's reveal ops) so markRead sets them directly.
 * @param {Record<string, any>} row
 * @returns {Record<string, any>}
 */
const withFlags = (row) => ({
  ...row,
  flags: (row.reveal ?? []).filter((op) => op && op.op === 'setFlag').map((op) => op.id),
});

/**
 * Every letter, ordered by `n`.
 * @type {ReadonlyArray<import('../index.js').Letter>}
 */
export const LETTERS = deepFreeze([...KEEPER, ...FAMILY, ...TOWN, ...EVENT].map(withFlags).sort((a, b) => a.n - b.n));

/** Letters by channel, in channel order. */
export const LETTERS_BY_CHANNEL = deepFreeze({
  keeper: LETTERS.filter((l) => l.channel === 'keeper'),
  family: LETTERS.filter((l) => l.channel === 'family'),
  town: LETTERS.filter((l) => l.channel === 'town'),
  event: LETTERS.filter((l) => l.channel === 'event'),
});

export default LETTERS;
