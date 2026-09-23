"use strict";
/**
 * scheduler-test.js — assert the daily feeding time lands on exactly 10:00 in
 * America/Chicago, including across both DST boundaries.
 *
 *   node test/scheduler-test.js
 */

const assert = require("assert");
const { nextOccurrence } = require("../src/scheduler");

const TZ = "America/Chicago";

function chicagoWall(utcMs) {
  // "HH:MM" of the given instant in Chicago
  const d = new Date(utcMs);
  const m = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d)) m[p.type] = p.value;
  return `${m.hour}:${m.minute}`;
}

const cases = [
  ["now", new Date()],
  ["before 10am, winter (CST)", new Date("2026-01-15T15:30:00Z")], // 09:30 CST -> today 10:00
  ["after 10am, winter (CST)", new Date("2026-01-15T17:00:00Z")],  // 11:00 CST -> tomorrow 10:00
  ["spring-forward day (CDT begins)", new Date("2026-03-08T08:00:00Z")],
  ["fall-back day (CST resumes)", new Date("2026-11-01T08:00:00Z")],
  ["summer (CDT)", new Date("2026-07-04T20:00:00Z")],
];

let pass = 0;
for (const [label, from] of cases) {
  const next = nextOccurrence(10, 0, TZ, from);
  const wall = chicagoWall(next);
  const future = next > from.getTime();
  assert.strictEqual(wall, "10:00", `${label}: expected 10:00 Chicago, got ${wall}`);
  assert.ok(future, `${label}: next fire must be in the future`);
  console.log(`  PASS  ${label.padEnd(34)} -> ${new Date(next).toISOString()} (10:00 Chicago)`);
  pass++;
}

console.log(`\nALL ${pass} SCHEDULER CHECKS PASSED ✅`);
