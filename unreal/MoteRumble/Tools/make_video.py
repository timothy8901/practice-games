#!/usr/bin/env python3
"""
Turn a Mote Rumble recording into a finished MP4.

The game runs at a fixed 60 fps while recording, dumping one PNG per frame and
a log of every sound it played with the exact capture time. Audio is therefore
rebuilt offline rather than captured live, which keeps it perfectly in sync.

    # in the game:  -MoteRecord=32 -ResX=1920 -ResY=1080
    python3 Tools/make_video.py --title "MOTE RUMBLE"

Writes Recordings/mote_rumble_demo.mp4.
"""

import argparse
import json
import os
import subprocess
import sys
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
FRAMES = os.path.join(PROJECT, "Recordings", "frames")
CUES = os.path.join(PROJECT, "Recordings", "cues.json")
AUDIO = os.environ.get("MOTE_AUDIO_ROOT", os.path.join(PROJECT, "SourceAudio"))
OUT = os.path.join(PROJECT, "Recordings", "mote_rumble_demo.mp4")
FFMPEG = "/opt/homebrew/bin/ffmpeg"
SR = 48000
FPS = 60


def load_wav(path):
    with wave.open(path, "rb") as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        data = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float32) / 32768.0
    if ch == 2:
        data = data.reshape(-1, 2)
    else:
        data = np.stack([data, data], axis=1)
    if sr != SR:  # cheap resample; our files are already 48k
        idx = np.linspace(0, len(data), int(len(data) * SR / sr), endpoint=False)
        data = np.stack([np.interp(idx, np.arange(len(data)), data[:, c]) for c in range(2)], axis=1)
    return data


def pitched(sound, pitch):
    if abs(pitch - 1.0) < 0.01:
        return sound
    n = max(int(len(sound) / pitch), 1)
    idx = np.linspace(0, len(sound), n, endpoint=False)
    return np.stack([np.interp(idx, np.arange(len(sound)), sound[:, c]) for c in range(2)], axis=1)


def build_track(cues, duration):
    total = int(duration * SR) + SR
    track = np.zeros((total, 2), dtype=np.float32)
    cache = {}
    missing = set()

    def get(name):
        if name in cache:
            return cache[name]
        path = os.path.join(AUDIO, name + ".wav")
        cache[name] = load_wav(path) if os.path.isfile(path) else None
        if cache[name] is None:
            missing.add(name)
        return cache[name]

    # Music cues lay down a looping bed until the next music cue.
    music = [c for c in cues if c.get("music")]
    for i, cue in enumerate(music):
        name = cue["name"]
        if name == "music_stop":
            continue
        bed = get(name)
        if bed is None:
            continue
        start = int(cue["t"] * SR)
        # The last bed has to END where the video ends, not in the tail padding,
        # or its fade-out is discarded by ffmpeg and the music stops dead on the
        # final frame.
        end = int(music[i + 1]["t"] * SR) if i + 1 < len(music) else int(duration * SR)
        end = min(end, total)
        start = max(start, 0)
        if end <= start:
            continue
        need = end - start
        reps = int(np.ceil(need / len(bed)))
        loop = np.tile(bed, (reps, 1))[:need]
        # Fade the bed in and out so cuts are not clicks.
        fade = min(int(0.6 * SR), need // 2)
        if fade > 0:
            loop[:fade] *= np.linspace(0, 1, fade)[:, None]
            loop[-fade:] *= np.linspace(1, 0, fade)[:, None]
        track[start:end] += loop * float(cue.get("vol", 0.55))

    for cue in cues:
        if cue.get("music"):
            continue
        s = get(cue["name"])
        if s is None:
            continue
        s = pitched(s, float(cue.get("pitch", 1.0))) * float(cue.get("vol", 1.0))
        at = int(cue["t"] * SR)
        if at < 0:
            # --start trims into the middle of a sound: keep the tail of it
            # rather than indexing the track with a negative offset.
            s = s[-at:]
            at = 0
        if len(s) == 0 or at >= total:
            continue
        end = min(total, at + len(s))
        track[at:end] += s[: end - at]

    if missing:
        print("  (no wav for: {})".format(", ".join(sorted(missing))))

    # Limit, then leave a little headroom.
    peak = np.max(np.abs(track)) + 1e-9
    if peak > 1.0:
        track = np.tanh(track / peak * 1.4) * 0.92

    # Always land the ending softly, whatever the last cue happened to be.
    tail = min(int(0.5 * SR), int(duration * SR))
    if tail > 0:
        cut = int(duration * SR)
        track[cut - tail:cut] *= np.linspace(1, 0, tail)[:, None]
        track[cut:] = 0.0
    return (np.clip(track, -1, 1) * 32767).astype("<i2")


def write_wav(path, pcm):
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.reshape(-1).tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=float, default=0.0, help="trim this many seconds off the front")
    ap.add_argument("--duration", type=float, default=0.0, help="clip length (0 = all of it)")
    ap.add_argument("--title", default="", help="optional title card text")
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    if not os.path.isdir(FRAMES):
        sys.exit("no frames at {} - record with -MoteRecord=N first".format(FRAMES))
    frames = sorted(f for f in os.listdir(FRAMES) if f.endswith(".png"))
    if not frames:
        sys.exit("no PNGs in {}".format(FRAMES))

    first = int(args.start * FPS)
    count = int(args.duration * FPS) if args.duration > 0 else len(frames) - first
    count = max(1, min(count, len(frames) - first))
    duration = count / FPS
    print("{} frames ({:.1f}s at {} fps), starting at frame {}".format(count, duration, FPS, first))

    cues = []
    if os.path.isfile(CUES):
        with open(CUES) as f:
            cues = json.load(f)
        cues = [dict(c, t=c["t"] - args.start) for c in cues if c["t"] >= args.start - 1.0]
        print("{} audio cues".format(len(cues)))
    else:
        print("no cue log - the video will be silent")

    audio_path = os.path.join(PROJECT, "Recordings", "soundtrack.wav")
    write_wav(audio_path, build_track(cues, duration))

    cmd = [
        FFMPEG, "-y",
        "-framerate", str(FPS),
        "-start_number", str(first),
        "-i", os.path.join(FRAMES, "frame_%05d.png"),
        "-i", audio_path,
        "-frames:v", str(count),
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest",
    ]
    if args.title:
        # A short title card fading in over the first two seconds, if the build
        # has drawtext; harmless to skip when it does not.
        font = "/System/Library/Fonts/Supplemental/Impact.ttf"
        if os.path.isfile(font):
            cmd[-1:-1] = ["-vf", (
                "drawtext=fontfile={}:text='{}':fontcolor=white:fontsize=96:"
                "x=(w-text_w)/2:y=(h-text_h)/2:alpha='if(lt(t,0.4),t/0.4,if(lt(t,2.0),1,max(0,1-(t-2.0)/0.6)))'"
            ).format(font, args.title.replace("'", ""))]
    cmd.append(args.out)

    print("encoding...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr[-3000:])
        sys.exit("ffmpeg failed")
    size = os.path.getsize(args.out) / 1e6
    print("wrote {} ({:.1f} MB, {:.1f}s)".format(args.out, size, duration))


if __name__ == "__main__":
    main()
