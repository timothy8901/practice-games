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

step "validate-data" node tools/validate-data.mjs --quiet
step "lint-owners" node tools/lint-owners.mjs --quiet
# GDD-00 §14 art linter. char/portrait stay advisory until the ART-CHARS ramps are in art/palette.CAST_HEX.
step "lint-art" node tools/lint-art.mjs --quiet --advisory=char,portrait
if [ -f tools/smoke-import.mjs ]; then
  step "smoke-import" node tools/smoke-import.mjs --quiet
else
  echo "== smoke-import: skipped (tools/smoke-import.mjs not present)"
fi

run_tests() {
  local files f out p fl pass=0 fail=0 failed=()
  mapfile -t files < <(find . -path ./node_modules -prune -o -path ./test/out -prune -o \( -name '*.test.mjs' -o -name '*.test.js' \) -print | sort)
  if [ -n "$PATTERN" ]; then
    mapfile -t files < <(printf '%s\n' "${files[@]}" | grep -- "$PATTERN")
  fi
  if [ "${#files[@]}" -eq 0 ] || [ -z "${files[0]}" ]; then echo "no test files found"; return 1; fi
  for f in "${files[@]}"; do
    out=$(node --test "$f" 2>&1 | tr -d '\000')
    p=$(printf '%s\n' "$out" | grep -E '^# pass' | awk '{print $3}')
    fl=$(printf '%s\n' "$out" | grep -E '^# fail' | awk '{print $3}')
    p=${p:-0}; fl=${fl:-1}
    pass=$((pass + p)); fail=$((fail + fl))
    if [ "$fl" -ne 0 ]; then failed+=("$f"); printf '%s\n' "$out" | grep -E 'not ok|Error|error:|expected|actual' | head -20; fi
    printf '%-60s pass %-4s fail %-4s\n' "$f" "$p" "$fl"
  done
  echo "TOTAL: pass $pass fail $fail (${#files[@]} files)"
  if [ "${#failed[@]}" -ne 0 ]; then printf 'FAILED: %s\n' "${failed[@]}"; return 1; fi
  return 0
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
