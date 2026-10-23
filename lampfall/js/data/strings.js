/**
 * UI strings and templates: `t('loan.paid', {n})`. [DATA-IDX]
 *
 * Every piece of player-facing UI copy goes through here so a later pass can rewrite tone, add a
 * language or rename a currency without touching a scene. Templates use `{name}` placeholders;
 * `{n|stick|sticks}` picks the singular when `n === 1`. A missing key renders as `[key]` and never
 * throws, so a typo shows in play instead of crashing it.
 * @module data/strings
 */

// [GDD] Currency and place names below are placeholders until the panel names them (§15.4).
/** @type {Readonly<Record<string, string>>} */
export const STRINGS = Object.freeze({
  'game.title': 'GAME',                                   // [GDD]
  'currency.main': 'coin',                                // [GDD]
  'currency.main.plural': 'coins',                        // [GDD]
  'currency.starsalt': 'starsalt',                        // [GDD]
  'currency.anchors': 'anchors',                          // [GDD]
  'wallet.main': '{n} {n|coin|coins}',
  'loan.paid': 'Paid {n} toward the roof.',
  'loan.tier': 'Tier {tier} cleared.',
  'loan.remaining': '{n} to go.',
  'letter.arrived': 'A letter is in the mailbox.',
  'letter.read': 'Letter {n} read.',
  'bag.full': 'No room in the {pocket} pocket.',
  'bag.got': 'Got {n} x {item}.',
  'bag.lost': 'Handed over {n} x {item}.',
  'shop.closed': 'Closed. Open {open}-{close}.',
  'shop.wanted': 'Wanted today: {item}',
  'tide.low': 'low tide',
  'tide.rising': 'rising',
  'tide.high': 'high tide',
  'tide.falling': 'falling',
  'tide.lowIn': 'low in {n}m',
  'tide.highIn': 'high in {n}m',
  'verb.talk': 'Talk',
  'verb.read': 'Read',
  'verb.pickUp': 'Pick up',
  'verb.shake': 'Shake',
  'verb.dig': 'Dig',
  'verb.fish': 'Fish',
  'verb.look': 'Look',
  'verb.catch': 'Catch',
  'verb.needsTool': 'Needs a {tool}',
  'shift.window': '{nick} is ready to Shift.',
  'shift.accepted': '{nick} became {form}.',
  'shift.anchored': '{nick} held fast.',
  'capture.ok': 'Caught {name}!',
  'capture.fail': '{name} slipped away.',
  'battle.blackout': 'Everything went dark. {n} {n|coin|coins} lost.',
  'save.ok': 'Saved.',
  'save.fail': 'Save failed: {code}',
  'save.resume': 'Resume from autosave: {place}, {n} {n|minute|minutes} ago',
  'menu.party': 'Party',
  'menu.bag': 'Bag',
  'menu.fieldLog': 'Field Log',
  'menu.map': 'Map',
  'menu.ledger': 'Ledger',
  'menu.settings': 'Settings',
  'menu.save': 'Save',
  'confirm.yes': 'Yes',
  'confirm.no': 'No',
  'confirm.oneOfAKind': 'Use the {item}? There is only one.',
  'day.page': 'Day {n}',
  'npc.default': '...',
});

/**
 * Looks a key up and fills its placeholders.
 * @param {string} key
 * @param {Record<string, any>} [vars]
 * @returns {string} the filled template, or `[key]` when the key is unknown
 */
export function t(key, vars = {}) {
  const tpl = STRINGS[key];
  if (tpl === undefined) return `[${key}]`;
  return fill(tpl, vars);
}

/**
 * Whether a key exists.
 * @param {string} key
 * @returns {boolean}
 */
export function has(key) {
  return Object.prototype.hasOwnProperty.call(STRINGS, key);
}

/**
 * Fills `{name}` and `{name|one|many}` placeholders in any template string. Unknown names are left
 * as written so a missing variable is visible.
 * @param {string} tpl
 * @param {Record<string, any>} [vars]
 * @returns {string}
 */
export function fill(tpl, vars = {}) {
  return String(tpl).replace(/\{([a-zA-Z0-9_.:-]+)(?:\|([^|}]*)\|([^}]*))?\}/g, (m, name, one, many) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return m;
    const v = vars[name];
    if (one !== undefined) return Number(v) === 1 ? one : many;
    return v === null || v === undefined ? '' : String(v);
  });
}

/**
 * Picks a singular or plural word.
 * @param {number} n
 * @param {string} one
 * @param {string} many
 * @returns {string}
 */
export function plural(n, one, many) {
  return n === 1 ? one : many;
}
