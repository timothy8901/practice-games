/** Story overlays: a marker is a trigger cell; conditions make every completed beat inert. */
import { deepFreeze } from '../ids.js';
import { mk } from './_stage.js';
import { SPIRES } from '../spires.js';
const flag = (id) => ({ flag: id });
const no = (id) => ({ not: flag(id) });
const all = (...conds) => ({ all: conds });
const rows = [];
function trigger(mapId, marker, script, cond, kind = 'step', id = script) {
  rows.push({ mapId, id: `story-${id}`, kind, ...mk(mapId, marker), script,
    cond: cond ?? { not: { seen: script } }, once: !['linnet-brackenford-before', 'linnet-gate-before', 'corin-first-forecast', 'passenger-perch', 'pip-before', 'wick-long-road-before'].includes(script) });
}
// The arrival is queued by boot; this cell also supports returning to an untouched fresh save.
trigger('pellwick', 'arrival-start', 'arrival-causeway', no('sp.arrived'), 'enter');
trigger('pellwick', 'cottage-porch', 'wick-keeper', all(flag('sp.starter-chosen'), { not: { seen: 'wick-keeper' } }));
trigger('pellwick', 'porch-keepers-cottage-step', 'corin-reading-glass', all(flag('sp.starter-chosen'), no('sp.reading-glass')));
trigger('pellwick', 'yard-apron', 'yard-apron', all(flag('sp.errands-started'), no('sys.errand.apron')));
trigger('pellwick', 'commons-pin', 'tully-nickname', all(flag('sp.errands-started'), no('sys.errand.notice')), 'use');
trigger('pellwick', 'first-orchard', 'first-orchard', all(flag('sp.errands-started'), no('sys.errand.orchard')));
trigger('pellwick', 'meet-odile', 'meet-neighbors', all(flag('sp.errands-started'), no('np.odile.met-step')), 'step', 'meet-odile');
trigger('pellwick', 'meet-bryony', 'meet-neighbors', all(flag('sp.errands-started'), no('np.bryony.met-step')), 'step', 'meet-bryony');
trigger('pellwick', 'meet-thessaly', 'meet-neighbors', all(flag('sp.errands-started'), no('np.thessaly.met-step')), 'step', 'meet-thessaly');
trigger('pellwick', 'mail-sack', 'hesper-mail-sack', all(flag('sp.errands-started'), no('sp.mail-sack'), { not: { hasItem: 'mail-sack' } }), 'use', 'mail-sack-pickup');
trigger('pellwick', 'post-office-door', 'hesper-mail-sack', all(no('sp.mail-sack'), { hasItem: 'mail-sack' }), 'use', 'mail-sack-return');
trigger('pellwick', 'reeds-stance', 'corin-capture-stance', all(flag('sp.dock-battle'), no('sp.capture-stance')));
trigger('pellwick', 'archive-porthole', 'barnaby-field-log', all(flag('sp.errands-started'), no('sp.field-log')), 'use');
trigger('pellwick', 'ansel-tells-player', 'ansel-fishing-tells', all(flag('sp.errands-started'), no('sys.errand.fish')));
trigger('pellwick', 'pip-player', 'pip-before', all(flag('sp.capture-stance'), no('sys.trainer.pip')));
trigger('pellwick', 'ludo-sale', 'ludo-first-sale', all(flag('sp.errands-started'), { hour: [22, 8] }, { not: { seen: 'ludo-first-sale' } }), 'use');
trigger('pellwick', 'porchlight-player', 'porchlight-on', all(flag('sp.first-payment'), { not: { seen: 'porchlight-on' } }));
trigger('pellwick', 'corin-slip', 'corin-slip', all(flag('sp.dock-battle'), { party: { level: { gte: 7 } } }, { not: { seen: 'corin-slip' } }));
trigger('pellwick', 'glowing-flats', 'first-glowing-flats', all(flag('sp.starter-chosen'), { hour: [22, 6] }, { lowTide: true }, { not: { seen: 'first-glowing-flats' } }));
trigger('lowmoor', 'corin-first-forecast', 'corin-first-forecast', all(flag('sp.reading-glass'), no('sp.first-forecast')));
trigger('lowmoor', 'practice-table-player', 'maud-practice-table', no('sp.reroll-taught'), 'use');
trigger('lowmoor', 'rematch-player', 'linnet-brackenford-before', all({ badge: 1 }, no('sp.linnet-rematch')));
trigger('cairnhold', 'memorial-player', 'cairnhold-memorial', no('sp.memorial-seen'));
trigger('cairnhold', 'clinic-door', 'anchorage-turns-away', no('sp.anchorage-seen'));
trigger('emberstep', 'errant-sighting-player', 'first-errant-sighting', no('sp.errant-seen'));
trigger('drownwood', 'drowning-street-player', 'drowning-street', all({ lowTide: true }, no('sp.drowning-street')));
// the Surge is a mid-game beat: never after the Relighting (MID-07), whichever way it would fire
trigger('thistlewind', 'surge-player', 'the-surge', all({ badge: 4 }, { hour: [18, 6] }, no('sp.surge'), no('sp.relighting')));
trigger('rimeholt', 'gallery-player', 'idris-gallery', no('sp.idris-gallery'));
trigger('rimeholt', 'linnet-returns-player', 'linnet-returns', all(flag('sp.linnet-fell'), no('sp.linnet-returned')));
trigger('spire-mirror', 'gallery-look', 'idris-gallery', no('sp.idris-gallery'));
trigger('hollis-gate', 'summit-gate-player', 'summit-gate', all({ badge: 6 }, no('sp.summit-open')));
trigger('the-bar', 'linnet-gate', 'linnet-gate-before', all({ badge: 6 }, no('sp.linnet-gate')));
trigger('the-bar', 'wick-long-road', 'wick-long-road-before', no('sys.trainer.wick-long-road'), 'use');
trigger('lantern-stack', 'perch-front', 'passenger-perch', all(flag('sp.credits-seen'), no('sp.passenger-caught')), 'use');
// Merged from the story chapter: first entry into each Spire, and Hollis's parcel at the Bar head.
// (A save that already holds the badge never gets the challenger's welcome.)
for (const s of SPIRES) trigger(s.map, 'from-door', `story-spire-${s.id}-enter`, all({ not: { seen: `story-spire-${s.id}-enter` } }, { not: { badge: s.id } }), 'enter', `spire-${s.id}-door`);
trigger('the-bar', 'from-pellwick', 'story-ration-ledger', { not: { hasItem: 'ration-ledger' } }, 'enter', 'ration-ledger');
export const STORY_TRIGGERS = deepFreeze(Object.fromEntries([...new Set(rows.map((r) => r.mapId))].map((id) => [id, rows.filter((r) => r.mapId === id).map(({ mapId, ...r }) => r)])));

const events = [];
function event(id, event, script, cond, once = true) { events.push({ id, event, script, ...(cond ? { cond } : {}), once }); }
// One script per event (systems/flow/eventScripts takes the first matching row), so the Spire's own
// badge beat plays; the first badge's beat opens Act II itself (story-acts `spireBadge`).
for (const s of SPIRES) event(`badge-${s.id}`, `badge:won:${s.id}`, `story-spire-${s.id}-badge`);
event('opening-corin', 'flag:set:seen.wick-keeper', 'corin-reading-glass', no('sp.reading-glass'));
event('loan-one-cleared', 'loan:tier:2', 'first-payment');
event('lamp-room-offer', 'loan:tier:7', 'lamp-room-offered');
event('lamp-room-finished', 'loan:built:lamp-room', 'lamp-room-built');
event('relighting-dusk', 'relighting:due', 'relighting', no('sp.relighting'));
event('first-roof', 'loan:built:bedsit', 'thatch-first-roof');
event('first-keeper-letter', 'letter:delivered:1', 'hesper-k1');
// After the credits, one dark house reopens a night (houses 2-8 in pellwick.js `reopensNight` order;
// the counter stops it at seven). It sits ahead of every other clock row so 20:00 always belongs to
// it (one script per event); the market lights and the party catch up on the next hour or map.
event('dark-house-night', 'clock:hour:20', 'dark-house-reopens', all(flag('lit.fleetHome'), flag('sp.credits-seen'), { counter: 'sys.dark-houses-reopened', lte: 6 }), false);
// Clock fallbacks let a town-first player see the acts without badges or a date deadline.
// `day` is the GDD day of the run (cond DSL, MID-07): the Raft docks on day 3, Act II opens by day 4,
// the first Lantern Market is day 7 (a Saturday, 20:00-02:00), the Surge falls back to day 10. A
// mid-game beat waits for the act it belongs to, and none of them plays after the Relighting (the
// finale has already answered the comet, the Engine and the charges).
/** The Lantern Market window: Saturday 20:00 to Sunday 02:00 (GDD weekdays, 0 = Monday). */
const MARKET_WINDOW = { any: [all({ day: { dow: [5] } }, { hour: [20, 24] }), all({ day: { dow: [6] } }, { hour: [0, 2] })] };
const NOT_LIT = no('sp.relighting');
for (const evt of ['day:start', 'clock:hour', 'map:enter']) {
  const key = evt.replace(':', '-');
  event(`raft-${key}`, evt, 'raft-docks', all({ day: { gte: 3 } }, no('sp.raft-docked')));
  event(`new-neighbor-${key}`, evt, 'tamsin-arrives', all({ day: { gte: 3 } }, flag('sys.commons.dark-house-1'), no('sp.tamsin-arrived')));
  event(`act-two-${key}`, evt, 'act-2-open', all({ any: [{ badge: 1 }, { day: { gte: 4 } }] }, no('sp.act-2'), NOT_LIT));
  event(`act-three-${key}`, evt, 'comet-brightens', all(flag('sp.act-2'), { any: [{ badge: 3 }, { loan: { tier: { gte: 4 } } }] }, no('sp.act-3'), NOT_LIT));
  event(`surge-${key}`, evt, 'the-surge', all(flag('sp.act-3'), { day: { gte: 10 } }, no('sp.surge'), NOT_LIT));
  event(`market-${key}`, evt, 'first-lantern-market', all(flag('sp.act-2'), { day: { gte: 7 } }, MARKET_WINDOW, no('sp.first-market'), NOT_LIT));
  event(`linnet-fall-${key}`, evt, 'linnet-fall', all(flag('sp.first-market'), { badge: 2 }, MARKET_WINDOW, no('sp.linnet-fell'), NOT_LIT));
  event(`plans-${key}`, evt, 'two-plans-one-night', all(flag('sp.act-3'), { any: [{ badge: 5 }, { loan: { tier: { gte: 6 } } }] }, { hour: [18, 6] }, { lowTide: true }, no('sp.two-plans'), NOT_LIT));
}
// The market's string lights and stalls (pellwick.js `sys.lantern-market`) are up only on a market
// night once the first market has been held: lit as the window opens, struck after it (LG-CH61).
for (const evt of ['clock:hour', 'map:enter', 'day:start']) {
  const key = evt.replace(':', '-');
  event(`market-lights-on-${key}`, evt, 'market-lights-on', all(flag('sp.first-market'), MARKET_WINDOW, no('sys.lantern-market')), false);
  event(`market-lights-off-${key}`, evt, 'market-lights-off', all(flag('sys.lantern-market'), { not: MARKET_WINDOW }), false);
}
// The 56th letter arrives with the 06:00 post; the party itself is on the green that evening
// (data/town.js festival `late-delivery-party`, 18:00-02:00).
for (const evt of ['clock:hour', 'map:enter']) {
  event(`fifty-six-letters-${evt.replace(':', '-')}`, evt, 'late-delivery-party', all(flag('sp.late-delivery'), { hour: [18, 2] }));
}
event('after-linnet-return', 'flag:set:sp.linnet-returned', 'comet-brightens', no('sp.act-3'));
event('first-forecast-anywhere', 'shift:resolved', 'story-first-forecast-noted', no('sp.first-forecast'));
export const EVENT_SCRIPTS = deepFreeze(events);

/** Prefix hooks the host installs on flag:set. Each value names its existing system function. */
export const SCRIPT_HOOKS = deepFreeze({ 'sys.errand.': 'loans.errand', 'sys.deliver.': 'letters.deliverEvent', 'sys.porch.': 'townCommon.porchFlag' });
