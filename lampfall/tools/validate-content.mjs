#!/usr/bin/env node
// Validate the staged real-content DATA (js/data/content.js) against the rules and the id manifest.
// Errors that point into tables still on placeholders are reported separately as "pending".
import { validateData, checkManifest } from './validate-data.mjs';
import { DATA_CONTENT, CONTENT_STATUS } from '../js/data/content.js';
import * as M from '../js/data/ids.manifest.js';

const res = validateData(DATA_CONTENT, {});
const errors = (res.errors ?? res.problems ?? []).map(String);
const warnings = (res.warnings ?? []).map(String);
const real = Object.entries(CONTENT_STATUS).filter(([, v]) => v).map(([k]) => k);
const pending = Object.entries(CONTENT_STATUS).filter(([, v]) => !v).map(([k]) => k);
const tableOf = (line) => (line.match(/^(?:error |warn )?([a-zA-Z]+)[:*]/) || [])[1] ?? '?';
// Words in validator messages that point at a table: plural table names plus the singular forms used in messages.
const ALIASES = { collections: ['collection', 'relic', 'fish', 'bug', 'fruit'], maps: ['map'], npcs: ['npc'], items: ['item'],
  species: ['species', 'form'], moves: ['move'], abilities: ['ability'], trainers: ['trainer'], scripts: ['script'],
  shops: ['shop'], families: ['family'], encounters: ['encounter'], tilesets: ['tile'], regions: ['region'] };
const refsPending = (line) => pending.some((t) => [t, ...(ALIASES[t] ?? [])].some((w) => new RegExp(`\\b${w}s?\\b`).test(line.replace(/^\\S+\\s+\\S+:\\s*/, ''))));
const own = errors.filter((e) => real.includes(tableOf(e)) && !refsPending(e));
const dangling = errors.filter((e) => real.includes(tableOf(e)) && refsPending(e));
const manifest = checkManifest(DATA_CONTENT, M.MANIFEST ?? M);
console.log(`real tables: ${real.join(', ')}`);
console.log(`pending (placeholder) tables: ${pending.join(', ')}`);
console.log(`errors inside real tables: ${own.length}`);
for (const e of own.slice(0, 60)) console.log('  ' + e);
console.log(`references into pending tables (resolve when those chapters land): ${dangling.length}`);
const mlines = (manifest?.lines ?? manifest?.warnings ?? manifest ?? []);
const mreal = (Array.isArray(mlines) ? mlines : []).map(String).filter((l) => real.some((t) => l.includes(`'${t}'`)));
console.log(`manifest notes for real tables: ${mreal.length}`);
for (const l of mreal) console.log('  ' + l);
process.exit(own.length ? 1 : 0);
