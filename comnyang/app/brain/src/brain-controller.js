"use strict";
/**
 * brain-controller.js — the main-process side of the cat brain.
 *
 * Responsibilities:
 *   - spawn and supervise the worker process (Electron utilityProcess if
 *     available, else child_process.fork so it also runs under plain Node)
 *   - own the live MOOD and turn a situation key into { system, user }
 *   - enforce cooldowns + a single-in-flight guard so the cat never spams
 *   - time out slow generations and fall back to a canned line, so react()
 *     ALWAYS resolves fast with something in character
 *
 * Public API:
 *   const brain = new BrainController({ backend:"local", modelPath, timeoutMs });
 *   await brain.start();
 *   const line = await brain.react("claude_task_complete", { durationMin: 12 });
 *   brain.setMood({ energy:"low", vibe:"cozy", timeOfDay:"late night" });
 *   await brain.stop();
 *
 * react() resolves to a string to show in the cat's bubble, or null when the
 * situation is on cooldown / suppressed (caller just shows nothing).
 */

const path = require("path");
const { EventEmitter } = require("events");
const persona = require("./persona");
const situations = require("./situations");

const WORKER_PATH = path.join(__dirname, "brain-worker.js");

function forkWorker(config) {
  // Prefer Electron's utilityProcess for sandboxing when running inside the app.
  try {
    // eslint-disable-next-line global-require
    const { utilityProcess } = require("electron");
    if (utilityProcess && typeof utilityProcess.fork === "function") {
      const child = utilityProcess.fork(WORKER_PATH, [], { serviceName: "comnyang-brain" });
      return {
        on: (ev, cb) => child.on(ev, cb),
        send: (m) => child.postMessage(m),
        kill: () => child.kill(),
      };
    }
  } catch {
    /* not in Electron — fall through to child_process */
  }
  // eslint-disable-next-line global-require
  const { fork } = require("child_process");
  const child = fork(WORKER_PATH, [], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
  return {
    on: (ev, cb) => child.on(ev, cb),
    send: (m) => child.send(m),
    kill: () => child.kill(),
  };
}

class BrainController extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.config = {
      backend: opts.backend || "mock",
      modelPath: opts.modelPath || opts.model || null,
      apiKey: opts.apiKey || null,
      model: opts.modelId || undefined,
      contextSize: opts.contextSize,
    };
    this.timeoutMs = opts.timeoutMs ?? 4000;
    this.globalCooldownMs = opts.globalCooldownMs ?? 1500; // floor between any two lines
    this.enabled = opts.enabled !== false;

    this.mood = { energy: "neutral", vibe: "cozy", timeOfDay: null, catName: "Comnyang", userName: null };
    this._worker = null;
    this._ready = false;
    this._inFlight = false;
    this._lastFiredAt = 0;
    this._lastBySituation = new Map();
    this._pending = new Map(); // id -> {resolve, timer}
    this._seq = 0;
  }

  start() {
    if (this._worker) return this._readyPromise;
    this._worker = forkWorker(this.config);
    this._readyPromise = new Promise((resolve) => {
      this._worker.on("message", (msg) => this._onMessage(msg, resolve));
      this._worker.on("exit", () => {
        this._ready = false;
        this.emit("exit");
      });
    });
    this._worker.send({ type: "init", config: this.config });
    return this._readyPromise;
  }

  setMood(patch = {}) {
    this.mood = { ...this.mood, ...patch };
  }

  setEnabled(on) {
    this.enabled = !!on;
  }

  /**
   * React to a situation. Returns a line, or null if suppressed/cooldown.
   * Never rejects — on any model failure or timeout it returns a canned line
   * for situations the caller clearly wants spoken (cooldown 0 / notify).
   */
  async react(key, vars = {}) {
    const sit = situations.get(key);
    if (!sit) return null;

    const now = Date.now();
    if (!this.enabled) return null;

    // cooldowns: per-situation AND a global floor between any two utterances
    const lastSit = this._lastBySituation.get(key) || 0;
    if (now - lastSit < (sit.cooldownMs || 0)) return null;
    if (now - this._lastFiredAt < this.globalCooldownMs) return null;

    // one line at a time — the cat shouldn't pile up overlapping thoughts
    if (this._inFlight) return null;

    this._lastBySituation.set(key, now);
    this._lastFiredAt = now;

    const scene = sit.scene(vars);
    const line = await this._generate(scene, key, sit);
    if (line) this.emit("line", { key, line, notify: !!sit.notify, vars });
    return line;
  }

  async _generate(scene, key, sit) {
    const fallback = () => persona.sanitize(situations.pickFallback(key));

    // model not up yet, or no worker → instant canned line
    if (!this._ready) return fallback();

    const { system, user } = persona.buildMessages(scene, this.mood);
    const id = ++this._seq;
    this._inFlight = true;

    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._pending.delete(id);
        resolve(null); // timed out — use fallback below
      }, this.timeoutMs);
      this._pending.set(id, { resolve, timer });
      this._worker.send({ type: "generate", id, system, user, opts: {} });
    }).finally(() => {
      this._inFlight = false;
    });

    const cleaned = persona.sanitize(result || "");
    return cleaned || fallback();
  }

  _onMessage(msg, resolveReady) {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "ready") {
      this._ready = true;
      this.emit("ready", msg.info);
      resolveReady?.(msg.info);
      return;
    }
    if (msg.type === "result" || msg.type === "error") {
      if (msg.type === "error" && msg.fatal) {
        this._ready = false;
        this.emit("backend-error", msg.message);
        resolveReady?.(null);
        return;
      }
      const pending = this._pending.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        this._pending.delete(msg.id);
        pending.resolve(msg.type === "result" ? msg.text : null);
      }
    }
  }

  async stop() {
    if (!this._worker) return;
    try { this._worker.send({ type: "shutdown" }); } catch {}
    setTimeout(() => { try { this._worker.kill(); } catch {} }, 300);
    this._worker = null;
    this._ready = false;
  }
}

module.exports = { BrainController };
