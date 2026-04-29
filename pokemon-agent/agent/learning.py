"""Progress-tracking heuristics for the Pokemon Emerald agent.

This module is the agent's experiential memory. It records (state, action,
outcome) transitions across the run so the controller can answer questions
that are otherwise impossible from a single turn:

  - "Have I been pressing UP into this wall for the last hour?"
  - "Have I talked to this NPC five times in a row without anything changing?"
  - "Have my flags / map / position actually moved in the last 100 turns,
    or am I just bobbling in place?"

It is intentionally NOT a learned model — no weights, no gradients. It is a
deterministic accumulator of observations that surfaces signals the local
policy and the model fallback can act on. Think of it as a per-run cache
of "things that didn't work, don't try them again."

Persisted to disk as `progress_tracker.json` inside the session dir, so the
state survives session restarts (and is inherited the same way the notebook
is, by copying from the prior session — see `inherit_from`).
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

DIRECTIONALS = {"UP", "DOWN", "LEFT", "RIGHT"}

# Modes where movement / interaction CAN change the world. We only treat
# directional presses as "wall observations" when the game was actually in a
# state where movement was possible — pressing UP during dialogue tells us
# nothing about walls.
MOVEABLE_MODES = {"overworld", "unknown", ""}

# Thresholds (in turns). Tuned conservatively so we don't escalate on normal
# multi-turn dialog or battle sequences.
WALL_CONFIRM_THRESHOLD = 3        # 3rd hit of same blocked direction = confirmed wall
NPC_LOOP_THRESHOLD = 4            # 4th A press at same tile = likely useless NPC loop
NPC_LOOP_WINDOW_TURNS = 30        # within this many turns of the first hit
MACRO_NO_POS_THRESHOLD = 30       # standing still for ~30 turns of overworld input
MACRO_NO_FLAG_THRESHOLD = 80      # no flag / var change in this many turns
MACRO_NO_MAP_THRESHOLD = 150      # no map change for this many turns
MACRO_NO_BADGE_THRESHOLD = 1500   # no new badge for ~1 hour at slow pace


def _map_key(ram_dict: dict[str, Any]) -> str:
    return f"{ram_dict.get('map_group')}.{ram_dict.get('map_num')}"


def _pos_key(ram_dict: dict[str, Any]) -> str:
    px, py = ram_dict.get("pos_x"), ram_dict.get("pos_y")
    if px is None or py is None:
        return "?"
    return f"{px},{py}"


def _flag_signature(ram_dict: dict[str, Any]) -> str:
    """Stable, compact signature over flags + vars so we can detect any change."""
    flags = ram_dict.get("flags") or {}
    vars_ = ram_dict.get("vars") or {}
    pairs: list[tuple[str, Any]] = []
    pairs.extend((f"f:{k}", bool(v)) for k, v in flags.items())
    pairs.extend((f"v:{k}", v) for k, v in vars_.items())
    pairs.sort()
    return json.dumps(pairs, separators=(",", ":"))


@dataclass
class ProgressTracker:
    """Per-run experiential memory. All fields are JSON-serialisable."""
    # walls[map_key][pos_key][direction] = number of times that press was tried
    # and produced no positional change.
    walls: dict[str, dict[str, dict[str, int]]] = field(default_factory=dict)

    # npcs[map_key][pos_key] = {first_talk_turn, last_turn, talk_count}
    npcs: dict[str, dict[str, dict[str, int]]] = field(default_factory=dict)

    # Visit counts per map key — useful for spotting a 3-map cycle.
    map_visit_counts: dict[str, int] = field(default_factory=dict)

    # Most-recent-event turn indices.
    last_badge_turn: int = -1
    last_map_change_turn: int = 0
    last_flag_change_turn: int = 0
    last_pos_change_turn: int = 0

    # Snapshot fields used to detect changes between observe() calls.
    last_map_key: str = ""
    last_pos_key: str = ""
    last_badge_count: int = 0
    last_flag_signature: str = ""

    # ------------------------------------------------------------------ observe
    def observe(
        self,
        turn: int,
        prev_ram: dict[str, Any] | None,
        curr_ram: dict[str, Any],
        executed_presses: Iterable[dict[str, Any]],
    ) -> list[str]:
        """Record one turn's transition. Returns short human-readable notes
        for anything noteworthy (newly-confirmed wall, NPC loop, etc.).
        """
        notes: list[str] = []
        map_key = _map_key(curr_ram)
        pos_key = _pos_key(curr_ram)

        # Map visit counter + map-change detection.
        self.map_visit_counts[map_key] = self.map_visit_counts.get(map_key, 0) + 1
        if map_key != self.last_map_key:
            if self.last_map_key:  # don't note the very first map of the run
                notes.append(f"map change: {self.last_map_key} → {map_key}")
            self.last_map_key = map_key
            self.last_map_change_turn = turn

        # Position-change detection.
        if pos_key != self.last_pos_key:
            self.last_pos_key = pos_key
            self.last_pos_change_turn = turn

        # Badge-change detection.
        badge_count = int(curr_ram.get("badge_count") or 0)
        if badge_count > self.last_badge_count:
            notes.append(f"BADGE earned (now {badge_count}/8)")
            self.last_badge_count = badge_count
            self.last_badge_turn = turn

        # Flag/var-change detection.
        flag_sig = _flag_signature(curr_ram)
        if flag_sig != self.last_flag_signature:
            self.last_flag_signature = flag_sig
            self.last_flag_change_turn = turn

        # ---- learning signals from the previous turn's executed presses ----
        if prev_ram is not None:
            press_buttons = [str(p.get("button", "")).upper() for p in executed_presses]
            prev_map_key = _map_key(prev_ram)
            prev_pos_key = _pos_key(prev_ram)
            prev_mode = (prev_ram.get("mode") or "").lower()

            # Wall observations — only meaningful when the world should have
            # responded to a directional press (i.e., not in dialogue/menu/battle).
            # We mark the wall against the PREVIOUS position, since that's where
            # the press was issued.
            if (
                prev_mode in MOVEABLE_MODES
                and prev_map_key == map_key
                and prev_pos_key == pos_key
                and prev_pos_key != "?"
            ):
                for btn in press_buttons:
                    if btn in DIRECTIONALS:
                        count = self._record_wall(prev_map_key, prev_pos_key, btn)
                        if count == WALL_CONFIRM_THRESHOLD:
                            notes.append(
                                f"wall confirmed at {prev_map_key}@{prev_pos_key} "
                                f"facing {btn} ({count} blocked attempts)"
                            )

            # NPC interaction tracking — count any A press from the PREVIOUS
            # tile, regardless of whether it opened dialog. The cooldown logic
            # uses talk_count + window to flag genuine repeat behaviour.
            if "A" in press_buttons and prev_pos_key != "?":
                entry = self._record_npc(prev_map_key, prev_pos_key, turn)
                in_window = (turn - entry["first_talk_turn"]) <= NPC_LOOP_WINDOW_TURNS
                if entry["talk_count"] == NPC_LOOP_THRESHOLD and in_window:
                    notes.append(
                        f"npc loop: {entry['talk_count']}× A at "
                        f"{prev_map_key}@{prev_pos_key} within {NPC_LOOP_WINDOW_TURNS} turns"
                    )

        return notes

    # ------------------------------------------------------------------ helpers
    def _record_wall(self, map_key: str, pos_key: str, direction: str) -> int:
        m = self.walls.setdefault(map_key, {}).setdefault(pos_key, {})
        m[direction] = m.get(direction, 0) + 1
        return m[direction]

    def _record_npc(self, map_key: str, pos_key: str, turn: int) -> dict[str, int]:
        m = self.npcs.setdefault(map_key, {})
        entry = m.setdefault(
            pos_key,
            {"first_talk_turn": turn, "last_turn": turn, "talk_count": 0},
        )
        # Reset the window if it's been a long time since the last A press here.
        if turn - entry["last_turn"] > NPC_LOOP_WINDOW_TURNS:
            entry["first_talk_turn"] = turn
            entry["talk_count"] = 0
        entry["talk_count"] += 1
        entry["last_turn"] = turn
        return entry

    # ------------------------------------------------------------------ queries
    def wall_directions(self, map_key: str, pos_key: str) -> list[str]:
        """Directions that have been blocked at least WALL_CONFIRM_THRESHOLD times."""
        m = self.walls.get(map_key, {}).get(pos_key, {})
        return sorted(d for d, c in m.items() if c >= WALL_CONFIRM_THRESHOLD)

    def npc_loop_at(self, map_key: str, pos_key: str, turn: int) -> int:
        """Returns talk_count if currently in a hot NPC loop window, else 0."""
        entry = self.npcs.get(map_key, {}).get(pos_key)
        if entry is None:
            return 0
        if (turn - entry["last_turn"]) > NPC_LOOP_WINDOW_TURNS:
            return 0
        if entry["talk_count"] >= NPC_LOOP_THRESHOLD:
            return entry["talk_count"]
        return 0

    def macro_stuck(self, turn: int) -> str | None:
        """Return a one-line reason string if any macro-stagnation threshold is
        exceeded, else None. Checks are ordered most-significant first.
        """
        if self.last_pos_change_turn and (turn - self.last_pos_change_turn) > MACRO_NO_POS_THRESHOLD:
            return f"no position change in {turn - self.last_pos_change_turn} turns"
        if self.last_flag_change_turn and (turn - self.last_flag_change_turn) > MACRO_NO_FLAG_THRESHOLD:
            return f"no flag/var change in {turn - self.last_flag_change_turn} turns"
        if self.last_map_change_turn and (turn - self.last_map_change_turn) > MACRO_NO_MAP_THRESHOLD:
            return f"no map change in {turn - self.last_map_change_turn} turns"
        if (
            self.last_badge_count < 8
            and self.last_badge_turn >= 0
            and (turn - self.last_badge_turn) > MACRO_NO_BADGE_THRESHOLD
        ):
            return f"no new badge in {turn - self.last_badge_turn} turns"
        return None

    def summary_for_model(self, turn: int, map_key: str, pos_key: str) -> str:
        """Compact human/LLM-readable summary of accumulated experience.
        Designed to be injected into the model fallback prompt."""
        lines = ["PROGRESS_TRACKER (experiential memory across this run):"]
        if self.last_badge_turn >= 0:
            lines.append(
                f"  badges: {self.last_badge_count}/8 — last earned T{self.last_badge_turn} "
                f"({turn - self.last_badge_turn} turns ago)"
            )
        else:
            lines.append(f"  badges: {self.last_badge_count}/8 — none earned this run")
        lines.append(
            f"  no position change for {turn - self.last_pos_change_turn} turns"
            if self.last_pos_change_turn
            else "  position: not yet observed"
        )
        lines.append(
            f"  no flag/var change for {turn - self.last_flag_change_turn} turns"
            if self.last_flag_change_turn
            else "  flags: not yet observed"
        )
        lines.append(
            f"  no map change for {turn - self.last_map_change_turn} turns"
            if self.last_map_change_turn
            else "  map: not yet observed"
        )

        walls_here = self.wall_directions(map_key, pos_key)
        if walls_here:
            lines.append(
                f"  WALLS at current tile {map_key}@{pos_key}: {','.join(walls_here)} "
                "— do NOT keep pressing these directions"
            )
        npc_count = self.npc_loop_at(map_key, pos_key, turn)
        if npc_count:
            lines.append(
                f"  NPC LOOP at current tile: A pressed {npc_count}× recently and "
                "no flag changed. Walk away or try a different action."
            )

        # Top-3 most-revisited maps — flags pacing-cycle behaviour.
        if self.map_visit_counts:
            top = sorted(self.map_visit_counts.items(), key=lambda kv: -kv[1])[:3]
            lines.append("  most-visited maps: " + ", ".join(f"{k}×{v}" for k, v in top))

        return "\n".join(lines)

    # ------------------------------------------------------------------ persist
    def to_dict(self) -> dict[str, Any]:
        return {
            "walls": self.walls,
            "npcs": self.npcs,
            "map_visit_counts": self.map_visit_counts,
            "last_badge_turn": self.last_badge_turn,
            "last_map_change_turn": self.last_map_change_turn,
            "last_flag_change_turn": self.last_flag_change_turn,
            "last_pos_change_turn": self.last_pos_change_turn,
            "last_map_key": self.last_map_key,
            "last_pos_key": self.last_pos_key,
            "last_badge_count": self.last_badge_count,
            "last_flag_signature": self.last_flag_signature,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ProgressTracker":
        t = cls()
        for key, val in data.items():
            if hasattr(t, key):
                setattr(t, key, val)
        return t

    def save(self, path: Path) -> None:
        path.write_text(json.dumps(self.to_dict(), indent=2, sort_keys=True))

    @classmethod
    def load(cls, path: Path) -> "ProgressTracker":
        if not path.exists():
            return cls()
        try:
            return cls.from_dict(json.loads(path.read_text()))
        except (json.JSONDecodeError, TypeError, ValueError):
            return cls()


def inherit_from_latest(session_dir: Path, sessions_root: Path) -> Path | None:
    """Copy the most recent prior session's progress_tracker.json into this
    session dir if there isn't one yet. Returns the source path, or None."""
    target = session_dir / "progress_tracker.json"
    if target.exists():
        return None
    if not sessions_root.exists():
        return None
    runs = sorted(p for p in sessions_root.iterdir() if p.is_dir() and p.name.startswith("run-"))
    for prior in reversed(runs):
        if prior == session_dir:
            continue
        src = prior / "progress_tracker.json"
        if src.exists() and src.stat().st_size > 0:
            target.write_text(src.read_text())
            return src
    return None
