#!/usr/bin/env node
/**
 * record.mjs — pick a good shift and record the reference bot driving it.
 *
 *   node 3d-mazeball/record.mjs [YYYY-MM-DD] > review/_run.json
 *
 * Searches forward from the given date (today by default) for a shift the bot
 * drives *clean* — reaching the elevator without needing a hand on any segment —
 * because a highlight reel of a bot getting stuck is not a highlight reel. Falls
 * back to the best merely-open shift if no clean one turns up.
 *
 * The output is a replay, not a recording of a render: positions, velocities and
 * angular velocities at 30 Hz. The capture page feeds those straight back into
 * the same scene the game draws, so the video is the real geometry and the real
 * camera, not an approximation of them.
 */

import { generateMaze, seedForDate, isoToday } from './src/generator.js';
import { assembleMaze } from './src/assemble.js';
import { runBot } from './src/validate.js';
import { applyOfficeTheme } from './src/theme.js';

const startIso = process.argv[2] || isoToday();
const SEARCH_DAYS = 24;
const SIZE = 6;

applyOfficeTheme(true);

const day = i => {
  const d = new Date(`${startIso}T00:00:00Z`);
  return isoToday(new Date(d.getTime() + i * 86400000));
};

let best = null;
for (let i = 0; i < SEARCH_DAYS; i++) {
  const iso = day(i);
  const seed = seedForDate(iso);
  const maze = generateMaze({ seed, width: SIZE, height: SIZE });
  const world = assembleMaze(maze, { theme: 'office', walls: true });
  const bot = runBot(world, { trailEvery: 4, richTrail: true });
  if (!bot.pass) continue;
  const score = (bot.clean ? 0 : 1000) + (bot.skipped || []).length * 100 + bot.falls * 10 + bot.seconds;
  if (!best || score < best.score) best = { iso, seed, maze, world, bot, score };
  if (bot.clean && bot.falls <= 4) break;          // good enough, stop looking
}

if (!best) {
  process.stderr.write('no shift in the search window was drivable\n');
  process.exit(1);
}

const { iso, seed, maze, bot } = best;
process.stderr.write(
  `shift ${iso} (0x${seed.toString(16).toUpperCase()})  `
  + `${bot.clean ? 'clean' : `${(bot.skipped || []).length} assisted`}  `
  + `${bot.seconds}s  ${bot.falls} falls  ${bot.trail.length} frames\n`,
);

process.stdout.write(JSON.stringify({
  iso,
  seed,
  size: SIZE,
  hz: 30,
  seconds: bot.seconds,
  falls: bot.falls,
  clean: !!bot.clean,
  rooms: maze.stats.occupied,
  routeRooms: maze.stats.pathLength,
  metres: maze.stats.metres,
  frames: bot.trail,
}));
