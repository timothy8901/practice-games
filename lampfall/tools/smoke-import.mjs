#!/usr/bin/env node
/**
 * Imports every `js/**\/*.js` module under Node. [TOOLS]
 *
 * Rule 2 of the architecture: pure dirs (`js/data js/state js/battle js/world js/systems js/script`,
 * plus `js/config.js` and `js/debug/flags.js`) must import with no DOM at all; while they load, the DOM
 * globals are replaced by traps that throw, so a stray `window` or `localStorage` touch at import time
 * fails the run. Impure dirs (`js/scenes js/ui js/render js/audio js/debug js/core js/main.js`) are on
 * the guard list: they are imported too, but an import that fails only because the DOM is missing is
 * reported as "needs DOM" rather than a failure. Syntax errors and bad import paths fail everywhere.
 *
 * Usage: node tools/smoke-import.mjs [--quiet]      exit 1 on any failure
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'js');
const quiet = process.argv.includes('--quiet');

/** Directories (relative to js/) whose modules must be DOM-free at import time. */
export const PURE_DIRS = ['data', 'state', 'battle', 'world', 'systems', 'script'];
/** Individual files that are pure although they live in an impure dir. */
export const PURE_FILES = ['config.js', 'debug/flags.js'];
/** Directories allowed to need a DOM (import may fail with a DOM ReferenceError). */
export const IMPURE_DIRS = ['scenes', 'ui', 'render', 'audio', 'debug', 'core', 'art'];
/** Globals trapped while a pure module loads. */
const DOM_GLOBALS = ['window', 'document', 'localStorage', 'sessionStorage', 'location', 'HTMLElement', 'HTMLCanvasElement', 'OffscreenCanvas', 'AudioContext', 'requestAnimationFrame', 'Image'];
const DOM_RE = new RegExp(`\\b(${DOM_GLOBALS.concat(['navigator', 'self', 'indexedDB', 'matchMedia']).join('|')})\\b`);

/**
 * @param {string} dir
 * @returns {string[]} absolute paths of every .js file, sorted
 */
export function listModules(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listModules(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

/**
 * Classifies a module path relative to js/. Shims mirror the real layout, so `_shims/state/x.js`
 * is judged as `state/x.js`.
 * @param {string} rel  posix-style path relative to js/
 * @returns {'pure'|'impure'}
 */
export function classify(rel) {
  const r = rel.replace(/^_shims\//, '');
  if (PURE_FILES.includes(r)) return 'pure';
  const top = r.split('/')[0];
  if (PURE_DIRS.includes(top)) return 'pure';
  if (IMPURE_DIRS.includes(top) || r === 'main.js') return 'impure';
  return 'pure';
}

/** Installs throwing traps for DOM globals; returns a restore function. */
function trapDom() {
  const restores = [];
  for (const name of DOM_GLOBALS) {
    const desc = Object.getOwnPropertyDescriptor(globalThis, name);
    if (desc && !desc.configurable) continue;
    try {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() { throw new ReferenceError(`${name} is not available in a pure module (smoke-import trap)`); },
        set() { throw new ReferenceError(`${name} must not be assigned by a pure module (smoke-import trap)`); },
      });
      restores.push(() => { if (desc) Object.defineProperty(globalThis, name, desc); else delete globalThis[name]; });
    } catch { /* non-configurable in this runtime; skip */ }
  }
  return () => { for (const r of restores.reverse()) r(); };
}

/**
 * @param {string} file absolute path
 * @param {'pure'|'impure'} kind
 * @returns {Promise<{status: 'ok'|'needs-dom'|'fail', error?: string}>}
 */
export async function tryImport(file, kind) {
  const restore = kind === 'pure' ? trapDom() : () => {};
  try {
    await import(pathToFileURL(file).href);
    return { status: 'ok' };
  } catch (e) {
    const message = `${e && e.name ? `${e.name}: ` : ''}${e && e.message ? e.message : String(e)}`;
    const domMissing = e instanceof ReferenceError && DOM_RE.test(message) && !/smoke-import trap/.test(message);
    if (kind === 'impure' && domMissing) return { status: 'needs-dom', error: message };
    return { status: 'fail', error: message };
  } finally {
    restore();
  }
}

/** @returns {Promise<number>} exit code */
export async function main() {
  const files = listModules(JS);
  const rows = [];
  let failures = 0;
  for (const file of files) {
    const rel = relative(JS, file).split(sep).join('/');
    const kind = classify(rel);
    const res = await tryImport(file, kind);
    if (res.status === 'fail') failures++;
    rows.push({ rel, kind, ...res });
    if (!quiet || res.status !== 'ok') {
      const tag = res.status === 'ok' ? 'ok      ' : res.status === 'needs-dom' ? 'needsDOM' : 'FAIL    ';
      console.log(`${tag} ${kind.padEnd(6)} js/${rel}${res.error && res.status !== 'ok' ? `\n         ${res.error}` : ''}`);
    }
  }
  const ok = rows.filter((r) => r.status === 'ok').length;
  const dom = rows.filter((r) => r.status === 'needs-dom').length;
  console.log(`smoke-import: ${rows.length} modules, ${ok} ok, ${dom} need DOM, ${failures} failed`);
  return failures ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
