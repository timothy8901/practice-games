"use strict";
/**
 * harness.js — run the cat brain end to end WITHOUT Electron or the app.
 *
 *   node test/harness.js                          # mock backend (no deps, instant)
 *   node test/harness.js --backend local --model ./models/qwen3-1.7b-q4.gguf
 *   ANTHROPIC_API_KEY=sk-ant-... node test/harness.js --backend claude
 *
 * It spins up the real controller + worker process, sets a mood, then fires a
 * scripted sequence of situations a real work session would produce, printing
 * what the cat says (and whether each line would raise an OS notification).
 */

const { BrainController } = require("../src/brain-controller");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

// A scripted "work session": [situationKey, vars, label]
const SCRIPT = [
  ["app_start", {}, "opens laptop"],
  ["feeding_time", {}, "10am Chicago: breakfast"],
  ["pomodoro_focus_start", { focusMin: 25 }, "starts a focus block"],
  ["typing_burst", {}, "types fast"],
  ["claude_task_complete", { durationMin: 12, project: "viewsfeed-api" }, "Claude finishes a task"],
  ["claude_needs_input", { agent: "Claude" }, "Claude asks for approval"],
  ["pomodoro_break", { focusMin: 25 }, "focus block ends"],
  ["break_stretch", {}, "stretch break"],
  ["reminder", { text: "back up the supabase instance" }, "a reminder fires"],
  ["claude_error", { agent: "Cursor" }, "an agent errors"],
  ["idle", {}, "wanders off"],
  ["late_night", {}, "still up at 1am"],
];

async function main() {
  const backend = arg("backend", "mock");
  const brain = new BrainController({
    backend,
    modelPath: arg("model", null),
    timeoutMs: backend === "local" ? 20000 : 5000, // first local token can be slow
  });

  brain.on("ready", (info) => console.log(`\n[brain] backend=${backend} ready`, info, "\n"));
  brain.on("backend-error", (m) => console.log(`[brain] backend failed to start: ${m}\n(falling back to canned lines)\n`));

  await brain.start();

  // give it a cozy late-evening mood for flavour
  brain.setMood({ energy: "low", vibe: "cozy", timeOfDay: "evening", focusStreakMin: 42, userName: "Tim" });

  for (const [key, vars, label] of SCRIPT) {
    // bypass cooldowns in the demo so every beat prints
    brain._lastFiredAt = 0;
    brain._lastBySituation.clear();
    const line = await brain.react(key, vars);
    const sit = require("../src/situations").get(key);
    const bell = sit && sit.notify ? " 🔔" : "";
    console.log(`• ${label.padEnd(28)} ${line ? `Comnyang: "${line}"${bell}` : "(silent)"}`);
  }

  console.log("");
  await brain.stop();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
