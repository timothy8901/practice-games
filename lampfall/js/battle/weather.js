/**
 * Arena weather: the rows the engine reads, the posted cycle and the per-kind effects. [BATTLE-RULES]
 *
 * Weather kinds are data (`data/spires.WEATHER_KINDS`), injected like every other table
 * (`createBattle({weatherKinds})` or `data.weatherKinds`); nothing here names a kind or a type.
 * A kind row:
 * - `id`, `name`, `text`                  the HUD label and the one-line rule the UI shows
 * - `power: {Type: mult}`                 a move's damage by the type it hits with
 * - `accuracy: mult`                      every move's hit chance (sure-hit moves never miss)
 * - `chip: {fraction, chipImmune: [Type]}|null`   end-of-turn damage to creatures with none of
 *                                          those types (indirect: every Ward lets it through)
 * - `evasion: {types: [Type], stages}|null`        evasion granted as the weather starts, to the
 *                                          active creatures of those types (never past the cap)
 * - `status: {blocks?: [kind], cures?: [kind]}`    optional: conditions it keeps off (they fail as
 *                                          'immune') and conditions it clears at the end of a turn
 *
 * A posted cycle (the Weather Spire's `theme.rule`): `{cycle: [kindId], turnsEach, startsWith?,
 * postedTurnsAhead?}`; turn `t` (1-based) has kind `cycle[(start + floor((t - 1) / turnsEach)) % n]`.
 *
 * Pure: no DOM, no randomness.
 * @module battle/weather
 */

/**
 * Weather tunables (merged into the engine's DEFAULTS).
 * @type {Readonly<{weatherMoveTurns: number, weatherPostedTurns: number}>}
 */
export const DEFAULTS = Object.freeze({
  /** Turns a move's weather lasts when its `weather` effect names no `turns`. */
  weatherMoveTurns: 5,
  /** Turns ahead the weather strip posts (a cycle's `postedTurnsAhead` wins). */
  weatherPostedTurns: 3,
});

/** Every key of {@link DEFAULTS}. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** Fields a weather kind row may carry. */
export const WEATHER_FIELDS = Object.freeze(['id', 'name', 'text', 'power', 'accuracy', 'chip', 'evasion', 'status']);
/** Fields a posted cycle may carry. */
export const CYCLE_FIELDS = Object.freeze(['cycle', 'turnsEach', 'startsWith', 'postedTurnsAhead']);

/**
 * @typedef {Object} WeatherKind
 * @property {string} id  @property {string} name  @property {string} text
 * @property {Readonly<Record<string, number>>} power
 * @property {number} accuracy
 * @property {{fraction: number, chipImmune: readonly string[]}|null} chip
 * @property {{types: readonly string[], stages: number}|null} evasion
 * @property {{blocks: readonly string[], cures: readonly string[]}} status
 */

/**
 * @typedef {{cycle: readonly string[], turnsEach: number, startsWith?: string, postedTurnsAhead?: number}} WeatherCycle
 */

/** @typedef {{turn: number, kind: string|null, name: string|null}} PostedTurn */

/**
 * Structural problems of one weather kind row; empty = valid. `types`, when given, is the set of
 * type names every type reference must belong to.
 * @param {any} row
 * @param {{has: (t: string) => boolean}|null} [types]
 * @returns {string[]}
 */
export function weatherKindProblems(row, types = null) {
  const id = row && typeof row.id === 'string' ? row.id : '?';
  if (!row || typeof row !== 'object') return [`weather ${id}: not an object`];
  const out = [];
  const typeOk = (t, where) => { if (types && !types.has(t)) out.push(`weather ${id}: ${where} names unknown type ${String(t)}`); };
  for (const k of Object.keys(row)) if (!WEATHER_FIELDS.includes(k)) out.push(`weather ${id}: unknown field "${k}"`);
  if (typeof row.id !== 'string' || !row.id) out.push('weather ?: id is required');
  if (typeof row.name !== 'string' || !row.name) out.push(`weather ${id}: name is required`);
  if (typeof row.text !== 'string' || !row.text) out.push(`weather ${id}: text is required (the HUD shows it)`);
  if (row.power != null) {
    if (typeof row.power !== 'object' || Array.isArray(row.power)) out.push(`weather ${id}: power must be {Type: mult}`);
    else for (const [t, m] of Object.entries(row.power)) {
      typeOk(t, 'power');
      if (!(typeof m === 'number' && Number.isFinite(m) && m >= 0)) out.push(`weather ${id}: power.${t} must be a number >= 0`);
    }
  }
  if (row.accuracy != null && !(typeof row.accuracy === 'number' && row.accuracy > 0 && row.accuracy <= 2)) out.push(`weather ${id}: accuracy must be a multiplier in (0, 2]`);
  if (row.chip != null) {
    const c = row.chip;
    if (!(c && typeof c === 'object' && typeof c.fraction === 'number' && c.fraction > 0 && c.fraction <= 1)) out.push(`weather ${id}: chip.fraction must be in (0, 1]`);
    if (c && c.chipImmune != null) {
      if (!Array.isArray(c.chipImmune)) out.push(`weather ${id}: chip.chipImmune must be a list of types`);
      else for (const t of c.chipImmune) typeOk(t, 'chip.chipImmune');
    }
  }
  if (row.evasion != null) {
    const e = row.evasion;
    if (!(e && Array.isArray(e.types) && Number.isInteger(e.stages) && e.stages > 0)) out.push(`weather ${id}: evasion must be {types: [Type], stages > 0}`);
    else for (const t of e.types) typeOk(t, 'evasion.types');
  }
  if (row.status != null) {
    const s = row.status;
    if (!s || typeof s !== 'object') out.push(`weather ${id}: status must be {blocks?, cures?}`);
    else {
      for (const k of Object.keys(s)) if (k !== 'blocks' && k !== 'cures') out.push(`weather ${id}: unknown status field "${k}"`);
      for (const k of ['blocks', 'cures']) if (s[k] != null && !(Array.isArray(s[k]) && s[k].every((x) => typeof x === 'string'))) out.push(`weather ${id}: status.${k} must be a list of status kinds`);
    }
  }
  return out;
}

/**
 * Normalizes and indexes weather kind rows.
 * @param {ReadonlyArray<any>|Record<string, any>|null|undefined} rows
 * @returns {ReadonlyMap<string, Readonly<WeatherKind>>}
 * @throws {TypeError} for a malformed row
 */
export function indexWeatherKinds(rows) {
  /** @type {Map<string, Readonly<WeatherKind>>} */
  const out = new Map();
  if (rows == null) return out;
  const list = Array.isArray(rows) ? rows : Object.values(rows);
  for (const row of list) {
    const problems = weatherKindProblems(row);
    if (problems.length) throw new TypeError(`weather kinds: ${problems.join('; ')}`);
    if (out.has(row.id)) throw new TypeError(`weather kinds: duplicate id ${row.id}`);
    out.set(row.id, Object.freeze({
      id: row.id,
      name: row.name,
      text: row.text,
      power: Object.freeze({ ...(row.power || {}) }),
      accuracy: row.accuracy ?? 1,
      chip: row.chip ? Object.freeze({ fraction: row.chip.fraction, chipImmune: Object.freeze((row.chip.chipImmune || []).slice()) }) : null,
      evasion: row.evasion ? Object.freeze({ types: Object.freeze(row.evasion.types.slice()), stages: row.evasion.stages }) : null,
      status: Object.freeze({ blocks: Object.freeze(((row.status && row.status.blocks) || []).slice()), cures: Object.freeze(((row.status && row.status.cures) || []).slice()) }),
    }));
  }
  return out;
}

/**
 * Problems of a posted cycle against the known kinds; empty = valid.
 * @param {any} rule
 * @param {{has: (id: string) => boolean}} kinds
 * @returns {string[]}
 */
export function cycleProblems(rule, kinds) {
  if (!rule || typeof rule !== 'object') return ['weather cycle: not an object'];
  const out = [];
  if (!Array.isArray(rule.cycle) || rule.cycle.length === 0) out.push('weather cycle: cycle must list at least one kind');
  else for (const k of rule.cycle) if (!kinds.has(k)) out.push(`weather cycle: unknown kind ${String(k)}`);
  if (!(Number.isInteger(rule.turnsEach) && rule.turnsEach > 0)) out.push('weather cycle: turnsEach must be a positive integer');
  if (rule.startsWith != null && !(Array.isArray(rule.cycle) && rule.cycle.includes(rule.startsWith))) out.push(`weather cycle: startsWith ${String(rule.startsWith)} is not in the cycle`);
  if (rule.postedTurnsAhead != null && !(Number.isInteger(rule.postedTurnsAhead) && rule.postedTurnsAhead >= 0)) out.push('weather cycle: postedTurnsAhead must be an integer >= 0');
  return out;
}

/**
 * The cycle's kind on battle turn `turn` (1-based).
 * @param {WeatherCycle} rule
 * @param {number} turn
 * @returns {string}
 */
export function cycleKindAt(rule, turn) {
  const n = rule.cycle.length;
  const start = rule.startsWith != null ? Math.max(0, rule.cycle.indexOf(rule.startsWith)) : 0;
  const step = Math.floor((Math.max(1, turn) - 1) / rule.turnsEach);
  return rule.cycle[(start + step) % n];
}

/**
 * Turns the cycle's kind still holds, counting `turn` itself.
 * @param {WeatherCycle} rule
 * @param {number} turn
 * @returns {number}
 */
export function cycleTurnsLeft(rule, turn) {
  return rule.turnsEach - ((Math.max(1, turn) - 1) % rule.turnsEach);
}

/**
 * The posted strip: the kind on each of `count` turns starting at `fromTurn`, given the cycle (or
 * a standing kind) under an optional timed weather that holds through turn `timed.lastTurn`.
 * @param {{cycle?: WeatherCycle|null, standing?: string|null, timed?: {kind: string, lastTurn: number}|null}} source
 * @param {number} fromTurn
 * @param {number} count
 * @param {ReadonlyMap<string, WeatherKind>} kinds
 * @returns {PostedTurn[]}
 */
export function weatherSchedule(source, fromTurn, count, kinds) {
  const out = [];
  for (let t = fromTurn; t < fromTurn + count; t++) {
    let kind = null;
    if (source.timed && t <= source.timed.lastTurn) kind = source.timed.kind;
    else if (source.cycle) kind = cycleKindAt(source.cycle, t);
    else kind = source.standing ?? null;
    const row = kind ? kinds.get(kind) : null;
    out.push({ turn: t, kind, name: row ? row.name : null });
  }
  return out;
}

/**
 * A cycle as one readable line, e.g. "Turns 1-3 Steam, 4-6 Ash, 7-9 Squall, 10-12 Clear, then repeat."
 * @param {WeatherCycle} rule
 * @param {ReadonlyMap<string, WeatherKind>} kinds
 * @returns {string}
 */
export function describeCycle(rule, kinds) {
  const n = rule.cycle.length;
  const start = rule.startsWith != null ? Math.max(0, rule.cycle.indexOf(rule.startsWith)) : 0;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const kind = rule.cycle[(start + i) % n];
    const a = i * rule.turnsEach + 1;
    const b = a + rule.turnsEach - 1;
    parts.push(`${a === b ? a : `${a}-${b}`} ${kinds.get(kind)?.name ?? kind}`);
  }
  return `Turns ${parts.join(', ')}, then repeat.`;
}

/**
 * Damage multiplier a weather gives a move of `moveType` (1 for typeless or unlisted types).
 * @param {WeatherKind|null|undefined} kind
 * @param {string|null} moveType
 * @returns {number}
 */
export function weatherPowerMult(kind, moveType) {
  if (!kind || moveType == null) return 1;
  const m = kind.power[moveType];
  return typeof m === 'number' ? m : 1;
}

/**
 * Chip fraction a weather deals a creature of `types` at the end of a turn (0 when immune or none).
 * @param {WeatherKind|null|undefined} kind
 * @param {readonly string[]} types
 * @returns {number}
 */
export function weatherChip(kind, types) {
  if (!kind || !kind.chip) return 0;
  return types.some((t) => kind.chip.chipImmune.includes(t)) ? 0 : kind.chip.fraction;
}

/**
 * The word the move menu shows beside a weather-touched move, or null.
 * @param {number} mult
 * @returns {'Boosted'|'Dampened'|null}
 */
export function weatherWord(mult) {
  if (mult > 1) return 'Boosted';
  if (mult < 1) return 'Dampened';
  return null;
}
