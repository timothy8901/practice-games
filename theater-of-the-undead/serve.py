#!/usr/bin/env python3
"""Tiny static server that disables caching — for development/preview so edited
ES modules always reload. For normal play `python3 -m http.server 8124` is fine."""
import http.server, socketserver, functools, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
DIR = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


Handler = functools.partial(NoCacheHandler, directory=DIR)
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), Handler) as httpd:
    print(f'serving {DIR} at http://localhost:{PORT} (no-cache)')
    httpd.serve_forever()
