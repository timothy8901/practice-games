/**
 * Dialogue: the ledger slip across the bottom 72 px. [SCN-UI] — GDD-00 §13, GDD-09 §3.5, ARCHITECTURE §6.2.
 *
 * Modal (`opaque: false`) script host for `say`, `choice`, `nickname`, `letter`, `openShop`, `toast`,
 * `playSfx` and the one-of-a-kind `take` ask. Any other host op ends the slip: a dialogue pushed by a
 * cutscene pops with `{pending: request}` for the cutscene to perform; a dialogue that owns its
 * session hands it to a fresh cutscene (`replace`) so world ops in a talk script still run.
 *
 * Params (one of): `{session, pending}` (a cutscene's session, the request to show first),
 * `{target}` (an npc / porch / sign target resolved through script/registry, with Linger),
 * `{scriptId}` / `{ops}` (a script), `{text, who}` (one line). Extras: `onDone(result)`.
 * Pops with `{done: true, vars}`, `{pending}` or `{skip: true}` (hold cancel in a skippable cutscene).
 *
 * Layout (GDD-09 §3.5): slip 8,198,464,64 (ledger paper); bust 16,206 48×48 (talking bob every 6 f
 * while typing); wax-seal name tab 16,190; text 72,206 392×48, four lines at 10 px; `▼` at 456,254;
 * Linger seal 416,250; choices on a paper slip docked above the slip's right end (in 6 f, 15 f lock).
 *
 * Input: confirm / cancel / a tap on the slip completes the page, then advances (cancel never picks a
 * choice); holding confirm types four times faster; Tab (`log`) opens the 100-line log; in a
 * skippable cutscene holding cancel for 0.7 s skips to the next choice. Text speed from settings.
 * @module scenes/dialogue
 */
import { drawText, drawTextTyped, measureText } from '../core/font.js';
import { drawSprite, isSprite } from '../core/pixelart.js';
import { ease } from '../core/tween.js';
import { createFocus, drawDottedRect } from '../ui/focus.js';
import { drawPanel } from '../ui/panel.js';
import { drawSeal, getPortraitPlaceholder } from '../ui/icons.js';
import { drawSealButton, drawTypeChip } from '../ui/widgets.js';
import { creatureSprite } from '../art/creatures/index.js';
import { beatFor, paginate } from '../ui/textbox.js';
import { COLORS, PALETTE, TIMING, TYPE } from '../ui/theme.js';
import { portraitSprite } from '../art/portraits.js';
import { t, has as hasString } from '../data/strings.js';
import { parseShorthand } from '../script/ops.js';
import { itemOf } from '../systems/econ.js';
import * as memory from '../systems/memory.js';
import * as party from '../systems/party.js';
import { createConfirmScene } from '../ui/confirm.js';
import { createNameEntry } from './nameEntry.js';
import { readExt, drawSkinPanel, skinOf } from './menuKit.js';
import {
  DIALOGUE_OPS, TILDE_BEAT_MS, createSession, resolveTalk, recordSaid, canLinger, lingerSession,
  speakerOf, textLog, textCps, reducedMotion, skipAnims, stripBeats,
} from './scriptHost.js';

/** Slip geometry (GDD-09 §3.5). */
export const SLIP = Object.freeze({ x: 8, y: 198, w: 464, h: 64 });
export const BUST = Object.freeze({ x: 16, y: 206, w: 48, h: 48 });
export const TEXT = Object.freeze({ x: 72, y: 206, w: 384, lines: 4 });
export const NARRATION = Object.freeze({ x: 22, y: 206, w: 430 });
export const LINGER = Object.freeze({ x: 392, y: 247, w: 66, h: 13 });
/**
 * Large text (GDD-09 §6): text at 2×, three lines, a taller slip. Same anchors otherwise.
 * @type {{slip: typeof SLIP, bust: typeof BUST, text: {x: number, y: number, w: number, lines: number}, narration: {x: number, y: number, w: number}, scale: number}}
 */
export const LARGE = Object.freeze({
  slip: Object.freeze({ x: 8, y: 176, w: 464, h: 86 }),
  bust: Object.freeze({ x: 16, y: 196, w: 48, h: 48 }),
  text: Object.freeze({ x: 72, y: 184, w: 384, lines: 3 }),
  narration: Object.freeze({ x: 22, y: 184, w: 430 }),
  scale: 2,
});
const NORMAL = Object.freeze({ slip: SLIP, bust: BUST, text: TEXT, narration: NARRATION, scale: 1 });
/** Auto-advance (GDD-09 §6): a finished line moves on after 90 f + 2 f per character. */
export const AUTO_BASE_MS = 1500;
export const AUTO_PER_CHAR_MS = 33;
/** A say's `emote` -> the bust's expression (art/portraits; neutral where a bust has only one). */
export const EMOTE_EXPR = Object.freeze({ '!': 'surprised', '?': 'worried', '♥': 'happy', '…': 'worried', zzz: 'neutral', happy: 'happy', worried: 'worried', surprised: 'surprised' });
/** Hold cancel this long to skip a skippable cutscene. */
export const SKIP_HOLD_MS = 700;
/** Choice row height (≥ 15 native px touch target at 3×). */
export const CHOICE_ROW_H = 15;
const IN_MS = 100;  // 6 f
const OUT_MS = 67;  // 4 f
const SLIDE_PX = 12;

/**
 * Page list for a line: `|` and `\f` break pages, wrapped to the text area, `~` beats kept for the
 * typewriter (stripped per page by {@link stripBeats}). Pure.
 * @param {string} text
 * @param {boolean} narration
 * @returns {Array<{text: string, beats: number[]}>}
 */
export function pagesFor(text, narration, large = false) {
  const L = large ? LARGE : NORMAL;
  const w = Math.floor((narration ? L.narration.w : L.text.w) / L.scale);
  const raw = String(text ?? '').replace(/\|/g, '\f');
  return paginate(raw, { maxWidth: w, maxLines: L.text.lines }).map(stripBeats);
}

/** Starter-card choice rows (FH-06): sprite, name, type chips and a line of temperament. */
export const STARTER_ROW_H = 34;
export const STARTER_PANEL_W = 312;

/**
 * Starter cards for a choice whose every option names a starter on the last dry stones ("The
 * Sloshkin."): one `{speciesId, name, types, temper}` per option, or null for any other choice. Only
 * species with a `starter.temper.<id>` line count, so ordinary choices never grow cards. Pure.
 * @param {string[]} labels
 * @param {any} data   Registry (`list('species')`) or tables (`species` array)
 * @returns {Array<{speciesId: string, name: string, types: string[], temper: string}>|null}
 */
export function starterCardsFor(labels, data) {
  if (!Array.isArray(labels) || !labels.length) return null;
  let rows = [];
  try { rows = typeof data?.list === 'function' ? data.list('species') : Array.isArray(data?.species) ? data.species : Object.values(data?.species ?? {}); } catch { rows = []; }
  const out = [];
  for (const label of labels) {
    const m = /^the\s+(.+?)\.?$/i.exec(String(label ?? '').trim());
    const sp = m && rows.find((r) => r && typeof r.name === 'string' && r.name.toLowerCase() === m[1].toLowerCase());
    if (!sp || !hasString(`starter.temper.${sp.id}`)) return null;
    out.push({ speciesId: sp.id, name: sp.name, types: Array.isArray(sp.types) ? sp.types.slice() : [], temper: t(`starter.temper.${sp.id}`) });
  }
  return out;
}

/**
 * Is `who` a creature (a party/box uid, or `player:<uid>`)? Returns the uid or null.
 * @param {any} world
 * @param {string} who
 * @returns {string|null}
 */
export function creatureUidOf(world, who) {
  const id = String(who ?? '').replace(/^player:/, '');
  const all = [...(world?.party ?? []), ...(world?.box ?? [])];
  return all.some((c) => c.uid === id) ? id : null;
}

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, isBusy: () => boolean}}
 */
export function createDialogueScene(G) {
  /** @type {any} */ let params = {};
  /** @type {import('./scriptHost.js').Session|null} */ let session = null;
  /** @type {any} */ let req = null;           // the request on screen
  let state = 'idle';                         // say | choice | nick | entry | nameConfirm | take | child | end | closing | done
  let speaker = speakerOf(G, {});
  /** @type {Array<{text: string, beats: number[]}>} */ let pages = [{ text: '', beats: [] }];
  let page = 0, shown = 0, acc = 0, beat = 0, ticks = 0;
  let talkMs = 0;
  let slide = { t: 0, ms: IN_MS, dir: 'in' };
  /** @type {any} */ let closeResult = null;
  let skipHeld = 0;
  let logOpen = false, logScroll = 0;
  // choices
  /** @type {Array<{label: string, value: any, enabled?: boolean, reason?: string}>} */ let choices = [];
  /** @type {any} */ let choiceFocus = null;
  let choiceRect = { x: 0, y: 0, w: 0, h: 0 };
  let choiceLock = 0, choiceT = 0;
  /** @type {ReturnType<typeof starterCardsFor>} */ let choiceCards = null;
  /** @type {(i: number) => void} */ let onChoice = () => {};
  // name entry / confirm
  /** @type {any} */ let entry = null;
  /** @type {{name: string, lock: number, index: number, onYes: (n: string) => void, onEdit: () => void}|null} */ let nameAsk = null;
  // linger
  let lingerOffered = false, lingerFocus = false;
  let bob = 0;
  let large = false;   // large text (re-read at every line, so the setting applies live)
  let autoMs = 0;      // auto-advance countdown on a finished page

  const bus = () => G.bus;
  const ext = () => { try { return readExt(G); } catch { return { largeText: false, autoAdvance: false }; } };
  const L = () => (large ? LARGE : NORMAL);
  const sfx = (evt, payload) => { try { bus()?.emit(evt, payload ?? {}); } catch { /* audio must never break text */ } };

  // ------------------------------------------------------------------ text
  function showLine(text, who, opts = {}) {
    speaker = who === undefined ? speaker : who;
    large = ext().largeText === true;
    pages = pagesFor(text, !speaker.name, large);
    page = 0;
    startPage(opts.instant === true);
  }

  function startPage(instant) {
    shown = instant || !Number.isFinite(textCps(G)) ? pageChars().length : 0;
    acc = 0; beat = 0; ticks = 0;
    autoMs = 0;
  }

  function pageChars() { return Array.from(pages[page].text.replace(/\n/g, '')); }
  function pageDone() { return shown >= pageChars().length; }
  function lastPage() { return page >= pages.length - 1; }

  function completePage() { shown = pageChars().length; beat = 0; acc = 0; }

  function typeUpdate(dt, fast) {
    if (pageDone()) return;
    const cps = textCps(G);
    if (!Number.isFinite(cps)) { completePage(); return; }
    if (beat > 0) { beat -= dt; if (beat > 0) return; dt = -beat; beat = 0; }
    const chars = pageChars();
    const beats = pages[page].beats;
    acc += (dt * cps * (fast ? 4 : 1)) / 1000;
    while (acc >= 1 && shown < chars.length) {
      acc -= 1;
      shown += 1;
      if (speaker.name && ++ticks % 2 === 0 && chars[shown - 1] !== ' ') sfx('sfx', { name: 'textTick', semitones: speaker.tick });
      let b = beatFor(chars[shown - 1], chars[shown], cps);
      if (beats.includes(shown)) b = Math.max(b, TILDE_BEAT_MS);
      if (b > 0 && shown < chars.length) { beat = fast ? b / 4 : b; acc = 0; break; }
    }
  }

  // ------------------------------------------------------------------ the runner loop
  function pull(answer) {
    if (!session) { close({ done: true }); return; }
    let r;
    try {
      r = session.next(answer);
    } catch (e) {
      console.warn(`dialogue: script error: ${e && e.message}`);
      close({ done: true, error: String(e && e.message) });
      return;
    }
    if (r && r.done) { finishSession(); return; }
    dispatch(r);
  }

  function dispatch(r) {
    req = r;
    switch (r.op) {
      case 'say': {
        state = 'say';
        const sp = speakerOf(G, r);
        sp.expr = EMOTE_EXPR[r.emote] ?? (typeof r.expr === 'string' ? r.expr : 'neutral');
        textLog(G).push(sp.name, r.text);
        showLine(r.text, sp);
        return;
      }
      case 'choice': {
        if (typeof r.prompt === 'string' && r.prompt) {
          // a prompt may name its speaker like a say line ("Wren: Will you?")
          const said = parseShorthand(r.prompt, (id) => !!(G.data && G.data.has('npcs', id)));
          const sp = said.who ? speakerOf(G, { who: said.who, name: G.data?.has?.('npcs', said.who) ? undefined : said.who }) : speaker;
          textLog(G).push(sp.name, said.text);
          showLine(said.text, sp);
        } else if (!pages[0].text) {
          showLine('', speaker, { instant: true });
        } else {
          completePage();
        }
        const labels = r.options.map((o) => o.text);
        openChoices(r.options.map((o) => ({ label: o.text, value: o.index })), r.defaultIndex ?? 0, (i) => {
          textLog(G).push('>', r.options[i].text);
          pull(i);
        }, starterCardsFor(labels, G.data));
        state = 'choice';
        return;
      }
      case 'nickname': return startNickname(r);
      case 'take': {
        const row = itemOf(G.data, r.item);
        state = 'take';
        const body = t('confirm.oneOfAKind', { item: row?.name ?? r.item });
        G.scenes.push(makeConfirm(G, body, [t('confirm.option.keep'), t('confirm.option.use')], 0));
        return;
      }
      case 'letter': {
        state = 'child';
        G.push('letter', { n: r.n ?? null, from: 'script' });
        return;
      }
      case 'openShop': {
        state = 'child';
        G.push('shop', { shop: r.shop, from: 'script' });
        return;
      }
      case 'toast': sfx('toast', { text: r.text }); pull(); return;
      case 'playSfx': sfx('sfx', { name: r.name }); pull(); return;
      default: {
        if (DIALOGUE_OPS.includes(r.op)) { pull(); return; }
        if (params.fromCutscene) { close({ pending: r }); return; }
        // our own session met a world op: a cutscene takes over (same session, same request)
        const factory = G.sceneFactories && G.sceneFactories.cutscene;
        if (typeof factory === 'function') {
          state = 'done';
          G.scenes.replace(factory(G), { session, pending: r, letterbox: false });
        } else {
          pull();
        }
      }
    }
  }

  function finishSession() {
    recordSaid(G, /** @type {any} */ (session));
    req = null;
    if (canLinger(G, session)) {
      lingerOffered = true;
      lingerFocus = false;
      state = 'end';
      completePage();
      return;
    }
    close({ done: true, vars: session ? { ...session.vars } : {} });
  }

  function doLinger() {
    const next = lingerSession(G, /** @type {any} */ (session));
    lingerOffered = false;
    if (!next) { close({ done: true }); return; }
    sfx('ui:confirm');
    session = next;
    pull();
  }

  function close(result) {
    if (state === 'closing' || state === 'done') return;
    closeResult = result;
    choices = []; choiceFocus = null;
    if (entry) { entry.detach(); entry = null; }
    state = 'closing';
    slide = { t: 0, ms: skipAnims(G) ? 0 : OUT_MS, dir: 'out' };
    // the pop happens on the next update, never inside enter() / a stack callback
  }

  function finishClose() {
    state = 'done';
    const r = closeResult ?? { done: true };
    // pop first: a callback that opens the next screen must not bury this one under it
    if (G.scenes.top() === scene) G.scenes.pop(r);
    if (typeof params.onDone === 'function') { try { params.onDone(r); } catch (e) { console.warn(e); } }
  }

  // ------------------------------------------------------------------ choices
  function openChoices(list, defaultIndex, cb, cards = null) {
    choices = list;
    onChoice = cb;
    // starter cards dock on the left, so the creatures on the stones at the right edge stay in view (FH-06)
    choiceCards = cards && cards.length === list.length ? cards : null;
    const rowH = choiceCards ? STARTER_ROW_H : CHOICE_ROW_H;
    const labelW = list.reduce((m, c) => Math.max(m, measureText(c.label).w), 0);
    const w = choiceCards ? STARTER_PANEL_W : Math.min(300, Math.max(152, labelW + 30));
    const h = list.length * rowH + 8;
    choiceRect = { x: choiceCards ? L().slip.x + 4 : L().slip.x + L().slip.w - w, y: L().slip.y - 10 - h, w, h };
    const items = list.map((c, i) => ({
      id: String(i), enabled: c.enabled !== false, reason: c.reason,
      rect: { x: choiceRect.x + 14, y: choiceRect.y + 4 + i * rowH, w: w - 20, h: rowH },
    }));
    choiceFocus = createFocus({ items, cols: 1, wrap: true, index: Math.max(0, Math.min(list.length - 1, defaultIndex | 0)) });
    choiceFocus.on('change', () => sfx('ui:cursor'));
    choiceFocus.on('activate', (ev) => {
      const i = ev.index;
      const pick = choices[i];
      choices = []; choiceFocus = null;
      sfx('ui:confirm');
      onChoice(pick ? pick.value : i);
    });
    choiceLock = skipAnims(G) ? 0 : TIMING.choiceLockMs;
    choiceT = 0;
  }

  // ------------------------------------------------------------------ nicknames and names
  function startNickname(r, again = false) {
    const world = G.world;
    const npcRow = G.data && G.data.has('npcs', r.who) ? G.data.get('npcs', r.who) : null;
    const uid = npcRow ? null : creatureUidOf(world, r.who);
    if (npcRow) {
      const sp = speakerOf(G, { who: r.who });
      const offer = typeof r.offer === 'string' && r.offer ? r.offer : world.player.name;
      state = 'nick';
      const line = `${sp.name} wants to call you “${offer}”.`; // str
      if (!again) textLog(G).push(sp.name, line);
      showLine(line, sp, { instant: again }); // back from name entry: already read, no retyping
      openChoices([
        { label: `“${offer}” is fine.`, value: 'accept' }, // str
        { label: `Just ${world.player.name}.`, value: 'decline' }, // str
        { label: 'How about…', value: 'counter' }, // str
      ], 0, (choice) => {
        if (choice === 'counter') {
          openEntry(`What should ${sp.name} call you?`, world.player.name, '', (name) => applyNpcNick(r.who, 'counter', name, offer), () => startNickname(r, true)); // str
          return;
        }
        applyNpcNick(r.who, choice, null, offer);
      });
      return;
    }
    // a creature (or anything else): name entry with the suggestion
    const c = uid ? [...world.party, ...world.box].find((x) => x.uid === uid) : null;
    const suggest = typeof r.offer === 'string' && r.offer ? r.offer : c?.nickname ?? null;
    openEntry(t('entry.nameCreature'), suggest, '', (name) => {
      if (uid) G.store.tx('creature:nickname', (w) => party.nickname(w, uid, name, { bus: G.bus }));
      textLog(G).push('', `Named it ${name}.`); // str
      pull(name);
    }, () => pull(null), true);
  }

  function applyNpcNick(npcId, choice, counter, offer) {
    const res = G.store.tx('npc:nickname', (w) => memory.setNickname(w, npcId, choice, G.data, { offer, counter: counter ?? undefined, bus: G.bus }));
    const nick = res && res.ok ? res.nickname : null;
    textLog(G).push('>', choice === 'accept' ? `“${offer}” it is.` : choice === 'decline' ? `Just ${G.world.player.name}.` : `“${counter}”.`); // str
    pull(nick);
  }

  function openEntry(prompt, suggest, initial, onDone, onCancel, narrateConfirm = false) {
    state = 'entry';
    choices = []; choiceFocus = null;
    entry = createNameEntry({
      input: G.input,
      prompt,
      initial,
      suggest,
      sfx: (evt) => sfx(evt),
      onDone: (name) => {
        entry?.detach(); entry = null;
        state = 'nameConfirm';
        showLine(`“${name}”. Is that right?`, narrateConfirm ? speakerOf(G, {}) : speaker, { instant: true }); // str
        nameAsk = { name, lock: skipAnims(G) ? 0 : TIMING.inputLockMs, index: 1, onYes: onDone, onEdit: () => openEntry(prompt, suggest, name, onDone, onCancel, narrateConfirm) };
      },
      onCancel: () => { entry?.detach(); entry = null; onCancel(); },
    });
    entry.attach();
  }

  const askRects = () => {
    const S = L().slip;
    return [
      { x: S.x + S.w - 166, y: S.y + S.h - 20, w: 56, h: 13 },
      { x: S.x + S.w - 86, y: S.y + S.h - 20, w: 76, h: 13 },
    ];
  };
  const lingerRect = () => ({ ...LINGER, y: L().slip.y + L().slip.h - 15 });

  function handleNameAsk(input) {
    const a = /** @type {any} */ (nameAsk);
    if (a.lock > 0) return;
    if (input.repeat('left') || input.repeat('right')) { a.index = 1 - a.index; sfx('ui:cursor'); }
    const p = input.pointer;
    if (p && p.inside && p.justDown) {
      askRects().forEach((r, i) => {
        if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
          if (a.index === i || p.type !== 'touch') { a.index = i; choose(i); } else a.index = i;
        }
      });
      return;
    }
    if (input.pressed('confirm')) choose(a.index);
    else if (input.pressed('cancel')) choose(0);
    function choose(i) {
      nameAsk = null;
      if (i === 1) { sfx('ui:confirm'); a.onYes(a.name); } else { sfx('ui:cancel'); a.onEdit(); }
    }
  }

  // ------------------------------------------------------------------ the scene
  const scene = {
    name: 'dialogue',
    opaque: false,
    updateBelow: false,
    enter(p) {
      params = p ?? {};
      state = 'idle';
      req = null; closeResult = null; lingerOffered = false; logOpen = false; nameAsk = null; entry = null;
      choices = []; choiceFocus = null; skipHeld = 0;
      pages = [{ text: '', beats: [] }]; page = 0; shown = 0;
      speaker = speakerOf(G, {});
      slide = { t: 0, ms: skipAnims(G) ? 0 : reducedMotion(G) ? 67 : IN_MS, dir: 'in' };
      try {
        if (params.session) session = params.session;
        else if (params.target) session = resolveTalk(G, params.target);
        else if (params.scriptId || params.ops) session = createSession(G, { scriptId: params.scriptId ?? null, ops: params.ops, npc: params.npc ?? null });
        else if (String(params.text ?? '').trim()) session = createSession(G, { ops: [{ op: 'say', who: params.who ?? undefined, text: String(params.text) }] });
        else session = null; // nothing to say: no empty slip
      } catch (e) {
        console.warn(`dialogue: ${e && e.message}`);
        session = null;
      }
      if (params.pending) dispatch(params.pending);
      else pull();
    },
    exit() { if (entry) { entry.detach(); entry = null; } },
    // the name entry reads physical keys only while this slip is on top
    pause() { if (entry) entry.detach(); },
    resume(result) {
      if (entry && state === 'entry') entry.attach();
      if (state === 'take') { pull(result === 1); return; }
      if (state === 'child') { pull(result ?? undefined); }
    },
    update(dt) {
      bob = (bob + dt) % TIMING.cursorBobMs;
      if (slide.t < slide.ms) {
        slide.t = Math.min(slide.ms, slide.t + dt);
        if (slide.dir === 'out' && slide.t >= slide.ms && state === 'closing') { finishClose(); return; }
      } else if (state === 'closing') { finishClose(); return; }
      const fast = !!(G.input && G.input.held && G.input.held('confirm') && G.input.heldFor('confirm') >= 250);
      if (state === 'say' || state === 'choice' || state === 'nick') typeUpdate(dt, fast);
      if (state === 'say' && pageDone() && !logOpen && ext().autoAdvance === true) autoMs += dt; else autoMs = 0;
      talkMs = pageDone() ? 0 : talkMs + dt;
      if (choiceFocus) {
        choiceFocus.update(dt);
        choiceT = Math.min(IN_MS, choiceT + dt);
        if (pageDone() && choiceLock > 0) choiceLock = Math.max(0, choiceLock - dt);
      }
      if (nameAsk && nameAsk.lock > 0) nameAsk.lock = Math.max(0, nameAsk.lock - dt);
      if (entry) entry.update(dt);
    },
    handleInput(input) {
      if (state === 'closing' || state === 'done' || state === 'child' || state === 'take') return;
      if (slide.dir === 'in' && slide.t < slide.ms) return;
      // the log overlay
      if (logOpen) {
        if (input.pressed('log') || input.pressed('cancel') || input.pressed('confirm')) { logOpen = false; sfx('ui:cancel'); return; }
        if (input.repeat('up')) logScroll += 1;
        if (input.repeat('down')) logScroll = Math.max(0, logScroll - 1);
        return;
      }
      if (state !== 'entry' && input.pressed('log')) { logOpen = true; logScroll = 0; sfx('ui:confirm'); return; }
      // hold cancel to skip a skippable cutscene (never past a choice: the cutscene stops there)
      if (session && session.skippable && params.fromCutscene && state === 'say') {
        if (input.held('cancel')) {
          skipHeld = input.heldFor('cancel');
          if (skipHeld >= SKIP_HOLD_MS) { skipHeld = 0; close({ skip: true }); return; }
        } else skipHeld = 0;
      }
      if (state === 'entry' && entry) { entry.handle(input); return; }
      if (state === 'nameConfirm' && nameAsk) { handleNameAsk(input); return; }
      if ((state === 'choice' || state === 'nick') && choiceFocus) {
        if (!pageDone()) {
          if (input.pressed('confirm') || input.pressed('cancel') || (input.pointer?.justDown && input.pointer.inside)) completePage();
          return;
        }
        if (choiceLock > 0) return;
        if (input.pressed('cancel')) return; // cancel never picks a choice
        choiceFocus.handle(input);
        return;
      }
      if (state === 'end') {
        if (input.repeat('left') || input.repeat('right')) { lingerFocus = !lingerFocus; sfx('ui:cursor'); }
        const p = input.pointer;
        const LR = lingerRect();
        if (p && p.inside && p.justDown && p.x >= LR.x && p.x < LR.x + LR.w && p.y >= LR.y && p.y < LR.y + LR.h) {
          if (lingerFocus || p.type !== 'touch') { doLinger(); return; }
          lingerFocus = true; return;
        }
        if (input.pressed('confirm')) { if (lingerFocus) doLinger(); else close({ done: true, vars: session ? { ...session.vars } : {} }); return; }
        if (input.pressed('cancel') || (p && p.inside && p.justDown)) { close({ done: true, vars: session ? { ...session.vars } : {} }); }
        return;
      }
      if (state === 'say') {
        const p = input.pointer;
        const tap = p && p.inside && p.justDown && p.y >= L().slip.y - 14;
        const auto = autoMs >= AUTO_BASE_MS + AUTO_PER_CHAR_MS * pageChars().length;
        if (auto && pageDone()) { autoMs = 0; if (!lastPage()) { page += 1; startPage(false); } else pull(); return; }
        if (input.pressed('confirm') || input.pressed('cancel') || tap) {
          if (input.pressed('cancel') && session?.skippable && params.fromCutscene && input.heldFor && input.heldFor('cancel') > 120) return;
          if (!pageDone()) { completePage(); return; }
          if (!lastPage()) { page += 1; startPage(false); return; }
          pull();
        }
      }
    },
    draw(ctx) {
      if (state === 'done') return;
      const k = slide.ms > 0 ? slide.t / slide.ms : 1;
      const prog = slide.dir === 'in' ? ease.outQuad(k) : 1 - k;
      const off = reducedMotion(G) ? 0 : Math.round((1 - prog) * SLIDE_PX);
      const alpha = reducedMotion(G) ? prog : 1;
      ctx.save();
      if (alpha < 1) ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      // the entry panel carries its own prompt: the slip (old line / choices) must not sit on top
      // of the key grid (LG-RN130)
      if (state === 'entry' && entry) entry.draw(ctx);
      else drawSlip(ctx, off);
      ctx.restore();
      if (logOpen) drawLog(ctx);
    },
    debugText() {
      const lines = [];
      if (speaker.name) lines.push(`${speaker.name}:`);
      lines.push(pages[page]?.text ?? '');
      if (choices.length) lines.push(...choices.map((c, i) => `${choiceFocus && choiceFocus.index === i ? '>' : ' '} ${c.label}`));
      if (entry) lines.push(entry.debugText());
      if (lingerOffered) lines.push(`[${t('verb.linger')}]`);
      return lines.join('\n');
    },
    isBusy: () => state === 'closing' || state === 'idle' || !pageDone() || slide.t < slide.ms || (!!choiceFocus && choiceLock > 0) || (!!nameAsk && nameAsk.lock > 0),
    get state() { return state; },
  };

  // ------------------------------------------------------------------ drawing
  function drawSlip(ctx, off) {
    const { slip: SLIP, bust: BUST, scale } = L();
    const y = SLIP.y + off;
    const hasBust = !!speaker.name;
    // High contrast (LG-RN102, GDD-09 §6): the slip becomes cream on night ink with 2 px edges
    const hc = ext().highContrast === true;
    if (hc) drawSkinPanel(ctx, { x: SLIP.x, y, w: SLIP.w, h: SLIP.h }, skinOf({ contrast: true }), 'ledger');
    else drawPanel(ctx, { x: SLIP.x, y, w: SLIP.w, h: SLIP.h }, 'ledger', { rulePitch: 10 * scale, ruleStart: scale === 2 ? 25 : 17, margin: 0 });
    // the margin line right of the bust
    if (hasBust) {
      ctx.fillStyle = COLORS.paper.margin;
      ctx.fillRect(BUST.x + BUST.w + 3, y + 4, 1, SLIP.h - 8);
      // bust frame
      const bx = BUST.x, by = BUST.y + off;
      ctx.fillStyle = COLORS.paper.shade;
      ctx.fillRect(bx, by, BUST.w, BUST.h);
      const talking = !pageDone() && Math.floor(talkMs / 100) % 2 === 1 && !reducedMotion(G);
      const spr = speaker.portrait ? portraitSprite(speaker.portrait, /** @type {any} */ (speaker).expr ?? 'neutral') : null;
      if (spr && isSprite(spr)) drawSprite(ctx, spr, bx, by + (talking ? 1 : 0));
      else drawSprite(ctx, getPortraitPlaceholder(), bx + 8, by + 8 + (talking ? 1 : 0));
      ctx.fillStyle = COLORS.paper.edge;
      ctx.fillRect(bx, by + BUST.h, BUST.w, 1);
      // wax-seal name tab
      const tw = measureText(speaker.name).w + 18;
      const tx = 16, ty = SLIP.y - 9 + off;
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(tx + 1, ty + 1, tw, 12);
      ctx.fillStyle = COLORS.wax.fill;
      ctx.fillRect(tx, ty, tw, 12);
      ctx.fillStyle = COLORS.wax.light;
      ctx.fillRect(tx, ty, tw, 1);
      ctx.fillStyle = COLORS.wax.dark;
      ctx.fillRect(tx, ty + 11, tw, 1);
      drawText(ctx, speaker.name, tx + 12, ty + 3, { color: COLORS.wax.text });
      drawSeal(ctx, tx - 5, ty, { emblem: 'none' });
    }
    // text
    const T = hasBust ? L().text : L().narration;
    const pg = pages[page] ?? { text: '' };
    drawTextTyped(ctx, pg.text, T.x, T.y + off, shown, { color: hc ? COLORS.paper.light : COLORS.paper.ink, maxWidth: T.w + 4, scale }); // maxWidth is in scaled px
    // more / end marks
    const ax = SLIP.x + SLIP.w - 12, ay = SLIP.y + SLIP.h - 11 + off;
    const lift = bob < TIMING.cursorBobMs / 2 ? 0 : 1;
    if (state === 'say' && pageDone()) {
      drawText(ctx, lastPage() ? TYPE.cursor : TYPE.more, ax, ay + (lastPage() ? 0 : lift), { color: COLORS.wax.fill });
    }
    if (pages.length > 1) drawText(ctx, `${page + 1}/${pages.length}`, ax - 6, ay + 2, { font: 'small', align: 'right', color: COLORS.paper.inkFaint });
    // skip hold gauge
    if (skipHeld > 0 && state === 'say') {
      const w = Math.round(60 * Math.min(1, skipHeld / SKIP_HOLD_MS));
      // top-right of the slip, clear of the name tab
      const gx = SLIP.x + SLIP.w - 64;
      drawText(ctx, 'Skipping…', gx - 4, SLIP.y - 9, { font: 'small', align: 'right', color: COLORS.paper.light, shadow: true }); // str
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(gx, SLIP.y - 7, 60, 2);
      ctx.fillStyle = COLORS.wax.fill;
      ctx.fillRect(gx, SLIP.y - 7, w, 2);
    }
    // linger seal
    if (state === 'end' && lingerOffered) {
      const LR = lingerRect();
      const closeW = measureText(t('common.close')).w;
      const cx = LR.x - closeW - 18;
      if (!lingerFocus) drawText(ctx, TYPE.cursor, cx - 8 + lift, LR.y + 3 + off, { color: COLORS.wax.fill });
      drawText(ctx, t('common.close'), cx, LR.y + 3 + off, { color: lingerFocus ? COLORS.paper.inkFaint : COLORS.paper.ink });
      drawSealButton(ctx, t('verb.linger'), LR.x, LR.y + off, { focused: lingerFocus, w: LR.w });
      if (lingerFocus) drawText(ctx, TYPE.cursor, LR.x - 8 + lift, LR.y + 3 + off, { color: COLORS.wax.fill });
    }
    // name confirm seals
    if (state === 'nameConfirm' && nameAsk) {
      const rs = askRects();
      const labels = ['Edit', 'That\'s it']; // str
      rs.forEach((r, i) => {
        drawSealButton(ctx, labels[i], r.x, r.y + off, { focused: nameAsk && nameAsk.index === i && nameAsk.lock <= 0, role: i === 0 ? 'neutral' : 'safe', w: r.w });
      });
      const r = rs[nameAsk.index];
      drawText(ctx, TYPE.cursor, r.x - 7, r.y + 3 + off, { color: nameAsk.lock > 0 ? COLORS.paper.inkFaint : COLORS.wax.fill });
    }
    // choices
    if (choiceFocus && choices.length && pageDone()) {
      const k = Math.min(1, choiceT / IN_MS);
      const cx = reducedMotion(G) ? 0 : Math.round((1 - k) * SLIDE_PX);
      const R = { ...choiceRect, x: choiceRect.x + cx };
      drawPanel(ctx, R, 'paper', { grain: false });
      const rowH = choiceCards ? STARTER_ROW_H : CHOICE_ROW_H;
      choices.forEach((c, i) => {
        const it = choiceFocus.items[i];
        const ry = it.rect.y;
        if (i === choiceFocus.index && choiceLock <= 0) {
          ctx.fillStyle = choiceFocus.pointerActive ? COLORS.focus.hoverOnPaper : COLORS.focus.bandOnPaper;
          ctx.fillRect(R.x + 10, ry, R.w - 14, rowH);
        }
        const card = choiceCards ? choiceCards[i] : null;
        if (!card) {
          drawText(ctx, c.label, R.x + 15, ry + 4, { color: c.enabled === false ? COLORS.role.disabled : COLORS.paper.ink, maxWidth: R.w - 20 });
          return;
        }
        try { drawSprite(ctx, creatureSprite(card.speciesId, { view: 'front', types: card.types }), R.x + 15, ry + 1); } catch { /* no art: the words still choose */ }
        drawText(ctx, c.label, R.x + 52, ry + 4, { color: COLORS.paper.ink, maxWidth: R.w - 60 });
        let cx = R.x + 52;
        for (const ty of card.types) cx += drawTypeChip(ctx, String(ty).toLowerCase(), cx, ry + 17) + 2;
        drawText(ctx, card.temper, cx + 3, ry + 19, { font: 'small', color: COLORS.paper.inkSoft, maxWidth: R.x + R.w - cx - 10 });
      });
      const cur = choiceFocus.items[choiceFocus.index];
      if (cur) {
        const locked = choiceLock > 0;
        const cy = choiceCards ? cur.rect.y + Math.floor((rowH - 8) / 2) : cur.rect.y + 4;
        drawText(ctx, TYPE.cursor, R.x + 5 + (locked ? 0 : lift), cy, { color: locked ? COLORS.paper.inkFaint : COLORS.wax.fill });
        if (!locked) drawDottedRect(ctx, R.x + 10, cur.rect.y, R.w - 14, rowH, COLORS.focus.ringOnPaper);
      }
    }
  }

  function drawLog(ctx) {
    ctx.fillStyle = COLORS.dim;
    ctx.fillRect(0, 0, 480, 270);
    const R = { x: 24, y: 14, w: 432, h: 242 };
    drawPanel(ctx, R, 'ledger', { title: t('journal.log'), titleStyle: 'wax', rulePitch: 10, margin: 0 });
    const lines = [];
    for (const l of textLog(G).lines()) {
      const prefix = l.who === '>' ? '▶ ' : l.who ? `${l.who}: ` : '';
      const wrapped = paginate(prefix + l.text, { maxWidth: R.w - 24, maxLines: 99 })[0].split('\n');
      wrapped.forEach((w, i) => lines.push({ text: w, who: i === 0 && !!l.who, choice: l.who === '>' }));
    }
    const rows = Math.floor((R.h - 26) / 10);
    const maxScroll = Math.max(0, lines.length - rows);
    logScroll = Math.min(logScroll, maxScroll);
    const start = Math.max(0, lines.length - rows - logScroll);
    lines.slice(start, start + rows).forEach((l, i) => {
      drawText(ctx, l.text, R.x + 12, R.y + 8 + i * 10, { color: l.choice ? COLORS.wax.fill : COLORS.paper.ink });
    });
    if (!lines.length) drawText(ctx, 'Nothing said yet.', R.x + R.w / 2, R.y + 100, { align: 'center', color: COLORS.paper.inkFaint }); // str
    drawText(ctx, `↑↓ scroll   Tab/X: back   ${lines.length ? `${Math.min(lines.length, start + rows)}/${lines.length}` : ''}`, R.x + R.w - 10, R.y + R.h - 11, { align: 'right', font: 'small', color: COLORS.paper.inkFaint }); // str
  }

  return scene;
}

/**
 * The kit confirm as a scene (safe option first). The dialogue's resume() reads the chosen index
 * straight from the stack's pop result.
 * @param {any} G
 * @param {string} body
 * @param {string[]} options
 * @param {number} defaultIndex
 */
function makeConfirm(G, body, options, defaultIndex) {
  return createConfirmScene({
    body, options, defaultIndex, input: G.input, stack: G.scenes,
    width: G.display?.width || 480, height: G.display?.height || 270,
    onDone: () => {},
  });
}

/** Re-exported for the test page: the log of a context. */
export { textLog } from './scriptHost.js';
/** Colours used by the slip, for visual tests. */
export const DIALOGUE_COLORS = Object.freeze({ wax: COLORS.wax.fill, ink: COLORS.paper.ink, night: PALETTE.nightInk });
