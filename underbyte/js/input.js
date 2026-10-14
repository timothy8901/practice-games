/*
 * UNDERBYTE — js/input.js
 * Owner: ENGINE ARCHITECT (do not edit from other modules).
 * Contract: CONTRACT.md §4.2 (UB.Input). Design: DESIGN.md §2.
 *
 * Keyboard + gamepad + optional touch, unified into an action map.
 * Every logic frame the engine calls UB.Input.update() ONCE, before any other
 * module reads UB.Input.state. Edges (pressed/released) are latched from the
 * DOM events that arrived since the previous update, so a tap shorter than one
 * logic frame is never lost. Buffered actions get a 6-frame buffer.
 *
 * Nothing here reads wall-clock time; UB.Input.press(action, frames) lets
 * tests drive the game without a keyboard (virtual holds).
 */
'use strict';
(function (UB) {
  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'light', 'heavy', 'special',
    'dash', 'overclock', 'pause', 'map', 'confirm', 'back'];
  const BUFFERED = { jump: 1, light: 1, heavy: 1, special: 1, dash: 1, overclock: 1 };
  const BUFFER_FRAMES = 6;
  const REPEAT_INITIAL = 18, REPEAT_EVERY = 8;

  // DESIGN.md §2.2 — both columns active. Rebindable via UB.Input.bind().
  const DEFAULT_KEYS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'KeyW', 'ArrowUp'],
    light: ['KeyZ', 'KeyJ'], heavy: ['KeyX', 'KeyK'], special: ['KeyC', 'KeyL'],
    dash: ['ShiftLeft', 'ShiftRight', 'Semicolon'], overclock: ['KeyV', 'KeyI'],
    confirm: ['Enter', 'Space', 'KeyZ', 'KeyJ'],
    back: ['Escape', 'KeyX', 'KeyK', 'Backspace'],
    pause: ['Escape', 'KeyP'], map: ['KeyM', 'Tab'],
  };
  // DESIGN.md §2.3 — standard gamepad mapping (button indices).
  const PAD_BUTTONS = {
    left: [14], right: [15], up: [12], down: [13],
    jump: [0], light: [2], heavy: [3], special: [1], dash: [5, 4], overclock: [6, 7],
    confirm: [0], back: [1], pause: [9], map: [8],
  };
  const AXIS_DEAD_ON = 0.35, AXIS_DEAD_OFF = 0.25;
  // Human-readable key glyphs for HUD hints.
  const GLYPHS = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'SPACE', Enter: 'ENTER',
    Escape: 'ESC', ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', Semicolon: ';', Backspace: 'BKSP', Tab: 'TAB',
  };
  const PAD_GLYPHS = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'BACK', 9: 'START',
    12: '↑', 13: '↓', 14: '←', 15: '→' };

  // Touch layout (DESIGN.md §2.4), logical pixels. Only shown after a touchstart.
  const TOUCH_BUTTONS = [
    { a: 'left', x: 70, y: 450, r: 56, label: '◀' }, { a: 'right', x: 190, y: 450, r: 56, label: '▶' },
    { a: 'down', x: 130, y: 500, r: 28, label: '▼' },
    { a: 'jump', x: 890, y: 470, r: 56, label: 'JUMP' }, { a: 'light', x: 800, y: 430, r: 56, label: 'LIGHT' },
    { a: 'heavy', x: 870, y: 380, r: 56, label: 'HEAVY' }, { a: 'special', x: 780, y: 350, r: 56, label: 'SPECIAL' },
    { a: 'dash', x: 930, y: 400, r: 36, label: 'DASH' }, { a: 'overclock', x: 700, y: 480, r: 36, label: 'OC' },
    { a: 'pause', x: 930, y: 40, r: 22, label: '≡' }, { a: 'map', x: 880, y: 40, r: 22, label: 'MAP' },
  ];

  const Input = {
    ACTIONS: ACTIONS,
    state: {},            // action → {down, pressed, released, buffer}
    bindings: {},         // action → [codes]
    device: 'keyboard',   // 'keyboard' | 'gamepad' | 'touch' (last device used)
    anyPressed: false,    // true on the frame any key/button went down ("press any key")
    gestured: false,      // first user gesture happened (audio may init)
    touchVisible: false,
    padIndex: -1,
    freezeBuffers: false, // engine sets true during world hitstop (buffers must not tick)
  };

  // --- internals -------------------------------------------------------------
  const keyDown = Object.create(null);     // code → bool
  const codeToActions = Object.create(null); // code → [actions]
  const edgePress = {}, edgeRelease = {};  // action → count since last update
  const virt = {};                         // action → frames remaining of a virtual hold
  const padDown = {}, padPrev = {};        // action → bool
  const touchDown = {};                    // action → count of touches on it
  const heldFrames = {};                   // action → frames held (menu repeat)
  const gestureListeners = [];
  const axisState = { x: 0, y: 0 };        // hysteresis state for the left stick
  let viewport = { left: 0, top: 0, width: 960, height: 540 };
  const touchMap = Object.create(null);    // touch identifier → action

  for (let i = 0; i < ACTIONS.length; i++) {
    const a = ACTIONS[i];
    Input.state[a] = { down: false, pressed: false, released: false, buffer: 0 };
    edgePress[a] = 0; edgeRelease[a] = 0; virt[a] = 0; padDown[a] = false; padPrev[a] = false;
    touchDown[a] = 0; heldFrames[a] = 0;
  }

  function rebuildCodeMap() {
    for (const k in codeToActions) delete codeToActions[k];
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i];
      const codes = Input.bindings[a];
      for (let j = 0; j < codes.length; j++) {
        (codeToActions[codes[j]] || (codeToActions[codes[j]] = [])).push(a);
      }
    }
  }

  /** Rebind an action to a list of KeyboardEvent.code strings. */
  Input.bind = function (action, codes) {
    if (ACTIONS.indexOf(action) < 0) return;
    Input.bindings[action] = codes.slice();
    rebuildCodeMap();
  };
  /** Restore the default keyboard map. */
  Input.resetBindings = function () {
    for (let i = 0; i < ACTIONS.length; i++) Input.bindings[ACTIONS[i]] = DEFAULT_KEYS[ACTIONS[i]].slice();
    rebuildCodeMap();
  };
  Input.resetBindings();

  function fireGesture() {
    if (!Input.gestured) {
      Input.gestured = true;
      for (let i = 0; i < gestureListeners.length; i++) gestureListeners[i]();
    } else {
      // Later gestures also notify (audio contexts may need resuming).
      for (let i = 0; i < gestureListeners.length; i++) gestureListeners[i]();
    }
  }
  /** Register fn to run on every user gesture (first one sets Input.gestured). */
  Input.onGesture = function (fn) { gestureListeners.push(fn); };

  function onKeyDown(e) {
    const acts = codeToActions[e.code];
    if (acts) e.preventDefault();
    if (e.repeat) return;
    Input.device = 'keyboard';
    fireGesture();
    keyDown[e.code] = true;
    if (acts) for (let i = 0; i < acts.length; i++) edgePress[acts[i]]++;
    Input._anyEdge = true;
  }
  function onKeyUp(e) {
    const acts = codeToActions[e.code];
    if (acts) e.preventDefault();
    keyDown[e.code] = false;
    if (acts) for (let i = 0; i < acts.length; i++) edgeRelease[acts[i]]++;
  }
  function onBlur() { Input.releaseAll(); }

  /** Release every key/button (window blur, screen changes). */
  Input.releaseAll = function () {
    for (const c in keyDown) {
      if (keyDown[c]) {
        keyDown[c] = false;
        const acts = codeToActions[c];
        if (acts) for (let i = 0; i < acts.length; i++) edgeRelease[acts[i]]++;
      }
    }
    for (let i = 0; i < ACTIONS.length; i++) { touchDown[ACTIONS[i]] = 0; virt[ACTIONS[i]] = 0; }
    for (const id in touchMap) delete touchMap[id];
  };

  // --- gamepad -------------------------------------------------------------
  function pollGamepad() {
    const pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : null;
    if (!pads) return;
    let pad = Input.padIndex >= 0 ? pads[Input.padIndex] : null;
    if (!pad || !pad.connected) {
      pad = null; Input.padIndex = -1;
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i];
        if (!p || !p.connected) continue;
        for (let b = 0; b < p.buttons.length; b++) if (p.buttons[b].pressed) { pad = p; Input.padIndex = i; break; }
        if (pad) break;
      }
    }
    for (let i = 0; i < ACTIONS.length; i++) padDown[ACTIONS[i]] = false;
    if (!pad) return;
    let any = false;
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i];
      const btns = PAD_BUTTONS[a];
      let d = false;
      for (let j = 0; j < btns.length; j++) {
        const b = pad.buttons[btns[j]];
        if (b && (b.pressed || b.value > 0.5)) { d = true; break; }
      }
      padDown[a] = d;
      if (d) any = true;
    }
    // Left stick with hysteresis (DESIGN.md §2.3).
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    axisState.x = Math.abs(ax) > AXIS_DEAD_ON ? Math.sign(ax) : (Math.abs(ax) < AXIS_DEAD_OFF ? 0 : axisState.x);
    axisState.y = Math.abs(ay) > AXIS_DEAD_ON ? Math.sign(ay) : (Math.abs(ay) < AXIS_DEAD_OFF ? 0 : axisState.y);
    if (axisState.x < 0) padDown.left = true; if (axisState.x > 0) padDown.right = true;
    if (axisState.y < 0) padDown.up = true; if (axisState.y > 0) padDown.down = true;
    if (any || axisState.x || axisState.y) { Input.device = 'gamepad'; if (any) { Input._anyEdge = Input._anyEdge || !Input._padAnyPrev; } }
    Input._padAnyPrev = any;
  }

  // --- touch (optional, DESIGN.md §2.4) ------------------------------------------
  function touchToLogical(t) {
    const x = (t.clientX - viewport.left) / viewport.width * 960;
    const y = (t.clientY - viewport.top) / viewport.height * 540;
    return { x: x, y: y };
  }
  function nearestButton(lx, ly) {
    let best = null, bestD = 70;
    for (let i = 0; i < TOUCH_BUTTONS.length; i++) {
      const b = TOUCH_BUTTONS[i];
      const d = Math.sqrt((b.x - lx) * (b.x - lx) + (b.y - ly) * (b.y - ly)) - b.r;
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }
  function onTouchStart(e) {
    Input.touchVisible = true; Input.device = 'touch';
    fireGesture();
    Input._anyEdge = true;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const p = touchToLogical(t);
      const b = nearestButton(p.x, p.y);
      if (b) { touchMap[t.identifier] = b.a; touchDown[b.a]++; edgePress[b.a]++; }
    }
    e.preventDefault();
  }
  function onTouchMove(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const cur = touchMap[t.identifier];
      if (cur !== 'left' && cur !== 'right' && cur !== 'down') continue;
      const p = touchToLogical(t);
      const b = nearestButton(p.x, p.y);
      if (b && b.a !== cur && (b.a === 'left' || b.a === 'right' || b.a === 'down')) {
        touchDown[cur]--; edgeRelease[cur]++;
        touchMap[t.identifier] = b.a; touchDown[b.a]++; edgePress[b.a]++;
      }
    }
    e.preventDefault();
  }
  function onTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const a = touchMap[t.identifier];
      if (a) { touchDown[a] = Math.max(0, touchDown[a] - 1); edgeRelease[a]++; delete touchMap[t.identifier]; }
    }
    e.preventDefault();
  }
  /** Draw the touch overlay (engine calls this last, screen space). */
  Input.drawTouch = function (ctx) {
    if (!Input.touchVisible) return;
    ctx.save();
    ctx.font = UB.font(14, 'UI', true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < TOUCH_BUTTONS.length; i++) {
      const b = TOUCH_BUTTONS[i];
      const on = touchDown[b.a] > 0;
      ctx.globalAlpha = on ? 0.35 : 0.18; ctx.fillStyle = UB.Palette.PAPER;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.4; ctx.strokeStyle = UB.Palette.INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = UB.Palette.INK; ctx.fillText(b.label, b.x, b.y);
    }
    ctx.restore();
  };

  // --- public API ---------------------------------------------------------------
  /** Attach DOM listeners. Call once from main.js. */
  Input.init = function (canvas) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pointerdown', fireGesture);
    if (canvas) {
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    }
  };
  /** main.js reports the canvas CSS rect so touches map to logical pixels. */
  Input.setViewport = function (left, top, width, height) {
    viewport.left = left; viewport.top = top; viewport.width = width; viewport.height = height;
  };

  /**
   * Latch the frame's action state. Called exactly once per logic tick by the
   * engine, before anything else. Honors Input.freezeBuffers (hitstop).
   */
  Input.update = function () {
    pollGamepad();
    Input.anyPressed = !!Input._anyEdge;
    Input._anyEdge = false;
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i];
      const s = Input.state[a];
      const was = s.down;
      let kd = false;
      const codes = Input.bindings[a];
      for (let j = 0; j < codes.length; j++) if (keyDown[codes[j]]) { kd = true; break; }
      s.down = kd || padDown[a] || touchDown[a] > 0 || virt[a] > 0;
      s.pressed = edgePress[a] > 0 || (s.down && !was) || (padDown[a] && !padPrev[a]);
      s.released = edgeRelease[a] > 0 || (!s.down && was) || (!padDown[a] && padPrev[a]);
      if (BUFFERED[a]) {
        if (s.pressed) s.buffer = BUFFER_FRAMES;
        else if (s.buffer > 0 && !Input.freezeBuffers) s.buffer--;
      }
      heldFrames[a] = s.down ? (was ? heldFrames[a] + 1 : 1) : 0;
      edgePress[a] = 0; edgeRelease[a] = 0;
      padPrev[a] = padDown[a];
      if (virt[a] > 0) virt[a]--;
    }
  };

  /** Consume a buffered action (clears buffer + pressed). */
  Input.consume = function (action) { const s = Input.state[action]; s.buffer = 0; s.pressed = false; };
  /** True if the action is buffered (pressed within the last 6 frames). */
  Input.buffered = function (action) { return Input.state[action].buffer > 0; };
  /** Menu navigation with key repeat: initial 18 f, then every 8 f. */
  Input.repeat = function (action) {
    const s = Input.state[action];
    if (s.pressed) return true;
    const h = heldFrames[action];
    return h > REPEAT_INITIAL && ((h - REPEAT_INITIAL) % REPEAT_EVERY) === 0;
  };
  /** Virtual hold: the action reads as down for `frames` logic frames (tests). */
  Input.press = function (action, frames) {
    if (ACTIONS.indexOf(action) < 0) return;
    if (virt[action] <= 0) edgePress[action]++;
    virt[action] = Math.max(virt[action], frames | 0 || 1);
    Input._anyEdge = true;
  };
  /** Human-readable glyph for the first binding of an action (HUD hints). */
  Input.glyph = function (action) {
    if (Input.device === 'gamepad') { const b = PAD_BUTTONS[action]; return b ? (PAD_GLYPHS[b[0]] || ('B' + b[0])) : '?'; }
    const codes = Input.bindings[action];
    if (!codes || !codes.length) return '?';
    const c = codes[0];
    if (GLYPHS[c]) return GLYPHS[c];
    if (c.indexOf('Key') === 0) return c.slice(3);
    if (c.indexOf('Digit') === 0) return c.slice(5);
    return c.toUpperCase();
  };

  UB.Input = Input;
})(window.UB);
