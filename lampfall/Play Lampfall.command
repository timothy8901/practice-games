#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  print "Lampfall needs Python 3 to start its local web server."
  read "?Press Enter to close."
  exit 1
fi
port=8877
if ! python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",8877)); s.close()' 2>/dev/null; then
  port=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')
fi
python3 serve.py "$port" &
lampfall_server_pid=$!
trap 'kill "$lampfall_server_pid" 2>/dev/null' EXIT INT TERM
sleep 0.5
open "http://127.0.0.1:$port/"
print "Lampfall is open in your browser. Keep this window open while playing."
print "Press Control-C here to stop the game server."
wait "$lampfall_server_pid"
