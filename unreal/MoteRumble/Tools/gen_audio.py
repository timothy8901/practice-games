#!/usr/bin/env python3
"""
Every sound in Mote Rumble, synthesized from scratch.

No samples and no downloads: impacts, whooshes, magic, UI and two music tracks
are built out of numpy, and the announcer is macOS `say` pitched down and run
through a little reverb.

    python3 Tools/gen_audio.py            # writes SourceAudio/*.wav
    python3 Tools/gen_audio.py --check    # just verify what is already there

Everything is 48 kHz: SFX mono, music stereo, peak-normalised near -1 dBFS.
"""

import argparse
import math
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy import signal

SR = 48000
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "SourceAudio")

rng = np.random.default_rng(7)


# ---------------------------------------------------------------------------
#  building blocks
# ---------------------------------------------------------------------------

def t(dur):
    return np.linspace(0.0, dur, int(SR * dur), endpoint=False)


def noise(dur):
    return rng.uniform(-1.0, 1.0, int(SR * dur))


def sine(freq, dur, phase=0.0):
    if np.isscalar(freq):
        return np.sin(2 * np.pi * freq * t(dur) + phase)
    # frequency envelope: integrate to keep the phase continuous
    return np.sin(2 * np.pi * np.cumsum(freq) / SR + phase)


def saw(freq, dur):
    return signal.sawtooth(2 * np.pi * freq * t(dur)) if np.isscalar(freq) else \
        signal.sawtooth(2 * np.pi * np.cumsum(freq) / SR)


def square(freq, dur, duty=0.5):
    return signal.square(2 * np.pi * freq * t(dur), duty)


def sweep(f0, f1, dur, curve=3.0):
    """Exponential-ish pitch sweep, the backbone of most impacts."""
    n = int(SR * dur)
    k = np.linspace(0.0, 1.0, n)
    return f0 + (f1 - f0) * (k ** curve)


def env(dur, attack=0.002, decay=0.1, sustain=0.0, release=0.05, hold=0.0):
    n = int(SR * dur)
    a = max(int(SR * attack), 1)
    h = int(SR * hold)
    d = int(SR * decay)
    r = int(SR * release)
    s = max(n - a - h - d - r, 0)
    parts = [
        np.linspace(0, 1, a),
        np.ones(h),
        np.linspace(1, sustain, d),
        np.full(s, sustain),
        np.linspace(sustain, 0, r),
    ]
    out = np.concatenate(parts)[:n]
    if len(out) < n:
        out = np.pad(out, (0, n - len(out)))
    return out


def expdec(dur, tau):
    return np.exp(-t(dur) / tau)


def lowpass(x, cutoff, order=4):
    b, a = signal.butter(order, min(cutoff / (SR / 2), 0.99), btype="low")
    return signal.lfilter(b, a, x)


def highpass(x, cutoff, order=4):
    b, a = signal.butter(order, max(min(cutoff / (SR / 2), 0.99), 1e-4), btype="high")
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=4):
    b, a = signal.butter(order, [max(lo / (SR / 2), 1e-4), min(hi / (SR / 2), 0.99)], btype="band")
    return signal.lfilter(b, a, x)


def moving_filter(x, f_start, f_end, order=2):
    """Cheap filter sweep: crossfade between two fixed filters."""
    a = lowpass(x, f_start, order)
    b = lowpass(x, f_end, order)
    k = np.linspace(0.0, 1.0, len(x))
    return a * (1 - k) + b * k


def reverb(x, seconds=0.9, mix=0.3, predelay=0.01):
    """Convolve with decaying noise - short and cheap, but it sells space."""
    n = int(SR * seconds)
    ir = rng.uniform(-1, 1, n) * np.exp(-np.linspace(0, 6, n))
    ir = lowpass(ir, 6000)
    ir[: int(SR * predelay)] = 0.0
    wet = signal.fftconvolve(x, ir)[: len(x)]
    wet = wet / (np.max(np.abs(wet)) + 1e-9)
    return (1 - mix) * x + mix * wet


def soft_clip(x, drive=1.4):
    return np.tanh(x * drive)


def fit(x, dur):
    n = int(SR * dur)
    return np.pad(x[:n], (0, max(0, n - len(x))))


def mix(*layers):
    n = max(len(l) for l in layers)
    out = np.zeros(n)
    for l in layers:
        out[: len(l)] += l
    return out


def normalize(x, peak_db=-1.0):
    peak = np.max(np.abs(x)) + 1e-9
    return x / peak * (10 ** (peak_db / 20))


def edges(x, fade=0.004):
    n = int(SR * fade)
    if len(x) > 2 * n > 0:
        x[:n] *= np.linspace(0, 1, n)
        x[-n:] *= np.linspace(1, 0, n)
    return x


def write(name, x, stereo=False):
    os.makedirs(OUT_DIR, exist_ok=True)
    x = edges(normalize(np.nan_to_num(x)))
    data = np.clip(x, -1, 1)
    pcm = (data * 32767).astype("<i2")
    path = os.path.join(OUT_DIR, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(2 if stereo else 1)
        w.setsampwidth(2)
        w.setframerate(SR)
        if stereo:
            w.writeframes(pcm.T.reshape(-1).tobytes() if pcm.ndim == 2 else pcm.tobytes())
        else:
            w.writeframes(pcm.tobytes())
    return path


def write_stereo(name, left, right):
    n = max(len(left), len(right))
    l = np.pad(left, (0, n - len(left)))
    r = np.pad(right, (0, n - len(right)))
    both = np.stack([l, r])
    peak = np.max(np.abs(both)) + 1e-9
    both = both / peak * (10 ** (-1.0 / 20))
    pcm = (np.clip(both, -1, 1) * 32767).astype("<i2")
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.T.reshape(-1).tobytes())
    return path


# ---------------------------------------------------------------------------
#  impact / combat
# ---------------------------------------------------------------------------

def impact(dur=0.3, body=140, click=2600, sub=52, punch=1.0, grit=0.6):
    """The general-purpose hit: transient click + pitched body + sub + noise tail."""
    tick = highpass(noise(0.012), click) * expdec(0.012, 0.003) * 0.9
    thump = sine(sweep(body * 3.2, body * 0.7, dur, 2.2), dur) * expdec(dur, dur * 0.22) * punch
    low = sine(sweep(sub * 2.0, sub, dur, 3.0), dur) * expdec(dur, dur * 0.35) * 0.9
    tail = bandpass(noise(dur), 500, 5000) * expdec(dur, dur * 0.16) * grit
    return soft_clip(mix(fit(tick, dur), thump, low, tail), 1.6)


def whoosh(dur=0.32, lo=300, hi=3000, depth=1.0):
    n = bandpass(noise(dur), lo, hi)
    shape = np.sin(np.linspace(0, np.pi, len(n))) ** 2
    swept = moving_filter(n, hi, lo, order=2)
    return swept * shape * depth


def metal_ring(dur=0.6, base=1800, partials=(1.0, 1.72, 2.41, 3.13, 4.7)):
    out = np.zeros(int(SR * dur))
    for i, p in enumerate(partials):
        out += sine(base * p, dur) * expdec(dur, dur * (0.3 - i * 0.045)) / (i + 1.6)
    return out


def build_combat():
    write("sfx_swing_light", whoosh(0.22, 500, 5200, 1.0) * 0.8)
    write("sfx_swing_heavy", mix(whoosh(0.42, 180, 2600, 1.2),
                                sine(sweep(160, 70, 0.42), 0.42) * expdec(0.42, 0.12) * 0.5))

    write("sfx_hit_light", impact(0.18, body=210, click=3200, sub=70, punch=0.7, grit=0.5))
    write("sfx_hit_medium", impact(0.26, body=160, click=2600, sub=58, punch=1.0, grit=0.7))
    write("sfx_hit_heavy", mix(impact(0.5, body=110, click=2000, sub=42, punch=1.3, grit=0.9),
                               sine(sweep(70, 33, 0.5), 0.5) * expdec(0.5, 0.2) * 0.8))
    write("sfx_hit_slash", mix(impact(0.22, body=260, click=5200, sub=90, punch=0.6, grit=0.9),
                               metal_ring(0.5, 2600) * 0.5,
                               highpass(noise(0.1), 4000) * expdec(0.1, 0.03) * 0.6))
    write("sfx_hit_blunt", mix(impact(0.42, body=90, click=1400, sub=38, punch=1.2, grit=1.0),
                               lowpass(noise(0.3), 700) * expdec(0.3, 0.09) * 0.5))
    write("sfx_parry", mix(metal_ring(0.7, 3200, (1, 2.1, 3.4, 5.1)) * 0.9,
                           highpass(noise(0.05), 6000) * expdec(0.05, 0.015)))

    # Shields: glassy and bright.
    write("sfx_shield_block", mix(sine(sweep(900, 520, 0.22), 0.22) * expdec(0.22, 0.07),
                                  bandpass(noise(0.22), 1500, 7000) * expdec(0.22, 0.05) * 0.7))
    shards = np.zeros(int(SR * 0.9))
    for _ in range(26):
        at = int(rng.uniform(0, 0.45) * SR)
        piece = metal_ring(0.35, rng.uniform(2200, 6000), (1, 2.3, 3.9)) * rng.uniform(0.2, 0.7)
        shards[at: at + len(piece)] += piece[: len(shards) - at]
    write("sfx_shield_break", mix(shards, sine(sweep(700, 90, 0.7, 2.0), 0.7) * expdec(0.7, 0.2) * 0.8))

    # Charging: a rising hum that loops cleanly over exactly one second.
    dur = 1.0
    hum = sum(sine(f, dur) * a for f, a in ((110, 0.5), (220, 0.3), (330, 0.18), (440, 0.1)))
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * 6.0 * t(dur))     # whole cycles -> seamless
    write("sfx_charge_loop", hum * trem * 0.6)
    write("sfx_charge_ready", mix(sine(sweep(900, 2400, 0.3), 0.3) * expdec(0.3, 0.1),
                                  metal_ring(0.5, 3000, (1, 2.5, 4.2)) * 0.5))

    write("sfx_launch", mix(whoosh(0.55, 400, 6000, 1.0),
                            sine(sweep(1400, 240, 0.55, 2.0), 0.55) * expdec(0.55, 0.18) * 0.5))

    # The KO: a cannon with a long tail.
    boom = mix(sine(sweep(160, 28, 2.4, 3.0), 2.4) * expdec(2.4, 0.55) * 1.2,
               lowpass(noise(2.4), 900) * expdec(2.4, 0.4),
               highpass(noise(0.2), 3000) * expdec(0.2, 0.05) * 0.8)
    write("sfx_ko_blast", reverb(soft_clip(boom, 1.3), 1.6, 0.4))

    # Final hit: a reverse swell into a huge slow impact.
    swell = (bandpass(noise(0.7), 200, 4000) * np.linspace(0, 1, int(SR * 0.7)) ** 2)
    hit = impact(1.0, body=80, click=1600, sub=30, punch=1.4, grit=0.8)
    write("sfx_final_hit", reverb(mix(swell, np.pad(hit, (int(SR * 0.7), 0))), 1.4, 0.35))


# ---------------------------------------------------------------------------
#  movement, weapons, UI
# ---------------------------------------------------------------------------

def build_movement():
    write("sfx_jump", mix(sine(sweep(260, 620, 0.16), 0.16) * env(0.16, 0.004, 0.12),
                          highpass(noise(0.08), 2000) * expdec(0.08, 0.02) * 0.35))
    write("sfx_double_jump", mix(sine(sweep(520, 1100, 0.24), 0.24) * env(0.24, 0.004, 0.2),
                                 bandpass(noise(0.24), 1200, 6000) * expdec(0.24, 0.07) * 0.5,
                                 sine(sweep(1600, 2600, 0.2), 0.2) * expdec(0.2, 0.06) * 0.3))
    write("sfx_land", mix(impact(0.2, body=120, click=1200, sub=48, punch=0.7, grit=0.5) * 0.7,
                          lowpass(noise(0.18), 900) * expdec(0.18, 0.05) * 0.5))
    write("sfx_dodge", whoosh(0.26, 700, 6500, 0.9))
    write("sfx_dash", mix(whoosh(0.34, 300, 5000, 1.1),
                          sine(sweep(200, 520, 0.3), 0.3) * expdec(0.3, 0.1) * 0.4))
    shimmer = np.zeros(int(SR * 1.1))
    for i in range(16):
        f = 600 * (1 + i * 0.35)
        at = int(rng.uniform(0, 0.5) * SR)
        piece = sine(f, 0.5) * expdec(0.5, 0.16) * 0.25
        shimmer[at: at + len(piece)] += piece[: len(shimmer) - at]
    write("sfx_respawn", reverb(mix(shimmer, sine(sweep(200, 900, 0.8), 0.8) * env(0.8, 0.05, 0.6) * 0.5), 1.0, 0.3))


def build_weapons():
    write("sfx_projectile_fire", mix(sine(sweep(1800, 400, 0.26, 2.0), 0.26) * expdec(0.26, 0.07),
                                     bandpass(noise(0.2), 900, 6000) * expdec(0.2, 0.05) * 0.6))
    write("sfx_arrow_fire", mix(metal_ring(0.25, 420, (1, 2.7, 4.1)) * 0.5,
                                whoosh(0.3, 1200, 8000, 0.8),
                                highpass(noise(0.05), 3000) * expdec(0.05, 0.012)))
    crackle = np.zeros(int(SR * 0.6))
    for _ in range(40):
        at = int(rng.uniform(0, 0.45) * SR)
        piece = highpass(noise(0.03), rng.uniform(2000, 9000)) * expdec(0.03, 0.006) * rng.uniform(0.3, 1.0)
        crackle[at: at + len(piece)] += piece[: len(crackle) - at]
    write("sfx_lightning", mix(crackle, sine(sweep(120, 45, 0.6, 2.0), 0.6) * expdec(0.6, 0.18) * 0.9,
                               bandpass(noise(0.3), 300, 3000) * expdec(0.3, 0.09) * 0.7))
    write("sfx_fire_whoosh", mix(moving_filter(noise(0.6), 400, 1800, 2) * env(0.6, 0.03, 0.5) * 0.9,
                                 lowpass(noise(0.6), 300) * expdec(0.6, 0.2) * 0.5))
    write("sfx_explosion", reverb(mix(sine(sweep(140, 32, 1.2, 3.0), 1.2) * expdec(1.2, 0.3) * 1.2,
                                      lowpass(noise(1.2), 1200) * expdec(1.2, 0.22),
                                      highpass(noise(0.12), 2500) * expdec(0.12, 0.03)), 1.1, 0.3))
    whir = sine(sweep(700, 900, 0.5), 0.5) * (0.6 + 0.4 * np.sin(2 * np.pi * 26 * t(0.5)))
    write("sfx_disc_throw", mix(whir * env(0.5, 0.01, 0.4), whoosh(0.4, 800, 5000, 0.6)))
    write("sfx_disc_catch", metal_ring(0.35, 1400, (1, 2.2, 3.6)) * 0.8)
    write("sfx_slam", mix(impact(0.7, body=70, click=1200, sub=28, punch=1.4, grit=1.0),
                          lowpass(noise(0.7), 500) * expdec(0.7, 0.2) * 0.7))
    spin = sine(sweep(500, 620, 0.6), 0.6) * (0.5 + 0.5 * np.sin(2 * np.pi * 18 * t(0.6)))
    write("sfx_spin", mix(spin * env(0.6, 0.02, 0.5), whoosh(0.6, 600, 4000, 0.7)))
    write("sfx_reflect", mix(metal_ring(0.5, 2400, (1, 1.9, 3.1, 4.6)) * 0.9,
                             sine(sweep(2600, 800, 0.2), 0.2) * expdec(0.2, 0.06) * 0.5))


def build_ui():
    write("sfx_ui_move", sine(880, 0.06) * env(0.06, 0.002, 0.05) * 0.6)
    write("sfx_ui_select", mix(sine(660, 0.16) * env(0.16, 0.002, 0.14),
                               sine(990, 0.16) * env(0.16, 0.002, 0.12) * 0.6))
    write("sfx_ui_back", mix(sine(440, 0.14) * env(0.14, 0.002, 0.12),
                             sine(330, 0.14) * env(0.14, 0.002, 0.12) * 0.6))
    write("sfx_countdown", mix(sine(720, 0.18) * env(0.18, 0.003, 0.15),
                               sine(1440, 0.18) * env(0.18, 0.003, 0.1) * 0.3))
    chord = sum(sine(f, 0.9) for f in (523, 659, 784, 1047))
    write("sfx_go", mix(chord * env(0.9, 0.004, 0.7) * 0.4,
                        highpass(noise(0.1), 3000) * expdec(0.1, 0.03) * 0.5))
    write("sfx_pause", mix(sine(520, 0.2) * env(0.2, 0.004, 0.16),
                           sine(392, 0.2) * env(0.2, 0.004, 0.16) * 0.7))


# ---------------------------------------------------------------------------
#  announcer
# ---------------------------------------------------------------------------

def speak(text, voice="Daniel", rate=150):
    """macOS `say` -> mono float array at SR."""
    with tempfile.TemporaryDirectory() as tmp:
        aiff = os.path.join(tmp, "v.aiff")
        wav = os.path.join(tmp, "v.wav")
        subprocess.run(["say", "-v", voice, "-r", str(rate), "-o", aiff, text], check=True)
        subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@{}".format(SR), "-c", "1", aiff, wav], check=True)
        with wave.open(wav, "rb") as w:
            raw = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768.0
            if w.getnchannels() == 2:
                raw = raw.reshape(-1, 2).mean(axis=1)
        return raw


def pitch_down(x, factor=0.82):
    """Resample longer = lower and slower, which is exactly the announcer voice."""
    n = int(len(x) / factor)
    return np.interp(np.linspace(0, len(x), n, endpoint=False), np.arange(len(x)), x)


def announcer(text, name, voice="Daniel", factor=0.84, rate=140, drive=2.2):
    try:
        raw = speak(text, voice, rate)
    except Exception as e:
        print("  ! say failed for {}: {}".format(name, e))
        return
    v = pitch_down(raw, factor)
    v = highpass(v, 110)
    v = soft_clip(v * 1.8, drive)        # compressed, in-your-face
    v = reverb(v, 0.7, 0.22)
    write(name, v)


def build_voice():
    lines = [
        ("Ready?", "vo_ready"),
        ("Go!", "vo_go"),
        ("Game!", "vo_game"),
        ("K O!", "vo_ko"),
        ("The winner is", "vo_the_winner_is"),
        ("Mote Rumble!", "vo_mote_rumble"),
    ]
    for text, name in lines:
        announcer(text, name)
    for fighter in ("Blade", "Arc", "Disc", "Maul", "Bow", "Flare", "Cinder", "Veil"):
        announcer(fighter + "!", "vo_" + fighter.lower())


# ---------------------------------------------------------------------------
#  music
# ---------------------------------------------------------------------------

def kick(dur=0.5):
    return soft_clip(mix(sine(sweep(160, 45, dur, 2.4), dur) * expdec(dur, 0.09),
                         highpass(noise(0.01), 1500) * expdec(0.01, 0.003) * 0.5), 1.6)


def snare(dur=0.35):
    return mix(bandpass(noise(dur), 220, 6500) * expdec(dur, 0.075),
               sine(sweep(320, 180, dur), dur) * expdec(dur, 0.05) * 0.6)


def hat(dur=0.09, open_=False):
    d = 0.22 if open_ else dur
    return highpass(noise(d), 7000) * expdec(d, 0.05 if open_ else 0.014) * 0.45


def place(track, sample, at_sec, gain=1.0):
    at = int(at_sec * SR)
    end = min(len(track), at + len(sample))
    if at < len(track):
        track[at:end] += sample[: end - at] * gain


def synth_note(freq, dur, kind="saw", cutoff=2200, res_env=True):
    if kind == "saw":
        raw = saw(freq, dur)
    elif kind == "square":
        raw = square(freq, dur, 0.35)
    else:
        raw = sine(freq, dur)
    e = env(dur, 0.006, dur * 0.5, 0.55, dur * 0.35)
    out = raw * e
    return moving_filter(out, cutoff, cutoff * 0.45, 2) if res_env else lowpass(out, cutoff)


NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(name, octave=3):
    return 440.0 * (2 ** ((NOTE[name] + (octave - 4) * 12 - 9) / 12.0))


def build_music():
    # ---- battle: 150 BPM, 32 bars, A/B sections, loops on itself ----
    bpm = 150.0
    beat = 60.0 / bpm
    bar = beat * 4
    bars = 32
    total = bar * bars
    n = int(total * SR)

    drums = np.zeros(n)
    bass = np.zeros(n)
    lead = np.zeros(n)
    pad = np.zeros(n)

    # D minor progression, two bars per chord.
    prog = [("D", 3), ("A#", 2), ("F", 3), ("C", 3)]
    scale = ["D", "E", "F", "G", "A", "A#", "C"]

    for b in range(bars):
        bar_t = b * bar
        chord_root, chord_oct = prog[(b // 2) % len(prog)]
        busy = (b % 8) >= 4          # B section gets denser
        # drums
        for beat_i in range(4):
            at = bar_t + beat_i * beat
            if beat_i in (0, 2) or (busy and beat_i == 3):
                place(drums, kick(), at, 1.0)
            if beat_i in (1, 3):
                place(drums, snare(), at, 0.8)
            for eighth in range(2):
                place(drums, hat(open_=(busy and eighth == 1 and beat_i == 3)),
                      at + eighth * beat / 2, 0.5)
        if b % 8 == 7:   # fill
            for i in range(4):
                place(drums, snare(0.2), bar_t + bar - beat + i * beat / 4, 0.5 + i * 0.12)

        # bass: driving eighths on the chord root
        for eighth in range(8):
            at = bar_t + eighth * beat / 2
            f = hz(chord_root, chord_oct) / 2
            if eighth % 4 == 3:
                f *= 1.5   # little fifth push
            place(bass, synth_note(f, beat / 2 * 0.95, "saw", 900), at, 0.55)

        # lead: a heroic motif, only in the B sections and the last bar of A
        if busy or b % 8 == 3:
            motif = [0, 2, 4, 6, 4, 2] if not busy else [4, 6, 7 % len(scale), 4, 2, 4]
            for i, step in enumerate(motif):
                at = bar_t + i * beat * 0.5
                note = scale[step % len(scale)]
                octv = 4 + (1 if busy and i >= 3 else 0)
                place(lead, synth_note(hz(note, octv), beat * 0.5 * 0.9, "square", 3000), at, 0.28)

        # pad: sustained chord
        for interval, oct_off in ((0, 0), (3, 0), (7, 0)):
            idx = (NOTE[chord_root] + interval) % 12
            name = [k for k, v in NOTE.items() if v == idx][0]
            place(pad, synth_note(hz(name, chord_oct + 1 + oct_off), bar * 0.98, "saw", 1400, False), bar_t, 0.09)

    # sidechain the sustained parts to the kick so it breathes
    duck = np.ones(n)
    for b in range(bars):
        for beat_i in (0, 2):
            at = int((b * bar + beat_i * beat) * SR)
            length = int(0.28 * SR)
            end = min(n, at + length)
            duck[at:end] = np.minimum(duck[at:end], np.linspace(0.35, 1.0, end - at))
    bass *= duck
    pad *= duck

    lead = highpass(lead, 220)
    pad = highpass(pad, 160)
    mixdown = soft_clip(drums * 0.9 + bass * 0.9 + lead * 0.75 + pad * 0.7, 1.2)
    # A hair of stereo width on the melodic parts.
    left = mixdown + 0.12 * np.roll(lead, 180)
    right = mixdown + 0.12 * np.roll(lead, -180)
    write_stereo("mus_battle", left, right)

    # ---- menu: same motif, half speed, calmer ----
    bpm = 100.0
    beat = 60.0 / bpm
    bar = beat * 4
    bars = 16
    n = int(bar * bars * SR)
    m_pad = np.zeros(n)
    m_lead = np.zeros(n)
    m_drum = np.zeros(n)
    for b in range(bars):
        bar_t = b * bar
        chord_root, chord_oct = prog[(b // 2) % len(prog)]
        for interval in (0, 3, 7, 10):
            idx = (NOTE[chord_root] + interval) % 12
            name = [k for k, v in NOTE.items() if v == idx][0]
            place(m_pad, synth_note(hz(name, chord_oct + 1), bar * 0.98, "saw", 900, False), bar_t, 0.12)
        if b % 4 in (1, 3):
            for i, step in enumerate([0, 2, 4, 2]):
                place(m_lead, synth_note(hz(scale[step], 4), beat * 0.9, "sine", 2600),
                      bar_t + i * beat, 0.16)
        place(m_drum, kick(0.4), bar_t, 0.5)
        place(m_drum, hat(), bar_t + beat * 2, 0.3)
    m_mix = soft_clip(m_pad + m_lead + m_drum * 0.5, 1.1)
    write_stereo("mus_menu", m_mix + 0.1 * np.roll(m_lead, 240), m_mix + 0.1 * np.roll(m_lead, -240))


# ---------------------------------------------------------------------------

REQUIRED = [
    "sfx_swing_light", "sfx_swing_heavy", "sfx_hit_light", "sfx_hit_medium", "sfx_hit_heavy",
    "sfx_hit_slash", "sfx_hit_blunt", "sfx_shield_block", "sfx_shield_break", "sfx_parry",
    "sfx_charge_loop", "sfx_charge_ready", "sfx_launch", "sfx_ko_blast", "sfx_final_hit",
    "sfx_jump", "sfx_double_jump", "sfx_land", "sfx_dodge", "sfx_dash", "sfx_respawn",
    "sfx_projectile_fire", "sfx_arrow_fire", "sfx_lightning", "sfx_fire_whoosh", "sfx_explosion",
    "sfx_disc_throw", "sfx_disc_catch", "sfx_slam", "sfx_spin", "sfx_reflect",
    "sfx_ui_move", "sfx_ui_select", "sfx_ui_back", "sfx_countdown", "sfx_go", "sfx_pause",
    "vo_ready", "vo_go", "vo_game", "vo_ko", "vo_the_winner_is", "vo_mote_rumble",
    "vo_blade", "vo_arc", "vo_disc", "vo_maul", "vo_bow", "vo_flare", "vo_cinder", "vo_veil",
    "mus_battle", "mus_menu",
]


def check():
    missing, rows = [], []
    for name in REQUIRED:
        path = os.path.join(OUT_DIR, name + ".wav")
        if not os.path.isfile(path):
            missing.append(name)
            continue
        with wave.open(path, "rb") as w:
            frames = w.getnframes()
            dur = frames / w.getframerate()
            data = np.frombuffer(w.readframes(frames), dtype="<i2").astype(np.float64) / 32768.0
            peak = 20 * math.log10(max(np.max(np.abs(data)), 1e-9))
            rows.append((name, dur, peak, w.getnchannels()))
    for name, dur, peak, ch in rows:
        print("  {:<22} {:>6.2f}s  {:>6.1f} dBFS  {}ch".format(name, dur, peak, ch))
    print("{}/{} present".format(len(rows), len(REQUIRED)))
    if missing:
        print("MISSING: {}".format(", ".join(missing)))
    return not missing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="only verify existing files")
    args = ap.parse_args()
    if not args.check:
        print("combat...");   build_combat()
        print("movement..."); build_movement()
        print("weapons...");  build_weapons()
        print("ui...");       build_ui()
        print("voice...");    build_voice()
        print("music...");    build_music()
    ok = check()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
