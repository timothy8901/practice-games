# Comnyang Brain (prototype)

A pluggable "brain" that lets the Comnyang desktop cat react to what you're doing
with short, in-character lines. **This is standalone — it does not touch the cat
app.** When you're happy with it, `INTEGRATION.md` shows the exact wiring.

## Run it right now (no model, no keys)

```bash
node test/harness.js            # mock backend — instant, zero dependencies
```

You'll see the cat react to a scripted work session (opens laptop → 10am breakfast
→ focus block → Claude finishes a task → break → stretch → reminder → idle → late
night). Lines marked 🔔 are the ones that would also raise an OS notification.

Two more standalone tests (no deps, no app):

```bash
node test/scheduler-test.js        # prove the 10am-Chicago feeding time is DST-correct
node test/factory-reset-test.js    # prove a full mod-removal restores stock Comnyang
```

## Architecture (3 pieces, as discussed)

- **`src/brain-worker.js`** — runs in a *separate process* (Electron
  `utilityProcess.fork` inside the app, `child_process.fork` here) so model loading
  and token generation never block the cat's animation loop or the global input hook.
- **`src/brain-controller.js`** — the main-process side. Owns the mood, turns a
  situation into a prompt, enforces cooldowns + a single-in-flight guard, and times
  out slow generations so `react()` **always** returns something in character fast.
- **`src/persona.js` + `src/situations.js`** — pure, testable. The cat's voice and
  the catalog of triggers, each mapped to an event the app already emits.

Backends are swappable behind one tiny contract (`init` / `generate` / `dispose`):
`mock` (default), `local` (node-llama-cpp), `claude` (Anthropic API).

## Which model? (the honest version)

You asked about a "lite Anthropic model." Anthropic doesn't release open weights —
there is **no Claude you can run locally** through llama.cpp / node-llama-cpp. So
this prototype gives you both realistic options and lets you switch with one flag:

### Option A — Local & offline (recommended default): `Qwen3 1.7B`
- **Why:** tiny (~1–1.4 GB at Q4_K_M), genuinely good at short persona/structured
  output, and **Apache-2.0** — the cleanest license for a paid app like Comnyang.
- Runs fast on Apple Silicon (Metal) and is fine CPU-only on low-end Windows for
  one-liners. Get a GGUF build, then:
  ```bash
  npm install node-llama-cpp
  node test/harness.js --backend local --model ./models/qwen3-1.7b-instruct-q4_k_m.gguf
  ```
- **Ultra-light alternative:** `Gemma 3 1B` (even smaller; check the Gemma license
  terms for commercial use). **Step up:** `Qwen3 4B` or `Gemma 3 4B` if you want more
  coherence and can spend the RAM/size.

### Option B — Cloud, "Anthropic flavour": `Claude Haiku`
- The lite/fast/cheap Claude (currently `claude-haiku-4-5`), via the Messages API.
  Best personality, but it needs a network call and an API key, and it isn't free.
  ```bash
  ANTHROPIC_API_KEY=sk-ant-... node test/harness.js --backend claude
  ```
- Never ship a key in a desktop app. Proxy through your own endpoint, or have the
  user paste their key into the existing license-style settings window.

**Suggested setup:** ship `local` (Qwen3 1.7B) as the default offline brain, and
offer `claude` as an opt-in "smarter brain" toggle for users who want it. The
controller already treats the backend as pluggable, so this is a config choice.

> Model landscape note (mid-2026): the small-model tier moves fast (Qwen3, Gemma 3,
> Phi-4-mini, Llama 3.2 1B/3B are all viable). Sizes/names above were current at
> build time — re-check before you commit, and prefer Apache-2.0 / MIT for a paid app.

## Files
```
src/persona.js            cat voice + prompt builder + output sanitizer
src/situations.js         trigger catalog mapped to the app's real events
src/scheduler.js          DST-correct daily scheduler (10am Chicago feeding)
src/backends/mock.js      no-dep stand-in (default)
src/backends/local.js     node-llama-cpp (GGUF, Metal/CPU)
src/backends/claude.js    Claude Haiku via fetch
src/backends/index.js     backend factory
src/brain-worker.js       separate-process model runner
src/brain-controller.js   spawn + mood + cooldowns + timeout + fallback
src/install-manifest.js   records what the mods change + backs up app.asar
src/factory-reset.js      reverses every change → stock Comnyang, in 3 clicks
test/harness.js           standalone end-to-end demo
test/scheduler-test.js    timezone/DST checks for the feeding time
test/factory-reset-test.js  proves a full mod-removal restores stock app
INTEGRATION.md            exact wiring + feeding + factory reset + signed-build notes
```

## What's in here now
- **Brain**: reactive one-liners on the events the app already emits.
- **Feeding**: a DST-correct daily trigger (10:00 America/Chicago) → `feeding_time`
  line + `do-eat` animation hook.
- **Factory reset**: one tray action (3 clicks) that restores the original
  `app.asar`, removes every file/setting/hook we added, and cleans Comnyang's
  entries out of Claude / Cursor / Gemini — without touching your own settings.
