// node proto/music/analyze.mjs [--json] [trackId ...]
// Music-director report on proto/music/tracks.js. No audio needed. Prints, per track:
//   bars, bpm, note count per layer, pitch range per layer, onset density per bar (melody + all),
//   out-of-scale notes, melody overlaps, empty bars per layer, instrument-range violations,
//   strong-beat melody/harmony clashes (minor 2nd / major 7th against a sounding chord tone),
//   bass-root vs harmony mismatches, loop-end tails (notes running past the loop) and whether the
//   loop resolves (last melody note is a tone of the last chord; last chord leads back to the first).
// Exit code 1 when any ERROR is found; WARN lines are judgement calls to read, not failures.
import { TRACKS, DAY_PARTS } from './tracks.js';
import { SCALES, midiToNote } from '../../js/core/audio.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const only = args.filter(a => !a.startsWith('--'));
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const keyPc = (k) => { const m = /^([A-G])(#|b)?$/.exec(k); return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12; };
const DRUMS = new Set(['kick', 'snare', 'hat']);
// Playable range per preset, from the synth design in js/core/audio.js (glass is high-passed at 300 Hz,
// marimba partials vanish above ~C7, bass filter clamps at 600 Hz, pad sub-osc sits an octave below).
const RANGE = { pluck: [40, 96], pad: [36, 86], bass: [26, 62], bell: [48, 108], flute: [55, 98], marimba: [48, 96], glass: [60, 108] };
const STRONG = (spb) => spb === 12 ? [0, 4, 8] : [0, 8];
const SECONDARY = (spb) => spb === 12 ? [] : [4, 12];

const name = (m) => midiToNote(m);
const notesOf = (e) => (Array.isArray(e.n) ? e.n : [e.n]).map(Number);

function analyze(id, t) {
  const spb = t.stepsPerBar || 16;
  const total = t.bars * spb;
  const scale = SCALES[t.scale];
  const root = keyPc(t.key);
  const inScale = new Set(scale.map(i => (root + i) % 12));
  const R = { id, title: t.title, bpm: t.bpm, bars: t.bars, stepsPerBar: spb, layers: {}, errors: [], warns: [], info: [] };
  const err = (m) => R.errors.push(m), warn = (m) => R.warns.push(m), info = (m) => R.info.push(m);

  // ── harmony timeline from the pad-style chord layer (core pad, else 'pad') ───────────────────
  const harmL = Object.values(t.layers).find(L => L.role === 'core' && L.inst === 'pad') || t.layers.pad || Object.values(t.layers).find(L => L.role === 'core' && Array.isArray(L.pattern[0]?.n));
  const chords = harmL ? harmL.pattern.map(e => ({ t: e.t, end: e.t + e.d, pcs: new Set(notesOf(e).map(n => n % 12)), notes: notesOf(e) })).sort((a, b) => a.t - b.t) : [];
  const chordAt = (step) => { let c = null; for (const ch of chords) { if (ch.t <= step) c = ch; else break; } return c; };
  // chord root guess: the pc from which the others stack as thirds (triad/7th), else lowest note
  const rootOf = (ch) => {
    const pcs = [...ch.pcs];
    for (const r of pcs) { const iv = pcs.map(p => (p - r + 12) % 12).sort((a, b) => a - b); if ((iv.includes(3) || iv.includes(4)) && iv.includes(7)) return r; }
    for (const r of pcs) { const iv = pcs.map(p => (p - r + 12) % 12); if (iv.includes(7) && (iv.includes(2) || iv.includes(5))) return r; } // sus
    return Math.min(...ch.notes) % 12;
  };

  for (const [lname, L] of Object.entries(t.layers)) {
    const isDrum = L.inst === 'kit' || DRUMS.has(L.inst);
    const ev = [...L.pattern].sort((a, b) => a.t - b.t || 0);
    const pitches = isDrum ? [] : ev.flatMap(notesOf);
    const perBar = Array.from({ length: t.bars }, () => 0);
    for (const e of ev) if (e.t >= 0 && e.t < total) perBar[Math.floor(e.t / spb)]++;
    const empty = perBar.map((c, i) => c === 0 ? i + 1 : -1).filter(i => i > 0);
    const outScale = isDrum ? [] : ev.flatMap(e => notesOf(e).filter(n => !inScale.has(n % 12)).map(n => `${name(n)}@${e.t}`));
    const tails = ev.filter(e => e.t + e.d > total).map(e => `t=${e.t} d=${e.d} ends ${e.t + e.d - total} past loop`);
    const outOfBounds = ev.filter(e => e.t < 0 || e.t >= total).map(e => `t=${e.t}`);
    const rangeBad = [];
    if (!isDrum && RANGE[L.inst]) { const [lo, hi] = RANGE[L.inst]; for (const e of ev) for (const n of notesOf(e)) if (n < lo || n > hi) rangeBad.push(`${name(n)}@${e.t}`); }
    const vels = ev.map(e => e.v);
    const vmean = vels.reduce((a, b) => a + b, 0) / (vels.length || 1);
    // melody overlaps (monophonic lines only)
    const overlaps = [];
    if (L.role === 'melody' || L.role === 'counter') {
      let lastEnd = -1, lastT = -1;
      for (const e of ev) { if (e.t < lastEnd && e.t !== lastT) overlaps.push(`t=${e.t} (prev ends ${lastEnd})`); lastT = e.t; lastEnd = Math.max(lastEnd, e.t + e.d); }
    }
    const lay = {
      inst: L.inst, role: L.role, gain: L.gain, default: L.default !== false, notes: ev.length,
      range: pitches.length ? `${name(Math.min(...pitches))}..${name(Math.max(...pitches))}` : '-',
      vel: `${Math.min(...vels).toFixed(2)}-${Math.max(...vels).toFixed(2)} mean ${vmean.toFixed(2)}`,
      perBar, emptyBars: empty, outScale, overlaps, tails, rangeBad,
    };
    R.layers[lname] = lay;
    if (outOfBounds.length) err(`${lname}: ${outOfBounds.length} events outside the loop (${outOfBounds.slice(0, 3).join(' ')})`);
    if (tails.length) err(`${lname}: notes run past the loop end: ${tails.slice(0, 3).join('; ')}`);
    if (overlaps.length) err(`${lname}: ${overlaps.length} overlapping notes in a monophonic line: ${overlaps.slice(0, 3).join('; ')}`);
    if (rangeBad.length) err(`${lname} (${L.inst}): out of instrument range ${RANGE[L.inst].map(name).join('..')}: ${[...new Set(rangeBad)].slice(0, 6).join(' ')}`);
    if (outScale.length) warn(`${lname}: ${outScale.length} out-of-scale notes for ${t.key} ${t.scale}: ${[...new Set(outScale.map(s => s.split('@')[0]))].join(' ')} (${outScale.slice(0, 4).join(' ')})`);
    if (L.role === 'melody' && t.loop !== false) {
      // runs of empty melody bars inside a looping theme
      let run = 0;
      for (let b = 0; b < t.bars; b++) { run = perBar[b] ? 0 : run + 1; if (run === 2) warn(`${lname}: melody silent for 2+ bars ending bar ${b + 1}`); }
    }
    if (ev.length && lname !== 'melody' && L.role !== 'melody' && !isDrum && L.role !== 'tide' && L.role !== 'bells' && L.role !== 'tense' && empty.length && t.loop !== false) info(`${lname}: empty bars ${empty.join(',')}`);
  }

  // ── melody vs harmony: strong-beat clashes, non-chord tones on downbeats ─────────────────────
  const mel = Object.entries(t.layers).filter(([, L]) => L.role === 'melody' || L.role === 'counter');
  for (const [lname, L] of mel) {
    const clashes = [], nct = [];
    for (const e of L.pattern) {
      const inBar = e.t % spb;
      const strong = STRONG(spb).includes(inBar), secondary = SECONDARY(spb).includes(inBar);
      if (!strong && !secondary) continue;
      const ch = chordAt(e.t);
      if (!ch || e.t >= ch.end) continue;
      for (const n of notesOf(e)) {
        const pc = n % 12;
        if (ch.pcs.has(pc)) continue;
        const semi = [...ch.pcs].some(c => (pc - c + 12) % 12 === 1 || (pc - c + 12) % 12 === 11);
        const tag = `${name(n)}@bar${Math.floor(e.t / spb) + 1}.${inBar} vs [${[...ch.notes].map(name).join(' ')}]`;
        if (semi && strong && e.d >= 2) clashes.push(tag);
        else if (strong && e.d >= 4) nct.push(tag);
      }
    }
    R.layers[lname].clashes = clashes;
    if (clashes.length) warn(`${lname}: minor-2nd/maj-7th on a strong beat: ${clashes.join('; ')}`);
    if (nct.length) info(`${lname}: long non-chord tones on downbeats: ${nct.join('; ')}`);
  }

  // ── bass roots vs harmony ───────────────────────────────────────────────────────────────────
  const bassL = Object.values(t.layers).find(L => L.role === 'bass');
  if (bassL && chords.length) {
    const bad = [];
    for (const ch of chords) {
      const onset = bassL.pattern.filter(e => e.t >= ch.t && e.t < ch.end).sort((a, b) => a.t - b.t)[0];
      if (!onset) continue;
      const bpc = notesOf(onset)[0] % 12;
      if (bpc !== rootOf(ch) && !ch.pcs.has(bpc)) bad.push(`bar${Math.floor(ch.t / spb) + 1}: bass ${name(notesOf(onset)[0])} vs [${ch.notes.map(name).join(' ')}]`);
      else if (bpc !== rootOf(ch)) info(`bass inversion at bar ${Math.floor(ch.t / spb) + 1}: ${name(notesOf(onset)[0])} under [${ch.notes.map(name).join(' ')}]`);
    }
    if (bad.length) err(`bass: root does not match harmony: ${bad.slice(0, 4).join('; ')}`);
  }

  // ── loop resolution ─────────────────────────────────────────────────────────────────────────
  if (t.loop !== false && chords.length && t.layers.melody) {
    const last = chords[chords.length - 1], first = chords[0];
    const lr = rootOf(last), fr = rootOf(first);
    const iv = (fr - lr + 12) % 12;
    const leads = lr === fr || iv === 5 /* V->I */ || iv === 7 /* IV->I */ || iv === 2 /* bVII->I */ || iv === 10 /* ii->I */ || iv === 9 /* iii/vi ... */;
    R.loop = { lastChord: last.notes.map(name).join(' '), firstChord: first.notes.map(name).join(' '), interval: iv };
    if (!leads) warn(`loop: last chord [${R.loop.lastChord}] -> first [${R.loop.firstChord}] is an odd return (${iv} semitones)`);
    const m = [...t.layers.melody.pattern].sort((a, b) => a.t - b.t);
    const lastNote = m[m.length - 1];
    const ch = chordAt(lastNote.t);
    const lp = notesOf(lastNote)[0] % 12;
    if (ch && !ch.pcs.has(lp)) warn(`loop: final melody note ${name(notesOf(lastNote)[0])} is not a tone of the final chord [${ch.notes.map(name).join(' ')}]`);
    R.loop.melodyEnd = name(notesOf(lastNote)[0]);
    R.loop.restBeforeLoop = total - (lastNote.t + lastNote.d);
  }

  // ── density summary ─────────────────────────────────────────────────────────────────────────
  const melody = R.layers.melody;
  const all = Object.values(R.layers).reduce((a, l) => a + l.notes, 0);
  R.density = { melodyPerBar: melody ? +(melody.notes / t.bars).toFixed(2) : 0, allPerBar: +(all / t.bars).toFixed(1) };
  // rough loudness per layer: gain x mean velocity x preset peak (from the synth envelopes)
  const PEAK = { pluck: 0.32, pad: 0.33, bass: 0.55, bell: 0.45, flute: 0.3, marimba: 0.45, glass: 0.34, kit: 0.5, kick: 0.75, snare: 0.5, hat: 0.22 };
  R.balance = Object.fromEntries(Object.entries(t.layers).map(([n, L]) => {
    const vm = L.pattern.reduce((a, e) => a + e.v, 0) / L.pattern.length;
    return [n, +(L.gain * vm * (PEAK[L.inst] || 0.4)).toFixed(3)];
  }));
  return R;
}

const ids = only.length ? only : Object.keys(TRACKS);
const reports = ids.map(id => analyze(id, TRACKS[id]));
if (asJson) { console.log(JSON.stringify(reports, null, 1)); }
else {
  for (const R of reports) {
    console.log(`\n== ${R.id} "${R.title}" ${R.bpm}bpm ${R.bars}x${R.stepsPerBar} melody ${R.density.melodyPerBar}/bar all ${R.density.allPerBar}/bar`);
    for (const [n, l] of Object.entries(R.layers)) {
      console.log(`  ${n.padEnd(8)} ${l.inst.padEnd(7)} ${String(l.notes).padStart(4)} notes  ${l.range.padEnd(9)} v ${l.vel}  gain ${l.gain}  loud~${R.balance[n]}  ${l.default ? 'on' : 'stem'}`);
      if (l.role === 'melody') console.log(`           per bar: ${l.perBar.join(' ')}`);
      if (l.emptyBars.length && l.role !== 'tide') console.log(`           empty bars: ${l.emptyBars.join(',')}`);
    }
    if (R.loop) console.log(`  loop: [${R.loop.lastChord}] -> [${R.loop.firstChord}], melody ends ${R.loop.melodyEnd}, ${R.loop.restBeforeLoop} rest steps before the loop`);
    for (const m of R.errors) console.log(`  ERROR ${m}`);
    for (const m of R.warns) console.log(`  WARN  ${m}`);
    for (const m of R.info) console.log(`  info  ${m}`);
  }
  // hour-of-day density curve
  console.log('\n== day-part density (melody onsets per bar, all onsets per bar, bpm)');
  for (const t of DAY_PARTS) { const R = reports.find(r => r.id === t.id); if (R) console.log(`  ${t.id.padEnd(16)} ${String(R.density.melodyPerBar).padStart(5)}  ${String(R.density.allPerBar).padStart(5)}  ${t.bpm}`); }
  const nErr = reports.reduce((a, r) => a + r.errors.length, 0), nWarn = reports.reduce((a, r) => a + r.warns.length, 0);
  console.log(`\n${nErr} errors, ${nWarn} warnings across ${reports.length} tracks`);
}
process.exit(reports.some(r => r.errors.length) ? 1 : 0);
