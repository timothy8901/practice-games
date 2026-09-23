#!/usr/bin/env bash
# build.sh — repack the modded app/ into the installed Comnyang, re-sign, relaunch.
#
# Local-use only. Repacking app.asar invalidates Comnyang's Developer-ID
# signature, so we ad-hoc re-sign (codesign --sign -). The app's
# EnableEmbeddedAsarIntegrityValidation fuse is OFF in this build, so the
# Info.plist ElectronAsarIntegrity hash is not enforced and is left untouched;
# if a future Comnyang update enables that fuse, this script must also rewrite
# the hash (sha256 of @electron/asar getRawHeader().headerString).
#
# Reversibility: app.asar.orig is the pristine code baseline and is pre-seeded
# as Resources/app.asar.comnyang-backup so the in-app Factory Reset restores
# stock behaviour. A full restore of the original *Developer-ID signature*
# requires reinstalling Comnyang from the vendor.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="${COMNYANG_APP:-/Applications/Comnyang.app}"
RES="$APP/Contents/Resources"
ASAR="${ASAR_BIN:-/Users/tim/games/desktop-pet-patti/node_modules/.bin/asar}"
STAGE="$(mktemp -d -t comnyang-build)"
trap 'rm -rf "$STAGE"' EXIT

[ -x "$ASAR" ] || ASAR="npx -y @electron/asar"
[ -f "$REPO/app.asar.orig" ] || { echo "missing app.asar.orig (pristine baseline)"; exit 1; }

echo "[build] quitting Comnyang if running…"
osascript -e 'tell application "Comnyang" to quit' >/dev/null 2>&1 || true
pkill -f "Comnyang.app/Contents/MacOS/Comnyang" 2>/dev/null || true
sleep 1

# All of node_modules stays unpacked: the native binaries (ffmpeg, uiohook,
# node-llama-cpp metal) require it, and node-llama-cpp's ESM dep tree is far
# simpler to load from real files than through asar path rewriting.
echo "[build] repacking app/ → app.asar (node_modules unpacked)…"
$ASAR pack "$REPO/app" "$STAGE/app.asar" \
  --unpack-dir "node_modules"

# Sanity: our mods must be inside the freshly packed archive.
# (asar extract-file writes <basename> into the current dir, so run it from $STAGE.)
( cd "$STAGE" && $ASAR extract-file app.asar main.js )
if ! grep -q "__comnyangBrain" "$STAGE/main.js"; then
  echo "[build] ABORT: brain bootstrap not found in packed main.js"; exit 1
fi
echo "[build] verified mods present in packed asar."

# Pre-seed the Factory-Reset backup with the PRISTINE asar (idempotent) so the
# runtime backupAppAsar() never captures a modded asar.
if [ ! -f "$RES/app.asar.comnyang-backup" ]; then
  echo "[build] pre-seeding Factory-Reset backup from app.asar.orig…"
  cp "$REPO/app.asar.orig" "$RES/app.asar.comnyang-backup"
fi

echo "[build] installing modded app.asar + unpacked node_modules…"
cp "$STAGE/app.asar" "$RES/app.asar"
rsync -a --delete "$STAGE/app.asar.unpacked/" "$RES/app.asar.unpacked/"

# Bundle the local model (idempotent; manifest lists it for factory reset)
if [ -f "$REPO/models/qwen3-1.7b-q4_k_m.gguf" ] && [ ! -f "$RES/models/qwen3-1.7b-q4_k_m.gguf" ]; then
  echo "[build] copying Qwen3 1.7B model into Resources/models…"
  mkdir -p "$RES/models"
  cp "$REPO/models/qwen3-1.7b-q4_k_m.gguf" "$RES/models/"
fi

echo "[build] clearing quarantine + ad-hoc re-signing…"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP" && echo "[build] signature verifies."

echo "[build] launching Comnyang…"
open "$APP"
echo "[build] done."
