"use strict";
/**
 * scheduler.js — fire a callback at a specific wall-clock time in a specific
 * IANA timezone, every day, DST-correct. Built for "feed the cat at 10:00
 * America/Chicago" but generic.
 *
 * Why not just setInterval(24h)? Because of DST: a "day" in Chicago is
 * occasionally 23 or 25 hours, so a fixed 24h interval would drift off 10:00
 * twice a year. We instead compute the exact next 10:00-in-Chicago instant
 * each time and re-arm.
 *
 * Pure standard library (Intl) — no deps, runs under plain Node and Electron.
 */

// How far local wall-clock is ahead of UTC at `date`, in ms (local - utc).
function tzOffsetMs(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const m = {};
  for (const p of dtf.formatToParts(date)) m[p.type] = p.value;
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  return asUTC - date.getTime();
}

// The UTC instant (ms) for a given wall time Y-M-D h:m in `timeZone`.
// Two-pass correction handles DST transition edges.
function zonedWallTimeToUtc(y, mo, d, h, mi, timeZone) {
  const wallAsUTC = Date.UTC(y, mo - 1, d, h, mi, 0);
  let offset = tzOffsetMs(new Date(wallAsUTC), timeZone);
  let utc = wallAsUTC - offset;
  const offset2 = tzOffsetMs(new Date(utc), timeZone);
  if (offset2 !== offset) utc = wallAsUTC - offset2;
  return utc;
}

// Current calendar date (in the target tz) as {y, mo, d}.
function calendarDateInTz(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const m = {};
  for (const p of dtf.formatToParts(date)) m[p.type] = p.value;
  return { y: +m.year, mo: +m.month, d: +m.d || +m.day };
}

/**
 * The next UTC instant (ms) at which it's hour:minute in `timeZone`.
 * If that time today has already passed, returns tomorrow's.
 */
function nextOccurrence(hour, minute, timeZone, from = new Date()) {
  const { y, mo, d } = calendarDateInTz(from, timeZone);
  let utc = zonedWallTimeToUtc(y, mo, d, hour, minute, timeZone);
  if (utc <= from.getTime()) {
    // advance one calendar day (use a UTC date purely as a calendar)
    const cal = new Date(Date.UTC(y, mo - 1, d));
    cal.setUTCDate(cal.getUTCDate() + 1);
    utc = zonedWallTimeToUtc(
      cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(),
      hour, minute, timeZone
    );
  }
  return utc;
}

/**
 * Schedule `cb` to run every day at hour:minute in `timeZone`.
 * Returns a handle: { stop(), nextAt() }.
 */
function scheduleDaily(hour, minute, timeZone, cb) {
  let timer = null;
  let stopped = false;

  function arm() {
    if (stopped) return;
    const now = Date.now();
    const next = nextOccurrence(hour, minute, timeZone, new Date(now));
    const delay = Math.max(0, next - now); // always < ~25h, within setTimeout's range
    timer = setTimeout(async () => {
      if (stopped) return;
      try { await cb(new Date(next)); } catch { /* swallow — re-arm regardless */ }
      arm();
    }, delay);
    if (timer.unref) timer.unref(); // don't keep the process alive just for this
  }

  arm();
  return {
    stop() { stopped = true; if (timer) clearTimeout(timer); },
    nextAt() { return new Date(nextOccurrence(hour, minute, timeZone)); },
  };
}

module.exports = { scheduleDaily, nextOccurrence, zonedWallTimeToUtc, tzOffsetMs };
