#!/usr/bin/env python3
"""Static dev server for the review pages, with caching turned off.

Run from the repository root:

    python3 review/serve.py [port]

The port comes from, in order: the command line, `$PORT`, then 8129. Reading
`$PORT` is what lets a launcher assign a free port instead of fighting over a
fixed one — `python3 -m http.server` cannot do that at all, which is how this
ended up colliding with a Docker daemon already holding 8000.

Plain `python3 -m http.server` is also enough to load the pages, but it lets the
browser cache ES modules aggressively. Editing a file under 3d-mazeball/src/ then
reloading gives you a half-old module graph, and the failure mode is a mystifying
"does not provide an export named X" against source that plainly exports it.
`Cache-Control: no-store` costs nothing on localhost and removes the whole class
of confusion.
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PORT = 8129


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        if '404' in (fmt % args):
            sys.stderr.write('%s\n' % (fmt % args))


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT') or DEFAULT_PORT)
    print(f'serving {ROOT} at http://localhost:{port}/')
    print(f'  the game     http://localhost:{port}/review/severed.html')
    print(f'  bare harness http://localhost:{port}/review/maze.html')
    print(f'  64 pieces    http://localhost:{port}/review/')
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
