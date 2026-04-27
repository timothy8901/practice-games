"""Local-first controller for the Pokemon Emerald agent."""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image

try:
    import anthropic
except ImportError:  # pragma: no cover - optional fallback dependency
    anthropic = None  # type: ignore[assignment]

from . import ram
from .controller import BridgeClient
from .learning import ProgressTracker
from .policy import LocalHybridPolicy, PHASE_OBJECTIVES, PolicyDecision, press, shopping_plan

DEFAULT_MODEL = os.environ.get("POKEMON_AGENT_MODEL", "claude-sonnet-4-6")
SCREENSHOT_UPSCALE = 3
RAM_STUCK_WINDOW = 6
SCREEN_STUCK_WINDOW = 4
# When macro-stuck (per ProgressTracker.macro_stuck), we ask the model for a
# course correction — but no more than once every this many turns, so a long
# stagnation doesn't burn one API call per turn.
MACRO_FALLBACK_COOLDOWN = 25
WALKTHROUGH_PATH = Path(__file__).resolve().parent.parent / "walkthrough.md"
VALID_BUTTONS = {"A", "B", "START", "SELECT", "UP", "DOWN", "LEFT", "RIGHT", "L", "R", "WAIT"}

ACT_TOOL: dict[str, Any] = {
    "name": "act",
    "description": "Pick the next safe button presses for the current Pokemon Emerald screen.",
    "input_schema": {
        "type": "object",
        "properties": {
            "observation": {"type": "string"},
            "reasoning": {"type": "string"},
            "presses": {
                "type": "array",
                "minItems": 1,
                "maxItems": 8,
                "items": {
                    "type": "object",
                    "properties": {
                        "button": {"type": "string"},
                        "hold_frames": {"type": "integer"},
                        "release_frames": {"type": "integer"},
                    },
                    "required": ["button"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["observation", "reasoning", "presses"],
        "additionalProperties": False,
    },
}

FALLBACK_SYSTEM_PROMPT = """You are a tactical fallback controller for a local Pokemon Emerald agent.

The local controller already tracks phase, map, flags, and recovery state from RAM.
Use the RAM summary as authoritative. Only solve the current ambiguous screen.

Hard constraints:
- Goal: beat Pokemon Emerald efficiently with a Mudkip solo route.
- Trainer name must be CLAUDE.
- Always choose Mudkip.
- Never nickname Pokemon.
- Prefer compact, safe actions that make immediate progress.
- If the screen is a battle and the best move is unclear, advancing with A is acceptable.

Return exactly one act tool call.
"""


@dataclass
class HistoryEntry:
    turn: int
    observation: str
    reasoning: str
    presses: list[dict[str, Any]]
    phase: str
    objective: str
    source: str = "local"


@dataclass
class AgentState:
    phase: str = "boot_intro"
    objective: str = PHASE_OBJECTIVES["boot_intro"]
    turn: int = 0
    repeat_count: int = 0
    screenshot_repeat_count: int = 0
    recovery_attempts: int = 0
    rollbacks: int = 0
    fallback_uses: int = 0
    # Turn at which we last asked the model to break a macro-stuck pattern.
    # Used to rate-limit fallback API calls so a long stuck period doesn't
    # burn one model call per turn.
    last_macro_fallback_turn: int = -10_000
    last_signature: list[Any] | None = None
    last_screen_hash: str = ""
    last_map: str = ""
    last_ram: dict[str, Any] = field(default_factory=dict)
    recent_notes: list[str] = field(default_factory=list)


class PokemonAgent:
    def __init__(
        self,
        bridge: BridgeClient,
        session_dir: Path,
        model: str = DEFAULT_MODEL,
        api_key: str | None = None,
        max_retries: int = 3,
    ):
        self.bridge = bridge
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.frames_dir = self.session_dir / "frames"
        self.frames_dir.mkdir(exist_ok=True)
        self.checkpoints_dir = self.session_dir / "checkpoints"
        self.notebook_path = self.session_dir / "notebook.md"
        self.log_path = self.session_dir / "turns.jsonl"
        self.session_state_path = self.session_dir / "session_state.json"
        self.tracker_path = self.session_dir / "progress_tracker.json"
        self.model = model
        self.max_retries = max_retries
        self.policy = LocalHybridPolicy()
        self.state = AgentState()
        self.history: list[HistoryEntry] = []
        self.walkthrough = self._load_walkthrough()
        # Experiential memory: walls hit, NPCs talked-to, time-since-progress, etc.
        # Persists per-session and is inherited from the previous run by main.py.
        self.tracker = ProgressTracker.load(self.tracker_path)
        self.last_macro_reason: str | None = None
        self.client = None
        if anthropic is not None:
            key = api_key or os.environ.get("ANTHROPIC_API_KEY")
            if key:
                self.client = anthropic.Anthropic(api_key=key)
        self._load_session_state()
        self._save_human_mirror()

    # --- persistence ------------------------------------------------------
    def _load_walkthrough(self) -> str:
        try:
            return WALKTHROUGH_PATH.read_text(encoding="utf-8-sig")
        except FileNotFoundError:
            return ""

    def _load_session_state(self) -> None:
        if not self.session_state_path.exists():
            return
        try:
            raw = json.loads(self.session_state_path.read_text())
        except json.JSONDecodeError:
            return
        for key in asdict(self.state):
            if key in raw:
                setattr(self.state, key, raw[key])

    def _save_session_state(self) -> None:
        self.session_state_path.write_text(json.dumps(asdict(self.state), indent=2, sort_keys=True))

    def _append_note(self, note: str) -> None:
        if self.state.recent_notes and self.state.recent_notes[-1] == note:
            return
        self.state.recent_notes.append(note)
        if len(self.state.recent_notes) > 12:
            self.state.recent_notes = self.state.recent_notes[-12:]

    def _save_human_mirror(self) -> None:
        state = self.state.last_ram
        badge_count = state.get("badge_count", 0)
        map_name = state.get("map_name") or "unknown"
        party = state.get("party") or []
        party_lines = ["PARTY:"]
        if not party:
            party_lines.append("  - none")
        else:
            for mon in party:
                party_lines.append(
                    f"  - slot {mon['slot']}: Lv{mon['level']} HP {mon['hp']}/{mon['max_hp']}"
                )

        supply_lines = []
        tracked_items = state.get("tracked_items") or {}
        if badge_count >= 6:
            deficits = shopping_plan(ram.GameState(**state))
            useful = [f"{name}: need {qty}" for name, qty in deficits.items() if qty > 0]
            if useful:
                supply_lines.append("SHOPPING DEFICITS:")
                supply_lines.extend(f"  - {line}" for line in useful)

        note_lines = ["NOTES:"]
        if self.state.recent_notes:
            note_lines.extend(f"  - {note}" for note in self.state.recent_notes)
        else:
            note_lines.append("  - none yet")

        text = "\n".join(
            [
                "GOAL: Beat the Elite Four and Champion efficiently with a Mudkip solo route.",
                f"PHASE: {self.state.phase}",
                f"OBJECTIVE: {self.state.objective}",
                f"MAP: {map_name}",
                f"BADGES: {badge_count}/8",
                f"RECOVERY: repeat_count={self.state.repeat_count} rollback_count={self.state.rollbacks} fallback_uses={self.state.fallback_uses}",
                *party_lines,
                "TRACKED ITEMS:",
                *([f"  - {name}: {qty}" for name, qty in sorted(tracked_items.items())] or ["  - none"]),
                *supply_lines,
                *note_lines,
            ]
        )
        self.notebook_path.write_text(text + "\n")

    def request_save_soon(self) -> None:
        self._append_note("Session timer is low. Prioritize saving from the START menu as soon as the route is safe.")
        self._save_session_state()
        self._save_human_mirror()

    def clear_runtime_tracking(self) -> None:
        self.state.repeat_count = 0
        self.state.screenshot_repeat_count = 0
        self.state.recovery_attempts = 0
        self.state.last_signature = None
        self.state.last_screen_hash = ""

    # --- utils ------------------------------------------------------------
    def _prepare_image(self, raw_path: Path) -> tuple[str, str]:
        img = Image.open(raw_path)
        scaled = img.resize(
            (img.width * SCREENSHOT_UPSCALE, img.height * SCREENSHOT_UPSCALE),
            resample=Image.NEAREST,
        )
        buf = io.BytesIO()
        scaled.save(buf, format="PNG", optimize=False)
        b64 = base64.b64encode(buf.getvalue()).decode()
        digest = hashlib.sha1(raw_path.read_bytes()).hexdigest()
        return b64, digest

    def _sanitize_presses(self, presses: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for step in presses:
            button = str(step.get("button", "")).upper()
            if button not in VALID_BUTTONS:
                continue
            hold = max(1, min(600, int(step.get("hold_frames", 6))))
            release = max(1, min(600, int(step.get("release_frames", 12))))
            out.append({"button": button, "hold_frames": hold, "release_frames": release})
        if not out:
            out.append(press("WAIT", 24, 1))
        return out[:8]

    def _latest_checkpoint(self) -> Path | None:
        if not self.checkpoints_dir.exists():
            return None
        checkpoints = sorted(self.checkpoints_dir.glob("t*.ss1"))
        return checkpoints[-1] if checkpoints else None

    def _should_recover(self) -> bool:
        if self.state.repeat_count >= RAM_STUCK_WINDOW:
            return True
        if self.state.repeat_count >= 4 and self.state.screenshot_repeat_count >= SCREEN_STUCK_WINDOW:
            return True
        return False

    def _update_progress_tracking(self, game_state: ram.GameState, screen_hash: str) -> None:
        signature = list(game_state.progress_signature())
        if self.state.last_signature == signature:
            self.state.repeat_count += 1
        else:
            self.state.repeat_count = 0
            self.state.recovery_attempts = 0
        if self.state.last_screen_hash == screen_hash:
            self.state.screenshot_repeat_count += 1
        else:
            self.state.screenshot_repeat_count = 0
        self.state.last_signature = signature
        self.state.last_screen_hash = screen_hash

    def _log_turn(
        self,
        entry: HistoryEntry,
        screenshot: Path,
        game_state: ram.GameState,
    ) -> None:
        with self.log_path.open("a") as handle:
            handle.write(
                json.dumps(
                    {
                        "turn": entry.turn,
                        "phase": entry.phase,
                        "objective": entry.objective,
                        "observation": entry.observation,
                        "reasoning": entry.reasoning,
                        "presses": entry.presses,
                        "source": entry.source,
                        "screenshot": screenshot.name,
                        "timestamp": time.time(),
                        "ram": game_state.to_dict(),
                    }
                )
                + "\n"
            )

    # --- optional model fallback -----------------------------------------
    def _call_model_fallback(
        self,
        screenshot_path: Path,
        game_state: ram.GameState,
        local_decision: PolicyDecision,
    ) -> PolicyDecision:
        if self.client is None:
            return local_decision

        img_b64, _ = self._prepare_image(screenshot_path)
        map_key = f"{game_state.map_group}.{game_state.map_num}"
        pos_key = (
            f"{game_state.pos_x},{game_state.pos_y}"
            if game_state.pos_x is not None and game_state.pos_y is not None
            else "?"
        )
        tracker_summary = self.tracker.summary_for_model(self.state.turn, map_key, pos_key)
        prompt = (
            f"Fallback reason: {local_decision.fallback_reason}\n\n"
            f"{tracker_summary}\n\n"
            f"{ram.format_state(game_state)}\n\n"
            f"Local controller phase: {local_decision.phase}\n"
            f"Local objective: {local_decision.objective}\n"
            f"Local plan if no better idea exists: {json.dumps(local_decision.presses)}\n\n"
            "Choose the next 1-8 button presses for the current screen. "
            "If PROGRESS_TRACKER lists walls at this tile, do NOT press those directions. "
            "If it lists an NPC loop, walk away rather than pressing A again."
        )
        system = FALLBACK_SYSTEM_PROMPT
        if self.walkthrough:
            system += "\n\nReference route:\n" + self.walkthrough

        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    system=system,
                    tools=[ACT_TOOL],
                    tool_choice={"type": "tool", "name": "act"},
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/png",
                                        "data": img_b64,
                                    },
                                },
                                {"type": "text", "text": prompt},
                            ],
                        }
                    ],
                )
                for block in response.content:
                    if getattr(block, "type", None) == "tool_use" and block.name == "act":
                        args = dict(block.input)
                        return PolicyDecision(
                            observation=str(args.get("observation", local_decision.observation)),
                            reasoning=str(args.get("reasoning", local_decision.reasoning)),
                            presses=self._sanitize_presses(args.get("presses") or local_decision.presses),
                            phase=local_decision.phase,
                            objective=local_decision.objective,
                        )
                raise RuntimeError("fallback response did not include act tool output")
            except Exception as exc:  # pragma: no cover - network and API failures
                last_error = exc
                time.sleep(min(20, 2 ** attempt))
        self._append_note(f"Model fallback failed: {type(last_error).__name__}: {last_error}")
        return local_decision

    # --- one turn ---------------------------------------------------------
    def step(self) -> HistoryEntry:
        self.state.turn += 1
        shot = self.frames_dir / f"t{self.state.turn:05d}.png"
        self.bridge.screenshot(shot)
        if not shot.exists():
            raise RuntimeError(f"screenshot did not land at {shot}")

        _, digest = self._prepare_image(shot)
        game_state = ram.read_game_state(self.bridge, screenshot_path=shot)
        self._update_progress_tracking(game_state, digest)

        # ---- experiential memory ---------------------------------------------
        # Compare last turn's RAM to this turn's RAM and the buttons we executed
        # last turn. The tracker accumulates wall observations, NPC interactions,
        # map/flag/badge change timestamps, etc.
        executed_last_turn = self.history[-1].presses if self.history else []
        for note in self.tracker.observe(
            self.state.turn,
            self.state.last_ram or None,
            game_state.to_dict(),
            executed_last_turn,
        ):
            self._append_note(note)
        self.last_macro_reason = self.tracker.macro_stuck(self.state.turn)
        if self.last_macro_reason:
            self._append_note(f"macro-stuck signal: {self.last_macro_reason}")

        source = "local"
        if self._should_recover():
            if self.state.recovery_attempts >= 2:
                checkpoint = self._latest_checkpoint()
                if checkpoint is not None:
                    self.bridge.loadstate(checkpoint)
                    self.bridge.wait(90)
                    self.state.rollbacks += 1
                    self.state.recovery_attempts = 0
                    self.state.repeat_count = 0
                    self.state.screenshot_repeat_count = 0
                    self._append_note(f"Loaded checkpoint {checkpoint.name} after repeated no-progress detection.")
                    decision = PolicyDecision(
                        observation=f"Loaded checkpoint {checkpoint.name} to recover from a stuck state.",
                        reasoning="RAM progress and screen hashes stopped changing, so the controller rolled back to the latest savestate.",
                        presses=[press("WAIT", 60, 1)],
                        phase=game_state.phase_hint,
                        objective=PHASE_OBJECTIVES.get(game_state.phase_hint, self.state.objective),
                    )
                    source = "rollback"
                else:
                    self.state.recovery_attempts += 1
                    decision = self.policy.recovery(game_state, self.state.recovery_attempts)
                    source = "recovery"
            else:
                self.state.recovery_attempts += 1
                decision = self.policy.recovery(game_state, self.state.recovery_attempts)
                source = "recovery"
        else:
            decision = self.policy.decide(
                game_state,
                runtime_state={
                    "turn": self.state.turn,
                    "repeat_count": self.state.repeat_count,
                    "recovery_attempts": self.state.recovery_attempts,
                    "macro_stuck": self.last_macro_reason,
                },
            )
            # Macro-stuck: long-horizon stagnation (no map / flag / position change
            # for many turns). Rate-limited so a long stuck period doesn't burn one
            # API call per turn — we re-trigger only every MACRO_FALLBACK_COOLDOWN
            # turns, which gives the model a chance to nudge us out of the loop.
            if (
                self.last_macro_reason
                and not decision.fallback_reason
                and (self.state.turn - self.state.last_macro_fallback_turn) > MACRO_FALLBACK_COOLDOWN
            ):
                decision.fallback_reason = f"macro_stuck: {self.last_macro_reason}"
                self.state.last_macro_fallback_turn = self.state.turn
            if decision.fallback_reason:
                fallback = self._call_model_fallback(shot, game_state, decision)
                if fallback is not decision:
                    decision = fallback
                    self.state.fallback_uses += 1
                    source = "model_fallback"

        presses = self._sanitize_presses(decision.presses)
        for step in presses:
            button = step["button"]
            if button == "WAIT":
                self.bridge.wait(step["hold_frames"])
            else:
                self.bridge.press(button, hold=step["hold_frames"], release=step["release_frames"])

        previous_phase = self.state.phase
        self.state.phase = decision.phase
        self.state.objective = decision.objective
        self.state.last_map = game_state.map_name or ""
        self.state.last_ram = game_state.to_dict()
        if previous_phase != decision.phase:
            self._append_note(f"Reached phase {decision.phase} on {game_state.map_name or 'an unknown map'}.")
        if source == "model_fallback":
            self._append_note(f"Used model fallback for {decision.fallback_reason}.")

        self._save_session_state()
        self._save_human_mirror()
        self.tracker.save(self.tracker_path)

        entry = HistoryEntry(
            turn=self.state.turn,
            observation=decision.observation,
            reasoning=decision.reasoning,
            presses=presses,
            phase=decision.phase,
            objective=decision.objective,
            source=source,
        )
        self.history.append(entry)
        if len(self.history) > 60:
            self.history = self.history[-60:]
        self._log_turn(entry, shot, game_state)
        return entry
