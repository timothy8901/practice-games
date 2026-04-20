"""Pokémon Emerald (BPEE, English USA) RAM readers.

The game keeps two big structs in EWRAM: SaveBlock1 (world state, party) and
SaveBlock2 (player identity, play time). Their addresses move each frame due
to anti-piracy DMA rotation, but two fixed pointers in IWRAM always tell you
where to find them right now:

    0x03005D8C → gSaveBlock2Ptr  (SaveBlock2 base, ~0xF24 bytes)
    0x03005D90 → gSaveBlock1Ptr  (SaveBlock1 base, ~0x3D88 bytes)

Offsets taken from the pokeemerald disassembly. This module only reads — it
never writes — so the agent is playing the game, not cheating.
"""
from __future__ import annotations

import struct
from typing import Any

from .controller import BridgeClient

SB2_PTR_ADDR = 0x03005D8C
SB1_PTR_ADDR = 0x03005D90

# pokeemerald SaveBlock1 offsets (struct Coords16 pos; struct WarpData location; ...)
SB1_POS_X = 0x00
SB1_POS_Y = 0x02
SB1_MAP_GROUP = 0x04
SB1_MAP_NUM = 0x05
SB1_PARTY_COUNT = 0x234
SB1_PARTY = 0x238

# SaveBlock2
SB2_PLAYER_NAME = 0x00          # 7 chars + terminator (0xFF)
SB2_GENDER = 0x08               # 0 = boy, 1 = girl
SB2_TRAINER_ID = 0x0A           # u32 (low 16 bits = public id)
SB2_PLAY_HOURS = 0x0E           # u16
SB2_PLAY_MINUTES = 0x10         # u8
SB2_PLAY_SECONDS = 0x11         # u8

POKEMON_STRUCT_SIZE = 100
POKEMON_LEVEL = 0x54
POKEMON_HP = 0x56
POKEMON_MAX_HP = 0x58

# GBA text encoding (subset needed for names + play-time chars).
_CHAR_TABLE: dict[int, str] = {0x00: " ", 0xFF: ""}
for i, c in enumerate("0123456789"):
    _CHAR_TABLE[0xA1 + i] = c
_CHAR_TABLE[0xAB] = "!"
_CHAR_TABLE[0xAC] = "?"
_CHAR_TABLE[0xAD] = "."
_CHAR_TABLE[0xAE] = "-"
for i, c in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZ"):
    _CHAR_TABLE[0xBB + i] = c
for i, c in enumerate("abcdefghijklmnopqrstuvwxyz"):
    _CHAR_TABLE[0xD5 + i] = c

# Best-effort (map_group, map_num) → human name for early-game Hoenn. These
# are intentionally sparse — an incorrect label is worse than none, because
# the model would trust RAM over vision. The agent should cross-check with
# the screenshot when the map isn't listed here.
MAP_NAMES: dict[tuple[int, int], str] = {}


def _deref_saveblock(bridge: BridgeClient, ptr_addr: int) -> int | None:
    try:
        val = bridge.read32(ptr_addr)
    except Exception:
        return None
    # Valid SaveBlock pointers live somewhere in EWRAM (0x02000000-0x02040000).
    if 0x02000000 <= val <= 0x02040000:
        return val
    return None


def decode_emerald_text(buf: bytes, max_len: int | None = None) -> str:
    out: list[str] = []
    data = buf if max_len is None else buf[:max_len]
    for b in data:
        if b == 0xFF:
            break
        ch = _CHAR_TABLE.get(b)
        if ch:
            out.append(ch)
    return "".join(out)


def _game_started(state: dict[str, Any]) -> bool:
    """Heuristic: distinguish 'fresh boot, blocks zeroed' from 'game in progress'.
    A real save has either a non-empty player name, non-zero play time, or at
    least one Pokémon in the party.
    """
    name = (state.get("player_name") or "").strip()
    if name:
        return True
    if (state.get("play_hours") or 0) > 0 or (state.get("play_minutes") or 0) > 0:
        return True
    if (state.get("party_count") or 0) > 0:
        return True
    return False


def read_game_state(bridge: BridgeClient) -> dict[str, Any]:
    state: dict[str, Any] = {}
    sb1 = _deref_saveblock(bridge, SB1_PTR_ADDR)
    sb2 = _deref_saveblock(bridge, SB2_PTR_ADDR)
    state["sb1_ok"] = sb1 is not None
    state["sb2_ok"] = sb2 is not None

    if sb2 is not None:
        try:
            name_bytes = bridge.read_range(sb2 + SB2_PLAYER_NAME, 8)
            state["player_name"] = decode_emerald_text(name_bytes, 8)
            state["gender"] = "F" if bridge.read8(sb2 + SB2_GENDER) else "M"
            state["trainer_id"] = bridge.read32(sb2 + SB2_TRAINER_ID) & 0xFFFF
            state["play_hours"] = bridge.read16(sb2 + SB2_PLAY_HOURS)
            state["play_minutes"] = bridge.read8(sb2 + SB2_PLAY_MINUTES)
        except Exception as e:
            state["sb2_error"] = str(e)

    if sb1 is not None:
        try:
            raw = bridge.read_range(sb1 + SB1_POS_X, 8)
            pos_x, pos_y, map_group, map_num = struct.unpack("<hhbb", raw[:6])
            state["pos_x"] = pos_x
            state["pos_y"] = pos_y
            state["map_group"] = map_group & 0xFF
            state["map_num"] = map_num & 0xFF
            state["map_name"] = MAP_NAMES.get((state["map_group"], state["map_num"]))
            pc = bridge.read8(sb1 + SB1_PARTY_COUNT)
            pc = max(0, min(6, pc))
            state["party_count"] = pc
            party: list[dict[str, int]] = []
            for i in range(pc):
                base = sb1 + SB1_PARTY + i * POKEMON_STRUCT_SIZE
                lvl = bridge.read8(base + POKEMON_LEVEL)
                hp = bridge.read16(base + POKEMON_HP)
                max_hp = bridge.read16(base + POKEMON_MAX_HP)
                party.append({"slot": i + 1, "level": lvl, "hp": hp, "max_hp": max_hp})
            state["party"] = party
        except Exception as e:
            state["sb1_error"] = str(e)

    state["game_started"] = _game_started(state)
    return state


def format_state(state: dict[str, Any]) -> str:
    if not state.get("game_started"):
        return (
            "GAME_STATE (RAM): no save in progress yet — you're at the title/"
            "intro/name-entry. Trust the screenshot for what to do next."
        )
    lines: list[str] = ["GAME_STATE (RAM, authoritative):"]
    if state.get("sb2_ok"):
        name = state.get("player_name") or "(empty)"
        gender = state.get("gender", "?")
        tid = state.get("trainer_id")
        h = state.get("play_hours", 0)
        m = state.get("play_minutes", 0)
        tid_s = f" id={tid}" if tid else ""
        lines.append(f"  player: {name!r} ({gender}){tid_s}  playtime: {h}h{m:02d}m")
    if state.get("sb1_ok"):
        mg = state.get("map_group")
        mn = state.get("map_num")
        mapname = state.get("map_name")
        label = f" [{mapname}]" if mapname else ""
        lines.append(f"  map: {mg}.{mn}{label}  pos=({state.get('pos_x')}, {state.get('pos_y')})")
        pc = state.get("party_count", 0)
        if pc == 0:
            lines.append("  party: empty")
        else:
            lines.append(f"  party ({pc}):")
            for p in state.get("party", []):
                lines.append(f"    slot{p['slot']}: Lv{p['level']}  HP {p['hp']}/{p['max_hp']}")
    return "\n".join(lines)
