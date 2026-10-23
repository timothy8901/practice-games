/**
 * The data registry: id lookups with readable errors over `DATA`. [DATA-IDX]
 *
 * `createRegistry(DATA)` indexes every table once. Array tables are indexed by `row.id`; object
 * tables (`scripts`, `encounters`) by key. `get` throws a message that names the table, the id and
 * the closest existing id; `has` never throws. `verify()` runs the id-format and duplicate checks
 * (the cross-reference rules live in `tools/validate-data.mjs`).
 *
 * Pure: no DOM, no randomness.
 * @module data/registry
 */

import { ID_RE, closestId } from './ids.js';

/**
 * @typedef {Object} Registry
 * @property {readonly string[]} tables                          table names
 * @property {(table: string, id: string) => any} get           the row; throws a readable Error when missing
 * @property {(table: string, id: string) => any|null} tryGet   the row or `null`; throws only for an unknown table
 * @property {(table: string, id: string) => boolean} has       false for an unknown table or id; never throws
 * @property {(table: string) => any[]} list                    every row (array tables) or value (object tables), declaration order
 * @property {(table: string) => string[]} ids                  every id, declaration order
 * @property {(table: string) => ReadonlyMap<string, any>} byId the id index (read-only Map)
 * @property {(table: string) => any} raw                       the table as exported by DATA
 * @property {(table: string, pred: (row: any) => boolean) => any[]} where   rows matching a predicate
 * @property {(table: string, field: string, value: any) => any[]} findBy    rows whose `field` equals `value`
 * @property {() => string[]} verify                            id-format and duplicate problems; empty = ok
 */

/**
 * Builds the registry.
 * @param {Record<string, any>} DATA   table name -> array of rows with ids, or object keyed by id
 * @returns {Registry}
 * @throws {TypeError} when `DATA` is not an object
 */
export function createRegistry(DATA) {
  if (!DATA || typeof DATA !== 'object' || Array.isArray(DATA)) {
    throw new TypeError('createRegistry: DATA must be an object of tables');
  }

  /** @type {Map<string, Map<string, any>>} */
  const indexes = new Map();
  /** @type {Map<string, string[]>} */
  const problemsByTable = new Map();

  for (const [table, rows] of Object.entries(DATA)) {
    /** @type {Map<string, any>} */
    const index = new Map();
    /** @type {string[]} */
    const problems = [];
    if (Array.isArray(rows)) {
      rows.forEach((row, i) => {
        const id = row && typeof row === 'object' ? row.id : undefined;
        if (typeof id !== 'string' || !ID_RE.test(id)) {
          problems.push(`${table}[${i}]: bad id ${JSON.stringify(id)} (expected ${ID_RE})`);
          return;
        }
        if (index.has(id)) problems.push(`${table}:${id}: duplicate id`);
        else index.set(id, row);
      });
    } else if (rows && typeof rows === 'object') {
      for (const [id, value] of Object.entries(rows)) {
        if (!ID_RE.test(id)) problems.push(`${table}:${id}: bad id (expected ${ID_RE})`);
        else index.set(id, value);
      }
    } else {
      problems.push(`${table}: table must be an array of rows or an object keyed by id, got ${typeof rows}`);
    }
    indexes.set(table, index);
    problemsByTable.set(table, problems);
  }

  const tables = Object.freeze([...indexes.keys()]);

  /**
   * @param {string} table
   * @param {string} method
   * @returns {Map<string, any>}
   */
  function tableOf(table, method) {
    const index = indexes.get(table);
    if (!index) {
      const hint = closestId(String(table), tables);
      throw new Error(`data.${method}: unknown table '${table}'${hint ? ` (did you mean '${hint}'?)` : ''}; tables: ${tables.join(', ')}`);
    }
    return index;
  }

  /** @type {Registry} */
  const registry = {
    tables,
    get(table, id) {
      const index = tableOf(table, 'get');
      if (typeof id !== 'string') throw new TypeError(`data.get: ${table} id must be a string, got ${typeof id}`);
      const row = index.get(id);
      if (row === undefined) {
        const hint = closestId(id, index.keys());
        throw new Error(`data.get: no '${table}' row with id '${id}'${hint ? ` (did you mean '${hint}'?)` : ''}`);
      }
      return row;
    },
    tryGet(table, id) {
      const index = tableOf(table, 'tryGet');
      const row = typeof id === 'string' ? index.get(id) : undefined;
      return row === undefined ? null : row;
    },
    has(table, id) {
      const index = indexes.get(table);
      return Boolean(index && typeof id === 'string' && index.has(id));
    },
    list(table) {
      return [...tableOf(table, 'list').values()];
    },
    ids(table) {
      return [...tableOf(table, 'ids').keys()];
    },
    byId(table) {
      return tableOf(table, 'byId');
    },
    raw(table) {
      tableOf(table, 'raw');
      return DATA[table];
    },
    where(table, pred) {
      if (typeof pred !== 'function') throw new TypeError('data.where: pred must be a function');
      return registry.list(table).filter(pred);
    },
    findBy(table, field, value) {
      return registry.list(table).filter((row) => row && typeof row === 'object' && row[field] === value);
    },
    verify() {
      /** @type {string[]} */
      const out = [];
      for (const problems of problemsByTable.values()) out.push(...problems);
      return out;
    },
  };
  return Object.freeze(registry);
}
