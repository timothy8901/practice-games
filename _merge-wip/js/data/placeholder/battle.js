/**
 * PLACEHOLDER day-1 battle tables. [DATA-IDX]
 *
 * One family of three forms, six moves and one ability: just enough to exercise every validator rule
 * so the pipeline is proven before the DATA-BATTLE and DATA-SPECIES lanes land their real files
 * (`js/data/types.js`, `js/data/moves/`, `js/data/abilities.js`, `js/data/species/`). When they do,
 * `js/data/index.js` imports those instead and this file is deleted. Every id starts with `ph-`.
 * @module data/placeholder/battle
 */

/**
 * The thirteen type rows (from proto/battle/types.js; the chart stays with DATA-BATTLE).
 * @type {ReadonlyArray<{id: string, name: string, abbr: string, paletteKey: string}>}
 */
export const TYPES = Object.freeze([
  { id: 'plain', name: 'Plain', abbr: 'Pla', paletteKey: 'v' },
  { id: 'grit', name: 'Grit', abbr: 'Gri', paletteKey: 'u' },
  { id: 'brine', name: 'Brine', abbr: 'Bri', paletteKey: 'b' },
  { id: 'kiln', name: 'Kiln', abbr: 'Kil', paletteKey: 'o' },
  { id: 'moss', name: 'Moss', abbr: 'Mos', paletteKey: 'g' },
  { id: 'bolt', name: 'Bolt', abbr: 'Bol', paletteKey: 'y' },
  { id: 'rime', name: 'Rime', abbr: 'Rim', paletteKey: 's' },
  { id: 'gust', name: 'Gust', abbr: 'Gus', paletteKey: 'w' },
  { id: 'stone', name: 'Stone', abbr: 'Sto', paletteKey: 'e' },
  { id: 'rust', name: 'Rust', abbr: 'Rus', paletteKey: 'r' },
  { id: 'glass', name: 'Glass', abbr: 'Gla', paletteKey: 'i' },
  { id: 'hollow', name: 'Hollow', abbr: 'Hol', paletteKey: 'p' },
  { id: 'star', name: 'Star', abbr: 'Sta', paletteKey: 'd' },
]);

/**
 * Move row helper (same signature as proto/battle/moves.js `m()`).
 * @returns {import('../index.js').Move}
 */
function m(id, name, type, category, power, accuracy, pp, priority, effect, text, signature) {
  const row = { id, name, type, category, power, accuracy, pp, priority, effect, text };
  if (signature) row.signature = signature;
  return row;
}

/** @type {ReadonlyArray<import('../index.js').Move>} */
export const MOVES = Object.freeze([
  m('ph-tap', 'PLACEHOLDER Tap', 'Plain', 'physical', 40, 100, 35, 0, { contact: true }, 'An everyday blow.'),
  m('ph-splash', 'PLACEHOLDER Splash', 'Brine', 'special', 50, 100, 25, 0,
    { stat: [{ target: 'foe', stat: 'spe', stages: -1 }], chance: 0.3 }, 'May lower the target\'s Speed.', 'ph-pip'),
  m('ph-settle', 'PLACEHOLDER Settle', 'Plain', 'status', 0, null, 20, 0,
    { stat: [{ target: 'self', stat: 'def', stages: 1 }] }, 'Raises the user\'s Defence.'),
  m('ph-gust', 'PLACEHOLDER Gust', 'Gust', 'physical', 60, 95, 20, 0,
    { flinch: 0.1, status: { kind: 'numb', chance: 0.1 }, contact: true }, 'May flinch or numb.'),
  m('ph-mist', 'PLACEHOLDER Mist', 'Rime', 'status', 0, null, 5, 0, { evasion: 1 }, 'Raises evasion one stage.'),
  m('ph-plumb', 'PLACEHOLDER Plumb', null, 'status', 0, null, 10, 0, { plumbline: true, sureHit: true }, 'Clears the target\'s stat stages.'),
]);

/** @type {ReadonlyArray<import('../index.js').Ability>} */
export const ABILITIES = Object.freeze([
  { id: 'ph-shoresense', name: 'PLACEHOLDER Shoresense', text: 'No battle effect yet.', ward: null, hook: null, expShare: false, glint: false },
]);

/**
 * Species row helper (same signature as §14.1 `sp()`).
 * @returns {import('../index.js').Species}
 */
function sp(id, name, types, familyId, stage, base, ability, learnset, heartmark, catchRate, expYield, growth, flags) {
  const [hp, atk, def, spa, spd, spe] = base;
  return { id, name, types, familyId, stage, base: { hp, atk, def, spa, spd, spe }, ability, learnset, heartmark, catchRate, expYield, growth, flags: flags ?? {} };
}

/** @type {ReadonlyArray<import('../index.js').Species>} */
export const SPECIES = Object.freeze([
  sp('ph-pip', 'PLACEHOLDER Pip', ['Brine'], 'ph-line', 1, [60, 62, 55, 50, 55, 38], 'ph-shoresense',
    [[1, 'ph-tap'], [1, 'ph-splash'], [5, 'ph-settle'], [9, 'ph-mist']], 'ph-splash', 45, 64, 'medium-slow', { roleTag: 'starter_base' }),
  sp('ph-pup', 'PLACEHOLDER Pup', ['Brine', 'Gust'], 'ph-line', 2, [55, 60, 50, 85, 65, 105], 'ph-shoresense',
    [[1, 'ph-tap'], [1, 'ph-splash'], [12, 'ph-gust'], [18, 'ph-plumb']], 'ph-splash', 45, 150, 'medium-slow', { shiftOnly: true }),
  sp('ph-paw', 'PLACEHOLDER Paw', ['Brine', 'Stone'], 'ph-line', 2, [80, 70, 90, 45, 70, 25], 'ph-shoresense',
    [[1, 'ph-tap'], [1, 'ph-settle'], [14, 'ph-plumb']], 'ph-settle', 45, 150, 'medium-slow', { shiftOnly: true }),
]);

/** @type {ReadonlyArray<import('../index.js').Family>} */
export const FAMILIES = Object.freeze([
  {
    id: 'ph-line', name: 'PLACEHOLDER line', windows: [9, 20, 34],
    shiftTable: {
      'ph-pip': { up: [{ form: 'ph-pup', w: 3 }, { form: 'ph-paw', w: 1 }], side: [], down: [] },
      'ph-pup': { up: [], side: [{ form: 'ph-paw', w: 1 }], down: [{ form: 'ph-pip', w: 1 }] },
      'ph-paw': { up: [], side: [{ form: 'ph-pup', w: 1 }], down: [{ form: 'ph-pip', w: 1 }] },
    },
    star: 'ph-paw',
  },
]);
