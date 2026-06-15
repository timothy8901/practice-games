"use strict";
/**
 * local backend — runs a small GGUF model on-device via node-llama-cpp.
 *
 * node-llama-cpp v3 is ESM-only, so we load it with a dynamic import() from
 * this CommonJS file. It builds against llama.cpp and uses Metal on Apple
 * Silicon, CUDA/Vulkan on Windows, and CPU everywhere as a fallback.
 *
 * Install when you're ready to test for real:
 *   npm install node-llama-cpp
 * and download a GGUF (see README for the model recommendation), then:
 *   node test/harness.js --backend local --model /path/to/model.gguf
 *
 * The model + context are loaded ONCE. Each reaction creates a throwaway
 * sequence so generations stay stateless and snappy (no history bleed).
 */

function createLocalBackend({ modelPath, contextSize = 2048, threads } = {}) {
  let llama = null;
  let model = null;
  let context = null;
  // Qwen3 is a reasoning model: it prefixes replies with a <think> block unless
  // told not to. "/no_think" is Qwen3's documented soft switch.
  const isQwen3 = /qwen3/i.test(String(modelPath || ""));

  return {
    name: "local",

    async init() {
      if (!modelPath) throw new Error("local backend requires a --model path to a .gguf file");
      const mod = await import("node-llama-cpp"); // ESM dynamic import from CJS
      const { getLlama, LlamaChatSession } = mod;
      llama = await getLlama();
      model = await llama.loadModel({ modelPath });
      context = await model.createContext({ contextSize, threads });
      // stash the session class for generate()
      this._LlamaChatSession = LlamaChatSession;
      return { model: modelPath, gpu: llama.gpu || "cpu" };
    },

    async generate(system, user, opts = {}) {
      if (!context) throw new Error("local backend not initialized");
      const sequence = context.getSequence();
      try {
        const session = new this._LlamaChatSession({
          contextSequence: sequence,
          systemPrompt: isQwen3 ? `${system}\n/no_think` : system,
        });
        // No "\n" stop trigger: reasoning models open with a <think> block and
        // a newline stop would truncate inside it. Cap tokens and post-process
        // down to the first real line instead.
        const promptOpts = {
          maxTokens: opts.maxTokens ?? 96,
          temperature: opts.temperature ?? 0.85,
          topP: opts.topP ?? 0.9,
        };
        let text;
        try {
          // node-llama-cpp >= 3.10: spend zero tokens on thought segments
          text = await session.prompt(user, { ...promptOpts, budgets: { thoughtTokens: 0 } });
        } catch {
          text = await session.prompt(user, promptOpts);
        }
        const line = String(text)
          .replace(/<think>[\s\S]*?(<\/think>|$)/g, "")
          .split("\n").map((l) => l.trim()).find(Boolean);
        return line || "";
      } finally {
        // dispose the sequence so the next reaction starts clean
        try { sequence.dispose(); } catch { /* older versions: no-op */ }
      }
    },

    async dispose() {
      try { await context?.dispose?.(); } catch {}
      try { await model?.dispose?.(); } catch {}
      context = model = llama = null;
    },
  };
}

module.exports = { createLocalBackend };
