/**
 * Cutscene: the non-opaque script host drawn over the overworld. [SCN-UI] — ARCHITECTURE §2.5, §6.2.
 *
 * Runs a script's world ops — `move`, `face`, `emote`, `camera` (pan / follow / shake), `wait`,
 * `teleport`, `spawn`, `despawn`, `warp` (with a night-ink fade), `startBattle`, `forecast`, `music`,
 * `stem`, `playSfx`, `toast`, `setTime`, `tide`, `sleep`, `save`, plus `fade` and `letterbox` when the
 * op table carries them — and pushes `dialogue` with the same session for the text ops, `letter` and
 * `shop` for theirs. Letterbox bars (16 px, in 12 f) frame it unless `params.letterbox === false`.
 *
 * **The stage.** World ops act on `G.scenes.find('overworld').stage` when the overworld provides one
 * ({@link Stage}); without a stage they still take their time (a walk is 16 f a tile) so a script's
 * pacing holds on any map, and nothing writes the world behind the overworld's back.
 *
 * **Skip.** Hold cancel (0.7 s) — here or in a dialogue it pushed — to run ahead: lines go to the log,
 * walks land where they end, the camera snaps, music and time apply; it stops at the next choice,
 * name, battle, Forecast, letter or shop (never skipped), and a recap toast says what was skipped.
 *
 * **Resume.** Before each request the runner's position is bookmarked in `world.cutscene`
 * (systems/flow/eventScripts), so a save mid-cutscene comes back at the same request:
 * `G.push('cutscene', {resume: true})` (eventScripts.runPending does it on the overworld's enter).
 *
 * Params: `{scriptId}` | `{ops}` | `{session, pending}` | `{resume: true}`; `letterbox`, `skippable`
 * (default true), `recap`, `npc`, `onDone(result)`. Pops with `{done: true, vars}`.
 * `updateBelow: true` keeps the overworld's NPCs walking; `freezesClock: true` asks the overworld not
 * to advance the world clock while a cutscene runs (GDD-00 §5).
 * @module scenes/cutscene
 */
import { drawText, measureText } from '../core/font.js';
import { ease } from '../core/tween.js';
import { COLORS, DEVICE_LABELS, PALETTE } from '../ui/theme.js';
import * as clockSys from '../systems/clockSys.js';
import * as eventScripts from '../systems/flow/eventScripts.js';
import * as dayFlow from '../systems/flow/dayFlow.js';
import { TILE } from '../config.js';
import { createSession, parsePath, textLog, reducedMotion, skipAnims, framesMs, TEXT_OPS } from './scriptHost.js';

/**
 * What the overworld hands a cutscene (`overworldScene.stage`). Every member is optional; a missing
 * one makes its op a timed no-op.
 * @typedef {Object} Stage
 * @property {(who: string) => ({x: number, y: number, px: number, py: number, facing: string, moving?: boolean}|null)} [entity]
 *   `'player'` is the player; others are npc / spawned ids
 * @property {(who: string, dirs: string[], opts: {run: boolean}) => boolean} [walk]   queue a tile walk
 * @property {(who: string) => boolean} [isMoving]   still walking (queued steps included)
 * @property {(who: string, dir: string) => void} [face]
 * @property {(who: string, x: number, y: number, mapId?: string|null) => void} [teleport]
 * @property {(who: string, artId: string, x: number, y: number) => void} [spawn]
 * @property {(who: string) => void} [despawn]
 * @property {(mapId: string, x: number, y: number, facing?: string) => void} [warp]   through world/warps
 * @property {any} [camera]   world/camera Camera (follow, lookAt, shake, center, worldToScreen)
 */

/** Letterbox bar height (GDD task: 16 px). */
export const LETTERBOX_PX = 16;
/** Hold cancel this long to skip. */
export const SKIP_HOLD_MS = 700;
/** Show the skip hint after this long. */
export const SKIP_HINT_AFTER_MS = 1200;
/** Ops a skip never runs past. */
export const STOP_OPS = Object.freeze(['choice', 'nickname', 'take', 'startBattle', 'forecast', 'letter', 'openShop', 'sleep']);
const WALK_MS = 160, RUN_MS = 100;
const DIR_D = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] });

/**
 * Where a walk ends from a start tile (pure).
 * @param {{x: number, y: number}} from
 * @param {string[]} dirs
 * @returns {{x: number, y: number, facing: string|null}}
 */
export function walkEnd(from, dirs) {
  let x = from.x, y = from.y;
  for (const d of dirs) { const v = DIR_D[d]; if (v) { x += v[0]; y += v[1]; } }
  return { x, y, facing: dirs.length ? dirs[dirs.length - 1] : null };
}

/**
 * The facing that looks from `a` toward `b` (pure).
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 * @returns {'up'|'down'|'left'|'right'}
 */
export function faceToward(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, isBusy: () => boolean}}
 */
export function createCutsceneScene(G) {
  /** @type {any} */ let params = {};
  /** @type {import('./scriptHost.js').Session|null} */ let session = null;
  let state = 'idle'; // run | wait | child | sleep | skipping | closing | done
  /** @type {null | ((dt: number) => boolean)} */ let waiter = null;
  /** @type {any} */ let childOp = null;
  let elapsed = 0;
  let lb = { on: true, t: 0 };          // letterbox, t 0..1
  let fade = { a: 0, from: 0, to: 0, t: 0, ms: 0, color: PALETTE.nightInk };
  /** @type {Array<{who: string, kind: string, t: number}>} */ let emotes = [];
  let skipHeld = 0, hintShown = false;
  /** @type {any} */ let pan = null;
  let closeT = 0;
  let lastOp = '';

  const stage = () => {
    const ow = G.scenes.find ? G.scenes.find('overworld') : null;
    return ow && ow.stage ? /** @type {Stage} */ (ow.stage) : null;
  };
  const emit = (evt, p) => { try { G.bus?.emit(evt, p); } catch { /* listeners never break a cutscene */ } };

  // ------------------------------------------------------------------ the loop
  function step(answer) {
    if (!session) { finish(); return; }
    let r;
    try {
      r = session.next(answer);
    } catch (e) {
      console.warn(`cutscene: script error: ${e && e.message}`);
      finish();
      return;
    }
    if (r && r.done) { finish(); return; }
    bookmark();
    perform(r);
  }

  function bookmark() {
    if (!session || !session.scriptId) return;
    const id = session.scriptId;
    const st = session.save();
    G.store.tx('cutscene:bookmark', (w) => eventScripts.bookmarkCutscene(w, id, st));
  }

  function wait(fn) { state = 'wait'; waiter = fn; }
  function timer(ms) { let left = ms; wait((dt) => (left -= dt) <= 0); }

  function perform(r) {
    lastOp = r.op;
    const S = stage();
    switch (r.op) {
      case 'say': case 'choice': case 'nickname': case 'take':
        state = 'child'; childOp = r;
        G.push('dialogue', { session, pending: r, fromCutscene: true });
        return;
      case 'letter':
        state = 'child'; childOp = r;
        G.push('letter', { n: r.n ?? null, from: 'script' });
        return;
      case 'openShop':
        state = 'child'; childOp = r;
        G.push('shop', { shop: r.shop, from: 'script' });
        return;
      case 'move': {
        const dirs = parsePath(r.path);
        const ms = dirs.length * (r.run ? RUN_MS : WALK_MS);
        let started = false;
        if (S && typeof S.walk === 'function') started = S.walk(r.who, dirs, { run: r.run === true }) !== false;
        if (r.wait === false) { step(); return; }
        if (started && typeof S?.isMoving === 'function') {
          let guard = ms + 2000;
          wait((dt) => (guard -= dt) <= 0 || !S.isMoving(r.who));
        } else timer(skipAnims(G) ? 0 : ms);
        return;
      }
      case 'face': {
        if (S && typeof S.face === 'function') S.face(r.who, resolveFacing(S, r.who, r.dir));
        step();
        return;
      }
      case 'emote': {
        emotes.push({ who: r.who, kind: r.kind, t: 0 });
        emit('sfx', { name: 'blip', semitones: r.kind === '!' ? 7 : r.kind === '?' ? 3 : 0 });
        timer(framesMs(G, 30));
        return;
      }
      case 'wait': timer(skipAnims(G) ? Math.min(r.ms, 50) : Math.max(0, r.ms)); return;
      case 'camera': return startCamera(r, S);
      case 'teleport':
        if (S && typeof S.teleport === 'function') S.teleport(r.who, r.x, r.y, r.mapId ?? null);
        step(); return;
      case 'spawn':
        if (S && typeof S.spawn === 'function') S.spawn(r.who, r.artId, r.x, r.y);
        step(); return;
      case 'despawn':
        if (S && typeof S.despawn === 'function') S.despawn(r.who);
        step(); return;
      case 'warp': return doWarp(r, S, false);
      case 'startBattle': {
        state = 'child'; childOp = r;
        const setup = {
          kind: r.trainer ? 'trainer' : 'wild', trainerId: r.trainer ?? undefined, wild: r.wild ?? undefined,
          source: r.source ?? 'story', holdOut: r.holdOut ?? undefined, onLose: r.onLose ? 'script' : 'porch', loseScript: r.onLose ?? undefined,
        };
        if (G.flow && typeof G.flow.startBattle === 'function') G.flow.startBattle(G, setup);
        else G.push('battle', { setup });
        return;
      }
      case 'forecast': {
        state = 'child'; childOp = r;
        const uid = typeof r.who === 'string' && r.who.startsWith('player:') ? r.who.slice(7) : r.who;
        G.push('forecast', { uid, who: r.who, scripted: r.scripted ?? null, from: 'script' });
        return;
      }
      case 'music':
        emit('music:cue', r.track === null ? { release: true } : { track: r.track, fade: r.fade });
        step(); return;
      case 'stem': emit('music:cue', { stem: r.name, on: r.on }); step(); return;
      case 'playSfx': emit('sfx', { name: r.name }); step(); return;
      case 'toast': emit('toast', { text: r.text }); step(); return;
      case 'setTime':
        G.store.tx('script:setTime', (w) => clockSys.setTime(w, G.clock, r.minute));
        step(); return;
      case 'tide':
        if (typeof G.clock?.freezeTide === 'function') G.clock.freezeTide(r.set);
        step(); return;
      case 'save':
        try { G.persist?.autosave?.(G, r.reason ?? 'script'); } catch { /* persist reports its own failures */ }
        step(); return;
      case 'sleep': {
        state = 'sleep'; childOp = r;
        dayFlow.rest(G, 'sleep').then(() => { if (state === 'sleep') { state = 'run'; step(); } });
        return;
      }
      case 'fade': return startFade(r.to === 'in' ? 0 : 1, r.ms ?? 400, r.color);
      case 'letterbox': lb.on = r.on !== false; step(); return;
      default:
        console.warn(`cutscene: op '${r.op}' has no host here; skipped`);
        step();
    }
  }

  function resolveFacing(S, who, dir) {
    if (dir !== 'player') return dir;
    const a = S.entity?.(who), b = S.entity?.('player');
    return a && b ? faceToward(a, b) : 'down';
  }

  function targetPx(S, to) {
    if (Array.isArray(to)) return { x: to[0] * TILE + TILE / 2, y: to[1] * TILE + TILE / 2 };
    const e = S?.entity?.(to);
    return e ? { x: e.px + TILE / 2, y: e.py + TILE / 2 } : null;
  }

  function startCamera(r, S) {
    const cam = S?.camera;
    if (r.shake && cam && typeof cam.shake === 'function' && !reducedMotion(G)) cam.shake(Math.min(4, r.shake), 300);
    const ms = skipAnims(G) ? 0 : Math.max(0, r.ms ?? 600);
    if (!cam) { timer(ms); return; }
    if (r.to === 'player') {
      const p = S.entity?.('player');
      if (p && typeof cam.follow === 'function') cam.follow(p, { lerp: ms > 0 ? 0.12 : 1, snap: ms === 0 });
      timer(ms);
      return;
    }
    const to = targetPx(S, r.to);
    if (!to) { step(); return; }
    if (typeof cam.follow === 'function') cam.follow(null);
    const from = typeof cam.center === 'function' ? { ...cam.center() } : { x: to.x, y: to.y };
    pan = { cam, from, to, t: 0, ms };
    wait(() => !pan);
  }

  function startFade(to, ms, color) {
    fade = { a: fade.a, from: fade.a, to, t: 0, ms: skipAnims(G) ? 0 : ms, color: color ?? PALETTE.nightInk };
    wait(() => fade.t >= fade.ms);
  }

  function doWarp(r, S, instant) {
    const go = () => {
      if (S && typeof S.warp === 'function') S.warp(r.mapId, r.x, r.y, r.facing);
      else if (G.flow && typeof G.flow.warp === 'function') G.flow.warp(G, r);
      else console.warn(`cutscene: warp to ${r.mapId} needs the overworld stage`);
    };
    if (instant) { go(); return; }
    if (skipAnims(G)) { go(); step(); return; }
    let phase = 0;
    fade = { a: fade.a, from: fade.a, to: 1, t: 0, ms: 200, color: PALETTE.nightInk };
    wait(() => {
      if (phase === 0 && fade.t >= fade.ms) {
        go();
        phase = 1;
        fade = { a: 1, from: 1, to: 0, t: 0, ms: 200, color: PALETTE.nightInk };
        return false;
      }
      return phase === 1 && fade.t >= fade.ms;
    });
  }

  // ------------------------------------------------------------------ skip
  function skipAhead() {
    state = 'skipping';
    let lines = 0;
    const toasts = [];
    const S = stage();
    let answer;
    for (let guard = 0; guard < 2000; guard++) {
      let r;
      try { r = session ? session.next(answer) : { done: true }; } catch (e) { console.warn(`cutscene: script error: ${e && e.message}`); r = { done: true }; }
      answer = undefined;
      if (r.done) { recap(lines, toasts); finish(); return; }
      if (STOP_OPS.includes(r.op)) { bookmark(); recap(lines, toasts); state = 'run'; perform(r); return; }
      switch (r.op) {
        case 'say': textLog(G).push(r.name ?? r.who ?? '', r.text); lines++; break;
        case 'move': {
          const e = S?.entity?.(r.who);
          if (e && typeof S?.teleport === 'function') {
            const end = walkEnd(e, parsePath(r.path));
            S.teleport(r.who, end.x, end.y);
            if (end.facing && typeof S.face === 'function') S.face(r.who, end.facing);
          }
          break;
        }
        case 'face': if (S && typeof S.face === 'function') S.face(r.who, resolveFacing(S, r.who, r.dir)); break;
        case 'teleport': if (S?.teleport) S.teleport(r.who, r.x, r.y, r.mapId ?? null); break;
        case 'spawn': if (S?.spawn) S.spawn(r.who, r.artId, r.x, r.y); break;
        case 'despawn': if (S?.despawn) S.despawn(r.who); break;
        case 'camera': {
          const cam = S?.camera;
          if (cam) {
            if (r.to === 'player') { const p = S.entity?.('player'); if (p && cam.follow) cam.follow(p, { snap: true }); }
            else { const to = targetPx(S, r.to); if (to && cam.lookAt) { cam.follow?.(null); cam.lookAt(to.x, to.y, { snap: true }); } }
          }
          break;
        }
        case 'warp': doWarp(r, S, true); break;
        case 'music': emit('music:cue', r.track === null ? { release: true } : { track: r.track, fade: r.fade }); break;
        case 'stem': emit('music:cue', { stem: r.name, on: r.on }); break;
        case 'setTime': G.store.tx('script:setTime', (w) => clockSys.setTime(w, G.clock, r.minute)); break;
        case 'tide': if (typeof G.clock?.freezeTide === 'function') G.clock.freezeTide(r.set); break;
        case 'save': try { G.persist?.autosave?.(G, r.reason ?? 'script'); } catch { /* reported by persist */ } break;
        case 'toast': toasts.push(r.text); break;
        case 'fade': fade = { ...fade, a: r.to === 'in' ? 0 : 1, from: fade.a, to: r.to === 'in' ? 0 : 1, t: 1, ms: 0 }; break;
        case 'letterbox': lb.on = r.on !== false; break;
        default: break; // emote, wait, playSfx: nothing to keep
      }
    }
    finish();
  }

  function recap(lines, toasts) {
    const text = typeof params.recap === 'string' && params.recap ? params.recap
      : session?.recap ? session.recap
        : lines > 0 ? `Skipped ahead. ${lines} ${lines === 1 ? 'line is' : 'lines are'} in the log (Tab).` : 'Skipped ahead.'; // str
    emit('toast', { text, icon: 'read' });
    for (const t of toasts) emit('toast', { text: t });
  }

  // ------------------------------------------------------------------ end
  function finish() {
    if (state === 'closing' || state === 'done') return;
    G.store.tx('cutscene:end', (w) => eventScripts.clearCutscene(w));
    state = 'closing';
    closeT = 0;
    waiter = null;
    pan = null;
    if (fade.a > 0) fade = { ...fade, from: fade.a, to: 0, t: 0, ms: framesMs(G, 12) };
  }

  function popNow() {
    state = 'done';
    const result = { done: true, vars: session ? { ...session.vars } : {} };
    if (typeof params.onDone === 'function') { try { params.onDone(result); } catch (e) { console.warn(e); } }
    if (G.scenes.top() === scene) G.scenes.pop(result);
  }

  // ------------------------------------------------------------------ the scene
  const scene = {
    name: 'cutscene',
    opaque: false,
    updateBelow: true,
    freezesClock: true,
    enter(p) {
      params = p ?? {};
      state = 'run'; waiter = null; childOp = null; elapsed = 0; emotes = []; skipHeld = 0; hintShown = false; pan = null;
      lb = { on: params.letterbox !== false, t: skipAnims(G) ? 1 : 0 };
      fade = { a: 0, from: 0, to: 0, t: 0, ms: 0, color: PALETTE.nightInk };
      const skippable = params.skippable !== false;
      try {
        if (params.session) { session = params.session; session.skippable = skippable; }
        else if (params.resume) {
          const mark = eventScripts.cutsceneBookmark(G.world);
          session = mark ? createSession(G, { scriptId: mark.scriptId, state: mark.state, skippable, recap: params.recap ?? null }) : null;
        } else session = createSession(G, { scriptId: params.scriptId ?? null, ops: params.ops, npc: params.npc ?? null, skippable, recap: params.recap ?? null });
      } catch (e) {
        console.warn(`cutscene: ${e && e.message}`);
        session = null;
      }
      if (params.pending) { bookmark(); perform(params.pending); } else step();
    },
    exit() {},
    pause() {},
    resume(result) {
      if (state === 'sleep') return; // dayFlow's promise continues the script
      if (state !== 'child') return;
      const op = childOp ? childOp.op : '';
      childOp = null;
      state = 'run';
      if (op && TEXT_OPS.includes(op)) {
        if (result && result.skip) { skipAhead(); return; }
        if (result && result.pending) { bookmark(); perform(result.pending); return; }
        if (session && session.isDone()) { finish(); return; }
        // the dialogue closed without finishing (an error): carry on
        if (result && result.done) { finish(); return; }
        step();
        return;
      }
      if (op === 'startBattle') { step(result?.result ?? result ?? null); return; }
      if (op === 'forecast') { step(result?.formId ?? (typeof result === 'string' ? result : null)); return; }
      step();
    },
    update(dt) {
      elapsed += dt;
      const lbTarget = state === 'closing' ? 0 : lb.on ? 1 : 0;
      const lbStep = dt / Math.max(1, framesMs(G, 12) || 1);
      lb.t = skipAnims(G) ? lbTarget : lb.t < lbTarget ? Math.min(lbTarget, lb.t + lbStep) : Math.max(lbTarget, lb.t - lbStep);
      if (fade.ms > 0 && fade.t < fade.ms) {
        fade.t = Math.min(fade.ms, fade.t + dt);
        fade.a = fade.from + (fade.to - fade.from) * (fade.t / fade.ms);
      } else if (fade.ms === 0) { fade.a = fade.to; fade.t = 0; }
      for (const e of emotes) e.t += dt;
      emotes = emotes.filter((e) => e.t < framesMs(G, 70) || skipAnims(G) && e.t < 50);
      if (pan) {
        pan.t += dt;
        const k = pan.ms > 0 ? Math.min(1, pan.t / pan.ms) : 1;
        const e = ease.inOutSine(k);
        pan.cam.lookAt(pan.from.x + (pan.to.x - pan.from.x) * e, pan.from.y + (pan.to.y - pan.from.y) * e, { snap: true });
        if (k >= 1) pan = null;
      }
      if (state === 'wait' && waiter) {
        if (waiter(dt)) { waiter = null; state = 'run'; step(); }
      }
      if (state === 'closing') {
        closeT += dt;
        if (closeT >= framesMs(G, 8) && (fade.a <= 0.001 || fade.ms === 0)) popNow();
      }
    },
    handleInput(input) {
      if (state === 'closing' || state === 'done' || !session) return;
      if (!session.skippable) return;
      if (input.held('cancel')) {
        hintShown = true;
        skipHeld = input.heldFor('cancel');
        if (skipHeld >= SKIP_HOLD_MS && (state === 'wait' || state === 'run')) {
          skipHeld = 0;
          waiter = null; pan = null; emotes = [];
          skipAhead();
        }
      } else {
        skipHeld = 0;
        if (input.pressed('confirm') || input.pressed('start')) hintShown = true;
      }
    },
    draw(ctx) {
      const W = 480, H = 270;
      // emote balloons over the stage's actors
      const S = stage();
      if (S && S.camera && typeof S.camera.worldToScreen === 'function') {
        for (const em of emotes) {
          const e = S.entity?.(em.who);
          if (!e) continue;
          const p = S.camera.worldToScreen(e.px, e.py);
          drawEmote(ctx, Math.round(p.x + TILE / 2), Math.round(p.y - 8), em.kind, em.t);
        }
      }
      // fade
      if (fade.a > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, fade.a);
        ctx.fillStyle = fade.color;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      // letterbox
      const bar = Math.round(LETTERBOX_PX * ease.outQuad(Math.max(0, Math.min(1, lb.t))));
      if (bar > 0) {
        ctx.fillStyle = PALETTE.nightInk;
        ctx.fillRect(0, 0, W, bar);
        ctx.fillRect(0, H - bar, W, bar);
      }
      // skip hint
      if (session && session.skippable && state !== 'closing' && state !== 'child' && (hintShown || elapsed > SKIP_HINT_AFTER_MS)) {
        const dev = G.input?.lastDevice ?? 'keyboard';
        const key = (DEVICE_LABELS[dev] || DEVICE_LABELS.keyboard).cancel;
        const label = `Hold ${key}: skip`; // str
        const w = measureText(label, { font: 'small' }).w + 10;
        const x = W - w - 6, y = H - 13;
        ctx.fillStyle = 'rgba(20, 27, 51, 0.6)';
        ctx.fillRect(x, y, w, 9);
        drawText(ctx, label, x + 5, y + 2, { font: 'small', color: COLORS.paper.light });
        if (skipHeld > 0) {
          ctx.fillStyle = COLORS.brass.light;
          ctx.fillRect(x, y + 8, Math.round(w * Math.min(1, skipHeld / SKIP_HOLD_MS)), 1);
        }
      }
    },
    debugText: () => `cutscene ${session?.scriptId ?? '(inline)'} ${state}${lastOp ? ` (${lastOp})` : ''}`,
    isBusy: () => state !== 'child' && state !== 'done',
    get state() { return state; },
  };

  function drawEmote(ctx, cx, by, kind, t) {
    const pop = Math.min(1, t / Math.max(1, framesMs(G, 6) || 1));
    const s = reducedMotion(G) ? 1 : ease.outBack(pop);
    const w = Math.max(4, Math.round(13 * s)), h = Math.max(4, Math.round(12 * s));
    const x = cx - Math.floor(w / 2), y = by - h;
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(x + 1, y + 1, w, h);
    ctx.fillStyle = COLORS.paper.light;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COLORS.paper.edge;
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = COLORS.paper.light;
    ctx.fillRect(cx - 1, y + h - 1, 3, 2);
    ctx.fillStyle = COLORS.paper.edge;
    ctx.fillRect(cx, y + h + 1, 1, 1);
    if (pop >= 1) {
      const glyph = kind === 'zzz' ? 'z' : kind;
      const color = kind === '!' ? COLORS.wax.fill : kind === '♥' ? PALETTE.r : COLORS.paper.ink;
      drawText(ctx, glyph, cx, y + 3, { align: 'center', color });
    }
  }

  return scene;
}
