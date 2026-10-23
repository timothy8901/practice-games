/**
 * Id conventions shared by every content table (ARCHITECTURE §8.1). [DATA-IDX]
 *
 * Ids are kebab-case (`^[a-z0-9][a-z0-9-]*$`) and unique within a table. Display names live in
 * `name` fields, never in ids. This module is pure and has no imports.
 * @module data/ids
 */

/** The id grammar: lower-case letters, digits and single hyphens, starting with a letter or digit. */
export const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Whether `v` is a well-formed id.
 * @param {unknown} v
 * @returns {v is string}
 */
export function isId(v) {
  return typeof v === 'string' && ID_RE.test(v);
}

/**
 * Asserts `v` is a well-formed id and returns it.
 * @param {unknown} v
 * @param {string} [where] context for the error message, e.g. `'species[3]'`
 * @returns {string}
 * @throws {TypeError} when malformed
 */
export function assertId(v, where = 'id') {
  if (!isId(v)) throw new TypeError(`${where}: ${JSON.stringify(v)} is not a kebab-case id (${ID_RE})`);
  return v;
}

/**
 * Lower-cases and hyphenates a display name into an id candidate: `'Wren Hearthwright'` ->
 * `'wren-hearthwright'`. Used by the script shorthand parser to look a speaker up by id.
 * @param {string} name
 * @returns {string}
 */
export function kebab(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds a frozen `id -> row` index over a list of rows, failing loudly on a bad or duplicate id.
 * @template {{id: string}} T
 * @param {readonly T[]} list
 * @param {string} [table] name used in error messages
 * @returns {Readonly<Record<string, T>>}
 * @throws {TypeError} for a non-array, a row without a valid id, or a duplicate id
 */
export function index(list, table = 'table') {
  if (!Array.isArray(list)) throw new TypeError(`ids.index: ${table} must be an array of rows`);
  /** @type {Record<string, T>} */
  const out = Object.create(null);
  list.forEach((row, i) => {
    if (!row || typeof row !== 'object') throw new TypeError(`${table}[${i}]: row must be an object`);
    const id = assertId(row.id, `${table}[${i}].id`);
    if (id in out) throw new TypeError(`${table}:${id}: duplicate id`);
    out[id] = row;
  });
  return Object.freeze(out);
}

/**
 * Deep-freezes objects and arrays in place (content tables are frozen at import). An object that
 * is already frozen is still descended into, because content files commonly `Object.freeze` only
 * the outer array; functions are left alone and cycles are safe.
 * @template T
 * @param {T} v
 * @param {WeakSet<object>} [seen]
 * @returns {T}
 */
export function deepFreeze(v, seen = new WeakSet()) {
  if (v === null || typeof v !== 'object' || seen.has(v)) return v;
  seen.add(v);
  if (!Object.isFrozen(v)) Object.freeze(v);
  for (const k of Object.keys(v)) deepFreeze(/** @type {any} */ (v)[k], seen);
  return v;
}

/**
 * Closest id to `id` among `candidates` by edit distance (for "did you mean" messages).
 * @param {string} id
 * @param {Iterable<string>} candidates
 * @param {number} [maxDistance=3]
 * @returns {string|null}
 */
export function closestId(id, candidates, maxDistance = 3) {
  let best = null;
  let bestD = maxDistance + 1;
  for (const c of candidates) {
    const d = editDistance(String(id), c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/**
 * Levenshtein distance (small inputs only).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
