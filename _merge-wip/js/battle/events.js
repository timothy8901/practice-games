/**
 * The battle event contract: every event the engine emits, with its fields.
 * `scenes/battle.js` animates these (BATTLE_ANIMS is keyed by `type`), the
 * audio sfx map listens to them, and tests check every emitted event against
 * {@link EVENT_FIELDS} with {@link checkEvent}. [BATTLE-RULES]
 *
 * Every event is a plain JSON-safe object with a `type`. Most carry `side`
 * (0 = player, 1 = foe; the side the event is *about* unless noted) and a
 * ready-to-show `text` line. Creature names are display names, never ids;
 * `uid` fields carry ids.
 *
 * Pure: data and checks only.
 * @module battle/events
 */

/** Battle outcomes (`end.outcome` and `result().outcome`). */
export const OUTCOMES = Object.freeze(['win', 'loss', 'capture', 'run', 'holdout', 'draw']);
/** `blocked.reason` values. */
export const BLOCK_REASONS = Object.freeze(['ward', 'immune', 'guard', 'consecutive-guard', 'hp-full', 'no-mends', 'heal-pending', 'sodden']);
/** `status.action` values. */
export const STATUS_ACTIONS = Object.freeze(['inflict', 'already', 'immune', 'tick', 'cure', 'cant-move']);
/** `status.kind` values (the move status kinds plus `flinch`). */
export const STATUS_EVENT_KINDS = Object.freeze(['burn', 'poison', 'chill', 'numb', 'trap', 'flinch']);
/** `stat.result` values. */
export const STAT_RESULTS = Object.freeze(['raised', 'lowered', 'capped', 'blocked', 'cleared', 'cleared-raised', 'none']);
/** `damage.source` values: a party hit, the user's own cost (Scrap, self-KO) or status chip. */
export const DAMAGE_SOURCES = Object.freeze(['party', 'self', 'status']);
/** `exp.share` values. */
export const EXP_SHARES = Object.freeze(['battler', 'bench', 'sibling', 'yard']);

/**
 * Required fields per event type, as `field: kind` where kind is one of
 * 'number' | 'string' | 'boolean' | 'side' | 'array' | 'object' | 'any' | '?<kind>' (nullable).
 * Optional fields are documented in the typedefs below and not listed here.
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const EVENT_FIELDS = Object.freeze({
  message: Object.freeze({ text: 'string' }),
  turn: Object.freeze({ n: 'number' }),
  switch: Object.freeze({ side: 'side', from: 'string', to: 'string', text: 'string' }),
  move: Object.freeze({ side: 'side', user: 'string', move: 'string', moveName: 'string', moveType: '?string', category: 'string', pp: '?number', text: 'string' }),
  charge: Object.freeze({ side: 'side', user: 'string', move: 'string', moveName: 'string', text: 'string' }),
  miss: Object.freeze({ side: 'side', user: 'string', target: 'string', text: 'string' }),
  decoy: Object.freeze({ side: 'side', who: 'string', count: 'number', text: 'string' }),
  'decoy-pop': Object.freeze({ side: 'side', target: 'string', popped: 'number', remaining: 'number', text: 'string' }),
  guard: Object.freeze({ side: 'side', who: 'string', text: 'string' }),
  blocked: Object.freeze({ side: 'side', target: 'string', reason: 'string', text: 'string' }),
  'ward-readout': Object.freeze({
    side: 'side', target: 'string', targetTypes: 'array', ward: 'string', wardId: 'string', wardKind: 'string', canLand: 'array',
    outOfPp: 'array', types: 'array', indirect: 'array', chip: 'array', crackdust: 'boolean', text: 'string',
  }),
  effectiveness: Object.freeze({ side: 'side', target: 'string', word: 'string', mult: 'number' }),
  damage: Object.freeze({ side: 'side', target: 'string', amount: 'number', hp: 'number', maxHp: 'number', source: 'string', stanceFloor: 'boolean' }),
  crit: Object.freeze({ side: 'side', target: 'string', text: 'string' }),
  faint: Object.freeze({ side: 'side', target: 'string', text: 'string' }),
  status: Object.freeze({ side: 'side', target: 'string', kind: 'string', action: 'string', text: 'string' }),
  stat: Object.freeze({ side: 'side', target: 'string', stat: 'string', stages: 'number', result: 'string', text: 'string' }),
  heal: Object.freeze({ side: 'side', target: 'string', amount: 'number', hp: 'number', maxHp: 'number', source: 'string', text: 'string' }),
  'mend-spent': Object.freeze({ side: 'side', user: 'string', remaining: 'number', text: 'string' }),
  'mend-pending': Object.freeze({ side: 'side', user: 'string', turns: 'number', text: 'string' }),
  'mend-cancelled': Object.freeze({ side: 'side', target: 'string', text: 'string' }),
  ability: Object.freeze({ side: 'side', who: 'string', ability: 'string', text: 'string' }),
  glint: Object.freeze({ side: 'side', who: 'string', text: 'string' }),
  'scrap-cost': Object.freeze({ side: 'side', user: 'string', amount: 'number', text: 'string' }),
  read: Object.freeze({ side: 'side', target: 'string', source: 'string', info: 'object', text: 'string' }),
  reveal: Object.freeze({ side: 'side', target: 'string', source: 'string', moves: 'array', text: 'string' }),
  'capture-shake': Object.freeze({ side: 'side', target: 'string', grade: 'any', odds: '?number', band: 'string', segments: 'number', success: 'boolean', text: 'string' }),
  capture: Object.freeze({ side: 'side', speciesId: 'string', name: 'string', text: 'string' }),
  'capture-fail': Object.freeze({ side: 'side', target: 'string', fails: 'number', nextOdds: '?number', nextBand: 'string', text: 'string' }),
  run: Object.freeze({ side: 'side', success: 'boolean', text: 'string' }),
  stance: Object.freeze({ on: 'boolean', text: 'string' }),
  item: Object.freeze({ side: 'side', item: 'string', text: 'string' }),
  'ward-suppressed': Object.freeze({ side: 'side', target: 'string', turns: 'number', text: 'string' }),
  'type-shift': Object.freeze({ side: 'side', who: 'string', current: 'string', next: 'array', text: 'string' }),
  exp: Object.freeze({ creature: 'string', uid: 'any', amount: 'number', share: 'string', text: 'string' }),
  levelup: Object.freeze({ creature: 'string', uid: 'any', from: 'number', to: 'number', stats: 'object', text: 'string' }),
  learn: Object.freeze({ creature: 'string', uid: 'any', move: 'string', text: 'string' }),
  'learn-offer': Object.freeze({ creature: 'string', uid: 'any', move: 'string', text: 'string' }),
  payout: Object.freeze({ amount: 'number', text: 'string' }),
  blackout: Object.freeze({ cost: 'number', summit: 'boolean', text: 'string' }),
  'replace-needed': Object.freeze({ side: 'side', text: 'string' }),
  end: Object.freeze({ outcome: 'string', winner: '?side', text: 'string' }),
});

/** Every event type, in the order above (the keys of {@link EVENT_FIELDS}). */
export const EVENT_TYPES = Object.freeze(Object.keys(EVENT_FIELDS));

/** Enumerated field values checked by {@link checkEvent}. */
const ENUMS = Object.freeze({
  'blocked.reason': BLOCK_REASONS,
  'status.action': STATUS_ACTIONS,
  'status.kind': STATUS_EVENT_KINDS,
  'stat.result': STAT_RESULTS,
  'damage.source': DAMAGE_SOURCES,
  'exp.share': EXP_SHARES,
  'end.outcome': OUTCOMES,
});

/**
 * @param {string} type
 * @returns {boolean} whether `type` is a known event type
 */
export function isEventType(type) {
  return Object.prototype.hasOwnProperty.call(EVENT_FIELDS, type);
}

/**
 * Checks one event against the contract.
 * @param {any} ev
 * @returns {string[]} problems; empty = valid
 */
export function checkEvent(ev) {
  if (!ev || typeof ev !== 'object') return ['event is not an object'];
  if (!isEventType(ev.type)) return [`unknown event type ${JSON.stringify(ev.type)}`];
  const out = [];
  for (const [field, spec] of Object.entries(EVENT_FIELDS[ev.type])) {
    const nullable = spec.startsWith('?');
    const kind = nullable ? spec.slice(1) : spec;
    const v = ev[field];
    if (v === undefined) {
      out.push(`${ev.type}: missing ${field}`);
      continue;
    }
    if (v === null) {
      if (!nullable) out.push(`${ev.type}.${field} is null`);
      continue;
    }
    let ok = true;
    switch (kind) {
      case 'number': ok = typeof v === 'number' && Number.isFinite(v); break;
      case 'string': ok = typeof v === 'string'; break;
      case 'boolean': ok = typeof v === 'boolean'; break;
      case 'side': ok = v === 0 || v === 1; break;
      case 'array': ok = Array.isArray(v); break;
      case 'object': ok = typeof v === 'object' && !Array.isArray(v); break;
      default: ok = true;
    }
    if (!ok) out.push(`${ev.type}.${field} should be ${spec}, got ${JSON.stringify(v)}`);
    const allowed = ENUMS[`${ev.type}.${field}`];
    if (ok && allowed && !allowed.includes(v)) out.push(`${ev.type}.${field}: unknown value ${JSON.stringify(v)}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Typedefs (documentation of the contract; optional fields marked [opt])
// ---------------------------------------------------------------------------

/** @typedef {0|1} Side */
/** @typedef {{type: 'message', text: string, side?: Side}} MessageEvent */
/** @typedef {{type: 'turn', n: number}} TurnEvent */
/** @typedef {{type: 'switch', side: Side, from: string, to: string, text: string}} SwitchEvent */
/** @typedef {{type: 'move', side: Side, user: string, move: string, moveName: string, moveType: string|null, category: string, pp: number|null, text: string}} MoveEvent  pp left after use; null for Scrap / a charged release */
/** @typedef {{type: 'charge', side: Side, user: string, move: string, moveName: string, text: string}} ChargeEvent  braced; the move fires next turn */
/** @typedef {{type: 'miss', side: Side, user: string, target: string, text: string}} MissEvent  side = attacker */
/** @typedef {{type: 'decoy', side: Side, who: string, count: number, text: string}} DecoyEvent */
/** @typedef {{type: 'decoy-pop', side: Side, target: string, popped: number, remaining: number, text: string}} DecoyPopEvent  side = decoy owner */
/** @typedef {{type: 'guard', side: Side, who: string, text: string}} GuardEvent */
/** @typedef {{type: 'blocked', side: Side, target: string, reason: string, text: string, ward?: string}} BlockedEvent  side = acting side; reason ∈ BLOCK_REASONS */
/**
 * @typedef {{type: 'ward-readout', side: Side, target: string, targetTypes: string[], ward: string, wardId: string, wardKind: string,
 *   canLand: Array<{creature: string, uid: any, move: string, moveName: string, type: string|null, pp: number}>,
 *   outOfPp: Array<{creature: string, uid: any, move: string, moveName: string, type: string|null, pp: number}>,
 *   types: string[], indirect: string[], chip: Array<{creature: string, uid: any, move: string, moveName: string, kind: string, pp: number}>,
 *   crackdust: boolean, text: string}} WardReadoutEvent  side = the side whose hit was blocked
 */
/** @typedef {{type: 'effectiveness', side: Side, target: string, word: string, mult: number, text?: string|null}} EffectivenessEvent  side = attacker */
/** @typedef {{type: 'damage', side: Side, target: string, amount: number, hp: number, maxHp: number, source: 'party'|'self'|'status', stanceFloor: boolean}} DamageEvent  side = the damaged side */
/** @typedef {{type: 'crit', side: Side, target: string, text: string}} CritEvent  side = attacker */
/** @typedef {{type: 'faint', side: Side, target: string, text: string}} FaintEvent */
/** @typedef {{type: 'status', side: Side, target: string, kind: string, action: string, text: string, turns?: number}} StatusEvent */
/** @typedef {{type: 'stat', side: Side, target: string, stat: string, stages: number, result: string, text: string, stage?: number, reason?: string}} StatEvent  stat 'all' for clears */
/** @typedef {{type: 'heal', side: Side, target: string, amount: number, hp: number, maxHp: number, source: string, text: string}} HealEvent  source = move id, ability id or 'item' */
/** @typedef {{type: 'mend-spent', side: Side, user: string, remaining: number, text: string}} MendSpentEvent */
/** @typedef {{type: 'mend-pending', side: Side, user: string, turns: number, text: string}} MendPendingEvent */
/** @typedef {{type: 'mend-cancelled', side: Side, target: string, text: string}} MendCancelledEvent */
/** @typedef {{type: 'ability', side: Side, who: string, ability: string, text: string}} AbilityEvent  ability = display name */
/** @typedef {{type: 'glint', side: Side, who: string, text: string}} GlintEvent  the coming hit will crit */
/** @typedef {{type: 'scrap-cost', side: Side, user: string, amount: number, text: string}} ScrapCostEvent */
/** @typedef {{type: 'read', side: Side, target: string, source: string, info: import('./read.js').ReadInfo, text: string}} ReadEvent  side = reader */
/** @typedef {{type: 'reveal', side: Side, target: string, source: string, moves: string[], text: string}} RevealEvent */
/** @typedef {{type: 'capture-shake', side: Side, target: string, grade: number|string, odds: number|null, band: string, segments: number, success: boolean, text: string}} CaptureShakeEvent  odds null on a bands dial */
/** @typedef {{type: 'capture', side: Side, speciesId: string, name: string, text: string}} CaptureEvent */
/** @typedef {{type: 'capture-fail', side: Side, target: string, fails: number, nextOdds: number|null, nextBand: string, text: string}} CaptureFailEvent */
/** @typedef {{type: 'run', side: Side, success: boolean, text: string}} RunEvent */
/** @typedef {{type: 'stance', on: boolean, text: string}} StanceEvent */
/** @typedef {{type: 'item', side: Side, item: string, text: string}} ItemEvent */
/** @typedef {{type: 'ward-suppressed', side: Side, target: string, turns: number, text: string}} WardSuppressedEvent  side = the Ward holder */
/** @typedef {{type: 'type-shift', side: Side, who: string, current: string, next: string[], text: string}} TypeShiftEvent */
/** @typedef {{type: 'exp', creature: string, uid: any, amount: number, share: 'battler'|'bench'|'sibling'|'yard', text: string}} ExpEvent */
/** @typedef {{type: 'levelup', creature: string, uid: any, from: number, to: number, stats: Record<string, number>, text: string}} LevelUpEvent */
/** @typedef {{type: 'learn', creature: string, uid: any, move: string, text: string}} LearnEvent */
/** @typedef {{type: 'learn-offer', creature: string, uid: any, move: string, text: string}} LearnOfferEvent  slots full; the UI resolves */
/** @typedef {{type: 'payout', amount: number, text: string}} PayoutEvent */
/** @typedef {{type: 'blackout', cost: number, summit: boolean, text: string}} BlackoutEvent */
/** @typedef {{type: 'replace-needed', side: Side, text: string}} ReplaceNeededEvent */
/** @typedef {{type: 'end', outcome: string, winner: Side|null, text: string}} EndEvent */

/**
 * Any battle event.
 * @typedef {MessageEvent|TurnEvent|SwitchEvent|MoveEvent|ChargeEvent|MissEvent|DecoyEvent|DecoyPopEvent|GuardEvent|BlockedEvent|
 *   WardReadoutEvent|EffectivenessEvent|DamageEvent|CritEvent|FaintEvent|StatusEvent|StatEvent|HealEvent|MendSpentEvent|MendPendingEvent|
 *   MendCancelledEvent|AbilityEvent|GlintEvent|ScrapCostEvent|ReadEvent|RevealEvent|CaptureShakeEvent|CaptureEvent|CaptureFailEvent|
 *   RunEvent|StanceEvent|ItemEvent|WardSuppressedEvent|TypeShiftEvent|ExpEvent|LevelUpEvent|LearnEvent|LearnOfferEvent|PayoutEvent|
 *   BlackoutEvent|ReplaceNeededEvent|EndEvent} BattleEvent
 */
