/**
 * @module core/scene
 *
 * A scene stack with screen transitions. Pure: it never touches `document` or `window`, only the
 * 2D context handed to `draw(ctx)`, so it runs and is unit-tested under Node with a fake context.
 *
 * Model
 *  - The stack is a list of scenes, bottom to top. Only the TOP scene is active: it alone receives
 *    `handleInput(input)` and, normally, `update(dt)`. Scenes beneath it are paused (they received
 *    `pause()` when something was pushed over them) and get `resume(result)` when they become top
 *    again after a pop.
 *  - Drawing starts at the topmost OPAQUE scene and proceeds upward, so non-opaque scenes (modals,
 *    dialogue boxes, pause menus) are drawn over whatever lies beneath them. `opaque` defaults to
 *    true. Each scene draws inside its own `save()`/`restore()` pair so state cannot leak between
 *    scenes.
 *  - A scene whose `updateBelow` is true additionally lets the scene directly beneath it keep
 *    updating (and so on down the chain while each scene opts in), for modals over a world that
 *    should keep animating. Input never reaches anything but the top scene.
 *  - Transitions (`fade`, `iris`, `wipe`) are drawn by the stack on top of everything. A transition
 *    has an OUT phase (the screen covers), an optional HOLD, and an IN phase (the screen uncovers).
 *    The callback given to `transition()` fires exactly once, at the moment the screen is fully
 *    covered, which is where scene changes belong. Input is ignored while a transition runs and the
 *    input is flushed when it ends, so buffered presses never leak into the new scene.
 *  - Scene changes made from inside lifecycle hooks (a scene that pushes a modal from `enter`, or
 *    pops itself from `update`) are applied immediately. The stack is always mutated before any hook
 *    runs, so re-entrant calls observe a consistent stack. Errors thrown by hooks propagate to the
 *    caller; the structural change that preceded the hook stays applied.
 *  - Hooks stay strictly paired however a hook re-enters the stack: `enter` is skipped for a scene
 *    that a hook removed before it could enter, `exit` only reaches a scene that entered, `pause`
 *    only reaches an active scene and `resume` only a paused one, and a scene that finds itself
 *    beneath another right after entering is paused at once. So when any call returns, the top
 *    scene is active and every scene beneath it is paused.
 *
 * Time: `update(dt)` takes MILLISECONDS, the same unit as the `ms` argument of `transition()` and
 * every other duration in the engine.
 *
 * Everything here is deterministic: identical call sequences produce identical hook invocations and
 * identical draw calls.
 */

/**
 * The transition kinds `transition()` accepts, in the order they are documented.
 * @type {ReadonlyArray<TransitionKind>}
 */
export const TRANSITION_KINDS = Object.freeze(['fade', 'iris', 'wipe', 'none']);

/**
 * Directions a `wipe` edge can travel. The default is `'right'` (the edge moves left to right).
 * @type {ReadonlyArray<WipeDirection>}
 */
export const WIPE_DIRECTIONS = Object.freeze(['right', 'left', 'down', 'up']);

/** Duration used when `transition()` is called without `ms`, in milliseconds. */
export const DEFAULT_TRANSITION_MS = 400;

/** Overlay colour used when a transition does not specify one. */
export const DEFAULT_TRANSITION_COLOR = '#000000';

/** Overlay width used when neither the stack options nor `ctx.canvas` provide one. */
export const DEFAULT_WIDTH = 480;

/** Overlay height used when neither the stack options nor `ctx.canvas` provide one. */
export const DEFAULT_HEIGHT = 270;

/**
 * @typedef {'fade'|'iris'|'wipe'|'none'} TransitionKind
 */

/**
 * @typedef {'right'|'left'|'down'|'up'} WipeDirection
 */

/**
 * @typedef {'out'|'hold'|'in'} TransitionPhase
 */

/**
 * The scene interface. Every hook is optional; a plain `{ draw }` object is a valid scene.
 * Hooks are invoked as methods (`this` is the scene), so class instances work unchanged.
 * @typedef {Object} Scene
 * @property {string} [name] Used by `find(name)` and in error messages.
 * @property {boolean} [opaque=true] When false, the scenes beneath are drawn as well (modal).
 * @property {boolean} [updateBelow=false] When true, the scene beneath keeps receiving `update`.
 * @property {(params: any) => void} [enter] Called once when the scene is pushed or replaces another.
 * @property {() => void} [exit] Called once when the scene is popped, replaced or cleared.
 * @property {() => void} [pause] Called when another scene is pushed on top of this one.
 * @property {(result: any) => void} [resume] Called when this scene becomes top again after a pop.
 * @property {(dt: number) => void} [update] Per-frame logic; `dt` in milliseconds.
 * @property {(ctx: CanvasRenderingContext2D) => void} [draw] Per-frame rendering.
 * @property {(input: any) => void} [handleInput] Per-frame input, only while this scene is top.
 */

/**
 * Snapshot of a running transition, as returned by `transitionState()`.
 * @typedef {Object} TransitionState
 * @property {TransitionKind} kind
 * @property {string} color
 * @property {WipeDirection} direction
 * @property {number} ms Duration of out + in phases together.
 * @property {number} hold Duration of the fully-covered hold between them.
 * @property {number} elapsed Milliseconds elapsed so far (never exceeds `total`).
 * @property {number} total `ms + hold`.
 * @property {number} progress `elapsed / total`, 0..1.
 * @property {TransitionPhase} phase
 * @property {number} coverage How much of the screen the overlay hides, 0..1.
 * @property {boolean} fired Whether the midpoint callback has run.
 */

/**
 * Pure description of a transition at a point in time, as computed by {@link transitionFrame}.
 * @typedef {Object} TransitionFrame
 * @property {TransitionPhase} phase
 * @property {number} coverage 0 (nothing hidden) .. 1 (fully hidden).
 * @property {number} progress 0..1 over the whole transition, hold included.
 * @property {boolean} done True once `elapsed` has reached `ms + hold`.
 */

/**
 * @typedef {Object} TransitionOptions
 * @property {string} [color='#000000'] Overlay colour (any canvas fill style string).
 * @property {number} [hold=0] Milliseconds to stay fully covered between the out and in phases.
 * @property {WipeDirection} [direction='right'] Edge direction for `wipe`; ignored otherwise.
 * @property {(stack: SceneStack) => void} [onDone] Called once when the transition has finished.
 */

/**
 * @typedef {Object} DrawTransitionOptions
 * @property {number} [width] Overlay width; defaults to `ctx.canvas.width`, then 480.
 * @property {number} [height] Overlay height; defaults to `ctx.canvas.height`, then 270.
 * @property {string} [color='#000000']
 * @property {WipeDirection} [direction='right']
 */

/**
 * Describes a structural change of the stack, handed to the `onChange` option.
 * @typedef {Object} ChangeEvent
 * @property {'push'|'pop'|'replace'|'clear'} type
 * @property {Scene|null} scene The scene pushed, popped, or entered by a replace; null for clear.
 * @property {Scene|null} top The top scene after the change.
 * @property {Scene} [replaced] For `replace`: the scene that left.
 * @property {Scene[]} [removed] For `clear`: the scenes that left, top first.
 */

/**
 * @typedef {Object} StackOptions
 * @property {{flush?: () => void}} [input] An input object whose `flush()` is called on every scene
 *   change and when a transition ends. The object passed to `handleInput()` is used otherwise.
 * @property {(event: ChangeEvent) => void} [onChange] Observer for structural changes (for music
 *   cues, debug overlays, analytics). Called after the hooks of the change have run.
 * @property {number} [width] Overlay width override; by default `ctx.canvas.width` is used.
 * @property {number} [height] Overlay height override; by default `ctx.canvas.height` is used.
 */

/**
 * @typedef {Object} SceneStack
 * @property {(scene: Scene, params?: any) => Scene} push
 *   Pauses the current top, pushes `scene` and calls its `enter(params)` (`params` defaults to `{}`).
 *   Returns `scene`. Throws if `scene` is not an object or is already on the stack.
 * @property {(result?: any) => Scene|null} pop
 *   Removes the top scene (calling `exit()`), then `resume(result)` on the new top. Returns the
 *   removed scene, or null when the stack was empty.
 * @property {(scene: Scene, params?: any) => Scene|null} replace
 *   Swaps the top scene for `scene`: the old one gets `exit()`, the new one `enter(params)`. The
 *   scene beneath is neither paused nor resumed. Replacing the top with itself restarts it. On an
 *   empty stack this behaves like `push`. Returns the scene that left, or null.
 * @property {() => Scene|null} top The top scene, or null.
 * @property {Scene[]} stack A copy of the scenes, bottom to top.
 * @property {number} size Number of scenes on the stack.
 * @property {boolean} isTransitioning Whether a transition is running (input is ignored meanwhile).
 * @property {(dt: number) => void} update
 *   Advances a running transition (firing its callback at the midpoint), then updates the top scene
 *   and any `updateBelow` chain, bottom to top. `dt` is in milliseconds; negative values count as 0.
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 *   Draws the visible scenes bottom to top, then the transition overlay.
 * @property {(input: any) => boolean} handleInput
 *   Forwards `input` to the top scene's `handleInput`. Returns true if a scene received it; false
 *   during a transition, on an empty stack, or when the top has no `handleInput`.
 * @property {(kind: TransitionKind, ms?: number, fn?: (stack: SceneStack) => void, options?: TransitionOptions) => boolean} transition
 *   Starts a transition of `ms` milliseconds (half out, half in, plus `options.hold` covered in the
 *   middle). `fn(stack)` runs exactly once when the screen is fully covered. Returns true if the
 *   transition started. While another transition is running the call is ignored and returns false.
 *   `'none'`, or a total duration of 0, runs `fn` synchronously and returns true even while busy.
 * @property {() => TransitionState|null} transitionState Snapshot of the running transition.
 * @property {(name: string) => Scene|null} find
 *   The topmost scene with that `name`, or null (always null for a non-string name).
 * @property {(scene: Scene) => boolean} has Whether `scene` is on the stack.
 * @property {() => Scene[]} clear
 *   Cancels any transition and exits every scene, top to bottom. Returns the removed scenes.
 */

/**
 * Human-friendly description of a value for error messages.
 * @param {unknown} value
 * @returns {string}
 */
function describe(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Short label for a scene in error messages.
 * @param {Scene} scene
 * @returns {string}
 */
function label(scene) {
  return typeof scene.name === 'string' && scene.name.length ? JSON.stringify(scene.name) : 'scene';
}

/**
 * Whether `value` can carry scene hooks.
 * @param {unknown} value
 * @returns {value is object}
 */
function isPlainObjectLike(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Throws unless `scene` is an object that can be pushed.
 * @param {unknown} scene
 * @param {string} method
 * @returns {asserts scene is Scene}
 */
function assertScene(scene, method) {
  if (typeof scene === 'function') {
    throw new TypeError(`scene.${method}: expected a scene object but got a function (did you forget \`new\`?)`);
  }
  if (!isPlainObjectLike(scene)) {
    throw new TypeError(`scene.${method}: expected a scene object, got ${describe(scene)}`);
  }
}

/**
 * Throws unless `fn` is a function, null or undefined.
 * @param {unknown} fn
 * @param {string} what
 * @param {string} method
 * @returns {asserts fn is Function|null|undefined}
 */
function assertOptionalFn(fn, what, method) {
  if (fn !== undefined && fn !== null && typeof fn !== 'function') {
    throw new TypeError(`scene.${method}: ${what} must be a function, got ${describe(fn)}`);
  }
}

/**
 * Throws unless `value` is a finite, non-negative number.
 * @param {unknown} value
 * @param {string} what
 * @param {string} method
 * @returns {asserts value is number}
 */
function assertDuration(value, what, method) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`scene.${method}: ${what} must be a finite number >= 0, got ${describe(value)}`);
  }
}

/**
 * Throws unless `value` is a finite positive number, or undefined.
 * @param {unknown} value
 * @param {string} what
 * @param {string} method
 * @returns {asserts value is number|undefined}
 */
function assertOptionalSize(value, what, method) {
  if (value === undefined) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`scene.${method}: ${what} must be a finite number > 0, got ${describe(value)}`);
  }
}

/**
 * Clamps to the unit interval.
 * @param {number} x
 * @returns {number}
 */
function clamp01(x) {
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

/**
 * Invokes `scene[hook](...args)` as a method when the hook exists.
 * @param {Scene} scene
 * @param {keyof Scene} hook
 * @param {...any} args
 * @returns {void}
 */
function invoke(scene, hook, ...args) {
  const fn = scene[hook];
  if (typeof fn === 'function') fn.call(scene, ...args);
}

/**
 * Runs `fn` between `ctx.save()` and `ctx.restore()` when the context supports them, restoring even
 * if `fn` throws.
 * @param {CanvasRenderingContext2D} ctx
 * @param {() => void} fn
 * @returns {void}
 */
function withState(ctx, fn) {
  const canSave = typeof ctx.save === 'function' && typeof ctx.restore === 'function';
  if (!canSave) {
    fn();
    return;
  }
  ctx.save();
  try {
    fn();
  } finally {
    ctx.restore();
  }
}

/**
 * Whether `kind` is one of {@link TRANSITION_KINDS}.
 * @param {unknown} kind
 * @returns {kind is TransitionKind}
 */
export function isTransitionKind(kind) {
  return typeof kind === 'string' && TRANSITION_KINDS.includes(/** @type {TransitionKind} */ (kind));
}

/**
 * Whether `direction` is one of {@link WIPE_DIRECTIONS}.
 * @param {unknown} direction
 * @returns {direction is WipeDirection}
 */
export function isWipeDirection(direction) {
  return typeof direction === 'string' && WIPE_DIRECTIONS.includes(/** @type {WipeDirection} */ (direction));
}

/**
 * Pure timing curve of a transition: `ms / 2` of OUT (coverage 0 -> 1), `hold` of HOLD (coverage 1),
 * then `ms / 2` of IN (coverage 1 -> 0). `elapsed` is clamped to `[0, ms + hold]`. With `ms` of 0
 * the frame is fully covered for the hold and then done.
 * @param {number} elapsed Milliseconds since the transition started.
 * @param {number} ms Out + in duration in milliseconds (>= 0).
 * @param {number} [hold=0] Hold duration in milliseconds (>= 0).
 * @returns {TransitionFrame}
 */
export function transitionFrame(elapsed, ms, hold = 0) {
  if (typeof elapsed !== 'number' || !Number.isFinite(elapsed)) {
    throw new TypeError(`scene.transitionFrame: elapsed must be a finite number, got ${describe(elapsed)}`);
  }
  assertDuration(ms, 'ms', 'transitionFrame');
  assertDuration(hold, 'hold', 'transitionFrame');
  const half = ms / 2;
  const total = ms + hold;
  if (!Number.isFinite(total)) {
    throw new TypeError(`scene.transitionFrame: ms + hold must be finite, got ${ms} + ${hold}`);
  }
  const e = Math.min(Math.max(elapsed, 0), total);
  /** @type {TransitionPhase} */
  let phase;
  let coverage;
  if (e < half) {
    phase = 'out';
    coverage = e / half;
  } else if (e < half + hold) {
    phase = 'hold';
    coverage = 1;
  } else {
    phase = 'in';
    coverage = half > 0 ? 1 - (e - half - hold) / half : 0;
  }
  return {
    phase,
    coverage: clamp01(coverage),
    progress: total > 0 ? e / total : 1,
    done: e >= total,
  };
}

/**
 * Fills the part of the screen a wipe hides. During OUT the covered band grows from the edge the
 * wipe starts at; during IN it shrinks away from the same side, so the visible edge keeps travelling
 * in one direction for the whole transition. Edges are snapped to whole pixels.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {TransitionFrame} frame
 * @param {WipeDirection} direction
 * @returns {boolean} Whether anything was painted.
 */
function drawWipe(ctx, w, h, frame, direction) {
  if (frame.phase === 'hold') {
    ctx.fillRect(0, 0, w, h);
    return true;
  }
  const horizontal = direction === 'right' || direction === 'left';
  const span = horizontal ? w : h;
  const band = Math.round(span * frame.coverage);
  if (band <= 0) return false;
  // The band hugs the start edge while covering, and the far edge while uncovering.
  const startsAtOrigin = direction === 'right' || direction === 'down';
  const atOrigin = frame.phase === 'out' ? startsAtOrigin : !startsAtOrigin;
  const offset = atOrigin ? 0 : span - band;
  if (horizontal) ctx.fillRect(offset, 0, band, h);
  else ctx.fillRect(0, offset, w, band);
  return true;
}

/**
 * Fills everything outside a centred circle whose radius shrinks with coverage, using whole-pixel
 * scanlines so the edge stays crisp on a pixel-art buffer. Rows fully outside the circle are merged
 * into two rectangles; the rest get at most two rectangles each, which never overlap.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {number} coverage 0..1
 * @returns {boolean} Whether anything was painted.
 */
function drawIris(ctx, w, h, coverage) {
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.hypot(cx, cy) * (1 - coverage);
  if (radius <= 0) {
    ctx.fillRect(0, 0, w, h);
    return true;
  }
  let drew = false;
  const top = Math.max(0, Math.floor(cy - radius));
  const bottom = Math.min(h, Math.ceil(cy + radius));
  if (top > 0) {
    ctx.fillRect(0, 0, w, top);
    drew = true;
  }
  if (bottom < h) {
    ctx.fillRect(0, bottom, w, h - bottom);
    drew = true;
  }
  const r2 = radius * radius;
  for (let y = top; y < bottom; y++) {
    const dy = y + 0.5 - cy;
    const halfWidth = Math.sqrt(Math.max(0, r2 - dy * dy));
    const left = Math.floor(cx - halfWidth);
    const right = Math.ceil(cx + halfWidth);
    if (left > 0) {
      ctx.fillRect(0, y, Math.min(left, w), 1);
      drew = true;
    }
    if (right < w) {
      ctx.fillRect(Math.max(right, 0), y, w - Math.max(right, 0), 1);
      drew = true;
    }
  }
  return drew;
}

/**
 * Draws the overlay of a transition for the given frame, on top of whatever is already on `ctx`.
 * The context's transform, alpha and composite operation are reset for the overlay and restored
 * afterwards. Only `fillRect` is required of the context, so pixel-art buffers and test doubles both
 * work. Nothing is drawn for `'none'`, a coverage of 0, or a band thinner than a pixel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {TransitionKind} kind
 * @param {TransitionFrame} frame From {@link transitionFrame}.
 * @param {DrawTransitionOptions} [options]
 * @returns {boolean} Whether anything was drawn.
 */
export function drawTransition(ctx, kind, frame, options = {}) {
  if (!isPlainObjectLike(ctx)) {
    throw new TypeError(`scene.drawTransition: ctx must be a canvas context, got ${describe(ctx)}`);
  }
  if (!isTransitionKind(kind)) {
    throw new TypeError(`scene.drawTransition: unknown transition kind ${describe(kind)}`);
  }
  if (!isPlainObjectLike(frame) || typeof frame.coverage !== 'number') {
    throw new TypeError('scene.drawTransition: frame must come from transitionFrame()');
  }
  const { width, height, color = DEFAULT_TRANSITION_COLOR, direction = 'right' } = options ?? {};
  assertOptionalSize(width, 'width', 'drawTransition');
  assertOptionalSize(height, 'height', 'drawTransition');
  if (!isWipeDirection(direction)) {
    throw new TypeError(`scene.drawTransition: unknown wipe direction ${describe(direction)}`);
  }
  if (kind === 'none') return false;
  const coverage = clamp01(frame.coverage);
  if (coverage <= 0) return false;

  const canvas = isPlainObjectLike(ctx.canvas) ? ctx.canvas : null;
  const w = width ?? (canvas && canvas.width > 0 ? canvas.width : DEFAULT_WIDTH);
  const h = height ?? (canvas && canvas.height > 0 ? canvas.height : DEFAULT_HEIGHT);
  const phase = frame.phase === 'out' || frame.phase === 'in' ? frame.phase : 'hold';
  let drew = false;

  withState(ctx, () => {
    if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    switch (kind) {
      case 'fade':
        ctx.globalAlpha = coverage;
        ctx.fillRect(0, 0, w, h);
        drew = true;
        break;
      case 'wipe':
        drew = drawWipe(ctx, w, h, { ...frame, phase, coverage }, direction);
        break;
      default:
        drew = drawIris(ctx, w, h, coverage);
        break;
    }
  });
  return drew;
}

/**
 * Validates and normalizes the options of {@link createSceneStack}.
 * @param {StackOptions|null|undefined} options
 * @returns {StackOptions}
 */
function normalizeOptions(options) {
  if (options === undefined || options === null) return {};
  if (!isPlainObjectLike(options)) {
    throw new TypeError(`scene.createSceneStack: options must be an object, got ${describe(options)}`);
  }
  const { input, onChange, width, height } = options;
  if (input !== undefined && input !== null && !isPlainObjectLike(input)) {
    throw new TypeError(`scene.createSceneStack: input must be an object, got ${describe(input)}`);
  }
  assertOptionalFn(onChange, 'onChange', 'createSceneStack');
  assertOptionalSize(width, 'width', 'createSceneStack');
  assertOptionalSize(height, 'height', 'createSceneStack');
  return { input: input ?? undefined, onChange: onChange ?? undefined, width, height };
}

/**
 * Creates an empty scene stack. See the module documentation for the lifecycle rules.
 * @param {StackOptions} [options]
 * @returns {SceneStack}
 */
export function createSceneStack(options) {
  const opts = normalizeOptions(options);

  /** @type {Scene[]} */
  const scenes = [];

  /**
   * The running transition, if any. `fired` guards the midpoint callback so it runs exactly once
   * even when a single large `dt` jumps past the end.
   * @type {{kind: TransitionKind, color: string, direction: WipeDirection, ms: number, hold: number,
   *   total: number, half: number, elapsed: number, fired: boolean,
   *   fn: ((stack: SceneStack) => void)|null, onDone: ((stack: SceneStack) => void)|null}|null}
   */
  let transition = null;

  /** The most recent input object seen, whose `flush()` is called on scene changes. */
  let inputRef = opts.input;

  /** Scenes that received `enter()` and not yet `exit()`. @type {WeakSet<Scene>} */
  const entered = new WeakSet();

  /** Entered scenes that received `pause()` and not yet `resume()`. @type {WeakSet<Scene>} */
  const paused = new WeakSet();

  /** @returns {Scene|null} */
  const topScene = () => (scenes.length ? scenes[scenes.length - 1] : null);

  /**
   * Sends `pause()` to an active scene. A scene that never entered, or is already paused (a hook
   * re-entered the stack), gets nothing: `pause` means "you stopped being the top scene".
   * @param {Scene} scene
   */
  function pauseScene(scene) {
    if (!entered.has(scene) || paused.has(scene)) return;
    paused.add(scene);
    invoke(scene, 'pause');
  }

  /**
   * Sends `resume(result)` to a paused scene; an active scene or one that never entered gets nothing.
   * @param {Scene} scene
   * @param {any} result
   */
  function resumeScene(scene, result) {
    if (!paused.has(scene)) return;
    paused.delete(scene);
    invoke(scene, 'resume', result);
  }

  /**
   * Sends `enter(params)` to a scene that is (still) on the stack. The scene counts as entered even
   * if its hook throws, so it will still be exited later. A scene that a re-entrant hook pushed
   * something over while it was entering is paused straight away, keeping "top = active" true.
   * @param {Scene} scene
   * @param {any} params
   */
  function enterScene(scene, params) {
    if (!scenes.includes(scene)) return;
    entered.add(scene);
    try {
      invoke(scene, 'enter', params);
    } finally {
      if (scenes.includes(scene) && topScene() !== scene) pauseScene(scene);
    }
  }

  /**
   * Sends `exit()` to a scene that entered; a scene removed before it ever entered gets nothing.
   * @param {Scene} scene
   */
  function exitScene(scene) {
    if (!entered.has(scene)) return;
    entered.delete(scene);
    paused.delete(scene);
    invoke(scene, 'exit');
  }

  /** Discards buffered presses so a held key never counts as a press in a new scene. */
  function flushInput() {
    if (inputRef && typeof inputRef.flush === 'function') inputRef.flush();
  }

  /**
   * @param {ChangeEvent['type']} type
   * @param {Scene|null} scene
   * @param {Partial<ChangeEvent>} [extra]
   */
  function notify(type, scene, extra) {
    if (opts.onChange) opts.onChange({ type, scene, top: topScene(), ...extra });
  }

  /** Index of the topmost opaque scene (0 when none is opaque), i.e. where drawing starts. */
  function firstVisibleIndex() {
    for (let i = scenes.length - 1; i > 0; i--) {
      if (scenes[i].opaque !== false) return i;
    }
    return 0;
  }

  /** The scenes that receive `update`, bottom to top: the top plus its `updateBelow` chain. */
  function updateTargets() {
    const targets = [];
    for (let i = scenes.length - 1; i >= 0; i--) {
      targets.push(scenes[i]);
      if (scenes[i].updateBelow !== true) break;
    }
    return targets.reverse();
  }

  /**
   * Advances the running transition by `step` ms, firing the midpoint callback and finishing when
   * due. Re-reads `transition` after the callback because it may have cancelled it via `clear()`.
   * @param {number} step
   */
  function advanceTransition(step) {
    const t = transition;
    if (!t) return;
    t.elapsed = Math.min(t.total, t.elapsed + step);
    if (!t.fired && t.elapsed >= t.half) {
      t.fired = true;
      if (t.fn) t.fn(api);
      if (transition !== t) return;
    }
    if (t.elapsed >= t.total) {
      transition = null;
      flushInput();
      if (t.onDone) t.onDone(api);
    }
  }

  /**
   * @param {Scene} scene
   * @param {any} params
   * @returns {Scene}
   */
  function push(scene, params = {}) {
    assertScene(scene, 'push');
    if (scenes.includes(scene)) {
      throw new Error(`scene.push: ${label(scene)} is already on the stack`);
    }
    const previous = topScene();
    scenes.push(scene);
    if (previous) pauseScene(previous);
    enterScene(scene, params);
    flushInput();
    notify('push', scene);
    return scene;
  }

  /**
   * @param {any} result
   * @returns {Scene|null}
   */
  function pop(result) {
    const scene = scenes.pop();
    if (!scene) return null;
    exitScene(scene);
    const next = topScene();
    if (next) resumeScene(next, result);
    flushInput();
    notify('pop', scene);
    return scene;
  }

  /**
   * @param {Scene} scene
   * @param {any} params
   * @returns {Scene|null}
   */
  function replace(scene, params = {}) {
    assertScene(scene, 'replace');
    const index = scenes.length - 1;
    if (index < 0) {
      push(scene, params);
      return null;
    }
    const old = scenes[index];
    if (old !== scene && scenes.includes(scene)) {
      throw new Error(`scene.replace: ${label(scene)} is already on the stack`);
    }
    scenes[index] = scene;
    exitScene(old);
    enterScene(scene, params);
    flushInput();
    notify('replace', scene, { replaced: old });
    return old;
  }

  /** @returns {Scene[]} */
  function clear() {
    transition = null;
    const removed = [];
    while (scenes.length) {
      const scene = /** @type {Scene} */ (scenes.pop());
      removed.push(scene);
      exitScene(scene);
    }
    flushInput();
    notify('clear', null, { removed: removed.slice() });
    return removed;
  }

  /** @param {number} dt */
  function update(dt) {
    if (typeof dt !== 'number' || !Number.isFinite(dt)) {
      throw new TypeError(`scene.update: dt must be a finite number of milliseconds, got ${describe(dt)}`);
    }
    const step = Math.max(0, dt);
    advanceTransition(step);
    for (const scene of updateTargets()) {
      if (scenes.includes(scene)) invoke(scene, 'update', step);
    }
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    if (!isPlainObjectLike(ctx)) {
      throw new TypeError(`scene.draw: ctx must be a canvas context, got ${describe(ctx)}`);
    }
    for (const scene of scenes.slice(firstVisibleIndex())) {
      if (scenes.includes(scene)) withState(ctx, () => invoke(scene, 'draw', ctx));
    }
    const t = transition;
    if (t) {
      drawTransition(ctx, t.kind, transitionFrame(t.elapsed, t.ms, t.hold), {
        width: opts.width,
        height: opts.height,
        color: t.color,
        direction: t.direction,
      });
    }
  }

  /**
   * @param {any} input
   * @returns {boolean}
   */
  function handleInput(input) {
    if (isPlainObjectLike(input)) inputRef = input;
    if (transition) return false;
    const scene = topScene();
    if (!scene || typeof scene.handleInput !== 'function') return false;
    scene.handleInput(input);
    return true;
  }

  /**
   * @param {TransitionKind} kind
   * @param {number} [ms]
   * @param {(stack: SceneStack) => void} [fn]
   * @param {TransitionOptions} [options]
   * @returns {boolean}
   */
  function startTransition(kind, ms = DEFAULT_TRANSITION_MS, fn, options) {
    if (!isTransitionKind(kind)) {
      throw new TypeError(
        `scene.transition: kind must be one of ${TRANSITION_KINDS.join(', ')}, got ${describe(kind)}`,
      );
    }
    assertDuration(ms, 'ms', 'transition');
    assertOptionalFn(fn, 'fn', 'transition');
    if (options !== undefined && options !== null && !isPlainObjectLike(options)) {
      throw new TypeError(`scene.transition: options must be an object, got ${describe(options)}`);
    }
    const { color = DEFAULT_TRANSITION_COLOR, hold = 0, direction = 'right', onDone } = options ?? {};
    assertDuration(hold, 'hold', 'transition');
    assertOptionalFn(onDone, 'onDone', 'transition');
    if (typeof color !== 'string' || color.length === 0) {
      throw new TypeError(`scene.transition: color must be a non-empty string, got ${describe(color)}`);
    }
    if (!isWipeDirection(direction)) {
      throw new TypeError(
        `scene.transition: direction must be one of ${WIPE_DIRECTIONS.join(', ')}, got ${describe(direction)}`,
      );
    }

    const total = ms + hold;
    if (!Number.isFinite(total)) {
      throw new TypeError(`scene.transition: ms + hold must be finite, got ${ms} + ${hold}`);
    }
    if (kind === 'none' || total <= 0) {
      if (fn) fn(api);
      if (onDone) onDone(api);
      return true;
    }
    if (transition) return false;
    transition = {
      kind,
      color,
      direction,
      ms,
      hold,
      total,
      half: ms / 2,
      elapsed: 0,
      fired: false,
      fn: fn ?? null,
      onDone: onDone ?? null,
    };
    return true;
  }

  /** @returns {TransitionState|null} */
  function transitionState() {
    const t = transition;
    if (!t) return null;
    const frame = transitionFrame(t.elapsed, t.ms, t.hold);
    return Object.freeze({
      kind: t.kind,
      color: t.color,
      direction: t.direction,
      ms: t.ms,
      hold: t.hold,
      elapsed: t.elapsed,
      total: t.total,
      progress: frame.progress,
      phase: frame.phase,
      coverage: frame.coverage,
      fired: t.fired,
    });
  }

  /**
   * @param {string} name
   * @returns {Scene|null}
   */
  function find(name) {
    if (typeof name !== 'string') return null;
    for (let i = scenes.length - 1; i >= 0; i--) {
      if (scenes[i].name === name) return scenes[i];
    }
    return null;
  }

  /** @type {SceneStack} */
  const api = Object.freeze({
    push,
    pop,
    replace,
    top: topScene,
    get stack() {
      return scenes.slice();
    },
    get size() {
      return scenes.length;
    },
    get isTransitioning() {
      return transition !== null;
    },
    update,
    draw,
    handleInput,
    transition: startTransition,
    transitionState,
    find,
    has: (scene) => scenes.includes(scene),
    clear,
  });
  return api;
}
