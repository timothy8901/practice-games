/**
 * MAPS: every map in LAMPFALL, one file each, in MAP_IDS order (GDD-00 §16: 24 maps). [DATA-MAPS]
 *
 * `pellwick.js` is authored (GDD-01 §5); files whose default export carries `stub: true` are minimal
 * valid stand-ins the isle, interior and summit authors replace in place (GDD-01 §3). Keep the import
 * list in MAP_IDS order; `test/data.world.test.mjs` checks it against `ids.manifest.MAP_IDS`.
 * @module data/maps/index
 */

import pellwick from './pellwick.js';
import lowmoor from './lowmoor.js';
import cairnhold from './cairnhold.js';
import emberstep from './emberstep.js';
import drownwood from './drownwood.js';
import thistlewind from './thistlewind.js';
import rimeholt from './rimeholt.js';
import theBar from './the-bar.js';
import spireTurn from './spire-turn.js';
import spireWard from './spire-ward.js';
import spireWeather from './spire-weather.js';
import spireHollow from './spire-hollow.js';
import spireRelay from './spire-relay.js';
import spireMirror from './spire-mirror.js';
import intCottage from './int-cottage.js';
import intPells from './int-pells.js';
import intPostOffice from './int-post-office.js';
import intArchive from './int-archive.js';
import intYardShed from './int-yard-shed.js';
import intLighthouse from './int-lighthouse.js';
import hollisGate from './hollis-gate.js';
import keepersHall from './keepers-hall.js';
import idrisHall from './idris-hall.js';
import lanternStack from './lantern-stack.js';

/** @type {ReadonlyArray<import('../index.js').MapDef>} */
export const MAPS = Object.freeze([
  pellwick, lowmoor, cairnhold, emberstep, drownwood, thistlewind, rimeholt, theBar,
  spireTurn, spireWard, spireWeather, spireHollow, spireRelay, spireMirror,
  intCottage, intPells, intPostOffice, intArchive, intYardShed, intLighthouse,
  hollisGate, keepersHall, idrisHall, lanternStack,
]);

/** Map definitions by id. @type {Readonly<Record<string, import('../index.js').MapDef>>} */
export const MAPS_BY_ID = Object.freeze(Object.fromEntries(MAPS.map((m) => [m.id, m])));

export default MAPS;
