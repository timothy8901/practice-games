#!/usr/bin/env bash
# Run every Node unit test in the project (core, systems, data, prototypes).
# Usage: tools/check.sh            -> all tests
#        tools/check.sh pattern    -> only test files whose path matches the pattern
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PATTERN="${1:-}"
mapfile -t FILES < <(find . -path ./node_modules -prune -o \( -name '*.test.mjs' -o -name '*.test.js' \) -print | sort)
if [ -n "$PATTERN" ]; then
  mapfile -t FILES < <(printf '%s\n' "${FILES[@]}" | grep -- "$PATTERN")
fi
if [ "${#FILES[@]}" -eq 0 ]; then echo "no test files found"; exit 1; fi
pass=0; fail=0; failed=()
for f in "${FILES[@]}"; do
  out=$(node --test "$f" 2>&1)
  p=$(printf '%s\n' "$out" | grep -E '^# pass' | awk '{print $3}')
  fl=$(printf '%s\n' "$out" | grep -E '^# fail' | awk '{print $3}')
  p=${p:-0}; fl=${fl:-1}
  pass=$((pass + p)); fail=$((fail + fl))
  if [ "$fl" -ne 0 ]; then failed+=("$f"); printf '%s\n' "$out" | grep -E 'not ok|Error|error:|expected|actual' | head -20; fi
  printf '%-60s pass %-4s fail %-4s\n' "$f" "$p" "$fl"
done
echo "TOTAL: pass $pass fail $fail (${#FILES[@]} files)"
if [ "${#failed[@]}" -ne 0 ]; then printf 'FAILED: %s\n' "${failed[@]}"; exit 1; fi
