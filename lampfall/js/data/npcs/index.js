/** The complete 43-person cast, in the manifest's stable order. */
import { deepFreeze } from '../ids.js';
import { NPC_IDS } from '../ids.manifest.js';
import wren, { scripts as wrenScripts } from './wren.js';
import ambrose, { scripts as ambroseScripts } from './ambrose.js';
import hesper, { scripts as hesperScripts } from './hesper.js';
import juniper, { scripts as juniperScripts } from './juniper.js';
import ludo, { scripts as ludoScripts } from './ludo.js';
import barnaby, { scripts as barnabyScripts } from './barnaby.js';
import augusta, { scripts as augustaScripts } from './augusta.js';
import { REMAINING_NPCS, scripts as otherScripts } from './remaining.js';
const all = [wren, ambrose, hesper, juniper, ludo, barnaby, augusta, ...REMAINING_NPCS];
const byId = Object.fromEntries(all.map((npc) => [npc.id, npc]));
export const NPCS = deepFreeze(NPC_IDS.map((id) => { if (!byId[id]) throw new Error(`Missing cast member: ${id}`); return byId[id]; }));
export const NPCS_BY_ID = deepFreeze(Object.fromEntries(NPCS.map((npc) => [npc.id, npc])));
export const NPC_SCRIPTS = deepFreeze({ ...wrenScripts, ...ambroseScripts, ...hesperScripts, ...juniperScripts, ...ludoScripts, ...barnabyScripts, ...augustaScripts, ...otherScripts });
export default NPCS;
