// GDD-09 presentation: js/data/strings.js (keys, vars, confirms, glyphs, code references) and
// js/data/credits.js (roll rows, validator, manifest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STRINGS, VARS, CONFIRMS, t, has, fill, plural, varsOf, confirmSpec } from '../js/data/strings.js';
import { CREDITS } from '../js/data/credits.js';
import { DATA } from '../js/data/index.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import * as M from '../js/data/ids.manifest.js';
import { hasGlyph, normalizeText } from '../js/core/font.js';
import { ACTIONS } from '../js/core/input.js';
import { WARP_REASONS } from '../js/world/warps.js';
import { VERB_LABELS } from '../js/world/interact.js';
import { CURRENCIES } from '../js/systems/wallet.js';
import { MENU_ITEMS } from '../js/scenes/menu.js';
import { STRINGS as THEME_STRINGS, TYPE_CHIPS } from '../js/ui/theme.js';
import { WORDS } from '../js/battle/effects.js';
import { BLOCK_REASONS, OUTCOMES, STATUS_EVENT_KINDS } from '../js/battle/events.js';
import { TEXT_SPEEDS, POCKET_IDS, SCALE_MODES } from '../js/state/schema.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STRINGS_SRC = readFileSync(join(ROOT, 'js/data/strings.js'), 'utf8');
const KEYS = Object.keys(STRINGS);

/** Keys written in the STRINGS literal, in source order (duplicates survive here, not in the object). */
function sourceKeys() {
  const start = STRINGS_SRC.indexOf('export const STRINGS = Object.freeze({');
  const end = STRINGS_SRC.indexOf('\n});', start);
  assert.ok(start >= 0 && end > start, 'STRINGS literal found');
  const body = STRINGS_SRC.slice(start, end);
  return [...body.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]);
}

// ---- strings: shape -------------------------------------------------------------------------

test('strings: no duplicate keys in the source literal', () => {
  const keys = sourceKeys();
  const seen = new Set();
  const dups = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
  assert.deepEqual(dups, []);
  assert.equal(keys.length, KEYS.length, 'every source key is in STRINGS');
});

test('strings: hierarchical keys, non-empty values, frozen tables', () => {
  assert.ok(Object.isFrozen(STRINGS) && Object.isFrozen(VARS) && Object.isFrozen(CONFIRMS));
  const KEY_RE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;
  for (const [k, v] of Object.entries(STRINGS)) {
    assert.match(k, KEY_RE, `key ${k}`);
    assert.equal(typeof v, 'string', k);
    assert.ok(v.trim().length > 0, `${k} is empty`);
    assert.equal(v, v.trim(), `${k} has stray whitespace`);
  }
  assert.ok(KEYS.length >= 600, `a full UI glossary (${KEYS.length} keys)`);
});

test('strings: every {var} is documented in VARS and every VARS entry is used', () => {
  const used = new Set();
  for (const [k, v] of Object.entries(STRINGS)) {
    for (const name of varsOf(v)) {
      used.add(name);
      assert.ok(Object.hasOwn(VARS, name), `${k}: {${name}} is not documented in VARS`);
    }
  }
  for (const name of Object.keys(VARS)) {
    assert.ok(used.has(name), `VARS.${name} is documented but unused`);
    assert.ok(VARS[name].length > 0);
  }
});

test('strings: placeholders are well-formed (balanced braces, plural forms with two words)', () => {
  for (const [k, v] of Object.entries(STRINGS)) {
    const stripped = v.replace(/\{[a-zA-Z0-9_.:-]+(?:\|[^|{}]+\|[^|{}]+)?\}/g, '');
    assert.ok(!/[{}]/.test(stripped), `${k}: malformed placeholder in "${v}"`);
    for (const m of v.matchAll(/\{([a-zA-Z0-9_]+)\|([^|}]*)\|([^}]*)\}/g)) {
      assert.ok(m[2].length > 0 && m[3].length > 0, `${k}: plural needs both forms`);
    }
  }
});

test('strings: no placeholder text, TODOs or borrowed IP', () => {
  const BAD = /PLACEHOLDER|TODO|TBD|FIXME|\[GDD\]|lorem|ipsum|Pok[eé]|Nintendo|Animal Crossing|Pikachu|Game ?Freak|Nook|Bells\b/i;
  for (const [k, v] of Object.entries(STRINGS)) assert.ok(!BAD.test(v), `${k}: "${v}"`);
  assert.ok(!/TODO|PLACEHOLDER|\[GDD\]/.test(STRINGS_SRC), 'source is clean');
});

test('strings: every character is drawable by the 5x7 face', () => {
  for (const [k, v] of Object.entries(STRINGS)) {
    for (const ch of normalizeText(v)) {
      if (ch === ' ' || ch === '\n') continue;
      assert.ok(hasGlyph(ch, 'main'), `${k}: '${ch}' has no glyph`);
    }
  }
});

test('strings: GDD-00 terms (title, buttons, Starsalt, anchor stones, effectiveness words)', () => {
  assert.equal(t('game.title'), 'Lampfall');
  assert.equal(t('game.tagline'), "Read the odds. Pay what's owed. Keep the light.");
  assert.equal(t('wallet.main', { n: 1 }), '1 button');
  assert.equal(t('wallet.main', { n: 3 }), '3 buttons');
  assert.equal(t('currency.main.symbol'), '◉');
  assert.equal(t('currency.starsalt'), 'Starsalt');
  assert.equal(t('wallet.anchors', { n: 2 }), '2 anchor stones');
  assert.equal(t('day.tomorrow'), 'Tomorrow:');
  assert.equal(t('day.saved'), 'Saved, verified');
  assert.equal(t('save.notSaved'), 'Not saved');
  assert.equal(t('rest.tooEarly'), "Too early. Someone's always buying.");
  assert.equal(t('tide.wade'), 'The sea came up. You waded.');
  assert.equal(t('forecast.litCoast'), 'Lit coast: steadied');
  assert.equal(t('battle.errant'), 'Errant. Enter Capture Stance?');
  assert.equal(t('party.heldByKnot'), 'Held by Still Knot');
  assert.equal(t('lease.name.default'), 'Sorrel');
  assert.equal(t('lease.town.default'), 'Pellwick');
  assert.equal(t('dial.question'), 'How do you like your odds?');
  // the engine's effectiveness words are the UI's words, exactly
  assert.equal(t('battle.eff.strong'), WORDS.STRONG);
  assert.equal(t('battle.eff.neutral'), WORDS.NEUTRAL);
  assert.equal(t('battle.eff.weak'), WORDS.WEAK);
  assert.equal(t('battle.eff.blocked'), WORDS.BLOCKED);
  // Freefall capture bands (GDD-00 §8)
  assert.deepEqual(['slim', 'fair', 'good', 'sure'].map((b) => t(`capture.band.${b}`)), ['Slim', 'Fair', 'Good', 'Sure']);
  // no currency other than buttons, no "glint" for sparkles
  for (const [k, v] of Object.entries(STRINGS)) {
    assert.ok(!/\bcoins?\b/i.test(v), `${k}: coins are buttons`);
    assert.ok(!/\bglints\b/i.test(v), `${k}: low-tide finds are sparkles`);
  }
});

test('strings: the Ward readout templates cover every line the engine writes', () => {
  const vars = { ward: 'Glasshide', power: 40, moves: "PUDDLE's Tidepull", types: 'Kiln, Bolt', kinds: 'poison, burn, trap', n: 2 };
  assert.equal(t('battle.ward.strongOnly', vars), 'Glasshide held. Only Strong hits get through.');
  assert.equal(t('battle.ward.minPower', vars), 'Glasshide held. Hits under 40 power do nothing.');
  assert.equal(t('battle.ward.noStatus', vars), 'Glasshide held. Status techniques fail against it.');
  assert.equal(t('battle.ward.canLand', vars), "Can land: PUDDLE's Tidepull.");
  assert.equal(t('battle.ward.types', vars), 'Types that get through: Kiln, Bolt.');
  assert.equal(t('battle.ward.indirect', vars), 'Indirect damage that works: poison, burn, trap.');
  assert.equal(t('battle.ward.crackdust', vars), 'You carry Crackdust (2).');
  for (const k of ['held', 'nothingLands', 'outOfPp', 'noTypes', 'chip', 'entry']) assert.ok(has(`battle.ward.${k}`), k);
});

// ---- strings: the existing API stays ----------------------------------------------------------

test('strings: t / has / fill / plural keep their contract', () => {
  assert.equal(t('no.such.key'), '[no.such.key]');
  assert.equal(t('bag.got', { n: 2 }), 'Got 2 x {item}.');
  assert.equal(t('loan.tier', { tier: 2 }), 'Tier 2 cleared.');
  assert.ok(has('save.ok') && !has('nope'));
  assert.equal(fill('{a}-{b}', { a: 'x', b: null }), 'x-');
  assert.equal(fill('{n|stick|sticks}', { n: 1 }), 'stick');
  assert.equal(plural(1, 'boat', 'boats'), 'boat');
  assert.deepEqual(varsOf('{n} {n|a|b} {item}'), ['n', 'item']);
});

test('strings: every key the day-1 file shipped is still present', () => {
  const DAY1 = ['game.title', 'currency.main', 'currency.main.plural', 'currency.starsalt', 'currency.anchors', 'wallet.main',
    'loan.paid', 'loan.tier', 'loan.remaining', 'letter.arrived', 'letter.read', 'bag.full', 'bag.got', 'bag.lost', 'shop.closed',
    'shop.wanted', 'tide.low', 'tide.rising', 'tide.high', 'tide.falling', 'tide.lowIn', 'tide.highIn', 'verb.talk', 'verb.read',
    'verb.pickUp', 'verb.shake', 'verb.dig', 'verb.fish', 'verb.look', 'verb.catch', 'verb.needsTool', 'shift.window',
    'shift.accepted', 'shift.anchored', 'capture.ok', 'capture.fail', 'battle.blackout', 'save.ok', 'save.fail', 'save.resume',
    'menu.party', 'menu.bag', 'menu.fieldLog', 'menu.map', 'menu.ledger', 'menu.settings', 'menu.save', 'confirm.yes',
    'confirm.no', 'confirm.oneOfAKind', 'day.page', 'npc.default'];
  for (const k of DAY1) assert.ok(has(k), k);
});

// ---- strings: everything the code references exists -----------------------------------------

/** @param {string} dir @returns {string[]} */
function jsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

test('strings: every literal t()/has() key in js/ that imports strings.js exists', () => {
  const missing = [];
  let checked = 0;
  for (const file of jsFiles(join(ROOT, 'js'))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (rel === 'js/data/strings.js') continue;
    const src = readFileSync(file, 'utf8');
    if (!/from\s+['"][./]*(?:data\/)?strings\.js['"]/.test(src)) continue;
    for (const m of src.matchAll(/(?<![.\w$])(?:t|has)\(\s*(['"])([a-zA-Z][\w.-]*)\1/g)) {
      checked++;
      if (!has(m[2])) missing.push(`${rel}: ${m[2]}`);
    }
  }
  assert.deepEqual(missing, []);
  assert.ok(checked >= 1, 'at least one call site scanned');
});

test('strings: key families the engine and UI build dynamically all exist', () => {
  const need = [];
  for (const r of WARP_REASONS) need.push(`warp.${r}`);
  for (const v of Object.keys(VERB_LABELS)) need.push(`verb.${v}`);
  for (const k of ['paid', 'none', 'day', 'days', 'long']) need.push(`loan.pace.${k}`);
  for (const c of CURRENCIES) need.push(`currency.${c}`);
  for (const it of MENU_ITEMS) need.push(`menu.${it.scene === 'mapScreen' ? 'map' : it.scene === 'saveLoad' ? 'save' : it.scene}`);
  for (const k of Object.keys(THEME_STRINGS)) need.push(`ui.${k}`);
  for (const r of BLOCK_REASONS) need.push(`battle.blocked.${r}`);
  for (const o of OUTCOMES) need.push(`battle.end.${o}`);
  for (const s of STATUS_EVENT_KINDS) need.push(`battle.status.${s}`);
  for (const s of TEXT_SPEEDS) need.push(`settings.textSpeed.${s}`);
  for (const s of SCALE_MODES) need.push(`settings.scale.${s}`);
  for (const p of POCKET_IDS) need.push(`pocket.${p}`);
  for (const a of ACTIONS) need.push(`action.${a}`);
  for (const d of ['keyboard', 'gamepad', 'touch']) need.push(`device.${d}`);
  for (const s of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) need.push(`summary.stat.${s}`);
  for (const k of ['deepNight', 'predawn', 'morning', 'lateMorning', 'midday', 'afternoon', 'dusk', 'night']) need.push(`daypart.${k}`);
  for (const k of ['up', 'side', 'down']) need.push(`forecast.${k}`);
  for (const k of ['fight', 'read', 'lantern', 'bag', 'run']) need.push(`battle.cmd.${k}`);
  for (const k of ['paid', 'paying', 'pick', 'later', 'finale']) need.push(`ledger.house.${k}`);
  const missing = need.filter((k) => !has(k));
  assert.deepEqual(missing, []);
  // the theme defaults and the UI glossary say the same thing
  for (const [k, v] of Object.entries(THEME_STRINGS)) assert.equal(t(`ui.${k}`), v, `ui.${k}`);
  // every type the UI chips can show has its word in the chart order the manifest lists
  assert.deepEqual(Object.keys(TYPE_CHIPS), [...M.TYPE_IDS]);
});

test('strings: families keyed by ids owned elsewhere match the manifest exactly', () => {
  // [prefix, manifest ids, suffix, helper keys in the same namespace that are not ids]
  const families = [
    ['weather.', M.WEATHER_IDS, '', ['odds']],
    ['roof.', M.ROOF_COLOUR_IDS, '', []],
    ['badge.', M.SPIRE_IDS, '', []],
    ['waystone.', M.WAYSTONE_IDS, '', ['saved', 'healedAlready', 'deferred']],
    ['commission.', M.COMMISSION_IDS, '', ['leftover']],
    ['stamp.', M.STAMP_IDS, '.name', []],
    ['stamp.', M.STAMP_IDS, '.text', []],
    ['challenge.', M.CHALLENGE_IDS, '.name', []],
    ['challenge.', M.CHALLENGE_IDS, '.text', []],
    ['dial.', M.DIAL_IDS, '.tag', []],
  ];
  for (const [prefix, ids, suffix, helpers] of families) {
    for (const id of ids) assert.ok(has(`${prefix}${id}${suffix}`), `${prefix}${id}${suffix}`);
    const re = new RegExp(`^${prefix.replace('.', '\\.')}([a-z0-9-]+)${suffix.replace('.', '\\.')}$`);
    const extra = KEYS.map((k) => re.exec(k)?.[1]).filter((id) => id && !ids.includes(id) && !helpers.includes(id));
    assert.deepEqual(extra, [], `${prefix}*${suffix}: ids not in the manifest`);
  }
  // stamp names agree with GDD-ids for the ones GDD-00 names outright
  assert.equal(t('stamp.someone-picked-you.name'), 'Someone Picked You');
  assert.equal(t('stamp.identity-crisis.name'), 'Identity Crisis');
  assert.equal(t('stamp.first-steps.name'), 'First Steps');
});

// ---- confirms --------------------------------------------------------------------------------

test('confirms: safe option first and focused, every key resolves', () => {
  const SAFE = new Set(['confirm.no', 'confirm.option.keep', 'confirm.option.stay', 'confirm.option.later']);
  for (const [id, c] of Object.entries(CONFIRMS)) {
    assert.ok(has(c.body), `${id}: body ${c.body}`);
    assert.ok(c.options.length >= 2, `${id}: two options`);
    for (const k of c.options) assert.ok(has(k), `${id}: option ${k}`);
    assert.ok(SAFE.has(c.options[0]), `${id}: first option ${c.options[0]} must be the safe one`);
    assert.ok(!SAFE.has(c.options[1]), `${id}: second option must be the action`);
    const spec = confirmSpec(id, { item: "Isolde's Lantern", slot: 'Slot 1', place: 'Lowmoor', cost: 200 });
    assert.equal(spec.defaultIndex, 0);
    assert.ok(!spec.body.startsWith('['), id);
  }
  assert.deepEqual(confirmSpec('oneOfAKind', { item: "Isolde's Lantern" }).options, ['Keep it', 'Use it']);
  assert.equal(confirmSpec('nope').defaultIndex, 0);
});

// ---- credits ---------------------------------------------------------------------------------

test('credits: roll content (studio, both pitches, Claude Code, owner handle only)', () => {
  const all = CREDITS.flatMap((r) => [r.heading, ...r.lines]).join('\n');
  assert.ok(all.includes("Token Maxxer's Anonymous Game Studio"));
  assert.ok(/WILDSHIFT/.test(all) && /PORCHLIGHT/.test(all), 'both source pitches credited');
  assert.ok(/made with Claude Code/i.test(all));
  assert.ok(all.includes('timothy8901'));
  assert.ok(!/PLACEHOLDER|TODO|\[GDD\]/.test(all));
  assert.equal(CREDITS[0].heading, 'LAMPFALL');
  const ids = CREDITS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'unique ids');
  for (const r of CREDITS) {
    assert.match(r.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.ok(Object.isFrozen(r) && Object.isFrozen(r.lines));
    for (const line of [r.heading, ...r.lines]) {
      for (const ch of normalizeText(line)) if (ch !== ' ') assert.ok(hasGlyph(ch, 'main'), `credits ${r.id}: '${ch}'`);
    }
  }
});

test('credits: validateData has zero errors for the credits table and the manifest check is quiet', () => {
  const D = { ...DATA, credits: CREDITS };
  const { errors } = validateData(D);
  assert.deepEqual(errors.filter((e) => e.startsWith('credits')), []);
  const { warnings } = checkManifest(D, M.MANIFEST);
  assert.deepEqual(warnings.filter((w) => w.startsWith('credits')), []);
  assert.equal(M.MANIFEST.credits, undefined, 'credits is not a manifest table (no ids to match)');
});
