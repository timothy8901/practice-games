# Music plan — Porchlight x Wildshift

All music is sequenced and synthesized at runtime through `js/core/audio.js` (WebAudio, no samples).
This folder holds the **data** (`tracks.js`), a structural validator (`validate.mjs`), and a demo /
test page (`demo.html`). Nothing here touches the DOM except the demo.

```
node proto/music/validate.mjs        # structural checks, no audio needed
node proto/music/analyze.mjs         # music-director report: ranges, clashes, density, bar alignment, loop points
http://127.0.0.1:8777/_merge-wip/proto/music/demo.html   # plays + renders, logs PASS/FAIL
```

## One town, one tonal family

Every hourly theme lives in the same key family so the on-the-hour crossfade feels like the same
town changing light rather than a new track: **D major / B minor / G lydian / A mixolydian / E dorian**
(all two-sharp keys, F# and C# shared everywhere). Hour changes crossfade over a **two-bar bridge**
(`twoBarsMs(track)`), per the Porchlight bible.

Two motifs bind the whole score (Wildshift bible, 16.2):

| Motif | Notes | Intervals | Where |
| --- | --- | --- | --- |
| **Heartmark** | D F# A B (or from G: G B D E) | +4 +3 +2, never changes | title, home-town theme (06–09), dusk, victory, shift_reveal, relighting, summit, credits |
| **Vagary** | A G F# D | −2 −1 −4, falling | battle_spire, summit B section (skyglass / Errant quotes later) |

Porchlight's **Signal** (six pentatonic chimes D E F# A B D) is the `letter` sting; `signalSting(indices)`
builds the player-authored version from the lease card.

## The eight day-part themes

Each is 16 bars (A 8 + B 8), 16 sixteenth-steps per bar, with a 4–8 bar motif and a B section that
answers it higher or lower. Harmony is written as hand-voiced chords (`'D: F#3 A3 D4'`) so the pad
voice-leads by common tones; the bass, night, tide and rain layers are derived from those same chords.

| Hours | id | Title | Key | bpm | Lead | Perc | Motif (first bar) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 00–03 | `h_night_deep` | Harbor Asleep | B minor | 84 | flute | whisper (hat 2 & 4) | rest · F#4 A4 B4 — a sigh, then A4 and silence |
| 03–06 | `h_predawn` | Before the Gulls | E dorian | 88 | pluck | whisper | E4 G4 A4 B4 rising; answered A4 G4 E4 |
| 06–09 | `h_morning` | Porchlight Morning (home town) | D major | 100 | pluck | brush | **Heartmark** D4 F#4 A4 B4 |
| 09–12 | `h_late_morning` | Gull Market | G lydian | 104 | marimba | light | G4 · B4 D5 · E5 D5 syncopated; the A chord is the lydian lift |
| 12–15 | `h_midday` | High Sun on the Water | D major | 108 | flute | light | A4 · D5 · F#5 E5 D5 — a skipping stone |
| 15–18 | `h_afternoon` | Long Shadows on the Pier | A mixolydian | 96 | pluck | brush | E4 · C#5 B4 A4 lazy fall; G chord = flat seven |
| 18–21 | `h_dusk` | Lamps Along the Quay | D major → B minor | 92 | flute | brush | rest F#4 A4 D5; **Heartmark from G** (G4 B4 D5 E5) in bar 3 |
| 21–24 | `h_night` | Porchlight | B minor | 88 | bell (music box) | whisper | B4 D5 F#5 E5 up-and-settle |

Layers (stems) on every hour theme:

| Stem | Instrument | Default | Rule (see `CUES.world.stems`) |
| --- | --- | --- | --- |
| `core` | pad, voice-led chords | on | always |
| `melody` | per theme | on | always |
| `bass` | bass, follows chord roots | on | always |
| `perc` | kick/snare/hat, brushed | on | off 01:00–05:00 |
| `night` | glass bells arpeggio on chord tones, +1 octave | off | on 20:00–05:00 |
| `tide` | low pad, root + fifth two octaves down, re-voiced every bar (never pedals against a new chord), louder swell every 2 bars | off | on when tide > 0.7 |
| `rain` | soft rhodes comping on the off-beats | off | on when weather is rain or storm |

Season is a mix tilt rather than a stem (`CUES.world.intensity`: winter 0.9 … summer 1.1); the engine's
`setMusicParam({intensity})` / per-layer `minIntensity` can hang extra parts off that later.

## Non-diegetic / scene tracks

| id | Title | Key | bpm | Bars | Notes |
| --- | --- | --- | --- | --- | --- |
| `title` | Lighthouse | D major | 72 | 16 | Heartmark sung by flute, then an octave up; `tide` layer = lighthouse swell (on by default); glass bells on |
| `forecast` | Shift Forecast | E dorian (sus chords) | 96 | 8 | glass E5/B4 tick every beat, hat tick every step, bell melody that touches only 2nd and 6th; nothing resolves |
| `battle_wild` | Tall Grass | B minor | 126 | 16 | off-beat pluck stabs, driving 8th bass, riff F#5 · F#5 A5 B5 A5 F#5; B section lifts to D |
| `battle_trainer` | Across the Field | F# minor | 132 | 16 | stacked C#5 F#5 A5 ascent, marimba counter-line |
| `battle_spire` | The Spire | B minor | 120 | 24 | heavy kit, low brass pedal (open fifths an octave above the bass), **Vagary** A5 G5 F#5 D5 |
| `summit` | Summit | D major → B minor | 128 | 32 | Heartmark in sixteenths, Vagary in the minor half, bells, counter ostinato |
| `victory` | Caught the Light | D major | 120 | 4 | one-shot: Heartmark then D major fanfare + glass cascade |
| `shift_reveal` | Shift | D major | 150 | 1 (32 steps) | one-shot on a 50 ms grid: rising glass run (charge, 0.3 s) → scramble (0.6 s) → Heartmark chord (resolve, 0.7 s); matches the 18f/36f/36f animation. `shift_reveal_anchor` is the chord alone on the same grid |
| `letter` | A Letter | D pentatonic | 100 | 2 | one-shot music box: the Signal D5 F#5 A5 B5 A5 D6 |
| `relighting` | The Relighting | D major | 80 | 24 | one-shot build: pad → bass (bar 5) → bells (9) → Heartmark flute (13) → brushes (17) → sustained D with bell cascade (21–24) |
| `lantern_market` | Lantern Market Waltz | G lydian | 138 | 16 in 3/4 | 12 steps per bar, `beatsPerBar: 3`; marimba lilt, oom-pah-pah bass, bells on |
| `credits` | Harbor Lights | D major | 84 | 32 | Lighthouse melody then Porchlight Morning over their own changes |

Battle tracks have a `tense` stem (high glass tremolo + extra hats) that `CUES.battle.stems.tense`
turns on at HP ≤ 25%. At 2x/4x battle speed the tempo stays; only SFX shorten (Wildshift 16.9).

## CUES (in `tracks.js`)

```js
CUES.world.pick(state)            // 'h_morning' … or 'lantern_market' on Saturday night in the market
CUES.world.fade(trackId)          // two-bar bridge in ms at that track's tempo
CUES.world.stems.night(state)     // 20:00–05:00
CUES.world.stems.tide(state)      // tide > 0.7
CUES.world.stems.rain(state)      // weather rain/storm
CUES.world.stems.perc(state)      // off 01:00–05:00
CUES.battle.pick({kind})          // wild | trainer | spire | summit
CUES.battle.stems.tense({hpRatio})
CUES.title / forecast / victory / shift_reveal / letter / relighting / credits
```

`state = {hour, weekday, weather, tide, season, place, hpRatio, kind}`.

## Adapting to the engine

`toEngine(track)` converts the data to what `audio.defineTrack(id, def)` accepts today:
`{bpm, key, scale, bars, beatsPerBar, stepsPerBar, layers: {name: {inst, pattern, gain, stem, pan, humanize}}}`.

Differences from the contract found while reading `js/core/audio.js`, and how the data copes:

- **Kit.** The data keeps one `perc` layer per track; `toEngine` splits it into `perc.kick` / `perc.snare` / `perc.hat`
  (the engine has since grown a `kit` preset and prefix stems, so either `setStem('perc', on)` or the fan-out from
  `stemLayers(track, 'perc')` works; the split keeps per-voice velocities exactly as written).
- **Muted-by-default layers are `stem: true`**, not a separate "optional" list. `default: false` maps to it.
- **Scale names** are `pentatonic` (not `major-pentatonic`); `dorian`, `lydian`, `mixolydian` exist.
- The `rain` layer uses the engine's `rhodes` preset; the Spire's low brass is the `brass` preset holding open fifth-and-octave dyads above the bass root (A2–B3; full voicings an octave down put thirds below C3, under the bass line).
- One-shots (`loop: false`: victory, shift_reveal, letter, relighting) are forwarded to the engine, which plays them once.
- `humanize` defaults to 0.5 in the engine; the data asks for 0.35 (0.2 for drums) to keep the brushes tight.
- Chord events pass `n` as an array; the engine resolves arrays natively.

## Composition rules used

- Melodies are written as sheet music with the `P()` DSL (`'D4:3 F#4:3 A4:2 B4:8 | …'`): every phrase has
  a contour, rests at phrase ends, and the last note of each 8-bar section lands on a chord tone of the
  chord that leads back.
- Pads use hand-written voicings that keep common tones (e.g. D: A3 D4 F#4 → Bm: B3 D4 F#4 → G: G3 B3 D4).
- The bass plays roots (calm: root + fifth, walk: root–root–fifth–octave, drive: 8ths, waltz: oom-pah-pah).
- Night = top chord voice up an octave on glass; tide = root/fifth two octaves below the pad; rain = thirds on off-beats, the last one of each bar anticipating the next chord.
- Voicing hygiene (checked by `analyze.mjs`): no melody note a minor 2nd/9th from a sounding pad voice on a strong beat (so a bar whose tune lands on G drops the F# from Gmaj7), no seconds/thirds voiced below C3, every `|` in a melody on a bar line.
