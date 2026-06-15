"use strict";
/**
 * install-manifest.js — bookkeeping for reversible mods.
 *
 * The integration calls these BEFORE it changes anything, so the factory reset
 * later knows exactly what to undo. The linchpin is backupAppAsar(): we copy the
 * pristine app.asar once, so "undo all code edits" is a single file restore.
 *
 * The manifest is a plain JSON file in userData. Nothing here is destructive.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const MANIFEST_NAME = "comnyang-mods-manifest.json";

function manifestPath(userDataDir) {
  return path.join(userDataDir, MANIFEST_NAME);
}

function load(userDataDir) {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(userDataDir), "utf8"));
  } catch {
    return null;
  }
}

function save(userDataDir, manifest) {
  fs.mkdirSync(userDataDir, { recursive: true });
  const tmp = `${manifestPath(userDataDir)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmp, manifestPath(userDataDir));
}

function emptyManifest(modVersion) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    modVersion: modVersion || "0.1.0",
    appAsar: null,               // { target, backup }
    addedFiles: [],              // absolute file paths we created (e.g. the .gguf)
    addedDirs: [],               // absolute dirs we created (removed if empty)
    settingsFile: null,          // userData/settings.json
    settingsKeysAdded: [],       // keys we introduced into settings.json
    userDataDelete: [],          // userData files/dirs we created (e.g. hooks/, brain-state.json)
    devToolHookFiles: [],        // { path, backup, markers:[...] }
  };
}

/** Copy app.asar -> app.asar.comnyang-backup once. Idempotent. */
function backupAppAsar(resourcesDir) {
  const target = path.join(resourcesDir, "app.asar");
  const backup = path.join(resourcesDir, "app.asar.comnyang-backup");
  if (!fs.existsSync(backup) && fs.existsSync(target)) {
    fs.copyFileSync(target, backup);
  }
  return { target, backup };
}

/** Back up an arbitrary file next to itself with a .comnyang-backup suffix. */
function backupFile(filePath) {
  const backup = `${filePath}.comnyang-backup`;
  try {
    if (!fs.existsSync(backup) && fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backup);
      return backup;
    }
  } catch { /* ignore */ }
  return fs.existsSync(backup) ? backup : null;
}

/** Convenience: standard manifest for our current mod set. */
function buildDefaultManifest({ userDataDir, resourcesDir, modelFile, modVersion }) {
  const m = emptyManifest(modVersion);
  m.appAsar = backupAppAsar(resourcesDir);
  if (modelFile) {
    m.addedFiles.push(modelFile);
    m.addedDirs.push(path.dirname(modelFile));
  }
  m.settingsFile = path.join(userDataDir, "settings.json");
  m.settingsKeysAdded = [
    "brainEnabled", "brainBackend", "brainModelPath",
    "feedingEnabled", "feedingHour", "feedingMinute", "feedingTimeZone",
    "notifyOnClaudeComplete",
  ];
  m.userDataDelete = [
    path.join(userDataDir, "brain-state.json"),
    path.join(userDataDir, "hooks"), // copied comnyang-*-hook.js scripts live here
  ];
  const home = os.homedir();
  m.devToolHookFiles = [
    { path: path.join(home, ".claude", "settings.json"),
      markers: ["--comnyang-claude-hook", "comnyang-claude-hook.js"] },
    { path: path.join(home, ".cursor", "hooks.json"),
      markers: ["--comnyang-cursor-hook", "comnyang-cursor-hook.js"] },
    { path: path.join(home, ".gemini", "config", "hooks.json"),
      markers: ["--comnyang-antigravity-hook", "comnyang-antigravity-hook.js"],
      removeKeys: ["comnyang"] },
  ];
  // capture pristine copies of the dev-tool files if they predate us
  for (const f of m.devToolHookFiles) f.backup = backupFile(f.path);
  return m;
}

module.exports = {
  MANIFEST_NAME, manifestPath, load, save, emptyManifest,
  backupAppAsar, backupFile, buildDefaultManifest,
};
