/**
 * @file Automated ground-contrast check (Wildshift bible 7.2): in every light and weather state, a
 * walkable tile and the blocking thing next to it must differ by at least 3:1. At 16px the eye reads
 * a boundary from its 1px cue (base line, bank, foam, coping), so each boundary lists the cue colours
 * actually drawn there; it passes when the best cue reaches 3:1 against the walkable colour (WCAG
 * relative-luminance ratio) after the hour's LUT.
 *
 * Fog (bible 7.3): ground within 4 tiles of the player stays clear, so the near field must reach 3:1
 * with no fog cover; farther tiles may "drop one palette step and stay visible", checked at 1.5:1
 * under the worst case where both drifting layers overlap.
 *
 * Run: node _merge-wip/proto/tiles/contrast-check.mjs   (exit 1 on any failure)
 */
import { COLORS } from './tiles.js';
import { gradeFor, gradeHex, FOG_ALPHA } from './render.js';

const BOUNDARIES = [
  { what: 'turf | tree trunk base line', walk: 'grass2', cues: ['base'] },
  { what: 'turf | pine / bush underside', walk: 'grass2', cues: ['pinek', 'pine0'] },
  { what: 'turf | cliff face base', walk: 'grass2', cues: ['base'] },
  { what: 'turf | house wall base', walk: 'grass2', cues: ['base'] },
  { what: 'turf | water (bank)', walk: 'grass2', cues: ['bank'] },
  { what: 'tall grass | tree base line', walk: 'grass3', cues: ['base'] },
  { what: 'path | house base', walk: 'pa1', cues: ['base'] },
  { what: 'path | fence post shade', walk: 'pa1', cues: ['base'] },
  { what: 'sand | rock outline', walk: 'sand2', cues: ['st0'] },
  { what: 'sand | water (bank, foam)', walk: 'sand2', cues: ['bank', 'foam'] },
  { what: 'wet sand | sea (foam, bank)', walk: 'wet1', cues: ['foam', 'bank'] },
  { what: 'mud flat | sea (foam)', walk: 'wmud1', cues: ['foam'] },
  { what: 'quay cobbles | sea (coping waterline)', walk: 'co2', cues: ['ink'] },
  { what: 'quay cobbles | waystone / lamp base', walk: 'co2', cues: ['base', 'wd0'] },
  { what: 'pier plank nosing | sea gap', walk: 'wd3', cues: ['ink'] },
];
const STATES = [
  ['dawn', 6.5], ['day', 12], ['golden', 17.25], ['sunset', 18.25], ['blue hour', 19.25], ['night', 22], ['deep night', 2],
];
const WEATHER = ['clear', 'rain', 'fog'];
const FOG_COVER = 1 - (1 - FOG_ALPHA[0]) * (1 - FOG_ALPHA[1]); // both drifting layers overlapping
const FOG = COLORS.st4;

const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}
function mix(a, b, t) {
  const p = (h, i) => parseInt(h.slice(i, i + 2), 16);
  return '#' + [1, 3, 5].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0')).join('');
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

let fails = 0;
const rows = [];
for (const [label, hour] of STATES) {
  for (const w of WEATHER) {
    const g = gradeFor(hour, w);
    const fields = w === 'fog' ? [['near', 0, 3], ['far', FOG_COVER, 1.5]] : [['', 0, 3]];
    for (const [field, cover, need] of fields) {
      const shade = (name) => {
        const hex = name.startsWith('!') ? COLORS[name] : gradeHex(COLORS[name], g, name);
        return cover ? mix(hex, gradeHex(FOG, g), cover) : hex;
      };
      for (const B of BOUNDARIES) {
        const walk = shade(B.walk);
        const best = Math.max(...B.cues.map((c) => ratio(walk, shade(c))));
        const ok = best >= need;
        if (!ok) fails++;
        rows.push({ state: `${label}/${w}${field ? ' ' + field : ''}`, boundary: B.what, ratio: best.toFixed(2), need, ok });
      }
    }
  }
}
const worst = {};
for (const r of rows) if (r.need === 3 && (!worst[r.boundary] || +r.ratio < +worst[r.boundary].ratio)) worst[r.boundary] = r;
console.log('worst case per boundary, every hour x weather (need >= 3.00; fog far field checked separately at 1.5):');
for (const r of Object.values(worst)) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.ratio.padStart(5)}  ${r.boundary}  [${r.state}]`);
const failed = rows.filter((r) => !r.ok);
if (failed.length) {
  console.log(`\n${failed.length} failing state/boundary pairs:`);
  for (const r of failed) console.log(`  ${r.ratio}  ${r.boundary}  [${r.state}]`);
}
console.log(`\n${rows.length} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
