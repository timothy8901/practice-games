#!/usr/bin/env bash
# The CI gate (ARCHITECTURE §11): validate data -> lint ownership/purity -> lint art -> smoke-import every module
# -> every Node unit test, one file at a time with a summary -> optional Playwright playtest.
# Usage: tools/check.sh            -> full gate
#        tools/check.sh pattern    -> full gate, but only test files whose path matches the pattern
# Exit 1 if any step fails; every step still runs so one report shows everything that is wrong.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PATTERN="${1:-}"
steps_failed=()

step() { # step <name> <command...>
  local name="$1"; shift
  echo "== $name"
  if "$@"; then echo "-- $name: ok"; else echo "-- $name: FAILED"; steps_failed+=("$name"); fi
}

step "validate-data" "${NODE:-node}" tools/validate-data.mjs --quiet
step "lint-owners" "${NODE:-node}" tools/lint-owners.mjs --quiet
# GDD-00 §14 art linter. char/portrait stay advisory until the ART-CHARS ramps are in art/palette.CAST_HEX.
step "lint-art" "${NODE:-node}" tools/lint-art.mjs --quiet --advisory=char,portrait
if [ -f tools/smoke-import.mjs ]; then
  step "smoke-import" "${NODE:-node}" tools/smoke-import.mjs --quiet
else
  echo "== smoke-import: skipped (tools/smoke-import.mjs not present)"
fi

run_tests() {
  "${NODE:-node}" tools/test-suite.mjs "$PATTERN"
}
step "unit tests" run_tests

if [ -n "${PLAYWRIGHT:-}" ] && [ -f tools/playtest.mjs ]; then
  step "playtest" node tools/playtest.mjs --quick
else
  echo "== playtest: skipped (set PLAYWRIGHT=1 once tools/playtest.mjs exists)"
fi

if [ "${#steps_failed[@]}" -ne 0 ]; then
  printf 'CHECK FAILED: %s\n' "${steps_failed[*]}"
  exit 1
fi
echo "CHECK OK"
