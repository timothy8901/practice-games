/**
 * Battle scene. [SCN-BATTLE] — GDD-00 §8, §13, §14; GDD-09 §3.16-§3.18, §5; ARCHITECTURE §5.2-§5.5.
 *
 * Drives `battle/engine.js` through `systems/flow/battleFlow.js`:
 *  - intro: a wild creature rises from the grass (or the water); a trainer slides in with a 48×48
 *    bust and their line, then sends out;
 *  - the HUD: foe card top-left (name, Lv, type chips, HP bar without numbers, status, `Ward ?`
 *    with the shimmer lattice, EVA, Mends pips), player card bottom-right (HP numbers, EXP bar,
 *    Heartmark glyph, status);
 *  - commands Fight / Read / Lantern / Bag / Switch / Run, each greyed with its reason when it
 *    cannot be used; the 2×2 technique grid (type chip, PP coral at 25 % and berry at 0, the
 *    effectiveness word + glyph, Scrap when every technique is empty);
 *  - the Read card (never blank), the Ward readout slip, Capture Stance, the Lantern panel (wick
 *    grades with stock and the odds BEFORE spending, Isolde's Lantern behind a No-first confirm),
 *    the Bag (medicine, Crackdust), switching;
 *  - the animation queue (`scenes/battleAnims.js`), battle speed 1× / 2× / 4× (keys 1 / 2 / 3,
 *    `l` cycles, the chip is tappable);
 *  - the end: EXP and level-ups with keep-or-forget prompts, the catch's nickname behind a confirm,
 *    "Open now / Later" for each Shift window, the victory sting, payouts and seals, or the blackout
 *    fade to porchlight amber with Dimity's line.
 * Bus: `battle:start`, `battle:hp` after every HP change and switch, `battle:event` per event in
 * animation order, `battle:end`; domain events from the result are released in animation order.
 *
 * Params: `{setup, onDone}` (battleFlow.startBattle), or the debug route `{trainer}` / `{wild}`.
 * Pops with `{result: PostBattle}`.
 * @module scenes/battle
 */
import { drawText, drawTextTyped, measureText } from '../core/font.js';
import { drawSprite } from '../core/pixelart.js';
import { COLORS, PALETTE, TYPE, TEXT_SPEEDS, STRINGS, TYPE_CHIPS } from '../ui/theme.js';
import { drawPanel, drawDim, drawRule } from '../ui/panel.js';
import { drawBar, drawPips, drawBadge, drawTypeChip, drawWardBadge, formatNumber } from '../ui/widgets.js';
import { createFocus } from '../ui/focus.js';
import { openConfirm } from '../ui/confirm.js';
import { drawIcon, drawSeal, getPortraitPlaceholder } from '../ui/icons.js';
import { t, confirmSpec } from '../data/strings.js';
import { drawCreature, creatureArt, creatureSprite } from '../art/creatures/index.js';
import { portraitSprite } from '../art/portraits.js';
import { hour as worldHour } from '../state/selectors.js';
import {
  createAnimQueue, animFor, frames, FRAME_MS, SPEEDS, DEFAULT_SPEED, effTier, effWord, EFF_GLYPH, typedChars, lineMs,
  LANTERN_FRAMES, unfoldShape, meterFrames, GATE, spriteFit,
} from './battleAnims.js';
import {
  buildBattle, applyBattleResult, createDeferredBus, prepareAction, captureMenu, bagMenu, noteEvents, expDisplay,
  applyExpEvent, learnOffered, nameCaught, installBattleDebug, relayRule, relayChoices, relayDefaultPicks, relayNextSetup,
} from '../systems/flow/battleFlow.js';
import { resolveBattleData } from './battleData.js';
import { backdropFor, drawBackdrop, rustleColour } from '../art/backdrops.js';
import { cryParams } from '../audio/cries.js';

// ---------------------------------------------------------------------------------------------
// Layout (GDD-09 §3.16) and colours
// ---------------------------------------------------------------------------------------------

const W = 480;
const H = 270;
const L = Object.freeze({
  arenaH: 198,
  foeBox: { x: 8, y: 8, w: 184, h: 44 },
  foeSprite: { x: 336, y: 36 },
  foeBase: { x: 368, y: 99 },
  playerSprite: { x: 72, y: 124 },
  playerBase: { x: 104, y: 187 },
  playerBox: { x: 288, y: 138, w: 184, h: 46 },
  panel: { x: 0, y: 198, w: 480, h: 72 },
  msg: { x: 14, y: 206, w: 418 },
  cmdY: 229, cmdH: 30, cmdW: 72, cmdGap: 4, cmdX: 16,
  moves: { x: 16, y: 202, w: 226, h: 30, gx: 4, gy: 3 },
  speed: { x: 436, y: 186, w: 40, h: 11 },
  log: { x: 14, y: 208, w: 452 },
  stance: { x: 432, y: 203, w: 44, h: 15 },
  meter: { x: 8, y: 56, w: 176, h: 8 },
  readCard: { x: 8, y: 8, w: 236, h: 112 },
});

const INK = COLORS.paper.ink;
const SOFT = COLORS.paper.inkSoft;
const FAINT = COLORS.paper.inkFaint;
const CORAL = PALETTE.o;
const BERRY = PALETTE.r;
const MAGENTA = '#FF5BD6';
const AMBER = PALETTE.porchAmber;
const CREAM = PALETTE.paperLightest;

/** Battle speed the player picked this session (GDD-09 §6: 2× default; the settings field is a request). */
let speedPref = DEFAULT_SPEED;

/** Commands in panel order. */
const COMMANDS = Object.freeze(['fight', 'read', 'lantern', 'bag', 'switch', 'run']);
const COMMAND_ICON = Object.freeze({ fight: 'glint', read: 'read', lantern: 'lantern', bag: 'button', switch: 'arrowRight', run: 'door' });

/** Type id for a chip from a display name. @param {string} type @returns {string} */
const chipId = (type) => String(type || '').toLowerCase();

/** @param {number} a @param {number} b @param {number} k @returns {number} */
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));

// ---------------------------------------------------------------------------------------------
// Offscreen helpers (browser only; the scene never runs under Node)
// ---------------------------------------------------------------------------------------------

/** @param {number} w @param {number} h @returns {HTMLCanvasElement|OffscreenCanvas|null} */
function makeCanvas(w, h) {
  try {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
  } catch { /* no canvas: draw straight through */ }
  return null;
}

/** @type {Map<string, any>} */
const backdropCache = new Map();

/**
 * The arena backdrop for a place and day-part (cached per theme, part and accent): drawn by
 * `art/backdrops.js` (shore, flats, marsh, drowned wood, stone, ember, moor, ice, summit, Spire
 * interiors, the Reading at night, rooms), stands included.
 * @param {{theme: string, part: 'day'|'dusk'|'night', accent: string|null, key: string}} pick
 * @returns {any}
 */
function backdrop(pick) {
  if (backdropCache.has(pick.key)) return backdropCache.get(pick.key);
  const cv = makeCanvas(W, L.arenaH);
  if (!cv) return null;
  const c = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  drawBackdrop(c, pick, { foe: L.foeBase, player: L.playerBase });
  backdropCache.set(pick.key, cv);
  return cv;
}

/**
 * The `battle:end` bus payload (stamps read `porchDuel` from it; wave-1 follow-up).
 * @param {any} session @param {{outcome: string}} ev
 * @returns {{outcome: string, kind: string, trainerId: string|null, summit: any, porchDuel: boolean}}
 */
export function battleEndPayload(session, ev) {
  return { outcome: ev.outcome, kind: session.kind, trainerId: session.trainer ? session.trainer.id : null, summit: session.summit, porchDuel: !!session.porchDuel };
}

/**
 * The badge gifts listed on the seal slip (each reward's own line; they also toast).
 * @param {any} p PostBattle
 * @returns {string[]}
 */
export function sealRewardLines(p) {
  return (Array.isArray(p?.rewards) ? p.rewards : []).map((r) => (r && typeof r.line === 'string' ? r.line : '')).filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------------------------

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & Record<string, any>}
 */
export function createBattleScene(G) {
  installBattleDebug(G);

  /** @type {any} */ let params = null;
  /** @type {import('../systems/flow/battleFlow.js').BattleSession|null} */ let session = null;
  /** @type {any} */ let data = null;
  /** @type {string|null} */ let error = null;
  /** 'intro' | 'menu' | 'moves' | 'party' | 'bag' | 'lantern' | 'busy' | 'modal' | 'end' | 'error' | 'done' */
  let mode = 'intro';
  let elapsed = 0;          // scene clock (ms)
  let arenaMs = 0;          // arena clock, frozen during hit-stop
  let freezeMs = 0;
  let shakeMs = 0;
  let shakePx = 0;
  let curtain = 1;          // 1 = closed (intro bars), 0 = open
  let fadeOut = 0;          // 0..1 end fade
  let amber = 0;            // 0..1 blackout fade
  /** @type {{text: string, ms: number, cps: number}} */
  let log = { text: '', ms: 0, cps: TEXT_SPEEDS.normal };
  let prevLog = '';
  let promptLine = '';
  /** @type {ReturnType<typeof createDeferredBus>|null} */ let deferred = null;
  /** @type {any} */ let post = null;
  let endStarted = false;
  let lastReadout = null;
  /** @type {any} */ let readInfo = null;
  /** @type {any} */ let overlay = null;   // read card / readout / learn / naming / message slip
  let typedSkip = false;
  /** @type {((e: KeyboardEvent) => void)|null} */ let keyListener = null;

  const hit = { mult: null, crit: false, effEv: null, critEv: null, moveType: null };
  /** @type {Array<any>} */ const fx = [];       // floating words, arrows, puffs, sparkles, banners
  /** @type {Map<string, number>} */ const knownHp = new Map();

  /** Per-side display model. */
  const sides = [0, 1].map((i) => ({
    i, present: false, name: '', speciesId: '', level: 1, hp: 0, maxHp: 1, shownHp: 0, fromHp: 0, toHp: 0, hpT: 1, hpMs: 0,
    status: null, types: [], mark: null, lit: true, uid: null,
    offX: 0, offY: 0, nudgeMs: 0, nudgeDur: 1, nudgePx: 0, lungeMs: 0,
    flashMs: 0, glintMs: 0, faintT: 0, fainting: false, enterT: 1, entering: false, recallT: 0, recalling: false,
    latticeMs: 0, foldT: 0, folding: false, hidden: false, rise: 0, box: 0,
  }));
  const expBar = { shown: 0, target: 0, level: 1 };
  const lanternFx = { phase: null, f: 0, len: 0, segments: 0, success: false, meter: 0, show: false };
  const trainerFx = { show: false, x: 480, portrait: null, name: '' };
  const intro = { rustle: 0, place: 'grass' };
  /** @type {{kind: string, name: string, turnsLeft: number|null, posted: any[]}|null} */
  let weatherState = null;
  /** posted boss-Shift strips by creature ('shift-posted' until its 'boss-shift'; GDD-04 §1.4): a strip
   * belongs to its creature, so it shows only while that creature stands on the field (never over the
   * foe that replaced a fainted or recalled one) and comes back with it */
  /** @type {Map<any, {side: number, uid: any, who: string, cards: Array<{dir: string, name: string, odds: number}>, turnsLeft: number}>} */
  const postedStrips = new Map();
  /** foe forms still shown before their queued 'boss-shift' plays (uid -> the form before) */
  /** @type {Map<any, {speciesId: string, types: string[], name: string, maxHp: number|null}>} */
  const formShown = new Map();
  let levelFlashMs = 0;

  const queue = createAnimQueue({
    speed: speedPref,
    instant: false,
    onSettle: settle,
    onError: (err) => { console.error('battle anim', err); },
  });

  // ------------------------------------------------------------------------------------------
  // helpers
  // ------------------------------------------------------------------------------------------

  const world = () => G.world;
  const reduced = () => !!world()?.settings?.reducedMotion;
  const instant = () => !!(world()?.settings?.skipAnims || G.flags?.noanim);
  const textCps = () => TEXT_SPEEDS[world()?.settings?.textSpeed] ?? TEXT_SPEEDS.normal;
  /** UI sounds go through the bus (the sfx router mixes and rate-limits them); the rest straight to the engine. */
  const UI_SFX = { blip: 'ui:cursor', confirm: 'ui:confirm', cancel: 'ui:cancel' };
  const sfx = (name, o) => {
    try {
      if (UI_SFX[name] && !o) G.bus?.emit(UI_SFX[name], {});
      else G.audio?.sfx?.(name, o);
    } catch { /* audio locked */ }
  };
  const st = () => session.battle.state();
  const legal = () => session.battle.legal(0);
  const emitBus = (evt, payload) => { try { G.bus?.emit(evt, payload); } catch (err) { console.error(err); } };
  /**
   * The creature on a side cries (GDD-09 §10.5): on send-out, a wild entrance, a faint and a catch.
   * The voice comes from its species row (stage, primary type, size); a bonded one ends on the tail.
   * @param {number} side @param {'sendOut'|'appear'|'faint'|'capture'} why
   */
  const cry = (side, why) => {
    const m = sides[side];
    if (!m || !m.speciesId) return;
    try {
      let row = null;
      try { row = data && data.tryGet ? data.tryGet('species', m.speciesId) : null; } catch { row = null; }
      const params = cryParams(row, { bonded: why !== 'capture' && !!m.lit, star: !!m.starTouched, speciesId: m.speciesId, types: m.types });
      // a faint droops: the same voice a few semitones down and softer
      const o = why === 'faint' ? { semitones: -4, volume: 0.8 } : why === 'capture' ? { volume: 0.7 } : { volume: 0.9 };
      G.audio?.cry?.(params, { ...o, pan: side === 1 ? 0.35 : -0.35 });
    } catch { /* audio locked */ }
  };

  function setSpeed(n) {
    if (!SPEEDS.includes(n)) return;
    speedPref = n;
    queue.speed = n;
    G.store?.tx?.('battle:speed', w => { w.settings.battleSpeed = n; });
  }

  function cycleSpeed() {
    const i = SPEEDS.indexOf(queue.speed);
    setSpeed(SPEEDS[(i + 1) % SPEEDS.length]);
    sfx('blip', { pitch: i * 2 });
  }

  /** The display model of a side, synced from the engine for its active creature. */
  function syncSide(side, opts = {}) {
    const s = st().sides[side];
    const c = s.party[s.active];
    const m = sides[side];
    const real = session.battle.active(side);
    m.present = true;
    m.name = c.name;
    m.speciesId = c.speciesId;
    m.level = side === 0 ? (expDisplay(session, c.uid)?.level ?? c.level) : c.level;
    m.maxHp = c.maxHp;
    // the engine state is already past a queued boss Shift: show the form it had until the Shift plays
    const before = formShown.get(c.uid);
    const hp = knownHp.has(`${side}:${c.uid}`) ? knownHp.get(`${side}:${c.uid}`) : c.hp;
    if (!opts.keepHp) { m.hp = hp; m.shownHp = hp; m.toHp = hp; m.hpT = 1; }
    m.status = c.status;
    m.types = c.types.slice();
    m.uid = c.uid;
    if (before) {
      m.name = before.name; m.speciesId = before.speciesId; m.types = before.types.slice();
      if (before.maxHp && !opts.keepHp) {
        const h = Math.round((hp * before.maxHp) / Math.max(1, c.maxHp));
        m.maxHp = before.maxHp; m.hp = h; m.shownHp = h; m.toHp = h;
      }
    }
    m.mark = real.mark ?? null;
    m.starTouched = !!real.starTouched;
    m.lit = side === 0 ? true : !real.wild;
    if (side === 0) {
      const e = expDisplay(session, c.uid);
      expBar.shown = expBar.target = e ? e.frac : 0;
      expBar.level = e ? e.level : c.level;
    }
  }

  /** Records an HP the engine reported for a named creature (so a later send-out shows it). */
  function noteHp(side, name, hp) {
    const s = st().sides[side];
    const idx = s.party.findIndex((c) => c.name === name && !c.fainted) >= 0 ? s.party.findIndex((c) => c.name === name && !c.fainted) : s.party.findIndex((c) => c.name === name);
    if (idx >= 0) knownHp.set(`${side}:${s.party[idx].uid}`, hp);
  }

  function settle() {
    for (const m of sides) {
      m.shownHp = m.toHp; m.hpT = 1; m.offX = 0; m.offY = 0; m.nudgeMs = 0; m.lungeMs = 0; m.flashMs = 0;
      if (m.fainting) { m.faintT = 1; m.fainting = false; m.hidden = true; }
      if (m.entering) { m.enterT = 1; m.entering = false; }
      if (m.recalling) { m.recallT = 1; m.recalling = false; }
      if (m.folding) { m.foldT = 1; m.folding = false; }
    }
    expBar.shown = expBar.target;
    freezeMs = 0;
    shakeMs = 0;
    log.ms = 1e9;
    if (lanternFx.phase === 'meter') lanternFx.meter = lanternFx.segments;
  }

  // ------------------------------------------------------------------------------------------
  // the view (battleAnims drive it)
  // ------------------------------------------------------------------------------------------

  /** @type {import('./battleAnims.js').BattleView} */
  const view = {
    hit,
    get reducedMotion() { return reduced(); },
    sfx(ev) { emitBus('battle:event', { event: ev }); },
    say(text) {
      if (!text) return 0;
      if (log.text && log.text !== text && log.text !== promptLine) prevLog = log.text;
      log = { text: String(text), ms: 0, cps: instant() ? Infinity : textCps() };
      // text stays readable at 2x / 4x: the queue divides by the speed, so give back its square root
      return lineMs(text, log.cps) * Math.sqrt(queue.speed);
    },
    hpTo(side, hp, maxHp) {
      const m = sides[side];
      noteHp(side, m.name, hp);
      m.fromHp = m.shownHp;
      m.toHp = hp;
      m.hp = hp;
      m.maxHp = maxHp || m.maxHp;
      const span = Math.abs(hp - m.fromHp) / Math.max(1, m.maxHp);
      m.hpMs = Math.max(140, Math.min(640, span * 900));
      m.hpT = 0;
      return m.hpMs;
    },
    emitHp(side) {
      const m = sides[side];
      emitBus('battle:hp', { side, hp: m.hp, maxHp: m.maxHp, hpRatio: m.maxHp > 0 ? m.hp / m.maxHp : 1, lead: side === 0 });
    },
    hitStop(n) { freezeMs = Math.max(freezeMs, frames(n)); },
    nudge(side, px, n) {
      const m = sides[side];
      m.nudgePx = (side === 1 ? 1 : -1) * px; m.nudgeDur = frames(n); m.nudgeMs = frames(n);
    },
    lunge(side) { sides[side].lungeMs = frames(14); },
    shake(px, n) { if (!reduced()) { shakePx = px; shakeMs = frames(n); } },
    flash(side, n) { sides[side].flashMs = frames(n); },
    effWord(side, tier, ward) {
      fx.push({ kind: 'word', side, tier, text: `${EFF_GLYPH[tier]} ${effWord(tier, { ward })}`, ms: 0, life: frames(44) });
    },
    puff(side, kind) {
      if (reduced()) { fx.push({ kind: 'tag', side, text: t(`battle.status.${kind}`) || kind, ms: 0, life: frames(36) }); return; }
      const colors = { burn: [PALETTE.o, PALETTE.r], poison: [PALETTE.p, '#9A5BC0'], chill: [PALETTE.i, PALETTE.w], numb: [PALETTE.y, PALETTE.w], trap: [PALETTE.u, PALETTE.a], crackdust: [PALETTE.a, PALETTE.v], flinch: [PALETTE.v, PALETTE.w] }[kind] || [PALETTE.v, PALETTE.w];
      const base = side === 1 ? L.foeBase : L.playerBase;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        fx.push({ kind: 'dot', x: base.x + Math.cos(a) * 8, y: base.y - 30 + Math.sin(a) * 6, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.35 - 0.3, color: colors[i % 2], ms: 0, life: frames(30 + (i % 3) * 4) });
      }
      fx.push({ kind: 'icon', side, icon: ['burn', 'poison', 'chill', 'numb'].includes(kind) ? kind : null, ms: 0, life: frames(30) });
    },
    impact(side, type, mult) {
      if (reduced()) return;
      const chip = TYPE_CHIPS[chipId(type)];
      const color = chip ? chip.color : PALETTE.w;
      const base = side === 1 ? { x: L.foeBase.x, y: L.foeBase.y - 30 } : { x: L.playerBase.x, y: L.playerBase.y - 30 };
      const n = mult >= 2 ? 10 : 6;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.3;
        const sp = mult >= 2 ? 1.6 : 1.1;
        fx.push({ kind: 'dot', x: base.x, y: base.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, color: i % 2 ? color : CREAM, ms: 0, life: frames(12) });
      }
    },
    sparkle(side) {
      if (reduced()) return;
      const base = side === 1 ? L.foeBase : L.playerBase;
      for (let i = 0; i < 10; i++) fx.push({ kind: 'star', x: base.x - 22 + ((i * 17) % 44), y: base.y - 52 + ((i * 23) % 44), color: i % 2 ? PALETTE.w : PALETTE.y, ms: -i * 30, life: frames(24) });
    },
    arrows(side, dir, stat) {
      fx.push({ kind: 'arrows', side, dir, stat, ms: 0, life: frames(30) });
    },
    faint(side) { const m = sides[side]; m.fainting = true; m.faintT = 0; cry(side, 'faint'); },
    recall(side) { const m = sides[side]; m.recalling = true; m.recallT = 0; },
    sendOut(side) {
      syncSide(side);
      const m = sides[side];
      m.hidden = false; m.fainting = false; m.faintT = 0; m.recallT = 0; m.recalling = false; m.entering = true; m.enterT = 0; m.foldT = 0;
      cry(side, 'sendOut');
    },
    glint(side) { sides[side].glintMs = frames(30); },
    lattice(side) { sides[side].latticeMs = frames(6) + frames(42); },
    readout(ev) { lastReadout = ev; overlay = { kind: 'readout', ev, t: 0 }; },
    readCard(ev) { if (ev.side === 0) { readInfo = ev.info; overlay = { kind: 'readcard', t: 0 }; } },
    closeOverlay() { if (overlay && (overlay.kind === 'readout' || overlay.kind === 'readcard')) overlay = null; },
    banner(side, text) { fx.push({ kind: 'banner', side, text, ms: 0, life: frames(70) }); },
    lantern(phase, ev) {
      lanternFx.show = true;
      lanternFx.phase = phase;
      lanternFx.f = 0;
      if (phase === 'lift') { lanternFx.len = LANTERN_FRAMES.lift; lanternFx.meter = 0; lanternFx.segments = ev.segments; lanternFx.success = ev.success; }
      else if (phase === 'unfold') lanternFx.len = LANTERN_FRAMES.unfold + LANTERN_FRAMES.fill;
      else if (phase === 'meter') { lanternFx.len = meterFrames(ev.segments); lanternFx.ticks = 0; }
      else if (phase === 'fold') { lanternFx.len = LANTERN_FRAMES.fold; sides[1].folding = true; sides[1].foldT = 0; }
      else if (phase === 'gutter') lanternFx.len = LANTERN_FRAMES.gutter * 2;
      return frames(lanternFx.len);
    },
    expTo(ev) {
      applyExpEvent(session, ev);
      if (ev.uid !== sides[0].uid) return 0;
      const e = expDisplay(session, ev.uid);
      expBar.target = e ? (e.level > expBar.level ? 1 : e.frac) : expBar.target;
      if (e && e.exp >= e.hi) expBar.target = 1;
      return frames(30);
    },
    levelFlash(ev) {
      applyExpEvent(session, ev);
      if (ev.uid === sides[0].uid) {
        levelFlashMs = frames(4) + frames(20);
        sides[0].level = ev.to;
        if (ev.stats && Number.isFinite(ev.stats.hp)) { sides[0].maxHp = ev.stats.hp; }
        const e = expDisplay(session, ev.uid);
        expBar.level = ev.to;
        expBar.shown = 0;
        expBar.target = e ? e.frac : 0;
        sides[0].glintMs = frames(30);
      }
      try { G.toasts?.show?.(t('toast.levelUp', { nick: ev.creature, level: ev.to }), { icon: 'star' }); } catch { /* no toasts */ }
    },
    learnPrompt(ev) {
      let done = false;
      openLearnPrompt(ev).finally(() => { done = true; });
      return () => done;
    },
    payout(ev) { fx.push({ kind: 'coin', side: 0, text: `+${formatNumber(ev.amount)}`, ms: 0, life: frames(60) }); },
    release(ev) { releaseFor(ev); if (ev && ev.type === 'capture') cry(1, 'capture'); },
    stance() { /* the badge redraws from state */ },
    ended(ev) {
      emitBus('battle:end', battleEndPayload(session, ev));
      const tr = session.trainer;
      // a Relay round won with more to come: the twins keep their parting words for the last one
      if (session.relay && !session.relay.final && ev.outcome === 'win') return session.relay.round < session.relay.of ? `Round ${session.relay.round} of ${session.relay.of} won. No healing between rounds.` : null; // str
      if (tr && (ev.outcome === 'win' || ev.outcome === 'loss') && tr.lines) {
        // the trainer steps back in with their parting words
        trainerFx.show = true; trainerFx.out = false; trainerFx.slide = 0;
        trainerFx.portrait = trainerFx.portrait || portraitSprite(tr.npc || tr.portrait) || null;
        trainerFx.name = tr.name;
        const said = ev.outcome === 'win' ? tr.lines.win : tr.lines.lose;
        return said ? `${tr.name}: “${said}”` : null; // str
      }
      return null;
    },
    runAway(side) { sides[side].recalling = true; sides[side].recallT = 0; },
    weather(ev) { weatherState = ev ? { kind: ev.kind, name: ev.name, turnsLeft: ev.turnsLeft, posted: Array.isArray(ev.posted) ? ev.posted : [] } : null; },
    shiftStrip(ev) {
      const side = ev && Number.isInteger(ev.side) ? ev.side : 1;
      if (ev) postedStrips.set(ev.uid, { side, uid: ev.uid, who: ev.who, cards: Array.isArray(ev.cards) ? ev.cards : [], turnsLeft: ev.turnsLeft });
      else postedStrips.delete(sides[1].uid);   // taken down: the Shift landed (or a Reading phase opened) on the creature shown
    },
    reform(ev) {
      formShown.delete(ev.uid);
      postedStrips.delete(ev.uid);
      const m = sides[ev.side];
      if (m.uid !== ev.uid) return;
      m.speciesId = ev.to;
      m.types = Array.isArray(ev.types) ? ev.types.slice() : m.types;
      if (typeof ev.name === 'string') m.name = ev.name;
      if (Number.isFinite(ev.maxHp) && Number.isFinite(ev.hp)) {
        m.maxHp = ev.maxHp; m.hp = ev.hp; m.shownHp = ev.hp; m.toHp = ev.hp; m.hpT = 1;
        knownHp.set(`${ev.side}:${ev.uid}`, ev.hp);
      }
    },
  };

  // ------------------------------------------------------------------------------------------
  // deferred domain events
  // ------------------------------------------------------------------------------------------

  function emitAll(list) { for (const [evt, payload] of list) emitBus(evt, payload); }

  function releaseFor(ev) {
    if (!deferred) return;
    if (ev.type === 'capture') emitAll(deferred.take((e, p) => e === 'capture:ok' || e === 'fieldLog:held' || (e === 'fieldLog:seen' && p && p.formId === ev.speciesId)));
    else if (ev.type === 'levelup') emitAll(deferred.take((e, p) => e === 'creature:levelUp' && p && p.uid === ev.uid));
    else if (ev.type === 'learn') emitAll(deferred.take((e, p) => e === 'creature:learned' && p && p.uid === ev.uid && p.move === ev.move));
    else if (ev.type === 'payout') emitAll(deferred.take((e, p) => e === 'wallet:changed' && p && (p.currency === 'main' || p.currency === undefined)));
  }

  function flushDeferred() {
    if (deferred) emitAll(deferred.take(() => true));
  }

  // ------------------------------------------------------------------------------------------
  // menus (focus models)
  // ------------------------------------------------------------------------------------------

  const cmdRect = (i) => ({ x: L.cmdX + i * (L.cmdW + L.cmdGap), y: L.cmdY, w: L.cmdW, h: L.cmdH });
  const moveRect = (i) => ({ x: L.moves.x + (i % 2) * (L.moves.w + L.moves.gx), y: L.moves.y + Math.floor(i / 2) * (L.moves.h + L.moves.gy), w: L.moves.w, h: L.moves.h });

  const rootFocus = createFocus({ cols: COMMANDS.length, wrap: true, items: [] });
  rootFocus.on('activate', (ev) => onCommand(ev.item.id));
  rootFocus.on('change', () => sfx('blip'));
  rootFocus.on('blocked', () => sfx('blocked', { pitch: -5 }));

  const moveFocus = createFocus({ cols: 2, wrap: true, items: [] });
  moveFocus.on('activate', (ev) => onMove(ev.item.id));
  moveFocus.on('cancel', () => { sfx('cancel'); toRoot(); });
  moveFocus.on('change', () => sfx('blip'));
  moveFocus.on('blocked', () => sfx('blocked', { pitch: -5 }));

  const listFocus = createFocus({ cols: 1, wrap: true, items: [] });
  listFocus.on('activate', (ev) => onListPick(ev.item));
  listFocus.on('cancel', () => onListCancel());
  listFocus.on('change', () => sfx('blip'));
  listFocus.on('blocked', () => sfx('blocked', { pitch: -5 }));

  /** @type {{kind: 'party'|'bag'|'lantern', rows: any[], forced?: boolean}|null} */
  let list = null;
  /** a list to reopen after a free action (Stance toggled from the Lantern panel) */
  let resumeList = null;

  function commandItems() {
    const lg = legal();
    const out = [];
    const fightOk = lg.moves.some((m) => m.selectable) || (lg.scrap && lg.scrap.available) || !!lg.locked;
    out.push({ id: 'fight', rect: cmdRect(0), enabled: fightOk, reason: 'Nothing to use.' }); // str
    out.push({ id: 'read', rect: cmdRect(1), enabled: true });
    const lanternOk = !!(lg.lantern && lg.lantern.available);
    out.push({ id: 'lantern', rect: cmdRect(2), enabled: lanternOk, reason: lanternOk ? '' : (lg.lantern && lg.lantern.reason) || '' });
    const bagRows = bagMenu(session, world());
    out.push({ id: 'bag', rect: cmdRect(3), enabled: bagRows.length > 0, reason: 'The satchel has nothing for a battle.' }); // str
    const swOk = lg.switches.some((s) => s.selectable);
    out.push({ id: 'switch', rect: cmdRect(4), enabled: swOk, reason: (lg.switches.find((s) => s.reason && /trapped/.test(s.reason)) || {}).reason || 'No one else can come out.' }); // str
    const runOk = !!(lg.run && lg.run.available);
    let runReason = (lg.run && lg.run.reason) || '';
    if (!runOk && session.story) runReason = t('battle.msg.runNo');
    out.push({ id: 'run', rect: cmdRect(5), enabled: runOk, reason: runReason });
    if (lg.locked) for (const it of out) if (it.id !== 'fight') { it.enabled = false; it.reason = lg.locked.reason; }
    return out;
  }

  function toRoot() {
    mode = 'menu';
    list = null;
    rootFocus.setItems(commandItems(), { keepId: false });
    rootFocus.set(0);
    const c = st().sides[0].party[st().sides[0].active];
    for (const side of [0, 1]) {
      const active = session.battle.active(side);
      sides[side].types = active.types.slice();
      sides[side].status = active.status?.kind ?? null;
    }
    const hold = session.battle.rules.holdOutTurns;
    const reading = st().reading;
    promptLine = reading ? `${reading.name}: ${reading.turnsLeft} turns. Next: ${reading.next}.` : hold ? t('battle.msg.holdout', { n: Math.max(0, hold - session.battle.turn) }) : t('battle.chooseMove', { nick: c.name });
    log = { text: promptLine, ms: 1e9, cps: Infinity };
  }

  function moveItems() {
    const lg = legal();
    if (lg.moves.every((m) => !m.selectable) && lg.scrap && lg.scrap.available) {
      return [{ id: 'scrap', rect: { x: L.moves.x, y: L.moves.y, w: L.moves.w * 2 + L.moves.gx, h: L.moves.h }, enabled: true }];
    }
    return lg.moves.map((m, i) => ({ id: String(i), rect: moveRect(i), enabled: m.selectable, reason: m.selectable ? '' : 'No PP left.' })); // str
  }

  function openMoves() {
    const lg = legal();
    if (lg.locked) { act({ type: 'move', move: lg.locked.move }); return; }
    mode = 'moves';
    moveFocus.setItems(moveItems(), { keepId: false });
    moveFocus.set(0);
  }

  function openList(kind, opts = {}) {
    let rows;
    if (kind === 'party') {
      const lg = legal();
      rows = lg.switches.map((s) => ({ id: `p${s.index}`, index: s.index, enabled: s.selectable, reason: s.reason || '', data: s }));
    } else if (kind === 'bag') {
      rows = bagMenu(session, world()).map((r) => ({ id: r.id, enabled: r.selectable, reason: bagReason(r), data: r }));
    } else {
      const menu = captureMenu(session);
      rows = menu.rows.map((r) => ({ id: `g${r.grade}`, enabled: r.selectable, reason: r.selectable ? '' : t('capture.noWicks'), data: r }));
    }
    list = { kind, rows, forced: !!opts.forced };
    mode = kind;
    layoutList();
    listFocus.setItems(list.rows, { keepId: false });
    listFocus.set(0);
  }

  function bagReason(r) {
    if (r.selectable) return '';
    if (r.reason === 'hp-full') return t('battle.blocked.hp-full', { target: sides[0].name });
    if (r.kind === 'crackdust') return t('battle.msg.crackdustKept', { target: sides[1].name });
    if (r.reason === 'field-only') return 'Use it from the Satchel after the battle.'; // str
    if (r.reason === 'not-wild') return t('capture.notWild');
    return String(r.reason || '');
  }

  function layoutList() {
    if (!list) return;
    if (list.kind === 'party') {
      list.rows.forEach((r, i) => { r.rect = { x: 16 + (i % 2) * 228, y: 26 + Math.floor(i / 2) * 54, w: 220, h: 48 }; });
    } else if (list.kind === 'bag') {
      list.rows.forEach((r, i) => { r.rect = { x: 248, y: 40 + i * 18, w: 216, h: 16 }; });
    } else {
      list.rows.forEach((r, i) => { r.rect = { x: 16, y: 215 + i * 13, w: 200, h: 12 }; });
    }
  }

  function onListPick(item) {
    if (!list) return;
    if (list.kind === 'party') {
      act({ type: 'switch', to: item.index });
    } else if (list.kind === 'bag') {
      if (item.data && item.data.kind === 'wick') {
        const grade = item.data.grade;
        openList('lantern');
        const idx = list.rows.findIndex((r) => r.data && r.data.grade === grade);
        if (idx >= 0) listFocus.set(idx);
        return;
      }
      act({ type: 'item', id: item.id });
    } else {
      const r = item.data;
      if (r.sure) {
        const spec = confirmSpec('oneOfAKind', { item: r.name });
        // a possessive name reads wrong after "the": "Use Isolde's Lantern?"
        const body = /'s\b/.test(r.name) ? `Use ${r.name}? There is only one.` : spec.body; // str
        mode = 'modal';
        openConfirm(G, { body, options: spec.options, defaultIndex: 0 }).then((i) => {
          if (i === 1) act({ type: 'lantern', grade: 'sure' });
          else openList('lantern');
        });
      } else {
        act({ type: 'lantern', grade: r.grade });
      }
    }
  }

  function onListCancel() {
    if (list && list.forced) { sfx('blocked', { pitch: -5 }); return; }
    sfx('cancel');
    toRoot();
  }

  function onCommand(id) {
    sfx('confirm');
    if (id === 'fight') openMoves();
    else if (id === 'read') onRead();
    else if (id === 'lantern') openList('lantern');
    else if (id === 'bag') openList('bag');
    else if (id === 'switch') openList('party');
    else if (id === 'run') act({ type: 'run' });
  }

  function onMove(id) {
    if (id === 'scrap') act({ type: 'scrap' });
    else act({ type: 'move', move: Number(id) });
  }

  function onRead() {
    const lg = legal();
    if (lg.read && lg.read.available && !lg.read.costsTurn) {
      const evs = session.battle.read(0);
      enqueue(evs);
      return;
    }
    if (lg.read && lg.read.available && lg.read.costsTurn) {
      overlay = { kind: 'readcard', t: 0, ask: true };
      mode = 'modal';
      return;
    }
    overlay = { kind: 'readcard', t: 0, browse: true };
    mode = 'modal';
  }

  function toggleStance() {
    const lg = legal();
    if (!lg.captureStance || !lg.captureStance.available) return;
    const evs = session.battle.setCaptureStance(!lg.captureStance.on);
    enqueue(evs);
  }

  // ------------------------------------------------------------------------------------------
  // acting
  // ------------------------------------------------------------------------------------------

  function enqueue(events) {
    noteShifts(events);
    for (const ev of events) queue.push(animFor(ev, view));
    mode = 'busy';
  }

  /** Remembers the form each queued 'boss-shift' leaves, so the sprite changes when the Shift plays, not before. @param {any[]} events */
  function noteShifts(events) {
    for (const ev of events) {
      if (ev.type !== 'boss-shift' || formShown.has(ev.uid)) continue;
      const types = Array.isArray(ev.fromTypes) ? ev.fromTypes : [];
      formShown.set(ev.uid, { speciesId: ev.from, types, name: typeof ev.who === 'string' ? ev.who : ev.from, maxHp: Number.isFinite(ev.fromMaxHp) ? ev.fromMaxHp : null });
    }
  }

  function act(action) {
    let events;
    try {
      prepareAction(session, action);
      events = session.battle.step(action);
    } catch (err) {
      sfx('blocked', { pitch: -5 });
      log = { text: String(err && err.message ? err.message : err), ms: 1e9, cps: Infinity };
      if (mode !== 'menu') toRoot();
      return;
    }
    noteEvents(G, session, events);
    if (session.battle.phase === 'ended' && !session.applied) {
      deferred = createDeferredBus();
      try {
        post = applyBattleResult(G, session, { bus: deferred });
      } catch (err) {
        console.error('battle result', err);
        post = { outcome: session.battle.outcome, levelUps: [], windowsOpened: [], caught: null, blackout: null, payout: 0 };
      }
    }
    list = null;
    enqueue(events);
  }

  // ------------------------------------------------------------------------------------------
  // learn-move prompt, naming, windows
  // ------------------------------------------------------------------------------------------

  /** @param {any} ev @returns {Promise<void>} */
  function openLearnPrompt(ev) {
    return new Promise((resolve) => {
      const f = world().party.find((c) => c.uid === ev.uid) || world().box.find((c) => c.uid === ev.uid);
      if (!f || f.moves.some((m) => m.id === ev.move)) { resolve(); return; }
      const moveRow = data.tryGet ? data.tryGet('moves', ev.move) : null;
      const newName = moveRow ? moveRow.name : ev.move;
      const rows = [{ id: 'keep', label: 'Keep its techniques', enabled: true }]; // str
      f.moves.forEach((m, i) => {
        const r = data.tryGet ? data.tryGet('moves', m.id) : null;
        const isMark = m.id === f.heartmark;
        rows.push({ id: `f${i}`, index: i, label: isMark ? `${r ? r.name : m.id}: its Heartmark technique stays` : `${t('confirm.option.forget')} ${r ? r.name : m.id}`, enabled: !isMark, mark: isMark, reason: isMark ? 'Its Heartmark technique stays.' : '' }); // str
      });
      rows.forEach((r, i) => { r.rect = { x: 132, y: 70 + i * 16, w: 216, h: 14 }; });
      const focus = createFocus({ cols: 1, wrap: true, items: rows });
      overlay = { kind: 'learn', ev, focus, rows, title: t('battle.msg.learnOffer', { target: ev.creature, move: newName }), busy: false };
      const prevMode = mode;
      mode = 'modal';
      const close = () => { overlay = null; mode = prevMode === 'modal' ? 'busy' : prevMode; resolve(); };
      focus.on('blocked', () => sfx('blocked', { pitch: -5 }));
      focus.on('cancel', () => { if (!overlay.busy) { log = { text: t('battle.msg.keptMoves', { target: ev.creature }), ms: 0, cps: textCps() }; close(); } });
      focus.on('activate', (fe) => {
        if (overlay.busy) return;
        const row = fe.item;
        if (row.id === 'keep') {
          log = { text: t('battle.msg.keptMoves', { target: ev.creature }), ms: 0, cps: textCps() };
          close();
          return;
        }
        overlay.busy = true;
        const oldRow = data.tryGet ? data.tryGet('moves', f.moves[row.index].id) : null;
        const spec = confirmSpec('forget', { nick: ev.creature, move: oldRow ? oldRow.name : f.moves[row.index].id, newMove: newName });
        openConfirm(G, { body: spec.body, options: spec.options, defaultIndex: 0 }).then((i) => {
          overlay.busy = false;
          if (i === 1) {
            const ok = learnOffered(G, ev.uid, ev.move, row.index, data);
            if (ok) {
              sfx('confirm');
              log = { text: t('battle.msg.learned', { target: ev.creature, move: newName }), ms: 0, cps: textCps() };
              close();
            }
          }
        });
      });
    });
  }

  /** @param {{uid: string, speciesId: string, nickname: string}} caught @returns {Promise<void>} */
  function openNaming(caught) {
    return new Promise((resolve) => {
      const species = data.tryGet ? data.tryGet('species', caught.speciesId) : null;
      const suggestion = (species && species.flags && (species.flags.suggestedName || species.flags.suggestName)) || '';
      const keys = [];
      const letters = ["ABCDEFGHIJ", "KLMNOPQRST", "UVWXYZ'-. "];
      letters.forEach((row, ry) => { for (let i = 0; i < row.length; i++) keys.push({ id: `k${ry}${i}`, ch: row[i], rect: { x: 120 + i * 24, y: 120 + ry * 20, w: 22, h: 18 }, enabled: true }); });
      const ctrl = [['caps', t('entry.caps')], ['del', t('entry.delete')], ['suggest', t('entry.suggest')], ['done', t('entry.done')]];
      ctrl.forEach(([id, label], i) => keys.push({ id, label, rect: { x: 120 + i * 60, y: 182, w: 56, h: 16 }, enabled: id !== 'suggest' || !!suggestion }));
      const focus = createFocus({ cols: 10, wrap: true, items: keys });
      // the field opens with the form's name selected: Done keeps it, the first letter typed replaces it
      const state = { kind: 'naming', name: caught.nickname, selected: true, caps: true, focus, keys, note: '', species: species ? species.name : caught.nickname, busy: false };
      overlay = state;
      mode = 'modal';
      const finish = (name) => {
        state.busy = true;
        openConfirm(G, { body: `Call it ${name}?`, options: ['Not yet', 'Yes'], defaultIndex: 0 }).then((i) => { // str
          state.busy = false;
          if (i !== 1) return;
          if (name !== caught.nickname) nameCaught(G, caught.uid, name);
          removeKeys();
          overlay = null;
          resolve();
        });
      };
      const type = (ch) => {
        if (state.busy) return;
        if (state.selected) { state.name = ''; state.selected = false; }
        if (state.name.length >= 10) { state.note = t('entry.tooLong', { n: 10 }); sfx('blocked', { pitch: -5 }); return; }
        state.name += state.caps ? ch.toUpperCase() : ch.toLowerCase();
        state.note = '';
        sfx('blip');
      };
      const del = () => {
        if (state.selected) { state.name = ''; state.selected = false; sfx('cancel'); return; }
        if (state.name.length) { state.name = state.name.slice(0, -1); sfx('cancel'); }
      };
      const done = () => {
        const name = state.name.trim();
        if (!name) { state.note = t('entry.empty'); sfx('blocked', { pitch: -5 }); return; }
        finish(name);
      };
      state.type = type; state.del = del; state.done = done;
      focus.on('activate', (fe) => {
        if (state.busy) return;
        const k = fe.item;
        if (k.ch !== undefined) type(k.ch);
        else if (k.id === 'caps') { state.caps = !state.caps; sfx('blip'); }
        else if (k.id === 'del') del();
        else if (k.id === 'suggest') { state.name = suggestion; state.selected = true; sfx('blip'); }
        else if (k.id === 'done') done();
      });
      focus.on('cancel', () => { if (!state.busy) del(); });
      // physical keyboards type directly
      if (typeof window !== 'undefined') {
        keyListener = (e) => {
          if (state.busy || overlay !== state) return;
          if (e.key === 'Enter') { done(); typedSkip = true; e.preventDefault(); return; }
          if (e.key === 'Backspace') { del(); typedSkip = true; e.preventDefault(); return; }
          if (e.key && e.key.length === 1 && /[A-Za-z0-9'\-. ]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
            if (state.selected) { state.name = ''; state.selected = false; }
            state.name.length < 10 ? (state.name += e.key) : (state.note = t('entry.tooLong', { n: 10 }));
            typedSkip = true;
            e.preventDefault();
          }
        };
        window.addEventListener('keydown', keyListener, true);
      }
    });
  }

  function removeKeys() {
    if (keyListener && typeof window !== 'undefined') window.removeEventListener('keydown', keyListener, true);
    keyListener = null;
  }

  /** @param {string} uid @returns {Promise<void>} */
  function offerWindow(uid) {
    const c = world().party.find((x) => x.uid === uid) || world().box.find((x) => x.uid === uid);
    if (!c) return Promise.resolve();
    return openConfirm(G, { body: t('shift.window', { nick: c.nickname }), options: [t('forecast.later'), 'Open now'], defaultIndex: 0 }).then((i) => { // str
      if (i !== 1) {
        try { G.toasts?.show?.(t('forecast.deferred', { nick: c.nickname })); } catch { /* no toasts */ }
        return undefined;
      }
      return new Promise((resolve) => G.push('forecast', { uid, deferrable: true, onDone: () => resolve(undefined) }));
    });
  }

  // ------------------------------------------------------------------------------------------
  // the end
  // ------------------------------------------------------------------------------------------

  async function finish() {
    if (endStarted) return;
    endStarted = true;
    mode = 'end';
    const p = post || { outcome: session.battle.outcome, windowsOpened: [], caught: null, blackout: null };
    if (p.outcome === 'capture' && p.caught) {
      await openNaming(p.caught);
      const sp = data.tryGet ? data.tryGet('species', p.caught.speciesId) : null;
      try {
        G.toasts?.show?.(`Field Log: ${sp ? sp.name : p.caught.speciesId} Held`, { icon: 'check' }); // str
        if (p.caught.where === 'box') G.toasts?.show?.(t('capture.sent', { name: p.caught.nickname }));
      } catch { /* no toasts */ }
    }
    if (p.caughtLost) { try { G.toasts?.show?.('No room anywhere. It slipped back into the grass.'); } catch { /* */ } } // str
    if (p.badge) {
      overlay = { kind: 'slip', title: `${p.badge[0].toUpperCase()}${p.badge.slice(1)} seal`, lines: [ // str
        `+${p.starsalt} Starsalt`, // str
        p.spireShare > 0 ? `Spire share: ${formatNumber(p.spireShare)}◉ notched on Wren's ledger` : '', // str
        ...sealRewardLines(p),
      ].filter(Boolean) };
      sfx('achievement');
      await waitConfirm();
      overlay = null;
    }
    for (const uid of p.windowsOpened || []) await offerWindow(uid);
    flushDeferred();
    if (p.relay && p.outcome === 'win') {
      // the Relay (MID-05): pick the next round's two, then the next round starts in this same scene
      const next = await relayPick(p.relay);
      enter({ ...params, setup: next });
      return;
    }
    if (p.blackout) {
      await blackoutFade(p.blackout);
    }
    await fadeTo();
    mode = 'done';
    const result = p;
    if (G.scenes.top && G.scenes.top() === scene) G.scenes.pop({ result });
    if (params && typeof params.onDone === 'function') params.onDone(result);
  }

  /**
   * The Relay's between-rounds screen: choose who fights the next round (no repeats until you run
   * dry), open the satchel (between-fight bag use: the Relay heals nothing between rounds), begin.
   * Also opens before round 1 (`rp.next` 1), so the first pair is chosen against the posted rounds too.
   * @param {{round: number, of: number, next: number, used: string[]}} rp
   * @param {(picks: string[]) => any} [makeSetup]   the chosen round's setup (default: the round after `session`)
   * @returns {Promise<any>} the next round's setup
   */
  function relayPick(rp, makeSetup) {
    return new Promise((resolve) => {
      const rule = relayRule(session.trainer, data);
      const done = session;
      const setupFor = typeof makeSetup === 'function' ? makeSetup : (picks) => relayNextSetup(done, picks);
      const o = { kind: 'relay', title: `Round ${rp.next} of ${rp.of}`, rows: [], focus: null, picks: [], per: 2, note: '', busy: false, resolve: null }; // str
      const build = () => {
        const ch = relayChoices(world(), rule, rp.used);
        o.per = Math.max(1, ch.per);
        o.picks = o.picks.filter((u) => ch.rows.some((r) => r.uid === u && r.ok)).slice(0, o.per);
        if (!o.picks.length) o.picks = relayDefaultPicks(world(), rule, rp.used);
        o.dry = ch.dry;
        o.rows = ch.rows.map((r) => ({ id: r.uid, uid: r.uid, label: r.nickname, enabled: r.ok, reason: r.reason || '', fresh: r.fresh }));
        o.rows.push({ id: 'satchel', label: 'Open the satchel', enabled: true }); // str
        o.rows.push({ id: 'begin', label: `Begin round ${rp.next}`, enabled: true }); // str
        o.rows.forEach((r, i) => { r.rect = { x: 112, y: 66 + i * 15, w: 256, h: 13 }; });
        const keep = o.focus ? o.focus.index : 0;
        o.focus = createFocus({ cols: 1, wrap: true, items: o.rows });
        if (keep > 0 && keep < o.rows.length) o.focus.index = keep;
        o.focus.on('blocked', (fe) => { sfx('blocked', { pitch: -5 }); if (fe?.item?.reason) o.note = fe.item.reason; });
        o.focus.on('change', () => sfx('blip'));
        o.focus.on('cancel', () => sfx('cancel'));
        o.focus.on('activate', (fe) => {
          if (o.busy) return;
          const row = fe.item;
          if (row.id === 'satchel') {
            o.busy = true;
            o.awaitBag = true;
            G.push('bag', { pocket: 'medicine' });
            return;
          }
          if (row.id === 'begin') {
            if (!o.picks.length) { o.note = 'Choose who fights this round.'; sfx('blocked', { pitch: -5 }); return; } // str
            sfx('confirm');
            overlay = null;
            resolve(setupFor(o.picks.slice()));
            return;
          }
          const at = o.picks.indexOf(row.uid);
          if (at >= 0) o.picks.splice(at, 1);
          else if (o.picks.length < o.per) o.picks.push(row.uid);
          else { o.picks.shift(); o.picks.push(row.uid); }
          o.note = '';
          sfx('confirm');
        });
      };
      o.refresh = () => { o.busy = false; o.awaitBag = false; build(); };
      build();
      overlay = o;
      mode = 'modal';
    });
  }

  /** @returns {Promise<void>} */
  function waitConfirm() {
    return new Promise((resolve) => {
      mode = 'modal';
      overlay = { ...(overlay || { kind: 'slip', lines: [] }), resolve };
    });
  }

  /** @param {any} b @returns {Promise<void>} */
  function blackoutFade(b) {
    return new Promise((resolve) => {
      const lines = b.summit ? 'The Summit takes nothing. Come back when you are ready.' // str
        : b.lost > 0 ? t('battle.blackout', { n: b.lost }) : t('battle.blackoutFree');
      overlay = { kind: 'blackout', t: 0, text: lines, resolve, who: 'Dimity' }; // str
      mode = 'modal';
    });
  }

  /** @returns {Promise<void>} */
  function fadeTo() {
    return new Promise((resolve) => {
      if (instant()) { fadeOut = 1; resolve(); return; }
      const tick = { resolve };
      fadeTask = tick;
    });
  }
  /** @type {{resolve: () => void}|null} */ let fadeTask = null;

  // ------------------------------------------------------------------------------------------
  // intro
  // ------------------------------------------------------------------------------------------

  function introAnims() {
    const b = session.battle;
    const trainer = session.trainer;
    const foe = st().sides[1].party[st().sides[1].active];
    const me = st().sides[0].party[st().sides[0].active];
    intro.place = session.setup.wild && session.setup.wild.habitat === 'water' ? 'water' : 'grass';
    queue.push({
      name: 'curtain', skippable: true, run: function* run() {
        curtain = 1;
        yield frames(4);
      },
    });
    if (trainer) {
      const portrait = portraitSprite(trainer.npc || trainer.portrait) || null;
      queue.push({
        name: 'trainer-in', skippable: true, run: function* run() {
          const name = session.relay ? session.relay.name : trainer.name;
          trainerFx.show = true; trainerFx.x = 480; trainerFx.portrait = portrait; trainerFx.name = name; trainerFx.title = trainer.title;
          trainerFx.slide = 0;
          yield frames(18);
          // a Relay round after the first names the round instead of repeating the twins' opening
          const ms = session.relay && session.relay.round > 1 ? view.say(session.relay.label)
            : view.say(`${name}: “${trainer.lines?.intro || t('battle.trainer', { trainer: name })}”`); // str
          yield Math.max(ms, 900);
          trainerFx.out = true;
          yield frames(12);
          trainerFx.show = false;
          view.sendOut(1);
          emitBus('battle:event', { event: { type: 'switch', side: 1, from: '', to: foe.name, text: '' } });
          const m2 = view.say(`${session.relay ? session.relay.name : trainer.name} sends out ${foe.name}.`); // str
          yield frames(20);
          view.glint(1);
          yield Math.max(frames(10), m2 - frames(20));
        },
      });
    } else {
      queue.push({
        name: 'wild-appear', skippable: true, run: function* run() {
          sides[1].present = true;
          syncSide(1);
          sides[1].rise = 1;
          intro.rustle = frames(36);
          yield frames(24);
          cry(1, 'appear');
          // the Reading lands on the Lantern Stack: never "came out of the grass" (MID-18)
          const ms = view.say(session.battle.readingPhases ? `The ${foe.name} settles on the Lantern Stack. Its mark is already glowing.` // str
            : t('battle.wild', { name: foe.name, place: intro.place === 'water' ? 'water' : 'grass' }));
          yield frames(18);
          yield Math.max(frames(10), ms - frames(18));
        },
      });
      if (session.setup.wild && session.setup.wild.errant) {
        queue.push({
          name: 'errant', skippable: false, run: function* run() {
            let done = false;
            openConfirm(G, { body: t('battle.errant'), options: [t('battle.decline'), t('battle.cmd.stance')], defaultIndex: 0 }).then((i) => {
              if (i === 1) for (const ev of b.setCaptureStance(true)) queue.push(animFor(ev, view));
              done = true;
            });
            yield { until: () => done };
          },
        });
      }
    }
    queue.push({
      name: 'send-out', skippable: true, run: function* run() {
        view.sendOut(0);
        emitBus('battle:event', { event: { type: 'switch', side: 0, from: '', to: me.name, text: '' } });
        view.emitHp(0);
        const ms = view.say(t('battle.sendOut', { nick: me.name }));
        yield frames(20);
        view.glint(0);
        yield Math.max(frames(12), ms - frames(20));
      },
    });
    // the engine's own opening events (switch-in abilities, auto-Reads); its greeting line is ours already
    const opening = b.intro.filter((ev, i) => !(i === 0 && ev.type === 'message'));
    for (const ev of opening) queue.push(animFor(ev, view));
  }

  // ------------------------------------------------------------------------------------------
  // lifecycle
  // ------------------------------------------------------------------------------------------

  /** @param {any} p */
  function enter(p) {
    params = p || {};
    elapsed = 0;
    arenaMs = 0;
    error = null;
    endStarted = false;
    post = null;
    deferred = null;
    overlay = null;
    fx.length = 0;
    knownHp.clear();
    queue.clear();
    speedPref = SPEEDS.includes(world()?.settings?.battleSpeed) ? world().settings.battleSpeed : speedPref;
    queue.speed = speedPref;
    queue.instant = instant();
    curtain = 1;
    fadeOut = 0;
    amber = 0;
    try {
      data = resolveBattleData(G);
      let setup = params.setup;
      if (!setup && params.trainer) setup = { kind: 'trainer', trainerId: params.trainer, debugParty: true };
      if (!setup && params.wild) setup = { kind: 'wild', wild: typeof params.wild === 'object' ? params.wild : { speciesId: String(params.wild), level: 5 }, debugParty: true };
      if (!setup) setup = { kind: 'wild', wild: { speciesId: 'tossup', level: 4 }, debugParty: true };
      session = buildBattle(G, setup, data);
    } catch (err) {
      console.warn('battle: could not start', err);
      error = String(err && err.message ? err.message : err);
      mode = 'error';
      return;
    }
    // the Relay (MID-05): round 1's pair is picked too, before anything is sent out (One Heart has only its one)
    const oneHeart = Array.isArray(world()?.run?.challenges) && world().run.challenges.includes('one-heart');
    if (session.relay && session.relay.round === 1 && !session.setup.relay && !oneHeart) {
      for (const s of [0, 1]) { sides[s].present = false; sides[s].hidden = true; }
      postedStrips.clear();
      formShown.clear();
      const base = session.setup;
      relayPick({ round: 0, of: session.relay.of, next: 1, used: [] }, (picks) => ({ ...base, relay: { round: 1, used: [], picks } }))
        .then((next) => enter({ ...params, setup: next }));
      return;
    }
    sides[0].present = false;
    sides[1].present = false;
    sides[0].hidden = true;
    sides[1].hidden = !!session.trainer;
    postedStrips.clear();
    formShown.clear();
    noteShifts(session.battle.intro);
    syncSide(0);
    syncSide(1);
    sides[0].present = false;
    sides[1].present = !session.trainer;
    sides[1].rise = session.trainer ? 0 : 1;
    for (const s of [0, 1]) for (const c of st().sides[s].party) knownHp.set(`${s}:${c.uid}`, c.hp);
    emitBus('battle:start', session.startPayload);
    mode = 'intro';
    introAnims();
  }

  function exit() {
    removeKeys();
  }

  function busy() {
    return mode === 'intro' || mode === 'busy' || (mode === 'end' && !overlay) || !!fadeTask;
  }

  function afterQueue() {
    if (mode !== 'busy' && mode !== 'intro') return;
    const b = session.battle;
    if (b.phase === 'ended') { finish(); return; }
    if (b.phase === 'replace') {
      if (b.pendingReplace.includes(0)) {
        log = { text: 'Choose your next creature.', ms: 1e9, cps: Infinity }; // str
        openList('party', { forced: true });
        return;
      }
      act(null);
      return;
    }
    if (resumeList) { const k = resumeList; resumeList = null; openList(k); return; }
    toRoot();
  }

  // ------------------------------------------------------------------------------------------
  // update
  // ------------------------------------------------------------------------------------------

  /** @param {number} dt */
  function update(dt) {
    elapsed += dt;
    if (mode === 'error' || !session) return;
    queue.instant = instant();
    const sp = queue.speed;
    const sdt = dt * sp;
    // hit-stop freezes the arena (sprites, HP drain); the log keeps typing
    if (freezeMs > 0) freezeMs = Math.max(0, freezeMs - sdt);
    else arenaMs += sdt;
    const adt = freezeMs > 0 ? 0 : sdt;
    log.ms += dt * Math.sqrt(sp);
    if (curtain > 0 && mode !== 'error') curtain = Math.max(0, curtain - sdt / frames(18));
    if (shakeMs > 0) shakeMs = Math.max(0, shakeMs - sdt);
    if (levelFlashMs > 0) levelFlashMs = Math.max(0, levelFlashMs - sdt);
    if (intro.rustle > 0) intro.rustle = Math.max(0, intro.rustle - sdt);
    for (const m of sides) {
      if (m.hpT < 1) { m.hpT = Math.min(1, m.hpT + adt / m.hpMs); m.shownHp = lerp(m.fromHp, m.toHp, m.hpT); }
      if (m.nudgeMs > 0) m.nudgeMs = Math.max(0, m.nudgeMs - adt);
      if (m.lungeMs > 0) m.lungeMs = Math.max(0, m.lungeMs - adt);
      if (m.flashMs > 0) m.flashMs = Math.max(0, m.flashMs - adt);
      if (m.glintMs > 0) m.glintMs = Math.max(0, m.glintMs - adt);
      if (m.latticeMs > 0) m.latticeMs = Math.max(0, m.latticeMs - adt);
      if (m.fainting) { m.faintT = Math.min(1, m.faintT + adt / frames(18)); if (m.faintT >= 1) { m.fainting = false; m.hidden = true; } }
      if (m.entering) { m.enterT = Math.min(1, m.enterT + adt / frames(20)); if (m.enterT >= 1) m.entering = false; }
      if (m.recalling) { m.recallT = Math.min(1, m.recallT + adt / frames(12)); if (m.recallT >= 1) { m.recalling = false; m.hidden = true; } }
      if (m.folding) { m.foldT = Math.min(1, m.foldT + adt / frames(LANTERN_FRAMES.fold)); if (m.foldT >= 1) { m.folding = false; m.hidden = true; } }
      if (m.rise > 0) m.rise = Math.max(0, m.rise - adt / frames(30));
      if (m.present && !m.hidden && m.rise <= 0.2 && m.box < 1) m.box = Math.min(1, m.box + adt / frames(6));
    }
    if (expBar.shown !== expBar.target) {
      const d = adt / frames(30);
      expBar.shown = expBar.shown < expBar.target ? Math.min(expBar.target, expBar.shown + d) : Math.max(expBar.target, expBar.shown - d * 3);
    }
    if (trainerFx.show) trainerFx.slide = Math.min(1, (trainerFx.slide || 0) + adt / frames(18));
    if (lanternFx.show && lanternFx.phase) {
      lanternFx.f += adt / FRAME_MS;
      if (lanternFx.phase === 'meter') {
        const before = Math.floor(lanternFx.meter);
        lanternFx.meter = Math.min(lanternFx.segments, (lanternFx.f / (LANTERN_FRAMES.sweep / 3)));
        const after = Math.floor(lanternFx.meter);
        for (let k = before + 1; k <= after && k <= 3; k++) if (k > 1) emitBus('battle:event', { event: { type: 'capture-shake', side: 0, n: k, segments: k, target: sides[1].name, grade: 1, odds: null, band: '', success: lanternFx.success, text: '' } });
      }
      if (lanternFx.f >= lanternFx.len + 6 && (lanternFx.phase === 'fold' || lanternFx.phase === 'gutter')) {
        if (lanternFx.phase === 'fold' && !reduced()) {
          // the Heartmark lights where the light folded shut
          for (let i = 0; i < 8; i++) fx.push({ kind: 'star', x: L.foeBase.x - 10 + ((i * 7) % 20), y: L.foeBase.y - 34 + ((i * 11) % 16), color: i % 2 ? MAGENTA : PALETTE.w, ms: -i * 40, life: frames(30) });
        }
        lanternFx.show = false;
        lanternFx.phase = null;
      }
    }
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.ms += adt;
      if (f.kind === 'dot') { f.x += f.vx * (adt / FRAME_MS); f.y += f.vy * (adt / FRAME_MS); }
      if (f.ms >= f.life) fx.splice(i, 1);
    }
    if (overlay && overlay.t !== undefined) overlay.t += dt;
    if (overlay && overlay.kind === 'blackout') amber = Math.min(1, amber + dt / frames(40));
    if (fadeTask) {
      fadeOut = Math.min(1, fadeOut + dt / frames(24));
      if (fadeOut >= 1) { const f = fadeTask; fadeTask = null; f.resolve(); }
    }
    queue.update(dt);
    if ((mode === 'busy' || mode === 'intro') && queue.idle() && !overlay) afterQueue();
    if (mode === 'menu') rootFocus.update(dt);
    if (mode === 'moves') moveFocus.update(dt);
    if (mode === 'party' || mode === 'bag' || mode === 'lantern') listFocus.update(dt);
    if (overlay && overlay.focus) overlay.focus.update(dt);
  }

  // ------------------------------------------------------------------------------------------
  // input
  // ------------------------------------------------------------------------------------------

  /** @type {((e: KeyboardEvent) => void)|null} */ let speedKeys = null;
  function bindSpeedKeys() {
    if (speedKeys || typeof window === 'undefined') return;
    speedKeys = (e) => {
      if (overlay && overlay.kind === 'naming') return;
      if (e.code === 'Digit1') setSpeed(1);
      else if (e.code === 'Digit2') setSpeed(2);
      else if (e.code === 'Digit3') setSpeed(4);
    };
    window.addEventListener('keydown', speedKeys);
  }
  function unbindSpeedKeys() {
    if (speedKeys && typeof window !== 'undefined') window.removeEventListener('keydown', speedKeys);
    speedKeys = null;
  }

  const inRect = (p, r) => p && p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

  /** @param {any} input */
  function handleInput(input) {
    if (typedSkip) { typedSkip = false; return; }
    if (mode === 'error') {
      if (input.pressed('cancel') || input.pressed('confirm') || (input.pointer && input.pointer.justDown)) {
        if (G.scenes.size > 1) G.scenes.pop({ result: null });
        else G.replaceWith('title');
      }
      return;
    }
    if (!session) return;
    const ptr = input.pointer;
    if (input.pressed('l')) cycleSpeed();
    if (ptr && ptr.justDown && inRect(ptr, L.speed)) { cycleSpeed(); return; }

    if (overlay && overlay.kind === 'blackout') {
      if (overlay.t > frames(60) && (input.pressed('confirm') || (ptr && ptr.justDown))) { const r = overlay.resolve; overlay = null; r(); }
      return;
    }
    if (overlay && overlay.kind === 'slip' && overlay.resolve) {
      if (input.pressed('confirm') || input.pressed('cancel') || (ptr && ptr.justDown)) { const r = overlay.resolve; overlay = null; mode = 'end'; r(); }
      return;
    }
    if (overlay && (overlay.kind === 'learn' || overlay.kind === 'naming' || overlay.kind === 'relay')) {
      if (!overlay.busy) overlay.focus.handle(input);
      return;
    }
    if (mode === 'intro' || mode === 'busy') {
      if (input.pressed('confirm') || (ptr && ptr.justDown)) {
        if (!queue.confirm()) queue.skip();
      }
      return;
    }
    if (mode === 'modal' && overlay && overlay.kind === 'readcard') {
      if (overlay.ask && (input.pressed('confirm') || (ptr && ptr.justDown && inRect(ptr, L.readCard)))) { overlay = null; act({ type: 'read' }); return; }
      if (input.pressed('cancel') || input.pressed('confirm') || (ptr && ptr.justDown)) { overlay = null; toRoot(); }
      return;
    }
    if (mode === 'menu') {
      if (session.kind === 'wild' && !st().reading && ptr && ptr.justDown && inRect(ptr, L.stance)) { toggleStance(); return; }
      if (input.pressed('select') && session.kind === 'wild' && !st().reading) { toggleStance(); return; }
      rootFocus.handle(input);
      return;
    }
    if (mode === 'moves') { moveFocus.handle(input); return; }
    if (mode === 'party' || mode === 'bag' || mode === 'lantern') {
      if (mode === 'lantern' && (input.pressed('select') || (ptr && ptr.justDown && inRect(ptr, L.stance)))) { resumeList = 'lantern'; toggleStance(); list = null; return; }
      listFocus.handle(input);
    }
  }

  // ------------------------------------------------------------------------------------------
  // drawing
  // ------------------------------------------------------------------------------------------

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    if (mode === 'error' || !session) { drawError(ctx); return; }
    const sx = shakeMs > 0 ? Math.round((Math.floor(elapsed / 33) % 2 ? 1 : -1) * shakePx) : 0;
    ctx.save();
    ctx.translate(sx, 0);
    drawArena(ctx);
    drawSprites(ctx);
    drawFx(ctx);
    ctx.restore();
    drawFoeBox(ctx);
    drawPlayerBox(ctx);
    if (weatherState) drawWeather(ctx);
    if (visibleStrip()) drawShiftStrip(ctx);
    if (lanternFx.show) drawMeter(ctx);
    drawSpeedChip(ctx);
    drawPanelArea(ctx);
    drawOverlays(ctx);
    if (curtain > 0) drawCurtain(ctx);
    if (amber > 0) drawAmber(ctx);
    if (fadeOut > 0) { ctx.save(); ctx.globalAlpha = fadeOut; ctx.fillStyle = COLORS.night.ink; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }

  function drawError(ctx) {
    ctx.fillStyle = COLORS.night.ink;
    ctx.fillRect(0, 0, W, H);
    drawPanel(ctx, { x: 90, y: 80, w: 300, h: 100 }, 'notice', { title: 'Battle' }); // str
    drawText(ctx, 'This battle could not start.', 106, 98, { color: INK }); // str
    drawText(ctx, error || '', 106, 114, { color: SOFT, maxWidth: 268, font: 'small' });
    drawText(ctx, 'Back: X / tap', 106, 160, { color: SOFT }); // str
  }

  /** @type {Map<string, {scale: number, dx: number, dy: number}>} */
  const fitCache = new Map();
  /** Draw scale and offset of the foe's front sprite (battleAnims.spriteFit over its art). */
  function foeFit(speciesId, types) {
    const k = `${speciesId}|${types?.[0] ?? ''}`;
    let f = fitCache.get(k);
    if (!f) {
      let art = null;
      try { art = creatureArt(speciesId, { types }); } catch { art = null; }
      f = spriteFit(art?.rows, 2, art?.w ?? 32);
      fitCache.set(k, f);
    }
    return f;
  }

  /** Where this battle happens: the setup's backdrop, the Reading, or the map the player stands on. */
  function arenaPick() {
    const hr = worldHour(world());
    return backdropFor({
      theme: session?.setup?.backdrop ?? null,
      source: session?.setup?.source ?? session?.source ?? null,
      mapId: world()?.player?.mapId ?? null,
      hour: Number.isFinite(hr) ? hr : 12,
    });
  }

  function drawArena(ctx) {
    const bd = backdrop(arenaPick());
    if (bd) ctx.drawImage(bd, 0, 0);
    else { ctx.fillStyle = COLORS.night.blue; ctx.fillRect(0, 0, W, L.arenaH); }
  }

  /**
   * Draws a side's creature with its offsets, flash, faint drop, entrance and fold.
   * @param {CanvasRenderingContext2D} ctx @param {number} side
   */
  function drawSide(ctx, side) {
    const m = sides[side];
    if (!m.present || m.hidden || !m.speciesId) return;
    const base = side === 1 ? L.foeSprite : L.playerSprite;
    const ground = side === 1 ? L.foeBase.y + 1 : L.playerBase.y + 1;
    // a small front form draws one step larger, on the same centre and foot line (FH-14)
    const fit = side === 1 ? foeFit(m.speciesId, m.types) : { scale: 2, dx: 0, dy: 0 };
    const sc = fit.scale;
    const box = 32 * sc;
    let x = base.x + fit.dx;
    let y = base.y + fit.dy;
    // nudge (2 px away from the attacker) and lunge (toward the foe)
    if (m.nudgeMs > 0) x += Math.round(m.nudgePx * (m.nudgeMs / m.nudgeDur));
    if (m.lungeMs > 0) {
      const k = 1 - m.lungeMs / frames(14);
      const dir = side === 0 ? 1 : -1;
      x += Math.round(dir * (k < 0.25 ? -2 : k < 0.6 ? 6 : 6 * (1 - (k - 0.6) / 0.4)));
    }
    if (m.rise > 0) y += Math.round(m.rise * 28);
    const frame = Math.floor(arenaMs / 520) % 2 === 1 ? 1 : 0;
    const view0 = side === 0 ? 'back' : 'front';
    // shadow
    ctx.fillStyle = 'rgba(20, 27, 51, 0.35)';
    ellipseFill(ctx, x + box / 2, ground - 1, Math.round(22 * sc / 2), 4);
    ctx.save();
    // clip the faint drop and the rise at the stand's lip
    ctx.beginPath();
    ctx.rect(0, 0, W, ground + 1);
    ctx.clip();
    let alpha = 1;
    if (m.faintT > 0) { y += Math.round(m.faintT * 40); alpha = 1 - m.faintT * 0.6; }
    if (m.recallT > 0) alpha = Math.max(0, 1 - m.recallT);
    if (m.entering) alpha = Math.min(1, m.enterT * 1.4);
    const flashing = m.flashMs > 0 && Math.floor(m.flashMs / FRAME_MS) % 2 === 0;
    if (m.foldT > 0) {
      // fold into light: squash vertically into a bright strip
      const k = m.foldT;
      const sprite = creatureSprite(m.speciesId, { view: view0, scale: sc, types: m.types, silhouette: k > 0.3 ? '#FFF3D6' : null });
      const hgt = Math.max(1, Math.round(box * (1 - k)));
      ctx.globalAlpha = 1 - k * 0.3;
      ctx.drawImage(sprite.canvas, 0, 0, sprite.w, sprite.h, x, y + (box - hgt), box, hgt);
      ctx.globalAlpha = 1;
    } else if (flashing) {
      const sprite = creatureSprite(m.speciesId, { view: view0, scale: sc, types: m.types, silhouette: '#F4F4F4' });
      drawSprite(ctx, sprite, x, y, alpha < 1 ? { alpha } : undefined);
    } else {
      const glint = m.glintMs > 0 ? 1 - m.glintMs / frames(30) + 0.01 : 0;
      drawCreature(ctx, m.speciesId, x, y, { view: view0, frame: side === 1 ? frame : 0, scale: sc, types: m.types, mark: m.mark, star: m.starTouched, lit: m.lit, glint, alpha: alpha < 1 ? alpha : undefined });
      // Ward lattice: a 48 f sweep every 4 s, a 6 f flare on a blocked hit; stilled under reduced motion
      if (side === 1 && st().sides[1].wardBadge) drawLattice(ctx, m, x, y, view0, sc);
      else if (m.latticeMs > 0) drawLattice(ctx, m, x, y, view0, sc);
    }
    ctx.restore();
  }

  function ellipseFill(ctx, cx, cy, rx, ry) {
    for (let yy = -ry; yy <= ry; yy++) {
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))));
      ctx.fillRect(cx - half, cy + yy, half * 2, 1);
    }
  }

  /** Ward lattice over the opaque pixels of the sprite. */
  function drawLattice(ctx, m, x, y, view0, sc = 2) {
    const art = creatureArt(m.speciesId, { types: m.types });
    const rows = view0 === 'back' && art.back ? art.back : art.rows;
    const flare = m.latticeMs > frames(42);
    const cycle = arenaMs % 4000;
    let band = null;
    if (reduced()) band = 'static';
    else if (flare) band = 'all';
    else if (cycle < frames(48)) band = cycle / frames(48);
    if (band === null) return;
    ctx.fillStyle = flare ? PALETTE.w : PALETTE.i;
    for (let py = 0; py < rows.length; py++) {
      const r = rows[py];
      for (let px = 0; px < r.length; px++) {
        if (r[px] === '.') continue;
        const diag = (px + py) % 6 === 0 || (px - py + 64) % 6 === 0;
        if (!diag) continue;
        if (typeof band === 'number') {
          const pos = (px + py) / 62;
          if (Math.abs(pos - band) > 0.12) continue;
        } else if (band === 'static' && (px + py) % 12 !== 0) continue;
        ctx.fillRect(x + px * sc, y + py * sc, sc, 1);
      }
    }
  }

  /** Grass rustle or water rings in front of a wild creature rising into view. */
  function drawEntrance(ctx) {
    // wild entrance: grass rustle or water rings
    if (intro.rustle > 0) {
      const k = Math.floor((intro.rustle / FRAME_MS) / 4) % 3;
      const { x, y } = L.foeBase;
      if (intro.place === 'water') {
        ctx.fillStyle = PALETTE.w;
        const r = 10 + (24 - intro.rustle / FRAME_MS) * 1.4;
        for (let a = 0; a < 24; a++) { const ang = (a / 24) * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(ang) * r), Math.round(y - 2 + Math.sin(ang) * r * 0.25), 1, 1); }
      } else {
        ctx.fillStyle = rustleColour(arenaPick());
        for (let i = -4; i <= 4; i++) {
          const h = 6 + ((i + k) % 3 === 0 ? 3 : 0);
          ctx.fillRect(x + i * 9 + (k - 1), y - h, 2, h);
          ctx.fillRect(x + i * 9 + 3 - (k - 1), y - h + 2, 2, h - 2);
        }
      }
    }
  }

  function drawSprites(ctx) {
    drawSide(ctx, 1);
    drawEntrance(ctx);
    if (trainerFx.show) drawTrainer(ctx);
    drawSide(ctx, 0);
    drawLantern(ctx);
  }

  function drawTrainer(ctx) {
    const k = trainerFx.out ? 1 - Math.min(1, (trainerFx.slide || 0)) : (trainerFx.slide || 0);
    const x = Math.round(lerp(W + 4, 316, k));
    const y = 28;
    drawPanel(ctx, { x, y, w: 64, h: 70 }, 'card');
    if (trainerFx.portrait) drawSprite(ctx, trainerFx.portrait, x + 8, y + 6);
    else drawSprite(ctx, getPortraitPlaceholder(), x + 16, y + 10);
    drawText(ctx, trainerFx.name, x + 32, y + 58, { color: INK, align: 'center', font: 'small' });
    // the roster pips beside the bust
    const party = st().sides[1].party;
    party.forEach((c, i) => {
      const px = x - 10;
      const py = y + 8 + i * 9;
      ctx.fillStyle = c.fainted ? FAINT : PALETTE.r;
      ctx.fillRect(px, py, 6, 6);
      ctx.fillStyle = CREAM;
      ctx.fillRect(px + 1, py + 1, 1, 1);
    });
  }

  /** The Lantern unfold: lift 6 f, square → strip → outline 12 f, fill 8 f; meter sweep; fold; gutter. */
  function drawLantern(ctx) {
    if (!lanternFx.show || !lanternFx.phase) return;
    const f = lanternFx.f;
    const foe = { x: L.foeBase.x, y: L.foeBase.y - 30 };
    const steps = ['#F9C46B', '#FFE4A8', '#FFF3D6'];
    if (lanternFx.phase === 'lift') {
      const k = Math.min(2, Math.floor(f / 2));
      const lx = L.playerSprite.x + 64;
      const ly = L.playerSprite.y + 6 - Math.round(Math.min(1, f / 6) * 8);
      ctx.fillStyle = steps[k];
      ctx.fillRect(lx - 2, ly - 2, 5, 5);
      ctx.fillStyle = PALETTE.brass;
      ctx.fillRect(lx - 1, ly + 3, 3, 2);
      return;
    }
    const outlineRect = { x: foe.x - 30, y: foe.y - 30, w: 60, h: 62 };
    if (lanternFx.phase === 'unfold') {
      const fu = Math.min(11, Math.floor(f));
      const shape = unfoldShape(fu);
      ctx.fillStyle = '#FFF3D6';
      if (shape === 'square') {
        const drop = Math.round((fu / 4) * 20);
        ctx.fillRect(foe.x - 6, foe.y - 30 + drop, 12, 12);
      } else if (shape === 'strip') {
        const w = 12 + Math.round(((fu - 4) / 4) * 48);
        ctx.fillRect(foe.x - Math.round(w / 2), foe.y - 2, w, 4);
      } else {
        strokeRect(ctx, outlineRect, '#FFF3D6');
        if (f > LANTERN_FRAMES.unfold) {
          // colour fills in two rings from the mark
          const ring = f - LANTERN_FRAMES.unfold < LANTERN_FRAMES.fill / 2 ? 1 : 2;
          strokeRect(ctx, { x: outlineRect.x + 2, y: outlineRect.y + 2, w: outlineRect.w - 4, h: outlineRect.h - 4 }, AMBER);
          if (ring > 1) strokeRect(ctx, { x: outlineRect.x + 4, y: outlineRect.y + 4, w: outlineRect.w - 8, h: outlineRect.h - 8 }, AMBER);
        }
      }
      return;
    }
    if (lanternFx.phase === 'meter' || lanternFx.phase === 'fold') {
      strokeRect(ctx, outlineRect, '#FFF3D6');
      strokeRect(ctx, { x: outlineRect.x + 2, y: outlineRect.y + 2, w: outlineRect.w - 4, h: outlineRect.h - 4 }, AMBER);
      if (lanternFx.phase === 'fold' && f < LANTERN_FRAMES.fold) {
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.5 * (f / LANTERN_FRAMES.fold);
        ctx.fillStyle = '#FFF3D6';
        ctx.fillRect(outlineRect.x + 4, outlineRect.y + 4, outlineRect.w - 8, outlineRect.h - 8);
        ctx.restore();
      }
      return;
    }
    if (lanternFx.phase === 'gutter') {
      const step = f < LANTERN_FRAMES.gutter ? 0 : 1;
      if (f >= LANTERN_FRAMES.gutter * 2) return;
      ctx.fillStyle = step === 0 ? AMBER : PALETTE.brassDark;
      for (let i = 0; i < outlineRect.w; i += step === 0 ? 2 : 4) { ctx.fillRect(outlineRect.x + i, outlineRect.y, 1, 1); ctx.fillRect(outlineRect.x + i, outlineRect.y + outlineRect.h - 1, 1, 1); }
      for (let j = 0; j < outlineRect.h; j += step === 0 ? 2 : 4) { ctx.fillRect(outlineRect.x, outlineRect.y + j, 1, 1); ctx.fillRect(outlineRect.x + outlineRect.w - 1, outlineRect.y + j, 1, 1); }
    }
  }

  function strokeRect(ctx, r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, 1);
    ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    ctx.fillRect(r.x, r.y, 1, r.h);
    ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
  }

  function drawFx(ctx) {
    for (const f of fx) {
      const k = Math.max(0, f.ms) / f.life;
      if (f.ms < 0) continue;
      const base = f.side === 1 ? { x: L.foeBase.x, y: L.foeBase.y - 66 } : { x: L.playerBase.x + 24, y: L.playerBase.y - 70 };
      if (f.kind === 'word') {
        let dy = 0;
        let dx = 0;
        if (f.tier === 'strong') dx = Math.floor(f.ms / 33) % 2 ? 2 : -2;
        if (f.tier === 'weak') dy = Math.round(k * 4);
        if (k > 0.4 && f.tier === 'strong') dx = 0;
        const color = f.tier === 'strong' ? PALETTE.o : f.tier === 'blocked' ? PALETTE.v : PALETTE.s;
        drawText(ctx, f.text, base.x + dx, base.y - 6 + dy, { color: CREAM, align: 'center', outline: { color: COLORS.night.ink, width: 1 }, alpha: k > 0.8 ? (1 - k) * 5 : 1 });
        ctx.fillStyle = color;
        const w = measureText(f.text).w;
        ctx.fillRect(Math.round(base.x - w / 2 + dx), base.y + 3 + dy, w, 1);
      } else if (f.kind === 'tag') {
        drawText(ctx, f.text, base.x, base.y + 8, { color: CREAM, align: 'center', outline: { color: COLORS.night.ink, width: 1 } });
      } else if (f.kind === 'dot') {
        if (k < 0.85 || Math.floor(f.ms / 50) % 2 === 0) { ctx.fillStyle = f.color; ctx.fillRect(Math.round(f.x), Math.round(f.y), 2, 2); }
      } else if (f.kind === 'icon') {
        if (f.icon) drawIcon(ctx, f.icon, base.x - 4, base.y + 4 - Math.round(k * 8));
      } else if (f.kind === 'star') {
        const s = k < 0.5 ? 1 : 2;
        ctx.fillStyle = f.color;
        const y = f.y - Math.round(k * 10);
        ctx.fillRect(f.x, y - s, 1, s * 2 + 1);
        ctx.fillRect(f.x - s, y, s * 2 + 1, 1);
      } else if (f.kind === 'arrows') {
        const up = f.dir > 0;
        const glyph = up ? '▲' : '▼';
        const color = up ? PALETTE.l : PALETTE.s;
        for (let i = 0; i < 3; i++) {
          const off = ((k * 30 + i * 10) % 30);
          const y = up ? base.y + 40 - off : base.y + 10 + off;
          drawText(ctx, glyph, base.x - 14 + i * 12, y, { color, outline: { color: COLORS.night.ink, width: 1 } });
        }
      } else if (f.kind === 'banner') {
        const bx = f.side === 1 ? 200 : 290;
        const by = f.side === 1 ? 12 : 126;
        const w = measureText(f.text).w + 14;
        drawPanel(ctx, { x: bx, y: by, w, h: 15 }, 'notice', { torn: 'none' });
        drawText(ctx, f.text, bx + 7, by + 4, { color: INK });
      } else if (f.kind === 'coin') {
        drawText(ctx, `${f.text}◉`, L.playerBox.x + 120, L.playerBox.y - 12 - Math.round(k * 8), { color: AMBER, outline: { color: COLORS.night.ink, width: 1 } });
      }
    }
  }

  function drawStatus(ctx, status, x, y) {
    if (!status) return 0;
    const word = { burn: 'BRN', poison: 'PSN', chill: 'CHL', numb: 'NMB' }[status] || status.toUpperCase().slice(0, 3);
    const r = drawBadge(ctx, word, x, y, { style: 'status', icon: status, small: true });
    return r.w;
  }

  function drawFoeBox(ctx) {
    const m = sides[1];
    if (!m.present) return;
    if (m.box <= 0) return;
    const b = { ...L.foeBox, x: L.foeBox.x - Math.round((1 - m.box) * 12) };
    drawPanel(ctx, b, 'card', m.box < 1 ? { alpha: m.box } : undefined);
    if (m.box < 0.5) return;
    const s = st().sides[1];
    drawText(ctx, m.name, b.x + 6, b.y + 5, { color: INK });
    drawText(ctx, `Lv${m.level}`, b.x + b.w - 6, b.y + 5, { color: INK, align: 'right' });
    let cx = b.x + 6;
    for (const ty of m.types) cx += drawTypeChip(ctx, chipId(ty), cx, b.y + 14) + 2;
    drawStatus(ctx, m.status, cx + 2, b.y + 15);
    drawText(ctx, 'HP', b.x + 6, b.y + 28, { color: SOFT, font: 'small' });
    drawBar(ctx, { x: b.x + 18, y: b.y + 28, w: 120, h: 5, value: Math.round(m.shownHp), max: m.maxHp, kind: 'hp' });
    // tags: Ward ?, EVA, Mends
    let tx = b.x + 6;
    const ty = b.y + 35;
    if (s.wardBadge) {
      const known = !!(readInfo && readInfo.ability && readInfo.ability.ward && readInfo.name === m.name);
      const r = drawWardBadge(ctx, tx, ty - 1, { known, t: arenaMs, reducedMotion: reduced(), small: true });
      tx += r.w + 3;
    }
    if (s.wardSuppressed > 0) {
      const r = drawBadge(ctx, t('battle.tag.wardDown', { n: Math.max(0, s.wardSuppressed - 1) }), tx, ty - 1, { style: 'lock', small: true });
      tx += r.w + 3;
    }
    const eva = s.stages.eva || 0;
    if (eva > 0) {
      const r = drawBadge(ctx, t('battle.tag.eva', { n: eva }), tx, ty - 1, { style: 'eva', small: true });
      tx += r.w + 3;
    }
    const prismKnown = !!(readInfo && readInfo.mends !== undefined && readInfo.name === m.name);
    const mends = s.party[s.active].mends;
    if (prismKnown) drawPips(ctx, { x: b.x + 142, y: ty + 1, n: mends, max: 3, label: t('battle.tag.mends'), size: 3, gap: 1 });
    else drawText(ctx, t('battle.tag.mendsUnknown'), b.x + b.w - 6, ty + 1, { color: FAINT, font: 'small', align: 'right' });
  }

  function drawPlayerBox(ctx) {
    const m = sides[0];
    if (!m.present) return;
    if (m.box <= 0) return;
    const b = { ...L.playerBox, x: L.playerBox.x + Math.round((1 - m.box) * 12) };
    drawPanel(ctx, b, 'card', m.box < 1 ? { alpha: m.box } : undefined);
    if (m.box < 0.5) return;
    if (levelFlashMs > frames(20)) { ctx.fillStyle = CREAM; ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2); }
    drawIcon(ctx, 'heartmark', b.x + 5, b.y + 4, { accent: MAGENTA });
    drawText(ctx, m.name, b.x + 15, b.y + 5, { color: INK });
    const lvBounce = levelFlashMs > 0 ? -1 : 0;
    drawText(ctx, `Lv${m.level}`, b.x + b.w - 6, b.y + 5 + lvBounce, { color: INK, align: 'right' });
    drawStatus(ctx, m.status, b.x + b.w - 70, b.y + 4);
    drawText(ctx, 'HP', b.x + 6, b.y + 17, { color: SOFT, font: 'small' });
    drawBar(ctx, { x: b.x + 18, y: b.y + 17, w: 112, h: 6, value: Math.round(m.shownHp), max: m.maxHp, kind: 'hp' });
    drawText(ctx, `${Math.round(m.shownHp)}/${m.maxHp}`, b.x + b.w - 6, b.y + 17, { color: INK, align: 'right' });
    drawText(ctx, 'EXP', b.x + 6, b.y + 28, { color: SOFT, font: 'small' });
    drawBar(ctx, { x: b.x + 22, y: b.y + 28, w: 108, h: 4, value: Math.round(expBar.shown * 1000), max: 1000, kind: 'exp' });
    // party pips
    const party = st().sides[0].party;
    party.forEach((c, i) => {
      const px = b.x + 6 + i * 9;
      const py = b.y + 38;
      ctx.fillStyle = c.fainted ? FAINT : PALETTE.r;
      ctx.fillRect(px, py, 6, 6);
      if (!c.fainted) { ctx.fillStyle = CREAM; ctx.fillRect(px + 1, py + 1, 1, 1); }
      else { ctx.fillStyle = INK; ctx.fillRect(px + 1, py + 2, 4, 1); }
    });
    if (st().captureStance) drawBadge(ctx, t('capture.stanceTag'), b.x + b.w - 52, b.y + 36, { style: 'safe', small: true });
  }

  function drawMeter(ctx) {
    const r = L.meter;
    drawPanel(ctx, { x: r.x, y: r.y - 2, w: r.w, h: r.h + 4 }, 'dark');
    const segW = Math.floor((r.w - 8) / 3);
    const fill = lanternFx.phase === 'meter' || lanternFx.phase === 'fold' || lanternFx.phase === 'gutter' ? lanternFx.meter : 0;
    for (let i = 0; i < 3; i++) {
      const x = r.x + 2 + i * (segW + 2);
      ctx.fillStyle = COLORS.dark.inner;
      ctx.fillRect(x, r.y, segW, r.h);
      const k = Math.max(0, Math.min(1, fill - i));
      if (k > 0) {
        ctx.fillStyle = lanternFx.phase === 'gutter' && i >= Math.floor(fill) ? PALETTE.brassDark : AMBER;
        ctx.fillRect(x, r.y, Math.round(segW * k), r.h);
        ctx.fillStyle = CREAM;
        ctx.fillRect(x, r.y, Math.round(segW * k), 1);
      }
    }
  }

  function drawCommand(ctx, rect, id, focused, enabled) {
    const label = t(`battle.cmd.${id}`);
    const lift = focused && enabled ? 1 : 0;
    const x = rect.x;
    const y = rect.y - lift;
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(x + 1, rect.y + 1, rect.w, rect.h);
    ctx.fillStyle = !enabled ? COLORS.paper.shade : focused ? COLORS.paper.light : COLORS.paper.fill;
    ctx.fillRect(x, y, rect.w, rect.h);
    strokeRect(ctx, { x, y, w: rect.w, h: rect.h }, focused ? INK : COLORS.paper.rule);
    if (enabled) drawSeal(ctx, x + 4, y + 9, { emblem: 'plus' });
    else drawIcon(ctx, 'strike', x + 5, y + 10, { ink: FAINT });
    drawIcon(ctx, COMMAND_ICON[id], x + 18, y + 10, { ink: enabled ? INK : FAINT, accent: enabled ? PALETTE.waxRed : FAINT });
    drawText(ctx, label, x + 30, y + 11, { color: enabled ? INK : FAINT });
  }

  function drawPanelArea(ctx) {
    drawPanel(ctx, L.panel, 'ledger', { shadow: false });
    if (mode === 'moves') { drawMoves(ctx); return; }
    if (mode === 'lantern') { drawLanternPanel(ctx); return; }
    const menuUp = mode === 'menu' || mode === 'party' || mode === 'bag' || (mode === 'modal' && overlay && overlay.kind === 'readcard' && !overlay.auto);
    if (!menuUp) {
      // the battle log: a typewriter box across the whole panel while the turn plays
      const lines = measureText(log.text, { maxWidth: L.log.w }).lines;
      const y = lines > 1 || !prevLog ? L.log.y : L.log.y + 12;
      if (lines <= 1 && prevLog) drawText(ctx, prevLog, L.log.x, L.log.y, { color: FAINT, maxWidth: L.log.w });
      const typed = drawTextTyped(ctx, log.text, L.log.x, y, typedChars(log.ms, log.cps, log.text.length), { color: INK, maxWidth: L.log.w });
      if (typed.done && (queue.gated() || (overlay && overlay.resolve))) {
        if (Math.floor(elapsed / 500) % 2 === 0) drawText(ctx, TYPE.more, W - 16, 252, { color: PALETTE.waxRed });
      }
      return;
    }
    drawText(ctx, log.text, L.msg.x, L.msg.y, { color: INK, maxWidth: session.kind === 'wild' ? L.msg.w : W - 28 });
    if (session.kind === 'wild') drawStanceSeal(ctx);
    const items = rootFocus.items;
    COMMANDS.forEach((id, i) => {
      const item = items ? items[i] : null;
      const enabled = item ? item.enabled !== false : true;
      drawCommand(ctx, cmdRect(i), id, mode === 'menu' && rootFocus.index === i, enabled);
    });
    if (mode === 'menu') rootFocus.drawCursor(ctx, { style: 'paper', ring: false });
  }

  function drawStanceSeal(ctx) {
    const lg = legal();
    if (!lg.captureStance?.available) return;
    const on = !!(lg.captureStance && lg.captureStance.on);
    const r = L.stance;
    ctx.fillStyle = on ? COLORS.paper.light : COLORS.paper.shade;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    strokeRect(ctx, r, on ? PALETTE.g : COLORS.paper.rule);
    drawIcon(ctx, on ? 'check' : 'blank', r.x + 3, r.y + 3, { ink: on ? PALETTE.t : FAINT });
    drawText(ctx, t('battle.cmd.stance'), r.x + 12, r.y + 4, { color: on ? INK : SOFT, font: 'small' });
  }

  function drawMoves(ctx) {
    const lg = legal();
    const items = moveFocus.items;
    if (items.length === 1 && items[0].id === 'scrap') {
      const r = items[0].rect;
      ctx.fillStyle = COLORS.paper.light;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      strokeRect(ctx, r, INK);
      drawText(ctx, t('battle.scrap'), r.x + 12, r.y + 5, { color: INK });
      drawText(ctx, '50 power, sure hit, 1/8 recoil', r.x + 12, r.y + 17, { color: SOFT, font: 'small' }); // str
      drawText(ctx, t('battle.scrapNote'), L.moves.x + 4, L.moves.y + L.moves.h + 8, { color: SOFT, maxWidth: 456 });
      moveFocus.drawCursor(ctx, { style: 'paper', ring: false });
      return;
    }
    for (let i = lg.moves.length; i < 4; i++) {
      const r = moveRect(i);
      ctx.fillStyle = COLORS.paper.shade;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      for (let x = r.x; x < r.x + r.w; x += 2) { ctx.fillStyle = COLORS.paper.rule; ctx.fillRect(x, r.y, 1, 1); ctx.fillRect(x, r.y + r.h - 1, 1, 1); }
      drawText(ctx, '—', r.x + r.w / 2, r.y + 11, { color: FAINT, align: 'center' });
    }
    lg.moves.forEach((mv, i) => {
      const r = moveRect(i);
      const focused = moveFocus.index === i;
      const empty = mv.pp <= 0;
      ctx.fillStyle = empty ? COLORS.paper.shade : focused ? COLORS.paper.light : COLORS.paper.fill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      strokeRect(ctx, r, focused ? INK : COLORS.paper.rule);
      drawText(ctx, mv.name, r.x + 6, r.y + 4, { color: empty ? FAINT : INK });
      if (mv.heartmark) drawIcon(ctx, 'heartmark', r.x + 8 + measureText(mv.name).w, r.y + 3, { accent: MAGENTA });
      if (mv.type) drawTypeChip(ctx, chipId(mv.type), r.x + r.w - 46, r.y + 2);
      else drawText(ctx, '—', r.x + r.w - 30, r.y + 4, { color: SOFT }); // typeless
      const ratio = mv.maxPp > 0 ? mv.pp / mv.maxPp : 0;
      const ppColor = empty ? BERRY : ratio <= 0.25 ? CORAL : SOFT;
      if (empty) drawBadge(ctx, STRINGS.empty, r.x + 5, r.y + 16, { style: 'empty', small: true });
      else drawText(ctx, t('battle.pp', { pp: mv.pp, max: mv.maxPp }), r.x + 6, r.y + 19, { color: ppColor, font: 'small' });
      if (mv.word) {
        const tier = mv.word === 'Blocked by Ward' || mv.word === 'No effect' ? 'blocked' : effTier(mv.mult);
        const word = mv.word === 'Blocked by Ward' ? effWord('blocked', { ward: true }) : mv.word === 'No effect' ? effWord('blocked') : effWord(tier);
        const text = `${EFF_GLYPH[tier]} ${word}`;
        const color = tier === 'strong' ? INK : tier === 'blocked' ? BERRY : SOFT;
        drawText(ctx, text, r.x + r.w - 6, r.y + 17, { color, align: 'right' });
      } else {
        drawText(ctx, 'Status', r.x + r.w - 6, r.y + 17, { color: FAINT, align: 'right' }); // str
      }
    });
    moveFocus.drawCursor(ctx, { style: 'paper', ring: false });
  }

  function drawLanternPanel(ctx) {
    const menu = captureMenu(session);
    drawText(ctx, t('capture.heading'), 14, 204, { color: INK });
    list.rows.forEach((row, i) => {
      const r = menu.rows[i] || row.data;
      const rect = row.rect;
      const focused = listFocus.index === i;
      if (focused) { ctx.fillStyle = COLORS.focus.bandOnPaper; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
      const color = r.selectable ? INK : FAINT;
      drawText(ctx, r.sure ? r.name : t('capture.wick', { wick: r.name, mult: r.mult }), rect.x + 4, rect.y + 2, { color });
      drawText(ctx, `×${r.stock}`, rect.x + rect.w - 4, rect.y + 2, { color, align: 'right' });
    });
    listFocus.drawCursor(ctx, { style: 'paper', ring: false });
    const cur = menu.rows[listFocus.index];
    if (cur) {
      // the odds, as a big number and a bar, BEFORE anything is spent
      const big = cur.display === 'band' ? t(`capture.band.${String(cur.band).toLowerCase()}`) : t('capture.odds', { n: cur.pct });
      drawText(ctx, big, 232, 205, { color: INK, scale: 2 });
      if (menu.stance) drawBadge(ctx, t('capture.stanceTag'), 232 + measureText(big, { scale: 2 }).w + 8, 207, { style: 'safe' });
      drawBar(ctx, { x: 232, y: 224, w: 160, h: 6, value: cur.pct, max: 100, kind: 'glow' });
      const nextTxt = cur.sure ? t('capture.sure') : cur.nextShown != null
        ? (cur.display === 'band' ? `Next raise: ${t(`capture.band.${String(cur.nextShown).toLowerCase()}`)}` : t('capture.nextOdds', { n: cur.nextShown })) : ''; // str
      drawText(ctx, nextTxt, 232, 235, { color: SOFT });
      if (menu.fails > 0 && !cur.sure) drawText(ctx, `+${Math.min(15, menu.fails * 3)}% from missed raises`, 232, 247, { color: SOFT, font: 'small' }); // str
    }
    drawStanceSeal(ctx);
    drawText(ctx, 'Z: raise   X: back', W - 8, 258, { color: FAINT, font: 'small', align: 'right' }); // str
  }

  /** The posted weather: name, turns left and the strip of what comes next (Weather Spire). */
  function drawWeather(ctx) {
    const w = weatherState;
    const label = w.turnsLeft != null ? `${w.name}, ${w.turnsLeft} ${w.turnsLeft === 1 ? 'turn' : 'turns'}` : w.name; // str
    const tw = measureText(label).w;
    const x = 200;
    const y = 8;
    drawPanel(ctx, { x, y, w: tw + 16, h: 16 }, 'dark');
    drawText(ctx, label, x + 8, y + 5, { color: COLORS.dark.text });
    let px = x;
    for (const p of w.posted.slice(0, 3)) {
      const txt = `T${p.turn}: ${p.name || '—'}`;
      const pw = measureText(txt, { font: 'small' }).w + 8;
      drawPanel(ctx, { x: px, y: y + 18, w: pw, h: 11 }, 'paper', { shadow: false });
      drawText(ctx, txt, px + 4, y + 21, { color: SOFT, font: 'small' });
      px += pw + 2;
    }
  }

  /** The strip of the creature on the field, if it posted one that has not landed (null while it faints, is recalled or is not out). */
  function visibleStrip() {
    for (const st of postedStrips.values()) {
      const m = sides[st.side];
      if (m && m.uid === st.uid && m.present && !m.hidden && !m.fainting && !m.recalling) return st;
    }
    return null;
  }

  /** The posted boss-Shift strip (GDD-04 §1.4): every card with its odds, under the foe's box, until it lands. */
  function drawShiftStrip(ctx) {
    const sh = /** @type {NonNullable<ReturnType<typeof visibleStrip>>} */ (visibleStrip());
    const x = L.foeBox.x;
    const y = L.foeBox.y + L.foeBox.h + 4;
    const when = sh.turnsLeft <= 0 ? 'Shifts now' : sh.turnsLeft === 1 ? 'Shifts at the end of next turn' : `Shifts in ${sh.turnsLeft} turns`; // str
    const title = `Forecast: ${when}`; // str
    drawPanel(ctx, { x, y, w: Math.max(120, measureText(title, { font: 'small' }).w + 12), h: 12 }, 'dark');
    drawText(ctx, title, x + 6, y + 3, { color: COLORS.dark.text, font: 'small' });
    let px = x;
    let py = y + 14;
    for (const k of sh.cards) {
      const txt = `${k.dir[0].toUpperCase()}${k.dir.slice(1)}: ${k.name} ${k.odds}%`;
      const pw = measureText(txt, { font: 'small' }).w + 8;
      if (px + pw > x + 190 && px > x) { px = x; py += 13; }
      drawPanel(ctx, { x: px, y: py, w: pw, h: 11 }, 'paper', { shadow: false });
      drawText(ctx, txt, px + 4, py + 3, { color: k.dir === 'down' ? BERRY : INK, font: 'small' });
      px += pw + 2;
    }
  }

  function drawSpeedChip(ctx) {
    const r = L.speed;
    ctx.fillStyle = COLORS.night.ink;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    strokeRect(ctx, r, PALETTE.v);
    drawText(ctx, t('battle.speed', { n: queue.speed }), r.x + r.w / 2, r.y + 3, { color: CREAM, font: 'small', align: 'center' });
  }

  function drawOverlays(ctx) {
    if (mode === 'party' && list) drawPartyList(ctx);
    if (mode === 'bag' && list) drawBagList(ctx);
    if (!overlay) return;
    if (overlay.kind === 'readcard') drawReadCard(ctx);
    else if (overlay.kind === 'readout') drawReadout(ctx, overlay.ev);
    else if (overlay.kind === 'learn') drawLearn(ctx);
    else if (overlay.kind === 'naming') drawNaming(ctx);
    else if (overlay.kind === 'slip') drawSlip(ctx);
    else if (overlay.kind === 'relay') drawRelay(ctx);
  }

  function drawPartyList(ctx) {
    drawDim(ctx, W, L.arenaH);
    drawPanel(ctx, { x: 8, y: 8, w: 464, h: 184 }, 'paper', { title: list.forced ? 'Choose your next creature' : t('battle.cmd.switch') }); // str
    const party = st().sides[0].party;
    list.rows.forEach((row, i) => {
      const c = party[row.index];
      const r = row.rect;
      const focused = listFocus.index === i;
      ctx.fillStyle = !row.enabled ? COLORS.paper.shade : focused ? COLORS.paper.light : COLORS.paper.fill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      strokeRect(ctx, r, focused ? INK : COLORS.paper.rule);
      const real = session.battle.sides[0].party[row.index];
      drawCreature(ctx, c.speciesId, r.x + 4, r.y + 8, { scale: 1, types: c.types, mark: real.mark, star: real.starTouched, lit: true, alpha: c.fainted ? 0.5 : undefined });
      drawText(ctx, c.name, r.x + 40, r.y + 6, { color: row.enabled ? INK : FAINT });
      drawText(ctx, `Lv${c.level}`, r.x + r.w - 6, r.y + 6, { color: INK, align: 'right' });
      drawBar(ctx, { x: r.x + 40, y: r.y + 20, w: 100, h: 5, value: c.hp, max: c.maxHp, kind: 'hp', showNumber: true });
      const tag = c.fainted ? 'Fainted' : row.index === st().sides[0].active ? 'Out now' : ''; // str
      if (tag) drawText(ctx, tag, r.x + 40, r.y + 32, { color: c.fainted ? BERRY : SOFT, font: 'small' });
      drawStatus(ctx, c.status, r.x + r.w - 40, r.y + 30);
    });
    listFocus.drawCursor(ctx, { style: 'paper', ring: false });
  }

  function drawBagList(ctx) {
    const h = Math.max(40, list.rows.length * 18 + 22);
    drawPanel(ctx, { x: 240, y: 26, w: 232, h }, 'paper', { title: t('battle.cmd.bag') });
    list.rows.forEach((row, i) => {
      const r = row.rect;
      const focused = listFocus.index === i;
      if (focused) { ctx.fillStyle = COLORS.focus.bandOnPaper; ctx.fillRect(r.x, r.y, r.w, r.h); }
      const color = row.enabled ? INK : FAINT;
      drawText(ctx, row.data.name, r.x + 4, r.y + 4, { color });
      drawText(ctx, `×${row.data.count}`, r.x + r.w - 6, r.y + 4, { color, align: 'right' });
    });
    listFocus.drawCursor(ctx, { style: 'paper', ring: false });
  }

  function drawReadCard(ctx) {
    const k = Math.min(1, (overlay.t || 0) / frames(6));
    const w = L.readCard.w;
    const m = sides[1];
    const info = readInfo && readInfo.name === m.name ? readInfo : null;
    // lay out first (rows of draw ops), so the card is exactly as tall as what it says
    /** @type {Array<(x: number, y: number) => void>} */
    const ops = [];
    let y = 6;
    const at = (fn, h) => { const yy = y; ops.push((x0, y0) => fn(x0, y0 + yy)); y += h; };
    const line = (label, value, state) => {
      const mh = Math.max(10, measureText(value, { maxWidth: w - 62 }).h + 2);
      at((x0, yy) => {
        drawText(ctx, label, x0 + 6, yy + 1, { color: SOFT, font: 'small' });
        drawText(ctx, value, x0 + 56, yy, { color: state === 'unknown' ? FAINT : INK, maxWidth: w - 62 });
      }, mh);
    };
    at((x0, yy) => drawText(ctx, `${m.name}  Lv${m.level}`, x0 + 6, yy, { color: INK }), 11);
    at((x0, yy) => {
      drawText(ctx, t('read.types'), x0 + 6, yy + 3, { color: SOFT, font: 'small' });
      let cx = x0 + 56;
      for (const ty of m.types) cx += drawTypeChip(ctx, chipId(ty), cx, yy) + 2;
    }, 14);
    if (info) {
      line(t('read.ability'), `${info.ability.name} ✦`, 'known');
      const th = measureText(info.ability.text, { maxWidth: w - 14 }).h + 4;
      at((x0, yy) => drawText(ctx, info.ability.text, x0 + 8, yy - 1, { color: SOFT, maxWidth: w - 14 }), th);
      const s = st().sides[1];
      const ward = !info.ability.ward ? t('read.wardNone') : s.wardSuppressed > 0 ? t('read.wardSuppressed', { n: Math.max(0, s.wardSuppressed - 1) }) : t('read.wardActive');
      line(t('read.ward'), ward, 'known');
      if (info.moves) line(t('read.moves'), info.moves.map((id) => (data.tryGet ? data.tryGet('moves', id)?.name : id) || id).join(', '), 'known');
      if (info.heldItem !== undefined) line(t('read.held'), info.heldItem ? (data.tryGet ? data.tryGet('items', info.heldItem)?.name : info.heldItem) || info.heldItem : '—', 'known');
      if (info.mends !== undefined) line(t('read.mends'), String(st().sides[1].party[st().sides[1].active].mends), 'known');
      if (!info.moves) line(t('read.moves'), `${t('read.unknown')}  (${t('read.prismOnly')})`, 'unknown');
    } else {
      line(t('read.ability'), `${t('read.unknown')}  (${t('read.notYet')})`, 'unknown');
      line(t('read.ward'), st().sides[1].wardBadge ? t('battle.tag.ward') : t('read.unknown'), 'unknown');
      line(t('read.moves'), t('read.unknown'), 'unknown');
    }
    if (lastReadout && info && lastReadout.target === m.name) {
      line('Readout', lastReadout.types.length ? t('battle.ward.types', { types: lastReadout.types.join(', ') }) : t('battle.ward.noTypes'), 'known'); // str
    }
    const footer = overlay.ask ? 22 : 12;
    const h = y + footer;
    const r = { x: L.readCard.x, y: Math.round(L.readCard.y + 6 - (1 - k) * 12), w, h };
    drawPanel(ctx, r, 'card', { title: t('read.heading') });
    for (const op of ops) op(r.x, r.y);
    if (overlay.ask) {
      drawText(ctx, t('read.costsTurn'), r.x + 6, r.y + r.h - 20, { color: BERRY, font: 'small' });
      drawText(ctx, 'Z: Read (uses the turn)   X: Back', r.x + 6, r.y + r.h - 11, { color: SOFT, font: 'small' }); // str
    } else if (mode === 'modal') {
      drawText(ctx, 'X: Back', r.x + r.w - 6, r.y + r.h - 10, { color: FAINT, font: 'small', align: 'right' }); // str
    } else if (queue.gated() && Math.floor(elapsed / 500) % 2 === 0) {
      drawText(ctx, TYPE.more, r.x + r.w - 10, r.y + r.h - 11, { color: PALETTE.waxRed });
    }
  }

  function drawReadout(ctx, ev) {
    const k = Math.min(1, (overlay.t || 0) / frames(5));
    const w = 300;
    const x = Math.round(lerp(W, 90, k));
    const y = 22;
    const lines = [];
    const held = ev.wardKind === 'strong-only' ? t('battle.ward.strongOnly', { ward: ev.ward })
      : ev.wardKind === 'no-status' ? t('battle.ward.noStatus', { ward: ev.ward })
        : ev.wardKind === 'min-power' ? t('battle.ward.minPower', { ward: ev.ward, power: 50 }) : t('battle.ward.held', { ward: ev.ward });
    const entry = (e) => t('battle.ward.entry', { nick: e.creature, move: e.moveName });
    lines.push([ev.canLand.length ? t('battle.ward.canLand', { moves: ev.canLand.map(entry).join(', ') }) : t('battle.ward.nothingLands'), ev.canLand.length ? INK : BERRY]);
    if (ev.outOfPp.length) lines.push([t('battle.ward.outOfPp', { moves: ev.outOfPp.map(entry).join(', ') }), SOFT]);
    lines.push([ev.types.length ? t('battle.ward.types', { types: ev.types.join(', ') }) : t('battle.ward.noTypes'), INK]);
    lines.push([t('battle.ward.indirect', { kinds: ev.indirect.join(', ') }), INK]);
    if (ev.chip.length) lines.push([t('battle.ward.chip', { moves: ev.chip.map((e) => `${entry(e)} (${e.kind})`).join(', ') }), INK]);
    if (ev.crackdust) lines.push([t('battle.ward.crackdust', { n: session.battle.sides[0].bag.crackdust }), INK]);
    let h = 26;
    for (const [text] of lines) h += measureText(text, { maxWidth: w - 24 }).h + 4;
    drawPanel(ctx, { x, y, w, h: h + 10 }, 'notice', { title: 'Ward readout', titleStyle: 'wax' }); // str
    drawIcon(ctx, 'ward', x + 10, y + 9, { ink: INK, accent: PALETTE.i });
    drawText(ctx, held, x + 22, y + 10, { color: INK, maxWidth: w - 34 });
    let yy = y + 26;
    for (const [text, color] of lines) {
      drawText(ctx, '•', x + 10, yy, { color: SOFT });
      drawText(ctx, text, x + 18, yy, { color, maxWidth: w - 28 });
      yy += measureText(text, { maxWidth: w - 28 }).h + 4;
    }
    if (Math.floor(elapsed / 500) % 2 === 0) drawText(ctx, TYPE.more, x + w - 12, y + h, { color: PALETTE.waxRed });
  }

  /** The Relay's between-rounds pick (MID-05). */
  function drawRelay(ctx) {
    drawDim(ctx, W, H);
    const o = overlay;
    const h = o.rows.length * 15 + 52;
    drawPanel(ctx, { x: 100, y: 30, w: 280, h }, 'paper', { title: o.title });
    drawText(ctx, o.dry ? `Out of fresh faces: anyone may come back. Choose ${o.per}.` : `Choose ${o.per} who have not fought yet. No healing between rounds.`, 112, 44, { color: SOFT, font: 'small', maxWidth: 256 }); // str
    const party = world().party;
    o.rows.forEach((r, i) => {
      const focused = o.focus.index === i;
      if (focused) { ctx.fillStyle = COLORS.focus.bandOnPaper; ctx.fillRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h); }
      const picked = r.uid && o.picks.includes(r.uid);
      if (r.uid) {
        const c = party.find((x) => x.uid === r.uid);
        drawText(ctx, picked ? '[x]' : '[ ]', r.rect.x + 2, r.rect.y + 3, { color: r.enabled ? INK : FAINT, font: 'small' });
        drawText(ctx, r.label, r.rect.x + 22, r.rect.y + 3, { color: r.enabled ? INK : SOFT });
        if (c) drawText(ctx, `Lv${c.level}  ${Math.max(0, c.hp)}/${c.stats.hp}`, r.rect.x + r.rect.w - 4, r.rect.y + 3, { color: c.hp > 0 ? SOFT : BERRY, font: 'small', align: 'right' });
        if (!r.enabled && r.reason) drawText(ctx, r.reason, r.rect.x + 120, r.rect.y + 3, { color: FAINT, font: 'small' });
      } else {
        drawText(ctx, r.label, r.rect.x + 4, r.rect.y + 3, { color: INK });
      }
    });
    if (o.note) drawText(ctx, o.note, 112, 30 + h - 12, { color: BERRY, font: 'small' });
    o.focus.drawCursor(ctx, { style: 'paper', ring: false });
  }

  function drawLearn(ctx) {
    drawDim(ctx, W, H);
    const rows = overlay.rows;
    const h = rows.length * 16 + 40;
    drawPanel(ctx, { x: 120, y: 40, w: 240, h }, 'paper', { title: 'New technique' }); // str
    drawText(ctx, overlay.title, 132, 50, { color: INK, maxWidth: 216 });
    rows.forEach((r, i) => {
      const focused = overlay.focus.index === i;
      if (focused) { ctx.fillStyle = COLORS.focus.bandOnPaper; ctx.fillRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h); }
      if (r.mark) drawIcon(ctx, 'heartmark', r.rect.x + 2, r.rect.y + 3, { accent: MAGENTA });
      drawText(ctx, r.label, r.rect.x + (r.mark ? 12 : 4), r.rect.y + 3, { color: r.enabled ? INK : SOFT });
    });
    overlay.focus.drawCursor(ctx, { style: 'paper', ring: false });
  }

  function drawNaming(ctx) {
    drawDim(ctx, W, H);
    const o = overlay;
    drawPanel(ctx, { x: 100, y: 60, w: 280, h: 150 }, 'paper', { title: t('entry.nameCreature') });
    drawText(ctx, o.species, 116, 72, { color: SOFT, font: 'small' });
    // the name field with a blinking caret
    ctx.fillStyle = COLORS.paper.light;
    ctx.fillRect(160, 92, 160, 16);
    strokeRect(ctx, { x: 160, y: 92, w: 160, h: 16 }, INK);
    const mw = measureText(o.name).w;
    if (o.selected && o.name) { ctx.fillStyle = COLORS.focus.bandOnPaper; ctx.fillRect(164, 95, mw + 4, 10); }
    const nw = drawText(ctx, o.name, 166, 97, { color: INK }).w;
    if (!o.selected && Math.floor(elapsed / 400) % 2 === 0) { ctx.fillStyle = PALETTE.waxRed; ctx.fillRect(167 + nw, 96, 1, 9); }
    drawText(ctx, `${o.name.length}/10`, 316, 110, { color: FAINT, font: 'small', align: 'right' });
    for (const k of o.keys) {
      const r = k.rect;
      const focused = o.focus.current() === k;
      ctx.fillStyle = k.enabled === false ? COLORS.paper.shade : focused ? COLORS.paper.light : COLORS.paper.fill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      strokeRect(ctx, r, focused ? INK : COLORS.paper.rule);
      const label = k.ch !== undefined ? (k.ch === ' ' ? '␣' : o.caps ? k.ch : k.ch.toLowerCase()) : k.label;
      drawText(ctx, label === '␣' ? t('entry.space') : label, r.x + r.w / 2, r.y + Math.floor((r.h - 7) / 2), { color: k.enabled === false ? FAINT : INK, align: 'center', font: label === '␣' ? 'small' : 'main' });
    }
    o.focus.drawCursor(ctx, { style: 'paper', ring: false });
    if (o.note) drawText(ctx, o.note, 120, 202, { color: BERRY, font: 'small' });
  }

  function drawSlip(ctx) {
    const o = overlay;
    const w = 240;
    const h = 30 + o.lines.length * 12;
    const x = 120;
    const y = 50;
    drawDim(ctx, W, L.arenaH);
    drawPanel(ctx, { x, y, w, h }, 'notice', { title: o.title, titleStyle: 'wax' });
    drawSeal(ctx, x + 10, y + 10, { emblem: 'check' });
    o.lines.forEach((ln, i) => drawText(ctx, ln, x + 26, y + 12 + i * 12, { color: INK, maxWidth: w - 36 }));
    if (Math.floor(elapsed / 500) % 2 === 0) drawText(ctx, TYPE.more, x + w - 12, y + h - 10, { color: PALETTE.waxRed });
  }

  function drawCurtain(ctx) {
    const h = Math.round(curtain * (H / 2));
    ctx.fillStyle = COLORS.night.ink;
    ctx.fillRect(0, 0, W, h);
    ctx.fillRect(0, H - h, W, h);
  }

  /** Ordered 4×4 dither threshold (0..15). */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  /** @type {Map<string, CanvasPattern|null>} */
  const patterns = new Map();
  /** A 4×4 ordered-dither pattern with `level` of 16 cells set. */
  function ditherPattern(ctx, level, color) {
    const key = `${level}|${color}`;
    if (patterns.has(key)) return patterns.get(key);
    const cv = makeCanvas(4, 4);
    let pat = null;
    if (cv) {
      const c = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
      c.fillStyle = color;
      for (let i = 0; i < 16; i++) if (BAYER[i] < level) c.fillRect(i % 4, Math.floor(i / 4), 1, 1);
      pat = ctx.createPattern(/** @type {any} */ (cv), 'repeat');
    }
    patterns.set(key, pat);
    return pat;
  }

  function drawAmber(ctx) {
    // 40 f fade to a warm dark in ordered-dither steps (no alpha wash, no white, no flash)
    const k = Math.min(1, amber);
    const level = Math.floor(k * 16);
    ctx.fillStyle = '#2A1E18';
    if (level >= 16) ctx.fillRect(0, 0, W, H);
    else if (level > 0) {
      const pat = ditherPattern(ctx, level, '#2A1E18');
      if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); }
    }
    if (!overlay || overlay.kind !== 'blackout') return;
    // then the porchlight comes on: a three-step dither pool of amber growing 4 f per step
    const t = overlay.t - frames(40);
    if (t <= 0) return;
    const steps = Math.min(3, 1 + Math.floor(t / frames(4)));
    const cx = 240;
    const cy = 104;
    const rings = [[18, 16], [32, 8], [46, 4]];
    for (let i = steps - 1; i >= 0; i--) {
      const [r, density] = rings[i];
      ctx.fillStyle = i === 0 ? AMBER : i === 1 ? '#E0A050' : '#9C6A3A';
      for (let y = -r; y <= r; y++) {
        const half = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
        for (let x = -half; x <= half; x++) {
          if (density >= 16 || BAYER[((cy + y) & 3) * 4 + ((cx + x) & 3)] < density) ctx.fillRect(cx + x, cy + y, 1, 1);
        }
      }
    }
    // the lamp, and Dimity settling into its light
    ctx.fillStyle = '#7A5A36';
    ctx.fillRect(cx - 3, cy - 30, 7, 2);
    ctx.fillStyle = '#FFE4A8';
    ctx.fillRect(cx - 2, cy - 28, 5, 5);
    if (t > frames(18)) {
      const land = Math.min(1, (t - frames(18)) / frames(18));
      const my = Math.round(cy - 40 + land * 22);
      const flap = land < 1 && Math.floor(t / 80) % 2 === 0;
      ctx.fillStyle = PALETTE.springBlossom;
      ctx.fillRect(cx - (flap ? 4 : 5), my, flap ? 3 : 4, 3);
      ctx.fillRect(cx + 2, my, flap ? 3 : 4, 3);
      ctx.fillStyle = PALETTE.y;
      ctx.fillRect(cx - 1, my - 1, 3, 5);
      ctx.fillStyle = '#7A5A36';
      ctx.fillRect(cx, my - 2, 1, 1);
    }
    if (overlay.t > frames(40)) {
      drawPanel(ctx, { x: 80, y: 176, w: 320, h: 52 }, 'paper', { title: overlay.who });
      drawText(ctx, overlay.text, 92, 188, { color: INK, maxWidth: 296 });
      if (overlay.t > frames(60) && Math.floor(elapsed / 500) % 2 === 0) drawText(ctx, TYPE.more, 386, 216, { color: PALETTE.waxRed });
    }
  }

  // ------------------------------------------------------------------------------------------
  // debug text + the scene object
  // ------------------------------------------------------------------------------------------

  function debugText() {
    if (mode === 'error') return `battle error: ${error}`;
    if (!session) return 'battle';
    const s = st();
    const foe = s.sides[1].party[s.sides[1].active];
    const me = s.sides[0].party[s.sides[0].active];
    const focusLabel = mode === 'menu' ? rootFocus.current()?.id : mode === 'moves' ? moveFocus.current()?.id : list ? listFocus.current()?.id : '';
    const ov = overlay ? `${overlay.kind}${overlay.focus ? ':' + overlay.focus.index : ''}${overlay.busy ? ':busy' : ''}` : '';
    return `battle ${mode}${ov ? ' [' + ov + ']' : ''} | ${me.name} ${me.hp}/${me.maxHp} vs ${foe.name} ${foe.hp}/${foe.maxHp} | focus ${focusLabel} | ${log.text}`;
  }

  const scene = {
    name: 'battle',
    opaque: true,
    enter(p) { enter(p); bindSpeedKeys(); },
    exit() { exit(); unbindSpeedKeys(); },
    pause() {},
    resume() { if (overlay && overlay.kind === 'relay' && overlay.awaitBag) overlay.refresh(); },
    update,
    handleInput,
    draw,
    isBusy: () => busy(),
    debugText,
    /** Test / harness view (read-only). */
    get session() { return session; },
    get mode() { return mode; },
    get overlay() { return overlay ? overlay.kind : null; },
    get overlayState() { return overlay; },
    get post() { return post; },
    /** The display model of a side (what the screen shows, which may trail the engine during animations). @param {number} side */
    shown(side) { const m = sides[side]; return { speciesId: m.speciesId, name: m.name, types: m.types.slice(), hp: m.hp, maxHp: m.maxHp, strip: visibleStrip() ? { ...visibleStrip() } : null }; },
    get log() { return log.text; },
    get speed() { return queue.speed; },
    setSpeed,
  };
  return scene;
}

// Bind the battle debug hooks as soon as the debug hook exists (main.js installs it after the
// scene registry loads; the BOOT lane may call installBattleDebug(G) directly instead).
if (typeof window !== 'undefined') {
  let tries = 0;
  const poll = () => {
    const hook = /** @type {any} */ (window).__game;
    if (hook && hook.G) { installBattleDebug(hook.G); return; }
    if (++tries < 120) setTimeout(poll, 50);
  };
  setTimeout(poll, 0);
}
