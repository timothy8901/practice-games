/**
 * Life threads, cast arcs and the template thread (10 rows) and their beat scripts. [DATA-THREADS]
 * GDD-08; row contract ARCHITECTURE §14.7 plus the fields systems/threads reads.
 *
 * Row fields: `id` (manifest), `npcId`, `title`, `kind` (lead | cast | template), `summary`,
 * optional `involve` (cond for starting), `beats`. Beat fields: `id` (1..n), `cond`, `script`
 * (a key of THREAD_SCRIPTS), optional `advance` ({days} spacing, {dayOfWeek:[5]} = Saturday, the
 * spring-tide day), `where` (a hint for the map marker; GDD-01 may snap it to the nearest walkable
 * tile), `porch` (carried by porch talk), `npcId` (when someone else carries the beat), `reward`
 * (last beat: `share` and what the script hands over), plus documentation fields `when`, `topic`
 * (the line the beat shows in the NPC's topic list and on the Commons board) and `choices` (the
 * `th.<thread>.<key>` flags its choice point sets; every option is also an npc memory key).
 *
 * THREAD_SCRIPTS (`th-<thread>-<beat>`) are script-op arrays in the §6.1 format; each ends by
 * setting its own beat with the `beat` op. The orchestrator merges them into DATA.scripts.
 * Set-pieces owned by GDD-07 are reached with `call`: `bell-dig`, `ansel-confession`,
 * `ansel-weir-wheel`, `tamsin-sails`.
 * @module data/threads
 */

import { deepFreeze } from '../ids.js';
import mudlarkMile, { scripts as mudlarkMileScripts } from './mudlark-mile.js';
import twelveLights, { scripts as twelveLightsScripts } from './twelve-lights.js';
import oysterBoat, { scripts as oysterBoatScripts } from './oyster-boat.js';
import theFence, { scripts as theFenceScripts } from './the-fence.js';
import heirlooms, { scripts as heirloomsScripts } from './heirlooms-going-home.js';
import theBell, { scripts as theBellScripts } from './the-bell.js';
import emberGrub, { scripts as emberGrubScripts } from './ember-grub.js';
import waterPack, { scripts as waterPackScripts } from './water-pack.js';
import emptyCreek, { scripts as emptyCreekScripts } from './empty-creek.js';
import secondChapter, { scripts as secondChapterScripts } from './second-chapter.js';

/**
 * Every thread row, in manifest order.
 * @type {ReadonlyArray<import('../index.js').ThreadDef & Record<string, any>>}
 */
export const THREADS = deepFreeze([
  mudlarkMile, twelveLights, oysterBoat, theFence, heirlooms, theBell,
  emberGrub, waterPack, emptyCreek, secondChapter,
]);

/**
 * Every beat script, keyed by script id.
 * @type {Readonly<Record<string, ReadonlyArray<any>>>}
 */
export const THREAD_SCRIPTS = deepFreeze({
  ...mudlarkMileScripts, ...twelveLightsScripts, ...oysterBoatScripts, ...theFenceScripts, ...heirloomsScripts,
  ...theBellScripts, ...emberGrubScripts, ...waterPackScripts, ...emptyCreekScripts, ...secondChapterScripts,
});

/** npc id -> thread id (for NpcDef.threadId, GDD-06). */
export const THREAD_BY_NPC = deepFreeze(Object.fromEntries(THREADS.map((t) => [t.npcId, t.id])));

export default THREADS;
