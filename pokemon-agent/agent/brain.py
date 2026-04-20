"""Claude-backed decision loop for the Pokemon Emerald agent.

Each turn:
  1. Take a screenshot from the bridge.
  2. Build a compact prompt: current frame + notebook + recent action log.
  3. Call Claude with an `act` tool that forces structured output.
  4. Execute the queued button presses via the bridge.
  5. Persist the notebook and log so the agent can resume next session.

Notebook is the only long-term memory that survives across turns and sessions.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import anthropic
from PIL import Image

from .controller import BridgeClient
from . import ram

DEFAULT_MODEL = os.environ.get("POKEMON_AGENT_MODEL", "claude-sonnet-4-6")
SCREENSHOT_UPSCALE = 3  # 240x160 -> 720x480 so the vision model can read text
STUCK_WINDOW = 4  # if the last N screen hashes are identical, warn the model

VALID_BUTTONS = ["A", "B", "START", "SELECT", "UP", "DOWN", "LEFT", "RIGHT", "L", "R", "WAIT"]

SYSTEM_PROMPT = """You are an autonomous agent playing Pokémon Emerald on a Game Boy Advance emulator.

YOUR GOAL: Beat the Pokémon League — the Elite Four and the Champion — as efficiently as possible. \
Play like a focused speedrunner: train adequately, make good strategic choices, don't waste time. \
No cheats, no glitches, no code manipulation — just skilled play.

BUTTONS:
- A: confirm / interact / advance text
- B: cancel / back / run from wild encounter
- START: open main menu in overworld / skip title screens
- SELECT: Pokédex / registered item
- UP/DOWN/LEFT/RIGHT: move character or cursor
- L/R: rarely used
- WAIT: no input, just wait frames

Each button has hold_frames (how long the button is held; 4–8 is normal for menus) and \
release_frames (how long after release before the NEXT press; 12–20 is normal). \
For dialog mashing, A with hold=4 release=20 works well. For fast walking, hold a direction for 30+ frames. \
You may queue up to 8 presses per turn — use this to batch obvious actions and save API calls.

YOUR NOTEBOOK:
You have a single persistent notebook. It is the only memory that survives between turns and sessions. \
Keep it structured and under 3KB. Example:

  GOAL: beat the Elite Four
  PHASE: intro / Littleroot / Route 101 / Petalburg Gym / ...
  PARTY:
    - <name> <level> <hp> <moves>
  OBJECTIVE: "what I'm trying to do right this moment"
  BADGES: 0/8
  MONEY: <amount>
  ITEMS: <key items>
  ROUTE_NOTES:
    - short notes about trainers, wild encounters, puzzles
  BLOCKERS: <nothing, or what I'm stuck on>

Update the notebook ONLY when the world state actually changes in a way you'd want to remember next turn: \
entered a new area, beat a trainer, leveled up, got a key item, chose a starter, solved a puzzle, \
or noticed something surprising. Do NOT rewrite the whole notebook every turn — that burns tokens.

OPERATING RULES:
1. When asked to name your character: name it CLAUDE. Use the on-screen keyboard (move the cursor with \
   D-pad, press A to select a letter). Don't name any Pokémon — skip naming by selecting OK.
2. Any starter is fine; pick one and commit.
3. When dialogue is scrolling or waiting, press A to advance. If the screen hasn't changed after your last \
   press, keep pressing A — don't invent new actions for no reason.
4. If you're stuck (same screen for 3+ of your own turns), try a DIFFERENT action: press B to cancel, \
   try the opposite direction, open the START menu, back away from an NPC.
5. Save the game frequently via START menu → SAVE → YES → YES — especially before gym leaders and \
   before unexplored routes. Saving is cheap; losing progress is expensive.
6. In battle: READ the HP bars, type effectiveness, and move names. Pick moves with type advantage. \
   Heal at low HP. Switch if your Pokémon is at type disadvantage.
7. Don't grind forever. Train until your party's levels are roughly equal to the next trainer/gym leader.
8. Running FROM wild battles is fine if you're not gaining useful XP. Press B repeatedly on the RUN option.

RESPONSE FORMAT:
Respond with exactly one call to the `act` tool per turn. No free-form text."""

ACT_TOOL: dict[str, Any] = {
    "name": "act",
    "description": (
        "Report what you see on screen, (optionally) update your notebook, and queue the next button presses."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "observation": {
                "type": "string",
                "description": "One or two sentences describing what is on the screen right now.",
            },
            "reasoning": {
                "type": "string",
                "description": "Short justification for the chosen actions (≤ 2 sentences).",
            },
            "presses": {
                "type": "array",
                "description": "1–8 button presses to execute in order. Use WAIT to let animation/dialog advance.",
                "minItems": 1,
                "maxItems": 8,
                "items": {
                    "type": "object",
                    "properties": {
                        "button": {"type": "string", "enum": VALID_BUTTONS},
                        "hold_frames": {"type": "integer", "minimum": 1, "maximum": 600, "default": 6},
                        "release_frames": {"type": "integer", "minimum": 1, "maximum": 600, "default": 12},
                    },
                    "required": ["button"],
                    "additionalProperties": False,
                },
            },
            "notebook": {
                "type": "string",
                "description": (
                    "New notebook content, fully replacing the old one. Omit this field if you don't want to "
                    "change the notebook. Keep under 3KB."
                ),
            },
        },
        "required": ["observation", "reasoning", "presses"],
        "additionalProperties": False,
    },
}


@dataclass
class HistoryEntry:
    turn: int
    observation: str
    reasoning: str
    presses: list[dict[str, Any]]


@dataclass
class AgentState:
    notebook: str = (
        "GOAL: beat the Pokémon League (Elite Four + Champion)\n"
        "PHASE: fresh boot — game has just started\n"
        "PARTY: none yet\n"
        "OBJECTIVE: press START at the title screen, then choose NEW GAME\n"
        "BADGES: 0/8\n"
        "NOTES:\n"
        "  - player name must be CLAUDE on the naming screen\n"
    )
    turn: int = 0
    history: list[HistoryEntry] = field(default_factory=list)
    screen_hashes: list[str] = field(default_factory=list)


class PokemonAgent:
    def __init__(
        self,
        bridge: BridgeClient,
        session_dir: Path,
        model: str = DEFAULT_MODEL,
        api_key: str | None = None,
        max_retries: int = 4,
    ):
        self.bridge = bridge
        self.session_dir = Path(session_dir)
        self.session_dir.mkdir(parents=True, exist_ok=True)
        self.frames_dir = self.session_dir / "frames"
        self.frames_dir.mkdir(exist_ok=True)
        self.notebook_path = self.session_dir / "notebook.md"
        self.log_path = self.session_dir / "turns.jsonl"
        self.model = model
        self.client = anthropic.Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))
        self.max_retries = max_retries
        self.state = AgentState()
        self._load_notebook()

    # --- persistence ----------------------------------------------------------
    def _load_notebook(self) -> None:
        if self.notebook_path.exists():
            self.state.notebook = self.notebook_path.read_text()

    def _save_notebook(self) -> None:
        self.notebook_path.write_text(self.state.notebook)

    def _log_turn(self, entry: HistoryEntry, screenshot: Path) -> None:
        with self.log_path.open("a") as f:
            f.write(json.dumps({
                "turn": entry.turn,
                "observation": entry.observation,
                "reasoning": entry.reasoning,
                "presses": entry.presses,
                "screenshot": str(screenshot.name),
                "timestamp": time.time(),
            }) + "\n")

    # --- turn ----------------------------------------------------------------
    def _prepare_image(self, raw_path: Path) -> tuple[str, str]:
        """Upscale the native 240×160 GBA frame so the vision model can read it.

        Returns (base64_png, sha1_of_raw). Nearest-neighbour keeps the pixel
        art crisp; anti-aliasing would blur single-pixel text.
        """
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

    def _detect_stuck(self, current_hash: str) -> bool:
        self.state.screen_hashes.append(current_hash)
        if len(self.state.screen_hashes) > STUCK_WINDOW + 2:
            self.state.screen_hashes.pop(0)
        window = self.state.screen_hashes[-STUCK_WINDOW:]
        return len(window) >= STUCK_WINDOW and len(set(window)) == 1

    def _read_ram_state(self) -> str:
        try:
            state = ram.read_game_state(self.bridge)
            return ram.format_state(state)
        except Exception as e:
            return f"GAME_STATE: read failed ({type(e).__name__}: {e})"

    def _build_user_content(self, screenshot_path: Path) -> list[dict[str, Any]]:
        img_b64, digest = self._prepare_image(screenshot_path)
        stuck = self._detect_stuck(digest)
        ram_summary = self._read_ram_state()

        recent_lines = []
        for e in self.state.history[-8:]:
            btns = ",".join(p.get("button", "?") for p in e.presses)
            recent_lines.append(f"  T{e.turn}: {e.observation[:90]} → {btns}")
        recent = "\n".join(recent_lines) if recent_lines else "  (none)"

        stuck_block = ""
        if stuck:
            stuck_block = (
                "\n⚠ STUCK DETECTED: the last "
                f"{STUCK_WINDOW} screenshots are pixel-identical. Your previous "
                "actions produced no visible change. Try something DIFFERENT — "
                "press B, move the other direction, open the START menu, walk "
                "away from an NPC, or wait longer for a slow animation.\n"
            )

        text = (
            f"TURN {self.state.turn + 1}\n\n"
            f"{ram_summary}\n\n"
            f"NOTEBOOK (your persistent memory):\n```\n{self.state.notebook}\n```\n"
            f"{stuck_block}\n"
            f"RECENT TURNS (latest last):\n{recent}\n\n"
            "The screenshot above is upscaled 3× from the native 240×160 GBA "
            "frame. RAM-derived GAME_STATE is authoritative when it disagrees "
            "with the image. Call the `act` tool."
        )
        return [
            {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}},
            {"type": "text", "text": text},
        ]

    def _call_model(self, user_content: list[dict[str, Any]]) -> dict[str, Any]:
        last_err: Exception | None = None
        system_blocks = [
            {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
        ]
        tools_with_cache = [dict(ACT_TOOL, cache_control={"type": "ephemeral"})]
        for attempt in range(self.max_retries):
            try:
                resp = self.client.messages.create(
                    model=self.model,
                    max_tokens=2048,
                    system=system_blocks,
                    tools=tools_with_cache,
                    tool_choice={"type": "tool", "name": "act"},
                    messages=[{"role": "user", "content": user_content}],
                )
                for block in resp.content:
                    if getattr(block, "type", None) == "tool_use" and block.name == "act":
                        return dict(block.input)
                raise RuntimeError("no act tool call in response")
            except Exception as e:
                # anthropic.APIConnectionError / RateLimitError / APIStatusError all inherit from Exception
                last_err = e
                msg = str(e)
                # Don't retry on auth errors — they won't fix themselves.
                if "401" in msg or "authentication" in msg.lower():
                    raise
                backoff = min(30, 2 ** attempt)
                print(f"[brain] API error ({type(e).__name__}: {e}); retrying in {backoff}s")
                time.sleep(backoff)
        raise RuntimeError(f"model call failed after {self.max_retries} retries: {last_err}")

    def step(self) -> HistoryEntry:
        self.state.turn += 1
        shot = self.frames_dir / f"t{self.state.turn:05d}.png"
        self.bridge.screenshot(shot)
        if not shot.exists():
            raise RuntimeError(f"screenshot did not land at {shot}")

        user_content = self._build_user_content(shot)
        args = self._call_model(user_content)

        observation = str(args.get("observation", ""))
        reasoning = str(args.get("reasoning", ""))
        presses = args.get("presses") or []
        if not isinstance(presses, list) or not presses:
            presses = [{"button": "WAIT", "hold_frames": 30}]
        new_notebook = args.get("notebook")
        if isinstance(new_notebook, str) and new_notebook.strip():
            self.state.notebook = new_notebook
            self._save_notebook()

        # Execute presses
        for step in presses:
            key = str(step.get("button", "")).upper()
            if key not in VALID_BUTTONS:
                continue
            hold = int(step.get("hold_frames", 6))
            release = int(step.get("release_frames", 12))
            hold = max(1, min(600, hold))
            release = max(1, min(600, release))
            if key == "WAIT":
                self.bridge.wait(hold)
            else:
                self.bridge.press(key, hold=hold, release=release)

        entry = HistoryEntry(
            turn=self.state.turn,
            observation=observation,
            reasoning=reasoning,
            presses=presses,
        )
        self.state.history.append(entry)
        # keep memory compact
        if len(self.state.history) > 40:
            self.state.history = self.state.history[-40:]
        self._log_turn(entry, shot)
        return entry
