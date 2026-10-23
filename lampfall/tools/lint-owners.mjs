#!/usr/bin/env node
/**
 * Static half of rule 1 and rules 2 and 5 (ARCHITECTURE §8.3). [TOOLS]
 *
 * Three checks over every `js/**\/*.js` file, after comments and string contents are blanked (so
 * JSDoc that *mentions* `Math.random` or `world.flags = ...` never trips a rule):
 *
 * 1. **World ownership.** A write to `world.<key>` (assignment, compound assignment, `++/--`,
 *    `delete`, or a mutating array call such as `.push(`) — including writes deeper in the key such
 *    as `world.flags[id] = v` — is allowed only in a module listed for `<key>` in {@link OWNERS},
 *    or in a STATE module that builds or migrates whole worlds ({@link WORLD_BUILDERS}). The
 *    runtime half is the `?strict=1` store proxy; aliases (`const w = world`) are its job.
 * 2. **Randomness.** `Math.random` is banned outside `js/debug/`, the one `G.entropy` line in
 *    `main.js`, and the CORE platform files listed in {@link RANDOM_ALLOWED} (cosmetic audio noise
 *    and the CSPRNG fallback for a fresh seed; CORE is frozen and never decides game state).
 * 3. **Purity.** `document`, `window`, `navigator`, `localStorage` (bare or via `globalThis.`) are
 *    banned inside the pure dirs `js/{data,state,battle,world,systems,script}`.
 *
 * `js/_shims/<dir>/x.js` is classified exactly like `js/<dir>/x.js` (as tools/smoke-import does).
 *
 * Usage: node tools/lint-owners.mjs [--quiet]     exit 1 on any problem; lines are `file:line: message`.
 * @module tools/lint-owners
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * World key -> modules (paths relative to `js/`) allowed to write it. One line per key of the
 * `World` typedef in `js/state/schema.js`; a new key gets its line the day STATE adds it.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const OWNERS = Object.freeze({
  v: ['state/migrate.js', 'state/persist.js'],
  run: ['state/schema.js', 'systems/settings.js'],
  settings: ['systems/settings.js'],
  clock: ['systems/clockSys.js'],
  weather: ['systems/weather.js'],
  player: ['world/player.js', 'world/warps.js'],
  party: ['systems/party.js', 'systems/creature.js'],
  box: ['systems/party.js'],
  yard: ['systems/party.js'],
  bag: ['systems/bag.js'],
  wallet: ['systems/wallet.js'],
  loans: ['systems/loans.js'],
  shops: ['systems/shops.js'],
  flags: ['systems/flags.js'],
  counters: ['systems/flags.js'],
  threads: ['systems/threads.js'],
  letters: ['systems/letters.js'],
  npcs: ['systems/memory.js'],
  maps: ['systems/gather.js', 'systems/fishing.js', 'world/warps.js'],
  fieldLog: ['systems/fieldLog.js'],
  collections: ['systems/fieldLog.js'],
  badges: ['systems/flow/battleFlow.js'],
  pendingShifts: ['systems/forecast.js', 'systems/exp.js'],
  pendingScript: ['systems/flow/eventScripts.js', 'systems/flow/dayFlow.js'],
  cutscene: ['systems/flow/eventScripts.js'],
  battleBookmark: ['systems/flow/battleFlow.js'],
  rng: ['state/rngs.js'],
  stats: ['systems/stats.js'],
  log: ['systems/dayPage.js'],
  dayPage: ['systems/dayPage.js'],
  encounter: ['systems/encounter.js'],
});

/**
 * Known cross-lane writes, each one an open issue for the named lane (not a permission). Matching
 * writes are reported as "excepted" in the summary instead of failing; delete the entry with the fix.
 * @type {ReadonlyArray<Readonly<{file: string, key: string, lane: string, reason: string}>>}
 */
export const EXCEPTIONS = Object.freeze([]);

/** STATE modules that construct, fill or migrate whole worlds; they may write any key. */
export const WORLD_BUILDERS = Object.freeze(['state/schema.js', 'state/migrate.js', 'state/persist.js', 'state/store.js']);
/** Files (relative to `js/`) where `Math.random` is allowed besides `debug/`. */
export const RANDOM_ALLOWED = Object.freeze(['core/audio.js', 'core/rng.js']);
/** Directories (relative to `js/`) that must not touch the DOM. */
export const PURE_DIRS = Object.freeze(['data', 'state', 'battle', 'world', 'systems', 'script']);

const WRITE_RE = /(?<![\w$.])world\.([A-Za-z_$][\w$]*)((?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[[^\]\n]*\])*)\s*(\+\+|--|\*\*=|>>>=|<<=|>>=|&&=|\|\|=|\?\?=|[-+*/%&|^]=|=(?![=>])|\.\s*(?:push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\s*\()/g;
const PREFIX_RE = /(?:\+\+|--)\s*world\.([A-Za-z_$][\w$]*)/g;
const DELETE_RE = /\bdelete\s+world\.([A-Za-z_$][\w$]*)/g;
const RANDOM_RE = /\bMath\s*\.\s*random\b/g;
const DOM_RE = /(?<![\w$.])(?:globalThis\s*\.\s*)?(document|window|navigator|localStorage)\b/g;

/**
 * Blanks comments and the contents of string / template / regex literals, keeping every newline
 * and the column of every remaining character, so later regexes report true line numbers. Template
 * `${...}` expressions are kept (they are code). Regex literals are recognized by the usual
 * "previous significant character" heuristic.
 * @param {string} src
 * @returns {string}
 */
export function stripNonCode(src) {
  const out = src.split('');
  const n = src.length;
  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '; };
  /** @type {number[]} brace depth at which each open template `${` returns to template text */
  const tplStack = [];
  let depth = 0;
  let prev = '';             // last significant code character
  let i = 0;
  const scanTemplate = (start) => {
    // `start` is just after a backtick or a closing `}` of `${`; returns index after the template part
    let k = start;
    while (k < n) {
      const c = src[k];
      if (c === '\\') { k += 2; continue; }
      if (c === '`') { blank(start, k); return { end: k + 1, open: false }; }
      if (c === '$' && src[k + 1] === '{') { blank(start, k); return { end: k + 2, open: true }; }
      k++;
    }
    blank(start, n);
    return { end: n, open: false };
  };
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? n : e; blank(i, end); i = end; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; blank(i, end); i = end; continue; }
    if (c === '"' || c === "'") {
      let k = i + 1;
      while (k < n && src[k] !== c && src[k] !== '\n') k += src[k] === '\\' ? 2 : 1;
      blank(i + 1, Math.min(k, n));
      i = k + 1; prev = 'a'; continue;
    }
    if (c === '`') {
      const r = scanTemplate(i + 1);
      if (r.open) { tplStack.push(depth); depth++; }
      i = r.end; prev = 'a'; continue;
    }
    if (c === '/' && (prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev))) {
      let k = i + 1;
      let inClass = false;
      while (k < n && src[k] !== '\n') {
        const ch = src[k];
        if (ch === '\\') { k += 2; continue; }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) break;
        k++;
      }
      blank(i + 1, k);
      i = k + 1;
      while (i < n && /[a-z]/i.test(src[i])) i++;
      prev = 'a'; continue;
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (tplStack.length && tplStack[tplStack.length - 1] === depth) {
        tplStack.pop();
        const r = scanTemplate(i + 1);
        if (r.open) { tplStack.push(depth); depth++; }
        i = r.end; prev = 'a'; continue;
      }
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}

/**
 * The `js/`-relative classification path of a file: `_shims/<dir>/x.js` -> `<dir>/x.js`.
 * @param {string} rel path relative to `js/`, forward slashes
 * @returns {string}
 */
export function classify(rel) {
  return rel.startsWith('_shims/') ? rel.slice('_shims/'.length) : rel;
}

/**
 * Whether `rel` (classified, relative to `js/`) may write `world.<key>`.
 * @param {string} rel
 * @param {string} key
 * @returns {boolean}
 */
export function mayWrite(rel, key) {
  if (WORLD_BUILDERS.includes(rel)) return true;
  return (OWNERS[key] ?? []).includes(rel);
}

/**
 * Line number (1-based) of a character offset.
 * @param {string} src
 * @param {number} offset
 * @returns {number}
 */
function lineOf(src, offset) {
  let line = 1;
  for (let k = 0; k < offset; k++) if (src.charCodeAt(k) === 10) line++;
  return line;
}

/**
 * Lints one source file.
 * @param {string} rel     path relative to `js/` (forward slashes), e.g. `'systems/bag.js'`
 * @param {string} source  file contents
 * @param {{exceptions?: ReadonlyArray<{file: string, key: string}>, excepted?: Array<{file: string, line: number, key: string}>}} [opts]
 *   `exceptions` defaults to {@link EXCEPTIONS}; matching writes are pushed to `excepted` instead of the result
 * @returns {Array<{file: string, line: number, rule: 'owner'|'random'|'dom', message: string}>}
 */
export function lintSource(rel, source, opts = {}) {
  const exceptions = opts.exceptions ?? EXCEPTIONS;
  const file = `js/${rel}`;
  const cls = classify(rel);
  const code = stripNonCode(source);
  /** @type {Array<{file: string, line: number, rule: 'owner'|'random'|'dom', message: string}>} */
  const out = [];
  const lines = source.split('\n');
  const ownerHit = (key, index) => {
    if (mayWrite(cls, key)) return;
    if (exceptions.some((e) => e.file === cls && e.key === key)) {
      opts.excepted?.push({ file, line: lineOf(code, index), key });
      return;
    }
    const owners = OWNERS[key];
    out.push({
      file, line: lineOf(code, index), rule: 'owner',
      message: owners
        ? `writes world.${key}, owned by ${owners.map((o) => `js/${o}`).join(', ')} (call the owning system instead)`
        : `writes world.${key}, which has no owner in tools/lint-owners.mjs OWNERS (is it in the schema?)`,
    });
  };
  for (const m of code.matchAll(WRITE_RE)) ownerHit(m[1], m.index);
  for (const m of code.matchAll(PREFIX_RE)) ownerHit(m[1], m.index);
  for (const m of code.matchAll(DELETE_RE)) ownerHit(m[1], m.index);

  if (!cls.startsWith('debug/') && !RANDOM_ALLOWED.includes(cls)) {
    for (const m of code.matchAll(RANDOM_RE)) {
      const line = lineOf(code, m.index);
      if (cls === 'main.js' && /\bentropy\b/.test(lines[line - 1] ?? '')) continue;
      out.push({ file, line, rule: 'random', message: 'Math.random is banned (rule 5): draw from a named rng fork, or G.entropy for cosmetics' });
    }
  }

  if (PURE_DIRS.some((d) => cls.startsWith(`${d}/`))) {
    for (const m of code.matchAll(DOM_RE)) {
      out.push({ file, line: lineOf(code, m.index), rule: 'dom', message: `'${m[1]}' in a pure directory (rule 2): pass the dependency in from the shell` });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

/**
 * @param {string} dir absolute
 * @returns {string[]} absolute paths of every .js file, sorted
 */
function listJs(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listJs(p));
    else if (name.endsWith('.js') || name.endsWith('.mjs')) out.push(p);
  }
  return out;
}

/**
 * Lints every module under `<root>/js`.
 * @param {string} [root]
 * @param {Array<{file: string, line: number, key: string}>} [excepted] collects writes allowed by {@link EXCEPTIONS}
 * @returns {Array<{file: string, line: number, rule: string, message: string}>}
 */
export function lintTree(root = ROOT, excepted = []) {
  const js = join(root, 'js');
  const out = [];
  for (const abs of listJs(js)) {
    const rel = relative(js, abs).split(sep).join('/');
    out.push(...lintSource(rel, readFileSync(abs, 'utf8'), { excepted }));
  }
  return out;
}

/**
 * CLI entry.
 * @param {string[]} [argv]
 * @returns {number} exit code
 */
export function main(argv = process.argv.slice(2)) {
  const quiet = argv.includes('--quiet');
  const excepted = [];
  const problems = lintTree(ROOT, excepted);
  for (const p of problems) console.error(`${p.file}:${p.line}: [${p.rule}] ${p.message}`);
  if (!quiet) {
    for (const e of excepted) {
      const ex = EXCEPTIONS.find((x) => `js/${x.file}` === e.file && x.key === e.key);
      console.warn(`${e.file}:${e.line}: [excepted] writes world.${e.key} — open issue for ${ex?.lane}: ${ex?.reason}`);
    }
  }
  if (!quiet || problems.length) console.log(`lint-owners: ${problems.length} problem${problems.length === 1 ? '' : 's'}, ${excepted.length} excepted`);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
