/**
 * @module core/input
 *
 * Action-based input for keyboard, gamepad and touch.
 *
 * BROWSER-ONLY at *use* time: `createInput()` wires DOM listeners and may build an
 * on-screen touch overlay. Importing the module is side-effect free (it never reads
 * `window`/`document` at import time), so Node can unit-test the pure helpers and even
 * drive `createInput()` with fake `EventTarget`s.
 *
 * Model
 * -----
 * Every physical control is a **token** string:
 *   - keyboard: the `KeyboardEvent.code` (`'KeyZ'`, `'ArrowUp'`, `'ShiftLeft'`), which is
 *     layout independent so WASD stays in place on AZERTY/QWERTZ keyboards;
 *   - gamepad : `'gp:b<n>'` (standard-mapping button n) or `'gp:axis<n><+|->'` (a stick
 *     axis past the deadzone in the negative or positive direction);
 *   - touch   : `'touch:up|down|left|right|a|b|menu'` (the on-screen overlay).
 * Bindings map each action to a list of tokens. One token may serve several actions
 * (Escape is both `cancel` and `menu` by design; the active scene decides which one it
 * cares about).
 *
 * Edge semantics: `pressed()` / `released()` are latched by `update()` from the events
 * buffered since the previous frame, so a tap shorter than one frame is still seen
 * (pressed and released both true, held false). A press only ever comes from a real
 * key-down transition, so a key that is already held when a scene starts never counts
 * as a press, and `flush()` discards anything buffered.
 */

const ACTION_LIST = [
  'up', 'down', 'left', 'right',
  'confirm', 'cancel', 'menu', 'run',
  'tool', 'map', 'log', 'start', 'select', 'l', 'r',
];

/** The bindable action names (does not include the virtual `anyKey`). */
export const ACTIONS = Object.freeze([...ACTION_LIST]);

/** Virtual action that fires for any key, button, touch control or pointer press. */
export const ANY_KEY = 'anyKey';

/** Tokens emitted by the on-screen touch overlay. */
export const TOUCH_TOKENS = Object.freeze([
  'touch:up', 'touch:down', 'touch:left', 'touch:right', 'touch:a', 'touch:b', 'touch:menu',
]);

/** Devices a token can belong to. */
export const DEVICES = Object.freeze(['keyboard', 'gamepad', 'touch']);

/** Current `saveBindings()` document version. */
export const BINDINGS_VERSION = 1;

const ACTION_SET = new Set(ACTION_LIST);
const TOUCH_TOKEN_SET = new Set(TOUCH_TOKENS);
const DIRS = ['up', 'down', 'left', 'right'];
const NO_DIRS = Object.freeze({ up: false, down: false, left: false, right: false });
const GAMEPAD_TOKEN_RE = /^gp:(?:b\d{1,2}|axis\d[+-])$/;
const KEYBOARD_TOKEN_RE = /^[A-Za-z][A-Za-z0-9]*$/;
const MAX_GAMEPAD_AXES = 4;
const MAX_VIBRATE_MS = 5000;
const TAN_22_5 = 0.41421356;

/**
 * Default bindings, as `{ action: token[] }`.
 * Keyboard: arrows/WASD move; Z/Enter/Space confirm; X/Esc/Backspace cancel; Enter/Esc
 * also open the menu; Shift runs; C tool ring; M map; Tab log; P pause (`start`);
 * backquote `select`; `[` / `]` are `l` / `r`.
 * Gamepad (standard mapping): A confirm, B cancel, X tool, Y map, LB/RB l/r, LT log,
 * RT run, Back select, Start start + menu, d-pad and left stick move.
 */
export const DEFAULT_BINDINGS = freezeBindings({
  up: ['ArrowUp', 'KeyW', 'gp:b12', 'gp:axis1-', 'touch:up'],
  down: ['ArrowDown', 'KeyS', 'gp:b13', 'gp:axis1+', 'touch:down'],
  left: ['ArrowLeft', 'KeyA', 'gp:b14', 'gp:axis0-', 'touch:left'],
  right: ['ArrowRight', 'KeyD', 'gp:b15', 'gp:axis0+', 'touch:right'],
  confirm: ['KeyZ', 'Enter', 'NumpadEnter', 'Space', 'gp:b0', 'touch:a'],
  cancel: ['KeyX', 'Escape', 'Backspace', 'gp:b1', 'touch:b'],
  menu: ['Enter', 'NumpadEnter', 'Escape', 'gp:b9', 'touch:menu'],
  run: ['ShiftLeft', 'ShiftRight', 'gp:b7'],
  tool: ['KeyC', 'gp:b2'],
  map: ['KeyM', 'gp:b3'],
  log: ['Tab', 'gp:b6'],
  start: ['KeyP', 'gp:b9'],
  select: ['Backquote', 'gp:b8'],
  l: ['BracketLeft', 'gp:b4'],
  r: ['BracketRight', 'gp:b5'],
});

const GAMEPAD_BUTTON_LABELS = [
  'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'D↑', 'D↓', 'D←', 'D→', 'Home',
];

const KEY_LABELS = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Escape: 'Esc', Backspace: 'Bksp', Delete: 'Del', Insert: 'Ins', PageUp: 'PgUp', PageDown: 'PgDn',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  AltLeft: 'Alt', AltRight: 'Alt', MetaLeft: 'Meta', MetaRight: 'Meta', CapsLock: 'Caps',
  BracketLeft: '[', BracketRight: ']', Backquote: '`', Minus: '-', Equal: '=',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
};

/** `KeyboardEvent.key` names that need converting when `code` is missing (old/odd browsers). */
const KEY_NAME_FIXUPS = {
  Esc: 'Escape', Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight',
  Spacebar: 'Space', ' ': 'Space', Del: 'Delete', Shift: 'ShiftLeft', Control: 'ControlLeft',
  Alt: 'AltLeft', Meta: 'MetaLeft', OS: 'MetaLeft',
};

const OVERLAY_STYLE_ID = 'wsp-touch-style';
const OVERLAY_CSS = [
  '.wsp-touch{position:fixed;inset:0;z-index:1000;pointer-events:none;user-select:none;-webkit-user-select:none;',
  '-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;',
  'color:#fff;--wsp-d:clamp(120px,26vmin,184px);--wsp-b:clamp(58px,13vmin,92px);--wsp-pad:16px}',
  '.wsp-touch[hidden]{display:none}',
  '.wsp-touch--abs{position:absolute}',
  '.wsp-touch *{box-sizing:border-box}',
  '.wsp-touch__dpad{position:absolute;left:max(var(--wsp-pad),env(safe-area-inset-left));',
  'bottom:max(var(--wsp-pad),env(safe-area-inset-bottom));width:var(--wsp-d);height:var(--wsp-d);pointer-events:auto;touch-action:none}',
  '.wsp-touch__arm,.wsp-touch__hub{position:absolute;width:34%;height:34%;display:flex;align-items:center;justify-content:center;',
  'background:rgba(20,24,38,.45);border:2px solid rgba(255,255,255,.35);border-radius:10px;font-size:calc(var(--wsp-d)*.13);',
  'text-shadow:0 1px 2px rgba(0,0,0,.7);transition:background .06s}',
  '.wsp-touch__arm--up{left:33%;top:0}.wsp-touch__arm--down{left:33%;bottom:0}',
  '.wsp-touch__arm--left{left:0;top:33%}.wsp-touch__arm--right{right:0;top:33%}',
  '.wsp-touch__hub{left:33%;top:33%;border-radius:4px;border-color:rgba(255,255,255,.18)}',
  '.wsp-touch__arm.is-on{background:rgba(255,255,255,.65);color:#121428;text-shadow:none}',
  '.wsp-touch__btn{position:absolute;pointer-events:auto;touch-action:none;width:var(--wsp-b);height:var(--wsp-b);border-radius:50%;',
  'display:flex;align-items:center;justify-content:center;background:rgba(20,24,38,.45);border:2px solid rgba(255,255,255,.4);',
  'font-weight:700;font-size:calc(var(--wsp-b)*.42);text-shadow:0 1px 2px rgba(0,0,0,.7);transition:background .06s,transform .06s}',
  '.wsp-touch__btn--a{right:max(var(--wsp-pad),env(safe-area-inset-right));',
  'bottom:calc(max(var(--wsp-pad),env(safe-area-inset-bottom)) + var(--wsp-b)*.6)}',
  '.wsp-touch__btn--b{right:calc(max(var(--wsp-pad),env(safe-area-inset-right)) + var(--wsp-b)*1.08);',
  'bottom:max(var(--wsp-pad),env(safe-area-inset-bottom))}',
  '.wsp-touch__btn--menu{top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));width:auto;height:auto;',
  'padding:7px 14px;border-radius:999px;font-size:13px;letter-spacing:.12em}',
  '.wsp-touch__btn.is-on{background:rgba(255,255,255,.7);color:#121428;text-shadow:none;transform:scale(.94)}',
].join('');

/**
 * @typedef {Object<string, string[]>} Bindings  Map of action name to token list.
 */

/**
 * @typedef {object} PointerState
 * @property {number} x         Game-space x (via `display.toGame`).
 * @property {number} y         Game-space y.
 * @property {boolean} down     Primary pointer currently held on the canvas.
 * @property {boolean} justDown Pointer went down since the previous `update()`.
 * @property {boolean} justUp   Pointer came up since the previous `update()`.
 * @property {boolean} inside   Last position lies inside the game area (false until a pointer is seen).
 * @property {'mouse'|'pen'|'touch'|''} type  Pointer type of the last event.
 * @property {number} button    Button of the last pointer-down (0 = primary).
 */

/**
 * @typedef {object} RepeatOptions
 * @property {number} [delay=300] Milliseconds held before auto-repeat starts.
 * @property {number} [rate=80]   Milliseconds between repeats once started.
 */

/**
 * @typedef {object} RebindOptions
 * @property {'keyboard'|'gamepad'|'touch'} [device] Device whose tokens are replaced when
 *   `key` is null/empty (otherwise inferred from `key`).
 * @property {number} [slot] Replace only the slot-th token of that device (0 = primary);
 *   the slot is appended if the action has fewer tokens. Omit to replace all tokens of the
 *   device.
 */

/**
 * @typedef {object} InputOptions
 * @property {EventTarget & {getBoundingClientRect?: Function}} canvas  The visible canvas
 *   (pointer events and `touch-action` are attached to it).
 * @property {{toGame?: (clientX: number, clientY: number) => {x: number, y: number}}} [display]
 *   Display from `canvas.js`; its `toGame` converts client to game coordinates. Without it
 *   the canvas rect is scaled to `width` x `height`.
 * @property {number} [width=480]   Logical game width (for `pointer.inside` and fallback mapping).
 * @property {number} [height=270]  Logical game height.
 * @property {boolean|'auto'} [touch='auto'] Touch overlay: `true` always, `false` never,
 *   `'auto'` on coarse-pointer devices and whenever a touch is seen (hidden again on
 *   keyboard/gamepad input). `?touch=1` / `?touch=0` in the page URL override everything.
 * @property {HTMLElement} [touchParent] Element to host the overlay (absolute positioning);
 *   defaults to `document.body` with fixed positioning.
 * @property {EventTarget} [target]     Keyboard/blur/pointer-up target; defaults to `window`.
 * @property {Document} [doc]           Document for the overlay and visibility; defaults to `document`.
 * @property {Navigator} [nav]          Navigator for gamepads/vibration; defaults to `navigator`.
 * @property {() => number} [now]       Clock in ms (defaults to `performance.now`); inject for tests.
 * @property {string} [search]          Query string to inspect (defaults to `location.search`).
 * @property {(q: string) => {matches: boolean}} [matchMedia] `matchMedia` for touch detection.
 * @property {number} [deadzone=0.5]    Stick deadzone at which an axis engages (releases at 70% of it).
 * @property {boolean} [preventDefault=true] Prevent browser defaults for bound keys (scroll, Tab focus).
 */

/**
 * @typedef {object} Input
 * @property {() => void} update                 Call once per frame before querying; latches edges.
 * @property {(action: string) => boolean} pressed  True on the frame the action went down.
 * @property {(action: string) => boolean} held     True while any token of the action is down.
 * @property {(action: string) => boolean} released True on the frame the action let go.
 * @property {() => {x: number, y: number}} axis    Digital -1/0/1 axes from the held directions.
 * @property {(action: string, opts?: RepeatOptions) => boolean} repeat Press + menu auto-repeat.
 * @property {() => void} flush                  Discard buffered presses (scene change / menu open).
 * @property {(action: string, key: string|string[]|null, opts?: RebindOptions) => string[]} rebind
 * @property {() => Bindings} bindings           Copy of the current bindings.
 * @property {() => void} resetBindings          Restore `DEFAULT_BINDINGS`.
 * @property {(json: string|object) => boolean} loadBindings Merge a saved document; false if unusable.
 * @property {() => string} saveBindings         JSON document that round-trips through `loadBindings`.
 * @property {PointerState} pointer              Pointer snapshot for the current frame.
 * @property {'keyboard'|'gamepad'|'touch'} lastDevice Device that produced the latest input.
 * @property {(ms?: number, opts?: {strong?: number, weak?: number}) => boolean} vibrate
 * @property {(action: string, key: string) => string[]} addBinding
 * @property {(action: string, key: string) => string[]} removeBinding
 * @property {(token: string) => string[]} actionsFor  Actions a token currently triggers.
 * @property {(action: string) => number} heldFor      Milliseconds the action has been held (0 if not).
 * @property {() => string|null} lastPressedToken      Most recent physical token pressed (for rebind UIs).
 * @property {(on: boolean) => void} setEnabled        Ignore all input while false (releases everything).
 * @property {boolean} enabled
 * @property {(v: boolean|'auto') => void} setTouchVisible Force the overlay on/off or return to auto.
 * @property {boolean} touchVisible
 * @property {(on: boolean) => void} setVibrationEnabled
 * @property {boolean} vibrationEnabled
 * @property {number} gamepads                   Connected gamepads seen by the last poll.
 * @property {number} frame                      Number of `update()` calls so far.
 * @property {() => void} destroy                Remove listeners and overlay.
 */

/**
 * Classify a token by the device that produces it.
 * @param {string} token
 * @returns {'keyboard'|'gamepad'|'touch'|null} null when the token is malformed.
 */
export function tokenDevice(token) {
  if (typeof token !== 'string' || token === '') return null;
  if (token.startsWith('gp:')) return GAMEPAD_TOKEN_RE.test(token) ? 'gamepad' : null;
  if (token.startsWith('touch:')) return TOUCH_TOKEN_SET.has(token) ? 'touch' : null;
  return KEYBOARD_TOKEN_RE.test(token) ? 'keyboard' : null;
}

/**
 * Derive the token for a keyboard event. Prefers `code`; falls back to `key` for browsers
 * (some Android IMEs) that report an empty or `Unidentified` code.
 * @param {{code?: string, key?: string}} ev
 * @returns {string|null} null when the key cannot be identified (dead keys, IME).
 */
export function tokenFromKeyEvent(ev) {
  if (!ev) return null;
  const code = typeof ev.code === 'string' ? ev.code : '';
  if (code && code !== 'Unidentified') return code;
  const key = typeof ev.key === 'string' ? ev.key : '';
  if (!key || key === 'Unidentified' || key === 'Dead') return null;
  if (Object.prototype.hasOwnProperty.call(KEY_NAME_FIXUPS, key)) return KEY_NAME_FIXUPS[key];
  if (key.length === 1) {
    const upper = key.toUpperCase();
    if (/^[A-Z]$/.test(upper)) return `Key${upper}`;
    if (/^[0-9]$/.test(upper)) return `Digit${upper}`;
    return null;
  }
  return KEYBOARD_TOKEN_RE.test(key) ? key : null;
}

/**
 * Short human label for a token, for button prompts and rebind menus
 * (`'KeyZ'` -> `'Z'`, `'ArrowUp'` -> `'↑'`, `'gp:b0'` -> `'A'`, `'gp:axis0-'` -> `'L←'`).
 * @param {string} token
 * @returns {string} Empty string for a non-string.
 */
export function tokenLabel(token) {
  if (typeof token !== 'string') return '';
  if (token.startsWith('gp:')) {
    const button = /^gp:b(\d+)$/.exec(token);
    if (button) return GAMEPAD_BUTTON_LABELS[Number(button[1])] ?? `B${button[1]}`;
    const axis = /^gp:axis(\d)([+-])$/.exec(token);
    if (axis) {
      const index = Number(axis[1]);
      const stick = index < 2 ? 'L' : 'R';
      const horizontal = index % 2 === 0;
      const negative = axis[2] === '-';
      return stick + (horizontal ? (negative ? '←' : '→') : (negative ? '↑' : '↓'));
    }
    return token;
  }
  if (token.startsWith('touch:')) {
    const name = token.slice('touch:'.length);
    return name.length <= 1 ? name.toUpperCase() : name[0].toUpperCase() + name.slice(1);
  }
  if (Object.prototype.hasOwnProperty.call(KEY_LABELS, token)) return KEY_LABELS[token];
  let m = /^Key([A-Z])$/.exec(token);
  if (m) return m[1];
  m = /^Digit(\d)$/.exec(token);
  if (m) return m[1];
  m = /^Numpad(.+)$/.exec(token);
  if (m) return `Num ${m[1]}`;
  return token;
}

/**
 * 8-way d-pad resolution from an offset relative to the pad centre (screen axes: +y is
 * down). Diagonals engage when the offset is within 22.5 degrees of them.
 * @param {number} dx
 * @param {number} dy
 * @param {number} [deadzone=0] Radius (same units as dx/dy) inside which nothing is pressed.
 * @returns {{up: boolean, down: boolean, left: boolean, right: boolean}}
 */
export function dpadDirections(dx, dy, deadzone = 0) {
  const distance = Math.hypot(dx, dy);
  if (!(distance > deadzone)) return { ...NO_DIRS };
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const horizontal = ax > ay * TAN_22_5;
  const vertical = ay > ax * TAN_22_5;
  return {
    up: vertical && dy < 0,
    down: vertical && dy > 0,
    left: horizontal && dx < 0,
    right: horizontal && dx > 0,
  };
}

/**
 * Decide whether the touch overlay should be shown initially.
 * Priority: `?touch=1|0` in `search`, then an explicit boolean `touch`, then device
 * detection (`(pointer: coarse)` primary pointer, or touch points without any fine pointer).
 * @param {{touch?: boolean|'auto', search?: string, nav?: {maxTouchPoints?: number}|null,
 *   matchMedia?: ((q: string) => {matches: boolean})|null}} [env]
 * @returns {{visible: boolean, forced: boolean}} `forced` means auto show/hide is disabled.
 */
export function detectTouchPreference({ touch = 'auto', search = '', nav = null, matchMedia = null } = {}) {
  const query = /[?&]touch(?:=([^&#]*))?(?=[&#]|$)/.exec(typeof search === 'string' ? search : '');
  if (query) {
    const value = (query[1] ?? '').toLowerCase();
    if (value === '1' || value === 'true' || value === '') return { visible: true, forced: true };
    if (value === '0' || value === 'false') return { visible: false, forced: true };
  }
  if (touch === true) return { visible: true, forced: true };
  if (touch === false) return { visible: false, forced: true };
  const coarse = mediaMatches(matchMedia, '(pointer: coarse)');
  const fine = mediaMatches(matchMedia, '(pointer: fine)');
  const points = nav && typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0;
  return { visible: coarse || (points > 0 && !fine), forced: false };
}

/**
 * Parse a bindings document (JSON string or object, either `{version, bindings}` or a bare
 * `{action: tokens}` table). Unknown actions and malformed tokens are dropped rather than
 * rejected so older or hand-edited saves still load. An explicitly empty list unbinds an
 * action; a list whose tokens were all malformed is ignored.
 * @param {string|object} source
 * @returns {{bindings: Bindings, dropped: string[]}|null} null when `source` is not an object.
 */
export function parseBindings(source) {
  let data = source;
  if (typeof source === 'string') {
    try {
      data = JSON.parse(source);
    } catch {
      return null;
    }
  }
  if (!isPlainObject(data)) return null;
  const table = isPlainObject(data.bindings) ? data.bindings : data;
  /** @type {Bindings} */
  const bindings = {};
  const dropped = [];
  for (const [action, value] of Object.entries(table)) {
    if (!ACTION_SET.has(action)) {
      dropped.push(action);
      continue;
    }
    const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : null;
    if (!list) {
      dropped.push(action);
      continue;
    }
    const clean = [];
    for (const token of list) {
      if (tokenDevice(token) && !clean.includes(token)) clean.push(token);
      else dropped.push(`${action}:${String(token)}`);
    }
    if (clean.length === 0 && list.length > 0) continue; // every token was bad: keep the default, do not unbind
    bindings[action] = clean;
  }
  return { bindings, dropped };
}

/**
 * Create the input system for a canvas. See {@link InputOptions} and {@link Input}.
 * @param {InputOptions} options
 * @returns {Input}
 * @throws {TypeError} when `canvas` is not an EventTarget.
 */
export function createInput(options = {}) {
  const {
    canvas,
    display = null,
    width = 480,
    height = 270,
    touch = 'auto',
    touchParent = null,
    target = globalThis.window ?? null,
    doc = globalThis.document ?? null,
    nav = globalThis.navigator ?? null,
    now = defaultNow,
    deadzone = 0.5,
    preventDefault = true,
  } = options;
  if (!canvas || typeof canvas.addEventListener !== 'function') {
    throw new TypeError('createInput: `canvas` must be an EventTarget (the visible canvas)');
  }
  const search = options.search ?? (globalThis.location && typeof globalThis.location.search === 'string'
    ? globalThis.location.search
    : '');
  const matchMedia = options.matchMedia
    ?? (target && typeof target.matchMedia === 'function' ? target.matchMedia.bind(target) : null);

  // ---- bindings -------------------------------------------------------------------------
  /** @type {Bindings} */
  let bindings = cloneBindings(DEFAULT_BINDINGS);
  /** @type {Map<string, string[]>} token -> actions */
  let tokenToActions = new Map();
  const rebuildIndex = () => {
    tokenToActions = new Map();
    for (const action of ACTION_LIST) {
      for (const token of bindings[action]) {
        let actions = tokenToActions.get(token);
        if (!actions) tokenToActions.set(token, (actions = []));
        if (!actions.includes(action)) actions.push(action);
      }
    }
  };
  rebuildIndex();

  // ---- raw token state (buffered between frames) ---------------------------------------
  /** @type {Map<string, {down: boolean, press: number, release: number, device: string}>} */
  const tokens = new Map();
  let lastDevice = 'keyboard';
  let lastToken = null;
  let enabled = true;
  let vibrationEnabled = true;

  // ---- per-frame latched state ------------------------------------------------------------
  let frame = 0;
  let frameNow = safeNow(now);
  let pressedActions = new Set();
  let heldActions = new Set();
  let releasedActions = new Set();
  let anyPressed = false;
  let anyHeld = false;
  let anyReleased = false;
  /** @type {Map<string, number>} action -> time it became held */
  const heldSince = new Map();
  /** @type {Map<string, {frame: number, result: boolean, nextAt: number, armed: boolean}>} */
  const repeatState = new Map();

  // ---- pointer ---------------------------------------------------------------------------
  const ptr = { x: 0, y: 0, down: false, type: '', button: 0, seen: false };
  let ptrId = null;
  let ptrPendingDown = 0;
  let ptrPendingUp = 0;
  /** @type {PointerState} */
  let pointerSnapshot = Object.freeze({
    x: 0, y: 0, down: false, justDown: false, justUp: false, inside: false, type: '', button: 0,
  });

  // ---- gamepad -----------------------------------------------------------------------------
  let gamepadDown = new Set();
  let gamepadCount = 0;
  let gamepadBroken = false;
  const engage = Math.max(0.05, Math.min(0.95, Number(deadzone) || 0.5));
  const disengage = engage * 0.7;

  // ---- listener bookkeeping ---------------------------------------------------------------
  /** @type {Array<() => void>} */
  const subs = [];
  const listen = (el, type, fn, opts) => {
    if (!el || typeof el.addEventListener !== 'function') return;
    el.addEventListener(type, fn, opts);
    subs.push(() => el.removeEventListener(type, fn, opts));
  };

  // ---- touch overlay ---------------------------------------------------------------------
  const touchPref = detectTouchPreference({ touch, search, nav, matchMedia });
  let touchForced = touchPref.forced;
  const overlayParent = touchParent ?? (doc && doc.body) ?? null;
  const overlay = touch !== false || touchPref.visible
    ? createTouchOverlay({
      doc,
      parent: overlayParent,
      fixed: !touchParent,
      onToken: (token, down) => (down ? tokenDown(token, 'touch') : tokenUp(token)),
    })
    : null;
  if (overlay) overlay.setVisible(touchPref.visible);
  if (touchPref.visible) lastDevice = 'touch';

  // ---- core token transitions -------------------------------------------------------------
  function setDevice(device) {
    if (device === lastDevice) return;
    lastDevice = device;
    if (overlay && !touchForced) overlay.setVisible(device === 'touch');
  }

  function tokenDown(token, device) {
    if (!enabled) return;
    let state = tokens.get(token);
    if (!state) tokens.set(token, (state = { down: false, press: 0, release: 0, device }));
    if (state.down) return;
    state.down = true;
    state.press += 1;
    state.device = device;
    lastToken = token;
    setDevice(device);
  }

  /** Mark a token held without counting a press (OS auto-repeat seen before its key-down). */
  function tokenHold(token, device) {
    if (!enabled) return;
    let state = tokens.get(token);
    if (!state) tokens.set(token, (state = { down: false, press: 0, release: 0, device }));
    state.down = true;
  }

  function tokenUp(token) {
    const state = tokens.get(token);
    if (!state || !state.down) return;
    state.down = false;
    state.release += 1;
  }

  function isTokenDown(token) {
    const state = tokens.get(token);
    return Boolean(state && state.down);
  }

  function releaseAll(device = null) {
    for (const [token, state] of tokens) {
      if (state.down && (device === null || state.device === device)) tokenUp(token);
    }
    if (device === null && ptr.down) {
      ptr.down = false;
      ptrId = null;
      ptrPendingUp += 1;
    }
    if (device === null && overlay) overlay.release();
  }

  // ---- keyboard ------------------------------------------------------------------------------
  function onKeyDown(ev) {
    if (!enabled || ev.isComposing || isEditable(ev.target)) return;
    const token = tokenFromKeyEvent(ev);
    if (!token) return;
    if (ev.ctrlKey || ev.metaKey) return; // leave browser/OS shortcuts alone
    if (preventDefault && tokenToActions.has(token) && typeof ev.preventDefault === 'function') ev.preventDefault();
    if (ev.repeat) tokenHold(token, 'keyboard');
    else tokenDown(token, 'keyboard');
  }

  function onKeyUp(ev) {
    const token = tokenFromKeyEvent(ev);
    if (!token) return;
    tokenUp(token);
    // macOS swallows key-ups delivered while Command is held; release everything when it lifts.
    if (token === 'MetaLeft' || token === 'MetaRight') releaseAll('keyboard');
  }

  // ---- pointer -----------------------------------------------------------------------------
  function toGame(clientX, clientY) {
    if (display && typeof display.toGame === 'function') {
      const p = display.toGame(clientX, clientY);
      return { x: finite(p && p.x), y: finite(p && p.y) };
    }
    const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return { x: finite(clientX), y: finite(clientY) };
    return {
      x: ((finite(clientX) - rect.left) * width) / rect.width,
      y: ((finite(clientY) - rect.top) * height) / rect.height,
    };
  }

  function updatePointerPos(ev) {
    const p = toGame(ev.clientX, ev.clientY);
    ptr.x = p.x;
    ptr.y = p.y;
    ptr.seen = true;
    ptr.type = typeof ev.pointerType === 'string' ? ev.pointerType : '';
  }

  function onCanvasPointerDown(ev) {
    if (!enabled) return;
    const id = pointerId(ev);
    if (ptrId !== null && id !== ptrId) return; // ignore extra fingers
    updatePointerPos(ev);
    setDevice(ev.pointerType === 'touch' ? 'touch' : 'keyboard');
    ptrId = id;
    ptr.down = true;
    ptr.button = typeof ev.button === 'number' ? ev.button : 0;
    ptrPendingDown += 1;
    if (typeof canvas.setPointerCapture === 'function') {
      try {
        canvas.setPointerCapture(ptrId);
      } catch {
        // capture is best effort (fails for synthetic events)
      }
    }
    if (preventDefault && ev.pointerType !== 'mouse' && typeof ev.preventDefault === 'function') ev.preventDefault();
  }

  function onPointerMove(ev) {
    if (ptrId !== null && pointerId(ev) !== ptrId) return; // only the captured finger drags
    updatePointerPos(ev);
  }

  function onPointerUp(ev) {
    if (ptrId === null || pointerId(ev) !== ptrId) return;
    updatePointerPos(ev);
    ptr.down = false;
    ptrId = null;
    ptrPendingUp += 1;
  }

  // ---- gamepad -----------------------------------------------------------------------------
  function readGamepads() {
    if (gamepadBroken || !nav || typeof nav.getGamepads !== 'function') return [];
    try {
      const pads = nav.getGamepads();
      return pads ? Array.from(pads).filter((pad) => pad && pad.connected !== false) : [];
    } catch {
      gamepadBroken = true; // e.g. SecurityError inside a sandboxed iframe
      return [];
    }
  }

  function pollGamepads() {
    const pads = readGamepads();
    gamepadCount = pads.length;
    const nowDown = new Set();
    for (const pad of pads) {
      const buttons = pad.buttons || [];
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i];
        if (b && (b.pressed === true || (typeof b.value === 'number' && b.value > 0.5))) nowDown.add(`gp:b${i}`);
      }
      const axes = pad.axes || [];
      const count = Math.min(MAX_GAMEPAD_AXES, axes.length);
      for (let i = 0; i < count; i++) {
        const v = Number(axes[i]) || 0;
        for (const sign of ['-', '+']) {
          const token = `gp:axis${i}${sign}`;
          const magnitude = sign === '-' ? -v : v;
          const threshold = gamepadDown.has(token) ? disengage : engage;
          if (magnitude >= threshold) nowDown.add(token);
        }
      }
    }
    if (enabled) {
      for (const token of nowDown) {
        if (!gamepadDown.has(token)) tokenDown(token, 'gamepad');
        else if (!isTokenDown(token)) tokenHold(token, 'gamepad'); // held across a blur: no new press
      }
      for (const token of gamepadDown) if (!nowDown.has(token)) tokenUp(token);
    }
    gamepadDown = nowDown; // tracked while disabled too, so re-enabling never fabricates presses
  }

  // ---- frame latch --------------------------------------------------------------------------
  function update() {
    frame += 1;
    frameNow = safeNow(now);
    pollGamepads();

    const pressed = new Set();
    const held = new Set();
    const releasedCandidates = new Set();
    anyPressed = false;
    anyHeld = false;
    anyReleased = false;

    for (const [token, state] of tokens) {
      if (state.press > 0) anyPressed = true;
      if (state.release > 0) anyReleased = true;
      if (state.down) anyHeld = true;
      const actions = tokenToActions.get(token);
      if (actions) {
        for (const action of actions) {
          if (state.press > 0) pressed.add(action);
          if (state.release > 0) releasedCandidates.add(action);
          if (state.down) held.add(action);
        }
      }
      state.press = 0;
      state.release = 0;
      if (!state.down) tokens.delete(token);
    }

    const released = new Set();
    for (const action of releasedCandidates) if (!held.has(action)) released.add(action);
    pressedActions = pressed;
    heldActions = held;
    releasedActions = released;

    for (const action of held) if (!heldSince.has(action)) heldSince.set(action, frameNow);
    for (const action of heldSince.keys()) if (!held.has(action)) heldSince.delete(action);

    const justDown = ptrPendingDown > 0;
    const justUp = ptrPendingUp > 0;
    ptrPendingDown = 0;
    ptrPendingUp = 0;
    if (justDown) anyPressed = true;
    if (justUp) anyReleased = true;
    if (ptr.down) anyHeld = true;
    pointerSnapshot = Object.freeze({
      x: ptr.x,
      y: ptr.y,
      down: ptr.down,
      justDown,
      justUp,
      inside: ptr.seen && ptr.x >= 0 && ptr.y >= 0 && ptr.x < width && ptr.y < height,
      type: ptr.type,
      button: ptr.button,
    });
  }

  function flush() {
    for (const state of tokens.values()) {
      state.press = 0;
      state.release = 0;
    }
    pressedActions = new Set();
    releasedActions = new Set();
    anyPressed = false;
    anyReleased = false;
    ptrPendingDown = 0;
    ptrPendingUp = 0;
    if (pointerSnapshot.justDown || pointerSnapshot.justUp) {
      pointerSnapshot = Object.freeze({ ...pointerSnapshot, justDown: false, justUp: false });
    }
    repeatState.clear();
  }

  // ---- queries --------------------------------------------------------------------------------
  function pressed(action) {
    assertAction(action, true);
    return action === ANY_KEY ? anyPressed : pressedActions.has(action);
  }

  function held(action) {
    assertAction(action, true);
    return action === ANY_KEY ? anyHeld : heldActions.has(action);
  }

  function released(action) {
    assertAction(action, true);
    return action === ANY_KEY ? anyReleased : releasedActions.has(action);
  }

  function axis() {
    return {
      x: (heldActions.has('right') ? 1 : 0) - (heldActions.has('left') ? 1 : 0),
      y: (heldActions.has('down') ? 1 : 0) - (heldActions.has('up') ? 1 : 0),
    };
  }

  function repeat(action, { delay = 300, rate = 80 } = {}) {
    assertAction(action, true);
    let state = repeatState.get(action);
    if (!state) repeatState.set(action, (state = { frame: -1, result: false, nextAt: 0, armed: false }));
    if (state.frame === frame) return state.result; // same answer for every caller in a frame
    const safeDelay = Math.max(0, Number(delay) || 0);
    const safeRate = Math.max(1, Number(rate) || 1);
    let result = false;
    if (pressed(action)) {
      result = true;
      state.armed = true;
      state.nextAt = frameNow + safeDelay;
    } else if (held(action) && state.armed) {
      if (frameNow >= state.nextAt) {
        result = true;
        state.nextAt += safeRate;
        if (state.nextAt <= frameNow) state.nextAt = frameNow + safeRate; // no burst after a stall
      }
    } else {
      state.armed = false;
    }
    state.frame = frame;
    state.result = result;
    return result;
  }

  function heldFor(action) {
    assertAction(action, false);
    const since = heldSince.get(action);
    return since === undefined ? 0 : Math.max(0, frameNow - since);
  }

  // ---- binding management -----------------------------------------------------------------
  function rebind(action, key, { device, slot } = {}) {
    assertAction(action, false);
    const keys = key == null ? [] : Array.isArray(key) ? [...key] : [key];
    let dev = device ?? null;
    for (const token of keys) {
      const tokenDev = tokenDevice(token);
      if (!tokenDev) throw new TypeError(`rebind: invalid token ${JSON.stringify(token)}`);
      if (dev === null) dev = tokenDev;
      else if (dev !== tokenDev) throw new TypeError('rebind: all tokens must belong to the same device');
    }
    if (dev === null) dev = 'keyboard';
    if (!DEVICES.includes(dev)) throw new TypeError(`rebind: unknown device ${JSON.stringify(dev)}`);
    const current = bindings[action];
    const others = current.filter((t) => tokenDevice(t) !== dev);
    let mine = current.filter((t) => tokenDevice(t) === dev);
    if (slot === undefined) {
      mine = keys;
    } else {
      const index = Math.max(0, Math.floor(Number(slot) || 0));
      if (keys.length === 0) mine.splice(index, 1);
      else if (index < mine.length) mine.splice(index, 1, ...keys);
      else mine.push(...keys);
    }
    bindings[action] = orderTokens([...others, ...mine]);
    rebuildIndex();
    return [...bindings[action]];
  }

  function addBinding(action, key) {
    assertAction(action, false);
    if (!tokenDevice(key)) throw new TypeError(`addBinding: invalid token ${JSON.stringify(key)}`);
    if (!bindings[action].includes(key)) {
      bindings[action] = orderTokens([...bindings[action], key]);
      rebuildIndex();
    }
    return [...bindings[action]];
  }

  function removeBinding(action, key) {
    assertAction(action, false);
    if (bindings[action].includes(key)) {
      bindings[action] = bindings[action].filter((t) => t !== key);
      rebuildIndex();
    }
    return [...bindings[action]];
  }

  function getBindings() {
    return cloneBindings(bindings);
  }

  function resetBindings() {
    bindings = cloneBindings(DEFAULT_BINDINGS);
    rebuildIndex();
  }

  function loadBindings(json) {
    const parsed = parseBindings(json);
    if (!parsed) return false;
    const actions = Object.keys(parsed.bindings);
    if (actions.length === 0) return false;
    const next = cloneBindings(DEFAULT_BINDINGS);
    for (const action of actions) next[action] = [...parsed.bindings[action]];
    bindings = next;
    rebuildIndex();
    return true;
  }

  function saveBindings() {
    return JSON.stringify({ version: BINDINGS_VERSION, bindings });
  }

  function actionsFor(token) {
    const actions = tokenToActions.get(token);
    return actions ? [...actions] : [];
  }

  // ---- haptics ---------------------------------------------------------------------------------
  function vibrate(ms = 50, { strong = 0.6, weak = 0.4 } = {}) {
    if (!vibrationEnabled || !(ms > 0)) return false;
    const duration = Math.min(MAX_VIBRATE_MS, Math.round(ms));
    let done = false;
    if (lastDevice === 'gamepad') {
      for (const pad of readGamepads()) {
        if (rumble(pad, duration, clamp01(strong), clamp01(weak))) done = true;
      }
    }
    if (!done && lastDevice === 'touch' && nav && typeof nav.vibrate === 'function') {
      try {
        done = Boolean(nav.vibrate(duration));
      } catch {
        done = false;
      }
    }
    return done;
  }

  // ---- toggles ---------------------------------------------------------------------------------
  function setEnabled(on) {
    const next = Boolean(on);
    if (next === enabled) return;
    enabled = next;
    if (!enabled) releaseAll();
  }

  function setTouchVisible(value) {
    if (!overlay) return;
    if (value === 'auto') {
      touchForced = false;
      overlay.setVisible(lastDevice === 'touch');
      return;
    }
    touchForced = true;
    overlay.setVisible(Boolean(value));
  }

  function destroy() {
    for (const off of subs.splice(0)) off();
    if (overlay) overlay.destroy();
    releaseAll();
    tokens.clear();
  }

  // ---- wiring --------------------------------------------------------------------------------
  listen(target, 'keydown', onKeyDown);
  listen(target, 'keyup', onKeyUp);
  listen(target, 'blur', () => releaseAll());
  listen(target, 'pointermove', onPointerMove);
  listen(target, 'pointerup', onPointerUp);
  listen(target, 'pointercancel', onPointerUp);
  listen(canvas, 'pointerdown', onCanvasPointerDown);
  listen(canvas, 'contextmenu', (ev) => {
    if (preventDefault && typeof ev.preventDefault === 'function') ev.preventDefault();
  });
  listen(doc, 'visibilitychange', () => {
    if (doc && (doc.hidden === true || doc.visibilityState === 'hidden')) releaseAll();
  });
  if (canvas.style && typeof canvas.style === 'object') canvas.style.touchAction = 'none';

  return {
    update,
    pressed,
    held,
    released,
    axis,
    repeat,
    flush,
    rebind,
    bindings: getBindings,
    resetBindings,
    loadBindings,
    saveBindings,
    vibrate,
    addBinding,
    removeBinding,
    actionsFor,
    heldFor,
    lastPressedToken: () => lastToken,
    setEnabled,
    setTouchVisible,
    setVibrationEnabled: (on) => {
      vibrationEnabled = Boolean(on);
    },
    destroy,
    get pointer() {
      return pointerSnapshot;
    },
    get lastDevice() {
      return lastDevice;
    },
    get enabled() {
      return enabled;
    },
    get touchVisible() {
      return overlay ? overlay.visible : false;
    },
    get vibrationEnabled() {
      return vibrationEnabled;
    },
    get gamepads() {
      return gamepadCount;
    },
    get frame() {
      return frame;
    },
  };
}

// ---- touch overlay --------------------------------------------------------------------------

/**
 * Build the DOM touch controls: an 8-way d-pad bottom-left, A/B bottom-right and a MENU pill
 * top-right. Returns a no-op shell when there is no document to draw into.
 * @param {{doc: Document|null, parent: HTMLElement|null, fixed: boolean,
 *   onToken: (token: string, down: boolean) => void}} spec
 */
function createTouchOverlay({ doc, parent, fixed, onToken }) {
  if (!doc || !parent || typeof doc.createElement !== 'function') {
    return { visible: false, setVisible() {}, release() {}, destroy() {} };
  }
  ensureOverlayStyle(doc);
  const root = doc.createElement('div');
  root.className = fixed ? 'wsp-touch' : 'wsp-touch wsp-touch--abs';
  root.setAttribute('aria-hidden', 'true');

  const dpad = doc.createElement('div');
  dpad.className = 'wsp-touch__dpad';
  dpad.setAttribute('role', 'group');
  dpad.setAttribute('aria-label', 'Directional pad');
  const arms = {};
  for (const [dir, glyph] of [['up', '▲'], ['down', '▼'], ['left', '◀'], ['right', '▶']]) {
    const arm = doc.createElement('div');
    arm.className = `wsp-touch__arm wsp-touch__arm--${dir}`;
    arm.textContent = glyph;
    dpad.appendChild(arm);
    arms[dir] = arm;
  }
  const hub = doc.createElement('div');
  hub.className = 'wsp-touch__hub';
  dpad.appendChild(hub);
  root.appendChild(dpad);

  const buttons = {};
  for (const [name, label] of [['b', 'B'], ['a', 'A'], ['menu', 'MENU']]) {
    const el = doc.createElement('div');
    el.className = `wsp-touch__btn wsp-touch__btn--${name}`;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', label);
    el.textContent = label;
    root.appendChild(el);
    buttons[name] = el;
  }

  const subs = [];
  const listen = (el, type, fn) => {
    el.addEventListener(type, fn, { passive: false });
    subs.push(() => el.removeEventListener(type, fn, { passive: false }));
  };
  listen(root, 'contextmenu', (ev) => ev.preventDefault());

  let dpadPointer = null;
  let dirs = NO_DIRS;
  const applyDirs = (next) => {
    for (const dir of DIRS) {
      if (next[dir] === dirs[dir]) continue;
      arms[dir].classList.toggle('is-on', next[dir]);
      onToken(`touch:${dir}`, next[dir]);
    }
    dirs = next;
  };
  const dpadMove = (ev) => {
    const rect = dpad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    applyDirs(dpadDirections(ev.clientX - cx, ev.clientY - cy, rect.width * 0.08));
  };
  const dpadEnd = (ev) => {
    if (dpadPointer === null || pointerId(ev) !== dpadPointer) return;
    dpadPointer = null;
    applyDirs(NO_DIRS);
  };
  listen(dpad, 'pointerdown', (ev) => {
    if (dpadPointer !== null) return;
    ev.preventDefault();
    dpadPointer = pointerId(ev);
    capturePointer(dpad, dpadPointer);
    dpadMove(ev);
  });
  listen(dpad, 'pointermove', (ev) => {
    if (dpadPointer === null || pointerId(ev) !== dpadPointer) return;
    dpadMove(ev);
  });
  listen(dpad, 'pointerup', dpadEnd);
  listen(dpad, 'pointercancel', dpadEnd);
  listen(dpad, 'lostpointercapture', dpadEnd);

  const buttonPointers = {};
  for (const [name, el] of Object.entries(buttons)) {
    buttonPointers[name] = null;
    const token = `touch:${name}`;
    const end = (ev) => {
      if (buttonPointers[name] === null || pointerId(ev) !== buttonPointers[name]) return;
      buttonPointers[name] = null;
      el.classList.remove('is-on');
      onToken(token, false);
    };
    listen(el, 'pointerdown', (ev) => {
      if (buttonPointers[name] !== null) return;
      ev.preventDefault();
      buttonPointers[name] = pointerId(ev);
      capturePointer(el, buttonPointers[name]);
      el.classList.add('is-on');
      onToken(token, true);
    });
    listen(el, 'pointerup', end);
    listen(el, 'pointercancel', end);
    listen(el, 'lostpointercapture', end);
  }

  parent.appendChild(root);
  let visible = true;
  return {
    get visible() {
      return visible;
    },
    setVisible(on) {
      visible = Boolean(on);
      root.hidden = !visible;
    },
    /** Lift every finger (focus loss); emits the matching release tokens. */
    release() {
      dpadPointer = null;
      applyDirs(NO_DIRS);
      for (const [name, el] of Object.entries(buttons)) {
        if (buttonPointers[name] === null) continue;
        buttonPointers[name] = null;
        el.classList.remove('is-on');
        onToken(`touch:${name}`, false);
      }
    },
    destroy() {
      for (const off of subs.splice(0)) off();
      if (typeof root.remove === 'function') root.remove();
      else if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

function ensureOverlayStyle(doc) {
  if (typeof doc.getElementById === 'function' && doc.getElementById(OVERLAY_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = OVERLAY_STYLE_ID;
  style.textContent = OVERLAY_CSS;
  const host = doc.head || doc.body || doc.documentElement;
  if (host) host.appendChild(style);
}

function pointerId(ev) {
  return typeof ev.pointerId === 'number' ? ev.pointerId : 0;
}

function capturePointer(el, id) {
  if (typeof el.setPointerCapture !== 'function') return;
  try {
    el.setPointerCapture(id);
  } catch {
    // synthetic events have no active pointer to capture
  }
}

// ---- small helpers ---------------------------------------------------------------------------

function rumble(pad, duration, strong, weak) {
  const actuator = pad && pad.vibrationActuator;
  if (actuator && typeof actuator.playEffect === 'function') {
    try {
      swallow(actuator.playEffect('dual-rumble', {
        startDelay: 0, duration, strongMagnitude: strong, weakMagnitude: weak,
      }));
      return true;
    } catch {
      return false;
    }
  }
  const haptic = pad && Array.isArray(pad.hapticActuators) ? pad.hapticActuators[0] : null;
  if (haptic && typeof haptic.pulse === 'function') {
    try {
      swallow(haptic.pulse(strong, duration));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function swallow(maybePromise) {
  if (maybePromise && typeof maybePromise.catch === 'function') maybePromise.catch(() => {});
}

function assertAction(action, allowAny) {
  if (ACTION_SET.has(action) || (allowAny && action === ANY_KEY)) return;
  throw new RangeError(`input: unknown action ${JSON.stringify(action)}`);
}

function isEditable(el) {
  if (!el || typeof el !== 'object') return false;
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function mediaMatches(matchMedia, query) {
  if (typeof matchMedia !== 'function') return false;
  try {
    const result = matchMedia(query);
    return Boolean(result && result.matches);
  } catch {
    return false;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneBindings(source) {
  /** @type {Bindings} */
  const out = {};
  for (const action of ACTION_LIST) out[action] = source[action] ? [...source[action]] : [];
  return out;
}

function freezeBindings(table) {
  for (const key of Object.keys(table)) Object.freeze(table[key]);
  return Object.freeze(table);
}

/** De-duplicate and group tokens keyboard -> gamepad -> touch, keeping relative order. */
function orderTokens(list) {
  const unique = list.filter((item, index) => list.indexOf(item) === index);
  return DEVICES.flatMap((device) => unique.filter((token) => tokenDevice(token) === device));
}

function clamp01(value) {
  const n = Number(value);
  return n > 1 ? 1 : n >= 0 ? n : 0;
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function defaultNow() {
  const perf = globalThis.performance;
  return perf && typeof perf.now === 'function' ? perf.now() : Date.now();
}

function safeNow(now) {
  const t = Number(now());
  return Number.isFinite(t) ? t : 0;
}
