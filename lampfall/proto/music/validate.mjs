// node proto/music/validate.mjs — structural checks on the music data (no audio needed).
import { TRACKS, CUES, themeForHour, toEngine, DAY_PARTS, signalSting, stemLayers, defaultStems, worldCue, applyStems } from './tracks.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; };
const PRESETS = new Set(['pluck', 'pad', 'bass', 'bell', 'flute', 'kick', 'hat', 'snare', 'marimba', 'glass', 'kit', 'rhodes', 'brass']);
const DAY_IDS = DAY_PARTS.map(t => t.id);

for (const [id, t] of Object.entries(TRACKS)) {
  const spb = t.stepsPerBar || 16;
  const total = t.bars * spb;
  ok(t.loop === false ? (t.bpm >= 60 && t.bpm <= 300) : (t.bpm >= 60 && t.bpm <= 140), `${id}: bpm ${t.bpm}${t.loop === false ? ' (one-shot)' : ''}`);
  const problems = [];
  for (const [name, L] of Object.entries(t.layers)) {
    if (!PRESETS.has(L.inst)) problems.push(`${name}: unknown inst ${L.inst}`);
    if (!Array.isArray(L.pattern) || L.pattern.length === 0) { problems.push(`${name}: empty`); continue; }
    // melodies written in the P() DSL: every '|' must land on a bar boundary, or the tune drifts off its harmony
    if (L.pattern.barLines) for (const b of L.pattern.barLines) if (b % spb !== 0) problems.push(`${name}: bar line at step ${b} is not a multiple of ${spb}`);
    let last = -1, lastEnd = 0;
    for (const e of L.pattern) {
      if (!(e.t >= 0 && e.t < total)) problems.push(`${name}: t=${e.t} outside 0..${total - 1}`);
      if (e.t + e.d > total + 0) problems.push(`${name}: note at ${e.t} d=${e.d} runs past end ${total}`);
      const ns = Array.isArray(e.n) ? e.n : [e.n];
      for (const n of ns) if (!(n >= 24 && n <= 108)) problems.push(`${name}: midi ${n} at ${e.t} out of range`);
      if (!(e.v > 0 && e.v <= 1)) problems.push(`${name}: v=${e.v} at ${e.t}`);
      if (!(e.d >= 1)) problems.push(`${name}: d=${e.d} at ${e.t}`);
      if (L.role === 'melody' && e.t < lastEnd && e.t !== last) problems.push(`${name}: overlap at ${e.t} (prev ends ${lastEnd})`);
      last = e.t; lastEnd = Math.max(lastEnd, e.t + e.d);
    }
    // melodies must have rests / phrase endings and a real contour
    if (L.role === 'melody' && t.bars >= 8) {
      const pitches = L.pattern.map(e => Array.isArray(e.n) ? e.n[0] : e.n);
      const uniq = new Set(pitches).size;
      const covered = L.pattern.reduce((a, e) => a + e.d, 0);
      ok(uniq >= 6, `${id}.${name}: ${uniq} distinct pitches`);
      ok(covered < total, `${id}.${name}: has rests (${total - covered} rest steps of ${total})`);
      const lastNote = L.pattern[L.pattern.length - 1];
      ok(lastNote.t + lastNote.d <= total, `${id}.${name}: final note ends inside the loop`);
    }
  }
  ok(problems.length === 0, `${id}: layer data ${problems.length ? problems.slice(0, 5).join('; ') : 'clean'}`);
  // required stems on hour themes
  if (DAY_IDS.includes(id)) {
    for (const s of ['core', 'melody', 'bass', 'perc', 'night', 'tide', 'rain']) ok(!!t.layers[s], `${id}: has stem ${s}`);
    ok(!t.layers.battle, `${id}: no battle stem`);
    ok(t.bars >= 16 && t.bars <= 32 && t.bpm >= 84 && t.bpm <= 108, `${id}: ${t.bars} bars @ ${t.bpm} bpm within spec`);
  }
  const e = toEngine(t);
  ok(Object.keys(e.layers).length >= Object.keys(t.layers).length && Object.values(e.layers).every(L => L.inst !== 'kit'), `${id}: toEngine -> ${Object.keys(e.layers).length} engine layers, kit split`);
}
ok(DAY_PARTS.length === 8, 'eight day-part themes');
ok(themeForHour(0) === 'h_night_deep' && themeForHour(5) === 'h_predawn' && themeForHour(23) === 'h_night' && themeForHour(12) === 'h_midday', 'themeForHour mapping');
ok(CUES.world.stems.night({ hour: 22 }) && !CUES.world.stems.night({ hour: 12 }) && CUES.world.stems.night({ hour: 4 }), 'night stem 20:00-05:00');
ok(CUES.world.stems.tide({ tide: 0.8 }) && !CUES.world.stems.tide({ tide: 0.5 }), 'tide stem > 0.7');
ok(CUES.world.stems.rain({ weather: 'rain' }) && !CUES.world.stems.rain({ weather: 'clear' }), 'rain stem');
ok(CUES.battle.stems.tense({ hpRatio: 0.2 }) && !CUES.battle.stems.tense({ hpRatio: 0.5 }), 'tense stem at low HP');
ok(CUES.world.pick({ weekday: 6, hour: 20, place: 'market' }) === 'lantern_market', 'Saturday night market -> waltz');
for (const id of ['battle_wild', 'battle_trainer', 'battle_spire', 'summit']) ok(TRACKS[id].layers.tense && TRACKS[id].bpm >= 120 && TRACKS[id].bpm <= 132, `${id}: tense stem, ${TRACKS[id].bpm} bpm`);
ok(TRACKS.forecast.bars === 8, 'forecast is 8 bars');
ok(stemLayers(TRACKS.h_morning, 'perc').join(',') === 'perc.kick,perc.snare,perc.hat', 'perc stem maps to kick/snare/hat layers');
ok(TRACKS.victory.bars === 4 && TRACKS.shift_reveal.bars === 1 && TRACKS.shift_reveal.stepsPerBar === 32 && TRACKS.shift_reveal_anchor.stepsPerBar === 32 && TRACKS.letter.bars === 2 && TRACKS.relighting.bars === 24, 'sting lengths');
{
  // shift_reveal is locked to the 18f/36f/36f animation: 50 ms steps, phases 6/12/14 steps = 300/600/700 ms
  const sr = TRACKS.shift_reveal, stepMs = 60000 / sr.bpm / (sr.stepsPerBar / 4);
  const mel = sr.layers.melody.pattern, chordEv = mel[mel.length - 1];
  ok(Math.abs(stepMs - 50) < 1e-9 && chordEv.t === 18 && chordEv.d === 14 && CUES.shift_reveal.phasesMs.join() === '300,600,700', `shift_reveal grid ${stepMs} ms/step, chord at step ${chordEv.t} for ${chordEv.d} steps, phases ${CUES.shift_reveal.phasesMs.join('/')} ms`);
  ok(Object.values(TRACKS).filter(t => t.stepsPerBar === 12).every(t => toEngine(t).beatsPerBar === 3), '3/4 tracks reach the engine with beatsPerBar 3');
}
ok(signalSting([5, 4, 3, 2, 1, 0]).layers.melody.pattern.length === 7, 'signalSting builds a custom letter');
ok(Object.values(TRACKS).every(t => toEngine(t).loop === (t.loop !== false)) && toEngine(TRACKS.victory).loop === false && toEngine(TRACKS.h_morning).loop === true, 'toEngine forwards loop:false for stings');
{
  const c = worldCue({ hour: 22, weekday: 2, weather: 'rain', tide: 0.9, season: 'summer', place: 'town' });
  ok(c.track === 'h_night' && c.stems.night && c.stems.tide && c.stems.rain && c.stems.perc && c.fade === Math.round(2 * 4 * 60000 / 88), `worldCue 22:00 rain high tide -> ${JSON.stringify(c)}`);
  const d = worldCue({ hour: 3, weekday: 0, weather: 'clear', tide: 0.2, season: 'winter', place: 'town' });
  ok(d.track === 'h_predawn' && d.stems.night && !d.stems.perc && !d.stems.tide && d.intensity === 0.9, `worldCue 03:00 clear -> ${JSON.stringify(d)}`);
  const calls = []; const fake = { setStem: (n, on) => calls.push(n + '=' + on) };
  applyStems(fake, TRACKS.h_morning, { perc: false, night: true });
  ok(calls.join(' ') === 'perc.kick=false perc.snare=false perc.hat=false night=true', `applyStems fans out: ${calls.join(' ')}`);
  ok(defaultStems(TRACKS.h_morning).join(' ') === 'core melody bass perc.kick perc.snare perc.hat', `defaultStems: ${defaultStems(TRACKS.h_morning).join(' ')}`);
}
console.log(`\n${fails} failures, ${Object.keys(TRACKS).length} tracks`);
process.exit(fails ? 1 : 0);
