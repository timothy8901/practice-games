/** SHIM for js/data/registry.js [DATA-IDX]. Delete at integration. */

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * @typedef {Object} Registry
 * @property {(table: string, id: string) => any} get   throws a readable Error when missing
 * @property {(table: string, id: string) => boolean} has
 * @property {(table: string) => any[]} list
 * @property {() => string[]} verify  id-format and duplicate checks; empty = ok
 * @property {string[]} tables
 */

/**
 * Builds id indexes over the DATA tables.
 * @param {Record<string, any>} DATA
 * @returns {Registry}
 */
export function createRegistry(DATA) {
  if (!DATA || typeof DATA !== 'object') throw new TypeError('createRegistry: DATA must be an object');
  /** @type {Map<string, Map<string, any>>} */
  const byId = new Map();
  for (const [table, rows] of Object.entries(DATA)) {
    if (!Array.isArray(rows)) continue;
    const index = new Map();
    for (const row of rows) if (row && typeof row.id === 'string') index.set(row.id, row);
    byId.set(table, index);
  }
  const tableOf = (table) => {
    const index = byId.get(table);
    if (!index) throw new Error(`data: unknown table '${table}' (have: ${[...byId.keys()].join(', ') || 'none'})`);
    return index;
  };
  return Object.freeze({
    tables: [...byId.keys()],
    get(table, id) {
      const row = tableOf(table).get(id);
      if (row === undefined) throw new Error(`data: no '${table}' row with id '${id}'`);
      return row;
    },
    has(table, id) {
      const index = byId.get(table);
      return Boolean(index && index.has(id));
    },
    list(table) {
      return DATA[table] ?? [];
    },
    verify() {
      const problems = [];
      for (const [table, rows] of Object.entries(DATA)) {
        if (!Array.isArray(rows)) continue;
        const seen = new Set();
        rows.forEach((row, i) => {
          const id = row && row.id;
          if (typeof id !== 'string' || !ID_RE.test(id)) problems.push(`${table}[${i}]: bad id ${JSON.stringify(id)}`);
          else if (seen.has(id)) problems.push(`${table}:${id}: duplicate id`);
          seen.add(id);
        });
      }
      return problems;
    },
  });
}
