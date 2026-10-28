/**
 * The Shift Tide line (GDD-00 §2 `lit.shiftTide`; GDD-09 §3 Tide Table): after the Relighting every
 * pending Shift window is chalked a tide ahead on the Tide Table board and the Day Page, with its
 * three cards already drawn.
 *
 * The cards are the Forecast the window will show: `systems/forecast.rollForecast` reads the
 * creature's own Shift stream at `creature.shiftCount` and consumes nothing, so the cards previewed
 * here are the cards the Forecast scene draws (same tuning, dial rules and `lit.steadied` as
 * scenes/forecast `buildOpts`) until a Reroll, a Bond pip or a held tilt changes them. The picked
 * card is never shown: the flip stays the Forecast's.
 *
 * Read-only, no DOM. [FLOW]
 * @module systems/flow/shiftTide
 */

import { shiftTideLines } from '../../state/selectors.js';
import * as forecast from '../forecast.js';
import * as flags from '../flags.js';
import { tuningFor } from './battleFlow.js';
import { t } from '../../data/strings.js';

/** @typedef {import('../../state/schema.js').World} World */

/**
 * @typedef {Object} ShiftTideCard
 * @property {'up'|'side'|'down'} dir
 * @property {string|null} formId   null for an empty card
 * @property {string} name          form display name ('?' while drawn as a silhouette)
 * @property {number} odds          whole percent
 * @property {boolean} silhouette
 * @property {boolean} starTouched
 */

/**
 * @typedef {Object} ShiftTideRow
 * @property {string} uid  @property {string} nick  @property {string} speciesId  @property {number} level
 * @property {ShiftTideCard[]} cards   up, side, down ([] when this creature cannot draw a Forecast)
 * @property {string} text             the row as one line: the chalked line and the three cards
 */

/** The dial's data rules, as the Forecast scene passes them. */
function dialRules(world, data) {
  let row = null;
  try { row = data && typeof data.tryGet === 'function' ? data.tryGet('dials', world.run.dial) : null; } catch { row = null; }
  if (!row) return null;
  return { ...(row.rules || {}), poolWeights: row.shift ? row.shift.poolWeights : undefined };
}

/** A form's display name, or its id. */
function formName(data, id) {
  try { return data.get('species', id).name ?? id; } catch { return id; }
}

/**
 * One row per pending Shift window once `lit.shiftTide` is set (selectors.shiftTideLines order), each
 * with its three cards pre-drawn. [] before the Relighting.
 * @param {World} world
 * @param {any} data   the registry
 * @returns {ShiftTideRow[]}
 */
export function shiftTideRows(world, data) {
  const rows = shiftTideLines(world);
  if (!rows.length) return [];
  let tuning = null;
  try { tuning = tuningFor(data); } catch { tuning = null; }
  const opts = { tuning, dial: world.run.dial, steadied: flags.hasFlag(world, 'lit.steadied'), rules: dialRules(world, data) };
  return rows.map((r) => {
    /** @type {ShiftTideCard[]} */
    let cards = [];
    try {
      const fc = forecast.rollForecast(world, r.uid, data, opts);
      cards = fc.cards.map((c) => ({
        dir: c.dir, formId: c.formId, odds: c.odds, silhouette: !!c.silhouette, starTouched: !!c.isStarTouched,
        name: c.formId === null ? '' : c.silhouette ? '?' : formName(data, c.formId),
      }));
    } catch { cards = []; }
    const head = t('board.shiftTideLine', { nick: r.nick });
    const shown = cards.filter((c) => c.formId !== null)
      .map((c) => t('board.shiftTideCard', { lean: t(`board.lean.${c.dir}`), form: c.name, n: c.odds }));
    return { ...r, cards, text: shown.length ? `${head}: ${shown.join(', ')}` : head };
  });
}
