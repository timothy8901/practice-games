"use strict";
/**
 * factory-reset.js — reverse every change our mods made, returning Comnyang to
 * stock behaviour. Driven by the manifest written at install time.
 *
 * Order matters:
 *   1. restore the pristine app.asar  (undoes ALL injected code in one move)
 *   2. delete files we added          (the .gguf model, etc.)
 *   3. strip our keys from settings.json (leaves the user's cat name/pattern/etc.)
 *   4. delete userData artifacts we created (brain-state.json, copied hook scripts)
 *   5. clean Comnyang hook entries out of ~/.claude, ~/.cursor, ~/.gemini
 *      (this also fixes the "lingering hooks after uninstall" issue)
 *   6. remove the manifest + backups   (truly factory)
 *
 * Everything is defensive: a missing file is a no-op, never a throw. Pass
 * { dryRun:true } to preview. Returns a report of what was done.
 *
 * The caller (main process) then relaunches:  app.relaunch(); app.exit(0);
 */

const fs = require("fs");
const path = require("path");
const manifestLib = require("./install-manifest");

// Remove any object inside an array whose `command` string contains a marker,
// plus now-empty {matcher, hooks:[]} wrappers. Generic across Claude/Cursor/Gemini shapes.
function stripHookEntries(node, markers) {
  let removed = 0;
  const isHit = (cmd) => typeof cmd === "string" && markers.some((m) => cmd.includes(m));

  function clean(value) {
    if (Array.isArray(value)) {
      const out = [];
      for (const item of value) {
        if (item && typeof item === "object" && isHit(item.command)) { removed++; continue; }
        const c = clean(item);
        if (c && typeof c === "object" && Array.isArray(c.hooks) &&
            c.hooks.length === 0 && Object.prototype.hasOwnProperty.call(c, "matcher")) {
          removed++; continue;
        }
        out.push(c);
      }
      return out;
    }
    if (value && typeof value === "object") {
      const out = {};
      for (const k of Object.keys(value)) out[k] = clean(value[k]);
      return out;
    }
    return value;
  }

  return { cleaned: clean(node), removed };
}

function rmFile(p, report, dryRun) {
  try {
    if (fs.existsSync(p)) {
      if (!dryRun) fs.rmSync(p, { force: true });
      report.deleted.push(p);
    }
  } catch (e) { report.errors.push(`delete ${p}: ${e.message}`); }
}

function rmDir(p, report, dryRun) {
  try {
    if (fs.existsSync(p)) {
      if (!dryRun) fs.rmSync(p, { recursive: true, force: true });
      report.deleted.push(p + "/");
    }
  } catch (e) { report.errors.push(`rmdir ${p}: ${e.message}`); }
}

/**
 * @param {object} opts
 * @param {string} opts.userDataDir   where the manifest lives
 * @param {boolean} [opts.dryRun]      preview only
 * @param {boolean} [opts.restoreDevToolBackups]  restore pristine ~/.claude etc. if backed up (default: strip in place)
 */
function factoryReset(opts = {}) {
  const { userDataDir, dryRun = false, restoreDevToolBackups = false } = opts;
  const report = { restored: [], deleted: [], settingsCleaned: [], hooksRemoved: 0, errors: [], dryRun };

  const m = manifestLib.load(userDataDir);
  if (!m) {
    report.errors.push("no manifest found — nothing to reset (app may already be stock)");
    return report;
  }

  // 1. restore pristine app.asar
  if (m.appAsar && m.appAsar.backup && fs.existsSync(m.appAsar.backup)) {
    try {
      if (!dryRun) fs.copyFileSync(m.appAsar.backup, m.appAsar.target);
      report.restored.push(m.appAsar.target);
    } catch (e) { report.errors.push(`restore app.asar: ${e.message}`); }
  }

  // 2. delete added files, then any dirs that became empty
  for (const f of m.addedFiles || []) rmFile(f, report, dryRun);
  for (const d of m.addedDirs || []) {
    try {
      if (fs.existsSync(d) && fs.readdirSync(d).length === 0) rmDir(d, report, dryRun);
    } catch (e) { report.errors.push(`rmdir ${d}: ${e.message}`); }
  }

  // 3. strip our keys out of settings.json (keep the user's own settings)
  if (m.settingsFile && fs.existsSync(m.settingsFile) && (m.settingsKeysAdded || []).length) {
    try {
      const json = JSON.parse(fs.readFileSync(m.settingsFile, "utf8"));
      let changed = false;
      for (const k of m.settingsKeysAdded) {
        if (Object.prototype.hasOwnProperty.call(json, k)) {
          delete json[k]; report.settingsCleaned.push(k); changed = true;
        }
      }
      if (changed && !dryRun) fs.writeFileSync(m.settingsFile, JSON.stringify(json, null, 2));
    } catch (e) { report.errors.push(`clean settings: ${e.message}`); }
  }

  // 4. delete userData artifacts we created
  for (const p of m.userDataDelete || []) {
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isDirectory()) rmDir(p, report, dryRun);
    else rmFile(p, report, dryRun);
  }

  // 5. clean Comnyang hook entries out of the dev-tool config files
  for (const f of m.devToolHookFiles || []) {
    try {
      if (restoreDevToolBackups && f.backup && fs.existsSync(f.backup)) {
        if (!dryRun) fs.copyFileSync(f.backup, f.path);
        report.restored.push(f.path);
        continue;
      }
      if (!fs.existsSync(f.path)) continue;
      const json = JSON.parse(fs.readFileSync(f.path, "utf8"));
      const { cleaned, removed } = stripHookEntries(json, f.markers || []);
      let keyChanged = false;
      for (const key of f.removeKeys || []) {
        if (cleaned && typeof cleaned === "object" &&
            Object.prototype.hasOwnProperty.call(cleaned, key)) {
          delete cleaned[key]; keyChanged = true;
        }
      }
      if (removed > 0 || keyChanged) {
        if (!dryRun) fs.writeFileSync(f.path, JSON.stringify(cleaned, null, 2));
        report.hooksRemoved += removed;
      }
    } catch (e) { report.errors.push(`clean hooks ${f.path}: ${e.message}`); }
  }

  // 6. remove backups + manifest last (point of no return — truly factory)
  if (m.appAsar && m.appAsar.backup) rmFile(m.appAsar.backup, report, dryRun);
  for (const f of m.devToolHookFiles || []) if (f.backup) rmFile(f.backup, report, dryRun);
  rmFile(manifestLib.manifestPath(userDataDir), report, dryRun);

  return report;
}

module.exports = { factoryReset, stripHookEntries };
