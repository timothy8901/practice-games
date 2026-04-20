"""Launches mGBA with the Pokemon Emerald ROM and loads the Lua bridge.

The Lua bridge opens a TCP server inside mGBA. Loading it requires driving
the macOS menu bar via AppleScript because mGBA 0.10.5 has no `--script`
flag. First launch opens Tools → Scripting then File → Load script... and
types the absolute path into the Cmd+Shift+G "Go to folder" sheet. Once the
script has been loaded at least once, subsequent sessions click File → Load
recent script → item 1, which is faster and avoids the file dialog.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import time
from pathlib import Path

from .controller import BridgeClient

MGBA_BIN = "/Users/tim/games/mGBA.app/Contents/MacOS/mGBA"
BRIDGE_LUA = Path(__file__).resolve().parent.parent / "bridge" / "mgba_bridge.lua"
ROM_PATH = Path(__file__).resolve().parent.parent / "rom" / "pokemon_emerald.gba"
SAV_PATH = ROM_PATH.with_suffix(".sav")


def _osa(script: str) -> str:
    r = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if r.returncode != 0:
        raise RuntimeError(f"osascript failed: {r.stderr.strip()}")
    return r.stdout.strip()


def kill_running_mgba() -> None:
    subprocess.run(["pkill", "-x", "mGBA"], check=False)
    time.sleep(1.0)


def wipe_save_file() -> None:
    """Delete any existing Emerald .sav so the game boots at the title with only NEW GAME available."""
    if SAV_PATH.exists():
        SAV_PATH.unlink()


def backup_save_file(dest: Path) -> Path | None:
    if SAV_PATH.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SAV_PATH, dest)
        return dest
    return None


def restore_save_file(src: Path) -> None:
    if src.exists():
        shutil.copy2(src, SAV_PATH)


def launch_mgba(rom: Path = ROM_PATH) -> subprocess.Popen:
    if not Path(MGBA_BIN).exists():
        raise RuntimeError(f"mGBA binary not found at {MGBA_BIN}")
    if not rom.exists():
        raise RuntimeError(f"ROM not found at {rom}")
    proc = subprocess.Popen([MGBA_BIN, str(rom)])
    # Wait for window
    for _ in range(40):
        try:
            out = _osa('tell application "System Events" to tell process "mGBA" to get name of windows')
            if "mGBA" in out or "Pokemon" in out:
                break
        except RuntimeError:
            pass
        time.sleep(0.25)
    time.sleep(1.0)
    return proc


def _ensure_scripting_window_focused() -> None:
    script = '''
tell application "System Events"
  tell process "mGBA"
    set frontmost to true
    delay 0.2
    if not (exists window "Scripting") then
      click menu item "Scripting..." of menu "Tools" of menu bar 1
      delay 0.8
    end if
    perform action "AXRaise" of window "Scripting"
    delay 0.3
    set sg to UI element 1 of window "Scripting"
    click (first UI element of sg whose role is "AXTextField")
    delay 0.3
  end tell
end tell
'''
    _osa(script)


def _load_script_first_time(lua_path: Path) -> None:
    script = f'''
tell application "System Events"
  tell process "mGBA"
    click menu item "Load script..." of menu "File" of menu bar 1
    delay 0.9
    keystroke "g" using {{command down, shift down}}
    delay 0.5
    keystroke "{lua_path}"
    delay 0.4
    keystroke return
    delay 0.6
    keystroke return
    delay 0.6
  end tell
end tell
'''
    _osa(script)


def _load_recent_script() -> bool:
    """Attempt to click 'Load recent script' → item 1. Returns True on success."""
    script = '''
tell application "System Events"
  tell process "mGBA"
    click menu item "Load recent script" of menu "File" of menu bar 1
    delay 0.4
    set recentMenu to menu 1 of menu item "Load recent script" of menu "File" of menu bar 1
    set items_ to every menu item of recentMenu
    if (count of items_) is 0 then
      return "NONE"
    end if
    click menu item 1 of recentMenu
    return "OK"
  end tell
end tell
'''
    try:
        res = _osa(script)
        return res == "OK"
    except RuntimeError:
        return False


def _reset_script_engine() -> None:
    script = '''
tell application "System Events"
  tell process "mGBA"
    try
      click menu item "Reset" of menu "File" of menu bar 1
    end try
  end tell
end tell
'''
    try:
        _osa(script)
    except RuntimeError:
        pass


def load_bridge_script(lua_path: Path = BRIDGE_LUA) -> None:
    lua_path = lua_path.expanduser().resolve()
    _ensure_scripting_window_focused()
    _reset_script_engine()
    time.sleep(0.5)
    _ensure_scripting_window_focused()
    # Prefer recent-script shortcut if mGBA remembers it.
    if not _load_recent_script():
        _load_script_first_time(lua_path)


def connect_bridge(host: str = "127.0.0.1", port: int = 8888, timeout: float = 30.0) -> BridgeClient:
    c = BridgeClient(host=host, port=port)
    c.connect()
    return c


def start_emulation(fresh: bool = True) -> tuple[subprocess.Popen, BridgeClient]:
    """Kill any running mGBA, optionally wipe the save, launch, load script, connect."""
    kill_running_mgba()
    if fresh:
        wipe_save_file()
    proc = launch_mgba()
    load_bridge_script()
    client = connect_bridge()
    # sanity
    client.ping()
    info = client.rom_info()
    if "BPEE" not in info:
        raise RuntimeError(f"unexpected ROM loaded: {info}")
    return proc, client


def bring_mgba_game_to_front() -> None:
    """Raise the main emulator window (not the Scripting window) so the screen recording captures gameplay."""
    script = '''
tell application "System Events"
  tell process "mGBA"
    set frontmost to true
    set wins to every window
    repeat with w in wins
      set nm to name of w
      if nm does not start with "Scripting" then
        perform action "AXRaise" of w
        exit repeat
      end if
    end repeat
  end tell
end tell
'''
    try:
        _osa(script)
    except RuntimeError:
        pass
