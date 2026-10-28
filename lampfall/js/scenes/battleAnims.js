/**
 * Battle animation queue and the per-event animations. [SCN-BATTLE] — ARCHITECTURE §5.2,
 * GDD-00 §14 (motion), GDD-09 §2 and §5 (frame counts).
 *
 * The engine returns a list of events per turn; the scene turns each into an {@link Anim} with
 * {@link animFor} and plays them in order through {@link createAnimQueue}. An Anim is a generator
 * that drives the scene's {@link BattleView} and yields what it waits for:
 *  - a number: milliseconds at 1× battle speed (the queue divides by the speed);
 *  - `GATE` (`'confirm'`): wait until the player confirms (the Ward readout, the Read card);
 *  - `{until: () => boolean}`: wait for a condition (a learn-move prompt closing).
 * `skip()` fast-forwards the current anim (every timed wait becomes 0, gates still hold) and asks
 * the view to settle its tweens, so a confirm press always lands on a readable frame.
 *
 * Motion rules carried here: hit-stop 0 / 2 / 4 / 6 / 8 frames by effectiveness (Blocked / Weak ×¼ /
 * Weak ×½ or Neutral / Strong ×2 / Strong ×4 or a crit), a 2 px nudge on the target, screen shake
 * only on crits, faint drop, stat arrows, status puffs, heal sparkle, level-up flash, and a
 * typewriter battle log. Every effectiveness tell is a word plus a glyph, never colour alone.
 *
 * Pure: imports only the string glossary; no DOM, no canvas. The view is the scene's business.
 * @module scenes/battleAnims
 */
import { t, has, fill } from '../data/strings.js';

/** Milliseconds per frame at 60 fps. */
export const FRAME_MS = 1000 / 60;
/** Battle speeds (GDD-00 §13: keys 1 / 2 / 3; GDD-09 §6: 2× default). */
export const SPEEDS = Object.freeze([1, 2, 4]);
/** Default battle speed. */
export const DEFAULT_SPEED = 2;
/** Gate token: wait for the player's confirm. */
export const GATE = 'confirm';

/**
 * @param {number} n frames
 * @returns {number} milliseconds
 */
export function frames(n) {
  return n * FRAME_MS;
}

// ---------------------------------------------------------------------------------------------
// Effectiveness
// ---------------------------------------------------------------------------------------------

/**
 * Effectiveness tier of a multiplier.
 * @param {number} mult
 * @returns {'blocked'|'weak'|'neutral'|'strong'}
 */
export function effTier(mult) {
  if (!(mult > 0)) return 'blocked';
  if (mult > 1) return 'strong';
  if (mult < 1) return 'weak';
  return 'neutral';
}

/** Glyph per tier (shape, so the word is never the colour's only partner). */
export const EFF_GLYPH = Object.freeze({ strong: '▲', neutral: '•', weak: '▼', blocked: '×' });

/**
 * The player-facing effectiveness word (Strong / Neutral / Weak / Blocked, + Blocked by Ward).
 * @param {'blocked'|'weak'|'neutral'|'strong'} tier
 * @param {{ward?: boolean}} [opts]
 * @returns {string}
 */
export function effWord(tier, opts = {}) {
  if (tier === 'blocked' && opts.ward) return t('battle.eff.blockedByWard');
  return t(`battle.eff.${tier}`);
}

/**
 * Hit-stop in frames (GDD-09 §5): Blocked ×0 → 0, Weak ×¼ → 2, Weak ×½ or Neutral → 4,
 * Strong ×2 → 6, Strong ×4 or a crit → 8.
 * @param {number} mult
 * @param {boolean} [crit]
 * @returns {0|2|4|6|8}
 */
export function hitStopFrames(mult, crit = false) {
  if (!(mult > 0)) return 0;
  if (crit || mult >= 4) return 8;
  if (mult >= 2) return 6;
  if (mult <= 0.25) return 2;
  return 4;
}

// ---------------------------------------------------------------------------------------------
// Sprite fit (FH-14: a small front form must not read as a speck beside a big back sprite)
// ---------------------------------------------------------------------------------------------

/**
 * Bounds of the opaque cells of string art ('.' is clear).
 * @param {ReadonlyArray<string>} rows
 * @returns {{x0: number, y0: number, x1: number, y1: number, w: number, h: number}|null}
 */
export function opaqueBounds(rows) {
  if (!Array.isArray(rows)) return null;
  let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
  for (let y = 0; y < rows.length; y++) {
    const r = String(rows[y] ?? '');
    for (let x = 0; x < r.length; x++) {
      if (r[x] === '.' || r[x] === ' ') continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Opaque size (cells) at or under which a 32-cell front form is drawn one step larger. */
export const SMALL_FORM_CELLS = 21;

/**
 * Draw scale and offset for a foe's front sprite. Forms whose opaque art is at most
 * {@link SMALL_FORM_CELLS} cells on its long side draw at `base + 1` (the Sootling's 20×11 becomes
 * 60×33 instead of 40×22), keeping the same centre line and standing its foot 4 px above the bottom
 * of the base-scale box, on the stand. Every other form is untouched (scale = base, offset 0).
 * @param {ReadonlyArray<string>|null|undefined} rows  the front-view rows
 * @param {number} [base=2]
 * @param {number} [size=32]  the art's cell size (forms larger than 32 never grow)
 * @returns {{scale: number, dx: number, dy: number}}
 */
export function spriteFit(rows, base = 2, size = 32) {
  const b = opaqueBounds(rows || []);
  if (!b || size > 32 || Math.max(b.w, b.h) > SMALL_FORM_CELLS) return { scale: base, dx: 0, dy: 0 };
  const scale = base + 1;
  const cx = (b.x0 + b.x1 + 1) / 2;
  const foot = b.y1 + 1;
  // keep the art's centre line; stand its foot just inside the bottom of the base-scale box (on the
  // stand) instead of hovering where a small form's empty lower rows left it
  const footAt = Math.max(foot * base, size * base - 4);
  return { scale, dx: Math.round(cx * base - cx * scale), dy: Math.round(footAt - foot * scale) };
}

// ---------------------------------------------------------------------------------------------
// Typewriter
// ---------------------------------------------------------------------------------------------

/**
 * Characters revealed after `ms` at `cps` characters per second.
 * @param {number} ms
 * @param {number} cps   Infinity reveals everything
 * @param {number} total
 * @returns {number}
 */
export function typedChars(ms, cps, total) {
  if (!(total > 0)) return 0;
  if (cps === Infinity || !(cps > 0)) return total;
  return Math.max(0, Math.min(total, Math.floor((Math.max(0, ms) * cps) / 1000)));
}

/**
 * How long a log line holds at 1×: typing time plus a reading hold that grows with the length.
 * @param {string} text
 * @param {number} cps
 * @returns {number} ms
 */
export function lineMs(text, cps) {
  const n = String(text || '').length;
  if (!n) return 0;
  const typing = cps === Infinity || !(cps > 0) ? 0 : (n * 1000) / cps;
  return typing + Math.min(1100, 400 + n * 14);
}

// ---------------------------------------------------------------------------------------------
// Lines (the battle.msg.* glossary over the event fields)
// ---------------------------------------------------------------------------------------------

/** @param {string} s @returns {string} */
function statWord(s) {
  return { atk: 'Attack', def: 'Defence', spa: 'Sp. Attack', spd: 'Sp. Defence', spe: 'Speed', eva: 'evasion', all: 'stats' }[s] || s;
}

/**
 * The log line for an event (glossary templates; the engine's own text as the fallback). Null for
 * events that do not speak (turn, damage, effectiveness without text, exp of the bench).
 * @param {any} ev
 * @returns {string|null}
 */
export function lineFor(ev) {
  if (!ev || typeof ev !== 'object') return null;
  switch (ev.type) {
    case 'turn':
    case 'damage':
    case 'effectiveness':
    case 'replace-needed':
      return null;
    case 'move': return t('battle.msg.used', { user: ev.user, move: ev.moveName });
    case 'charge': return t('battle.msg.braces', { user: ev.user, move: ev.moveName });
    case 'miss': return t('battle.msg.missed', { user: ev.user });
    case 'crit': return t('battle.msg.crit');
    case 'faint': return t('battle.msg.fainted', { target: ev.target });
    case 'switch': return t('battle.msg.switch', { from: ev.from, to: ev.to });
    case 'guard': return t('battle.msg.guards', { user: ev.who });
    case 'heal': return ev.amount > 0 ? t('battle.msg.healed', { target: ev.target, amount: ev.amount }) : null;
    case 'mend-spent': return t('battle.msg.mendSpent', { user: ev.user, n: ev.remaining });
    case 'mend-pending': return t('battle.msg.mendPending', { user: ev.user });
    case 'stat':
      if (ev.result === 'raised') return t('battle.msg.statRose', { target: ev.target, stat: statWord(ev.stat) });
      if (ev.result === 'lowered') return t('battle.msg.statFell', { target: ev.target, stat: statWord(ev.stat) });
      return ev.text || null;
    case 'status': {
      const word = t(`battle.status.${ev.kind}`);
      if (ev.action === 'inflict') return t('battle.status.inflict', { target: ev.target, status: word });
      if (ev.action === 'cant-move') return ev.text || t('battle.status.cantMove', { target: ev.target });
      return ev.text || null;
    }
    case 'read': return t('battle.msg.read', { target: ev.target, ability: ev.info?.ability?.name ?? '???', text: ev.info?.ability?.text ?? '' });
    case 'item':
      if (ev.item === 'crackdust') return ev.text || null;
      return ev.text || null;
    case 'ward-suppressed': return t('battle.msg.wardSuppressed', { target: ev.target, n: ev.turns });
    case 'exp':
      if (ev.share === 'bench') return t('battle.msg.expBench', { target: ev.creature, amount: ev.amount });
      if (ev.share === 'sibling') return t('battle.msg.expShared', { target: ev.creature, amount: ev.amount });
      if (ev.share === 'yard') return t('battle.msg.expYard', { target: ev.creature, amount: ev.amount });
      return t('battle.msg.exp', { target: ev.creature, amount: ev.amount });
    case 'levelup': return t('battle.msg.levelUp', { target: ev.creature, level: ev.to });
    case 'payout': return t('battle.msg.payout', { amount: ev.amount.toLocaleString('en-US') });
    case 'run': return ev.success ? t('battle.msg.runOk') : t('battle.msg.runFail');
    case 'stance': return ev.on ? t('battle.stance.on') : t('battle.stance.off');
    case 'capture-shake': return t('capture.drawIn', { name: ev.target });
    case 'capture': return t('capture.ok', { name: ev.name });
    case 'capture-fail': return t('capture.fail', { name: ev.target });
    case 'end': return ev.outcome === 'capture' || ev.outcome === 'win' ? null : t(`battle.end.${ev.outcome}`);
    case 'blocked':
      if (ev.reason === 'ward') return ev.text || t('battle.blocked.ward', { ward: ev.ward ?? '' });
      return ev.text || null;
    default:
      return typeof ev.text === 'string' && ev.text ? ev.text : null;
  }
}

/**
 * A glossary line with a built-in fallback (the key wins once the glossary carries it).
 * @param {string} key @param {string} fallback @param {Record<string, any>} vars
 * @returns {string}
 */
function say2(key, fallback, vars) {
  return has(key) ? t(key, vars) : fill(fallback, vars);
}

/**
 * The log line for a landed hit (FH-14): the effectiveness and the damage in one readable line,
 * e.g. "It's strong! Wirewhisk took 13." Null for a hit that did nothing or a non-party source.
 * @param {any} ev        the `damage` event
 * @param {number|null} mult  the effectiveness multiplier of the hit (null = neutral)
 * @param {boolean} [crit]
 * @returns {string|null}
 */
export function damageLine(ev, mult, crit = false) {
  if (!ev || ev.type !== 'damage' || ev.source !== 'party') return null;
  const n = Math.max(0, Math.round(Number(ev.amount) || 0));
  const vars = { target: ev.target || 'It', n };
  const took = n > 0 ? say2('battle.msg.took', '{target} took {n}.', vars) : say2('battle.msg.tookNone', '{target} barely felt it.', vars); // str
  const tier = effTier(mult ?? 1);
  const lead = [];
  if (crit) lead.push(say2('battle.msg.critShort', 'A critical hit!', vars)); // str
  if (tier === 'strong') lead.push(say2('battle.msg.itsStrong', "It's strong!", vars)); // str
  else if (tier === 'weak') lead.push(say2('battle.msg.itsWeak', "It's weak…", vars)); // str
  return [...lead, took].join(' ');
}

// ---------------------------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Anim
 * @property {string} name
 * @property {boolean} skippable
 * @property {() => Generator<number|string|{until: () => boolean}, void, void>} run
 */

/**
 * @typedef {Object} AnimQueue
 * @property {(anim: Anim|null|undefined) => void} push
 * @property {(dt: number) => void} update      real milliseconds; scaled by `speed` (1 / 2 / 4)
 * @property {() => boolean} idle
 * @property {() => void} skip                  fast-forward the current anim (gates still hold)
 * @property {() => boolean} confirm            release a waiting gate; returns whether one was waiting
 * @property {() => boolean} gated              the current anim waits for a confirm
 * @property {() => void} clear
 * @property {number} speed
 * @property {boolean} instant                  every timed wait is 0 (skip animations / ?noanim)
 * @property {() => number} size
 * @property {() => string|null} current
 */

/**
 * Creates the animation queue.
 * @param {{speed?: number, instant?: boolean, onSettle?: () => void, onError?: (err: any, anim: Anim) => void}} [opts]
 *   `onSettle`: called when an anim is fast-forwarded, so the view snaps its tweens to the end
 * @returns {AnimQueue}
 */
export function createAnimQueue(opts = {}) {
  /** @type {Anim[]} */
  const queue = [];
  /** @type {{anim: Anim, it: Generator<any, void, void>, wait: number, gate: boolean, until: (() => boolean)|null, skipping: boolean}|null} */
  let cur = null;
  const api = {
    speed: SPEEDS.includes(opts.speed) ? opts.speed : DEFAULT_SPEED,
    instant: !!opts.instant,
    push(anim) {
      if (anim && typeof anim.run === 'function') queue.push(anim);
    },
    idle() {
      return !cur && queue.length === 0;
    },
    size: () => queue.length + (cur ? 1 : 0),
    current: () => (cur ? cur.anim.name : null),
    gated: () => !!(cur && cur.gate),
    clear() {
      queue.length = 0;
      cur = null;
    },
    confirm() {
      if (cur && cur.gate) {
        cur.gate = false;
        return true;
      }
      return false;
    },
    skip() {
      if (!cur || cur.gate || cur.until) return;
      if (cur.anim.skippable === false) return;
      cur.skipping = true;
      cur.wait = 0;
    },
    update(dt) {
      let budget = Math.max(0, dt) * api.speed;
      // advance as far as the budget allows; several zero-wait anims may run in one frame
      for (let guard = 0; guard < 512; guard++) {
        if (!cur) {
          const anim = queue.shift();
          if (!anim) return;
          cur = { anim, it: anim.run(), wait: 0, gate: false, until: null, skipping: false };
        }
        if (cur.gate) return;
        if (cur.until) {
          let done = false;
          try { done = !!cur.until(); } catch { done = true; }
          if (!done) return;
          cur.until = null;
        }
        if (cur.wait > 0) {
          if (cur.skipping || api.instant) cur.wait = 0;
          else {
            const step = Math.min(cur.wait, budget);
            cur.wait -= step;
            budget -= step;
            if (cur.wait > 0) return;
          }
        }
        let r;
        try {
          r = cur.it.next();
        } catch (err) {
          if (opts.onError) opts.onError(err, cur.anim);
          r = { done: true, value: undefined };
        }
        if (r.done) {
          const skipped = cur.skipping;
          cur = null;
          if (skipped && opts.onSettle) opts.onSettle();
          continue;
        }
        const v = r.value;
        if (v === GATE) cur.gate = true;
        else if (v && typeof v === 'object' && typeof v.until === 'function') cur.until = v.until;
        else if (typeof v === 'number' && v > 0) cur.wait = v;
        if (budget <= 0 && cur && cur.wait > 0 && !cur.skipping && !api.instant) return;
      }
    },
  };
  return api;
}

// ---------------------------------------------------------------------------------------------
// The view contract (implemented by scenes/battle.js; a recording fake in the tests)
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} BattleView
 * @property {{mult: number|null, crit: boolean, effEv: any|null, critEv: any|null, moveType?: string|null}} hit   per-hit scratch shared by consecutive anims
 * @property {(side: number, type: string|null, mult: number) => void} [impact]   spark burst on the target at the moment of impact
 * @property {(ev: any) => void} sfx                 emit `battle:event` (sound + music) now
 * @property {(text: string|null) => number} say     put a line in the log; returns its hold time (ms at 1×)
 * @property {(side: number, hp: number, maxHp: number) => number} hpTo   start the HP drain/fill; returns its length
 * @property {(side: number) => void} emitHp         emit `battle:hp` for that side
 * @property {(n: number) => void} hitStop           freeze the arena for n frames
 * @property {(side: number, px: number, n: number) => void} nudge
 * @property {(side: number) => void} lunge          attacker's anticipation + strike
 * @property {(px: number, n: number) => void} shake
 * @property {(side: number, n: number) => void} flash
 * @property {(side: number, tier: string, ward?: boolean) => void} effWord
 * @property {(side: number, kind: string) => void} puff
 * @property {(side: number) => void} sparkle
 * @property {(side: number, dir: 1|-1, stat: string) => void} arrows
 * @property {(side: number) => void} faint
 * @property {(side: number) => void} recall
 * @property {(side: number, name?: string) => void} sendOut
 * @property {(side: number) => void} glint
 * @property {(side: number) => void} lattice
 * @property {(ev: any) => void} readout             open the Ward readout slip (closed by the gate)
 * @property {(ev: any) => void} readCard            open the Read card (closed by the gate)
 * @property {() => void} closeOverlay
 * @property {(side: number, text: string) => void} banner   ability slip
 * @property {(phase: 'lift'|'unfold'|'meter'|'fold'|'gutter', ev: any) => number} lantern
 * @property {(ev: any) => number} expTo
 * @property {(ev: any) => void} levelFlash
 * @property {(ev: any) => (() => boolean)} learnPrompt   open the keep / forget prompt; returns its "done" predicate
 * @property {(ev: any) => void} payout
 * @property {(ev: any) => void} release             release the deferred domain events this event stands for
 * @property {(ev: any) => void} stance
 * @property {(ev: any) => string|null|void} ended   the engine's `end` event reached the screen; may return the line to say (a trainer's parting words)
 * @property {(side: number) => void} runAway
 * @property {(ev: any|null) => void} weather        the posted battle weather (null = clear)
 * @property {(ev: any|null) => void} [shiftStrip]   the posted boss-Shift strip ('shift-posted'; null = taken down)
 * @property {(ev: any) => void} [reform]            the foe's new form after a 'boss-shift' (sprite, types, HP bar)
 * @property {boolean} [reducedMotion]
 */

// ---------------------------------------------------------------------------------------------
// The animations
// ---------------------------------------------------------------------------------------------

/**
 * Builds an Anim.
 * @param {string} name
 * @param {() => Generator<any, void, void>} run
 * @param {boolean} [skippable=true]
 * @returns {Anim}
 */
function anim(name, run, skippable = true) {
  return { name, run, skippable };
}

/**
 * A plain "say the line" animation.
 * @param {any} ev @param {BattleView} v
 * @returns {Anim}
 */
function speak(ev, v) {
  return anim(ev.type, function* run() {
    v.sfx(ev);
    const ms = v.say(lineFor(ev));
    if (ms > 0) yield ms;
  });
}

/** @type {Readonly<Record<string, (ev: any, v: BattleView) => Anim>>} */
export const BATTLE_ANIMS = Object.freeze({
  message: speak,
  turn: (ev, v) => anim('turn', function* run() { v.hit.mult = null; v.hit.crit = false; }),
  move: (ev, v) => anim('move', function* run() {
    v.hit.moveType = ev.moveType ?? null;
    v.sfx(ev);
    const ms = v.say(lineFor(ev));
    yield frames(4);
    v.lunge(ev.side);
    yield Math.max(frames(14), ms * 0.55);
  }),
  charge: (ev, v) => anim('charge', function* run() {
    v.sfx(ev);
    v.glint(ev.side);
    const ms = v.say(lineFor(ev));
    yield ms;
  }),
  miss: (ev, v) => anim('miss', function* run() {
    v.sfx(ev);
    v.nudge(1 - ev.side, 3, 8);
    yield v.say(lineFor(ev));
  }),
  effectiveness: (ev, v) => anim('effectiveness', function* run() {
    v.hit.mult = ev.mult;
    v.hit.effEv = ev;
  }),
  crit: (ev, v) => anim('crit', function* run() {
    v.hit.crit = true;
    v.hit.critEv = ev;
  }),
  damage: (ev, v) => anim('damage', function* run() {
    const fromParty = ev.source === 'party';
    if (fromParty && v.hit.effEv) { v.sfx(v.hit.effEv); v.hit.effEv = null; }
    if (fromParty && v.hit.critEv) { v.sfx(v.hit.critEv); v.hit.critEv = null; }
    v.sfx(ev);
    let sayMs = 0;
    if (fromParty) {
      const mult = v.hit.mult ?? 1;
      const crit = v.hit.crit;
      const stop = hitStopFrames(mult, crit);
      const line = damageLine(ev, mult, crit);
      v.flash(ev.side, crit ? 4 : 2);
      if (typeof v.impact === 'function') v.impact(ev.side, v.hit.moveType ?? null, mult);
      if (stop > 0) {
        v.hitStop(stop);
        v.nudge(ev.side, 2, stop + 4);
        if (crit) v.shake(2, 2);
        const tier = effTier(mult);
        if (tier !== 'neutral') v.effWord(ev.side, tier);
        yield frames(stop);
      }
      // one line carries the crit, the effectiveness and the damage ("It's strong! Wirewhisk took 13.")
      sayMs = v.say(line) || 0;
      v.hit.mult = null;
      v.hit.crit = false;
    } else {
      v.flash(ev.side, 2);
    }
    const ms = v.hpTo(ev.side, ev.hp, ev.maxHp);
    v.emitHp(ev.side);
    // hold long enough to read the hit line, not only to drain the bar
    yield Math.max(frames(10), ms, sayMs * 0.7);
  }),
  faint: (ev, v) => anim('faint', function* run() {
    v.sfx(ev);
    v.faint(ev.side);
    yield frames(18);
    yield v.say(lineFor(ev));
  }),
  switch: (ev, v) => anim('switch', function* run() {
    v.recall(ev.side);
    yield frames(12);
    v.sfx(ev);
    const ms = v.say(lineFor(ev));
    v.sendOut(ev.side, ev.to);
    v.emitHp(ev.side);
    yield frames(20);
    v.glint(ev.side);
    yield Math.max(frames(16), ms - frames(20));
  }),
  blocked: (ev, v) => anim('blocked', function* run() {
    if (v.hit.effEv) { v.sfx(v.hit.effEv); v.hit.effEv = null; }
    v.sfx(ev);
    if (ev.reason === 'ward') {
      v.lattice(1 - ev.side);
      v.effWord(1 - ev.side, 'blocked', true);
    } else if (ev.reason === 'immune') {
      v.effWord(1 - ev.side, 'blocked', false);
    }
    v.hit.mult = null;
    yield v.say(lineFor(ev));
  }),
  'ward-readout': (ev, v) => anim('ward-readout', function* run() {
    v.sfx(ev);
    v.readout(ev);
    yield frames(5);
    if (ev.side === 0) yield GATE;
    v.closeOverlay();
  }, false),
  heal: (ev, v) => anim('heal', function* run() {
    v.sfx(ev);
    v.sparkle(ev.side);
    const ms = v.hpTo(ev.side, ev.hp, ev.maxHp);
    v.emitHp(ev.side);
    const say = v.say(lineFor(ev));
    yield Math.max(ms, say, frames(20));
  }),
  status: (ev, v) => anim('status', function* run() {
    v.sfx(ev);
    if (ev.action === 'inflict' || ev.action === 'tick') v.puff(ev.side, ev.kind);
    else if (ev.action === 'cure') v.sparkle(ev.side);
    const ms = v.say(lineFor(ev));
    yield Math.max(ms, frames(18));
  }),
  stat: (ev, v) => anim('stat', function* run() {
    v.sfx(ev);
    if (ev.result === 'raised' || ev.result === 'cleared-raised') v.arrows(ev.side, 1, ev.stat);
    else if (ev.result === 'lowered' || ev.result === 'cleared') v.arrows(ev.side, -1, ev.stat);
    const ms = v.say(lineFor(ev));
    yield Math.max(ms, frames(24));
  }),
  ability: (ev, v) => anim('ability', function* run() {
    v.sfx(ev);
    v.banner(ev.side, ev.ability);
    yield v.say(lineFor(ev));
  }),
  glint: (ev, v) => anim('glint', function* run() {
    v.sfx(ev);
    v.glint(ev.side);
    yield v.say(lineFor(ev));
  }),
  read: (ev, v) => anim('read', function* run() {
    v.sfx(ev);
    v.readCard(ev);
    const ms = v.say(lineFor(ev));
    yield frames(6);
    // a Read the player asked for waits for them; an ability's free Read holds, then folds away
    if (ev.side === 0 && ev.source === 'Read') yield GATE;
    else yield Math.max(ms, frames(90));
    v.closeOverlay();
  }, false),
  'capture-shake': (ev, v) => anim('capture-shake', function* run() {
    v.say(lineFor(ev));
    yield v.lantern('lift', ev);
    yield v.lantern('unfold', ev);
    v.sfx(ev);
    yield v.lantern('meter', ev);
  }),
  capture: (ev, v) => anim('capture', function* run() {
    v.sfx(ev);
    v.release(ev);
    yield v.lantern('fold', ev);
    const a = v.say(lineFor(ev));
    yield a;
    yield v.say(t('capture.heartmark'));
  }),
  'capture-fail': (ev, v) => anim('capture-fail', function* run() {
    v.sfx(ev);
    yield v.lantern('gutter', ev);
    yield v.say(lineFor(ev));
    const next = ev.nextOdds != null ? t('capture.nextOdds', { n: Math.round(ev.nextOdds * 100) }) : null;
    if (next) yield v.say(next);
  }),
  run: (ev, v) => anim('run', function* run() {
    v.sfx(ev);
    if (ev.success) v.runAway(ev.side);
    yield v.say(lineFor(ev));
  }),
  stance: (ev, v) => anim('stance', function* run() {
    v.sfx(ev);
    v.stance(ev);
    yield v.say(lineFor(ev));
  }),
  item: (ev, v) => anim('item', function* run() {
    v.sfx(ev);
    if (ev.item === 'crackdust') v.puff(1 - ev.side, 'crackdust');
    yield v.say(lineFor(ev));
  }),
  'ward-suppressed': speak,
  decoy: (ev, v) => anim('decoy', function* run() {
    v.sfx(ev);
    v.sparkle(ev.side);
    yield v.say(lineFor(ev));
  }),
  'decoy-pop': (ev, v) => anim('decoy-pop', function* run() {
    v.sfx(ev);
    v.puff(ev.side, 'flinch');
    yield v.say(lineFor(ev));
  }),
  guard: (ev, v) => anim('guard', function* run() {
    v.sfx(ev);
    v.flash(ev.side, 6);
    yield v.say(lineFor(ev));
  }),
  'mend-spent': (ev, v) => anim('mend-spent', function* run() {
    v.sfx(ev);
    v.sparkle(ev.side);
    yield v.say(lineFor(ev));
  }),
  'mend-pending': speak,
  'mend-cancelled': speak,
  'scrap-cost': speak,
  reveal: speak,
  'type-shift': (ev, v) => anim('type-shift', function* run() {
    v.sfx(ev);
    v.glint(ev.side);
    // a Reading phase opening (it names its aspect) takes down the strip its cards were posted on
    if (ev.aspect !== undefined && typeof v.shiftStrip === 'function') v.shiftStrip(null);
    yield v.say(lineFor(ev));
  }),
  // a posted boss Shift (GDD-04 §1.4): the strip goes up a turn before it lands; it stays until then
  'shift-posted': (ev, v) => anim('shift-posted', function* run() {
    v.sfx(ev);
    v.glint(ev.side);
    if (typeof v.shiftStrip === 'function') v.shiftStrip(ev);
    yield v.say(lineFor(ev));
  }),
  'boss-shift': (ev, v) => anim('boss-shift', function* run() {
    v.sfx(ev);
    v.flash(ev.side, 6);
    if (!v.reducedMotion) v.shake(1, 4);
    yield frames(6);
    if (typeof v.reform === 'function') v.reform(ev);
    if (typeof v.shiftStrip === 'function') v.shiftStrip(null);
    v.sparkle(ev.side);
    yield v.say(lineFor(ev));
  }),
  'weather-start': (ev, v) => anim('weather-start', function* run() {
    v.sfx(ev);
    v.weather(ev);
    yield v.say(lineFor(ev));
  }),
  'weather-tick': (ev, v) => anim('weather-tick', function* run() {
    v.weather(ev);
    const ms = v.say(lineFor(ev));
    if (ms > 0) yield ms;
  }),
  'weather-end': (ev, v) => anim('weather-end', function* run() {
    v.sfx(ev);
    v.weather(null);
    yield v.say(lineFor(ev));
  }),
  'held-item': (ev, v) => anim('held-item', function* run() {
    v.sfx(ev);
    v.banner(ev.side, ev.itemName);
    yield v.say(lineFor(ev));
  }),
  exp: (ev, v) => anim('exp', function* run() {
    v.sfx(ev);
    const say = v.say(lineFor(ev));
    const ms = v.expTo(ev);
    yield Math.max(say, ms);
  }),
  levelup: (ev, v) => anim('levelup', function* run() {
    v.release(ev);
    v.sfx(ev);
    v.levelFlash(ev);
    yield v.say(lineFor(ev));
  }),
  learn: (ev, v) => anim('learn', function* run() {
    v.release(ev);
    v.sfx(ev);
    yield v.say(lineFor(ev));
  }),
  'learn-offer': (ev, v) => anim('learn-offer', function* run() {
    v.sfx(ev);
    yield v.say(lineFor(ev));
    const done = v.learnPrompt(ev);
    yield { until: done };
  }, false),
  payout: (ev, v) => anim('payout', function* run() {
    v.release(ev);
    v.sfx(ev);
    v.payout(ev);
    yield v.say(lineFor(ev));
  }),
  blackout: (ev, v) => anim('blackout', function* run() {
    v.sfx(ev);
    yield frames(10);
  }),
  'replace-needed': (ev, v) => anim('replace-needed', function* run() {
    if (ev.side === 1) yield v.say(ev.text);
  }),
  end: (ev, v) => anim('end', function* run() {
    const extra = v.ended(ev);
    const line = (typeof extra === 'string' && extra) || lineFor(ev);
    if (line) yield v.say(line);
    if (extra) yield 400;
  }),
});

/**
 * The Anim for an event (`message` for unknown types, so a new engine event never breaks a turn).
 * @param {any} ev
 * @param {BattleView} view
 * @returns {Anim}
 */
export function animFor(ev, view) {
  const f = BATTLE_ANIMS[ev && ev.type] || speak;
  return f(ev, view);
}

// ---------------------------------------------------------------------------------------------
// Capture timelines (GDD-00 §14 Lantern unfold; GDD-09 §3.18, §5)
// ---------------------------------------------------------------------------------------------

/** Lantern / meter frame counts. */
export const LANTERN_FRAMES = Object.freeze({ lift: 6, unfold: 12, fill: 8, sweep: 48, fold: 12, gutter: 8 });

/**
 * Shape of the folded light during the 12 f unfold: square → strip → outline.
 * @param {number} f frame 0..11
 * @returns {'square'|'strip'|'outline'}
 */
export function unfoldShape(f) {
  if (f < 4) return 'square';
  if (f < 8) return 'strip';
  return 'outline';
}

/**
 * Meter fill in segments (0..3, fractional) at frame `f` of the 48 f sweep, stopping at `segments`.
 * @param {number} f
 * @param {number} segments  how far this attempt fills (3 on success)
 * @returns {number}
 */
export function meterFill(f, segments) {
  const per = LANTERN_FRAMES.sweep / 3;
  return Math.max(0, Math.min(segments, f / per));
}

/**
 * Meter sweep length for an attempt: one smooth sweep, cut short where a failure stops.
 * @param {number} segments
 * @returns {number} frames
 */
export function meterFrames(segments) {
  return Math.max(8, Math.round((LANTERN_FRAMES.sweep / 3) * Math.max(0.5, segments)));
}

// ---------------------------------------------------------------------------------------------
// Forecast flip timeline (GDD-00 §14 Shift flip; GDD-09 §5)
// ---------------------------------------------------------------------------------------------

/** Shift flip frame counts. */
export const FLIP_FRAMES = Object.freeze({ down: 12, slide: 60, turn: 18, scramble: 90, reduced: 30, glint: 30 });

/**
 * Phase of the flip at frame `f`.
 * @param {number} f
 * @param {boolean} [reduced]  reduced motion: one 30 f dither fade
 * @returns {{phase: 'down'|'slide'|'turn'|'scramble'|'dither'|'done', t: number}}
 */
export function flipPhase(f, reduced = false) {
  if (reduced) {
    if (f < FLIP_FRAMES.reduced) return { phase: 'dither', t: f / FLIP_FRAMES.reduced };
    return { phase: 'done', t: 1 };
  }
  let k = f;
  for (const phase of /** @type {const} */ (['down', 'slide', 'turn', 'scramble'])) {
    const n = FLIP_FRAMES[phase];
    if (k < n) return { phase, t: k / n };
    k -= n;
  }
  return { phase: 'done', t: 1 };
}

/**
 * Total frames of the flip.
 * @param {boolean} [reduced]
 * @returns {number}
 */
export function flipTotal(reduced = false) {
  return reduced ? FLIP_FRAMES.reduced : FLIP_FRAMES.down + FLIP_FRAMES.slide + FLIP_FRAMES.turn + FLIP_FRAMES.scramble;
}

/**
 * Ring index of every block in the scramble: blocks of `block` pixels resolve in `rings` rings
 * outward from the mark (Chebyshev distance), ring 0 at the mark.
 * @param {number} w  sprite width in pixels
 * @param {number} h
 * @param {{x: number, y: number}} mark  sprite pixel of the mark
 * @param {{block?: number, rings?: number}} [opts]
 * @returns {number[][]} [by][bx] ring index 0..rings-1
 */
export function scrambleRings(w, h, mark, opts = {}) {
  const block = opts.block ?? 4;
  const rings = opts.rings ?? 4;
  const bw = Math.ceil(w / block);
  const bh = Math.ceil(h / block);
  const mx = Math.floor(mark.x / block);
  const my = Math.floor(mark.y / block);
  let max = 0;
  const dist = [];
  for (let by = 0; by < bh; by++) {
    const rowD = [];
    for (let bx = 0; bx < bw; bx++) {
      const d = Math.max(Math.abs(bx - mx), Math.abs(by - my));
      rowD.push(d);
      if (d > max) max = d;
    }
    dist.push(rowD);
  }
  return dist.map((r) => r.map((d) => (max === 0 ? 0 : Math.min(rings - 1, Math.floor((d / (max + 1)) * rings)))));
}

/**
 * Whether a block of ring `ring` shows the new form at scramble progress `t` (0..1): six swap steps,
 * each ring settling on the new form one step after the one inside it; before settling, blocks
 * alternate between old and new on every step.
 * @param {number} ring 0..rings-1
 * @param {number} t 0..1
 * @param {{rings?: number, steps?: number, bx?: number, by?: number}} [opts]
 * @returns {boolean}
 */
export function scrambleShowsNew(ring, t, opts = {}) {
  const rings = opts.rings ?? 4;
  const steps = opts.steps ?? 6;
  const step = Math.min(steps, Math.floor(t * steps));
  const settleAt = steps - rings + ring; // ring 0 settles first
  if (step >= settleAt) return true;
  return ((step + (opts.bx ?? 0) + (opts.by ?? 0)) % 2) === 1;
}
