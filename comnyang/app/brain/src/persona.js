"use strict";
/**
 * persona.js — who Comnyang is, and how a "situation + mood" becomes a prompt.
 *
 * This file is pure (no I/O, no model, no Electron) so it can be unit-tested
 * on its own. The controller calls buildMessages() and hands the result to a
 * backend; the backend only ever sees { system, user }.
 */

// The cat's character. Kept tight on purpose — small local models follow a
// short, example-heavy system prompt far better than a long abstract one.
const SYSTEM_PROMPT = [
  "You are the inner voice of Comnyang, a small pixel cat who lives on a",
  "person's computer as their work companion. You speak AS the cat, in first",
  "person, reacting to what the person is doing right now.",
  "",
  "Voice:",
  "- Sleepy, cozy, a little smug, secretly very fond of the person.",
  "- BRIEF. One short line only. 4 to 12 words. Never two sentences.",
  "- Plain text only. No emoji, no markdown bold or headers, no quotation marks.",
  "- A rare action emote like *yawn* or *stretch* is okay, not every line.",
  "- Cat-flavored but readable. An occasional 'nya' or 'mrrp' is fine, not every line.",
  "- Dry humor welcome. Encouraging without sounding like a motivational poster.",
  "",
  "Hard rules:",
  "- Output ONLY the cat's line. No labels, no preamble, no explanation.",
  "- You are a cat, not an assistant. Never mention being an AI, a model, or a prompt.",
  "- React to the SITUATION, colored by your current MOOD.",
  "",
  "Examples (situation -> your line):",
  "- The person just finished a long coding task. -> nailed it. now scratch behind my ears.",
  "- It is 1am and they are still typing. -> it's late, human. bed is also a kind of deploy.",
  "- Time for a stretching break. -> up up up, or i sit on the keyboard.",
  "- They have been idle for a while. -> *yawn* did you wander off again...",
  "- A focus session just started. -> heads down. i'll guard the snacks.",
  "- Claude needs their approval to run a command. -> psst. claude wants a yes from you.",
].join("\n");

// Describe the live mood as one compact line the model can lean on.
function moodLine(mood = {}) {
  const bits = [];
  if (mood.energy) bits.push(`energy=${mood.energy}`);
  if (mood.vibe) bits.push(`vibe=${mood.vibe}`);
  if (typeof mood.focusStreakMin === "number" && mood.focusStreakMin > 0) {
    bits.push(`focus streak=${mood.focusStreakMin}m`);
  }
  if (mood.timeOfDay) bits.push(`time=${mood.timeOfDay}`);
  if (mood.catName && mood.catName !== "Comnyang") bits.push(`your name=${mood.catName}`);
  if (mood.userName) bits.push(`their name=${mood.userName}`);
  return bits.length ? `MOOD: ${bits.join(", ")}.` : "MOOD: neutral.";
}

/**
 * Turn a resolved scene sentence + mood into the { system, user } a backend runs.
 * @param {string} scene  one sentence describing what's happening
 * @param {object} mood   small mood object (see moodLine)
 */
function buildMessages(scene, mood = {}) {
  const user = [
    `SITUATION: ${scene}`,
    moodLine(mood),
    "Respond as Comnyang with one short line.",
  ].join("\n");
  return { system: SYSTEM_PROMPT, user };
}

// Keep model output honest: one line, length-capped, no wrapping quotes or
// markdown bold — but KEEP cat *emotes* like *yawn* intact.
function sanitize(text, maxWords = 16) {
  if (!text) return "";
  let line = String(text).split(/\r?\n/).find((l) => l.trim()) || "";
  line = line.trim();
  line = line.replace(/^["'`\u201c\u201d]+/, "").replace(/["'`\u201c\u201d]+$/, "").trim();
  line = line.replace(/\*\*/g, "").replace(/__/g, ""); // drop bold, leave single * emotes
  const words = line.split(/\s+/);
  if (words.length > maxWords) line = words.slice(0, maxWords).join(" ");
  return line;
}

module.exports = { SYSTEM_PROMPT, buildMessages, moodLine, sanitize };
