/**
 * WILDSHIFT techniques (moves). Pure data plus small lookup helpers.
 *
 * Every move: `{id, name, type, category, power, accuracy, pp, priority, effect, text}`.
 * - `type` is a type name, or `null` for typeless (Scrap, Plumbline).
 * - `category`: 'physical' | 'special' | 'status'.
 * - `accuracy`: percent, or `null` for a sure-hit move (never misses).
 * - `pp`: max PP, or `null` for Scrap (never runs out).
 * - `effect` keys the engine understands:
 *   - `stat: [{target:'self'|'foe', stat, stages}]`, optional `chance` (0-1) for secondary stat effects
 *   - `status: {kind:'burn'|'poison'|'chill'|'numb'|'trap', chance}` (chance 1 on status moves)
 *   - `recovery: {fraction, delay, cancelledBy?}` consumes one Mend
 *   - `guard: true` (fails on consecutive turns), `evasion: 1` (+1 evasion, cap +2)
 *   - `sureHit: true` (same as accuracy null), `plumbline: true`, `scrap: true`
 *   - `clearRaised: true` (Snuff), `flinch: p`, `popsDecoy: n`, `highCrit: stages`
 *   - `revealMoves: true`, `charge: 1`, `spread: true`, `queuedType: true`,
 *     `multiHit: [min, max]`, `drain: fraction`, `selfKo: true`, `contact: true`
 *
 * @module proto/battle/moves
 */

/** @typedef {{id:string,name:string,type:string|null,category:'physical'|'special'|'status',power:number,accuracy:number|null,pp:number|null,priority:number,effect:Record<string, any>,text:string,signature?:string}} Move */

/** @type {Move[]} */
const LIST = [
  // ---- Plain ---------------------------------------------------------------
  m('tap', 'Tap', 'Plain', 'physical', 40, 100, 35, 0, { contact: true }, 'An everyday blow.'),
  m('sure-pinch', 'Sure Pinch', 'Plain', 'physical', 40, null, 20, 0, { sureHit: true, contact: true }, 'Never misses. An early answer to evasion.', 'tossup'),
  m('shell-rattle', 'Shell Rattle', 'Plain', 'special', 55, 100, 25, 0, {}, 'A rattling shock of sound.'),
  m('settle', 'Settle', 'Plain', 'status', 0, null, 20, 0, { stat: [{ target: 'self', stat: 'def', stages: 1 }, { target: 'self', stat: 'spd', stages: 1 }] }, 'Raises the user\'s Defence and Sp. Defence.'),
  m('shellguard', 'Shellguard', 'Plain', 'status', 0, null, 10, 4, { guard: true }, 'Guards against every move this turn. Fails if used on consecutive turns.'),
  m('plumbline', 'Plumbline', null, 'status', 0, null, 10, 0, { plumbline: true, sureHit: true }, 'Always hits. Clears the target\'s stat stages and blocks re-boosting for 2 turns.'),
  m('scrap', 'Scrap', null, 'physical', 50, null, null, 0, { scrap: true, sureHit: true }, 'Typeless fallback. Never misses, costs the user 1/8 max HP, never pierces Wards.'),
  // ---- Grit ----------------------------------------------------------------
  m('knuckle', 'Knuckle', 'Grit', 'physical', 60, 100, 25, 0, { contact: true }, 'A wrapped-fist punch.'),
  m('grind-down', 'Grind Down', 'Grit', 'physical', 85, 90, 15, 0, { contact: true }, 'A grinding grapple.'),
  m('pummel', 'Pummel', 'Grit', 'physical', 20, 100, 20, 0, { multiHit: [2, 5], contact: true }, 'Hits 2 to 5 times. Each hit pops one Afterimage decoy.'),
  m('sand-smother', 'Sand Smother', 'Grit', 'status', 0, 100, 20, 0, { stat: [{ target: 'foe', stat: 'atk', stages: -1 }] }, 'Lowers the target\'s Attack.'),
  // ---- Brine ---------------------------------------------------------------
  m('undertow', 'Undertow', 'Brine', 'physical', 65, 100, 15, 0, { stat: [{ target: 'foe', stat: 'spe', stages: -1 }], contact: true }, 'Lowers the target\'s Speed one stage.', 'sloshkin'),
  m('salt-spray', 'Salt Spray', 'Brine', 'special', 50, 100, 25, 0, {}, 'A spray of stinging salt water.'),
  m('riptide', 'Riptide', 'Brine', 'special', 90, 85, 10, 0, {}, 'A dragging surge of sea.'),
  m('tidal-mend', 'Tidal Mend', 'Brine', 'status', 0, null, 10, 0, { recovery: { fraction: 0.5, delay: 0 } }, 'Heals 50% of max HP. Spends one Mend.'),
  // ---- Kiln ----------------------------------------------------------------
  m('ember-lick', 'Ember Lick', 'Kiln', 'special', 45, 100, 25, 0, { status: { kind: 'burn', chance: 0.1 } }, 'May burn the target.'),
  m('kiln-maw', 'Kiln Maw', 'Kiln', 'special', 75, 100, 15, 0, {}, 'A furnace blast from the jaws.', 'caldermaw'),
  m('scorch', 'Scorch', 'Kiln', 'status', 0, 85, 15, 0, { status: { kind: 'burn', chance: 1 } }, 'Burns the target.'),
  m('slag-burst', 'Slag Burst', 'Kiln', 'physical', 80, 100, 10, 0, { status: { kind: 'burn', chance: 0.2 }, contact: true }, 'A slam of molten slag. May burn.'),
  // ---- Moss ----------------------------------------------------------------
  m('reed-whip', 'Reed Whip', 'Moss', 'physical', 50, 100, 25, 0, { contact: true }, 'A lash of sharp reeds.'),
  m('reap', 'Reap', 'Moss', 'physical', 70, 100, 15, 0, { highCrit: 1, contact: true }, 'High crit rate.', 'sedgehare'),
  m('root-knot', 'Root Knot', 'Moss', 'status', 0, 90, 15, 0, { status: { kind: 'trap', chance: 1 } }, 'Traps the target for 4 turns; it takes chip damage and cannot switch.'),
  m('spore-drift', 'Spore Drift', 'Moss', 'status', 0, 90, 20, 0, { status: { kind: 'poison', chance: 1 } }, 'Poisons the target.'),
  // ---- Bolt ----------------------------------------------------------------
  m('arc-ping', 'Arc Ping', 'Bolt', 'special', 30, 100, 20, 1, { revealMoves: true }, 'Moves first. Reveals the target\'s full moveset.', 'wirewhisk'),
  m('jolt', 'Jolt', 'Bolt', 'special', 65, 100, 20, 0, { status: { kind: 'numb', chance: 0.1 } }, 'May numb the target.'),
  m('bandlight', 'Bandlight', 'Bolt', 'special', 90, 100, 10, 0, { charge: 1 }, 'The bands light in sequence one turn, then it strikes the next.', 'squallcoil'),
  m('static-net', 'Static Net', 'Bolt', 'status', 0, 90, 20, 0, { status: { kind: 'numb', chance: 1 } }, 'Numbs the target.'),
  // ---- Rime ----------------------------------------------------------------
  m('frost-nip', 'Frost Nip', 'Rime', 'special', 50, 100, 25, 0, { status: { kind: 'chill', chance: 0.1 } }, 'May chill the target.'),
  m('plate-toss', 'Plate Toss', 'Rime', 'physical', 60, 100, 15, 0, {}, 'Throws one of its own plates; it grows back at the end of the turn.', 'rimeplate'),
  m('hoarfrost', 'Hoarfrost', 'Rime', 'special', 80, 95, 10, 0, { status: { kind: 'chill', chance: 0.2 } }, 'A hard cold. May chill.'),
  m('rime-lock', 'Rime Lock', 'Rime', 'status', 0, 75, 10, 0, { status: { kind: 'chill', chance: 1 } }, 'Chills the target for a few turns.'),
  // ---- Gust ----------------------------------------------------------------
  m('skein-sweep', 'Skein Sweep', 'Gust', 'special', 60, 100, 15, 0, { spread: true }, 'Hits both foes in doubles. Pops every Afterimage decoy on a miss.', 'skeinwing'),
  m('gale-cut', 'Gale Cut', 'Gust', 'physical', 70, 100, 15, 0, { contact: true }, 'A cutting wind.'),
  m('updraft', 'Updraft', 'Gust', 'status', 0, null, 20, 0, { stat: [{ target: 'self', stat: 'spe', stages: 2 }] }, 'Sharply raises the user\'s Speed.'),
  m('mirror-step', 'Mirror Step', 'Gust', 'status', 0, null, 5, 0, { evasion: 1 }, 'Raises evasion one stage (max +2).'),
  // ---- Stone ---------------------------------------------------------------
  m('shard-fling', 'Shard Fling', 'Stone', 'physical', 55, 95, 25, 0, {}, 'Flings sharp stone.'),
  m('bedrock-charge', 'Bedrock Charge', 'Stone', 'physical', 100, 100, 5, 0, { charge: 1, contact: true }, 'Braces for one turn while dust falls, then hits.', 'stillox'),
  m('sandtrap', 'Sandtrap', 'Stone', 'status', 0, 85, 15, 0, { status: { kind: 'trap', chance: 1 } }, 'Traps the target for 4 turns; chip damage, no switching.'),
  m('stand-firm', 'Stand Firm', 'Stone', 'status', 0, null, 15, 0, { stat: [{ target: 'self', stat: 'def', stages: 2 }] }, 'Sharply raises the user\'s Defence.'),
  // ---- Rust ----------------------------------------------------------------
  m('rust-bite', 'Rust Bite', 'Rust', 'physical', 60, 100, 20, 0, { status: { kind: 'poison', chance: 0.3 }, contact: true }, 'A bite of old iron. May poison.'),
  m('corrode', 'Corrode', 'Rust', 'status', 0, 90, 25, 0, { status: { kind: 'poison', chance: 1 } }, 'Poisons the target.'),
  m('iron-pin', 'Iron Pin', 'Rust', 'physical', 80, 100, 15, 0, { contact: true }, 'Pins with a rusted spike.'),
  m('hullburst', 'Hullburst', 'Rust', 'physical', 150, 100, 5, 0, { selfKo: true }, 'The user bursts apart and faints. Fails while Sodden is on the field.'),
  // ---- Glass ---------------------------------------------------------------
  m('dust-veil', 'Dust Veil', 'Glass', 'special', 30, 100, 20, 0, { status: { kind: 'poison', chance: 0.3 } }, 'Low damage; 30% chance to poison.', 'prismoth'),
  m('shardlight', 'Shardlight', 'Glass', 'special', 75, 100, 15, 0, {}, 'A beam through skyglass.'),
  m('dazzle', 'Dazzle', 'Glass', 'status', 0, 100, 15, 0, { stat: [{ target: 'foe', stat: 'atk', stages: -1 }, { target: 'foe', stat: 'spa', stages: -1 }] }, 'Lowers the target\'s Attack and Sp. Attack.'),
  m('lens-focus', 'Lens Focus', 'Glass', 'status', 0, null, 15, 0, { stat: [{ target: 'self', stat: 'spa', stages: 2 }] }, 'Sharply raises the user\'s Sp. Attack.'),
  m('vesper-mend', 'Vesper Mend', 'Glass', 'status', 0, null, 10, 0, { recovery: { fraction: 0.5, delay: 1, cancelledBy: 'Hollow' } }, 'The eye panel brightens; at the end of next turn heals 50%. A Hollow hit in between cancels it. Spends one Mend.', 'vesperay'),
  // ---- Hollow --------------------------------------------------------------
  m('shadowbox', 'Shadowbox', 'Hollow', 'physical', 50, 100, 10, 0, { contact: true }, 'A jab at its own shadow.', 'scrapling'),
  m('gnash', 'Gnash', 'Hollow', 'physical', 60, 100, 15, 0, { flinch: 0.3, popsDecoy: 1, contact: true }, '30% flinch chance. Each hit pops one Afterimage decoy.', 'brinelance'),
  m('snuff', 'Snuff', 'Hollow', 'special', 50, 100, 15, 0, { clearRaised: true }, 'Removes the target\'s raised stat stages.', 'creelwight'),
  m('echo-drain', 'Echo Drain', 'Hollow', 'special', 70, 100, 10, 0, { drain: 0.5 }, 'Heals the user by half the damage dealt (not a Mend).'),
  // ---- Star ----------------------------------------------------------------
  m('tailfall', 'Tailfall', 'Star', 'special', 90, 100, 10, 0, { queuedType: true }, 'Takes the type next in the user\'s Unfixed queue.', 'vagary'),
  m('starfall', 'Starfall', 'Star', 'special', 70, 100, 15, 0, {}, 'Comet light. Neutral against everything.'),
];

/**
 * @returns {Move}
 */
function m(id, name, type, category, power, accuracy, pp, priority, effect, text, signature) {
  const move = { id, name, type, category, power, accuracy, pp, priority, effect: Object.freeze({ ...effect }), text };
  if (signature) move.signature = signature;
  return Object.freeze(move);
}

/** All moves by id. */
export const MOVES = Object.freeze(Object.fromEntries(LIST.map((mv) => [mv.id, mv])));

/** Ordered list of every move. */
export const MOVE_LIST = Object.freeze(LIST.slice());

/** Scrap, the fallback attack when every move is at 0 PP. */
export const SCRAP = MOVES.scrap;

/** Max PP of any evasion move (rules 10.1). */
export const EVASION_MOVE_MAX_PP = 5;

/**
 * @param {string} id
 * @returns {Move}
 * @throws {RangeError} for an unknown id
 */
export function getMove(id) {
  const mv = MOVES[id];
  if (!mv) throw new RangeError(`getMove: unknown move ${String(id)}`);
  return mv;
}

/** @param {Move} mv @returns {boolean} whether the move deals direct damage */
export function isDamaging(mv) {
  return mv.category !== 'status' && mv.power > 0;
}

/** @param {Move} mv @returns {boolean} */
export function isSureHit(mv) {
  return mv.accuracy === null || mv.effect.sureHit === true;
}

/** @param {Move} mv @returns {boolean} whether the move can inflict chip damage (poison/burn/trap) */
export function isChipMove(mv) {
  const s = mv.effect.status;
  return !!s && (s.kind === 'poison' || s.kind === 'burn' || s.kind === 'trap');
}

/** @param {Move} mv @returns {boolean} whether the move targets the user only */
export function isSelfTargeting(mv) {
  if (mv.category !== 'status') return false;
  const e = mv.effect;
  if (e.guard || e.evasion || e.recovery) return true;
  if (e.stat && e.stat.every((s) => s.target === 'self') && !e.status && !e.plumbline && !e.clearRaised) return true;
  return false;
}

/**
 * Moves of a given type.
 * @param {string|null} type
 * @returns {Move[]}
 */
export function movesOfType(type) {
  return LIST.filter((mv) => mv.type === type);
}
