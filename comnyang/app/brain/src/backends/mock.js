"use strict";
/**
 * mock backend — zero dependencies, instant. Lets you exercise the entire
 * pipeline (situations -> persona -> backend -> controller cooldowns -> output)
 * without downloading a model or setting an API key.
 *
 * It does light keyword matching on the user prompt so the output visibly
 * tracks the situation, proving the prompt actually reached the backend.
 */

const POOLS = {
  complete: ["nailed it, human.", "task done. we are so back.", "another one bites the dust, nya."],
  approve: ["psst. it wants a yes from you.", "tap tap, approval needed.", "it's waiting on you."],
  error: ["uh oh, something went red.", "it tripped. go look.", "errors happen, breathe."],
  stretch: ["up up up, stretch with me.", "long cat reaches for the sky.", "off the chair, human."],
  break: ["you earned this. stand up.", "go drink water, nya.", "break time, i mean it."],
  focus: ["heads down. i've got the snacks.", "focus mode, i'm watching.", "okay, let's cook."],
  idle: ["*yawn* did you wander off?", "keeping your seat warm.", "nap-watch engaged."],
  late: ["it's late, human. sleep counts.", "the bugs wait till tomorrow.", "one more, then bed?"],
  reminder: ["reminder! you asked me to nag.", "ping, don't forget this one.", "psst, you wanted reminding."],
  feeding: ["*munch munch* breakfast is sacred.", "kibble o'clock, nya.", "*crunch* don't watch me eat."],
  wake: ["morning, or whenever this is.", "i'm awake, mostly.", "back to it, nya."],
  generic: ["mrrp.", "i'm here.", "carry on, human."],
};

function classify(user) {
  const t = String(user || "").toLowerCase();
  if (t.includes("finished a task") || t.includes("it worked")) return "complete";
  if (t.includes("approve") || t.includes("waiting")) return "approve";
  if (t.includes("error")) return "error";
  if (t.includes("stretch")) return "stretch";
  if (t.includes("break time") || t.includes("session just ended")) return "break";
  if (t.includes("focus session just started")) return "focus";
  if (t.includes("breakfast time") || t.includes("kibble")) return "feeding";
  if (t.includes("reminder just went off")) return "reminder";
  if (t.includes("idle")) return "idle";
  if (t.includes("late at night")) return "late";
  if (t.includes("woke up") || t.includes("just opened")) return "wake";
  return "generic";
}

function createMockBackend() {
  return {
    name: "mock",
    async init() {
      return { model: "mock", note: "no model loaded" };
    },
    async generate(_system, user /*, opts */) {
      const pool = POOLS[classify(user)] || POOLS.generic;
      // tiny latency so timeouts/race handling are exercised realistically
      await new Promise((r) => setTimeout(r, 15));
      return pool[Math.floor(Math.random() * pool.length)];
    },
    async dispose() {},
  };
}

module.exports = { createMockBackend };
