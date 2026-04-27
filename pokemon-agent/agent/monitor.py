"""Peek at a running (or finished) session without disturbing the agent.

Reads session artifacts from disk — session_state.json, notebook.md, turns.jsonl,
frames/ — so it
never contends with the mGBA bridge (the bridge only accepts one client, and
connecting would kick the agent off). Safe to run while a session is live.

Usage:
    python -m agent.monitor                 # latest session, one snapshot
    python -m agent.monitor --watch         # re-print every 5s until Ctrl-C
    python -m agent.monitor --tail 20       # last 20 turns (default 8)
    python -m agent.monitor --session run-20260420-120000
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SESSIONS_DIR = ROOT / "sessions"


def _pick_session(name: str | None) -> Path | None:
    if name:
        p = SESSIONS_DIR / name
        return p if p.is_dir() else None
    if not SESSIONS_DIR.exists():
        return None
    runs = sorted(p for p in SESSIONS_DIR.iterdir() if p.is_dir() and p.name.startswith("run-"))
    return runs[-1] if runs else None


def _tail_jsonl(path: Path, n: int) -> list[dict]:
    if not path.exists():
        return []
    lines = path.read_text().splitlines()[-n:]
    out: list[dict] = []
    for ln in lines:
        try:
            out.append(json.loads(ln))
        except json.JSONDecodeError:
            continue
    return out


def snapshot(session_dir: Path, tail: int) -> str:
    parts: list[str] = []
    parts.append(f"=== session: {session_dir.name} ===")

    session_state = session_dir / "session_state.json"
    if session_state.exists():
        try:
            data = json.loads(session_state.read_text())
            parts.append("\n--- session_state.json ---")
            parts.append(
                "phase={phase} objective={objective} repeat_count={repeat_count} "
                "rollbacks={rollbacks} fallback_uses={fallback_uses}".format(**data)
            )
            last_ram = data.get("last_ram") or {}
            if last_ram:
                parts.append(
                    f"map={last_ram.get('map_name') or 'unknown'} "
                    f"pos=({last_ram.get('pos_x')}, {last_ram.get('pos_y')}) "
                    f"badges={last_ram.get('badge_count', 0)}/8 "
                    f"mode={last_ram.get('mode', 'unknown')}"
                )
        except json.JSONDecodeError:
            parts.append("\n(session_state.json is unreadable)")

    tracker_path = session_dir / "progress_tracker.json"
    if tracker_path.exists():
        try:
            tracker = json.loads(tracker_path.read_text())
            parts.append("\n--- progress_tracker.json ---")
            parts.append(
                f"badges_earned={tracker.get('last_badge_count', 0)}/8  "
                f"last_badge_turn={tracker.get('last_badge_turn', -1)}  "
                f"last_map_change_turn={tracker.get('last_map_change_turn', 0)}  "
                f"last_flag_change_turn={tracker.get('last_flag_change_turn', 0)}  "
                f"last_pos_change_turn={tracker.get('last_pos_change_turn', 0)}"
            )
            walls = tracker.get("walls") or {}
            wall_count = sum(len(dirs) for poses in walls.values() for dirs in poses.values())
            npcs = tracker.get("npcs") or {}
            npc_count = sum(len(poses) for poses in npcs.values())
            parts.append(f"learned: {wall_count} wall observations across {len(walls)} maps; {npc_count} NPC tiles tracked")
            visits = tracker.get("map_visit_counts") or {}
            top = sorted(visits.items(), key=lambda kv: -kv[1])[:3]
            if top:
                parts.append("most-visited: " + ", ".join(f"{k}×{v}" for k, v in top))
        except json.JSONDecodeError:
            parts.append("\n(progress_tracker.json is unreadable)")

    notebook = session_dir / "notebook.md"
    if notebook.exists():
        parts.append("\n--- notebook.md ---")
        parts.append(notebook.read_text().rstrip())
    else:
        parts.append("\n(no notebook yet)")

    turns = _tail_jsonl(session_dir / "turns.jsonl", tail)
    parts.append(f"\n--- last {len(turns)} turns ---")
    for t in turns:
        btns = ",".join(p.get("button", "?") for p in t.get("presses", []))
        parts.append(f"T{t.get('turn'):04d} {t.get('observation', '')[:100]}  → {btns}")

    frames_dir = session_dir / "frames"
    if frames_dir.exists():
        frames = sorted(frames_dir.glob("t*.png"))
        if frames:
            parts.append(f"\nlatest frame: {frames[-1]}  ({len(frames)} total)")

    checkpoints = session_dir / "checkpoints"
    if checkpoints.exists():
        ckpts = sorted(checkpoints.glob("t*.ss1"))
        if ckpts:
            parts.append(f"checkpoints: {len(ckpts)} saved, latest {ckpts[-1].name}")

    return "\n".join(parts)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Inspect a Pokemon Emerald agent session.")
    ap.add_argument("--session", help="Session directory name (default: latest run-*).")
    ap.add_argument("--tail", type=int, default=8, help="How many recent turns to show.")
    ap.add_argument("--watch", action="store_true", help="Refresh every 5 seconds.")
    args = ap.parse_args(argv)

    sess = _pick_session(args.session)
    if sess is None:
        print("no session found under sessions/")
        return 1

    if not args.watch:
        print(snapshot(sess, args.tail))
        return 0

    try:
        while True:
            print("\033[2J\033[H", end="")  # clear screen
            print(snapshot(sess, args.tail))
            time.sleep(5)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
