/**
 * DATA.moves: the 64 techniques + Scrap, one file per type (ARCHITECTURE §14.3). [GDD-04 BATTLE]
 *
 * Order is chart order (Plain .. Hollow, Star, then the typeless rows). `MOVES` is the table the
 * orchestrator wires into `js/data/index.js`; `MOVE_BY_ID` and `SCRAP` are conveniences.
 * Prototype rows (proto/battle/moves.js) keep their ids and numbers; the 11 new rows follow GDD-ids §5.
 * @module data/moves/index
 */
import plain from './plain.js';
import grit from './grit.js';
import brine from './brine.js';
import kiln from './kiln.js';
import moss from './moss.js';
import bolt from './bolt.js';
import rime from './rime.js';
import gust from './gust.js';
import stone from './stone.js';
import rust from './rust.js';
import glass from './glass.js';
import hollow from './hollow.js';
import star from './star.js';
import typeless from './typeless.js';

/** @type {ReadonlyArray<Readonly<import('../index.js').Move>>} */
export const MOVES = Object.freeze([
  ...plain, ...grit, ...brine, ...kiln, ...moss, ...bolt, ...rime, ...gust, ...stone, ...rust, ...glass, ...hollow, ...star, ...typeless,
]);

/** Moves keyed by id. */
export const MOVE_BY_ID = Object.freeze(Object.fromEntries(MOVES.map((mv) => [mv.id, mv])));

/** Scrap, the no-slot fallback when every move is at 0 PP. */
export const SCRAP = MOVE_BY_ID.scrap;

export default MOVES;
