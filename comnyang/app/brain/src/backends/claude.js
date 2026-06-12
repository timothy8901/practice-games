"use strict";
/**
 * claude backend — the "Anthropic flavour" option.
 *
 * Anthropic does not ship open weights, so there is no Claude you can run
 * through llama.cpp. If you want the cat to *think with Claude*, the move is
 * the cloud Messages API with the lite model — Haiku — which is fast and cheap
 * enough for one-liners. This needs a network call and an API key, so it is the
 * opposite trade-off from the local backend: better personality, not offline,
 * not free.
 *
 * Uses plain fetch (no SDK needed). Set ANTHROPIC_API_KEY in the environment:
 *   ANTHROPIC_API_KEY=sk-ant-... node test/harness.js --backend claude
 *
 * NOTE: a desktop app should never hardcode or ship a key. If you ever wire
 * this into Comnyang, proxy through your own backend or have the user paste
 * their key into the existing license-style settings window.
 */

const DEFAULT_MODEL = "claude-haiku-4-5"; // lite/fast Claude; check docs for the current id

function createClaudeBackend({ apiKey, model = DEFAULT_MODEL } = {}) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY || "";

  return {
    name: "claude",

    async init() {
      if (!key) throw new Error("claude backend requires ANTHROPIC_API_KEY");
      return { model };
    },

    async generate(system, user, opts = {}) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: opts.maxTokens ?? 40,
          temperature: opts.temperature ?? 0.9,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`claude api ${res.status}: ${detail.slice(0, 200)}`);
      }
      const data = await res.json();
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ");
      return text;
    },

    async dispose() {},
  };
}

module.exports = { createClaudeBackend, DEFAULT_MODEL };
