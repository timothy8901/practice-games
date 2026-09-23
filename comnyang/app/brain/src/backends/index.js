"use strict";
/**
 * Backend factory. The worker calls createBackend(config) and then backend.init().
 * Every backend implements the same tiny contract:
 *
 *   name: string
 *   async init() -> info object (throws if it can't start)
 *   async generate(system, user, opts) -> string
 *   async dispose() -> void
 */

const { createMockBackend } = require("./mock");
const { createLocalBackend } = require("./local");
const { createClaudeBackend } = require("./claude");

function createBackend(config = {}) {
  switch ((config.backend || "mock").toLowerCase()) {
    case "local":
      return createLocalBackend(config);
    case "claude":
      return createClaudeBackend(config);
    case "mock":
    default:
      return createMockBackend();
  }
}

module.exports = { createBackend };
