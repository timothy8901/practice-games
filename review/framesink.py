#!/usr/bin/env python3
"""framesink.py — catch the frames _capture.html posts and write them to disk.

    python3 review/framesink.py [outdir] [port]

Defaults to `review/frames` on port 8231, which is what _capture.html expects.

The capture page renders into a 2-D canvas and POSTs each frame as a JPEG data
URL. This receives them, strips the data-URL preamble, decodes and writes
`f00000.jpg`, `f00001.jpg`, ... ready for ffmpeg.

It was an ad-hoc script the first two times a video was made, which meant
rebuilding it from memory each time and getting the CORS headers wrong twice.
It is committed now.

CORS: the capture page is served from the game's own origin (port 3000) and
posts here (8231), so every response needs Access-Control-Allow-Origin or the
page's `await fetch(...)` never resolves and the capture stalls silently on
frame 0 — which looks exactly like a hung render.
"""

import base64
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else
                      os.path.join(os.path.dirname(__file__), 'frames'))
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8231


class Sink(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        name = os.path.basename(self.path.lstrip('/')) or 'frame.jpg'
        n = int(self.headers.get('content-length', 0))
        body = self.rfile.read(n).decode('utf8', 'replace')
        if ',' in body:
            body = body.split(',', 1)[1]          # strip "data:image/jpeg;base64,"
        try:
            data = base64.b64decode(body)
        except Exception as e:
            self.send_response(400); self._cors(); self.end_headers()
            self.wfile.write(str(e).encode()); return
        with open(os.path.join(OUT, name), 'wb') as f:
            f.write(data)
        self.send_response(200)
        self._cors()
        self.send_header('content-length', '2')
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, *a):                     # one line per frame is noise
        pass


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.jpg'):
            os.remove(os.path.join(OUT, f))
    print(f'frame sink on :{PORT} -> {OUT}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Sink).serve_forever()
