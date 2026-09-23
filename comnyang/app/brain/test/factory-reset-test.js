"use strict";
/**
 * factory-reset-test.js — build a fake "fully modded" Comnyang environment in a
 * temp dir, run factoryReset, and assert everything is reversed while the user's
 * OWN settings and OWN dev-tool hooks survive untouched.
 *
 *   node test/factory-reset-test.js
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");
const { factoryReset } = require("../src/factory-reset");
const manifestLib = require("../src/install-manifest");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "comnyang-reset-"));
const resources = path.join(root, "Resources");
const userData = path.join(root, "userData");
const home = path.join(root, "home");
const claudeDir = path.join(home, ".claude");
const cursorDir = path.join(home, ".cursor");
const geminiDir = path.join(home, ".gemini", "config");
for (const d of [resources, userData, path.join(resources, "models"), claudeDir, cursorDir, geminiDir, path.join(userData, "hooks")]) {
  fs.mkdirSync(d, { recursive: true });
}

// --- pretend the app was modded ---
fs.writeFileSync(path.join(resources, "app.asar"), "MODIFIED-BY-MODS");          // our injected build
fs.writeFileSync(path.join(resources, "app.asar.comnyang-backup"), "PRISTINE");  // pristine backup we kept
fs.writeFileSync(path.join(resources, "models", "qwen3-1.7b.gguf"), "GGUF-BYTES");
fs.writeFileSync(path.join(userData, "brain-state.json"), "{}");
fs.writeFileSync(path.join(userData, "hooks", "comnyang-claude-hook.js"), "// copied");

// settings.json: app's OWN keys + OUR keys mixed together
fs.writeFileSync(path.join(userData, "settings.json"), JSON.stringify({
  catName: "Mochi", petSize: 120, pomodoroFocusMin: 25,   // user's — must survive
  brainEnabled: true, brainBackend: "local", feedingEnabled: true,
  feedingHour: 10, feedingMinute: 0, feedingTimeZone: "America/Chicago",
  notifyOnClaudeComplete: true,                            // ours — must be removed
}, null, 2));

// ~/.claude/settings.json: user's own hook + comnyang hooks side by side
fs.writeFileSync(path.join(claudeDir, "settings.json"), JSON.stringify({
  someUserSetting: true,
  hooks: {
    SessionStart: [
      { matcher: "", hooks: [{ type: "command", command: "node /Users/me/myown-hook.js start" }] },
      { matcher: "", hooks: [{ type: "command", command: '/usr/bin/env ELECTRON_RUN_AS_NODE=1 "/Apps/Comnyang.app/Electron" "/u/hooks/comnyang-claude-hook.js" SessionStart' }] },
    ],
    Stop: [
      { matcher: "", hooks: [{ type: "command", command: "node /u/hooks/comnyang-claude-hook.js --comnyang-claude-hook Stop" }] },
    ],
  },
}, null, 2));

// ~/.cursor/hooks.json: only a comnyang hook
fs.writeFileSync(path.join(cursorDir, "hooks.json"), JSON.stringify({
  version: 1,
  hooks: { beforeSubmitPrompt: [{ command: "node /u/hooks/comnyang-cursor-hook.js --comnyang-cursor-hook beforeSubmitPrompt" }] },
}, null, 2));

// ~/.gemini/config/hooks.json: comnyang's dedicated block + another plugin
fs.writeFileSync(path.join(geminiDir, "hooks.json"), JSON.stringify({
  comnyang: { enabled: true, PreToolUse: [{ type: "command", command: "node /u/hooks/comnyang-antigravity-hook.js --comnyang-antigravity-hook PreToolUse", timeout: 3 }] },
  myPlugin: { enabled: true, PreToolUse: [{ type: "command", command: "node /Users/me/mygemini.js" }] },
}, null, 2));

// --- the manifest the integration would have written ---
const manifest = manifestLib.emptyManifest("0.1.0");
manifest.appAsar = { target: path.join(resources, "app.asar"), backup: path.join(resources, "app.asar.comnyang-backup") };
manifest.addedFiles = [path.join(resources, "models", "qwen3-1.7b.gguf")];
manifest.addedDirs = [path.join(resources, "models")];
manifest.settingsFile = path.join(userData, "settings.json");
manifest.settingsKeysAdded = ["brainEnabled", "brainBackend", "feedingEnabled", "feedingHour", "feedingMinute", "feedingTimeZone", "notifyOnClaudeComplete"];
manifest.userDataDelete = [path.join(userData, "brain-state.json"), path.join(userData, "hooks")];
manifest.devToolHookFiles = [
  { path: path.join(claudeDir, "settings.json"), backup: null, markers: ["--comnyang-claude-hook", "comnyang-claude-hook.js"] },
  { path: path.join(cursorDir, "hooks.json"), backup: null, markers: ["--comnyang-cursor-hook", "comnyang-cursor-hook.js"] },
  { path: path.join(geminiDir, "hooks.json"), backup: null, markers: ["--comnyang-antigravity-hook", "comnyang-antigravity-hook.js"], removeKeys: ["comnyang"] },
];
manifestLib.save(userData, manifest);

// --- run it ---
const report = factoryReset({ userDataDir: userData });

// --- assertions ---
const settings = JSON.parse(fs.readFileSync(path.join(userData, "settings.json"), "utf8"));
const claude = JSON.parse(fs.readFileSync(path.join(claudeDir, "settings.json"), "utf8"));
const cursor = JSON.parse(fs.readFileSync(path.join(cursorDir, "hooks.json"), "utf8"));
const gemini = JSON.parse(fs.readFileSync(path.join(geminiDir, "hooks.json"), "utf8"));

const checks = [];
function check(name, cond) { checks.push([name, !!cond]); assert.ok(cond, "FAILED: " + name); }

// code restored
check("app.asar restored to pristine", fs.readFileSync(path.join(resources, "app.asar"), "utf8") === "PRISTINE");
check("app.asar backup removed", !fs.existsSync(path.join(resources, "app.asar.comnyang-backup")));
// added files gone
check("model file deleted", !fs.existsSync(path.join(resources, "models", "qwen3-1.7b.gguf")));
check("empty models dir removed", !fs.existsSync(path.join(resources, "models")));
// settings: ours gone, theirs intact
check("our key brainEnabled removed", !("brainEnabled" in settings));
check("our key notifyOnClaudeComplete removed", !("notifyOnClaudeComplete" in settings));
check("user key catName preserved", settings.catName === "Mochi");
check("user key petSize preserved", settings.petSize === 120);
// userData artifacts gone
check("brain-state.json deleted", !fs.existsSync(path.join(userData, "brain-state.json")));
check("copied hooks dir deleted", !fs.existsSync(path.join(userData, "hooks")));
// claude: comnyang stripped, user's own hook kept
check("claude SessionStart keeps user's own hook", claude.hooks.SessionStart.length === 1 &&
  claude.hooks.SessionStart[0].hooks[0].command.includes("myown-hook.js"));
check("claude Stop emptied of comnyang", claude.hooks.Stop.length === 0);
check("claude someUserSetting preserved", claude.someUserSetting === true);
// cursor: comnyang stripped
check("cursor beforeSubmitPrompt emptied", cursor.hooks.beforeSubmitPrompt.length === 0);
check("cursor version preserved", cursor.version === 1);
// gemini: comnyang block removed entirely, other plugin kept
check("gemini comnyang block removed", !("comnyang" in gemini));
check("gemini myPlugin preserved", gemini.myPlugin && gemini.myPlugin.PreToolUse.length === 1);
// manifest gone
check("manifest deleted", !manifestLib.load(userData));

console.log("Factory reset report:");
console.log("  restored:", report.restored.length, "| deleted:", report.deleted.length,
            "| settings keys cleaned:", report.settingsCleaned.length, "| hook entries removed:", report.hooksRemoved);
console.log("  errors:", report.errors.length ? report.errors : "none");
console.log("");
for (const [name, ok] of checks) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
console.log(`\n${checks.every((c) => c[1]) ? "ALL " + checks.length + " CHECKS PASSED ✅" : "SOME CHECKS FAILED ❌"}`);

fs.rmSync(root, { recursive: true, force: true });
process.exit(checks.every((c) => c[1]) ? 0 : 1);
