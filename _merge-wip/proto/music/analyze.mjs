// node proto/music/analyze.mjs [--json] [trackId ...]
// Music-director report on proto/music/tracks.js. No audio needed. Prints, per track:
//   bars, bpm, note count per layer, pitch range per layer, onset density per bar (melody, and every default-on layer),
//   out-of-scale notes, melody overlaps, empty bars per layer, instrument-range violations, bar-line alignment of the
//   melody DSL, strong-beat melody/harmony clashes (minor 2nd / major 7th against a sounding chord tone) and the same
//   against every other pitched layer, low-interval-limit violations (seconds/thirds voiced below C3), bass-root vs
//   harmony mismatches, loop-end tails (notes running past the loop), whether 3/4 tracks really move in three, and
//   whether the loop resolves (last melody note is a tone of the last chord; last chord leads back to the first).
// Exit code 1 when any ERROR is found; WARN lines are judgement calls to read, not failures.
import { TRACKS, DAY_PARTS } from './tracks.js';
import { SCALES, midiToNote } from '../../js/core/audio.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const only = args.filter(a => !a.startsWith('--'));
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const keyPc = (k) => { const m = /^([A-G])(#|b)?$/.exec(k); return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12; };
const DRUMS = new Set(['kick', 'snare', 'hat']);
// Playable range per preset, from the synth design in js/core/audio.js (glass is high-passed at 300 Hz, marimba partials
// vanish above ~C7, bass filter clamps at 600 Hz, pad sub-osc sits an octave below).
const RANGE = { pluck: [40, 96], pad: [36, 86], bass: [26, 62], bell: [48, 108], flute: [55, 98], marimba: [48, 96], glass: [60, 108] };
const LOW_INTERVAL_LIMIT = 48; // C3: seconds and thirds voiced below this turn to mud on small speakers
const STRONG = (spb) => spb === 12 ? [0, 4, 8] : [0, spb / 2];
const SECONDARY = (spb) => spb === 12 ? [] : [spb / 4, (3 * spb) / 4];

const name = (m) => midiToNote(m);
const notesOf = (e) => (Array.isArray(e.n) ? e.n : [e.n]).map(Number);
const pcDist = (a, b) => { const d = (((a - b) % 12) + 12) % 12; return Math.min(d, 12 - d); };

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
  const harmName = Object.keys(t.layers).find(k => t.layers[k] === harmL);
  // chord root guess: the pc from which the others stack as thirds (triad/7th), else sus, else lowest note
  const rootOf = (ch) => {
    const pcs = [...ch.pcs];
    for (const r of pcs) { const iv = pcs.map(p => (p - r + 12) % 12).sort((a, b) => a - b); if ((iv.includes(3) || iv.includes(4)) && iv.includes(7)) return r; }
    for (const r of pcs) { const iv = pcs.map(p => (p - r + 12) % 12); if (iv.includes(7) && (iv.includes(2) || iv.includes(5))) return r; }
    return Math.min(...ch.notes) % 12;
  };
  const chords = harmL ? harmL.pattern.map(e => { const notes = notesOf(e); const pcs = new Set(notes.map(n => n % 12)); const ch = { t: e.t, end: e.t + e.d, pcs, notes }; ch.root = rootOf(ch); ch.tones = new Set([...pcs, ch.root, (ch.root + 7) % 12]); return ch; }).sort((a, b) => a.t - b.t) : [];
  const chordAt = (step) => { let c = null; for (const ch of chords) { if (ch.t <= step) c = ch; else break; } return c; };
  if (chords.length) {
    // the harmony must cover the loop without holes or overlaps (gaps = bare bars, overlaps = two pads fighting)
    let cursor = 0; const holes = [], laps = [];
    for (const ch of chords) { if (ch.t > cursor) holes.push(`${cursor}..${ch.t}`); else if (ch.t < cursor) laps.push(`${ch.t}`); cursor = Math.max(cursor, ch.end); }
    if (cursor < total) holes.push(`${cursor}..${total}`);
    if (holes.length) warn(`${harmName}: harmony has gaps at steps ${holes.join(' ')}`);
    if (laps.length) warn(`${harmName}: overlapping chords at steps ${laps.join(' ')}`);
  }

  const onBar = Array.from({ length: t.bars }, () => 0); // default-on onsets per bar
  for (const [lname, L] of Object.entries(t.layers)) {
    const isDrum = L.inst === 'kit' || DRUMS.has(L.inst);
    const ev = [...L.pattern].sort((a, b) => a.t - b.t || 0);
    const pitches = isDrum ? [] : ev.flatMap(notesOf);
    const perBar = Array.from({ length: t.bars }, () => 0);
    for (const e of ev) if (e.t >= 0 && e.t < total) { perBar[Math.floor(e.t / spb)]++; if (L.default !== false) onBar[Math.floor(e.t / spb)]++; }
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
    // bar lines written in the P() DSL must land on bar boundaries
    const barLineBad = (L.pattern.barLines || []).filter(b => b % spb !== 0);
    // low-interval limit: seconds/thirds inside one chord event below C3
    const lowIv = [];
    if (!isDrum) for (const e of ev) { const ns = [...new Set(notesOf(e))].sort((a, b) => a - b); for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const iv = ns[j] - ns[i]; if (iv >= 1 && iv <= 4 && ns[i] < LOW_INTERVAL_LIMIT) lowIv.push(`${name(ns[i])}+${name(ns[j])}@bar${Math.floor(e.t / spb) + 1}`); } }
    const covered = ev.reduce((a, e) => a + Math.min(e.d, total - e.t), 0);
    const lay = {
      inst: L.inst, role: L.role, gain: L.gain, default: L.default !== false, notes: ev.length,
      range: pitches.length ? `${name(Math.min(...pitches))}..${name(Math.max(...pitches))}` : '-',
      vel: `${Math.min(...vels).toFixed(2)}-${Math.max(...vels).toFixed(2)} mean ${vmean.toFixed(2)}`,
      perBar, emptyBars: empty, outScale, overlaps, tails, rangeBad, lowIv, barLineBad,
      restPct: L.role === 'melody' ? Math.round(100 * (1 - covered / total)) : undefined,
    };
    R.layers[lname] = lay;
    if (outOfBounds.length) err(`${lname}: ${outOfBounds.length} events outside the loop (${outOfBounds.slice(0, 3).join(' ')})`);
    if (tails.length) err(`${lname}: notes run past the loop end: ${tails.slice(0, 3).join('; ')}`);
    if (overlaps.length) err(`${lname}: ${overlaps.length} overlapping notes in a monophonic line: ${overlaps.slice(0, 3).join('; ')}`);
    if (barLineBad.length) err(`${lname}: ${barLineBad.length} bar lines off the grid (steps ${barLineBad.slice(0, 4).join(' ')}; bar = ${spb} steps)`);
    if (rangeBad.length) err(`${lname} (${L.inst}): out of instrument range ${RANGE[L.inst].map(name).join('..')}: ${[...new Set(rangeBad)].slice(0, 6).join(' ')}`);
    if (lowIv.length) warn(`${lname}: ${lowIv.length} seconds/thirds voiced below ${name(LOW_INTERVAL_LIMIT)} (low-interval limit): ${[...new Set(lowIv)].slice(0, 4).join(' ')}`);
    if (outScale.length) warn(`${lname}: ${outScale.length} out-of-scale notes for ${t.key} ${t.scale}: ${[...new Set(outScale.map(s => s.split('@')[0]))].join(' ')} (${outScale.slice(0, 4).join(' ')})`);
    if (L.role === 'melody' && t.loop !== false) {
      let run = 0;
      for (let b = 0; b < t.bars; b++) { run = perBar[b] ? 0 : run + 1; if (run === 2) warn(`${lname}: melody silent for 2+ bars ending bar ${b + 1}`); }
    }
    if (ev.length && lname !== 'melody' && L.role !== 'melody' && !isDrum && L.role !== 'tide' && L.role !== 'bells' && L.role !== 'tense' && empty.length && t.loop !== false) info(`${lname}: empty bars ${empty.join(',')}`);
  }
  R.onBar = onBar;

  // ── 3/4: the waltz must really move in three ────────────────────────────────────────────────
  if (spb === 12) {
    const bassL = Object.values(t.layers).find(L => L.role === 'bass');
    const percL = Object.values(t.layers).find(L => L.role === 'perc');
    const badBars = [];
    for (let b = 0; b < t.bars; b++) {
      const bOn = new Set((bassL?.pattern || []).filter(e => Math.floor(e.t / spb) === b).map(e => e.t % spb));
      const kick = (percL?.pattern || []).some(e => Math.floor(e.t / spb) === b && e.t % spb === 0 && notesOf(e)[0] === 36);
      if (!(bOn.has(0) && bOn.has(4) && bOn.has(8)) || !kick) badBars.push(b + 1);
    }
    const mel = t.layers.melody ? t.layers.melody.pattern : [];
    const onBeat = mel.filter(e => e.t % 4 === 0).length;
    R.waltz = { badBars, melodyOnBeatPct: Math.round(100 * onBeat / (mel.length || 1)) };
    if (badBars.length) warn(`3/4: bass/kick do not mark beats 1-2-3 in bars ${badBars.join(',')}`);
    else info(`3/4: bass oom-pah-pah and kick on 1 in all ${t.bars} bars; ${R.waltz.melodyOnBeatPct}% of melody onsets on a beat`);
  }

  // ── melody vs harmony: strong-beat clashes, non-chord tones on downbeats ─────────────────────
  const mel = Object.entries(t.layers).filter(([, L]) => L.role === 'melody' || L.role === 'counter');
  const others = Object.entries(t.layers).filter(([n, L]) => L !== harmL && L.role !== 'melody' && L.role !== 'counter' && !DRUMS.has(L.inst) && L.inst !== 'kit' && L.role !== 'tense');
  for (const [lname, L] of mel) {
    const clashes = [], nct = [], voiceClash = [];
    for (const e of L.pattern) {
      const inBar = e.t % spb;
      const strong = STRONG(spb).includes(inBar), secondary = SECONDARY(spb).includes(inBar);
      if (!strong && !secondary) continue;
      const ch = chordAt(e.t);
      for (const n of notesOf(e)) {
        const pc = n % 12;
        if (ch && e.t < ch.end && !ch.tones.has(pc)) {
          const semi = [...ch.pcs].some(c => pcDist(pc, c) === 1);
          const tag = `${name(n)}@bar${Math.floor(e.t / spb) + 1}.${inBar} vs [${[...ch.notes].map(name).join(' ')}]`;
          if (semi && strong && e.d >= 2) clashes.push(tag);
          else if (strong && e.d >= 4) nct.push(tag);
        }
        if (!strong || e.d < 2) continue;
        // against every other pitched layer sounding at this onset (pads, counter-lines, bells, stems)
        for (const [oname, O] of others) {
          if (O.role === 'melody' && oname === lname) continue;
          for (const oe of O.pattern) {
            if (!(oe.t <= e.t && e.t < oe.t + oe.d)) continue;
            for (const on of notesOf(oe)) if (pcDist(on, pc) === 1) voiceClash.push(`${name(n)}@bar${Math.floor(e.t / spb) + 1}.${inBar} vs ${oname}${O.default === false ? '(stem)' : ''} ${name(on)}`);
          }
        }
      }
    }
    // other monophonic lines (counter) against the melody
    if (L.role === 'counter' && t.layers.melody) {
      for (const e of L.pattern) {
        if (!STRONG(spb).includes(e.t % spb)) continue;
        for (const me of t.layers.melody.pattern) {
          if (!(me.t <= e.t && e.t < me.t + me.d)) continue;
          for (const mn of notesOf(me)) for (const n of notesOf(e)) if (pcDist(mn, n) === 1) voiceClash.push(`${name(n)}@bar${Math.floor(e.t / spb) + 1}.${e.t % spb} vs melody ${name(mn)}`);
        }
      }
    }
    R.layers[lname].clashes = clashes;
    R.layers[lname].voiceClashes = voiceClash;
    if (clashes.length) warn(`${lname}: ${clashes.length} minor-2nd/maj-7th on a strong beat vs the harmony: ${clashes.join('; ')}`);
    if (voiceClash.length) warn(`${lname}: ${voiceClash.length} semitone(s) on a strong beat vs another layer: ${[...new Set(voiceClash)].slice(0, 6).join('; ')}`);
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
      if (bpc !== ch.root && !ch.pcs.has(bpc)) bad.push(`bar${Math.floor(ch.t / spb) + 1}: bass ${name(notesOf(onset)[0])} vs [${ch.notes.map(name).join(' ')}]`);
      else if (bpc !== ch.root) info(`bass inversion at bar ${Math.floor(ch.t / spb) + 1}: ${name(notesOf(onset)[0])} under [${ch.notes.map(name).join(' ')}]`);
    }
    if (bad.length) err(`bass: root does not match harmony: ${bad.slice(0, 4).join('; ')}`);
  }

  // ── loop resolution ─────────────────────────────────────────────────────────────────────────
  if (t.loop !== false && chords.length && t.layers.melody) {
    const last = chords[chords.length - 1], first = chords[0];
    const lr = last.root, fr = first.root;
    const iv = (fr - lr + 12) % 12;
    const leads = lr === fr || iv === 5 /* V->I */ || iv === 7 /* IV->I */ || iv === 2 /* bVII->I */ || iv === 10 /* ii->I */ || iv === 9 /* iii/vi ... */;
    R.loop = { lastChord: last.notes.map(name).join(' '), firstChord: first.notes.map(name).join(' '), interval: iv };
    if (!leads) warn(`loop: last chord [${R.loop.lastChord}] -> first [${R.loop.firstChord}] is an odd return (${iv} semitones)`);
    const m = [...t.layers.melody.pattern].sort((a, b) => a.t - b.t);
    const lastNote = m[m.length - 1];
    const ch = chordAt(lastNote.t);
    const lp = notesOf(lastNote)[0] % 12;
    if (ch && !ch.tones.has(lp)) warn(`loop: final melody note ${name(notesOf(lastNote)[0])} is not a tone of the final chord [${ch.notes.map(name).join(' ')}]`);
    R.loop.melodyEnd = name(notesOf(lastNote)[0]);
    R.loop.restBeforeLoop = total - (lastNote.t + lastNote.d);
  }

  // ── density summary ─────────────────────────────────────────────────────────────────────────
  const melody = R.layers.melody;
  const all = Object.values(R.layers).reduce((a, l) => a + l.notes, 0);
  const onCount = onBar.reduce((a, b) => a + b, 0);
  R.density = { melodyPerBar: melody ? +(melody.notes / t.bars).toFixed(2) : 0, defaultOnPerBar: +(onCount / t.bars).toFixed(1), allPerBar: +(all / t.bars).toFixed(1), melodyRestPct: melody ? melody.restPct : undefined };
  R.clashCount = Object.values(R.layers).reduce((a, l) => a + (l.clashes?.length || 0) + (l.voiceClashes?.length || 0), 0);
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
    console.log(`\n== ${R.id} "${R.title}" ${R.bpm}bpm ${R.bars}x${R.stepsPerBar}  melody ${R.density.melodyPerBar}/bar (${R.density.melodyRestPct ?? '-'}% rest)  default-on ${R.density.defaultOnPerBar}/bar  all ${R.density.allPerBar}/bar  strong-beat clashes ${R.clashCount}`);
    for (const [n, l] of Object.entries(R.layers)) {
      console.log(`  ${n.padEnd(8)} ${l.inst.padEnd(7)} ${String(l.notes).padStart(4)} notes  ${l.range.padEnd(9)} v ${l.vel}  gain ${l.gain}  loud~${R.balance[n]}  ${l.default ? 'on' : 'stem'}`);
      if (l.role === 'melody') console.log(`           per bar: ${l.perBar.join(' ')}`);
      if (l.emptyBars.length && l.role !== 'tide') console.log(`           empty bars: ${l.emptyBars.join(',')}`);
    }
    console.log(`  default-on onsets per bar: ${R.onBar.join(' ')}`);
    if (R.loop) console.log(`  loop: [${R.loop.lastChord}] -> [${R.loop.firstChord}], melody ends ${R.loop.melodyEnd}, ${R.loop.restBeforeLoop} rest steps before the loop`);
    for (const m of R.errors) console.log(`  ERROR ${m}`);
    for (const m of R.warns) console.log(`  WARN  ${m}`);
    for (const m of R.info) console.log(`  info  ${m}`);
  }
  // hour-of-day density curve
  console.log('\n== day-part density  (melody onsets/bar, melody rest %, default-on onsets/bar, all layers/bar, bpm)');
  for (const t of DAY_PARTS) { const R = reports.find(r => r.id === t.id); if (R) console.log(`  ${t.id.padEnd(16)} ${String(R.density.melodyPerBar).padStart(5)}  ${String(R.density.melodyRestPct).padStart(3)}%  ${String(R.density.defaultOnPerBar).padStart(5)}  ${String(R.density.allPerBar).padStart(5)}  ${t.bpm}`); }
  const nErr = reports.reduce((a, r) => a + r.errors.length, 0), nWarn = reports.reduce((a, r) => a + r.warns.length, 0);
  console.log(`\n${nErr} errors, ${nWarn} warnings across ${reports.length} tracks`);
}
process.exit(reports.some(r => r.errors.length) ? 1 : 0);
