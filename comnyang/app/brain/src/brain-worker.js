"use strict";
/**
 * brain-worker.js — runs in a SEPARATE process so model loading and token
 * generation never block the cat's animation loop or the global input hook.
 *
 * It speaks a tiny message protocol. The same file works in two hosts:
 *   - plain Node child_process.fork  (used by the test harness)
 *   - Electron utilityProcess.fork   (used inside the app — see INTEGRATION.md)
 * The only difference is the message channel, shimmed below.
 *
 * Protocol:
 *   in : { type:"init", config }                 -> out { type:"ready", info } | { type:"error", message }
 *   in : { type:"generate", id, system, user, opts } -> out { type:"result", id, text } | { type:"error", id, message }
 *   in : { type:"shutdown" }                     -> exits
 */

const { createBackend } = require("./backends");

// --- message channel shim (Electron utilityProcess vs child_process) ---
const port = process.parentPort || null;
function onMessage(handler) {
  if (port) port.on("message", (e) => handler(e.data));
  else process.on("message", handler);
}
function send(msg) {
  if (port) port.postMessage(msg);
  else if (process.send) process.send(msg);
}

let backend = null;

onMessage(async (msg) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "init") {
    try {
      backend = createBackend(msg.config || {});
      const info = await backend.init();
      send({ type: "ready", info, backend: backend.name });
    } catch (err) {
      send({ type: "error", fatal: true, message: errMsg(err) });
    }
    return;
  }

  if (msg.type === "generate") {
    if (!backend) {
      send({ type: "error", id: msg.id, message: "backend not initialized" });
      return;
    }
    try {
      const text = await backend.generate(msg.system, msg.user, msg.opts || {});
      send({ type: "result", id: msg.id, text });
    } catch (err) {
      send({ type: "error", id: msg.id, message: errMsg(err) });
    }
    return;
  }

  if (msg.type === "shutdown") {
    try { await backend?.dispose?.(); } catch {}
    process.exit(0);
  }
});

function errMsg(err) {
  return err && err.message ? err.message : String(err);
}

// If the parent dies, don't linger.
process.on("disconnect", () => process.exit(0));
