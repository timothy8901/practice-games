/**
 * Pure helpers for the pause-menu screens. [SCN-MENU]
 *
 * Everything here is data in, data out: the party/Coverage maths, the curve gap, the Satchel's
 * disc learner strips, the save-slot summaries, the settings rows (GDD-00 §15) and the remap
 * conflict rules. No canvas, no DOM, no store mutation, so `test/scenes.menuModel.test.mjs` runs it
 * under Node. The scenes (`menu.js`, `party.js`, `box.js`, `bag.js`, `settings.js`, `saveLoad.js`)
 * draw and mutate; they ask this module what to show.
 *
 * Content is read through `systems/exp.dataLookup(data)` (the same adapter the creature lane uses),
 * so a Registry or a plain object of tables both work, and a missing table degrades to `???`.
 * @module scenes/menuModel
 */
import { dataLookup } from '../systems/exp.js';
import { t, has } from '../data/strings.js';
import { TYPE_CHART as FALLBACK_CHART, ORDINARY_TYPES as FALLBACK_ORDINARY } from '../data/types.js';
import { pickAnchor } from '../art/heartmark.js';
import { boxCapacity as partyBoxCapacity } from '../systems/party.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').Creature} Creature */

// ---------------------------------------------------------------------------------------------
// Pause menu
// ---------------------------------------------------------------------------------------------

/**
 * Pause entries in GDD-00 §13 order; **Save is always last**. `scene` is the registry name pushed,
 * `params` what it is pushed with, `icon` a `menuKit` glyph id.
 */
export const MENU_ITEMS = Object.freeze([
  Object.freeze({ id: 'party', key: 'menu.party', label: 'Party', scene: 'party', icon: 'paw', params: null }),
  Object.freeze({ id: 'satchel', key: 'menu.satchel', label: 'Satchel', scene: 'bag', icon: 'satchel', params: null }),
  Object.freeze({ id: 'ledger', key: 'menu.ledger', label: 'Ledger', scene: 'ledger', icon: 'tally', params: null }),
  Object.freeze({ id: 'map', key: 'menu.map', label: 'Map', scene: 'mapScreen', icon: 'map', params: null }),
  Object.freeze({ id: 'fieldLog', key: 'menu.fieldLog', label: 'Field Log', scene: 'fieldLog', icon: 'book', params: null }),
  Object.freeze({ id: 'journal', key: 'menu.journal', label: 'Journal', scene: 'letter', icon: 'letter', params: Object.freeze({ journal: true }) }),
  Object.freeze({ id: 'settings', key: 'menu.settings', label: 'Settings', scene: 'settings', icon: 'gear', params: null }),
  Object.freeze({ id: 'save', key: 'menu.save', label: 'Save', scene: 'saveLoad', icon: 'quill', params: Object.freeze({ mode: 'save', from: 'menu' }) }),
]);

/** Challenge id that limits saves to one autosave slot and no manual saves (state/persist). */
export const NO_REWIND = 'no-rewind';

/**
 * Whether the run carries the No Rewind challenge.
 * @param {World|null|undefined} world
 * @returns {boolean}
 */
export function isNoRewind(world) {
  const list = world?.run?.challenges;
  return Array.isArray(list) && list.includes(NO_REWIND);
}

/**
 * The pause rows for this world: every entry stays focusable (so one Up from the top always lands
 * on Save), but under No Rewind the Save row reads `menu.saveLocked` and is drawn greyed.
 * @param {World|null|undefined} world
 * @returns {Array<{id: string, label: string, scene: string, icon: string, params: any, locked: boolean, note: string}>}
 */
export function pauseRows(world) {
  const noRewind = isNoRewind(world);
  return MENU_ITEMS.map((it) => {
    const locked = it.id === 'save' && noRewind;
    return {
      id: it.id,
      label: has(it.key) ? t(it.key) : it.label,
      scene: it.scene,
      icon: it.icon,
      params: it.params ? { ...it.params, ...(locked ? { noRewind: true } : {}) } : null,
      locked,
      note: locked ? t('menu.saveLocked') : '',
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Creatures
// ---------------------------------------------------------------------------------------------

/**
 * A safe content adapter: `dataLookup(data)` or a lookup that knows nothing.
 * @param {any} data
 * @returns {import('../systems/exp.js').DataLookup}
 */
export function lookOf(data) {
  if (data && (typeof data === 'object' || typeof data === 'function')) {
    try { return dataLookup(data); } catch { /* fall through */ }
  }
  const none = () => null;
  const nope = (what) => (id) => { throw new RangeError(`unknown ${what} ${JSON.stringify(id)}`); };
  return Object.freeze({
    species: nope('species'), speciesOrNull: none, move: nope('move'), moveOrNull: none,
    ability: nope('ability'), abilityOrNull: none, familyOrNull: none, itemOrNull: none, typeNames: () => [],
  });
}

/**
 * Curve gap of a creature against the posted curve level.
 * @param {number} level
 * @param {number} curve
 * @returns {{kind: 'over'|'under'|'on', n: number}}
 */
export function curveGap(level, curve) {
  const d = Math.round((Number(level) || 0) - (Number(curve) || 0));
  if (d > 0) return { kind: 'over', n: d };
  if (d < 0) return { kind: 'under', n: -d };
  return { kind: 'on', n: 0 };
}

/**
 * The curve gap in words (`party.curve.*`).
 * @param {{kind: 'over'|'under'|'on', n: number}} gap
 * @returns {string}
 */
export function curveGapText(gap) {
  return t(`party.curve.${gap.kind}`, { n: gap.n });
}

/**
 * Total PP left / max across a creature's moves.
 * @param {Pick<Creature, 'moves'>} c
 * @returns {{pp: number, max: number, empty: number}}
 */
export function ppSummary(c) {
  let pp = 0, max = 0, empty = 0;
  for (const m of c?.moves ?? []) {
    pp += Math.max(0, m.pp | 0);
    max += Math.max(0, m.maxPp | 0);
    if ((m.pp | 0) <= 0 && (m.maxPp | 0) > 0) empty++;
  }
  return { pp, max, empty };
}

/**
 * The type names a creature currently has (an Unfixed loop's current type first).
 * @param {Creature} c
 * @returns {string[]}
 */
export function typesOf(c) {
  if (Array.isArray(c?.typeQueue) && c.typeQueue.length) {
    const cur = c.typeQueue[Math.max(0, Math.min(c.typeQueue.length - 1, c.typeIndex | 0))];
    return [cur, ...(c.types ?? []).filter((x) => x !== cur)].slice(0, 2);
  }
  return Array.isArray(c?.types) ? c.types.slice() : [];
}

/**
 * Chart type name -> `ui/theme.TYPE_CHIPS` id (`'Brine'` -> `'brine'`).
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function chipId(name) {
  return typeof name === 'string' ? name.toLowerCase() : '';
}

/**
 * The type chart: the registry's (`data.typeChart`, or a `types` table carrying `chart`), else the
 * authoritative table from `data/types.js`.
 * @param {any} data
 * @returns {{chart: Record<string, Record<string, number>>, ordinary: string[]}}
 */
export function chartOf(data) {
  const pick = (o) => (o && typeof o === 'object' && !Array.isArray(o) && (o.chart || o.TYPE_CHART)
    ? { chart: o.chart || o.TYPE_CHART, ordinary: (o.ordinary || o.ORDINARY_TYPES || null) }
    : null);
  let found = null;
  try {
    found = pick(data?.typeChart);
    if (!found && data && typeof data.raw === 'function' && Array.isArray(data.tables) && data.tables.includes('types')) found = pick(data.raw('types'));
    if (!found && data && !Array.isArray(data.types)) found = pick(data?.types);
  } catch { found = null; }
  const chart = found?.chart ?? FALLBACK_CHART;
  const ordinary = (found?.ordinary ?? FALLBACK_ORDINARY).filter((x) => chart[x]);
  return { chart, ordinary: ordinary.length ? ordinary.slice() : Object.keys(chart).filter((x) => x !== 'Star') };
}

/**
 * Multiplier of an attacking type against a defending type (1 for unknown / typeless).
 * @param {Record<string, Record<string, number>>} chart
 * @param {string|null} attack
 * @param {string} defend
 * @returns {number}
 */
export function typeMult(chart, attack, defend) {
  if (attack == null) return 1;
  const v = chart?.[attack]?.[defend];
  return typeof v === 'number' && Number.isFinite(v) ? v : 1;
}

/**
 * The damaging moves of a creature with their type (status moves and typeless moves are left out:
 * they never change Coverage).
 * @param {Creature} c
 * @param {import('../systems/exp.js').DataLookup} look
 * @returns {Array<{id: string, name: string, type: string, power: number}>}
 */
export function damagingMoves(c, look) {
  const out = [];
  for (const m of c?.moves ?? []) {
    const mv = look.moveOrNull(m.id);
    if (!mv) continue;
    const power = Number(mv.power) || 0;
    if (mv.category === 'status' || power <= 0 || typeof mv.type !== 'string' || !mv.type) continue;
    out.push({ id: m.id, name: mv.name ?? m.id, type: mv.type, power });
  }
  return out;
}

/**
 * @typedef {Object} CoverageRow
 * @property {string} type                 defending type
 * @property {number} best                 best multiplier any party move reaches (0 = everything is Blocked)
 * @property {'strong'|'neutral'|'weak'|'blocked'|'none'} grade   `none` = the party has no damaging move at all
 * @property {Array<{uid: string, nick: string, move: string, mult: number}>} strong   who hits it Strong, with what
 */

/**
 * The Coverage view (GDD-00 §13): for every ordinary type, the best multiplier the party's damaging
 * moves reach (a single defending type, the chart as written). A **gap** is a type nothing in the
 * party lands on better than Weak (an immunity like Hollow's against Plain and Grit counts as
 * Blocked); `noStrong` lists the types nothing hits Strong.
 * @param {Creature[]} party
 * @param {any} data
 * @param {{fainted?: boolean}} [opts]  `fainted: false` leaves resting creatures out
 * @returns {{rows: CoverageRow[], gaps: string[], blocked: string[], noStrong: string[], strongCount: number, moves: number}}
 */
export function coverage(party, data, opts = {}) {
  const look = lookOf(data);
  const { chart, ordinary } = chartOf(data);
  const members = (party ?? []).filter((c) => c && (opts.fainted !== false || (c.hp | 0) > 0));
  const moves = [];
  for (const c of members) for (const m of damagingMoves(c, look)) moves.push({ uid: c.uid, nick: c.nickname, ...m });
  const rows = ordinary.map((type) => {
    let best = moves.length ? 0 : 1;
    const strong = [];
    for (const m of moves) {
      const mult = typeMult(chart, m.type, type);
      if (mult > best) best = mult;
      if (mult > 1) strong.push({ uid: m.uid, nick: m.nick, move: m.name, mult });
    }
    /** @type {CoverageRow['grade']} */
    const grade = !moves.length ? 'none' : best === 0 ? 'blocked' : best < 1 ? 'weak' : best > 1 ? 'strong' : 'neutral';
    return { type, best, grade, strong };
  });
  const gaps = rows.filter((r) => r.grade === 'weak' || r.grade === 'blocked').map((r) => r.type);
  return {
    rows,
    gaps,
    blocked: rows.filter((r) => r.grade === 'blocked').map((r) => r.type),
    noStrong: rows.filter((r) => r.grade !== 'strong').map((r) => r.type),
    strongCount: rows.filter((r) => r.grade === 'strong').length,
    moves: moves.length,
  };
}

/**
 * The Gap label in words: `Gap: Hollow` / `Gap: Hollow and Stone` / `Gap: Hollow, Stone and Rust`,
 * or `party.noGap`. A party with no damaging move at all says so.
 * @param {ReturnType<typeof coverage>} cov
 * @returns {string}
 */
export function gapText(cov) {
  if (!cov.moves) return 'No damaging techniques yet.'; // str
  if (!cov.gaps.length) return t('party.noGap');
  return t('party.gap', { types: listWords(cov.gaps) });
}

/**
 * `a`, `a and b`, `a, b and c`.
 * @param {string[]} words
 * @returns {string}
 */
export function listWords(words) {
  const w = (words ?? []).filter(Boolean);
  if (w.length <= 1) return w.join('');
  return `${w.slice(0, -1).join(', ')} and ${w[w.length - 1]}`;
}

/**
 * An item or place name after "the": `the Salve`, but `the Bracks' Still Knot` for a name that
 * already starts with "The " (never "the The ...").
 * @param {string} name
 * @returns {string}
 */
export function theName(name) {
  const n = String(name ?? '');
  return /^the\s/i.test(n) ? `the ${n.slice(4)}` : `the ${n}`;
}

// ---------------------------------------------------------------------------------------------
// Heartmark placement
// ---------------------------------------------------------------------------------------------

/** The four Heartmark anchor names a form declares (GDD-00 §14), in data order. */
export const MARK_SPOTS = Object.freeze(['head', 'chest', 'back', 'tail']);

/**
 * Small stable string hash (FNV-1a 32).
 * @param {string} s
 * @returns {number}
 */
export function hash32(s) {
  let h = 0x811c9dc5;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/**
 * Which of the four anchors this individual's mark sits on. A stored `mark.spot` / `mark.anchor`
 * (name or index, the reconcile-notes recommendation) wins; otherwise `art/heartmark.pickAnchor(uid)`
 * (the stable uid hash every lane falls back to), so it is the same for life and in every form.
 * @param {Pick<Creature, 'uid'|'mark'>} c
 * @returns {'head'|'chest'|'back'|'tail'}
 */
export function heartmarkSpot(c) {
  const m = c?.mark ?? null;
  const raw = m && (m.spot ?? m.anchor);
  if (typeof raw === 'string' && MARK_SPOTS.includes(raw)) return /** @type {any} */ (raw);
  if (Number.isInteger(raw) && raw >= 0 && raw < 4) return /** @type {any} */ (MARK_SPOTS[raw]);
  return pickAnchor(c?.uid ?? '');
}

/**
 * The mark's pixel in a form's 32x32 sprite: the form's anchor for this individual's spot plus the
 * individual's small offset (`mark.x/y`, clamped to ±2 so it never leaves the body). Forms without
 * declared anchors use a generic head/chest/back/tail layout.
 * @param {Pick<Creature, 'uid'|'mark'>} c
 * @param {{flags?: Record<string, any>}|null} sp   species info of the form being drawn
 * @param {{w?: number, h?: number}} [size]
 * @returns {{x: number, y: number, spot: string}}
 */
export function markPixel(c, sp, size = {}) {
  const w = size.w ?? 32, h = size.h ?? 32;
  const spot = heartmarkSpot(c);
  const anchors = sp?.flags?.heartmarkAnchors ?? null;
  const generic = { head: { x: 12, y: 9 }, chest: { x: 13, y: 19 }, back: { x: 20, y: 14 }, tail: { x: 26, y: 23 } };
  const a = anchors && anchors[spot] && Number.isFinite(anchors[spot].x) ? anchors[spot] : generic[spot];
  const dx = Math.max(-2, Math.min(2, Number(c?.mark?.x) | 0));
  const dy = Math.max(-2, Math.min(2, Number(c?.mark?.y) | 0));
  return { x: Math.max(1, Math.min(w - 2, Math.round(a.x * (w / 32)) + dx)), y: Math.max(1, Math.min(h - 2, Math.round(a.y * (h / 32)) + dy)), spot };
}

// ---------------------------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------------------------

/** Window presets in cycle order: always ask (null), auto-Anchor, auto-accept Up. */
export const PRESETS = Object.freeze([null, 'auto-anchor', 'auto-up']);

/**
 * @param {'auto-anchor'|'auto-up'|null|undefined} mode
 * @returns {string}
 */
export function presetLabel(mode) {
  if (mode === 'auto-anchor') return t('summary.preset.autoAnchor');
  if (mode === 'auto-up') return t('summary.preset.autoUp');
  return t('summary.preset.ask');
}

/**
 * Next preset in the cycle.
 * @param {'auto-anchor'|'auto-up'|null|undefined} mode
 * @param {number} [dir=1]
 * @returns {'auto-anchor'|'auto-up'|null}
 */
export function nextPreset(mode, dir = 1) {
  const i = Math.max(0, PRESETS.indexOf(mode ?? null));
  return PRESETS[(i + (dir < 0 ? -1 : 1) + PRESETS.length) % PRESETS.length];
}

// ---------------------------------------------------------------------------------------------
// Box
// ---------------------------------------------------------------------------------------------

/** Storage capacity before / after the Cellar commission (GDD-00 §13, tuning BOX_CAPACITY). */
export const BOX_BASE = 20;
export const BOX_CELLAR = 40;

/**
 * Box capacity for this world: 20, or 40 once the Cellar commission is built.
 * @param {World|null|undefined} world
 * @param {{BOX_CAPACITY?: number, boxCapacityCellar?: number}|null} [tuning]
 * @returns {number}
 */
export function boxCapacity(world, tuning) {
  return partyBoxCapacity(world, { tuning });
}

// ---------------------------------------------------------------------------------------------
// Satchel
// ---------------------------------------------------------------------------------------------

/**
 * The move a disc teaches, with what the detail panel needs.
 * @param {{move?: string, use?: string}|null} item
 * @param {any} data
 * @returns {{id: string, name: string, type: string|null, power: number, accuracy: number|null, category: string, pp: number|null, text: string}|null}
 */
export function discMove(item, data) {
  if (!item || typeof item.move !== 'string') return null;
  const mv = lookOf(data).moveOrNull(item.move);
  if (!mv) return { id: item.move, name: t('common.unknown'), type: null, power: 0, accuracy: null, category: 'status', pp: null, text: '' };
  return {
    id: mv.id, name: mv.name ?? mv.id, type: mv.type ?? null, power: Number(mv.power) || 0,
    accuracy: mv.accuracy ?? null, category: mv.category ?? 'status', pp: mv.pp ?? null, text: mv.text ?? '',
  };
}

/**
 * Whether a form can be taught a move by disc: its learnset or its `flags.teachable` list.
 * @param {any} sp  species info
 * @param {string} moveId
 * @returns {boolean}
 */
export function canBeTaught(sp, moveId) {
  if (!sp) return false;
  const inSet = (sp.learnset ?? []).some((e) => (Array.isArray(e) ? e[1] : e.move) === moveId);
  return inSet || (Array.isArray(sp.flags?.teachable) && sp.flags.teachable.includes(moveId));
}

/**
 * The learner strip of a disc: one entry per party member.
 * @param {Creature[]} party
 * @param {string} moveId
 * @param {any} data
 * @returns {Array<{uid: string, nick: string, speciesId: string, state: 'can'|'knows'|'cannot'}>}
 */
export function learnerStrip(party, moveId, data) {
  const look = lookOf(data);
  return (party ?? []).map((c) => {
    const knows = (c.moves ?? []).some((m) => m.id === moveId);
    const sp = look.speciesOrNull(c.speciesId);
    return { uid: c.uid, nick: c.nickname, speciesId: c.speciesId, state: knows ? 'knows' : canBeTaught(sp, moveId) ? 'can' : 'cannot' };
  });
}

/**
 * Who holds what: item id -> nicknames of the creatures holding one (party first, then box).
 * @param {World} world
 * @returns {Record<string, string[]>}
 */
export function holders(world) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const c of [...(world?.party ?? []), ...(world?.box ?? [])]) {
    if (c?.heldItem) (out[c.heldItem] ||= []).push(c.nickname);
  }
  return out;
}

/**
 * The actions an item row offers in the field, in menu order, each with enabled + reason.
 * @param {Record<string, any>|null} item
 * @param {{pocket: string, party: Creature[]}} ctx
 * @returns {Array<{id: 'use'|'hold'|'teach'|'toss', label: string, enabled: boolean, reason: string}>}
 */
export function itemActions(item, ctx) {
  const use = item?.use ?? null;
  const keepsake = ctx.pocket === 'keepsakes' || item?.pocket === 'keepsakes';
  const party = ctx.party ?? [];
  const out = [];
  const fieldUse = ['heal', 'revive', 'pp', 'cure'].includes(use);
  if (use === 'disc') {
    out.push({ id: 'teach', label: t('bag.action.teach'), enabled: party.length > 0, reason: 'Nobody to teach.' }); // str
  } else if (use === 'hold') {
    out.push({ id: 'hold', label: t('bag.action.hold'), enabled: party.length > 0, reason: 'Nobody to hold it.' }); // str
  } else if (fieldUse) {
    out.push({ id: 'use', label: t('bag.action.use'), enabled: party.length > 0, reason: 'Nobody to use it on.' }); // str
  } else if (use && use !== 'key') {
    out.push({ id: 'use', label: t('bag.action.use'), enabled: false, reason: use.startsWith('capture') || use === 'sure-catch' || use === 'ward-suppress' ? 'For battle: raise it from the battle panel.' : t('bag.notHere') }); // str
  }
  const tossable = !keepsake && use !== 'key' && item?.oneOfAKind !== true;
  out.push({ id: 'toss', label: 'Toss', enabled: tossable, reason: keepsake || item?.oneOfAKind ? t('bag.keepsakeSafe') : 'It stays with you.' }); // str
  return out;
}

// ---------------------------------------------------------------------------------------------
// Save slots
// ---------------------------------------------------------------------------------------------

/**
 * `1h 05m`, `12m`, `0m` from milliseconds of play.
 * @param {number} ms
 * @returns {string}
 */
export function formatPlayTime(ms) {
  const mins = Math.max(0, Math.floor((Number(ms) || 0) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/**
 * A display name for a map id: the registry's `maps` row name, else the id in words.
 * @param {string} mapId
 * @param {any} [data]
 * @returns {string}
 */
export function placeName(mapId, data) {
  if (typeof mapId !== 'string' || !mapId || mapId === '—') return 'Somewhere on the shore'; // str
  try {
    if (data && typeof data.has === 'function' && data.has('maps', mapId)) {
      const name = data.get('maps', mapId)?.name;
      if (typeof name === 'string' && name) return name;
    }
  } catch { /* unknown table */ }
  return mapId.split(/[-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Slot id -> its label (`save.slot.manual` / `save.slot.auto`).
 * @param {{kind?: string, index?: number, slot?: string}} entry
 * @returns {string}
 */
export function slotLabel(entry) {
  const kind = entry?.kind ?? String(entry?.slot ?? '').split(':')[0];
  const index = entry?.index ?? Number(String(entry?.slot ?? '').split(':')[1]);
  return kind === 'auto' ? t('save.slot.auto', { n: index }) : t('save.slot.manual', { n: index });
}

/**
 * "n minutes ago" style age of a record.
 * @param {number|null} time
 * @param {number} now
 * @returns {string}
 */
export function ageText(time, now) {
  if (!Number.isFinite(time) || !Number.isFinite(now)) return '';
  const mins = Math.max(0, Math.floor((now - time) / 60000));
  if (mins < 1) return 'just now'; // str
  if (mins < 60) return `${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`; // str
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`; // str
  return `${Math.round(h / 24)} days ago`; // str
}

/**
 * @typedef {Object} SlotSummary
 * @property {string} slot  @property {'manual'|'auto'} kind  @property {number} index
 * @property {'ok'|'empty'|'corrupt'} state
 * @property {string} label   `Slot 1` / `Autosave 2`
 * @property {string} name    keeper name
 * @property {string} place   display place
 * @property {number} day     1-based GDD day
 * @property {string} time    `HH:MM`
 * @property {string} playTime
 * @property {Array<{speciesId: string, nick: string, level: number, mark: any, uid: string}>} party
 * @property {string} age     `5 minutes ago`
 * @property {number|null} savedAt
 * @property {string} seedCode  @property {string} dial
 * @property {string} [error]
 */

/**
 * The summary card of one slot: header fields from the `core/save` slot entry, party icons from the
 * loaded world when it is given (the record's summary carries only the lead's nickname).
 * @param {import('../core/save.js').SlotEntry} entry
 * @param {World|null} [world]
 * @param {any} [data]
 * @param {number} [now]
 * @returns {SlotSummary}
 */
export function slotSummary(entry, world = null, data = null, now = Date.now()) {
  const kind = entry?.kind === 'auto' ? 'auto' : 'manual';
  const s = entry?.summary ?? {};
  const base = {
    slot: entry?.slot ?? `${kind}:${entry?.index ?? 1}`,
    kind,
    index: entry?.index ?? 1,
    state: entry?.state ?? 'empty',
    label: slotLabel({ kind, index: entry?.index ?? 1 }),
    name: '', place: '', day: 0, time: '', playTime: '', party: [], age: '', savedAt: null, seedCode: '', dial: '',
  };
  if (base.state !== 'ok') return { ...base, error: entry?.error?.code ?? '' };
  const day = Number.isInteger(s.day) ? s.day + 1 : (world ? Math.floor((world.clock?.total ?? 0) / 1440) + 1 : 1);
  const party = (world?.party ?? []).map((c) => ({ speciesId: c.speciesId, nick: c.nickname, level: c.level, mark: c.mark, uid: c.uid }));
  return {
    ...base,
    name: s.name || world?.player?.name || '',
    place: placeName(s.place ?? world?.player?.mapId ?? '', data),
    day,
    time: typeof s.time === 'string' ? s.time : '',
    playTime: formatPlayTime(s.playMs ?? world?.stats?.playMs ?? 0),
    party,
    age: ageText(entry?.time ?? null, now),
    savedAt: Number.isFinite(entry?.time) ? entry.time : null,
    seedCode: s.seedCode ?? world?.run?.seedCode ?? '',
    dial: s.dial ?? world?.run?.dial ?? '',
  };
}

/**
 * The newest readable autosave among slot entries (the crash-resume target), or null.
 * @param {import('../core/save.js').SlotEntry[]} entries
 * @returns {import('../core/save.js').SlotEntry|null}
 */
export function newestAuto(entries) {
  let best = null;
  for (const e of entries ?? []) {
    if (e?.kind !== 'auto' || e.state !== 'ok') continue;
    if (!best || (e.seq ?? 0) > (best.seq ?? 0)) best = e;
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Settings (GDD-00 §15)
// ---------------------------------------------------------------------------------------------

/**
 * Settings the schema does not carry yet (GDD-09 §6 "request" rows). Until STATE adds them to
 * `world.settings` they live in a device-level mirror; the defaults here are GDD-09's.
 */
export const EXT_DEFAULTS = Object.freeze({
  battleSpeed: 2,
  fishingMode: 'standard',
  largeText: false,
  highContrast: false,
  clearVisuals: false,
  pathView: 'hold',
  ambience: 0.7,
  touchLayout: 'two',
  wakePoint: 'porch',
  autoAdvance: false,
  captions: true,
});

/** Accepted values of each extension setting. */
export const EXT_VALUES = Object.freeze({
  battleSpeed: Object.freeze([1, 2, 4]),
  fishingMode: Object.freeze(['standard', 'gentle', 'patient']),
  pathView: Object.freeze(['hold', 'toggle']),
  touchLayout: Object.freeze(['two', 'one']),
  wakePoint: Object.freeze(['porch', 'waystone']),
});

/**
 * Coerces an untrusted extension-settings object into a complete, valid one.
 * @param {unknown} raw
 * @returns {typeof EXT_DEFAULTS}
 */
export function normalizeExt(raw) {
  const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? /** @type {Record<string, any>} */ (raw) : {};
  /** @type {Record<string, any>} */
  const out = { ...EXT_DEFAULTS };
  for (const [k, list] of Object.entries(EXT_VALUES)) if (list.includes(p[k])) out[k] = p[k];
  for (const k of ['largeText', 'highContrast', 'clearVisuals', 'autoAdvance', 'captions']) if (typeof p[k] === 'boolean') out[k] = p[k];
  if (typeof p.ambience === 'number' && Number.isFinite(p.ambience)) out.ambience = Math.min(1, Math.max(0, p.ambience));
  return /** @type {any} */ (out);
}

/**
 * @typedef {Object} SettingRow
 * @property {string} id
 * @property {string} section    `settings.section.*` id
 * @property {string} label
 * @property {'choice'|'toggle'|'volume'|'action'} kind
 * @property {Array<{value: any, label: string}>} [options]   choice rows
 * @property {string} [note]     one line shown in the slip when focused
 * @property {string} [target]   where the value lives: 'world' (systems/settings) or 'ext'
 */

const ON_OFF = () => [{ value: false, label: t('common.off') }, { value: true, label: t('common.on') }];

/**
 * Every row of the Settings screen (GDD-00 §15), grouped by section, in display order.
 * @returns {SettingRow[]}
 */
export function settingRows() {
  return [
    { id: 'dayLength', section: 'time', label: t('settings.dayLength'), kind: 'choice', target: 'world',
      options: [12, 24, 48, 'real'].map((v) => ({ value: String(v), label: t(`settings.dayLength.${v}`) })),
      note: 'Real minutes per game day. The clock only runs in the field.' }, // str
    { id: 'textSpeed', section: 'text', label: t('settings.textSpeed'), kind: 'choice', target: 'world',
      options: ['slow', 'normal', 'fast', 'instant'].map((v) => ({ value: v, label: t(`settings.textSpeed.${v}`) })),
      note: 'Typewriter speed. Any press still finishes a line at once.' }, // str
    { id: 'autoAdvance', section: 'text', label: t('settings.autoAdvance'), kind: 'toggle', target: 'ext', options: ON_OFF(),
      note: 'Off: every line waits for you.' }, // str
    { id: 'battleSpeed', section: 'play', label: t('settings.battleSpeed'), kind: 'choice', target: 'ext',
      options: [1, 2, 4].map((v) => ({ value: v, label: t(`settings.battleSpeed.${v}`) })),
      note: 'Animation speed in battle. Music tempo never changes. 1 2 3 in battle too.' }, // str
    { id: 'fishingMode', section: 'play', label: t('settings.fishing'), kind: 'choice', target: 'ext',
      options: ['standard', 'gentle', 'patient'].map((v) => ({ value: v, label: t(`settings.fishing.${v}`) })),
      note: t('settings.fishingNote') },
    { id: 'wakePoint', section: 'play', label: t('settings.wakePoint'), kind: 'choice', target: 'ext',
      options: [{ value: 'porch', label: 'Your porch' }, { value: 'waystone', label: 'Last Waystone' }], // str
      note: 'Where Dimity carries you after a blackout. Nothing is lost but a few buttons.' }, // str
    { id: 'skipAnims', section: 'play', label: t('settings.skipAnims'), kind: 'toggle', target: 'world', options: ON_OFF(),
      note: 'Payment beads jump to the strike and the credits run at double speed.' }, // str
    { id: 'reducedMotion', section: 'sight', label: t('settings.reducedMotion'), kind: 'toggle', target: 'world', options: ON_OFF(),
      note: t('settings.reducedMotionNote') },
    { id: 'largeText', section: 'sight', label: t('settings.largeText'), kind: 'toggle', target: 'ext', options: ON_OFF(),
      note: 'Notes and descriptions draw twice as large.' }, // str
    { id: 'highContrast', section: 'sight', label: t('settings.highContrast'), kind: 'toggle', target: 'ext', options: ON_OFF(),
      note: 'Menus become cream on night ink with heavier edges.' }, // str
    { id: 'clearVisuals', section: 'sight', label: t('settings.clearVisuals'), kind: 'toggle', target: 'ext', options: ON_OFF(),
      note: t('settings.clearVisualsNote') },
    { id: 'scale', section: 'sight', label: t('settings.scale'), kind: 'choice', target: 'world',
      options: ['integer', 'fit'].map((v) => ({ value: v, label: t(`settings.scale.${v}`) })),
      note: 'Pixel-perfect keeps every pixel square; Fill the window uses all of the screen.' }, // str
    { id: 'fps30', section: 'sight', label: t('settings.fps30'), kind: 'toggle', target: 'world', options: ON_OFF(),
      note: 'The world draws at 30 frames a second; characters move the same. Takes hold at the next start.' }, // str
    { id: 'music', section: 'sound', label: t('settings.volume.music'), kind: 'volume', target: 'world', note: 'Left and right in steps of ten.' }, // str
    { id: 'sfx', section: 'sound', label: t('settings.volume.sfx'), kind: 'volume', target: 'world', note: 'Left and right in steps of ten.' }, // str
    { id: 'ambience', section: 'sound', label: t('settings.volume.ambience'), kind: 'volume', target: 'ext', note: 'Waves, wind, rain and the night bells.' }, // str
    { id: 'muted', section: 'sound', label: t('settings.mute'), kind: 'toggle', target: 'world', options: ON_OFF(), note: 'The 0 key toggles this anywhere.' }, // str
    { id: 'captions', section: 'sound', label: t('settings.captions'), kind: 'toggle', target: 'ext', options: ON_OFF(),
      note: 'Small chips name the bite, the bee hum, the mail, the hour and other sounds.' }, // str
    { id: 'pathView', section: 'controls', label: t('settings.pathView'), kind: 'choice', target: 'ext',
      options: ['hold', 'toggle'].map((v) => ({ value: v, label: t(`settings.pathView.${v}`) })),
      note: 'How the Read / Path view button behaves in the field.' }, // str
    { id: 'touchLayout', section: 'controls', label: t('settings.touchLayout'), kind: 'choice', target: 'ext',
      options: ['two', 'one'].map((v) => ({ value: v, label: t(`settings.touchLayout.${v}`) })),
      note: 'One-handed stacks A, B, ring and menu in a thumb arc on the right.' }, // str
    { id: 'remap', section: 'controls', label: t('settings.remap'), kind: 'action', note: 'Pick an action, then press the new key or button.' }, // str
  ];
}

/** Section ids in display order. */
export const SETTING_SECTIONS = Object.freeze(['time', 'text', 'play', 'sight', 'sound', 'controls']);

/**
 * The current value of a row.
 * @param {SettingRow} row
 * @param {Record<string, any>} settings  world.settings
 * @param {Record<string, any>} ext       normalized extension settings
 * @returns {any}
 */
export function rowValue(row, settings, ext) {
  const s = settings ?? {};
  switch (row.id) {
    case 'dayLength': {
      if (s.realClock === true) return 'real';
      const n = Number(s.minutesPerDay);
      return [12, 24, 48].includes(n) ? String(n) : '24';
    }
    case 'music': return Math.round((s.volumes?.music ?? 0.7) * 100);
    case 'sfx': return Math.round((s.volumes?.sfx ?? 0.9) * 100);
    case 'ambience': return Math.round(((Object.prototype.hasOwnProperty.call(s, 'volumes') && typeof s.volumes?.ambience === 'number') ? s.volumes.ambience : (ext?.ambience ?? 0.7)) * 100);
    default:
      if (row.target === 'world') return s[row.id];
      return Object.prototype.hasOwnProperty.call(s, row.id) ? s[row.id] : ext?.[row.id];
  }
}

/**
 * The label of a row's current value.
 * @param {SettingRow} row
 * @param {any} value
 * @returns {string}
 */
export function valueLabel(row, value) {
  if (row.kind === 'volume') return t('settings.volumeValue', { n: value });
  if (row.kind === 'action') return '';
  const opt = (row.options ?? []).find((o) => o.value === value);
  return opt ? opt.label : String(value ?? '');
}

/**
 * The value a left/right step moves a row to (choices clamp at the ends, toggles flip, volumes
 * step by 10 within 0..100).
 * @param {SettingRow} row
 * @param {any} value
 * @param {number} dir  -1 | 1
 * @returns {any}
 */
export function stepValue(row, value, dir) {
  if (row.kind === 'volume') return Math.max(0, Math.min(100, Math.round((Number(value) || 0) / 10) * 10 + (dir < 0 ? -10 : 10)));
  if (row.kind === 'toggle') return !value;
  if (row.kind === 'choice') {
    const opts = row.options ?? [];
    const i = opts.findIndex((o) => o.value === value);
    const j = Math.max(0, Math.min(opts.length - 1, (i < 0 ? 0 : i) + (dir < 0 ? -1 : 1)));
    return opts[j]?.value ?? value;
  }
  return value;
}

/**
 * The `systems/settings.update` patch for a world-backed row (null for ext rows).
 * @param {SettingRow} row
 * @param {any} value
 * @param {Record<string, any>} settings  current world.settings (for the volume block)
 * @returns {Record<string, any>|null}
 */
export function worldPatch(row, value, settings) {
  switch (row.id) {
    case 'dayLength': return value === 'real' ? { realClock: true } : { realClock: false, minutesPerDay: Number(value) };
    case 'music': return { volumes: { ...(settings?.volumes ?? {}), music: value / 100 } };
    case 'sfx': return { volumes: { ...(settings?.volumes ?? {}), sfx: value / 100 } };
    default: return row.target === 'world' ? { [row.id]: value } : null;
  }
}

// ---------------------------------------------------------------------------------------------
// Remap
// ---------------------------------------------------------------------------------------------

/** Actions offered on the remap page (directions first, then verbs). */
export const REMAP_ACTIONS = Object.freeze(['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu', 'start', 'run', 'tool', 'map', 'log', 'select', 'l', 'r']);

/**
 * Pairs that may share a token by design: Escape is both Back and Menu, Enter is both Confirm and
 * Menu, Start is both Menu and Pause (core/input DEFAULT_BINDINGS).
 */
export const SHARED_OK = Object.freeze([['cancel', 'menu'], ['confirm', 'menu'], ['menu', 'start']]);

/**
 * Whether two actions may share one token.
 * @param {string} a @param {string} b
 * @returns {boolean}
 */
export function mayShare(a, b) {
  return SHARED_OK.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * Device of an input token (mirrors core/input.tokenDevice without importing the DOM module).
 * @param {string} token
 * @returns {'keyboard'|'gamepad'|'touch'|null}
 */
export function deviceOf(token) {
  if (typeof token !== 'string' || !token) return null;
  if (token.startsWith('gp:')) return 'gamepad';
  if (token.startsWith('touch:')) return 'touch';
  return /^[A-Za-z][A-Za-z0-9]*$/.test(token) ? 'keyboard' : null;
}

/**
 * The first token an action has on a device, or null.
 * @param {Record<string, string[]>} bindings
 * @param {string} action
 * @param {'keyboard'|'gamepad'|'touch'} device
 * @returns {string|null}
 */
export function primaryToken(bindings, action, device) {
  return (bindings?.[action] ?? []).find((tok) => deviceOf(tok) === device) ?? null;
}

/**
 * Other actions that already use `token` and may not share it with `action`.
 * @param {Record<string, string[]>} bindings
 * @param {string} action
 * @param {string} token
 * @returns {string[]}
 */
export function remapConflicts(bindings, action, token) {
  const out = [];
  for (const [other, list] of Object.entries(bindings ?? {})) {
    if (other === action || !Array.isArray(list) || !list.includes(token)) continue;
    if (!mayShare(action, other)) out.push(other);
  }
  return out;
}

/**
 * The bindings after putting `token` in `action`'s primary slot for its device. With `swap`, every
 * conflicting action takes `action`'s old primary token in that place (or just loses `token` when
 * `action` had none on that device). Never leaves an action that had a token on that device
 * without one. Pure: returns a new table.
 * @param {Record<string, string[]>} bindings
 * @param {string} action
 * @param {string} token
 * @param {{swap?: boolean}} [opts]
 * @returns {Record<string, string[]>}
 */
export function remapped(bindings, action, token, opts = {}) {
  const dev = deviceOf(token);
  /** @type {Record<string, string[]>} */
  const next = {};
  for (const [k, v] of Object.entries(bindings ?? {})) next[k] = Array.isArray(v) ? v.slice() : [];
  if (!dev || !next[action]) return next;
  const old = primaryToken(next, action, dev);
  if (old === token) return next;
  const conflicts = remapConflicts(next, action, token);
  if (conflicts.length && !opts.swap) return next;
  for (const other of conflicts) {
    const list = next[other];
    const i = list.indexOf(token);
    if (old && !list.includes(old)) list.splice(i, 1, old);
    else list.splice(i, 1);
  }
  const mine = next[action];
  const at = old ? mine.indexOf(old) : -1;
  const dupe = mine.indexOf(token);
  if (dupe >= 0) mine.splice(dupe, 1);
  if (at >= 0) mine.splice(mine.indexOf(old), 1, token);
  else {
    const firstOfDev = mine.findIndex((tok) => deviceOf(tok) === dev);
    if (firstOfDev >= 0) mine.splice(firstOfDev, 0, token);
    else mine.push(token);
  }
  return next;
}

// ---------------------------------------------------------------------------------------------
// Field item effects
// ---------------------------------------------------------------------------------------------

/**
 * Whether a field effect (systems/bag.use) would do anything for a creature, and why not.
 * @param {Creature} c
 * @param {{kind: string, amount?: number|null, fraction?: number, statuses?: string[]}} effect
 * @returns {{ok: boolean, reason?: string}}
 */
export function effectFits(c, effect) {
  if (!c || !effect) return { ok: false, reason: 'nothing' };
  const max = c.stats?.hp ?? 0;
  const alive = (c.hp | 0) > 0;
  switch (effect.kind) {
    case 'heal': return !alive ? { ok: false, reason: 'resting' } : c.hp >= max ? { ok: false, reason: 'full' } : { ok: true };
    case 'revive': return alive ? { ok: false, reason: 'awake' } : { ok: true };
    case 'pp': return (c.moves ?? []).some((m) => m.pp < m.maxPp) ? { ok: true } : { ok: false, reason: 'full' };
    case 'cure': return c.status && (effect.statuses ?? []).includes(c.status.kind) ? { ok: true } : { ok: false, reason: 'no-status' };
    default: return { ok: false, reason: 'no-use' };
  }
}

/**
 * Applies a field effect to a creature (call inside a store tx). Returns what changed, or
 * `{ok: false}` with nothing touched when it would do nothing (so systems/bag.use spends nothing).
 * @param {Creature} c
 * @param {{kind: string, amount?: number|null, fraction?: number, statuses?: string[]}} effect
 * @returns {{ok: boolean, healed?: number, pp?: number, cured?: string|null, revived?: boolean}}
 */
export function applyFieldEffect(c, effect) {
  if (!effectFits(c, effect).ok) return { ok: false };
  const max = c.stats?.hp ?? 0;
  switch (effect.kind) {
    case 'heal': {
      const before = c.hp;
      c.hp = Math.min(max, c.hp + (Number.isInteger(effect.amount) ? effect.amount : max));
      return { ok: true, healed: c.hp - before };
    }
    case 'revive': {
      c.hp = Math.max(1, Math.floor(max * (typeof effect.fraction === 'number' ? effect.fraction : 0.5)));
      c.status = null;
      return { ok: true, revived: true, healed: c.hp };
    }
    case 'pp': {
      let n = 0;
      for (const m of c.moves) {
        const add = Math.min(m.maxPp - m.pp, Number.isInteger(effect.amount) ? effect.amount : m.maxPp);
        if (add > 0) { m.pp += add; n += add; }
      }
      return { ok: true, pp: n };
    }
    case 'cure': {
      const kind = c.status?.kind ?? null;
      c.status = null;
      return { ok: true, cured: kind };
    }
    default: return { ok: false };
  }
}

/**
 * The rows the save screen lists for a tab. Save: the three manual slots (none under No Rewind).
 * Load: a crash-resume row first when the last session did not exit cleanly and an autosave
 * exists, then the manual slots (none under No Rewind), then the autosaves (only the first under No
 * Rewind). Entries keep their `core/save` order (manual first, index order).
 * @param {import('../core/save.js').SlotEntry[]} entries   `persist.list({all: true})`
 * @param {{tab: 'save'|'load', noRewind?: boolean, crashed?: boolean}} opts
 * @returns {Array<{kind: 'resume'|'slot', entry: import('../core/save.js').SlotEntry, latest: boolean}>}
 */
export function slotRows(entries, opts) {
  const list = Array.isArray(entries) ? entries : [];
  const newest = list.filter((e) => e?.state === 'ok').reduce((b, e) => (!b || (e.seq ?? 0) > (b.seq ?? 0) ? e : b), null);
  const row = (e) => ({ kind: /** @type {'slot'} */ ('slot'), entry: e, latest: !!newest && e.slot === newest.slot });
  const manual = list.filter((e) => e?.kind === 'manual');
  const auto = list.filter((e) => e?.kind === 'auto' && (!opts.noRewind || e.index === 1));
  if (opts.tab === 'save') return opts.noRewind ? [] : manual.map(row);
  const out = [];
  const resume = opts.crashed ? newestAuto(auto) : null;
  if (resume) out.push({ kind: 'resume', entry: resume, latest: false });
  if (!opts.noRewind) out.push(...manual.map(row));
  out.push(...auto.map(row));
  return out;
}

/**
 * Words for a save / load error code (core/save ERROR_CODES + persist's).
 * @param {{code?: string, message?: string}|null|undefined} error
 * @returns {string}
 */
export function saveErrorText(error) {
  const code = error?.code ?? 'unknown';
  switch (code) {
    case 'quota': return t('error.storageFull');
    case 'storage': return t('banner.offline');
    case 'corrupt': return t('save.corrupt');
    case 'version': return t('save.newer');
    case 'empty': return 'That slot is empty.'; // str
    case 'busy': return 'Not now: try again in a moment.'; // str
    case 'invalid-world': return 'Something in this season would not check out, so nothing was written.'; // str
    case 'format': return 'That is not a save string.'; // str
    case 'verify': return 'The write did not read back the same. Nothing was lost.'; // str
    default: return t('save.fail', { code });
  }
}
