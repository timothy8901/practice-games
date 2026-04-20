#!/usr/bin/env bash
# Run a timed session of the Pokemon Emerald autonomous agent.
# Usage: ./run.sh                   -> 60-minute fresh run
#        ./run.sh --minutes 10      -> shorter run
#        ./run.sh --resume          -> continue from the most recent session's save
#        ./run.sh --no-record       -> skip screen recording
#        ./run.sh --model claude-opus-4-7   -> override model
set -euo pipefail
cd "$(dirname "$0")"
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is not set." >&2
  echo "  export ANTHROPIC_API_KEY=sk-ant-..." >&2
  exit 2
fi
exec python3 -m agent.main "$@"
