"""Screen recorder using macOS `screencapture -v`.

Captures the full display during the session so the gameplay can be reviewed
later. The mGBA window is brought to the front before recording starts.
"""
from __future__ import annotations

import os
import signal
import subprocess
import time
from pathlib import Path


class ScreenRecorder:
    def __init__(self, output_path: str | Path):
        self.output_path = Path(output_path).expanduser().resolve()
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.proc: subprocess.Popen | None = None

    def start(self) -> None:
        if self.proc is not None:
            return
        # -v video, -C capture cursor, -x no sound.
        # screencapture -v records until it receives SIGINT and then writes the MOV.
        self.proc = subprocess.Popen(
            ["screencapture", "-v", "-C", "-x", str(self.output_path)],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid,
        )

    def stop(self, wait_timeout: float = 10.0) -> Path | None:
        if self.proc is None:
            return None
        # screencapture responds to Ctrl-C (SIGINT) by finalising the MOV.
        try:
            os.killpg(os.getpgid(self.proc.pid), signal.SIGINT)
        except ProcessLookupError:
            pass
        try:
            self.proc.wait(timeout=wait_timeout)
        except subprocess.TimeoutExpired:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.proc.kill()
        self.proc = None
        # Give macOS a moment to flush the file.
        for _ in range(20):
            if self.output_path.exists() and self.output_path.stat().st_size > 0:
                return self.output_path
            time.sleep(0.2)
        return self.output_path if self.output_path.exists() else None
