"""Run a one-hour session of the Pokemon Emerald autonomous agent.

Usage:
    python -m agent.main [--minutes N] [--resume] [--model MODEL] [--no-record]

Each session:
  * launches mGBA, loads the Lua bridge, connects
  * starts a macOS screen recording (`screencapture -v`) to a session dir
  * runs the Claude-backed agent loop until the timer expires
  * asks the agent to save the game, captures a final savestate and backup .sav
  * stops the screen recording and exits mGBA cleanly
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import shutil
import signal
import sys
import time
import traceback
from pathlib import Path

from . import launcher
from .brain import PokemonAgent, DEFAULT_MODEL
from .controller import BridgeClient
from .recorder import ScreenRecorder

ROOT = Path(__file__).resolve().parent.parent
SESSIONS_DIR = ROOT / "sessions"

CHECKPOINT_EVERY_TURNS = 25     # roughly every ~2-3 minutes of play
CHECKPOINT_KEEP = 10            # rolling window — older ones get pruned


def _pick_session_dir(resume: bool) -> Path:
    SESSIONS_DIR.mkdir(exist_ok=True)
    if resume:
        existing = sorted([p for p in SESSIONS_DIR.iterdir() if p.is_dir() and p.name.startswith("run-")])
        if existing:
            return existing[-1]
    ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    d = SESSIONS_DIR / f"run-{ts}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _restore_prior_save(session_dir: Path) -> None:
    """On resume: put the prior session's rom.sav next to the ROM so CONTINUE appears."""
    # Prefer this session's own rom.sav (if we're continuing the same run).
    here = session_dir / "rom.sav"
    if here.exists():
        shutil.copy2(here, launcher.SAV_PATH)
        print(f"[main] restored save from {session_dir.name}")
        return
    runs = sorted([p for p in SESSIONS_DIR.iterdir() if p.is_dir() and p.name.startswith("run-")])
    for prior in reversed(runs):
        if prior == session_dir:
            continue
        sav = prior / "rom.sav"
        if sav.exists():
            shutil.copy2(sav, launcher.SAV_PATH)
            print(f"[main] restored save from {prior.name}")
            return
    print("[main] no prior save to restore — starting fresh")


def _stamp(msg: str) -> None:
    print(f"[{dt.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def _write_checkpoint(client: BridgeClient, checkpoints_dir: Path, turn: int) -> None:
    """Drop a rolling savestate so a run can be rewound if it goes off the rails."""
    checkpoints_dir.mkdir(exist_ok=True)
    path = checkpoints_dir / f"t{turn:05d}.ss1"
    client.savestate(path)
    existing = sorted(checkpoints_dir.glob("t*.ss1"))
    for old in existing[:-CHECKPOINT_KEEP]:
        try:
            old.unlink()
        except OSError:
            pass


def run_session(minutes: float, resume: bool, model: str, record: bool) -> int:
    session_dir = _pick_session_dir(resume)
    _stamp(f"session dir: {session_dir}")

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY is not set in the environment.", file=sys.stderr)
        print("  export ANTHROPIC_API_KEY=sk-ant-...", file=sys.stderr)
        return 2

    # Handle save file
    if resume:
        _restore_prior_save(session_dir)
    else:
        # Safety net: stash whatever .sav was sitting next to the ROM before wiping,
        # so a forgotten --resume flag can never silently destroy hours of progress.
        if launcher.SAV_PATH.exists():
            backup = session_dir / "pre-wipe.sav"
            shutil.copy2(launcher.SAV_PATH, backup)
            _stamp(f"backed up existing save → {backup.relative_to(ROOT)}")
        launcher.wipe_save_file()
        _stamp("wiped save file for fresh run")

    # Launch mGBA and connect
    _stamp("launching mGBA")
    proc: "subprocess.Popen | None" = None
    client: BridgeClient | None = None
    recorder: ScreenRecorder | None = None
    last_error: str | None = None
    try:
        proc, client = launcher.start_emulation(fresh=False)
        _stamp("bridge connected; mGBA running")
        launcher.bring_mgba_game_to_front()
        time.sleep(0.5)

        if record:
            rec_path = session_dir / "gameplay.mov"
            recorder = ScreenRecorder(rec_path)
            recorder.start()
            _stamp(f"screen recording started → {rec_path}")

        agent = PokemonAgent(client, session_dir=session_dir, model=model)
        _stamp(f"agent ready, model={model}")
        _stamp(f"running for {minutes:.1f} minutes ({int(minutes*60)}s)")

        deadline = time.monotonic() + minutes * 60
        save_deadline = time.monotonic() + (minutes - 2.0) * 60  # save 2 min before stop

        # Install signal handlers so Ctrl-C shuts down cleanly.
        stop_requested = {"flag": False}
        def _sigint(signum, frame):
            stop_requested["flag"] = True
            _stamp("stop requested by signal")
        signal.signal(signal.SIGINT, _sigint)
        signal.signal(signal.SIGTERM, _sigint)

        save_hinted = False
        checkpoints_dir = session_dir / "checkpoints"
        while time.monotonic() < deadline and not stop_requested["flag"]:
            t0 = time.monotonic()
            try:
                entry = agent.step()
                remaining = int(deadline - time.monotonic())
                _stamp(
                    f"T{entry.turn:04d} [{remaining:4d}s left] "
                    f"{entry.observation[:70]} → "
                    f"{','.join(p.get('button','?') for p in entry.presses)}"
                )
                if entry.turn % CHECKPOINT_EVERY_TURNS == 0:
                    try:
                        _write_checkpoint(client, checkpoints_dir, entry.turn)
                        _stamp(f"checkpoint saved: t{entry.turn:05d}.ss1")
                    except Exception as ce:
                        _stamp(f"checkpoint failed: {ce}")
            except Exception as e:
                last_error = f"{type(e).__name__}: {e}"
                _stamp(f"turn failed: {last_error}")
                traceback.print_exc()
                time.sleep(2.0)
                # if connection dropped, try to reconnect
                if isinstance(e, (ConnectionError, OSError)):
                    try:
                        client.close()
                        client = BridgeClient(); client.connect()
                        agent.bridge = client
                        _stamp("bridge reconnected")
                    except Exception as re:
                        _stamp(f"bridge reconnect failed: {re}")
                        break
            # hint to save when we get within 2 minutes of the deadline
            if not save_hinted and time.monotonic() >= save_deadline:
                save_hinted = True
                agent.state.notebook = (
                    agent.state.notebook.rstrip()
                    + "\n\n"
                    "SESSION_ENDING_SOON: the run timer is within ~2 minutes of stopping. "
                    "Finish any battle, then open the START menu and choose SAVE → YES → YES. "
                    "Do this BEFORE the timer expires.\n"
                )
                agent._save_notebook()
                _stamp("save-soon hint added to notebook")
            # don't hammer the API if turns are extremely fast
            dt_s = time.monotonic() - t0
            if dt_s < 0.2:
                time.sleep(0.2 - dt_s)

        _stamp("session loop done; finalising")

        # Final savestate for resume via mGBA itself
        try:
            state_path = session_dir / "final.ss1"
            client.savestate(state_path)
            _stamp(f"savestate written: {state_path}")
        except Exception as e:
            _stamp(f"savestate failed: {e}")

        # Copy the in-game save (.sav) into the session dir so we can resume fresh next run
        try:
            if launcher.SAV_PATH.exists():
                shutil.copy2(launcher.SAV_PATH, session_dir / "rom.sav")
                _stamp("rom.sav copied into session dir")
        except Exception as e:
            _stamp(f"save-backup failed: {e}")

        return 0 if last_error is None else 1

    finally:
        if recorder is not None:
            try:
                out = recorder.stop()
                _stamp(f"screen recording saved: {out}")
            except Exception as e:
                _stamp(f"recorder stop failed: {e}")
        if client is not None:
            try:
                client.close()
            except Exception:
                pass
        if proc is not None:
            _stamp("leaving mGBA running so you can inspect state (quit via Cmd-Q when done)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Pokemon Emerald agent for a timed session.")
    parser.add_argument("--minutes", type=float, default=60.0, help="Session length in minutes (default 60).")
    parser.add_argument("--resume", action="store_true", help="Continue from the most recent session's save.")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Claude model id (default from brain.py).")
    parser.add_argument("--no-record", action="store_true", help="Skip screen recording.")
    args = parser.parse_args(argv)
    return run_session(args.minutes, args.resume, args.model, record=not args.no_record)


if __name__ == "__main__":
    raise SystemExit(main())
