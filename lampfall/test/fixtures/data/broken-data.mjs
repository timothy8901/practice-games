/**
 * Validator fixture: the placeholder DATA with one deliberate broken reference per rule family.
 * `EXPECTED` lists, for each break, a substring that must appear in exactly the reported line.
 * Used by test/data.test.mjs both in-process (`validateData`) and through the CLI (`--data`).
 * [TOOLS]
 */
import { DATA as GOOD, DEFAULT_LEGEND } from '../../../js/data/index.js';

/**
 * Builds a fresh, mutable broken copy of the placeholder tables.
 * @returns {Record<string, any>}
 */
export function makeBrokenData() {
  const d = structuredClone(GOOD);
  const byId = (table, id) => d[table].find((r) => r.id === id);

  byId('species', 'ph-pup').ability = 'ph-nope';                                   // missing ability
  byId('species', 'ph-paw').learnset.push([20, 'ph-ghost-move']);                  // missing learnset move
  byId('moves', 'ph-tap').effect.zap = true;                                       // effect key not in EFFECT_KEYS
  d.moves.push({ ...structuredClone(byId('moves', 'ph-settle')) });                // duplicate id
  byId('families', 'ph-line').shiftTable['ph-pip'].up.push({ form: 'ph-stranger', w: 1 }); // foreign form
  byId('items', 'ph-lantern').pocket = 'satchel';                                  // unknown pocket

  const field = byId('maps', 'ph-field');
  field.warps[0].to.mapId = 'ph-nowhere';                                          // warp to unknown map
  field.spawns[0].table = 'ph-no-table';                                           // unknown spawn table
  field.entities.push({ kind: 'npc', id: 'ph-stranger-npc', x: 1, y: 1 });         // npc entity not in npcs
  byId('maps', 'ph-hut').ground[2] = '#FFFF#';                                     // short row

  const npc = byId('npcs', 'ph-keeper');
  npc.topics[0].script = 'ph-missing-script';                                      // topic script missing
  npc.topics[1].cond = { flg: 'sp.typo' };                                         // malformed cond
  npc.schedule[1].path = 'ph-no-path';                                             // unknown path

  byId('threads', 'ph-thread').beats[1].script = 'ph-no-beat';                     // beat script missing
  d.letters.push({ ...structuredClone(d.letters[0]), id: 'letter-3', n: 3 });      // n gap (1, 3)

  d.scripts['ph-remind'].push({ op: 'goto', id: 'nowhere' });                      // goto to a missing label
  d.scripts['ph-trainer-loss'].unshift({ op: 'dance' });                           // unknown op
  d.scripts['ph-trainer-win'].unshift({ op: 'give', item: 'ph-ghost-item' });      // item ref missing
  d.scripts['ph-arrival'].unshift({ op: 'choice', options: [] });                  // choice with no option

  byId('trainers', 'ph-rival-1').party.push({ species: 'ph-ghost', level: 3 });    // party species missing
  byId('shops', 'ph-shop').keeper = 'ph-nobody';                                   // keeper missing
  byId('shops', 'ph-shop').stock.push({ item: 'ph-ghost-item' });                  // stock item missing
  d.encounters['ph-grass'] = [{ species: 'ph-pip', levels: [2, 4], w: 10, cond: { phase: ['night'] } }]; // no unconditional row
  d.eventScripts[0].script = 'ph-no-event-script';                                 // event script missing
  return d;
}

/** One `[table:id prefix, message substring]` per deliberate break. */
export const EXPECTED = Object.freeze([
  ['species:ph-pup:', "ability 'ph-nope' is not in abilities"],
  ['species:ph-paw:', "learnset move 'ph-ghost-move' is not in moves"],
  ['moves:ph-tap:', "effect key 'zap' is not in EFFECT_KEYS"],
  ['moves:ph-settle:', 'duplicate id'],
  ['families:ph-line:', "shiftTable.ph-pip.up -> 'ph-stranger' is not a known species"],
  ['items:ph-lantern:', "pocket 'satchel' unknown"],
  ['maps:ph-field:', "warp at (10,4) targets unknown map 'ph-nowhere'"],
  ['maps:ph-field:', "spawn table 'ph-no-table' is not in encounters"],
  ['maps:ph-field:', "npc entity 'ph-stranger-npc' is not in npcs"],
  ['maps:ph-hut:', 'ground row 2 must be 8 chars'],
  ['npcs:ph-keeper:', "topic 'ph-first' script 'ph-missing-script' is not in scripts"],
  ['npcs:ph-keeper:', "topic 'ph-remind' cond: malformed"],
  ['npcs:ph-keeper:', "path 'ph-no-path' is not a schedules path"],
  ['threads:ph-thread:', "beat 2 script 'ph-no-beat' is not in scripts"],
  ['letters:letter-3:', 'n 3 breaks the contiguous 1..n order (expected 2)'],
  ['scripts:ph-remind[', "goto 'nowhere': no such label in this script"],
  ['scripts:ph-trainer-loss[0]:', "unknown op 'dance'"],
  ['scripts:ph-trainer-win[0]:', "give.item 'ph-ghost-item' is not in items"],
  ['scripts:ph-arrival[0]:', "choice: field 'options' needs at least one option"],
  ['trainers:ph-rival-1:', "party species 'ph-ghost' is not in species"],
  ['shops:ph-shop:', "keeper 'ph-nobody' is not in npcs"],
  ['shops:ph-shop:', "stock item 'ph-ghost-item' is not in items"],
  ['encounters:ph-grass:', 'needs at least one unconditional row'],
  ['eventScripts:ph-loan-tier-2:', "script 'ph-no-event-script' is not in scripts"],
]);

/** The broken tables, for `node tools/validate-data.mjs --data test/fixtures/data/broken-data.mjs`. */
export const DATA = makeBrokenData();
export { DEFAULT_LEGEND };
