#!/usr/bin/env node
/**
 * Headless runner for the kit self-tests.  `node 3d-mazeball/test.mjs`
 *
 * The kit has no dependencies, so this runs anywhere Node does — put it in CI
 * before the daily seed is published (handoff §5.5).
 */

import { runAll } from './src/selftest.js';
import { PIECES, buildPiece, KIT_NAME, KIT_VERSION } from './src/pieces.js';

const r = runAll();
const byGroup = new Map();
for (const t of r.tests) {
  if (!byGroup.has(t.group)) byGroup.set(t.group, []);
  byGroup.get(t.group).push(t);
}

console.log(`\n${KIT_NAME} v${KIT_VERSION}\n`);
for (const [group, ts] of byGroup) {
  const bad = ts.filter(t => !t.pass);
  console.log(`  ${bad.length ? '✗' : '✓'} ${group.padEnd(14)} ${ts.length - bad.length}/${ts.length}`);
  for (const t of bad) console.log(`      FAIL  ${t.name}${t.detail ? `\n            ${t.detail}` : ''}`);
}

console.log('\n  provocations (each deliberately breaks a piece and must go red):');
for (const t of r.provocations) {
  console.log(`    ${t.pass ? '✓' : '✗ NO TEETH'}  ${t.name}`);
  if (!t.pass) console.log(`            ${t.detail}`);
}

let tris = 0, cols = 0;
for (const p of PIECES) {
  const b = buildPiece(p.id);
  tris += b.triangles; cols += b.collisionTriangles;
}
console.log(`\n  geometry: ${tris} render triangles, ${cols} collision triangles across 64 pieces`);
console.log(`  ${r.summary.pass}/${r.summary.total} checks, ${r.summary.provPass}/${r.summary.provTotal} provocations\n`);

const clean = r.summary.pass === r.summary.total && r.summary.provPass === r.summary.provTotal;
process.exit(clean ? 0 : 1);
