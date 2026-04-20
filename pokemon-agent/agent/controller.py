"""TCP client for the mGBA Lua bridge.

The bridge runs inside mGBA as a Lua script. This client sends line-based
commands and waits for a one-line reply.
"""
from __future__ import annotations

import socket
import time
from pathlib import Path

VALID_KEYS = {"A", "B", "START", "SELECT", "UP", "DOWN", "LEFT", "RIGHT", "L", "R", "WAIT", "NONE"}


class BridgeError(RuntimeError):
    pass


class BridgeClient:
    def __init__(self, host: str = "127.0.0.1", port: int = 8888, timeout: float = 120.0):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.sock: socket.socket | None = None
        self._buf = b""

    def connect(self, retries: int = 60, delay: float = 0.5) -> None:
        last_err: Exception | None = None
        for _ in range(retries):
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(self.timeout)
                s.connect((self.host, self.port))
                s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
                self.sock = s
                self._buf = b""
                return
            except (ConnectionRefusedError, OSError) as e:
                last_err = e
                time.sleep(delay)
        raise BridgeError(f"could not connect to bridge at {self.host}:{self.port}: {last_err}")

    def close(self) -> None:
        if self.sock:
            try:
                self.sock.close()
            except OSError:
                pass
            self.sock = None
            self._buf = b""

    def _send(self, line: str) -> None:
        assert self.sock is not None
        self.sock.sendall((line + "\n").encode("utf-8"))

    def _recv_line(self) -> str:
        assert self.sock is not None
        while b"\n" not in self._buf:
            chunk = self.sock.recv(8192)
            if not chunk:
                raise BridgeError("bridge closed the connection")
            self._buf += chunk
        line, _, rest = self._buf.partition(b"\n")
        self._buf = rest
        return line.decode("utf-8", errors="replace").rstrip("\r")

    def cmd(self, line: str) -> str:
        self._send(line)
        resp = self._recv_line()
        if resp.startswith("ERR"):
            raise BridgeError(f"{line} -> {resp}")
        return resp

    # --- high level helpers ---------------------------------------------------

    def ping(self) -> str:
        return self.cmd("PING")

    def rom_info(self) -> str:
        return self.cmd("ROMINFO")

    def frame(self) -> int:
        resp = self.cmd("FRAME")
        return int(resp.split()[1])

    def press(self, key: str, hold: int = 5, release: int = 5) -> None:
        key = key.upper()
        if key not in VALID_KEYS:
            raise ValueError(f"invalid key: {key}")
        self.cmd(f"PRESS {key} {hold} {release}")

    def wait(self, frames: int) -> None:
        self.cmd(f"WAIT {frames}")

    def sequence(self, steps: list[tuple[str, int, int]] | list[tuple[str, int]]) -> None:
        """Execute a sequence of (key, hold_frames, release_frames) tuples as one atomic batch."""
        parts = []
        for step in steps:
            if len(step) == 3:
                k, h, r = step
            else:
                k, h = step  # type: ignore[misc]
                r = 5
            k = k.upper()
            if k not in VALID_KEYS:
                raise ValueError(f"invalid key in sequence: {k}")
            parts.append(f"{k}:{int(h)}:{int(r)}")
        self.cmd("SEQ " + ",".join(parts))

    def screenshot(self, path: str | Path) -> Path:
        p = Path(path).expanduser().resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        self.cmd(f"SCREEN {p}")
        return p

    def savestate(self, path: str | Path) -> Path:
        p = Path(path).expanduser().resolve()
        p.parent.mkdir(parents=True, exist_ok=True)
        self.cmd(f"SAVESTATE {p}")
        return p

    def loadstate(self, path: str | Path) -> Path:
        p = Path(path).expanduser().resolve()
        self.cmd(f"LOADSTATE {p}")
        return p

    def read8(self, addr: int) -> int:
        resp = self.cmd(f"READ 0x{addr:x} 1")
        return int(resp.split()[1], 16)

    def read16(self, addr: int) -> int:
        resp = self.cmd(f"READ 0x{addr:x} 2")
        return int(resp.split()[1], 16)

    def read32(self, addr: int) -> int:
        resp = self.cmd(f"READ 0x{addr:x} 4")
        return int(resp.split()[1], 16)

    def read_range(self, addr: int, length: int) -> bytes:
        resp = self.cmd(f"READRANGE 0x{addr:x} {length}")
        _, hexs = resp.split(maxsplit=1)
        return bytes.fromhex(hexs)

    def reset_queue(self) -> None:
        self.cmd("RESETQ")
