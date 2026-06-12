"use strict";
/**
 * situations.js — the catalog of things the cat can react to.
 *
 * Every key maps to ONE of the events Comnyang's main.js already produces or
 * will produce, so wiring later is a one-liner per event:
 *
 *   app event                      -> situation key
 *   ------------------------------    ----------------------
 *   did-finish-load (first show)   -> app_start
 *   onKeyPressed (rapid burst)     -> typing_burst   (rare; heavy cooldown)
 *   idle timer (no input N min)    -> idle           (ties to future idle anims)
 *   pomodoro-focus-start           -> pomodoro_focus_start
 *   pomodoro-complete (focus end)  -> pomodoro_break
 *   do-stretch / stretch interval  -> break_stretch  (ties to future stretch anims)
 *   reminder-triggered             -> reminder
 *   ai-task-complete               -> claude_task_complete   <-- the headline one
 *   ai-task-notification           -> claude_needs_input
 *   ai-task-state {state:"error"}  -> claude_error
 *   (time of day, computed)        -> late_night
 *
 * Each entry has:
 *   scene(vars)  -> sentence handed to the model
 *   fallbacks    -> canned lines used if the model is slow/offline/disabled
 *   cooldownMs   -> minimum gap before this situation may fire again
 *   notify       -> hint that this is worth an OS notification when integrated
 */

const SITUATIONS = {
  app_start: {
    cooldownMs: 0,
    notify: false,
    scene: () => "The person just opened their computer and you woke up on the desktop.",
    fallbacks: ["morning, human. or whenever this is.", "i'm awake. mostly.", "back to it then, nya."],
  },

  typing_burst: {
    // Fires only on a *sustained* fast burst, and rarely — never per keystroke.
    cooldownMs: 90_000,
    notify: false,
    scene: () => "The person is typing very fast, clearly in the zone.",
    fallbacks: ["look at those little paws go.", "flow state detected. i approve.", "fast fingers today, nya."],
  },

  idle: {
    cooldownMs: 120_000,
    notify: false,
    scene: () => "The person has been idle for a while with no typing or clicking.",
    fallbacks: ["*yawn* did you wander off?", "i'll keep your seat warm.", "nap-watch engaged."],
  },

  pomodoro_focus_start: {
    cooldownMs: 0,
    notify: false,
    scene: ({ focusMin } = {}) =>
      `A ${focusMin || 25} minute focus session just started.`,
    fallbacks: ["heads down. i'll guard the snacks.", "focus mode. i'm watching.", "okay. let's cook."],
  },

  pomodoro_break: {
    cooldownMs: 0,
    notify: true,
    scene: ({ focusMin } = {}) =>
      `A focus session just ended after ${focusMin || 25} minutes. Break time.`,
    fallbacks: ["you earned a break. stand up.", "session done. go drink water.", "break time, nya. i mean it."],
  },

  break_stretch: {
    cooldownMs: 0,
    notify: true,
    scene: () => "It is time for a stretching break and you are stretching too.",
    fallbacks: ["up up up, or i sit on the keyboard.", "stretch with me, human.", "long cat says: reach for the sky."],
  },

  reminder: {
    cooldownMs: 0,
    notify: true,
    scene: ({ text } = {}) =>
      `A reminder just went off${text ? `: "${text}"` : ""}.`,
    fallbacks: ["reminder! you asked me to nag.", "psst, you wanted me to remind you.", "ping. don't forget this one."],
  },

  // --- AI coding tool reactions (the reason this is fun) ---

  claude_task_complete: {
    cooldownMs: 8_000,
    notify: true,
    scene: ({ durationMin, project } = {}) => {
      const where = project ? ` in ${project}` : "";
      const how = durationMin ? ` after about ${durationMin} minutes` : "";
      return `Claude just finished a task${where}${how}. It worked.`;
    },
    fallbacks: ["nailed it. now scratch behind my ears.", "claude's done. go check the diff.", "task complete. we are so back."],
  },

  claude_needs_input: {
    cooldownMs: 5_000,
    notify: true,
    scene: ({ agent } = {}) =>
      `${agent || "Claude"} is waiting and needs the person to approve or answer something.`,
    fallbacks: ["psst. claude wants a yes from you.", "it's waiting on you, human.", "tap tap. approval needed."],
  },

  claude_error: {
    cooldownMs: 8_000,
    notify: true,
    scene: ({ agent } = {}) => `${agent || "Claude"} hit an error and stopped.`,
    fallbacks: ["uh oh. something went red.", "it tripped. go take a look.", "error. happens to the best of us."],
  },

  late_night: {
    cooldownMs: 1_800_000, // 30 min — gentle, not naggy
    notify: false,
    scene: () => "It is very late at night and the person is still working.",
    fallbacks: ["it's late, human. bed is also a kind of deploy.", "the bugs will still be here tomorrow.", "*yawn* one more, then sleep?"],
  },

  feeding_time: {
    // Fired by the daily scheduler at 10:00 America/Chicago. Pairs with the
    // 'do-eat' eating animation (see INTEGRATION.md).
    cooldownMs: 0,
    notify: true,
    scene: () => "It is 10am, your breakfast time, and you are eating your kibble.",
    fallbacks: ["*munch munch* breakfast is sacred.", "10am. kibble o'clock, nya.", "don't watch me eat, human.", "*crunch* this is the good stuff."],
  },
};

function get(key) {
  return SITUATIONS[key] || null;
}

function pickFallback(key) {
  const s = get(key);
  if (!s || !s.fallbacks.length) return "nya.";
  return s.fallbacks[Math.floor(Math.random() * s.fallbacks.length)];
}

module.exports = { SITUATIONS, get, pickFallback };
