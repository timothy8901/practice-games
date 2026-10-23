# Core engine contract (design-agnostic modules)

These modules are the foundation every game system will build on. They know NOTHING about the game's
content. Each lives in `js/core/<name>.js`, is an ES module, exports exactly the API below (you may add
extra helpers), and must not touch `document`/`window` at import time unless marked BROWSER-ONLY, so that
Node can import the pure ones for unit tests (`node --test test/<name>.test.mjs`). Style: modern JS, no
dependencies, JSDoc on every export, small focused functions, no globals. Every module ships with a test.

Native display: 480x270 logical pixels, 16x16 tiles, integer upscale with letterbox (option: fractional
"fit" scaling). Everything draws with `imageSmoothingEnabled = false`.

## rng.js (pure)
- `hashString(str) -> uint32`
- `makeRng(seed: number|string) -> Rng` deterministic (xoshiro128** or sfc32 seeded via hash).
  Rng: `next()` [0,1); `int(min,max)` inclusive; `chance(p)`; `pick(arr)`; `shuffle(arr)` (copy);
  `weighted(entries: Array<{w:number, v:any}>) -> v`; `fork(label: string) -> Rng` (independent sub-stream
  derived from this seed + label, NOT from the current state, so forks are stable); `state() -> array`;
  `restore(state)`; `gaussian(mean, sd)`.
- `encodeSeedCode({dial: string, seed: number, toggles: string[]}) -> "FLUX-K7Q2-MD7F"` style code
  (dial word + 2 groups of 4 base-32 chars, no ambiguous letters) and `decodeSeedCode(code) -> {dial, seed,
  toggles} | null`. Round-trips. `randomSeedCode(dial, entropyRng?)`.

## events.js (pure)
- `createBus() -> {on(evt, fn) -> off, once, off, emit(evt, ...args), clear()}`.

## font.js (pure data + canvas drawing)
A bitmap pixel font embedded in code (no external assets): 5x7 main glyphs (ASCII 32-126) plus a 3x5 small
font for numbers/labels, plus symbols: ◉ (button/coin), ✦ (Heartmark sparkle), ♥, ★, ☾, ☀, ▲ ▼ ◀ ▶,
↑ ↓ ← →, … and accented vowels (é è ê á à ü ö ñ). Encode glyphs as string rows.
- `measureText(text, {font='main', scale=1}) -> {w, h}`
- `wrapText(text, maxWidthPx, opts) -> string[]`
- `drawText(ctx, text, x, y, {font, scale, color, align: 'left'|'center'|'right', shadow, outline,
  maxWidth, letterSpacing})` draws via a cached glyph atlas (OffscreenCanvas or canvas), tinted per colour.
- `drawTextTyped(ctx, text, x, y, visibleChars, opts)` for typewriter effects.
- Pure helpers must not require a canvas at import time; atlas creation is lazy (BROWSER when drawn).

## pixelart.js (pure decode + lazy canvas)
Hand-encoded sprites: `rows: string[]` where each char indexes a palette `{char: '#rrggbb' | null}`
('.' or ' ' = transparent). Provide:
- `decodeSprite(rows, palette, {flipX, flipY, scale, outline: color|null, tint: {color, amount}}) ->
  Sprite` where Sprite = `{w, h, canvas, rows, palette}`; results are cached by a key.
- `drawSprite(ctx, sprite, x, y, {flipX, alpha, scale})`.
- `paletteSwap(sprite, mapping)`, `silhouette(sprite, color)` (for unseen Forecast forms),
  `outlineSprite(sprite, color)`.
- `makePattern(rows, palette)` for tile fills; `recolorHSL(color, dH, dS, dL)` colour math helper;
  `lerpColor(a, b, t)`; `hexToRgb`, `rgbToHex`.
- `buildAtlas(sprites[]) -> {canvas, frames}` optional.

## canvas.js (BROWSER-ONLY)
- `createDisplay({width: 480, height: 270, parent: HTMLElement, mode: 'integer'|'fit'}) -> Display` where
  Display = `{canvas (visible), ctx (of an offscreen 480x270 buffer), present(), resize(), scale, offsetX,
  offsetY, toGame(clientX, clientY) -> {x, y}, setMode(mode)}`. Draw into `ctx`; `present()` blits to the
  visible canvas at integer scale with letterbox bars. Handles devicePixelRatio. Dispatches 'resize' via
  a callback.

## input.js (BROWSER-ONLY)
Action-based input with keyboard, gamepad and touch.
- Actions: `up down left right confirm cancel menu run tool map log start select l r` plus `anyKey`.
- Default bindings: arrows/WASD move; Z/Enter/Space confirm; X/Esc/Backspace cancel; Enter/Esc also menu
  (Esc = menu when not in a menu); Shift = run; C = tool ring; M = map; Tab = log; P = pause; `[`/`]` = l/r.
  Gamepad standard mapping. Touch: an on-screen d-pad (left) and A/B/menu buttons (right), shown only on
  touch devices or when `?touch=1`, drawn as DOM elements so they stay crisp.
- API: `createInput({canvas, display}) -> Input` with `update()` (call once per frame; latches pressed /
  released), `pressed(action)`, `held(action)`, `released(action)`, `axis() -> {x, y}` (-1..1 digital
  from held dirs), `repeat(action, {delay, rate})` (menu auto-repeat), `flush()` (discard buffered presses
  — call on every scene change and menu open), `rebind(action, key)`, `bindings()`, `resetBindings()`,
  `loadBindings(json)`, `saveBindings() -> json`, `pointer -> {x, y, down, justDown, justUp}` in game
  coords, `lastDevice -> 'keyboard'|'gamepad'|'touch'`, `vibrate(ms)`.
- Never let a held key at scene entry count as a press (edge-triggered + flush).

## audio.js (BROWSER-ONLY, lazy)
Procedural WebAudio engine. Nothing plays until `audio.unlock()` is called from a user gesture.
- `audio.unlock()`, `audio.ready`, `audio.setVolume({master, music, sfx})`, `audio.getVolume()`,
  `audio.mute(bool)`, `audio.isMuted()`.
- SFX synth library: `audio.sfx(name, {pitch, volume, pan})` for at least: `blip, confirm, cancel, error,
  step, stepWater, shake, fruitDrop, coin, purse, splash, bite, catchFish, dig, crack, thwap (tail
  slap), bell, lantern, capture, captureFail, hit, hitStrong, hitWeak, blocked, heal, levelUp, shiftFlip,
  shiftReveal, letter, doorOpen, textTick, toast, wave, rain, thunder, firefly, night, dawn, stamp,
  achievement`. Each is synthesized (oscillators + noise + envelopes + filters); no samples.
- Music: a step sequencer. `audio.defineTrack(id, {bpm, key, scale, bars, layers: {name: pattern}})`,
  `audio.playMusic(id, {fade: ms})` (crossfades), `audio.stopMusic({fade})`, `audio.setStem(name, on)`
  (toggle layers such as `night`, `tide`, `rain`, `battle`), `audio.setMusicParam({intensity})`,
  `audio.nowPlaying()`. Patterns: arrays of `{t: stepIndex, n: midiNote|chord[], d: steps, v: velocity}`
  per layer, with instrument presets (`pluck, pad, bass, bell, flute, kick, hat, snare, marimba, glass`).
  Provide ONE demo track and the sfx bank; the game composer will add the hourly themes later.
- Expose a `audio.analyser` for visualizers (optional).

## save.js (pure logic + storage adapter)
- `createSaveSystem({storage = localStorage-like, prefix, autosaveSlots = 3, manualSlots = 3, version})`
  -> `{save(slot, data) -> {ok, error?}, load(slot) -> {ok, data?, error?}, list() -> [{slot, kind, time,
  summary}], remove(slot), autosave(data) -> rotates through autosave slots, latest() -> newest of any
  slot, exportString(slot) -> base64 string with checksum, importString(str) -> {ok, data|error},
  migrate(data)}`.
- Verified writes: serialize → checksum (FNV-1a or crc32) → write to a temp key → read back → verify →
  swap into the real key. Return a structured error on any failure; never throw on quota errors.
- Storage adapter so Node tests can use an in-memory Map.

## scene.js (pure)
- `createSceneStack() -> {push(scene, params), pop(result), replace(scene, params), top(), stack,
  update(dt), draw(ctx), transition(kind: 'fade'|'iris'|'wipe'|'none', ms, fn)}`.
- Scene interface: `{name, enter(params), exit(), resume(result), pause(), update(dt), draw(ctx),
  handleInput(input), opaque: boolean}` where non-opaque scenes let the scenes below draw (modals).
- Transitions are drawn by the stack on top of everything; input is ignored during a transition.

## tween.js + fx.js (pure logic, draw on demand)
- `ease` object: linear, inQuad, outQuad, inOutQuad, outCubic, inOutCubic, outBack, outElastic, outBounce.
- `createTweens() -> {to(obj, props, ms, {ease, delay, onDone}), update(dt), clear(), count}`.
- `createFX() -> {particles(spec), shake(amount, ms), flash(color, ms), update(dt), draw(ctx),
  cameraOffset()}` with particle emitters (fireflies, sparkles, splash drops, leaves, dust, rain, snow,
  motes, confetti) defined as pure data presets.

## time.js (pure)
World clock for an accelerated day.
- `createClock({minutesPerDay: 24, realClock: false, startDay: 0, startMinute: 18*60+40, seed})` ->
  `{update(realDt), minute (0..1439 float), hour, day, dayOfWeek (0=Mon), season, year, phase ->
  'night'|'dawn'|'morning'|'midday'|'afternoon'|'dusk'|'evening', isNight, tide -> 0..1 (0 = low, 1 =
  high), tideState -> 'low'|'rising'|'high'|'falling', isLowTide (tide < 0.2), nextLowTide -> minutes
  until, tidesToday -> [{minute, kind}], setSpeed(mult), pause(), resume(), skipTo(minute) (debug only),
  onHour(fn), onMinute(fn), onDayStart(fn), onTideChange(fn), serialize(), restore(state), formatTime(),
  dateLabel()}`.
- Tide model: semi-diurnal, period 12h25m in-game, so lows drift ~50 min later each day; guarantee that
  any 12.5-hour window has a low. Spring tide every ~14 days (`isSpringTide`).
- Real-clock mode maps the actual local time to the in-game minute and day.
